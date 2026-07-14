"""LLM-as-judge: scores each agent-generated cluster description on
groundedness, specificity, and accuracy (1-5 each, via a separate Gemini
call per cluster), and derives a confidence tier from the average.

Writes output/judge_scores.json: {cluster_id: {groundedness, specificity,
accuracy, average, confidence_tier, justification}}.
"""
import json
import os
import sys

import pandas as pd
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")
TOP_TRACKS_PATH = os.path.join(DATA_DIR, "my_top_tracks.csv")
CONTEXT_PATH = os.path.join(DATA_DIR, "track_context.csv")
RESULTS_PATH = os.path.join(DATA_DIR, "clustering_results.csv")
META_PATH = os.path.join(DATA_DIR, "clustering_meta.json")
DESCRIPTIONS_PATH = os.path.join(OUTPUT_DIR, "cluster_descriptions.json")
JUDGE_SCORES_PATH = os.path.join(OUTPUT_DIR, "judge_scores.json")

JUDGE_MODEL = "gemini-3.5-flash"


class JudgeScores(BaseModel):
    groundedness: int = Field(ge=1, le=5)
    specificity: int = Field(ge=1, le=5)
    accuracy: int = Field(ge=1, le=5)
    justification: str


def confidence_tier(average: float) -> str:
    if average >= 4.0:
        return "high"
    if average >= 3.0:
        return "moderate"
    return "low"


def load_grounding_data() -> dict[int, str]:
    """Build a grounding blurb per cluster: its tracks + genres, independent
    of the agent's own description, for the judge to check claims against.
    """
    with open(META_PATH) as f:
        meta = json.load(f)
    cluster_col = "kmeans_cluster" if meta["chosen_model"] == "kmeans" else "gmm_cluster"

    results_df = pd.read_csv(RESULTS_PATH)
    top_tracks_df = pd.read_csv(TOP_TRACKS_PATH)
    context_df = pd.read_csv(CONTEXT_PATH)

    merged = results_df.merge(top_tracks_df, on="track_id").merge(
        context_df[["track_id", "genres"]], on="track_id"
    )

    grounding = {}
    for cluster_id, group in merged.groupby(cluster_col):
        lines = [
            f'- "{row.track_name}" by {row.artist_name} (genres: {row.genres or "unknown"})'
            for row in group.itertuples()
        ]
        grounding[int(cluster_id)] = "\n".join(lines)
    return grounding


def judge_cluster(client, cluster_id: int, name: str, description: str, grounding: str) -> JudgeScores:
    prompt = (
        f"You are judging an AI-generated music taste cluster description for "
        f"quality. Score it 1-5 on each dimension:\n"
        "- groundedness: is it supported by the actual tracks/genres below, not hallucinated?\n"
        "- specificity: is it more useful than a generic label (e.g. not just \"varied taste\")?\n"
        "- accuracy: are there any claims contradicted by the data below?\n\n"
        f"Cluster name: {name}\n"
        f"Cluster description: {description}\n\n"
        f"Actual tracks in this cluster:\n{grounding}\n\n"
        "Give a short justification alongside your scores."
    )

    response = client.models.generate_content(
        model=JUDGE_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=JudgeScores,
        ),
    )
    return response.parsed


def main():
    if not os.getenv("GEMINI_API_KEY"):
        sys.exit(
            "Missing GEMINI_API_KEY in .env. Get a free key (no billing required) "
            "at https://aistudio.google.com/apikey."
        )
    if not os.path.exists(DESCRIPTIONS_PATH):
        sys.exit(f"Missing {DESCRIPTIONS_PATH}. Run agent_describe_clusters.py first.")

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    with open(DESCRIPTIONS_PATH) as f:
        descriptions = json.load(f)
    grounding_by_cluster = load_grounding_data()

    judge_scores = {}
    for cluster_id_str, desc in sorted(descriptions.items(), key=lambda kv: int(kv[0])):
        cluster_id = int(cluster_id_str)
        grounding = grounding_by_cluster.get(cluster_id, "")

        scores = judge_cluster(client, cluster_id, desc["name"], desc["description"], grounding)
        average = round((scores.groundedness + scores.specificity + scores.accuracy) / 3, 1)
        tier = confidence_tier(average)

        print(
            f"Cluster {cluster_id} ({desc['name']}): groundedness={scores.groundedness} "
            f"specificity={scores.specificity} accuracy={scores.accuracy} "
            f"average={average} ({tier})"
        )
        print(f"  {scores.justification}")

        judge_scores[cluster_id_str] = {
            "groundedness": scores.groundedness,
            "specificity": scores.specificity,
            "accuracy": scores.accuracy,
            "average": average,
            "confidence_tier": tier,
            "justification": scores.justification,
        }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(JUDGE_SCORES_PATH, "w") as f:
        json.dump(judge_scores, f, indent=2)
    print(f"\nWrote judge scores for {len(judge_scores)} clusters to {JUDGE_SCORES_PATH}")


if __name__ == "__main__":
    main()
