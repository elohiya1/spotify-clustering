import React, { useState } from 'react';
import { usePlayer } from '@/hooks/use-player';
import { useOutputData, type OutputData } from '@/lib/data';
import { AmbientBackground } from '@/components/ambient-background';
import { RecordPlayer } from '@/components/record-player';
import { ClusterPills } from '@/components/cluster-pills';
import { ClusterInfoPanel } from '@/components/cluster-info-panel';
import { TrackList } from '@/components/track-list';
import { ClusterMap } from '@/components/cluster-map';

type ViewMode = 'list' | 'map';

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground px-6">
      <p className="font-serif italic text-lg text-muted-foreground text-center max-w-md">{children}</p>
    </div>
  );
}

function DashboardContent({ data }: { data: OutputData }) {
  const player = usePlayer(data.tracks);
  const [view, setView] = useState<ViewMode>('list');
  const activeCluster =
    player.clusterFilter !== null ? data.clusters.find(c => c.cluster_id === player.clusterFilter) ?? null : null;

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row">
      <AmbientBackground imageUrl={player.currentTrack?.album_art_url} />

      <div className="w-full md:w-[45%] md:h-screen md:sticky md:top-0 flex items-center justify-center">
        <RecordPlayer player={player} clusters={data.clusters} />
      </div>

      <div className="w-full md:w-[55%] flex flex-col px-6 py-10 md:py-12 md:pr-10 gap-4 md:h-screen md:overflow-hidden">
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {data.meta.total_tracks} tracks · {data.clusters.length} clusters · {data.meta.chosen_model} @ k=
              {data.meta.chosen_k}
            </h2>
            <div className="flex gap-1 font-mono text-[10px] uppercase tracking-widest">
              {(['list', 'map'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  aria-pressed={view === mode}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    view === mode ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <ClusterPills clusters={data.clusters} activeClusterId={player.clusterFilter} onSelect={player.setClusterFilter} />
        </div>

        <ClusterInfoPanel cluster={activeCluster} />

        {view === 'list' ? (
          <TrackList
            tracks={player.visibleTracks}
            clusters={data.clusters}
            currentTrackId={player.currentTrack?.track_id ?? null}
            isPlaying={player.isPlaying}
            onPlay={player.playTrack}
          />
        ) : (
          <ClusterMap
            tracks={data.tracks}
            clusters={data.clusters}
            activeClusterId={player.clusterFilter}
            currentTrackId={player.currentTrack?.track_id ?? null}
            onPlay={player.playTrack}
          />
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const state = useOutputData();

  if (state.status === 'loading') {
    return <FullScreenMessage>Loading your taste clusters…</FullScreenMessage>;
  }

  if (state.status === 'error') {
    return (
      <FullScreenMessage>
        Couldn't load output.json — run the pipeline (see README) so
        frontend/public/output.json exists, then refresh.
      </FullScreenMessage>
    );
  }

  return <DashboardContent data={state.data} />;
}
