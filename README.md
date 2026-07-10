# Spotify Taste Clustering

Clusters your top Spotify tracks using K-means and Gaussian Mixture Models
on audio features (sourced from a static Kaggle dataset, with a ReccoBeats
fallback for unmatched tracks — Spotify deprecated the `audio-features`
endpoint for apps created after Nov 2024), with PCA for the 2D scatter plot.

## Architecture

A personal project at the intersection of music and machine learning,
using unsupervised learning to reveal patterns in a listener's own taste
rather than just eyeballing playlists.

Pipeline details:

- **Feature source:** Spotify's `top tracks` endpoint (used in
  `fetch_top_tracks.py`) gives track identity — name, artist, album,
  popularity — but not audio features (acousticness, danceability, energy,
  etc.), since Spotify deprecated `GET /audio-features` for apps created
  after Nov 2024. A static Kaggle dataset of pre-collected audio features
  is the primary feature source instead, matched to each top track via
  fuzzy title/artist matching (`match_features.py`, `rapidfuzz.fuzz.WRatio`,
  threshold 90).
- **ReccoBeats fallback:** the Kaggle dataset is a frozen 2022 snapshot, so
  it systematically misses newer releases. For tracks the Kaggle fuzzy
  match can't find, `match_features.py` falls back to ReccoBeats, a
  third-party API that still exposes Spotify-style audio features, on a
  best-effort basis. Tracks that miss both sources are dropped rather than
  imputed, so clustering stays grounded in real feature values instead of
  guesses.
- **K-means, GMM, and PCA:** both K-means and a Gaussian Mixture Model
  cluster tracks in the full 11-dimension scaled feature space; PCA is a
  separate 2-component projection computed only so the scatter plot has
  something to plot on. K-means gives hard cluster assignments; GMM gives
  a full probability distribution over clusters per track, which the
  dashboard surfaces as a confidence bar per track. Cluster membership
  comes from these models alone — see "Cluster interpretations" below for
  how that affects reading the plot.
- **Choosing k:** rather than eyeballing a cluster count, `cluster.py` (and
  the API server) sweep k=2..8, score each with silhouette score, and pick
  the best one automatically — while still letting you override it (via
  `--k` on the CLI, or the slider on the dashboard).

## Setup

1. Register an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard),
   set the redirect URI to `http://127.0.0.1:8888/callback` (Spotify no longer
   allows `localhost` as of its Apr 2025 redirect URI policy — must be an
   explicit loopback IP).
2. Fill in `.env` with `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`.
3. `pip install -r requirements.txt`
4. Download a Spotify audio-features dataset from Kaggle and save it as
   `data/kaggle_audio_features.csv` (needs columns for track name, artist,
   and the standard audio features: acousticness, danceability, energy,
   instrumentalness, liveness, loudness, speechiness, tempo, valence, key, mode).

## Run order

```bash
cd src
python fetch_top_tracks.py      # -> data/my_top_tracks.csv
python match_features.py        # -> data/merged_features.csv
python cluster.py               # sweeps k=2..8, picks best k, -> data/clustered_tracks.csv
python visualize.py             # -> output/cluster_scatter.html, output/cluster_features.html
```

Each script can be run independently once its inputs exist, which is
useful for debugging a single step. `cluster.py` also accepts `--k N` to
skip the sweep and force a specific cluster count.

## Frontend

A React dashboard (built in Replit, wired up here) at [frontend/](frontend/)
visualizes the clusters — sonic profile radar charts, a feature scatter
map, a silhouette-score k-slider, and a searchable track browser with
K-means vs GMM shown side by side. It fetches live from a small FastAPI
backend (`src/api_server.py`) that runs the clustering on demand, so both
the backend and frontend dev servers need to be running.

### Run the app

```bash
# terminal 1 — backend
cd src
uvicorn api_server:app --reload --port 8000   # -> http://localhost:8000, docs at /docs

# terminal 2 — frontend
nvm use             # Tailwind v4's oxide engine requires Node >= 20; picks up the version in .nvmrc
npm install          # fails fast with a clear error if Node < 20 (enforced via .npmrc engine-strict)
npm run dev          # -> http://localhost:5173
npm run build        # -> dist/
```

If you don't have Node 20+ installed via `nvm`, run `nvm install` first to fetch the version
pinned in `.nvmrc`.

## Match rate

Out of 214 unique top tracks pulled from Spotify:
- Kaggle fuzzy match: 42/214 (19.6%) — the Kaggle dataset is from 2022, so it
  missed most recent releases.
- ReccoBeats fallback recovered another 123/172 unmatched tracks.
- **Final coverage: 165/214 (77.1%)**, 49 tracks dropped for having no
  features from either source.

## Cluster interpretations

Clustering happens in the full 11-dimension scaled feature space; PCA is
used only for the 2D scatter plot (it explains ~36% of variance in 2
components on this dataset, so treat cluster membership — not plot
distance — as ground truth).

Cluster names and descriptions are no longer hand-written, since both `k`
and the algorithm (K-means vs GMM) now vary at runtime. Instead,
`src/clustering.py`'s `describe_cluster()` auto-generates them from each
cluster's centroid: because the feature matrix is standardized (mean 0,
std 1), a centroid's value on a given feature *is* that cluster's z-score
on that feature relative to the full library. The two features with the
largest `|z|` become the cluster's name (e.g. "Mellow · Acoustic"), and a
one-sentence description cites the actual z-scores (e.g. "Standout
acousticness (z=+1.8) and below-average energy (z=-1.2) relative to the
full library"). This generalizes to any k and to GMM's cluster means
(`gmm.means_`), so there's nothing left to keep in manual sync — run
`python src/cluster.py` or start the API server to see the current run's
actual clusters.
