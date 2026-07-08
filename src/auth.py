"""Spotify OAuth (Authorization Code flow) — needed for /me/top/tracks."""
import os
import sys

from dotenv import load_dotenv
import spotipy
from spotipy.oauth2 import SpotifyOAuth

SCOPE = "user-top-read"


def get_spotify_client():
    load_dotenv()

    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    redirect_uri = os.getenv("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8888/callback")

    if not client_id or not client_secret:
        sys.exit(
            "Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env. "
            "Get these from developer.spotify.com/dashboard."
        )

    try:
        auth_manager = SpotifyOAuth(
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
            scope=SCOPE,
            cache_path=".cache",
        )
        return spotipy.Spotify(auth_manager=auth_manager)
    except Exception as e:
        sys.exit(f"Spotify auth failed: {e}")


if __name__ == "__main__":
    sp = get_spotify_client()
    me = sp.current_user()
    print(f"Authenticated as: {me['display_name']} ({me['id']})")
