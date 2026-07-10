"""FastAPI backend serving live KMeans/GMM clustering results on demand.

Run with: cd src && uvicorn api_server:app --reload --port 8000
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sklearn.metrics import silhouette_score

import clustering
from schemas import (
    AlgorithmResult,
    ClusterResultsResponse,
    SweepPoint,
    SweepResponse,
)

K_MIN, K_MAX = 2, 8

state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    df = clustering.load_merged_features()
    X_scaled, scaler = clustering.prepare_feature_matrix(df)
    X_pca, pca = clustering.compute_pca(X_scaled)
    sweep = clustering.silhouette_sweep(X_scaled, K_MIN, K_MAX)

    state["df"] = df
    state["X_scaled"] = X_scaled
    state["X_pca"] = X_pca
    state["pca"] = pca
    state["sweep"] = sweep
    state["results_cache"] = {}
    yield
    state.clear()


app = FastAPI(title="Spotify Clustering API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/sweep", response_model=SweepResponse)
def get_sweep():
    sweep = state["sweep"]
    best_k = max(sweep, key=lambda point: point["silhouette_score"])["k"]
    return SweepResponse(
        k_values=[point["k"] for point in sweep],
        results=[SweepPoint(**point) for point in sweep],
        best_k=best_k,
    )


@app.get("/api/cluster-results", response_model=ClusterResultsResponse)
def get_cluster_results(k: int = Query(..., ge=K_MIN, le=K_MAX)):
    cache = state["results_cache"]
    if k in cache:
        return cache[k]

    df = state["df"]
    X_scaled = state["X_scaled"]
    X_pca = state["X_pca"]
    pca = state["pca"]

    kmeans_labels, kmeans_model = clustering.fit_kmeans(X_scaled, k)
    gmm_labels, gmm_probabilities, gmm_model = clustering.fit_gmm(X_scaled, k)

    kmeans_clusters = [
        clustering.build_cluster_summary(
            cluster_id, df[kmeans_labels == cluster_id], kmeans_model.cluster_centers_[cluster_id]
        )
        for cluster_id in range(k)
    ]
    gmm_clusters = [
        clustering.build_cluster_summary(
            cluster_id, df[gmm_labels == cluster_id], gmm_model.means_[cluster_id]
        )
        for cluster_id in range(k)
    ]

    tracks = []
    for i, row in df.reset_index(drop=True).iterrows():
        tracks.append({
            "id": row["track_id"],
            "title": row["track_name"],
            "artist": row["artist_name"],
            "x": round(float(X_pca[i, 0]), 4),
            "y": round(float(X_pca[i, 1]), 4),
            **{col: round(float(row[col]), 4) for col in clustering.DISPLAY_FEATURE_COLS},
            "kmeans_cluster_id": int(kmeans_labels[i]),
            "gmm_cluster_id": int(gmm_labels[i]),
            "gmm_probabilities": [round(float(p), 4) for p in gmm_probabilities[i]],
        })

    response = ClusterResultsResponse(
        k=k,
        track_count=len(df),
        pca_explained_variance=[round(float(v), 4) for v in pca.explained_variance_ratio_],
        pca_explained_variance_total=round(float(pca.explained_variance_ratio_.sum()), 4),
        kmeans=AlgorithmResult(
            silhouette_score=float(silhouette_score(X_scaled, kmeans_labels)),
            clusters=kmeans_clusters,
        ),
        gmm=AlgorithmResult(
            silhouette_score=float(silhouette_score(X_scaled, gmm_labels)),
            clusters=gmm_clusters,
        ),
        tracks=tracks,
    )
    cache[k] = response
    return response
