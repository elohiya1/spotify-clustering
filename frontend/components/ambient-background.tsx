import React, { useEffect, useState } from 'react';

interface AmbientBackgroundProps {
  imageUrl?: string | null;
}

const LAYER_STYLE: React.CSSProperties = {
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  transform: 'scale(2)',
  filter: 'blur(100px)',
};

export function AmbientBackground({ imageUrl }: AmbientBackgroundProps) {
  const [current, setCurrent] = useState<string | null>(imageUrl ?? null);
  const [previous, setPrevious] = useState<string | null>(null);
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    const next = imageUrl ?? null;
    if (next === current) return;
    setPrevious(current);
    setCurrent(next);
    setFadeIn(false);
    const id = requestAnimationFrame(() => setFadeIn(true));
    return () => cancelAnimationFrame(id);
  }, [imageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {previous && <div className="absolute inset-0" style={{ ...LAYER_STYLE, backgroundImage: `url(${previous})`, opacity: 0.35 }} />}
      {current && (
        <div
          className="absolute inset-0 transition-opacity duration-[800ms] ease-out motion-reduce:transition-none"
          style={{ ...LAYER_STYLE, backgroundImage: `url(${current})`, opacity: fadeIn ? 0.35 : 0 }}
        />
      )}
      <div className="absolute inset-0 bg-background/50" />
    </div>
  );
}
