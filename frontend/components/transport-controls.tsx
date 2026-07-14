import React from 'react';
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';

interface TransportControlsProps {
  isPlaying: boolean;
  shuffle: boolean;
  shuffleDisabled: boolean;
  repeatOne: boolean;
  color: string;
  disabled?: boolean;
  onTogglePlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
}

export function TransportControls({
  isPlaying,
  shuffle,
  shuffleDisabled,
  repeatOne,
  color,
  disabled,
  onTogglePlayPause,
  onPrevious,
  onNext,
  onToggleShuffle,
  onToggleRepeat,
}: TransportControlsProps) {
  return (
    <div className="flex items-center justify-center gap-6">
      <button
        onClick={onToggleShuffle}
        disabled={shuffleDisabled}
        aria-pressed={shuffle}
        aria-label="Shuffle"
        className={`transition-opacity ${shuffleDisabled ? 'opacity-20 cursor-not-allowed' : shuffle ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
      >
        <Shuffle size={18} color={shuffle ? color : undefined} />
      </button>

      <button
        onClick={onPrevious}
        disabled={disabled}
        aria-label="Previous"
        className="text-foreground opacity-80 hover:opacity-100 disabled:opacity-30 transition-opacity"
      >
        <SkipBack size={22} fill="currentColor" />
      </button>

      <button
        onClick={onTogglePlayPause}
        disabled={disabled}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-30 transition-transform hover:scale-105"
        style={{ backgroundColor: color }}
      >
        {isPlaying ? (
          <Pause size={22} className="text-black" fill="black" />
        ) : (
          <Play size={22} className="text-black ml-0.5" fill="black" />
        )}
      </button>

      <button
        onClick={onNext}
        disabled={disabled}
        aria-label="Next"
        className="text-foreground opacity-80 hover:opacity-100 disabled:opacity-30 transition-opacity"
      >
        <SkipForward size={22} fill="currentColor" />
      </button>

      <button
        onClick={onToggleRepeat}
        aria-pressed={repeatOne}
        aria-label="Repeat one"
        className={`transition-opacity ${repeatOne ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
      >
        {repeatOne ? <Repeat1 size={18} color={color} /> : <Repeat size={18} />}
      </button>
    </div>
  );
}
