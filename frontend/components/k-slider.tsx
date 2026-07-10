import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SweepResponse } from '@/lib/api';

const ACCENT = '#7C3AED';
const MUTED = '#333';

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const point = payload[0].payload as { k: number; silhouette_score: number };
    return (
      <div className="bg-[#0a0a0a] border border-[#333] p-2 shadow-2xl text-xs pointer-events-none">
        <p className="font-bold text-white">k = {point.k}</p>
        <p className="text-[#888] font-mono">silhouette: {point.silhouette_score.toFixed(3)}</p>
      </div>
    );
  }
  return null;
};

export function KSlider({
  sweep,
  selectedK,
  onChange,
}: {
  sweep: SweepResponse;
  selectedK: number;
  onChange: (k: number) => void;
}) {
  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        {sweep.k_values.map(k => (
          <button
            key={k}
            onClick={() => onChange(k)}
            className={`w-10 h-10 flex items-center justify-center text-sm font-bold border transition-colors relative ${
              selectedK === k
                ? 'border-[#7C3AED] text-[#7C3AED] bg-[#7C3AED]/10'
                : 'border-[#282828] text-[#888] hover:border-[#444] hover:text-white'
            }`}
          >
            {k}
            {sweep.best_k === k && (
              <span className="absolute -top-2 -right-2 w-3 h-3 bg-[#7C3AED] rounded-full border-2 border-black" />
            )}
          </button>
        ))}
        <div className="ml-2 text-[10px] font-bold tracking-[0.15em] text-[#888] uppercase flex items-center gap-1.5">
          <span className="w-2 h-2 bg-[#7C3AED] rounded-full inline-block" />
          Recommended k = {sweep.best_k}
        </div>
      </div>

      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sweep.results} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="30%">
            <XAxis
              dataKey="k"
              tick={{ fill: '#666', fontSize: 10, fontFamily: 'monospace' }}
              axisLine={{ stroke: '#282828' }}
              tickLine={false}
            />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} isAnimationActive={false} />
            <Bar dataKey="silhouette_score" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {sweep.results.map(point => (
                <Cell
                  key={point.k}
                  fill={point.k === selectedK ? ACCENT : MUTED}
                  fillOpacity={point.k === selectedK ? 1 : point.k === sweep.best_k ? 0.7 : 0.5}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
