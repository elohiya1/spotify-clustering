// Fetch layer for the live FastAPI backend (src/api_server.py).
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export interface SweepPoint {
  k: number;
  silhouette_score: number;
}

export interface SweepResponse {
  k_values: number[];
  results: SweepPoint[];
  best_k: number;
}

export interface Cluster {
  id: number;
  name: string;
  color: string;
  count: number;
  energy: number;
  danceability: number;
  acousticness: number;
  valence: number;
  speechiness: number;
  instrumentalness: number;
  artists: string[];
  description: string;
}

interface AlgorithmResult {
  silhouette_score: number;
  clusters: Cluster[];
}

export interface TrackOut {
  id: string;
  title: string;
  artist: string;
  x: number;
  y: number;
  energy: number;
  danceability: number;
  acousticness: number;
  valence: number;
  speechiness: number;
  instrumentalness: number;
  kmeans_cluster_id: number;
  gmm_cluster_id: number;
  gmm_probabilities: number[];
}

export interface ClusterResultsResponse {
  k: number;
  track_count: number;
  pca_explained_variance: number[];
  pca_explained_variance_total: number;
  kmeans: AlgorithmResult;
  gmm: AlgorithmResult;
  tracks: TrackOut[];
}

// Shape the existing chart components (ClusterMap, ClusterProfiles) expect.
export interface Track {
  id: string;
  title: string;
  artist: string;
  clusterId: number;
  x: number;
  y: number;
  energy: number;
  danceability: number;
  acousticness: number;
  valence: number;
  speechiness: number;
  instrumentalness: number;
}

// Track shape for the merged track browser (both algorithms at once).
export interface MergedTrack extends Track {
  gmmClusterId: number;
  gmmProbabilities: number[];
}

export async function fetchSweep(): Promise<SweepResponse> {
  const res = await fetch(`${API_BASE}/api/sweep`);
  if (!res.ok) throw new Error(`Failed to fetch sweep: ${res.status}`);
  return res.json();
}

export async function fetchClusterResults(k: number): Promise<ClusterResultsResponse> {
  const res = await fetch(`${API_BASE}/api/cluster-results?k=${k}`);
  if (!res.ok) throw new Error(`Failed to fetch cluster results: ${res.status}`);
  return res.json();
}

export function toAlgorithmView(
  response: ClusterResultsResponse,
  algorithm: 'kmeans' | 'gmm'
): { clusters: Cluster[]; tracks: Track[] } {
  const clusters = response[algorithm].clusters;
  const tracks = response.tracks.map(t => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    clusterId: algorithm === 'kmeans' ? t.kmeans_cluster_id : t.gmm_cluster_id,
    x: t.x,
    y: t.y,
    energy: t.energy,
    danceability: t.danceability,
    acousticness: t.acousticness,
    valence: t.valence,
    speechiness: t.speechiness,
    instrumentalness: t.instrumentalness,
  }));
  return { clusters, tracks };
}

export function toMergedTracks(response: ClusterResultsResponse): MergedTrack[] {
  return response.tracks.map(t => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    clusterId: t.kmeans_cluster_id,
    gmmClusterId: t.gmm_cluster_id,
    gmmProbabilities: t.gmm_probabilities,
    x: t.x,
    y: t.y,
    energy: t.energy,
    danceability: t.danceability,
    acousticness: t.acousticness,
    valence: t.valence,
    speechiness: t.speechiness,
    instrumentalness: t.instrumentalness,
  }));
}
