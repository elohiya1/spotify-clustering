"""Grounding tools shared by build_embeddings.py (called directly, per track)
and agent_describe_clusters.py (called by the Gemini agent via automatic
function calling — see AGENT_TOOLS below). Every function degrades to a
harmless empty/None result on any failure rather than raising, since a
missing lyric or a flaky web search should never take down a pipeline run.
"""
import os
import re

import requests
from dotenv import load_dotenv
from rapidfuzz import fuzz

load_dotenv()

GENIUS_ACCESS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
LYRICS_MATCH_THRESHOLD = 85

_sp_client = None
_genius_client = None
_artist_search_cache: dict[str, dict | None] = {}


def _get_spotify_client():
    global _sp_client
    if _sp_client is None:
        from auth import get_spotify_client
        _sp_client = get_spotify_client()
    return _sp_client


def _get_genius_client():
    global _genius_client
    if _genius_client is None and GENIUS_ACCESS_TOKEN:
        import lyricsgenius
        _genius_client = lyricsgenius.Genius(
            GENIUS_ACCESS_TOKEN,
            verbose=False,
            remove_section_headers=True,
            skip_non_songs=True,
            timeout=8,
        )
    return _genius_client


def _find_artist(artist_name: str) -> dict | None:
    """Resolve an artist name to a Spotify artist object (id, genres,
    popularity, followers), cached since the same artist often recurs
    across many top tracks.
    """
    if artist_name in _artist_search_cache:
        return _artist_search_cache[artist_name]

    artist = None
    try:
        sp = _get_spotify_client()
        results = sp.search(q=f"artist:{artist_name}", type="artist", limit=1)
        items = results.get("artists", {}).get("items", [])
        if items:
            artist = items[0]
    except Exception:
        artist = None

    _artist_search_cache[artist_name] = artist
    return artist


def fetch_lyrics(track_name: str, artist_name: str) -> str | None:
    """Fetch a short lyric snippet for a track from Genius.

    Args:
        track_name: The track's title.
        artist_name: The track's primary artist.

    Returns:
        The first ~400 characters of the song's lyrics, or None if Genius
        has no confident match (or GENIUS_ACCESS_TOKEN isn't configured).
    """
    genius = _get_genius_client()
    if genius is None:
        return None

    try:
        song = genius.search_song(track_name, artist_name)
        if song is None:
            return None

        candidate = f"{song.title} {song.artist}"
        query = f"{track_name} {artist_name}"
        if fuzz.WRatio(candidate, query) < LYRICS_MATCH_THRESHOLD:
            return None

        snippet = re.sub(r"\s+", " ", song.lyrics or "").strip()
        return snippet[:400] or None
    except Exception:
        return None


def fetch_genre_tags(artist_name: str) -> list[str]:
    """Fetch the genre tags Spotify has associated with an artist.

    Args:
        artist_name: The artist's display name.

    Returns:
        A list of genre tag strings (e.g. ["indie pop", "bedroom pop"]),
        or an empty list if the artist can't be resolved.
    """
    artist = _find_artist(artist_name)
    if artist is None:
        return []
    return artist.get("genres", [])


def fetch_artist_info(artist_name: str) -> dict:
    """Fetch an artist's Spotify popularity score and follower count.

    Args:
        artist_name: The artist's display name.

    Returns:
        {"popularity": int, "followers": int}, with both fields None if the
        artist can't be resolved.
    """
    artist = _find_artist(artist_name)
    if artist is None:
        return {"popularity": None, "followers": None}
    return {
        "popularity": artist.get("popularity"),
        "followers": artist.get("followers", {}).get("total"),
    }


def search_web(query: str) -> list[str]:
    """Search the public web and return a few short result snippets.

    Uses DuckDuckGo's key-free HTML endpoint. Intended as a lightweight
    supplementary signal (e.g. "is this artist part of a known music
    scene/movement?") — not a primary grounding source.

    Args:
        query: The search query.

    Returns:
        Up to 3 short result snippets, or an empty list if the search
        fails or returns nothing.
    """
    try:
        resp = requests.post(
            "https://html.duckduckgo.com/html/",
            data={"q": query},
            headers={"User-Agent": "Mozilla/5.0 (compatible; spotify-clustering/1.0)"},
            timeout=6,
        )
        resp.raise_for_status()
        raw_snippets = re.findall(
            r'class="result__snippet"[^>]*>(.*?)</a>', resp.text, re.S
        )
        snippets = [re.sub(r"<.*?>", "", s).strip() for s in raw_snippets[:3]]
        return [s for s in snippets if s]
    except Exception:
        return []


# Tools the orchestrating agent may call per cluster (PRD §5.4) — deliberately
# excludes fetch_lyrics, which build_embeddings.py calls directly per track.
AGENT_TOOLS = [fetch_genre_tags, fetch_artist_info, search_web]
