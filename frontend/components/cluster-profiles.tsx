import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Cluster } from '@/lib/api';
import { VinylRecord } from '@/components/vinyl-record';

export function ClusterProfiles({ clusters }: { clusters: Cluster[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {clusters.map((cluster) => (
        <div key={cluster.id} className="flex flex-col border border-[#282828] bg-black group">
          {/* Sleeve Cover */}
          <div className="aspect-[4/5] border-b border-[#282828] p-6 relative flex flex-col justify-between overflow-hidden bg-[#121212]">
            {/* Partially showing vinyl record sliding out */}
            <div className="absolute -right-16 -bottom-16 opacity-50 group-hover:opacity-100 group-hover:-translate-x-6 group-hover:-translate-y-6 transition-all duration-500 ease-out">
              <VinylRecord size={240} labelColor={cluster.color} />
            </div>
            
            <div className="relative z-10">
              <div className="w-4 h-4 mb-5" style={{ backgroundColor: cluster.color }} />
              <h3 className="text-xl font-bold tracking-tight text-white max-w-[85%] leading-tight mb-2 line-clamp-3">
                {cluster.name}
              </h3>
              <p className="text-[10px] font-bold text-[#b3b3b3] font-mono uppercase tracking-widest">{cluster.count} Tracks</p>
            </div>
            
            <div className="relative z-10 mt-auto">
              <p className="text-xs text-[#b3b3b3] mb-4 leading-relaxed max-w-[90%]">
                {cluster.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {cluster.artists.map(artist => (
                  <span 
                    key={artist} 
                    className="text-[10px] px-2 py-1 border border-[#333] text-[#b3b3b3] font-bold uppercase tracking-[0.1em] bg-black"
                  >
                    {artist}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Radar Chart */}
          <div className="h-56 w-full p-4 bg-[#050505]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart 
                cx="50%" 
                cy="50%" 
                outerRadius="75%" 
                data={[
                  { subject: 'NRG', A: cluster.energy * 100 },
                  { subject: 'DNC', A: cluster.danceability * 100 },
                  { subject: 'ACS', A: cluster.acousticness * 100 },
                  { subject: 'VAL', A: cluster.valence * 100 },
                  { subject: 'SPC', A: cluster.speechiness * 100 },
                  { subject: 'INS', A: cluster.instrumentalness * 100 },
                ]}
              >
                <PolarGrid stroke="#282828" gridType="polygon" />
                <PolarAngleAxis 
                  dataKey="subject" 
                  tick={{ fill: '#888', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' }} 
                />
                <Radar
                  name={cluster.name}
                  dataKey="A"
                  stroke={cluster.color}
                  strokeWidth={2}
                  fill={cluster.color}
                  fillOpacity={0.15}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
