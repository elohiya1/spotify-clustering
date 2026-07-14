import React from 'react';

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  color: string;
  onSeek: (time: number) => void;
  disabled?: boolean;
}

export function ProgressBar({ currentTime, duration, color, onSeek, disabled }: ProgressBarProps) {
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div className="w-full">
      <div
        className={`relative h-1.5 w-full bg-white/10 rounded-full ${disabled ? '' : 'cursor-pointer'}`}
        onClick={handleClick}
      >
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
          style={{ left: `calc(${pct}% - 6px)`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between mt-1.5 font-mono text-[10px] text-muted-foreground tabular-nums">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
