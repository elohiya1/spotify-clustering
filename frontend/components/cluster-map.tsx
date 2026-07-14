import React, { useMemo, useState } from 'react';
import type { Cluster, Track } from '@/lib/data';

interface ClusterMapProps {
  tracks: Track[];
  clusters: Cluster[];
  activeClusterId: number | null;
  currentTrackId: string | null;
  onPlay: (trackId: string) => void;
}

const VIEW_SIZE = 100;
const PADDING = 10;
const DOT_R = 4; // >= 8px diameter mark
const CURRENT_DOT_R = 6;
const HIT_R = 12; // hit target bigger than the mark itself

export function ClusterMap({ tracks, clusters, activeClusterId, currentTrackId, onPlay }: ClusterMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const colorByCluster = useMemo(() => {
    const map = new Map<number, string>();
    clusters.forEach(c => map.set(c.cluster_id, c.color_swatch));
    return map;
  }, [clusters]);

  const { points, hovered } = useMemo(() => {
    if (tracks.length === 0) return { points: [], hovered: null };

    const xs = tracks.map(t => t.pca_x);
    const ys = tracks.map(t => t.pca_y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    const scale = (v: number, min: number, range: number) =>
      PADDING + ((v - min) / range) * (VIEW_SIZE - 2 * PADDING);

    const pts = tracks.map(t => ({
      track: t,
      x: scale(t.pca_x, minX, rangeX),
      y: VIEW_SIZE - scale(t.pca_y, minY, rangeY), // flip so +y is up
    }));

    return { points: pts, hovered: pts.find(p => p.track.track_id === hoveredId) ?? null };
  }, [tracks, hoveredId]);

  if (tracks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm font-mono uppercase tracking-widest">
        No tracks to map
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      {/* Square wrapper: keeps the 0-100 viewBox space equal to CSS % space,
          so the tooltip (positioned by plain %) lines up with the SVG dots
          regardless of preserveAspectRatio letterboxing. */}
      <div className="relative aspect-square h-full max-w-full max-h-full">
        <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} className="w-full h-full block">
          {points.map(({ track, x, y }) => {
            const color = colorByCluster.get(track.cluster_id) ?? '#6B6560';
            const playable = !!track.preview_url;
            const isCurrent = track.track_id === currentTrackId;
            const dimmed = activeClusterId !== null && track.cluster_id !== activeClusterId;
            const r = isCurrent ? CURRENT_DOT_R : DOT_R;

            return (
              <g
                key={track.track_id}
                opacity={dimmed ? 0.15 : playable ? 1 : 0.35}
                style={{ transition: 'opacity 200ms ease-out' }}
              >
                {/* transparent hit area, larger than the visible mark */}
                <circle
                  cx={x}
                  cy={y}
                  r={HIT_R}
                  fill="transparent"
                  stroke="none"
                  className={playable ? 'cursor-pointer' : 'cursor-default'}
                  tabIndex={playable ? 0 : -1}
                  role={playable ? 'button' : undefined}
                  aria-label={playable ? `Play ${track.track_name} by ${track.artist_name}` : undefined}
                  onMouseEnter={() => setHoveredId(track.track_id)}
                  onMouseLeave={() => setHoveredId(prev => (prev === track.track_id ? null : prev))}
                  onFocus={() => setHoveredId(track.track_id)}
                  onBlur={() => setHoveredId(prev => (prev === track.track_id ? null : prev))}
                  onClick={() => playable && onPlay(track.track_id)}
                  onKeyDown={e => {
                    if (playable && (e.key === 'Enter' || e.key === ' ')) onPlay(track.track_id);
                  }}
                />
                {/* visible mark, with a surface-color ring so overlapping dots stay legible */}
                <circle cx={x} cy={y} r={r} fill={color} stroke="#0A0A0A" strokeWidth={1} pointerEvents="none" />
                {isCurrent && (
                  <circle cx={x} cy={y} r={r + 2.5} fill="none" stroke="#F0EDE8" strokeWidth={0.8} pointerEvents="none" />
                )}
              </g>
            );
          })}
        </svg>

        {hovered && (
          <div
            className="absolute pointer-events-none px-3 py-2 rounded-md bg-[#141210] border border-white/10 shadow-lg z-10"
            style={{
              left: `${hovered.x}%`,
              top: `${hovered.y}%`,
              transform: 'translate(-50%, calc(-100% - 10px))',
            }}
          >
            <p className="font-display font-bold text-sm text-foreground whitespace-nowrap">{hovered.track.track_name}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              {hovered.track.artist_name}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
