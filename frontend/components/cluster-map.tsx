import React, { useState, useRef, useCallback, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ZAxis } from 'recharts';
import { Cluster, Track } from '@/lib/api';

type Feature = 'energy' | 'danceability' | 'acousticness' | 'valence' | 'speechiness' | 'instrumentalness';

const FEATURES: { key: Feature; label: string; short: string }[] = [
  { key: 'energy',           label: 'Energy',           short: 'NRG' },
  { key: 'danceability',     label: 'Danceability',     short: 'DNC' },
  { key: 'acousticness',     label: 'Acousticness',     short: 'ACS' },
  { key: 'valence',          label: 'Valence',          short: 'VAL' },
  { key: 'speechiness',      label: 'Speechiness',      short: 'SPC' },
  { key: 'instrumentalness', label: 'Instrumentalness', short: 'INS' },
];

// Rotate a point (x,y) around origin by `angle` radians
function rotatePoint(x: number, y: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { rx: x * cos - y * sin, ry: x * sin + y * cos };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  xFeature: Feature;
  yFeature: Feature;
  clusters: Cluster[];
}

const CustomTooltip = ({ active, payload, xFeature, yFeature, clusters }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as Track & { rx: number; ry: number };
    const cluster = clusters.find(c => c.id === data.clusterId);
    return (
      <div className="bg-[#0a0a0a] border border-[#333] p-3 shadow-2xl text-xs pointer-events-none">
        <p className="font-bold text-white mb-0.5">{data.title}</p>
        <p className="text-[#666] mb-2">{data.artist}</p>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: cluster?.color }} />
          <span className="font-bold tracking-widest text-[10px] text-[#aaa] uppercase">{cluster?.name}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-[#444] uppercase tracking-widest">
          <span>{FEATURES.find(f => f.key === xFeature)?.short}</span>
          <span className="text-[#aaa]">{(data[xFeature] * 100).toFixed(0)}</span>
          <span>{FEATURES.find(f => f.key === yFeature)?.short}</span>
          <span className="text-[#aaa]">{(data[yFeature] * 100).toFixed(0)}</span>
        </div>
      </div>
    );
  }
  return null;
};

