"""StandardScaler -> KMeans + GMM sweep (k=2..10) on Gemini embeddings.

KMeans is scored with silhouette score. GMM is scored with BIC (lower is
better) and silhouette (for comparability). A single (model, k) pair is
auto-selected from the sweep, tie-breaking toward GMM when its own BIC- and
silhouette-optimal k agree, since soft assignment probabilities are more
informative downstream. Both models are then fit at that one chosen k so
data/clustering_results.csv carries kmeans_cluster, gmm_cluster, and
gmm_probabilities side by side.

Semantic cluster naming is NOT done here — embedding dimensions aren't
individually interpretable the way hand-crafted audio features were, so
naming is entirely the orchestrating agent's job (agent_describe_clusters.py).
"""
import json
import os
import sys

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import StandardScaler

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
EMBEDDINGS_PATH = os.path.join(DATA_DIR, "embeddings.npy")
CONTEXT_PATH = os.path.join(DATA_DIR, "track_context.csv")
RESULTS_PATH = os.path.join(DATA_DIR, "clustering_results.csv")
META_PATH = os.path.join(DATA_DIR, "clustering_meta.json")

K_MIN, K_MAX = 2, 10
RANDOM_STATE = 42


def load_embeddings():
    if not os.path.exists(EMBEDDINGS_PATH) or not os.path.exists(CONTEXT_PATH):
        sys.exit(f"Missing {EMBEDDINGS_PATH} or {CONTEXT_PATH}. Run build_embeddings.py first.")
    embeddings = np.load(EMBEDDINGS_PATH)
    context_df = pd.read_csv(CONTEXT_PATH)
    if len(embeddings) != len(context_df):
        sys.exit("embeddings.npy and track_context.csv are misaligned — rerun build_embeddings.py.")
    return embeddings, context_df


def sweep(X_scaled):
    """Return per-k stats for both algorithms across K_MIN..K_MAX."""
    results = []
    for k in range(K_MIN, K_MAX + 1):
        kmeans = KMeans(n_clusters=k, n_init=10, random_state=RANDOM_STATE)
        kmeans_labels = kmeans.fit_predict(X_scaled)
        kmeans_sil = silhouette_score(X_scaled, kmeans_labels)

        gmm = GaussianMixture(n_components=k, random_state=RANDOM_STATE)
        gmm.fit(X_scaled)
        gmm_labels = gmm.predict(X_scaled)
        gmm_sil = silhouette_score(X_scaled, gmm_labels)
        gmm_bic = gmm.bic(X_scaled)

        results.append({
            "k": k,
            "kmeans_silhouette": float(kmeans_sil),
            "gmm_silhouette": float(gmm_sil),
            "gmm_bic": float(gmm_bic),
        })
    return results


def choose_model_and_k(sweep_results):
    kmeans_best = max(sweep_results, key=lambda r: r["kmeans_silhouette"])
    gmm_bic_best = min(sweep_results, key=lambda r: r["gmm_bic"])
    gmm_sil_best = max(sweep_results, key=lambda r: r["gmm_silhouette"])

    bic_and_silhouette_agree = gmm_bic_best["k"] == gmm_sil_best["k"]
    gmm_candidate_sil = gmm_bic_best["gmm_silhouette"]

    if bic_and_silhouette_agree and gmm_candidate_sil >= kmeans_best["kmeans_silhouette"]:
        return "gmm", gmm_bic_best["k"]

    if gmm_candidate_sil >= kmeans_best["kmeans_silhouette"]:
        return "gmm", gmm_bic_best["k"]

    return "kmeans", kmeans_best["k"]


def main():
    embeddings, context_df = load_embeddings()
    track_ids = context_df["track_id"].tolist()

    if len(track_ids) < K_MAX:
        sys.exit(f"Only {len(track_ids)} tracks — not enough to sweep k up to {K_MAX}.")

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(embeddings)

    print(f"Sweeping k={K_MIN}..{K_MAX} (KMeans: silhouette, GMM: BIC + silhouette)...")
    sweep_results = sweep(X_scaled)
    for r in sweep_results:
        print(
            f"  k={r['k']}: kmeans_silhouette={r['kmeans_silhouette']:.4f}  "
            f"gmm_silhouette={r['gmm_silhouette']:.4f}  gmm_bic={r['gmm_bic']:.1f}"
        )

    chosen_model, chosen_k = choose_model_and_k(sweep_results)
    chosen_row = next(r for r in sweep_results if r["k"] == chosen_k)
    chosen_silhouette = chosen_row["kmeans_silhouette"] if chosen_model == "kmeans" else chosen_row["gmm_silhouette"]

    print(f"\nChosen: {chosen_model} @ k={chosen_k}  "
          f"(silhouette={chosen_silhouette:.4f}"
          + (f", bic={chosen_row['gmm_bic']:.1f}" if chosen_model == "gmm" else "") + ")")

    kmeans = KMeans(n_clusters=chosen_k, n_init=10, random_state=RANDOM_STATE)
    kmeans_labels = kmeans.fit_predict(X_scaled)

    gmm = GaussianMixture(n_components=chosen_k, random_state=RANDOM_STATE)
    gmm.fit(X_scaled)
    gmm_probabilities = gmm.predict_proba(X_scaled)
    gmm_labels = gmm_probabilities.argmax(axis=1)

    results_df = pd.DataFrame({
        "track_id": track_ids,
        "kmeans_cluster": kmeans_labels,
        "gmm_cluster": gmm_labels,
        "gmm_probabilities": [json.dumps([round(float(p), 4) for p in row]) for row in gmm_probabilities],
    })
    os.makedirs(DATA_DIR, exist_ok=True)
    results_df.to_csv(RESULTS_PATH, index=False)
    print(f"Wrote {len(results_df)} rows to {RESULTS_PATH}")

    with open(META_PATH, "w") as f:
        json.dump({
            "chosen_model": chosen_model,
            "chosen_k": int(chosen_k),
            "silhouette_score": float(chosen_silhouette),
            "gmm_bic": float(chosen_row["gmm_bic"]),
            "sweep": sweep_results,
        }, f, indent=2)
    print(f"Wrote clustering metadata to {META_PATH}")


if __name__ == "__main__":
    main()
