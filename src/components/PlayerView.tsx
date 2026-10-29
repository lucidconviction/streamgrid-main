import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Maximize2,
  Minimize2,
  Tv,
  LayoutGrid,
  Bookmark,
  Share2,
  RefreshCw,

  Eye,
  Radio,
  ExternalLink,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  ChevronDown as ChevronDownIcon,
  Search,
  ShieldAlert,

  PictureInPicture2,
  AlertCircle,
  Star,
  History as HistoryIcon,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { StreamItem, StreamSource, WatchHistoryEntry } from '../types/stream';
import { streamService } from '../services/streamService';
import { getStreamGradient } from '../services/smuttThumbnailService';
import { StreamCard } from './StreamCard';
import { VideoPlayer } from './VideoPlayer';

interface PlayerViewProps {
  stream: StreamItem;
  onClose: () => void;
  onPlayStream: (stream: StreamItem) => void;
  onAddToMultiview: (stream: StreamItem) => void;
  onToggleWatchlist: (stream: StreamItem) => void;
  isInWatchlist: boolean;
  isInMultiview: boolean;
  relatedStreams: StreamItem[];
  watchlistIds: string[];
  watchlistStreams: StreamItem[];
  multiviewStreamIds: string[];
  watchHistory: WatchHistoryEntry[];
  iptvStreams: StreamItem[];
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
  onTogglePiP?: (stream?: StreamItem, embedUrl?: string) => void;
  onVideoEnd?: () => void;
  allStreams?: StreamItem[];
  currentIndex?: number;
  onPlayHistoryItem?: (entry: WatchHistoryEntry) => void;
  /** Smutt playlist — used for LAST CH / NEXT CH when playing smutt content */
  smuttPlaylist?: StreamItem[];
}


