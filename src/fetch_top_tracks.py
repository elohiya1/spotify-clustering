"""Pull top tracks across all time ranges, dedupe, write data/my_top_tracks.csv."""
import os

import pandas as pd

from auth import get_spotify_client

TIME_RANGES = ["short_term", "medium_term", "long_term"]
LIMIT = 50  # per Spotify API max per request
PAGES_PER_RANGE = 2  # 2 * 50 = 100 tracks per range (before dedupe)

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "my_top_tracks.csv")


def fetch_top_tracks(sp):
    tracks_by_id = {}

    for time_range in TIME_RANGES:
        for page in range(PAGES_PER_RANGE):
            try:
                results = sp.current_user_top_tracks(
                    limit=LIMIT, offset=page * LIMIT, time_range=time_range
                )
            except Exception as e:
                print(f"Warning: failed to fetch top tracks ({time_range}, page {page}): {e}")
                continue

            items = results.get("items", [])
            if not items:
                break

            for track in items:
                track_id = track["id"]
                if track_id in tracks_by_id:
                    continue
                tracks_by_id[track_id] = {
                    "track_id": track_id,
                    "track_name": track["name"],
                    "artist_name": ", ".join(a["name"] for a in track["artists"]),
                    "album": track["album"]["name"],
                    "popularity": track.get("popularity"),
                }

    return list(tracks_by_id.values())


def main():
    sp = get_spotify_client()
    tracks = fetch_top_tracks(sp)

    if not tracks:
        print("No tracks fetched — check auth scope and account activity.")
        return

    df = pd.DataFrame(tracks)
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Wrote {len(df)} unique tracks to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
