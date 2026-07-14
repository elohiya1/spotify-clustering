import React, { useEffect, useState } from 'react';
import type { usePlayer } from '@/hooks/use-player';
import { extractDominantColor } from '@/lib/color';
import type { Cluster } from '@/lib/data';
import { VinylRecord } from '@/components/vinyl-record';
import { NowPlaying } from '@/components/now-playing';
import { ProgressBar } from '@/components/progress-bar';
import { TransportControls } from '@/components/transport-controls';

interface RecordPlayerProps {
  player: ReturnType<typeof usePlayer>;
  clusters: Cluster[];
}

const FALLBACK_COLOR = '#8A9A7B';

export function RecordPlayer({ player, clusters }: RecordPlayerProps) {
  const {
    audioRef,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    shuffle,
    shuffleDisabled,
    repeatOne,
    togglePlayPause,
    next,
    previous,
    seek,
    toggleShuffle,
    toggleRepeat,
    setClusterFilter,
    emptyState,
  } = player;

  const cluster = currentTrack ? clusters.find(c => c.cluster_id === currentTrack.cluster_id) : undefined;
  const fallbackColor = cluster?.color_swatch ?? FALLBACK_COLOR;
  const [dynamicColor, setDynamicColor] = useState(fallbackColor);

  useEffect(() => {
    let cancelled = false;
    if (currentTrack?.album_art_url) {
      extractDominantColor(currentTrack.album_art_url, fallbackColor).then(color => {
        if (!cancelled) setDynamicColor(color);
      });
    } else {
      setDynamicColor(fallbackColor);
    }
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.album_art_url, fallbackColor]);

  if (emptyState === 'all-null-preview') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <VinylRecord size={280} spinning={false} />
        <p className="mt-8 font-serif italic text-lg text-muted-foreground max-w-xs">
          Spotify has limited preview access for these tracks.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-10 px-8 py-12 w-full max-w-md mx-auto">
      <audio ref={audioRef} preload="metadata" />

      <button onClick={togglePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'} className="focus:outline-none">
        <VinylRecord
          size={420}
          color={dynamicColor}
          albumArtUrl={currentTrack?.album_art_url}
          spinning={isPlaying}
          withTonearm
        />
      </button>

      <div className="w-full flex flex-col gap-6">
        <NowPlaying track={currentTrack} cluster={cluster} onClusterTagClick={setClusterFilter} />
        <ProgressBar
          currentTime={currentTime}
          duration={duration || 30}
          color={dynamicColor}
          onSeek={seek}
          disabled={!currentTrack}
        />
        <TransportControls
          isPlaying={isPlaying}
          shuffle={shuffle}
          shuffleDisabled={shuffleDisabled}
          repeatOne={repeatOne}
          color={dynamicColor}
          disabled={!currentTrack}
          onTogglePlayPause={togglePlayPause}
          onPrevious={previous}
          onNext={next}
          onToggleShuffle={toggleShuffle}
          onToggleRepeat={toggleRepeat}
        />
      </div>
    </div>
  );
}
