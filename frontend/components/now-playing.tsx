import React, { useEffect, useRef, useState } from 'react';
import type { Cluster, Track } from '@/lib/data';

interface NowPlayingProps {
  track: Track | null;
  cluster: Cluster | undefined;
  onClusterTagClick: (clusterId: number) => void;
}

export function NowPlaying({ track, cluster, onClusterTagClick }: NowPlayingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) {
      setOverflowing(false);
      return;
    }

    const measure = () => setOverflowing(text.scrollWidth > container.clientWidth);
    measure();

    // Custom fonts (Syne) can finish loading after this effect's first
    // measurement, silently widening the text without re-triggering it.
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
    };
  }, [track?.track_name]);

  if (!track) {
    return <p className="font-display text-xl text-muted-foreground">No track selected</p>;
  }

  return (
    <div className="flex items-center gap-4 w-full min-w-0">
      <div className="w-14 h-14 rounded-full overflow-hidden bg-muted flex-shrink-0">
        {track.album_art_url ? (
          <img src={track.album_art_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: cluster?.color_swatch ?? '#6B6560' }} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div ref={containerRef} className="overflow-hidden whitespace-nowrap">
          <div className={overflowing ? 'inline-flex animate-marquee' : 'inline-flex'}>
            <span ref={textRef} className="font-display font-extrabold text-2xl md:text-3xl tracking-tight text-foreground">
              {track.track_name}
            </span>
            {overflowing && (
              <span aria-hidden className="font-display font-extrabold text-2xl md:text-3xl tracking-tight text-foreground pl-12">
                {track.track_name}
              </span>
            )}
          </div>
        </div>

        <p className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground mt-1 truncate">
          {track.artist_name}
        </p>

        {cluster && (
          <button
            onClick={() => onClusterTagClick(cluster.cluster_id)}
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest transition-opacity hover:opacity-80"
            style={{ backgroundColor: `${cluster.color_swatch}2e`, color: cluster.color_swatch }}
          >
            {cluster.cluster_name}
          </button>
        )}
      </div>
    </div>
  );
}
