"""Plotly scatter of PCA components colored by cluster, plus an optional
bar chart comparing mean feature values across clusters.
"""
import os

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")
CLUSTERED_PATH = os.path.join(DATA_DIR, "clustered_tracks.csv")
SCATTER_OUTPUT = os.path.join(OUTPUT_DIR, "cluster_scatter.html")
FEATURES_OUTPUT = os.path.join(OUTPUT_DIR, "cluster_features.html")

FEATURE_COLS = [
    "acousticness", "danceability", "energy", "instrumentalness",
    "liveness", "speechiness", "valence",
]


def main():
    if not os.path.exists(CLUSTERED_PATH):
        raise SystemExit(f"Missing {CLUSTERED_PATH}. Run cluster.py first.")

    df = pd.read_csv(CLUSTERED_PATH)
    if "pca_1" not in df.columns or "pca_2" not in df.columns:
        raise SystemExit("clustered_tracks.csv has no pca_1/pca_2 columns — rerun cluster.py with >=2 components.")

    df["cluster"] = df["cluster"].astype(str)

    fig = px.scatter(
        df,
        x="pca_1",
        y="pca_2",
        color="cluster",
        hover_data={"track_name": True, "artist_name": True, "cluster": True, "pca_1": False, "pca_2": False},
        title="Top Tracks Clustered by Audio Features (PCA projection)",
    )
    fig.update_traces(marker=dict(size=9, opacity=0.8))

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    fig.write_html(SCATTER_OUTPUT)
    print(f"Wrote scatter plot to {SCATTER_OUTPUT}")

    # Optional: mean feature comparison across clusters
    means = df.groupby("cluster")[FEATURE_COLS].mean()
    bar_fig = go.Figure()
    for cluster_id, row in means.iterrows():
        bar_fig.add_trace(go.Bar(name=f"Cluster {cluster_id}", x=FEATURE_COLS, y=row.values))
    bar_fig.update_layout(
        barmode="group",
        title="Mean Audio Feature Values by Cluster",
        yaxis_title="Mean value (0-1 scale features)",
    )
    bar_fig.write_html(FEATURES_OUTPUT)
    print(f"Wrote feature comparison chart to {FEATURES_OUTPUT}")


if __name__ == "__main__":
    main()
