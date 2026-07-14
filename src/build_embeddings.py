"""Build a grounded text embedding per track, replacing hand-crafted audio
features entirely (Spotify's `audio-features` endpoint is deprecated for
apps created after Nov 2024 and isn't used anywhere in this project).

Per track: fetch a lyrics snippet (Genius, graceful fallback to None),
genre tags + artist popularity/followers (Spotify `/artists`, still active),
concatenate into one text blob, and embed it with Gemini. Tracks with no
lyrics still get embedded from genre + artist info alone — never dropped.

Writes data/track_context.csv (row-aligned to data/embeddings.npy).
"""
import os
import sys

import numpy as np
import pandas as pd
from dotenv import load_dotenv

import tools

load_dotenv()

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
TOP_TRACKS_PATH = os.path.join(DATA_DIR, "my_top_tracks.csv")
CONTEXT_PATH = os.path.join(DATA_DIR, "track_context.csv")
EMBEDDINGS_PATH = os.path.join(DATA_DIR, "embeddings.npy")

EMBEDDING_MODEL = "gemini-embedding-001"
EMBED_BATCH_SIZE = 50


def first_artist(artist_field: str) -> str:
    return str(artist_field).split(",")[0].strip()


def build_context_blob(track_name, artist_name, genres, artist_info, lyrics) -> str:
    parts = [f"Track: {track_name} by {artist_name}."]
    if genres:
        parts.append(f"Genres: {', '.join(genres)}.")
    if artist_info.get("popularity") is not None:
        parts.append(
            f"Artist popularity: {artist_info['popularity']}/100, "
            f"followers: {artist_info.get('followers') or 'unknown'}."
        )
    if lyrics:
        parts.append(f"Lyrics excerpt: {lyrics}")
    return " ".join(parts)


def gather_track_context(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    lyrics_found = 0
    genres_found = 0

    for i, row in df.iterrows():
        artist = first_artist(row["artist_name"])
        genres = tools.fetch_genre_tags(artist)
        artist_info = tools.fetch_artist_info(artist)
        lyrics = tools.fetch_lyrics(row["track_name"], artist)

        if lyrics:
            lyrics_found += 1
        if genres:
            genres_found += 1

        blob = build_context_blob(row["track_name"], row["artist_name"], genres, artist_info, lyrics)
        rows.append({
            "track_id": row["track_id"],
            "artist_primary": artist,
            "genres": ", ".join(genres),
            "artist_popularity": artist_info.get("popularity"),
            "artist_followers": artist_info.get("followers"),
            "lyrics_snippet": lyrics,
            "context_blob": blob,
        })

        if (i + 1) % 20 == 0 or i == len(df) - 1:
            print(f"  Gathered context for {i + 1}/{len(df)} tracks...")

    print(f"Lyrics found: {lyrics_found}/{len(df)} | Genre tags found: {genres_found}/{len(df)}")
    return pd.DataFrame(rows)


def embed_blobs(blobs: list[str]) -> np.ndarray:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    vectors = []

    for start in range(0, len(blobs), EMBED_BATCH_SIZE):
        batch = blobs[start:start + EMBED_BATCH_SIZE]
        response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=batch,
            config=types.EmbedContentConfig(task_type="CLUSTERING"),
        )
        vectors.extend(embedding.values for embedding in response.embeddings)
        print(f"  Embedded {min(start + EMBED_BATCH_SIZE, len(blobs))}/{len(blobs)} tracks...")

    return np.array(vectors, dtype=np.float32)


def main():
    if not os.getenv("GEMINI_API_KEY"):
        sys.exit(
            "Missing GEMINI_API_KEY in .env. Get a free key (no billing required) "
            "at https://aistudio.google.com/apikey."
        )

    if not os.path.exists(TOP_TRACKS_PATH):
        sys.exit(f"Missing {TOP_TRACKS_PATH}. Run fetch_top_tracks.py first.")

    df = pd.read_csv(TOP_TRACKS_PATH)

    print(f"Gathering lyrics/genre/artist context for {len(df)} tracks...")
    context_df = gather_track_context(df)

    print(f"Embedding {len(context_df)} context blobs via {EMBEDDING_MODEL}...")
    embeddings = embed_blobs(context_df["context_blob"].tolist())

    os.makedirs(DATA_DIR, exist_ok=True)
    context_df.to_csv(CONTEXT_PATH, index=False)
    np.save(EMBEDDINGS_PATH, embeddings)

    print(f"Wrote {len(context_df)} rows to {CONTEXT_PATH}")
    print(f"Wrote embeddings matrix {embeddings.shape} to {EMBEDDINGS_PATH}")


if __name__ == "__main__":
    main()
