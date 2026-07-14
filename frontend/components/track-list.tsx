import React, { useState } from 'react';
import { VolumeX } from 'lucide-react';
import type { Cluster, Track } from '@/lib/data';
import { VinylRecord } from '@/components/vinyl-record';

interface TrackListProps {
  tracks: Track[];
  clusters: Cluster[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (trackId: string) => void;
}

function TrackThumbnail({ url, color }: { url: string | null; color: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />;
  }
  return <img src={url} alt="" onError={() => setFailed(true)} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />;
}

export function TrackList({ tracks, clusters, currentTrackId, isPlaying, onPlay }: TrackListProps) {
  return (
    <div className="flex-1 overflow-auto min-h-0">
      {tracks.map(track => {
        const cluster = clusters.find(c => c.cluster_id === track.cluster_id);
        const color = cluster?.color_swatch ?? '#6B6560';
        const playable = !!track.preview_url;
        const isCurrent = track.track_id === currentTrackId;

        return (
          <div
            key={track.track_id}
            onClick={() => playable && onPlay(track.track_id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
              playable ? 'cursor-pointer hover:bg-white/5' : 'opacity-40 cursor-not-allowed'
            } ${isCurrent ? 'bg-white/5' : ''}`}
          >
            <div className="relative flex-shrink-0 w-9 h-9">
              <TrackThumbnail url={track.album_art_url} color={color} />
              {isCurrent && (
                <div className="absolute -bottom-1 -right-1">
                  <VinylRecord size={16} color={color} spinning={isPlaying} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{track.track_name}</p>
              <p className="text-xs text-muted-foreground truncate font-mono">{track.artist_name}</p>
            </div>

            {!playable && <VolumeX size={14} className="text-muted-foreground flex-shrink-0" aria-label="No preview available" />}
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          </div>
        );
      })}

      {tracks.length === 0 && (
        <div className="py-20 text-center text-muted-foreground text-sm font-mono uppercase tracking-widest">
          No tracks in this cluster
        </div>
      )}
    </div>
  );
}
