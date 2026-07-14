import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Track } from '@/lib/data';

const RESTART_THRESHOLD_SECONDS = 3;
const MIN_TRACKS_FOR_SHUFFLE = 5;

function shuffleOrder(ids: string[]): string[] {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function usePlayer(tracks: Track[]) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [clusterFilter, setClusterFilter] = useState<number | null>(null);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [shuffledIds, setShuffledIds] = useState<string[] | null>(null);
  const [repeatOne, setRepeatOne] = useState(false);

  const visibleTracks = useMemo(
    () => (clusterFilter === null ? tracks : tracks.filter(t => t.cluster_id === clusterFilter)),
    [tracks, clusterFilter]
  );

  const playableTracks = useMemo(
    () => visibleTracks.filter(t => !!t.preview_url),
    [visibleTracks]
  );

  const shuffleDisabled = playableTracks.length < MIN_TRACKS_FOR_SHUFFLE;
  const stopAtEnd = playableTracks.length < MIN_TRACKS_FOR_SHUFFLE;

  const queueIds = useMemo(() => {
    const naturalOrder = playableTracks.map(t => t.track_id);
    if (shuffle && shuffledIds) {
      // Keep only ids still in the current (possibly re-filtered) playable set.
      const naturalSet = new Set(naturalOrder);
      const filtered = shuffledIds.filter(id => naturalSet.has(id));
      const missing = naturalOrder.filter(id => !filtered.includes(id));
      return [...filtered, ...missing];
    }
    return naturalOrder;
  }, [playableTracks, shuffle, shuffledIds]);

  const currentTrack = useMemo(
    () => tracks.find(t => t.track_id === currentTrackId) ?? null,
    [tracks, currentTrackId]
  );

  // Library-wide, NOT scoped to the active cluster filter — filtering to a
  // cluster that happens to have zero previews shouldn't tear down the
  // player, only the "every track in the library" case should.
  const hasAnyPreviewInLibrary = useMemo(() => tracks.some(t => !!t.preview_url), [tracks]);
  const emptyState: 'none' | 'all-null-preview' = hasAnyPreviewInLibrary ? 'none' : 'all-null-preview';

  // Pick an initial playable track once tracks load (never autoplay — paused
  // until a user gesture, per browser autoplay policy).
  useEffect(() => {
    if (currentTrackId === null && queueIds.length > 0) {
      setCurrentTrackId(queueIds[0]);
    }
  }, [currentTrackId, queueIds]);

  // Drive the actual <audio> element from state.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.preview_url) return;
    if (audio.src !== currentTrack.preview_url) {
      audio.src = currentTrack.preview_url;
    }
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying]);

  const playTrack = useCallback((trackId: string) => {
    const track = tracks.find(t => t.track_id === trackId);
    if (!track?.preview_url) return; // null-preview rows are inert, no error
    setCurrentTrackId(trackId);
    setIsPlaying(true);
  }, [tracks]);

  const togglePlayPause = useCallback(() => {
    if (!currentTrack?.preview_url) return;
    setIsPlaying(p => !p);
  }, [currentTrack]);

  const advance = useCallback((direction: 1 | -1) => {
    if (queueIds.length === 0) return;
    const idx = currentTrackId ? queueIds.indexOf(currentTrackId) : -1;

    if (direction === 1 && idx === queueIds.length - 1 && stopAtEnd) {
      setIsPlaying(false);
      return;
    }

    const nextIdx = idx === -1 ? 0 : (idx + direction + queueIds.length) % queueIds.length;
    setCurrentTrackId(queueIds[nextIdx]);
    setIsPlaying(true);
  }, [queueIds, currentTrackId, stopAtEnd]);

  const next = useCallback(() => advance(1), [advance]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > RESTART_THRESHOLD_SECONDS) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    advance(-1);
  }, [advance]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const toggleShuffle = useCallback(() => {
    if (shuffleDisabled) return;
    setShuffle(prev => {
      if (!prev) setShuffledIds(shuffleOrder(playableTracks.map(t => t.track_id)));
      return !prev;
    });
  }, [shuffleDisabled, playableTracks]);

  const toggleRepeat = useCallback(() => setRepeatOne(r => !r), []);

  // Wire native <audio> events once.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (repeatOne) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        advance(1);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [repeatOne, advance]);

  return {
    audioRef,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    shuffle,
    shuffleDisabled,
    repeatOne,
    clusterFilter,
    setClusterFilter,
    visibleTracks,
    emptyState,
    playTrack,
    togglePlayPause,
    next,
    previous,
    seek,
    toggleShuffle,
    toggleRepeat,
  };
}