export function ClusterMap({
  clusters,
  tracks,
  onTrackSelect,
}: {
  clusters: Cluster[];
  tracks: Track[];
  onTrackSelect?: (track: Track) => void;
}) {
  const [xFeature, setXFeature] = useState<Feature>('energy');
  const [yFeature, setYFeature] = useState<Feature>('acousticness');
  const [angleDeg, setAngleDeg] = useState(0);
  const chartRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastAngle = useRef(0);
  const dragStart = useRef({ x: 0, y: 0 });

  // Get center of chart div for angle calculation
  const getCenter = () => {
    if (!chartRef.current) return { cx: 0, cy: 0 };
    const rect = chartRef.current.getBoundingClientRect();
    return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
  };

  const getAngleFromCenter = (clientX: number, clientY: number) => {
    const { cx, cy } = getCenter();
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  };

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    lastAngle.current = getAngleFromCenter(e.clientX, e.clientY);
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const current = getAngleFromCenter(e.clientX, e.clientY);
    const delta = current - lastAngle.current;
    // Handle wrap-around at ±180
    const adjusted = delta > 180 ? delta - 360 : delta < -180 ? delta + 360 : delta;
    lastAngle.current = current;
    setAngleDeg(prev => (prev + adjusted) % 360);
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    dragging.current = true;
    lastAngle.current = getAngleFromCenter(t.clientX, t.clientY);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return;
    const t = e.touches[0];
    const current = getAngleFromCenter(t.clientX, t.clientY);
    const delta = current - lastAngle.current;
    const adjusted = delta > 180 ? delta - 360 : delta < -180 ? delta + 360 : delta;
    lastAngle.current = current;
    setAngleDeg(prev => (prev + adjusted) % 360);
  }, []);

  const angleRad = (angleDeg * Math.PI) / 180;

  // Rotate raw feature coordinates
  const chartData = useMemo(() =>
    tracks.map(t => {
      const rawX = t[xFeature] as number;
      const rawY = t[yFeature] as number;
      const { rx, ry } = rotatePoint(rawX - 0.5, rawY - 0.5, angleRad);
      return { ...t, px: rx + 0.5, py: ry + 0.5 };
    }),
    [tracks, xFeature, yFeature, angleRad]
  );

  const handleXSelect = (f: Feature) => { if (f !== yFeature) setXFeature(f); };
  const handleYSelect = (f: Feature) => { if (f !== xFeature) setYFeature(f); };

  return (
    <div className="w-full h-full flex flex-col gap-3 min-h-0">

      {/* Axis pickers */}
      <div className="flex items-start gap-6 flex-wrap flex-shrink-0">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold tracking-[0.2em] text-[#444] uppercase">X</span>
          <div className="flex gap-1 flex-wrap">
            {FEATURES.map(f => (
              <button key={f.key} onClick={() => handleXSelect(f.key)} disabled={f.key === yFeature}
                className={`px-2 py-1 text-[9px] font-bold tracking-[0.1em] uppercase border transition-colors disabled:opacity-20 disabled:cursor-not-allowed ${
                  xFeature === f.key ? 'border-[#7C3AED] text-[#7C3AED] bg-[#7C3AED]/10' : 'border-[#282828] text-[#555] hover:border-[#444] hover:text-[#888]'
                }`}>{f.short}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold tracking-[0.2em] text-[#444] uppercase">Y</span>
          <div className="flex gap-1 flex-wrap">
            {FEATURES.map(f => (
              <button key={f.key} onClick={() => handleYSelect(f.key)} disabled={f.key === xFeature}
                className={`px-2 py-1 text-[9px] font-bold tracking-[0.1em] uppercase border transition-colors disabled:opacity-20 disabled:cursor-not-allowed ${
                  yFeature === f.key ? 'border-[#7C3AED] text-[#7C3AED] bg-[#7C3AED]/10' : 'border-[#282828] text-[#555] hover:border-[#444] hover:text-[#888]'
                }`}>{f.short}</button>
            ))}
          </div>
        </div>
        {/* Rotation readout + reset */}
        <div className="flex flex-col gap-1 ml-auto">
          <span className="text-[9px] font-bold tracking-[0.2em] text-[#444] uppercase">Rotation</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#7C3AED] tabular-nums w-10">
              {Math.round(((angleDeg % 360) + 360) % 360)}°
            </span>
            <button onClick={() => setAngleDeg(0)}
              className="px-2 py-1 text-[9px] font-bold tracking-[0.1em] uppercase border border-[#282828] text-[#555] hover:border-[#444] hover:text-[#888] transition-colors">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Chart — drag to rotate */}
      <div
        ref={chartRef}
        className="flex-1 relative min-h-0 select-none"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={() => { dragging.current = false; }}
      >
        {/* Drag hint */}
        <div className="absolute top-2 right-2 text-[9px] font-bold tracking-[0.15em] text-[#333] uppercase pointer-events-none z-10">
          drag to rotate
        </div>
        {/* Axis labels */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold tracking-[0.2em] text-[#444] uppercase pointer-events-none z-10">
          {FEATURES.find(f => f.key === xFeature)?.label}
        </div>
        <div
          className="absolute top-1/2 left-0 text-[9px] font-bold tracking-[0.2em] text-[#444] uppercase pointer-events-none z-10 origin-center"
          style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}
        >
          {FEATURES.find(f => f.key === yFeature)?.label}
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 20, bottom: 28, left: 28 }}>
            <XAxis type="number" dataKey="px" hide domain={['auto', 'auto']} />
            <YAxis type="number" dataKey="py" hide domain={['auto', 'auto']} />
            <ZAxis type="number" range={[50, 50]} />
            <Tooltip
              content={<CustomTooltip xFeature={xFeature} yFeature={yFeature} clusters={clusters} />}
              cursor={{ strokeDasharray: '3 3', stroke: '#2a2a2a' }}
              isAnimationActive={false}
            />
            {clusters.map(cluster => {
              const clusterData = chartData.filter(t => t.clusterId === cluster.id);
              return (
                <Scatter key={cluster.id} name={cluster.name} data={clusterData} fill={cluster.color}
                  isAnimationActive={false}
                  onClick={(e) => onTrackSelect?.(e.payload)}
                >
                  {clusterData.map((_, i) => (
                    <Cell key={`c-${i}`} fill={cluster.color} fillOpacity={0.85} />
                  ))}
                </Scatter>
              );
            })}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Feature key */}
      <div className="flex-shrink-0 border-t border-[#1a1a1a] pt-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {clusters.map(cluster => (
            <div key={cluster.id} className="flex flex-col gap-1.5">
              {/* Cluster header */}
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: cluster.color }} />
                <span className="text-[9px] font-bold text-white uppercase tracking-widest truncate">{cluster.name}</span>
              </div>
              {/* Feature bars */}
              {FEATURES.map(f => (
                <div key={f.key} className="flex items-center gap-1.5">
                  <span className="text-[8px] text-[#444] w-6 flex-shrink-0 font-bold uppercase tracking-wide">{f.short}</span>
                  <div className="flex-1 h-px bg-[#1a1a1a] relative">
                    <div
                      className="absolute top-0 left-0 h-full"
                      style={{
                        width: `${(cluster[f.key] as number) * 100}%`,
                        backgroundColor: cluster.color,
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-[8px] text-[#444] w-5 text-right tabular-nums">
                    {Math.round((cluster[f.key] as number) * 100)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
