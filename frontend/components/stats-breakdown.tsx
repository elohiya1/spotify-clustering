import React from 'react';

export function StatsBreakdown() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-0 border border-[#282828] bg-black">
      <StatBox title="Initial Tracks" value="214" subtitle="Extracted from playlists" />
      <StatBox title="Kaggle Match" value="42" subtitle="19.6% initial coverage" />
      <StatBox title="ReccoBeats" value="123" subtitle="Secondary API fallback" />
      <StatBox title="Final Coverage" value="165" subtitle="77.1% success rate" highlight />
    </div>
  );
}

function StatBox({ title, value, subtitle, highlight = false }: { title: string, value: string, subtitle: string, highlight?: boolean }) {
  return (
    <div className="p-8 border-b md:border-b-0 md:border-r border-[#282828] last:border-0 flex flex-col justify-between min-h-[160px] group hover:bg-[#121212] transition-colors">
      <p className="text-[10px] font-bold text-[#b3b3b3] uppercase tracking-[0.2em]">{title}</p>
      <div className="mt-6">
        <p className={`text-5xl font-black tracking-tighter mb-2 ${highlight ? 'text-[#7C3AED]' : 'text-white'}`}>
          {value}
        </p>
        <p className="text-xs text-[#555] font-bold uppercase tracking-widest">{subtitle}</p>
      </div>
    </div>
  );
}
