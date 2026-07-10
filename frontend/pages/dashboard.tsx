import React, { useEffect, useState, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ClusterMap } from '@/components/cluster-map';
import { ClusterProfiles } from '@/components/cluster-profiles';
import { TrackBrowser } from '@/components/track-browser';
import { StatsBreakdown } from '@/components/stats-breakdown';
import { VinylRecord } from '@/components/vinyl-record';
import { KSlider } from '@/components/k-slider';
import { fetchSweep, fetchClusterResults, toAlgorithmView, toMergedTracks } from '@/lib/api';

export default function Dashboard() {
  const sweepQuery = useQuery({ queryKey: ['sweep'], queryFn: fetchSweep });
  const [selectedK, setSelectedK] = useState<number | null>(null);

  useEffect(() => {
    if (selectedK === null && sweepQuery.data) {
      setSelectedK(sweepQuery.data.best_k);
    }
  }, [selectedK, sweepQuery.data]);

  const clusterResultsQuery = useQuery({
    queryKey: ['clusterResults', selectedK],
    queryFn: () => fetchClusterResults(selectedK!),
    enabled: selectedK !== null,
    placeholderData: keepPreviousData,
  });

  const data = clusterResultsQuery.data;

  const kmeansView = useMemo(() => (data ? toAlgorithmView(data, 'kmeans') : null), [data]);
  const gmmView = useMemo(() => (data ? toAlgorithmView(data, 'gmm') : null), [data]);
  const mergedTracks = useMemo(() => (data ? toMergedTracks(data) : []), [data]);

  if (sweepQuery.isError || clusterResultsQuery.isError) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black text-white px-6">
        <div className="text-center max-w-md">
          <p className="text-lg font-bold mb-2">Backend not reachable</p>
          <p className="text-sm text-[#b3b3b3]">
            Start the API server first — see the README's "Run the app" section
            (<code className="text-[#7C3AED]">uvicorn api_server:app --reload --port 8000</code>).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black text-white selection:bg-[#7C3AED] selection:text-white font-sans">

      {/* Stark Top Bar */}
      <nav className="border-b border-[#282828] px-6 py-5 flex items-center justify-between bg-black sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-[#7C3AED]" /> {/* Sharp square logo marker */}
          <span className="font-bold tracking-tight text-sm">Spotify Taste Clustering</span>
        </div>
        <div className="text-[10px] font-bold tracking-[0.2em] text-[#b3b3b3] uppercase hidden sm:block">
          Personal Music Intelligence
        </div>
      </nav>

      {/* Hero Section */}
      <header className="min-h-[calc(100vh-64px)] w-full flex flex-col md:flex-row items-center bg-black px-6 py-12 md:py-0 border-b border-[#282828] gap-8">

        {/* Left column (~25%) */}
        <div className="w-full md:w-[25%] flex flex-col justify-center gap-8">
          <div>
            <h1 className="text-5xl lg:text-7xl font-black tracking-tight text-white leading-[1.1] mb-4">
              Spotify DNA Mapped.
            </h1>
            <p className="text-lg text-[#b3b3b3] font-medium tracking-wide">
              {data ? `${data.track_count} tracks. ${data.k} clusters. K-Means vs GMM.` : 'Loading tracks…'}
            </p>
          </div>

          <div className="flex flex-col gap-3 max-w-sm">
            {kmeansView?.clusters.map(cluster => (
              <div
                key={cluster.id}
                className="flex items-center gap-3 border border-[#282828] p-3 hover:bg-[#121212] transition-colors"
              >
                <div className="w-3 h-3 flex-shrink-0" style={{ backgroundColor: cluster.color }} />
                <span className="text-xs font-bold text-white uppercase tracking-widest">{cluster.name}</span>
                <span className="text-xs font-bold text-[#b3b3b3] ml-auto">{cluster.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center column (~20%) */}
        <div className="w-full md:w-[20%] flex justify-center items-center h-full min-h-[400px]">
          <VinylRecord size={380} labelColor="#7C3AED" spinning={true} withTonearm={true} />
        </div>

        {/* Right column (~55%) */}
        <div className="w-full md:w-[55%] h-[50vh] md:h-[calc(100vh-120px)] relative border-t md:border-t-0 md:border-l border-[#282828] md:pl-6 pt-6 md:pt-0 flex flex-col">
          <div className="absolute top-6 right-0 md:right-0 md:top-0 text-[10px] font-bold tracking-[0.2em] text-[#555] uppercase z-10 bg-black px-2 pb-2">
            PCA Cluster Map — K-Means
          </div>
          <div className="w-full flex-1 pt-8 md:pt-10">
            {kmeansView ? (
              <ClusterMap clusters={kmeansView.clusters} tracks={kmeansView.tracks} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#555] text-sm uppercase tracking-widest">
                Loading clusters…
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content container */}
      <div className="container mx-auto px-6 py-20 max-w-[1400px]">

        {/* Model Selection */}
        <section className="mb-32">
          <div className="flex items-end justify-between mb-6 border-b border-[#282828] pb-4">
            <h2 className="text-[12px] font-bold tracking-[0.2em] text-white uppercase">Model Selection</h2>
            <div className="text-[10px] text-[#555] font-mono tracking-widest">SILHOUETTE SWEEP, K=2..8</div>
          </div>
          {sweepQuery.data && selectedK !== null ? (
            <KSlider sweep={sweepQuery.data} selectedK={selectedK} onChange={setSelectedK} />
          ) : (
            <div className="text-[#555] text-sm uppercase tracking-widest">Loading sweep…</div>
          )}
        </section>

        {/* Stats */}
        <section className="mb-32">
          <div className="flex items-end justify-between mb-6 border-b border-[#282828] pb-4">
            <h2 className="text-[12px] font-bold tracking-[0.2em] text-white uppercase">Pipeline Statistics</h2>
            <div className="text-[10px] text-[#555] font-mono tracking-widest">DATA EXTRACTION</div>
          </div>
          <StatsBreakdown />
        </section>

        {/* Profiles — side by side K-Means vs GMM */}
        <section className="mb-32">
          <div className="flex items-end justify-between mb-6 border-b border-[#282828] pb-4">
            <h2 className="text-[12px] font-bold tracking-[0.2em] text-white uppercase">Sonic Profiles</h2>
            <div className="text-[10px] text-[#555] font-mono tracking-widest">K-MEANS VS GMM AT K={selectedK ?? '—'}</div>
          </div>
          {kmeansView && gmmView && data ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div>
                <div className="flex items-baseline justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white">K-Means (hard clusters)</h3>
                  <span className="text-[10px] font-mono text-[#7C3AED]">
                    silhouette {data.kmeans.silhouette_score.toFixed(3)}
                  </span>
                </div>
                <ClusterProfiles clusters={kmeansView.clusters} />
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white">Gaussian Mixture Model (soft clusters)</h3>
                  <span className="text-[10px] font-mono text-[#7C3AED]">
                    silhouette {data.gmm.silhouette_score.toFixed(3)}
                  </span>
                </div>
                <ClusterProfiles clusters={gmmView.clusters} />
              </div>
            </div>
          ) : (
            <div className="text-[#555] text-sm uppercase tracking-widest">Loading clusters…</div>
          )}
        </section>

        {/* Browser */}
        <section className="mb-32">
          <div className="flex items-end justify-between mb-6 border-b border-[#282828] pb-4">
            <h2 className="text-[12px] font-bold tracking-[0.2em] text-white uppercase">Track Library</h2>
            <div className="text-[10px] text-[#555] font-mono tracking-widest">RAW DATA</div>
          </div>
          {kmeansView && gmmView ? (
            <TrackBrowser tracks={mergedTracks} kmeansClusters={kmeansView.clusters} gmmClusters={gmmView.clusters} />
          ) : (
            <div className="text-[#555] text-sm uppercase tracking-widest">Loading tracks…</div>
          )}
        </section>

      </div>
    </div>
  );
}
