# Spotify Taste Clustering + Record Player

Clusters your top Spotify tracks by musical *taste* rather than raw audio
features — Spotify deprecated the `audio-features` endpoint for apps created
after Nov 2024, so this project builds Gemini text embeddings from each
track's lyrics, genre tags, and artist info instead. An orchestrating LLM
agent names and describes each cluster using real tool calls, and a
separate LLM judge scores those descriptions for groundedness, specificity,
and accuracy. The whole pipeline collapses into a single `output.json`,
which a dark, ambient record-player frontend reads with no backend and no
Spotify auth at runtime.

## Architecture

```
Spotify API (/me/top/tracks)
        |
        v
src/tools.py: fetch_lyrics, fetch_genre_tags, fetch_artist_info, search_web
        |
        v
src/build_embeddings.py: Gemini embedding over lyrics+genre+artist context
        |
        v
src/cluster.py: StandardScaler -> KMeans + GMM sweep (k=2..10)
                scored via silhouette (both) + BIC (GMM)
                auto-selects one (model, k) pair
        |
        v
src/agent_describe_clusters.py: orchestrating Gemini agent with tool use
                -> per cluster: name + 2-3 sentence description
        |
        v
src/judge_eval.py: LLM-as-judge scores each description on
                    groundedness / specificity / accuracy (1-5 each)
        |
        v
src/visualize.py: PCA projection + output.json export
                   (-> output/output.json AND frontend/public/output.json)
```

- **Embeddings, not audio features.** Per track: a lyrics snippet (Genius,
  via `lyricsgenius`, graceful fallback to `None` if unavailable), genre
  tags + artist popularity/followers (Spotify `/artists/{id}`, still
  active), concatenated into one text blob and embedded with
  `gemini-embedding-001`. Tracks with no lyrics still get embedded from
  genre + artist info alone — nothing is dropped.
- **KMeans + GMM, dynamic k.** `cluster.py` sweeps k=2..10, scoring KMeans
  by silhouette and GMM by BIC + silhouette, then auto-selects a single
  (model, k) pair — tie-breaking toward GMM when its own BIC- and
  silhouette-optimal k agree, since soft cluster-membership probabilities
  are more informative downstream.
- **Real tool-calling agent.** `agent_describe_clusters.py` hands each
  cluster's track list to Gemini with `fetch_genre_tags`, `fetch_artist_info`,
  and `search_web` (`src/tools.py`) available as real callable tools
  (automatic function calling — schemas are derived from each function's
  type hints/docstring, not a single unstructured prompt). A second,
  tool-free call then asks for a structured `{name, description}` JSON
  response.
- **LLM-as-judge.** `judge_eval.py` scores each generated description 1-5
  on groundedness, specificity, and accuracy against the cluster's actual
  tracks/genres, averages the three, and derives a confidence tier
  (`>=4.0` high, `3.0-3.9` moderate, `<3.0` low).
- **Semantic naming lives entirely in the agent.** Unlike hand-crafted
  audio features, embedding dimensions aren't individually interpretable,
  so `cluster.py` does no centroid-based auto-naming — that's the agent's
  job alone.

## Setup

1. Register a Spotify app at
   [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard),
   redirect URI `http://127.0.0.1:8888/callback` (Spotify requires an
   explicit loopback IP, not `localhost`, since its Apr 2025 policy change).
2. Get a free Gemini API key (no billing required) at
   [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
3. Get a free Genius API token at
   [genius.com/api-clients](https://genius.com/api-clients).
4. Fill in `.env`: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`,
   `GEMINI_API_KEY`, `GENIUS_ACCESS_TOKEN`.
5. `pip install -r requirements.txt`

## Run order

```bash
cd src
python fetch_top_tracks.py          # -> data/my_top_tracks.csv (incl. preview_url)
python build_embeddings.py          # -> data/track_context.csv, data/embeddings.npy
python cluster.py                   # -> data/clustering_results.csv, data/clustering_meta.json
python agent_describe_clusters.py   # -> output/cluster_descriptions.json
python judge_eval.py                # -> output/judge_scores.json
python visualize.py                 # -> output/output.json, frontend/public/output.json
```

Each script can be rerun independently once its inputs exist. The pipeline
is fully rerunnable end-to-end: `visualize.py` writes `output.json` to both
`output/` (the canonical deliverable) and `frontend/public/` directly, so
refreshing the frontend after a rerun needs no manual copy step.

`fetch_top_tracks.py` prints its `preview_url` coverage — Spotify's preview
availability varies (often 20-40% null); if it's unusually low, the record
player will feel sparse, since tracks without a preview are visible in the
list but unplayable.

## Frontend

A dark, ambient record-player UI (Vite + React + Tailwind v4) at
[frontend/](frontend/) — no backend, no Spotify auth, no live API calls.
It reads `frontend/public/output.json` once on load and renders entirely
from that: a spinning vinyl (color and center-label art drawn from the
current track, decelerating to a stop on pause), transport controls,
cluster-filter pills, and a track list. Null-preview tracks are visible but
inert; if every track lacks a preview, the player shows an explanatory
empty state instead of pretending to work.

### Run the app

```bash
nvm use             # Tailwind v4's oxide engine requires Node >= 20; picks up the version in .nvmrc
npm install          # fails fast with a clear error if Node < 20 (enforced via .npmrc engine-strict)
npm run dev          # -> http://localhost:5173
npm run build        # -> dist/
```

`frontend/public/output.json` ships with a small placeholder fixture (fake
tracks, real playable sample audio) so `npm run dev` renders something
immediately — running the real pipeline overwrites it with your actual
clusters.
