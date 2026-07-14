import React from 'react';
import type { Cluster } from '@/lib/data';

interface ClusterInfoPanelProps {
  cluster: Cluster | null;
}

const TIER_GLYPH: Record<string, string> = { high: '✦', moderate: '◦', low: '·' };
const TIER_LABEL: Record<string, string> = {
  high: 'high confidence',
  moderate: 'moderate confidence',
  low: 'low confidence',
};

export function ClusterInfoPanel({ cluster }: ClusterInfoPanelProps) {
  return (
    <div className={`overflow-hidden transition-all duration-300 ease-out ${cluster ? 'max-h-60 opacity-100 mb-4' : 'max-h-0 opacity-0'}`}>
      {cluster && (
        <div
          className="border rounded-lg p-5"
          style={{ borderColor: `${cluster.color_swatch}40`, backgroundColor: `${cluster.color_swatch}12` }}
        >
          <h3 className="font-display font-bold text-lg tracking-tight" style={{ color: cluster.color_swatch }}>
            {cluster.cluster_name}
          </h3>
          <p className="font-serif italic text-sm text-foreground/80 mt-2 leading-relaxed">
            {cluster.cluster_description}
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {TIER_GLYPH[cluster.judge_scores.confidence_tier]} {TIER_LABEL[cluster.judge_scores.confidence_tier]}
          </p>
        </div>
      )}
    </div>
  );
}
