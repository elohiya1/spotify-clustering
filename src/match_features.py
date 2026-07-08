"""Fuzzy-match top tracks against a Kaggle audio-features dataset, with a
ReccoBeats best-effort fallback for anything unmatched. Writes
data/merged_features.csv.
"""
import os
import re
import sys

import pandas as pd
import requests
from rapidfuzz import fuzz, process

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
TOP_TRACKS_PATH = os.path.join(DATA_DIR, "my_top_tracks.csv")
KAGGLE_PATH = os.path.join(DATA_DIR, "kaggle_audio_features.csv")
OUTPUT_PATH = os.path.join(DATA_DIR, "merged_features.csv")

MATCH_THRESHOLD = 90
RECCOBEATS_BASE = "https://api.reccobeats.com/v1"

FEATURE_COLS = [
    "acousticness", "danceability", "energy", "instrumentalness",
    "liveness", "loudness", "speechiness", "tempo", "valence",
    "key", "mode",
]

# Kaggle datasets vary in column naming; map common variants to our schema.
KAGGLE_TRACK_COL_CANDIDATES = ["track_name", "name", "song"]
KAGGLE_ARTIST_COL_CANDIDATES = ["artists", "artist_name", "artist"]


def normalize(text):
    text = str(text).lower()
    text = re.sub(r"\(feat\.?.*?\)|\[feat\.?.*?\]|feat\..*", "", text)
    text = re.sub(r"\(.*?remaster.*?\)", "", text)
    text = re.sub(r"[^a-z0-9\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def pick_col(df, candidates, required_name):
    for c in candidates:
        if c in df.columns:
            return c
    sys.exit(f"Could not find a {required_name} column in Kaggle dataset. Columns: {list(df.columns)}")


def load_kaggle_dataset():
    if not os.path.exists(KAGGLE_PATH):
        sys.exit(
            f"Missing {KAGGLE_PATH}. Download a Spotify audio-features dataset "
            "from Kaggle and place it there."
        )
    df = pd.read_csv(KAGGLE_PATH)
    track_col = pick_col(df, KAGGLE_TRACK_COL_CANDIDATES, "track name")
    artist_col = pick_col(df, KAGGLE_ARTIST_COL_CANDIDATES, "artist")

    missing_features = [c for c in FEATURE_COLS if c not in df.columns]
    if missing_features:
        sys.exit(f"Kaggle dataset is missing expected feature columns: {missing_features}")

    df["_match_key"] = (df[track_col].astype(str) + " " + df[artist_col].astype(str)).map(normalize)
    df = df.drop_duplicates(subset="_match_key", keep="first").reset_index(drop=True)
    return df, track_col, artist_col


def fuzzy_match(top_tracks_df, kaggle_df):
    choices = kaggle_df["_match_key"].tolist()
    matched_rows = []
    unmatched = []

    for _, row in top_tracks_df.iterrows():
        query = normalize(f"{row['track_name']} {row['artist_name']}")
        result = process.extractOne(query, choices, scorer=fuzz.WRatio)

        if result and result[1] >= MATCH_THRESHOLD:
            match_idx = result[2]
            kaggle_row = kaggle_df.iloc[match_idx]
            merged = row.to_dict()
            for col in FEATURE_COLS:
                merged[col] = kaggle_row[col]
            merged["match_source"] = "kaggle"
            merged["match_score"] = result[1]
            matched_rows.append(merged)
        else:
            unmatched.append(row)

    return matched_rows, unmatched


def reccobeats_lookup(track_id):
    """Best-effort fallback via ReccoBeats. Returns a feature dict or None."""
    try:
        resp = requests.get(
            f"{RECCOBEATS_BASE}/audio-features",
            params={"ids": track_id},
            timeout=5,
        )
        if resp.status_code != 200:
            return None
        payload = resp.json()
        items = payload.get("content") or payload.get("data") or []
        if not items:
            return None
        item = items[0]
        return {col: item.get(col) for col in FEATURE_COLS if col in item}
    except Exception:
        return None


def try_reccobeats(unmatched_rows):
    recovered = []
    still_unmatched = []

    for row in unmatched_rows:
        features = reccobeats_lookup(row["track_id"])
        if features and all(k in features for k in FEATURE_COLS):
            merged = row.to_dict()
            merged.update(features)
            merged["match_source"] = "reccobeats"
            merged["match_score"] = None
            recovered.append(merged)
        else:
            still_unmatched.append(row)

    return recovered, still_unmatched


def main():
    if not os.path.exists(TOP_TRACKS_PATH):
        sys.exit(f"Missing {TOP_TRACKS_PATH}. Run fetch_top_tracks.py first.")

    top_tracks_df = pd.read_csv(TOP_TRACKS_PATH)
    kaggle_df, _, _ = load_kaggle_dataset()

    matched_rows, unmatched = fuzzy_match(top_tracks_df, kaggle_df)
    print(f"Kaggle fuzzy match: {len(matched_rows)}/{len(top_tracks_df)} tracks matched (threshold={MATCH_THRESHOLD})")

    if unmatched:
        print(f"Attempting ReccoBeats fallback for {len(unmatched)} unmatched tracks (best-effort)...")
        recovered, still_unmatched = try_reccobeats(unmatched)
        print(f"ReccoBeats recovered {len(recovered)}/{len(unmatched)}")
        matched_rows.extend(recovered)
        unmatched = still_unmatched

    total = len(top_tracks_df)
    matched_count = len(matched_rows)
    coverage = matched_count / total * 100 if total else 0

    if unmatched:
        print(f"Dropping {len(unmatched)} tracks with no features found.")

    print(f"Final coverage: {matched_count}/{total} ({coverage:.1f}%)")
    if coverage < 85:
        print("Warning: coverage is below 85% — clustering will run on a partial sample.")

    if not matched_rows:
        sys.exit("No tracks matched — cannot proceed. Check Kaggle dataset coverage or matching threshold.")

    merged_df = pd.DataFrame(matched_rows)
    os.makedirs(DATA_DIR, exist_ok=True)
    merged_df.to_csv(OUTPUT_PATH, index=False)
    print(f"Wrote {len(merged_df)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
