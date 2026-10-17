import React, { useState, useMemo } from 'react';
import { Layers, Search, RefreshCw } from 'lucide-react';
import { StreamItem } from '../types/stream';
import { StreamCard } from './StreamCard';
import { IPTV_PLAYLISTS, IptvPlaylistSource } from '../services/iptvService';

interface IptvDirectoryProps {
  iptvStreams: StreamItem[];
  onPlayStream: (stream: StreamItem) => void;
  onAddToMultiview: (stream: StreamItem) => void;
  onToggleWatchlist: (stream: StreamItem) => void;
  onTogglePiP?: (stream: StreamItem) => void;
  watchlistIds: string[];
  multiviewStreamIds: string[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const IptvDirectory: React.FC<IptvDirectoryProps> = ({
  iptvStreams,
  onPlayStream,
  onAddToMultiview,
  onToggleWatchlist,
  onTogglePiP,
  watchlistIds,
  multiviewStreamIds,
  onRefresh,
  isRefreshing,
}) => {
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [displayCount, setDisplayCount] = useState<number>(40);

  const filtered = useMemo(() => {
    return iptvStreams.filter((s) => {
      const matchesPlaylist =
        selectedPlaylist === 'all' ||
        (s.m3uSource && s.m3uSource.toLowerCase().includes(selectedPlaylist.toLowerCase()));

      const matchesCat =
        selectedCategory === 'All' ||
        s.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        (s.groupTitle && s.groupTitle.toLowerCase().includes(selectedCategory.toLowerCase()));

      const matchesSearch =
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        (s.groupTitle && s.groupTitle.toLowerCase().includes(search.toLowerCase())) ||
        (s.directEmbedUrl && s.directEmbedUrl.toLowerCase().includes(search.toLowerCase()));

      return matchesPlaylist && matchesCat && matchesSearch;
    });
  }, [iptvStreams, selectedPlaylist, selectedCategory, search]);

  const categories = [
    'All',
    'Live Sports',
    'Entertainment & Movies',
    'News & Documentaries',
    'US & FAST Channels',
    'Canada TV',
    'UK TV',
    '24/7 Channels',
  ];

  const displayedStreams = useMemo(() => {
    return filtered.slice(0, displayCount);
  }, [filtered, displayCount]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-in fade-in duration-200">
      {/* Directory Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">IPTV M3U Channels Hub</h1>
          </div>
          
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search 5,000+ IPTV channels..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setDisplayCount(40);
              }}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-52 sm:w-64"
            />
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="Refresh IPTV playlists"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          )}

          <div className="text-xs font-mono text-slate-200 px-3 py-1.5 bg-slate-900/80 rounded-lg border border-slate-700 font-bold">
            {filtered.length.toLocaleString()} Channels
          </div>
        </div>
      </div>

      {/* Playlist Source Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
        {IPTV_PLAYLISTS.map((pl) => {
          const isSelected = selectedPlaylist === pl.id;
          return (
            <button
              key={pl.id}
              onClick={() => {
                setSelectedPlaylist(isSelected ? 'all' : pl.id);
                setDisplayCount(40);
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-blue-950/40 border-blue-500/80 shadow-md shadow-blue-950/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white line-clamp-1">{pl.name}</span>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-2">{pl.description}</p>
            </button>
          );
        })}
      </div>

      {/* Category Tabs */}
      <div className="pb-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setSelectedCategory(cat);
              setDisplayCount(40);
            }}
            className={`px-3.5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Channels Grid */}
      {displayedStreams.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-slate-300 mb-1">No matching IPTV channels found</p>
          <p className="text-xs text-slate-500 max-w-sm">
            Try adjusting your search query or selecting a different playlist source tab above.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {displayedStreams.map((stream) => (
              <StreamCard
                key={stream.id}
                stream={stream}
                onPlay={onPlayStream}
                onAddToMultiview={onAddToMultiview}
                onToggleWatchlist={onToggleWatchlist}
                onTogglePiP={onTogglePiP}
                isInWatchlist={watchlistIds.includes(stream.id)}
                isInMultiview={multiviewStreamIds.includes(stream.id)}
              />
            ))}
          </div>

          {/* Load More Button if filtered exceeds displayCount */}
          {filtered.length > displayCount && (
            <div className="mt-8 flex items-center justify-center">
              <button
                onClick={() => setDisplayCount((prev) => prev + 40)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold shadow-md transition-colors"
              >
                Load More Channels ({displayedStreams.length} of {filtered.length.toLocaleString()})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
