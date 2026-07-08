"""StandardScaler -> PCA -> KMeans on merged audio features.

Clusters in full scaled feature space, projects to PCA components for
visualization only. Writes data/clustered_tracks.csv.
"""
import argparse
import os

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
MERGED_PATH = os.path.join(DATA_DIR, "merged_features.csv")
OUTPUT_PATH = os.path.join(DATA_DIR, "clustered_tracks.csv")

FEATURE_COLS = [
    "acousticness", "danceability", "energy", "instrumentalness",
    "liveness", "loudness", "speechiness", "tempo", "valence",
    "key", "mode",
]


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--k", type=int, default=4, help="number of clusters")
    parser.add_argument("--pca-components", type=int, default=2)
    parser.add_argument("--top-n", type=int, default=5, help="tracks to show per cluster centroid")
    return parser.parse_args()


def main():
    args = parse_args()

    if not os.path.exists(MERGED_PATH):
        raise SystemExit(f"Missing {MERGED_PATH}. Run match_features.py first.")

    df = pd.read_csv(MERGED_PATH)
    before = len(df)
    df = df.dropna(subset=FEATURE_COLS).reset_index(drop=True)
    dropped = before - len(df)
    if dropped:
        print(f"Dropped {dropped} rows with missing feature values.")

    if len(df) < args.k:
        raise SystemExit(f"Only {len(df)} tracks with complete features — not enough for k={args.k}.")

    X = df[FEATURE_COLS].to_numpy(dtype=float)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    pca = PCA(n_components=args.pca_components)
    X_pca = pca.fit_transform(X_scaled)
    print(f"PCA explained variance ratio: {np.round(pca.explained_variance_ratio_, 3)} "
          f"(total: {pca.explained_variance_ratio_.sum():.3f})")

    kmeans = KMeans(n_clusters=args.k, n_init=10, random_state=42)
    labels = kmeans.fit_predict(X_scaled)

    df["cluster"] = labels
    for i in range(args.pca_components):
        df[f"pca_{i+1}"] = X_pca[:, i]

    print(f"\nCluster summary (k={args.k}):\n")
    for cluster_id in range(args.k):
        mask = labels == cluster_id
        cluster_df = df[mask]
        centroid = kmeans.cluster_centers_[cluster_id]
        cluster_scaled = X_scaled[mask]

        dists = np.linalg.norm(cluster_scaled - centroid, axis=1)
        closest_idx = np.argsort(dists)[: args.top_n]
        closest_tracks = cluster_df.iloc[closest_idx]

        print(f"--- Cluster {cluster_id} ({mask.sum()} tracks) ---")
        print("Closest tracks to centroid:")
        for _, row in closest_tracks.iterrows():
            print(f"  {row['track_name']} — {row['artist_name']}")
        print("Mean features:")
        print(cluster_df[FEATURE_COLS].mean().round(3).to_string())
        print()

    os.makedirs(DATA_DIR, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Wrote {len(df)} labeled tracks to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
