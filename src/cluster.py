"""StandardScaler -> PCA -> KMeans/GMM on merged audio features.

Clusters in full scaled feature space, projects to PCA components for
visualization only. Writes data/clustered_tracks.csv.

If --k is omitted, sweeps k=2..8, prints silhouette scores, and picks the
best k automatically.
"""
import argparse
import os

import numpy as np
from sklearn.metrics import silhouette_score

import clustering

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_PATH = os.path.join(DATA_DIR, "clustered_tracks.csv")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--k", type=int, default=None,
                         help="number of clusters (omit to sweep k=2..8 and auto-pick the best)")
    parser.add_argument("--pca-components", type=int, default=2)
    parser.add_argument("--top-n", type=int, default=5, help="tracks to show per cluster centroid")
    return parser.parse_args()


def print_cluster_summary(label, df, X_scaled, labels, centroids, k, top_n):
    print(f"\n{label} cluster summary (k={k}):\n")
    for cluster_id in range(k):
        mask = labels == cluster_id
        cluster_df = df[mask]
        name, description = clustering.describe_cluster(centroids[cluster_id])

        dists = np.linalg.norm(X_scaled[mask] - centroids[cluster_id], axis=1)
        closest_idx = np.argsort(dists)[:top_n]
        closest_tracks = cluster_df.iloc[closest_idx]

        print(f"--- Cluster {cluster_id}: {name} ({mask.sum()} tracks) ---")
        print(description)
        print("Closest tracks to centroid:")
        for _, row in closest_tracks.iterrows():
            print(f"  {row['track_name']} — {row['artist_name']}")
        print("Mean features:")
        print(cluster_df[clustering.FEATURE_COLS].mean().round(3).to_string())
        print()


def main():
    args = parse_args()

    df = clustering.load_merged_features()
    X_scaled, _ = clustering.prepare_feature_matrix(df)

    if args.k is not None and len(df) < args.k:
        raise SystemExit(f"Only {len(df)} tracks with complete features — not enough for k={args.k}.")

    if args.k is None:
        sweep = clustering.silhouette_sweep(X_scaled)
        best_k = max(sweep, key=lambda point: point["silhouette_score"])["k"]
        print("Silhouette sweep (k=2..8):")
        for point in sweep:
            marker = " *" if point["k"] == best_k else ""
            print(f"  k={point['k']}: {point['silhouette_score']:.4f}{marker}")
        print(f"Best k by silhouette score: {best_k}\n")
        k = best_k
    else:
        k = args.k

    X_pca, pca = clustering.compute_pca(X_scaled, args.pca_components)
    print(f"PCA explained variance ratio: {np.round(pca.explained_variance_ratio_, 3)} "
          f"(total: {pca.explained_variance_ratio_.sum():.3f})")

    kmeans_labels, kmeans_model = clustering.fit_kmeans(X_scaled, k)
    gmm_labels, gmm_probabilities, gmm_model = clustering.fit_gmm(X_scaled, k)

    print(f"\nKMeans silhouette score: {silhouette_score(X_scaled, kmeans_labels):.4f}")
    print(f"GMM silhouette score: {silhouette_score(X_scaled, gmm_labels):.4f}")

    df["cluster"] = kmeans_labels
    df["gmm_cluster"] = gmm_labels
    for i in range(args.pca_components):
        df[f"pca_{i+1}"] = X_pca[:, i]
    for i in range(k):
        df[f"gmm_prob_{i}"] = gmm_probabilities[:, i]

    print_cluster_summary("KMeans", df, X_scaled, kmeans_labels, kmeans_model.cluster_centers_, k, args.top_n)
    print_cluster_summary("GMM", df, X_scaled, gmm_labels, gmm_model.means_, k, args.top_n)

    os.makedirs(DATA_DIR, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Wrote {len(df)} labeled tracks to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
