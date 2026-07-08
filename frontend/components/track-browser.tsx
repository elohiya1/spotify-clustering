import React, { useState, useMemo } from 'react';
import { TRACKS, CLUSTERS } from '@/lib/data';
import { Search } from 'lucide-react';
import { VinylRecord } from '@/components/vinyl-record';

export function TrackBrowser() {
  const [filter, setFilter] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');

  const filteredTracks = useMemo(() => {
    return TRACKS.filter(t => {
      const matchesFilter = filter === 'all' || t.clusterId === filter;
      const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                            t.artist.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    }).sort((a, b) => a.clusterId - b.clusterId);
  }, [filter, search]);

  return (
    <div className="border border-[#282828] bg-[#000] flex flex-col h-[700px]">
      
      {/* Controls */}
      <div className="border-b border-[#282828] p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-[#121212]">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase transition-colors border ${filter === 'all' ? 'bg-white text-black border-white' : 'bg-transparent text-[#b3b3b3] border-[#333] hover:border-[#7C3AED] hover:text-white'}`}
          >
            All Tracks
          </button>
          {CLUSTERS.map(c => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase transition-colors border flex items-center gap-2`}
              style={{
                backgroundColor: filter === c.id ? c.color : 'transparent',
                color: filter === c.id ? '#000' : '#b3b3b3',
                borderColor: filter === c.id ? c.color : '#333',
              }}
            >
              <div className="w-2 h-2" style={{ backgroundColor: filter === c.id ? '#000' : c.color }} />
              {c.name}
            </button>
          ))}
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
          <input 
            type="text" 
            placeholder="SEARCH LIBRARY..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black border border-[#333] pl-10 pr-4 py-2.5 text-xs font-bold tracking-widest text-white placeholder:text-[#555] focus:outline-none focus:border-[#7C3AED] transition-colors uppercase"
          />
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[auto_1fr_120px] md:grid-cols-[auto_1.5fr_1fr_140px] gap-4 p-4 border-b border-[#282828] bg-black text-[10px] font-bold tracking-[0.2em] text-[#555] uppercase">
        <div className="w-8"></div>
        <div>Title</div>
        <div className="hidden md:block">Artist</div>
        <div className="text-right">Metrics (E/D/V)</div>
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {filteredTracks.map(track => {
          const cluster = CLUSTERS.find(c => c.id === track.clusterId)!;
          
          return (
            <div
              key={track.id}
              className="grid grid-cols-[auto_1fr_120px] md:grid-cols-[auto_1.5fr_1fr_140px] gap-4 px-4 py-3 border-b border-[#1a1a1a] last:border-b-0 hover:bg-[#121212] transition-colors items-center group"
            >
              <div className="w-8 flex items-center justify-center">
                <VinylRecord size={24} labelColor={cluster.color} className="opacity-40 group-hover:opacity-100 group-hover:animate-[spin_2s_linear_infinite]" />
              </div>
              
              <div className="truncate">
                <p className="text-sm font-semibold text-white truncate group-hover:text-[#7C3AED] transition-colors">{track.title}</p>
                <p className="text-xs text-[#b3b3b3] truncate md:hidden mt-0.5">{track.artist}</p>
              </div>
              
              <div className="hidden md:block truncate">
                <p className="text-sm text-[#b3b3b3] truncate">{track.artist}</p>
              </div>
              
              <div className="flex flex-col gap-1.5 w-full max-w-[120px] justify-self-end mt-1">
                <FeatureBar val={track.energy} color={cluster.color} />
                <FeatureBar val={track.danceability} color={cluster.color} />
                <FeatureBar val={track.valence} color={cluster.color} />
              </div>
            </div>
          );
        })}
        {filteredTracks.length === 0 && (
          <div className="py-32 text-center text-[#555] text-sm uppercase tracking-[0.2em] font-bold">
            No tracks found
          </div>
        )}
      </div>
    </div>
  );
}

function FeatureBar({ val, color }: { val: number, color: string }) {
  return (
    <div className="h-[2px] w-full bg-[#222] overflow-hidden">
      <div className="h-full" style={{ width: `${val * 100}%`, backgroundColor: color }} />
    </div>
  );
}
