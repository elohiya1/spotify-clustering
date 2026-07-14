import React from 'react';
import type { Cluster } from '@/lib/data';

interface ClusterPillsProps {
  clusters: Cluster[];
  activeClusterId: number | null;
  onSelect: (clusterId: number | null) => void;
}

export function ClusterPills({ clusters, activeClusterId, onSelect }: ClusterPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className="px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-widest border transition-colors"
        style={
          activeClusterId === null
            ? { backgroundColor: '#F0EDE8', borderColor: '#F0EDE8', color: '#0A0A0A' }
            : { backgroundColor: 'transparent', borderColor: '#6B6560', color: '#6B6560' }
        }
      >
        All
      </button>
      {clusters.map(cluster => {
        const active = activeClusterId === cluster.cluster_id;
        return (
          <button
            key={cluster.cluster_id}
            onClick={() => onSelect(active ? null : cluster.cluster_id)}
            className="px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-widest border transition-colors"
            style={
              active
                ? { backgroundColor: cluster.color_swatch, borderColor: cluster.color_swatch, color: '#0A0A0A' }
                : { backgroundColor: 'transparent', borderColor: `${cluster.color_swatch}55`, color: cluster.color_swatch }
            }
          >
            {cluster.cluster_name}
          </button>
        );
      })}
    </div>
  );
}
