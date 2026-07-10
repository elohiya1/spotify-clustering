"""Pydantic response models for api_server.py's JSON contracts."""
from pydantic import BaseModel


class SweepPoint(BaseModel):
    k: int
    silhouette_score: float


class SweepResponse(BaseModel):
    k_values: list[int]
    results: list[SweepPoint]
    best_k: int


class ClusterOut(BaseModel):
    id: int
    name: str
    color: str
    count: int
    energy: float
    danceability: float
    acousticness: float
    valence: float
    speechiness: float
    instrumentalness: float
    artists: list[str]
    description: str


class AlgorithmResult(BaseModel):
    silhouette_score: float
    clusters: list[ClusterOut]


class TrackOut(BaseModel):
    id: str
    title: str
    artist: str
    x: float
    y: float
    energy: float
    danceability: float
    acousticness: float
    valence: float
    speechiness: float
    instrumentalness: float
    kmeans_cluster_id: int
    gmm_cluster_id: int
    gmm_probabilities: list[float]


class ClusterResultsResponse(BaseModel):
    k: int
    track_count: int
    pca_explained_variance: list[float]
    pca_explained_variance_total: float
    kmeans: AlgorithmResult
    gmm: AlgorithmResult
    tracks: list[TrackOut]
