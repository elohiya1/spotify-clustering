// Types mirror output/output.json exactly (see PRD §5.6). The frontend has
// no backend at runtime — this is the only artifact it reads.
import { useEffect, useState } from 'react';

export interface Track {
  track_id: string;
  track_uri: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  album_art_url: string | null;
  preview_url: string | null;
  cluster_id: number;
  popularity: number | null;
  pca_x: number;
  pca_y: number;
  gmm_probabilities: number[];
}

export type ConfidenceTier = 'high' | 'moderate' | 'low';

export interface JudgeScores {
  groundedness: number;
  specificity: number;
  accuracy: number;
  average: number;
  confidence_tier: ConfidenceTier;
}

export interface Cluster {
  cluster_id: number;
  cluster_name: string;
  cluster_description: string;
  color_swatch: string;
  judge_scores: JudgeScores;
}

export interface Meta {
  generated_at: string;
  total_tracks: number;
  tracks_with_preview: number;
  chosen_model: 'kmeans' | 'gmm';
  chosen_k: number;
  silhouette_score: number;
}

export interface OutputData {
  tracks: Track[];
  clusters: Cluster[];
  meta: Meta;
}

export function clusterById(data: OutputData, clusterId: number): Cluster | undefined {
  return data.clusters.find(c => c.cluster_id === clusterId);
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: OutputData };

export function useOutputData(): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetch('/output.json')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load output.json: ${res.status}`);
        return res.json();
      })
      .then((data: OutputData) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ status: 'error', error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
