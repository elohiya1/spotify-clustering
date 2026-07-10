"""Shared clustering engine: scaling, PCA, KMeans/GMM fitting, silhouette
sweep, and automatic cluster naming. Used by both cluster.py (CLI) and
api_server.py (FastAPI) so the math lives in exactly one place.
"""
import os
from collections import Counter

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import StandardScaler

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
MERGED_PATH = os.path.join(DATA_DIR, "merged_features.csv")

FEATURE_COLS = [
    "acousticness", "danceability", "energy", "instrumentalness",
    "liveness", "loudness", "speechiness", "tempo", "valence",
    "key", "mode",
]

# Subset shown on the dashboard's radar chart / feature bars.
DISPLAY_FEATURE_COLS = [
    "energy", "danceability", "acousticness", "valence", "speechiness", "instrumentalness",
]

# Fixed color per cluster id, indexed directly (k maxes out at 8). First 4
# match the project's original hand-picked k=4 palette.
PALETTE = [
    "#4ADE80",  # green
    "#F97316",  # orange
    "#A855F7",  # purple
    "#38BDF8",  # sky blue
    "#FB7185",  # rose
    "#FBBF24",  # amber
    "#2DD4BF",  # teal
    "#818CF8",  # indigo
]

# High/low adjective per feature, used for auto-naming clusters from
# centroid z-scores. "key" is excluded — it's a categorical pitch class,
# not a meaningful high/low axis.
FEATURE_ADJECTIVES = {
    "acousticness": {"high": "Acoustic", "low": "Amplified"},
    "danceability": {"high": "Danceable", "low": "Static"},
    "energy": {"high": "High-Energy", "low": "Mellow"},
    "instrumentalness": {"high": "Instrumental", "low": "Vocal-Driven"},
    "liveness": {"high": "Live", "low": "Studio"},
    "loudness": {"high": "Loud", "low": "Quiet"},
    "speechiness": {"high": "Spoken-Word", "low": "Melodic"},
    "tempo": {"high": "Fast-Tempo", "low": "Slow-Tempo"},
    "valence": {"high": "Upbeat", "low": "Somber"},
    "mode": {"high": "Major-Key", "low": "Minor-Key"},
}

NAMEABLE_FEATURES = [c for c in FEATURE_COLS if c in FEATURE_ADJECTIVES]


def load_merged_features(path=MERGED_PATH):
    if not os.path.exists(path):
        raise SystemExit(f"Missing {path}. Run match_features.py first.")
    df = pd.read_csv(path)
    before = len(df)
    df = df.dropna(subset=FEATURE_COLS).reset_index(drop=True)
    dropped = before - len(df)
    if dropped:
        print(f"Dropped {dropped} rows with missing feature values.")
    return df


def prepare_feature_matrix(df):
    X = df[FEATURE_COLS].to_numpy(dtype=float)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    return X_scaled, scaler


def compute_pca(X_scaled, n_components=2):
    pca = PCA(n_components=n_components)
    X_pca = pca.fit_transform(X_scaled)
    return X_pca, pca


def silhouette_sweep(X_scaled, k_min=2, k_max=8):
    results = []
    for k in range(k_min, k_max + 1):
        labels = fit_kmeans(X_scaled, k)[0]
        score = silhouette_score(X_scaled, labels)
        results.append({"k": k, "silhouette_score": float(score)})
    return results


def fit_kmeans(X_scaled, k, random_state=42):
    kmeans = KMeans(n_clusters=k, n_init=10, random_state=random_state)
    labels = kmeans.fit_predict(X_scaled)
    return labels, kmeans


def fit_gmm(X_scaled, k, random_state=42):
    gmm = GaussianMixture(n_components=k, random_state=random_state)
    gmm.fit(X_scaled)
    probabilities = gmm.predict_proba(X_scaled)
    labels = probabilities.argmax(axis=1)
    return labels, probabilities, gmm


def describe_cluster(centroid_scaled_vector, feature_cols=FEATURE_COLS, top_n=2):
    """Auto-name a cluster from its centroid's z-scores (X_scaled is
    mean-0/std-1, so the centroid's value on each feature *is* its z-score
    relative to the full library).
    """
    z_by_feature = dict(zip(feature_cols, centroid_scaled_vector))
    nameable = [(f, z_by_feature[f]) for f in NAMEABLE_FEATURES]
    ranked = sorted(nameable, key=lambda pair: abs(pair[1]), reverse=True)[:top_n]

    adjectives = []
    clauses = []
    for feature, z in ranked:
        direction = "high" if z >= 0 else "low"
        adjectives.append(FEATURE_ADJECTIVES[feature][direction])
        comparison = "Standout" if z >= 0 else "Below-average"
        clauses.append(f"{comparison} {feature} (z={z:+.1f})")

    name = " · ".join(adjectives)
    description = " and ".join(clauses) + " relative to the full library."
    return name, description


def first_artist(artist_field):
    return str(artist_field).split(",")[0].strip()


def top_artists(df_slice, n=3):
    counts = Counter(df_slice["artist_name"].map(first_artist))
    return [artist for artist, _ in counts.most_common(n)]


def build_cluster_summary(cluster_id, df_slice, centroid_scaled):
    name, description = describe_cluster(centroid_scaled)
    return {
        "id": int(cluster_id),
        "name": name,
        "color": PALETTE[cluster_id % len(PALETTE)],
        "count": int(len(df_slice)),
        **{col: round(float(df_slice[col].mean()), 3) for col in DISPLAY_FEATURE_COLS},
        "artists": top_artists(df_slice),
        "description": description,
    }
