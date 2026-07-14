import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

const SPIN_DURATION_MS = 1800; // ~33 1/3 rpm

interface VinylRecordProps {
  size?: number | string;
  color?: string;
  albumArtUrl?: string | null;
  spinning?: boolean;
  withTonearm?: boolean;
  className?: string;
}

function getRotationDegrees(el: HTMLElement): number {
  const transform = getComputedStyle(el).transform;
  if (transform === 'none') return 0;
  const match = transform.match(/^matrix\(([^)]+)\)$/);
  if (!match) return 0;
  const [a, b] = match[1].split(',').map(parseFloat);
  return Math.atan2(b, a) * (180 / Math.PI);
}

export function VinylRecord({
  size = 120,
  color = '#8A9A7B',
  albumArtUrl = null,
  spinning = false,
  withTonearm = false,
  className = '',
}: VinylRecordProps) {
  const clipId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [imgError, setImgError] = useState(false);

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  useEffect(() => {
    setImgError(false);
  }, [albumArtUrl]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || reducedMotion) return;

    if (spinning) {
      el.style.transition = 'none';
      el.style.animation = `vinyl-spin ${SPIN_DURATION_MS}ms linear infinite`;
    } else {
      const angle = getRotationDegrees(el);
      el.style.animation = 'none';
      el.style.transition = 'none';
      el.style.transform = `rotate(${angle}deg)`;
      void el.offsetWidth; // force reflow so the transition below actually animates
      el.style.transition = 'transform 600ms cubic-bezier(0.25, 0.8, 0.4, 1)';
      el.style.transform = `rotate(${angle + 22}deg)`;
    }
  }, [spinning, reducedMotion]);

  const grooves = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 40; i++) {
      const r = 24 + i * 0.6;
      const stroke = i % 3 === 0 ? '#1c1c1c' : i % 5 === 0 ? '#111' : '#181818';
      const opacity = 0.4 + ((i * 37) % 60) / 100;
      arr.push(<circle key={i} cx="50" cy="50" r={r} fill="none" stroke={stroke} strokeWidth="0.4" strokeOpacity={opacity} />);
    }
    return arr;
  }, []);

  return (
    <div className={`relative inline-block ${className}`} style={{ width: size, height: size }}>
      <div ref={wrapperRef} style={{ width: '100%', height: '100%', transformOrigin: 'center' }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id={clipId}>
              <circle cx="50" cy="50" r="19.5" />
            </clipPath>
          </defs>

          {/* Outer disc */}
          <circle cx="50" cy="50" r="49" fill="#0a0a0a" stroke="#1f1f1f" strokeWidth="0.5" />

          {grooves}

          {/* Center label (~40% of disc diameter) */}
          <circle cx="50" cy="50" r="19.5" fill={color} />
          {albumArtUrl && !imgError && (
            <image
              href={albumArtUrl}
              x="30.5"
              y="30.5"
              width="39"
              height="39"
              clipPath={`url(#${clipId})`}
              preserveAspectRatio="xMidYMid slice"
              onError={() => setImgError(true)}
            />
          )}
          <circle cx="50" cy="50" r="19.5" fill="none" stroke="#000" strokeWidth="0.3" strokeOpacity="0.35" />

          {/* Gloss sheen */}
          <path d="M50,1 A49,49 0 0,1 99,50 L95,50 A45,45 0 0,0 50,5 Z" fill="#ffffff" fillOpacity="0.03" />
          <path d="M1,50 A49,49 0 0,1 50,1 L50,5 A45,45 0 0,0 5,50 Z" fill="#ffffff" fillOpacity="0.02" />

          {/* Spindle hole */}
          <circle cx="50" cy="50" r="2" fill="#000" />
          <circle cx="50" cy="50" r="2" fill="none" stroke="#555" strokeWidth="0.2" />
        </svg>
      </div>

      {withTonearm && (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          className="absolute inset-0 pointer-events-none z-10"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g transform="translate(85, 15) rotate(35)">
            <circle cx="0" cy="0" r="7" fill="#111" stroke="#333" strokeWidth="0.5" />
            <circle cx="0" cy="0" r="4.5" fill="#222" />
            <circle cx="0" cy="0" r="1.5" fill="#444" />
            <rect x="-2" y="-12" width="4" height="7" fill="#222" />
            <rect x="-3" y="-14" width="6" height="4" fill="#3a3a3a" />
            <path d="M-1.5,0 L-2.5,38 A4,4 0 0,1 -5,42 L-10,47 L-8.5,48.5 L-3,43 A4,4 0 0,0 -0.5,38 L1.5,0 Z" fill="#333" />
            <path d="M0,0 L-1,38 A4,4 0 0,1 -3.5,42 L-8.5,47" fill="none" stroke="#555" strokeWidth="0.5" />
            <g transform="translate(-9.5, 47.5) rotate(25)">
              <rect x="-2.5" y="-1" width="5" height="8" fill="#1a1a1a" stroke="#333" strokeWidth="0.3" />
              <rect x="-1.5" y="7" width="3" height="2" fill="#444" />
              <line x1="0" y1="9" x2="0" y2="10" stroke="#888" strokeWidth="0.3" />
            </g>
          </g>
        </svg>
      )}
    </div>
  );
}
