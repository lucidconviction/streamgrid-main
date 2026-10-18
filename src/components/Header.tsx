import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Search, Star, X, Trash2, Bookmark, Zap } from 'lucide-react';
import { StreamItem } from '../types/stream';
import { storageService } from '../services/storageService';
import Hls from 'hls.js';

interface HeaderProps {
  onNavigate: (view: string) => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  liveStreams: StreamItem[];
  onPlayStream: (stream: StreamItem) => void;
  currentPage?: string;
  onSearch?: (query: string) => void;
  savedSearches?: string[];
  activeProfileId?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  onToggleSidebar,
  sidebarOpen,
  liveStreams,
  onPlayStream,
  currentPage,
  onSearch,
  savedSearches = [],
  activeProfileId = 'profile-alex',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [currentBgStream, setCurrentBgStream] = useState<StreamItem | null>(null);
  const [bgReady, setBgReady] = useState(false);
  const [bgScrolled, setBgScrolled] = useState(false);
  const [pageDropdownOpen, setPageDropdownOpen] = useState(false);
  const pageDropdownRef = useRef<HTMLDivElement>(null);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState('');

  const VIEW_LABELS: Record<string, string> = {
    home: 'Explore',
    sports: 'Live Sports',
    channels: '24/7 Channels',
    iptv: 'IPTV Playlists',
    music: 'Music',
    multiview: 'Multiview',
    history: 'Watch History',
    watchlist: 'Watchlist',
    smutt: 'Nett Smutt',
  };

  // ── Header background player ─────────────────────────────────────────
  // Pick ONE stream and play it. No rotation. No switching. Simple.

  // Pick the best available stream for background
  const pickBgStream = useCallback(() => {
    // Only use bgVideoUrl (raw HLS/direct video) — embed URLs can't play in <video>
    const withVideo = liveStreams.filter((s) => s.bgVideoUrl && s.status === 'live');
    if (withVideo.length > 0) return withVideo[0];
    return liveStreams[0] || null;
  }, [liveStreams]);

