"""Orchestrating agent: for each cluster (grouped under whichever model
cluster.py selected), the agent decides which tools to call — fetch_genre_tags,
fetch_artist_info, search_web (see tools.AGENT_TOOLS) — before writing a name
and description. Real function/tool calling via Gemini's automatic function
calling (schemas are derived from tools.py's type hints/docstrings, not a
single unstructured prompt), followed by a structured final call so the
name/description come back as validated JSON rather than free text to parse.

Writes output/cluster_descriptions.json: {cluster_id: {name, description,
tool_calls_made}}.
"""
import json
import os
import sys

import pandas as pd
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel

import tools

load_dotenv()

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")
TOP_TRACKS_PATH = os.path.join(DATA_DIR, "my_top_tracks.csv")
RESULTS_PATH = os.path.join(DATA_DIR, "clustering_results.csv")
META_PATH = os.path.join(DATA_DIR, "clustering_meta.json")
DESCRIPTIONS_PATH = os.path.join(OUTPUT_DIR, "cluster_descriptions.json")

AGENT_MODEL = "gemini-3.5-flash"


class ClusterDescription(BaseModel):
    name: str
    description: str


def load_clusters() -> dict[int, list[dict]]:
    if not os.path.exists(META_PATH) or not os.path.exists(RESULTS_PATH):
        sys.exit("Missing clustering_meta.json or clustering_results.csv. Run cluster.py first.")

    with open(META_PATH) as f:
        meta = json.load(f)
    cluster_col = "kmeans_cluster" if meta["chosen_model"] == "kmeans" else "gmm_cluster"

    results_df = pd.read_csv(RESULTS_PATH)
    top_tracks_df = pd.read_csv(TOP_TRACKS_PATH)
    merged = results_df.merge(top_tracks_df, on="track_id")

    return {
        int(cluster_id): group[["track_name", "artist_name"]].to_dict("records")
        for cluster_id, group in merged.groupby(cluster_col)
    }


def format_track_list(tracks: list[dict]) -> str:
    return "\n".join(f'- "{t["track_name"]}" by {t["artist_name"]}' for t in tracks)


def research_cluster(client, cluster_id: int, tracks: list[dict]) -> tuple[str, list[dict]]:
    prompt = (
        "You're researching one taste cluster from a listener's top Spotify "
        f"tracks, as part of an unsupervised clustering pipeline. Here is "
        f"cluster {cluster_id}'s full track list ({len(tracks)} tracks):\n\n"
        f"{format_track_list(tracks)}\n\n"
        "Use the available tools to look up genre tags and artist info for a "
        "representative sample of these artists (you don't need every single "
        "one), and optionally do a web search if it would help place this "
        "group in a known genre, scene, or era. Then write a short research "
        "summary (a few sentences) of what actually ties this group together "
        "musically — be specific, and only claim things the data supports."
    )

    response = client.models.generate_content(
        model=AGENT_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(tools=tools.AGENT_TOOLS),
    )

    tool_calls_made = []
    for content in response.automatic_function_calling_history or []:
        for part in content.parts or []:
            if part.function_call:
                tool_calls_made.append({
                    "tool": part.function_call.name,
                    "args": dict(part.function_call.args or {}),
                })

    return response.text or "", tool_calls_made


def finalize_description(client, cluster_id: int, tracks: list[dict], research_summary: str) -> ClusterDescription:
    prompt = (
        f"Track list for cluster {cluster_id}:\n{format_track_list(tracks)}\n\n"
        f"Research summary:\n{research_summary}\n\n"
        "Write a short, evocative cluster name (2-5 words — a mood or scene, "
        "not a bare genre label) and a 2-3 sentence description grounded in "
        "the research summary and track list above. Make no claims that "
        "aren't supported by what's above."
    )

    response = client.models.generate_content(
        model=AGENT_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ClusterDescription,
        ),
    )
    return response.parsed


def main():
    if not os.getenv("GEMINI_API_KEY"):
        sys.exit(
            "Missing GEMINI_API_KEY in .env. Get a free key (no billing required) "
            "at https://aistudio.google.com/apikey."
        )

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    clusters = load_clusters()

    descriptions = {}
    for cluster_id, cluster_tracks in sorted(clusters.items()):
        print(f"Researching cluster {cluster_id} ({len(cluster_tracks)} tracks)...")
        research_summary, tool_calls_made = research_cluster(client, cluster_id, cluster_tracks)
        print(f"  Tool calls made: {[c['tool'] for c in tool_calls_made]}")

        parsed = finalize_description(client, cluster_id, cluster_tracks, research_summary)
        print(f"  -> {parsed.name}: {parsed.description}")

        descriptions[str(cluster_id)] = {
            "name": parsed.name,
            "description": parsed.description,
            "tool_calls_made": tool_calls_made,
        }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(DESCRIPTIONS_PATH, "w") as f:
        json.dump(descriptions, f, indent=2)
    print(f"\nWrote {len(descriptions)} cluster descriptions to {DESCRIPTIONS_PATH}")


if __name__ == "__main__":
    main()