export const PlayerView: React.FC<PlayerViewProps> = ({
  stream,
  onClose,
  onPlayStream,
  onAddToMultiview,
  onToggleWatchlist,
  isInWatchlist,
  isInMultiview,
  relatedStreams,
  watchlistIds,
  watchlistStreams,
  iptvStreams,
  multiviewStreamIds,
  watchHistory,
  onShowToast,
  onTogglePiP,
  onVideoEnd,
  allStreams,
  currentIndex,
  onPlayHistoryItem,
  smuttPlaylist,
}) => {
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [playerError, setPlayerError] = useState(false);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const [showFavMenu, setShowFavMenu] = useState(false);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-menu')) {
        setShowHistoryMenu(false);
        setShowFavMenu(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Merge all stream sources — every site section accessible from channel list
  // When playing smutt/eporner, inject the smutt playlist so its videos appear in the channel list
  const mergedStreams = useMemo(() => {
    const base = [
      ...(allStreams || relatedStreams || []),
      ...(iptvStreams || []),
    ];
    const isAdult = stream.provider === 'smutt' || stream.provider === 'eporner';
    if (!isAdult) {
      return base.filter((s) => s.provider !== 'smutt' && s.provider !== 'eporner');
    }
    // Append the smutt playlist (dedup by id) to the channel list
    const baseIds = new Set(base.map((s) => s.id));
    const smutt = (smuttPlaylist || []).filter((s) => !baseIds.has(s.id));
    return [...base, ...smutt];
  }, [allStreams, relatedStreams, iptvStreams, stream.provider, smuttPlaylist]);

  // Playlist used for LAST CH / NEXT CH navigation — smutt playlist when playing smutt/eporner
  const activePlaylist = useMemo(() => {
    if ((stream.provider === 'smutt' || stream.provider === 'eporner') && smuttPlaylist && smuttPlaylist.length > 0) return smuttPlaylist;
    return mergedStreams;
  }, [stream.provider, smuttPlaylist, mergedStreams]);

  const groups = useMemo(() => {
    const base = ['All', 'Live Sports', '24/7 Channels', 'IPTV', 'Entertainment & Movies', 'News & Documentaries'];
    if (stream.provider === 'smutt' || stream.provider === 'eporner') {
      base.push('Smutt');
    }
    return base;
  }, [stream.provider]);

  // Filter channels based on selected tab
  const filteredChannels = useMemo(() => {
    let list = mergedStreams;
    if (selectedGroup === 'Smutt') list = list.filter((s) => s.provider === 'smutt' || s.provider === 'eporner');
    else if (selectedGroup === 'IPTV') list = list.filter((s) => s.provider === 'iptv');
    else if (selectedGroup === 'Live Sports') list = list.filter((s) => s.status === 'live' && (s.category.includes('Sport') || s.category.includes('Basketball') || s.category.includes('Football') || s.category.includes('Combat') || s.category.includes('Golf') || s.category.includes('Motorsport') || s.category.includes('Tennis') || s.category.includes('Cricket') || s.category.includes('Rugby') || s.category.includes('Hockey') || s.category.includes('Baseball') || s.category.includes('MMA') || s.category.includes('Boxing') || s.category.includes('Soccer')));
    else if (selectedGroup === '24/7 Channels') list = list.filter((s) => s.status === '24/7');
    else if (selectedGroup === 'Entertainment & Movies') list = list.filter((s) => s.category === 'Entertainment & Movies');
    else if (selectedGroup === 'News & Documentaries') list = list.filter((s) => s.category === 'News & Documentaries');
    else if (selectedGroup !== 'All') list = list.filter((s) => s.groupTitle === selectedGroup || s.category === selectedGroup);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.title.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
    }
    return list;
  }, [mergedStreams, selectedGroup, searchQuery]);

  // Group counts for tab badges
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'All': mergedStreams.length,
      'IPTV': 0,
      'Live Sports': 0,
      '24/7 Channels': 0,
      'Entertainment & Movies': 0,
      'News & Documentaries': 0,
      'Smutt': 0,
    };
    mergedStreams.forEach((s) => {
      if (s.provider === 'iptv') { counts['IPTV']++; return; }
      if (s.provider === 'smutt' || s.provider === 'eporner') { counts['Smutt']++; return; }
      if (s.status === 'live' && (s.category.includes('Sport') || s.category.includes('Basketball') || s.category.includes('Football') || s.category.includes('Combat') || s.category.includes('Golf') || s.category.includes('Motorsport') || s.category.includes('Tennis') || s.category.includes('Cricket') || s.category.includes('Rugby') || s.category.includes('Hockey') || s.category.includes('Baseball') || s.category.includes('MMA') || s.category.includes('Boxing') || s.category.includes('Soccer'))) {
        counts['Live Sports']++;
      }
      if (s.status === '24/7') counts['24/7 Channels']++;
      if (s.category === 'Entertainment & Movies') counts['Entertainment & Movies']++;
      if (s.category === 'News & Documentaries') counts['News & Documentaries']++;
    });
    return counts;
  }, [mergedStreams]);

  // Load stream sources on mount or stream change
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingSources(true);

    streamService
      .resolveStreamSources(stream)
      .then((resolved) => {
        if (!isCancelled) {
          setSources(resolved);
          setActiveSourceIndex(0);
          setIsLoadingSources(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setIsLoadingSources(false);
        }
      });


    return () => {
      isCancelled = true;
    };
  }, [stream]);





  const activeEmbedUrl =
    sources[activeSourceIndex]?.embedUrl ||
    stream.directEmbedUrl ||
    '';

  // Nothing to play — show a proper message instead of an empty video frame.
  const hasPlayableSource = Boolean(activeEmbedUrl);



  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeEmbedUrl);
    onShowToast('Stream embed link copied to clipboard!', 'success');
  };

  const handleRefreshStream = () => {
    setIframeKey((prev) => prev + 1);
    setPlayerError(false);
    onShowToast('Reloading video player feed...', 'info');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 py-4 animate-in fade-in duration-200">
      {/* Top back breadcrumb */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm font-bold text-slate-300 hover:text-blue-400 transition-colors"
        >
          <span className="text-slate-400">←</span>
          <span>Back to All Channels &amp; Streams</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTheaterMode(!isTheaterMode)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-sm text-slate-300 hover:text-white border border-slate-700 transition-colors font-medium"
            title="Toggle Theater / Cinema Mode"
          >
            {isTheaterMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isTheaterMode ? 'Standard View' : 'Theater Cinema'}</span>
          </button>
        </div>
      </div>

      {/* Player Area — full width */}
      <div className="flex flex-col gap-4">
        {/* Player + TV Guide overlay container */}
        <div className="relative">
          {/* TV Guide Overlay Panel */}
          {isGuideOpen && (
            <div className="absolute left-0 top-0 h-full z-20 flex flex-col bg-[#050810]/40 backdrop-blur-sm border-r border-white/10 rounded-l-xl overflow-hidden" style={{ width: '30%' }}>
              {/* Guide Header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/20 bg-black/40 shrink-0">
                <div className="w-5 h-5 rounded bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center flex-shrink-0">
                  <Radio className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-black tracking-[0.2em] text-white flex-1 truncate">TV GUIDE</span>
                <span className="text-[9px] text-white/60">{filteredChannels.length} ch</span>
                <button
                  onClick={() => setIsGuideOpen(false)}
                  className="p-1 rounded hover:bg-white/20 text-white transition-colors"
                  title="Close guide"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Search + Category Tabs */}
              <div className="px-3 py-2 border-b border-white/10 bg-black/20 space-y-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/60" />
                  <input
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); }}
                    placeholder="Search channels..."
                    className="w-full bg-white/10 border border-white/20 rounded-md pl-7 pr-2.5 py-1.5 text-[11px] text-white placeholder-white/40 outline-none focus:border-white/40"
                  />
                </div>
                <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                  {groups.map((group) => (
                    <button
                      key={group}
                      onClick={() => setSelectedGroup(group)}
                      className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap transition-colors ${
                        selectedGroup === group ? 'bg-red-600 text-white' : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/20'
                      }`}
                    >
                      {group === 'Live Sports' && '⚡ '}
                      {group === '24/7 Channels' && '📺 '}
                      {group === 'IPTV' && '📡 '}
                      {group === 'Smutt' && '🔥 '}
                      {group}
                      <span className={`ml-0.5 text-[9px] ${selectedGroup === group ? 'text-white/70' : 'text-white/40'}`}>
                        {groupCounts[group] || 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Channel List */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {filteredChannels.length === 0 && (
                  <div className="p-4 text-center text-xs text-white/50">No channels found</div>
                )}
                {filteredChannels.map((item, idx) => {
                  const isCurrent = item.id === stream.id;
                  const liveBadge = item.status === 'live' || item.status === '24/7';
                  return (
                    <button
                      key={item.id}
                      onClick={() => !isCurrent && onPlayStream(item)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-2 border-l-2 transition-all ${
                        isCurrent ? 'bg-red-600/40 border-l-red-400' : 'border-l-transparent hover:bg-white/10'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        item.status === 'live' ? 'bg-red-500 animate-pulse' :
                        item.status === '24/7' ? 'bg-blue-500' :
                        item.status === 'upcoming' ? 'bg-amber-500' : 'bg-slate-600'
                      }`} />
                      <div className="w-10 h-6 rounded bg-white/10 flex-shrink-0 overflow-hidden">
                        {item.poster ? (
                          <img src={item.poster} alt="" className="w-full h-full object-cover opacity-80" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px] text-white/40">
                            {(item.title || '?')[0]}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-medium truncate ${isCurrent ? 'text-white' : 'text-white/80'}`}>{item.title}</p>
                        <p className="text-[9px] text-white/50 truncate">
                          {item.provider === 'iptv' ? 'IPTV' : item.provider}
                        </p>
                      </div>
                      {liveBadge && (
                        <span className={`text-[8px] font-black px-1 py-0.5 rounded flex-shrink-0 ${
                          item.status === 'live' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                        }`}>
                          {item.status === '24/7' ? '24/7' : 'LIVE'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-3 py-1.5 border-t border-white/10 bg-black/20 text-[9px] text-white/40 flex items-center gap-2 shrink-0">
                <span>click to play</span>
              </div>
            </div>
          )}

          {/* Main Player Content */}
          <div className={`transition-all duration-300 ${isGuideOpen ? 'lg:pl-[30%]' : ''}`}>
            {/* Responsive 16:9 Video Canvas */}
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-slate-800/90 shadow-2xl">
              {isLoadingSources ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mb-3" />
                  <p className="text-sm font-medium text-slate-300">Connecting to stream feed...</p>
                  <p className="text-xs text-slate-500 mt-1 font-mono">Resolving live media gateway</p>
                </div>
              ) : !hasPlayableSource ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-center px-6">
                  <AlertCircle className="w-9 h-9 text-amber-500 mb-3" />
                  <p className="text-sm font-semibold text-white">No stream source available</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    &ldquo;{stream.title}&rdquo; has no playable feed right now. Pick another channel
                    from the list or go back to the guide.
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Back to channels
                  </button>
                </div>
              ) : (
                <VideoPlayer
                  key={iframeKey}
                  url={activeEmbedUrl}
                  title={stream.title}
                  streamType={stream.streamType}
                  autoPlay={true}
                  onRefresh={handleRefreshStream}
                  onTogglePiP={onTogglePiP}
                  onVideoEnd={onVideoEnd}
                />
              )}
            </div>
          </div>
        </div>


      </div>

      {/* Controls Row — Layer 1: buttons directly under player */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* TV Guide Toggle */}
        <button
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className={`h-12 rounded-xl flex items-center gap-2 transition-all touch-manipulation text-sm font-bold player-nav-btn ${
            isGuideOpen
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600'
          }`}
          title="Toggle TV Guide"
        >
          <Radio className="w-5 h-5" />
          <span>TV GUIDE</span>
        </button>

        {/* History Dropdown */}
        <div className="relative flex-1 min-w-[120px]">
          <button
            onClick={(e) => { e.stopPropagation(); setShowHistoryMenu((h) => !h); setShowFavMenu(false); }}
            className="w-full h-12 rounded-xl bg-red-600/90 hover:bg-red-500 active:bg-red-700 text-white flex items-center justify-between gap-2 transition-all shadow-lg shadow-red-600/30 touch-manipulation text-sm font-bold px-3 player-nav-btn dropdown-menu"
          >
            <div className="flex items-center gap-2">
              <HistoryIcon className="w-5 h-5 text-white" />
              <span>History</span>
            </div>
            <ChevronDownIcon className={`w-4 h-4 transition-transform ${showHistoryMenu ? 'rotate-180' : ''}`} />
          </button>
          {showHistoryMenu && (
            <div className="absolute z-50 bottom-full mb-1 left-0 right-0 bg-[#0f121a]/25 backdrop-blur-md rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden dropdown-menu">
              <div className="px-3 py-2 border-t border-slate-800 bg-slate-900/60 sticky bottom-0 z-10">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Recent History</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {watchHistory.length > 0 ? (
                  watchHistory.slice(0, 12).map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => {
                        if (onPlayHistoryItem) onPlayHistoryItem(entry);
                        setShowHistoryMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 transition-colors text-left"
                    >
                      <img
                        src={entry.poster || '/hero.png'}
                        alt=""
                        className="w-8 h-5 rounded object-cover shrink-0"
                        referrerPolicy="no-referrer"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/hero.png'; }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-white truncate">{entry.title}</p>
                        <span className="text-[10px] text-slate-500">{entry.category}</span>
                      </div>
                      <Clock className="w-3 h-3 text-slate-600 shrink-0" />
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center">
                    <HistoryIcon className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No watch history yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Favorites Dropdown */}
        <div className="relative flex-1 min-w-[120px]">
          <button
            onClick={(e) => { e.stopPropagation(); setShowFavMenu((f) => !f); setShowHistoryMenu(false); }}
            className="w-full h-12 rounded-xl bg-red-600/90 hover:bg-red-500 active:bg-red-700 text-white flex items-center justify-between gap-2 transition-all shadow-lg shadow-red-600/30 touch-manipulation text-sm font-bold px-3 player-nav-btn dropdown-menu"
          >
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-white" />
              <span>Favorites</span>
            </div>
            <ChevronDownIcon className={`w-4 h-4 transition-transform ${showFavMenu ? 'rotate-180' : ''}`} />
          </button>
          {showFavMenu && (
            <div className="absolute z-50 bottom-full mb-1 left-0 right-0 bg-[#0f121a]/25 backdrop-blur-md rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden dropdown-menu">
              <div className="px-3 py-2 border-t border-slate-800 bg-slate-900/60 sticky bottom-0 z-10">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Favorited Channels</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {watchlistStreams.length > 0 ? (
                  watchlistStreams.slice(0, 12).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { onPlayStream(s); setShowFavMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 transition-colors text-left"
                    >
                      <img
                        src={s.poster || '/hero.png'}
                        alt=""
                        className="w-8 h-5 rounded object-cover shrink-0"
                        referrerPolicy="no-referrer"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/hero.png'; }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-white truncate">{s.title}</p>
                        <span className="text-[10px] text-slate-500">{s.category}</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center">
                    <Star className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No favorites yet</p>
                    <p className="text-[10px] text-slate-600 mt-1">Tap ★ on any channel</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* LAST CH + NEXT CH — 50% less wide, side by side */}
        <div className="flex gap-2 ml-auto shrink-0">
          <button
            onClick={() => {
              const list = activePlaylist;
              const idx = list.findIndex((s) => s.id === stream.id);
              const prev = idx > 0 ? list[idx - 1] : list[list.length - 1];
              if (prev) onPlayStream(prev);
            }}
            className="w-24 sm:w-28 h-12 rounded-xl bg-blue-600/90 hover:bg-blue-500 active:bg-blue-700 text-white flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-blue-600/30 touch-manipulation text-xs font-bold player-nav-btn"
            title="Previous channel"
          >
            <ChevronUp className="w-4 h-4 shrink-0" />
            <span>LAST CH</span>
          </button>
          <button
            onClick={() => {
              const list = activePlaylist;
              const idx = list.findIndex((s) => s.id === stream.id);
              const next = idx < list.length - 1 ? list[idx + 1] : list[0];
              if (next) onPlayStream(next);
            }}
            className="w-24 sm:w-28 h-12 rounded-xl bg-blue-600/90 hover:bg-blue-500 active:bg-blue-700 text-white flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-blue-600/30 touch-manipulation text-xs font-bold player-nav-btn"
            title="Next channel"
          >
            <span>NEXT CH</span>
            <ChevronDown className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>
      {/* Sources Toolbar */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 bg-[#0f121a] p-3 rounded-xl border border-slate-800/80">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs text-slate-400 font-mono uppercase tracking-wider shrink-0 mr-1">Sources:</span>
          {sources.map((src, idx) => (
            <button
              key={idx}
              onClick={() => setActiveSourceIndex(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeSourceIndex === idx
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {src.name || `Stream ${idx + 1}`} {src.hd ? 'HD' : ''}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshStream}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
            title="Reload Stream Player"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => onTogglePiP?.(stream, activeEmbedUrl)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors"
            title="Picture-in-Picture"
          >
            <PictureInPicture2 className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">PiP</span>
          </button>

          <button
            onClick={() => onAddToMultiview(stream)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isInMultiview
                ? 'bg-blue-950/80 border-blue-700 text-blue-300'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
            }`}
            title="Watch in Multiview"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
            <span>{isInMultiview ? 'In MV' : 'MV'}</span>
          </button>

          <button
            onClick={() => onToggleWatchlist(stream)}
            className={`p-2 rounded-lg border transition-colors ${
              isInWatchlist
                ? 'bg-blue-950/80 border-blue-700 text-blue-400'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title={isInWatchlist ? 'Saved to Watchlist' : 'Save to Watchlist'}
          >
            <Bookmark className={`w-4 h-4 ${isInWatchlist ? 'fill-blue-400' : ''}`} />
          </button>

          <button
            onClick={handleCopyLink}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
            title="Copy Stream Link"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};