  // Set up the background player for a given stream
  const setupBgPlayer = useCallback((stream: StreamItem) => {
    // Only use bgVideoUrl (raw HLS/video) — embed URLs can't play in <video>
    const url = stream.bgVideoUrl || '';
    if (!url) { setBgReady(true); return; }

    const isHls = url.includes('.m3u8') || url.includes('.ts');
    const video = videoRef.current;
    if (!video) { setBgReady(true); return; }

    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    video.pause();
    video.removeAttribute('src');
    video.load();
    video.muted = true;
    video.volume = 0;

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 16,
        maxMaxBufferLength: 32,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
        setBgReady(true);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal && hlsRef.current) {
          hls.destroy();
          hlsRef.current = null;
          setTimeout(() => {
            const next = pickBgStream();
            if (next && next.id !== stream.id) {
              setCurrentBgStream(next);
              setupBgPlayer(next);
            }
          }, 5000);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play().catch(() => {}).finally(() => setBgReady(true));
    } else {
      video.src = url;
      video.play().catch(() => {}).finally(() => setBgReady(true));
    }
  }, [pickBgStream]);

  // Start playing when streams load
  useEffect(() => {
    if (liveStreams.length === 0) return;
    const stream = pickBgStream();
    if (stream) {
      setCurrentBgStream(stream);
      setupBgPlayer(stream);
    }
    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [liveStreams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pageDropdownRef.current && !pageDropdownRef.current.contains(e.target as Node)) {
        setPageDropdownOpen(false);
      }
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Hide bg video when user scrolls down, show when at top
  useEffect(() => {
    const onScroll = () => setBgScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSaveSearch = () => {
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    storageService.addSavedSearch(activeProfileId, trimmed);
    // Multi-keyword: split by comma and search each, showing merged results
    const queries = trimmed.split(',').map((q) => q.trim()).filter(Boolean);
    if (queries.length === 1) {
      if (onSearch) onSearch(queries[0]);
    } else {
      // Combine all for a single search that returns results for each
      if (onSearch) onSearch(trimmed);
    }
    setSearchInput('');
    setSearchDropdownOpen(false);
  };

  const handleLoadSearch = (query: string) => {
    // Support comma-separated keywords
    const queries = query.split(',').map((q) => q.trim()).filter(Boolean);
    if (queries.length === 1 && onSearch) {
      onSearch(queries[0]);
    } else {
      // Multi-keyword: show the combined query
      if (onSearch) onSearch(query);
    }
    setSearchDropdownOpen(false);
  };

  const handleRemoveSearch = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    storageService.removeSavedSearch(activeProfileId, query);
  };

  return (
    <>
      {/* Background Live Stream Player — fills header, hidden on scroll */}
      <div className="fixed top-0 left-0 right-0 z-0 pointer-events-none transition-opacity duration-300" style={{ height: 'var(--header-height, 65px)', overflow: 'hidden' }}>
        {/* Video is 2× header height so object-cover always covers width without borders */}
        <video
          ref={videoRef}
          className="w-full h-[130px] object-cover opacity-55"
          muted
          playsInline
          autoPlay
          loop
          preload="auto"
        />
        {/* Gradient overlay — clipped to header bounds */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050810]/45 via-[#050810]/30 to-[#050810]/45" />
        {!bgReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-blue-500/60 border-t-blue-400/80 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Header Bar */}
      <header className="sticky top-0 z-50 w-full glass-panel border-b border-blue-500/20 transition-colors" style={{ height: 'var(--header-height, 65px)' }}>
        <div className="flex items-center justify-between gap-4 px-3 sm:px-4" style={{ height: 'var(--header-height, 65px)' }}>
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2 text-left group focus:outline-none"
            >
              <img
                src="/src/assets/images/logo.png"
                alt="RdNutz TV"
                className="w-8 h-8 rounded-lg object-contain shadow-md shadow-blue-500/30"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div
                className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-sky-400 flex items-center justify-center text-white shadow-md shadow-blue-500/30 neon-glow-blue"
                style={{ display: 'none' }}
              >
                <span className="text-sm font-bold">R</span>
              </div>
              <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
                <span className="text-yellow-400">RdNutz</span>
                <span className="text-orange-400">TV</span>
                <span className="text-slate-400 text-sm font-medium ml-0.5">Streams</span>
              </span>
            </button>
          </div>

          {/* Right: Saved Searches + Page Dropdown + Sidebar Toggle */}
          <div className="flex items-center gap-2">
            {/* Saved Searches Dropdown */}
            <div className="relative" ref={searchDropdownRef}>
              <button
                onClick={() => setSearchDropdownOpen(!searchDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-11 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition-colors touch-manipulation"
                title="Saved Searches"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Searches</span>
                <span className="sm:hidden">🔍</span>
                {searchDropdownOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {searchDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-44 bg-[#0f172a]/92 backdrop-blur-2xl border border-blue-500/25 rounded-2xl shadow-2xl shadow-blue-900/50 z-50 overflow-hidden animate-slideDown">
                  {/* Top: Save Input */}
                  <div className="p-3 border-b border-blue-500/20 bg-gradient-to-r from-blue-950/40 to-transparent">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Zap className="w-3.5 h-3.5 text-blue-400" />
                      <p className="text-[9px] font-mono uppercase tracking-widest text-blue-300">
                        Save
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveSearch();
                        }}
                        placeholder="Press Enter..."
                        autoFocus
                        className="flex-1 bg-slate-900/80 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 transition-colors"
                      />
                      <button
                        onClick={handleSaveSearch}
                        disabled={!searchInput.trim()}
                        className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all touch-manipulation hover:scale-105 active:scale-95"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom: Saved List */}
                  <div className="max-h-56 overflow-y-auto no-scrollbar">
                    {savedSearches.length === 0 ? (
                      <div className="p-5 text-center">
                        <Bookmark className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">No saves yet</p>
                        <p className="text-[9px] text-slate-600 mt-0.5">Type + Enter to save</p>
                      </div>
                    ) : (
                      <div className="p-1.5">
                        <div className="flex items-center justify-between px-2 pb-1.5 mb-1">
                          <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
                            {savedSearches.length} Saved
                          </span>
                          <button
                            onClick={() => storageService.clearSavedSearches(activeProfileId)}
                            className="text-[9px] text-slate-600 hover:text-red-400 transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="space-y-0.5">
                          {savedSearches.map((query, i) => (
                            <div key={i} className="group flex items-center rounded-lg transition-all hover:bg-blue-500/10">
                              <button
                                onClick={() => handleLoadSearch(query)}
                                className="flex-1 flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 text-left touch-manipulation"
                              >
                                <Search className="w-3.5 h-3.5 text-blue-400 shrink-0 group-hover:text-blue-300 transition-colors" />
                                <span className="text-xs text-slate-300 group-hover:text-white truncate">
                                  {query}
                                </span>
                              </button>
                              <button
                                onClick={(e) => handleRemoveSearch(e, query)}
                                className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all touch-manipulation"
                                title="Remove"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Page Selector Dropdown */}
            <div className="relative" ref={pageDropdownRef}>
              <button
                onClick={() => setPageDropdownOpen(!pageDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-11 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition-colors touch-manipulation"
              >
                <span className="hidden sm:inline">{VIEW_LABELS[currentPage || 'home']}</span>
                <span className="sm:hidden">{(VIEW_LABELS[currentPage || 'home'] || 'Home').charAt(0)}</span>
                {pageDropdownOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {pageDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-[#12151e] border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-1.5">
                    {Object.entries(VIEW_LABELS).map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => { onNavigate(id); setPageDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-3 min-h-11 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                          currentPage === id
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onToggleSidebar}
              className={`min-h-11 min-w-11 p-2 rounded-lg transition-colors touch-manipulation ${
                sidebarOpen
                  ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
