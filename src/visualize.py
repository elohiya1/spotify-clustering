"""Assembles the single handoff artifact: output.json (schema in the PRD).

Merges track identity (my_top_tracks.csv), cluster assignments + GMM
probabilities (clustering_results.csv), agent-generated names/descriptions
(cluster_descriptions.json), and judge scores (judge_scores.json). Computes
a fresh 2-component PCA projection of the embeddings for pca_x/pca_y.

Writes to BOTH output/output.json (canonical deliverable) and
frontend/public/output.json (so `npm run dev` picks up a fresh pipeline run
immediately, no manual copy step) — plus a debug-only Plotly PCA scatter at
output/cluster_scatter.html.
"""
import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import plotly.express as px
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")
FRONTEND_PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public")

TOP_TRACKS_PATH = os.path.join(DATA_DIR, "my_top_tracks.csv")
EMBEDDINGS_PATH = os.path.join(DATA_DIR, "embeddings.npy")
CONTEXT_PATH = os.path.join(DATA_DIR, "track_context.csv")
RESULTS_PATH = os.path.join(DATA_DIR, "clustering_results.csv")
META_PATH = os.path.join(DATA_DIR, "clustering_meta.json")
DESCRIPTIONS_PATH = os.path.join(OUTPUT_DIR, "cluster_descriptions.json")
JUDGE_SCORES_PATH = os.path.join(OUTPUT_DIR, "judge_scores.json")

SCATTER_OUTPUT = os.path.join(OUTPUT_DIR, "cluster_scatter.html")
OUTPUT_JSON_PATH = os.path.join(OUTPUT_DIR, "output.json")
FRONTEND_OUTPUT_JSON_PATH = os.path.join(FRONTEND_PUBLIC_DIR, "output.json")

# Warm/muted palette (dusty rose, warm mauve, muted terracotta, faded sage,
# soft gold, slate blue), cycled if chosen_k exceeds 6. Validated against the
# dark app surface (#0A0A0A) via the dataviz skill's categorical checks —
# lightness band, chroma floor, all-pairs CVD separation, contrast — since
# this same color drives cluster pills, track dots, the vinyl label, and the
# PCA scatter map. The original, more desaturated draft of this palette
# failed those checks (read as gray, and terracotta/gold collapsed for
# deutan/protan colorblindness); these hues keep the same families but are
# pulled to pass.
PALETTE = ["#C85B76", "#A8628F", "#A8421F", "#6E9C4F", "#AD8F2C", "#4F6FB0"]


def none_if_nan(value):
    return None if pd.isna(value) else value


def load_required(path, hint):
    if not os.path.exists(path):
        sys.exit(f"Missing {path}. {hint}")


def compute_pca(track_ids):
    embeddings = np.load(EMBEDDINGS_PATH)
    X_scaled = StandardScaler().fit_transform(embeddings)
    coords = PCA(n_components=2).fit_transform(X_scaled)
    return {tid: (float(x), float(y)) for tid, (x, y) in zip(track_ids, coords)}


def main():
    load_required(TOP_TRACKS_PATH, "Run fetch_top_tracks.py first.")
    load_required(EMBEDDINGS_PATH, "Run build_embeddings.py first.")
    load_required(RESULTS_PATH, "Run cluster.py first.")
    load_required(META_PATH, "Run cluster.py first.")
    load_required(DESCRIPTIONS_PATH, "Run agent_describe_clusters.py first.")
    load_required(JUDGE_SCORES_PATH, "Run judge_eval.py first.")

    top_tracks_df = pd.read_csv(TOP_TRACKS_PATH)
    context_df = pd.read_csv(CONTEXT_PATH)
    results_df = pd.read_csv(RESULTS_PATH)

    with open(META_PATH) as f:
        meta = json.load(f)
    with open(DESCRIPTIONS_PATH) as f:
        descriptions = json.load(f)
    with open(JUDGE_SCORES_PATH) as f:
        judge_scores = json.load(f)

    chosen_model = meta["chosen_model"]
    cluster_col = "kmeans_cluster" if chosen_model == "kmeans" else "gmm_cluster"

    pca_by_track = compute_pca(context_df["track_id"].tolist())

    merged = top_tracks_df.merge(results_df, on="track_id", how="inner")

    tracks_out = []
    for row in merged.itertuples():
        pca_x, pca_y = pca_by_track.get(row.track_id, (0.0, 0.0))
        tracks_out.append({
            "track_id": row.track_id,
            "track_uri": row.track_uri,
            "track_name": row.track_name,
            "artist_name": row.artist_name,
            "album_name": row.album_name,
            "album_art_url": none_if_nan(row.album_art_url),
            "preview_url": none_if_nan(row.preview_url),
            "cluster_id": int(getattr(row, cluster_col)),
            "popularity": none_if_nan(row.popularity),
            "pca_x": round(pca_x, 4),
            "pca_y": round(pca_y, 4),
            "gmm_probabilities": json.loads(row.gmm_probabilities),
        })

    cluster_ids = sorted({t["cluster_id"] for t in tracks_out})
    clusters_out = []
    for cluster_id in cluster_ids:
        desc = descriptions.get(str(cluster_id), {"name": f"Cluster {cluster_id}", "description": ""})
        scores = judge_scores.get(str(cluster_id), {})
        clusters_out.append({
            "cluster_id": cluster_id,
            "cluster_name": desc["name"],
            "cluster_description": desc["description"],
            "color_swatch": PALETTE[cluster_id % len(PALETTE)],
            "judge_scores": {
                "groundedness": scores.get("groundedness"),
                "specificity": scores.get("specificity"),
                "accuracy": scores.get("accuracy"),
                "average": scores.get("average"),
                "confidence_tier": scores.get("confidence_tier"),
            },
        })

    tracks_with_preview = sum(1 for t in tracks_out if t["preview_url"])
    output = {
        "tracks": tracks_out,
        "clusters": clusters_out,
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_tracks": len(tracks_out),
            "tracks_with_preview": tracks_with_preview,
            "chosen_model": chosen_model,
            "chosen_k": meta["chosen_k"],
            "silhouette_score": meta["silhouette_score"],
        },
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(FRONTEND_PUBLIC_DIR, exist_ok=True)
    with open(OUTPUT_JSON_PATH, "w") as f:
        json.dump(output, f, indent=2)
    with open(FRONTEND_OUTPUT_JSON_PATH, "w") as f:
        json.dump(output, f, indent=2)
    print(f"Wrote {len(tracks_out)} tracks across {len(clusters_out)} clusters to:")
    print(f"  {OUTPUT_JSON_PATH}")
    print(f"  {FRONTEND_OUTPUT_JSON_PATH}")

    preview_pct = tracks_with_preview / len(tracks_out) * 100 if tracks_out else 0
    print(f"Tracks with preview: {tracks_with_preview}/{len(tracks_out)} ({preview_pct:.1f}%)")

    scatter_df = pd.DataFrame(tracks_out)
    scatter_df["cluster_id"] = scatter_df["cluster_id"].astype(str)
    fig = px.scatter(
        scatter_df,
        x="pca_x",
        y="pca_y",
        color="cluster_id",
        hover_data={"track_name": True, "artist_name": True, "cluster_id": True, "pca_x": False, "pca_y": False},
        title=f"Top Tracks by Taste Cluster (PCA of Gemini embeddings, {chosen_model} @ k={meta['chosen_k']})",
    )
    fig.update_traces(marker=dict(size=9, opacity=0.8))
    fig.write_html(SCATTER_OUTPUT)
    print(f"Wrote debug scatter plot to {SCATTER_OUTPUT}")


if __name__ == "__main__":
    main()
