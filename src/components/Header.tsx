import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Search, X, Zap, Flame, Flame as QuickJumpIcon, Youtube, Compass, Radio, Tv, Layers, Music, History, Bookmark, LayoutGrid } from 'lucide-react';
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
  activeProfileId?: string;
  onQuickJump?: (jump: { keywords: string[]; targetView: string }) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  onToggleSidebar,
  sidebarOpen,
  liveStreams,
  onPlayStream,
  currentPage,
  onSearch,
  activeProfileId = 'profile-alex',
  onQuickJump,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [currentBgStream, setCurrentBgStream] = useState<StreamItem | null>(null);
  const [bgReady, setBgReady] = useState(false);
  const [pageDropdownOpen, setPageDropdownOpen] = useState(false);
  const pageDropdownRef = useRef<HTMLDivElement>(null);
  const [qjOpen, setQjOpen] = useState(false);
  const qjRef = useRef<HTMLDivElement>(null);
  const quickJumps = storageService.getQuickJumps(activeProfileId);
  // Add form state
  const [qjAddMode, setQjAddMode] = useState(false);
  const [qjNewLabel, setQjNewLabel] = useState('');
  const [qjNewKeywords, setQjNewKeywords] = useState('');
  const [qjNewTarget, setQjNewTarget] = useState(currentPage || 'home');

  const VIEW_LABELS: Record<string, string> = {
    home: 'Explore',
    sports: 'Live Sports',
    youtube: 'Stream Hub',
    channels: '24/7 Channels',
    iptv: 'IPTV Playlists',
    music: 'Music',
    multiview: 'Multiview',
    history: 'Watch History',
    watchlist: 'Watchlist',
    smutt: 'Nett Smutt',
  };

  const VIEW_ICONS: Record<string, React.ReactNode> = {
    home: <Compass className="w-4 h-4" />,
    sports: <Radio className="w-4 h-4" />,
    youtube: <Youtube className="w-4 h-4" />,
    channels: <Tv className="w-4 h-4" />,
    iptv: <Layers className="w-4 h-4" />,
    music: <Music className="w-4 h-4" />,
    history: <History className="w-4 h-4" />,
    watchlist: <Bookmark className="w-4 h-4" />,
    multiview: <LayoutGrid className="w-4 h-4" />,
    smutt: <Flame className="w-4 h-4" />,
  };

  // ── Header background player ─────────────────────────────────────────
  // Pick ONE stream and play it. No rotation. No switching. Simple.

  // Pick the best available stream for background
  const pickBgStream = useCallback(() => {
    // Only use bgVideoUrl (raw HLS/direct video) — embed URLs can't play in <video>
    const withVideo = liveStreams.filter((s) => s.bgVideoUrl && s.status === 'live');
    if (withVideo.length > 0) return withVideo[0];
    // Fallback: any stream with bgVideoUrl regardless of status
    const anyWithVideo = liveStreams.filter((s) => s.bgVideoUrl);
    if (anyWithVideo.length > 0) return anyWithVideo[0];
    return null;
  }, [liveStreams]);

  // Set up the background player for a given stream
  const setupBgPlayer = useCallback((stream: StreamItem) => {
    const url = stream.bgVideoUrl || '';
    const video = videoRef.current;
    if (!video) { setBgReady(true); return; }

    // If no video URL, fall back to poster image
    if (!url) {
      if (stream.poster) {
        video.removeAttribute('src');
        video.style.backgroundImage = `url(${stream.poster})`;
        video.style.backgroundSize = 'cover';
        video.style.backgroundPosition = 'center';
      }
      setBgReady(true);
      return;
    }

    // Clear any poster fallback
    video.style.backgroundImage = '';

    const isHls = url.includes('.m3u8') || url.includes('.ts');

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
    if (stream && stream.id !== currentBgStream?.id) {
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
      if (qjRef.current && !qjRef.current.contains(e.target as Node)) {
        setQjOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Hide bg video when user scrolls down, show when at top
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const el = document.querySelector('.bg-video-container') as HTMLElement | null;
          if (el) el.style.opacity = window.scrollY > 10 ? '0' : '1';
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* Background Live Stream Player — fills header, hidden on scroll */}
      <div className="bg-video-container fixed top-0 left-0 right-0 z-0 pointer-events-none transition-opacity duration-300" style={{ height: 'var(--header-height, 65px)', overflow: 'hidden' }}>
        {/* Video is 2× header height so object-cover always covers width without borders */}
        <video
          ref={videoRef}
          className="w-full h-[130px] object-cover opacity-55 bg-center bg-cover"
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
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4" style={{ height: 'var(--header-height, 65px)' }}>
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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
              <span className="text-base sm:text-[13px] font-bold tracking-tight text-white whitespace-nowrap">
                <span className="text-yellow-400">RdNutz</span>
                <span className="text-orange-400">TV</span>
                <span className="text-slate-400 text-xs sm:text-sm font-medium ml-0.5 hidden sm:inline">Streams</span>
              </span>
            </button>
          </div>

          {/* Right: Quick Search + Page Dropdown + Sidebar Toggle */}
          <div className="flex items-center gap-2">
            {/* Quick Search Dropdown (replaces Saved Searches) */}
            <div className="relative" ref={qjRef}>
              <button
                onClick={() => setQjOpen(!qjOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-11 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition-colors touch-manipulation"
                title="Quick Jumps"
              >
                <QuickJumpIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Quick Search</span>
                {quickJumps.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-600/30 text-blue-400 text-[10px] font-black">
                    {quickJumps.length}
                  </span>
                )}
                {qjOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {qjOpen && (
                <div className="absolute top-full right-0 mt-2 w-60 bg-[#0f172a]/95 backdrop-blur-2xl border border-blue-500/25 rounded-2xl shadow-2xl shadow-blue-900/50 z-50 overflow-hidden animate-slideDown">
                  <div className="p-3 border-b border-blue-500/20 bg-gradient-to-r from-blue-950/40 to-transparent">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <QuickJumpIcon className="w-3.5 h-3.5 text-blue-400" />
                        <p className="text-[9px] font-mono uppercase tracking-widest text-blue-300">Quick Jumps</p>
                      </div>
                      {!qjAddMode && (
                        <button
                          onClick={() => setQjAddMode(true)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white hover:bg-blue-500/20 transition-colors"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>

                    {qjAddMode ? (
                      /* ── Add Form ── */
                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          value={qjNewLabel}
                          onChange={(e) => setQjNewLabel(e.target.value)}
                          placeholder="Label (e.g. My Artists)"
                          autoFocus
                          className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
                        />
                        <input
                          type="text"
                          value={qjNewKeywords}
                          onChange={(e) => setQjNewKeywords(e.target.value)}
                          placeholder="Keywords (comma-separated)"
                          className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
                        />
                        <select
                          value={qjNewTarget}
                          onChange={(e) => setQjNewTarget(e.target.value)}
                          className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/60 appearance-none"
                        >
                          <option value="__global__">🌐 Global Search (all jumps)</option>
                          {Object.entries(VIEW_LABELS).map(([id, label]) => (
                            <option key={id} value={id}>{label}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => {
                              const label = qjNewLabel.trim();
                              const kws = qjNewKeywords.split(',').map((k) => k.trim()).filter(Boolean);
                              if (!label || kws.length === 0) return;
                              storageService.addQuickJump(activeProfileId, label, kws, qjNewTarget);
                              setQjNewLabel('');
                              setQjNewKeywords('');
                              setQjNewTarget(currentPage || 'home');
                              setQjAddMode(false);
                            }}
                            disabled={!qjNewLabel.trim() || !qjNewKeywords.trim()}
                            className="flex-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-bold rounded-lg transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setQjAddMode(false); setQjNewLabel(''); setQjNewKeywords(''); }}
                            className="px-2.5 py-1.5 text-[10px] text-slate-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : quickJumps.length === 0 ? (
                      <div className="py-4 text-center">
                        <p className="text-[10px] text-slate-500 mb-2">No jumps saved yet</p>
                        <button
                          onClick={() => setQjAddMode(true)}
                          className="text-[10px] text-blue-400 hover:text-blue-300 font-bold"
                        >
                          + Add your first jump
                        </button>
                      </div>
                    ) : (
                      /* ── Jump List ── */
                      <div className="max-h-52 overflow-y-auto no-scrollbar space-y-0.5">
                        {/* ── Global Search (3rd option) ── */}
                        {quickJumps.length > 0 && (
                          <button
                            onClick={() => {
                              onSearch?.(''); // empty query → show ALL available streams
                              setQjOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left bg-gradient-to-r from-blue-600/20 to-purple-600/10 hover:from-blue-600/30 hover:to-purple-600/20 border border-blue-500/30 transition-colors group"
                          >
                            <Search className="w-4 h-4 text-blue-400 shrink-0 group-hover:text-blue-300" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-white group-hover:text-blue-200 truncate">
                                Global Search
                              </p>
                              <p className="text-[9px] text-slate-400 truncate">
                                Browse every stream across all sections
                              </p>
                            </div>
                            <span className="text-[9px] font-mono text-blue-400/70 shrink-0">ALL</span>
                          </button>
                        )}
                        {quickJumps.map((jump) => (
                          <div key={jump.id} className="group flex items-center gap-1">
                            <button
                              onClick={() => {
                                if (jump.targetView === '__global__') {
                                  onSearch?.(''); // empty query → show all streams
                                } else {
                                  onQuickJump?.(jump);
                                }
                                setQjOpen(false);
                              }}
                              className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-blue-500/10 transition-colors"
                            >
                              {jump.targetView === '__global__' ? (
                                <Search className="w-3.5 h-3.5 text-purple-400 shrink-0 group-hover:text-purple-300" />
                              ) : (
                                <QuickJumpIcon className="w-3.5 h-3.5 text-blue-400 shrink-0 group-hover:text-blue-300" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-slate-200 group-hover:text-white truncate">{jump.label}</p>
                                <p className="text-[9px] text-slate-500 truncate">{jump.keywords.slice(0, 2).join(', ')}</p>
                              </div>
                              <span className="text-[9px] font-mono text-slate-600 group-hover:text-slate-400 shrink-0">
                                {jump.targetView === '__global__' ? 'GLOBAL' : (VIEW_LABELS[jump.targetView] || jump.targetView)}
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                storageService.removeQuickJump(activeProfileId, jump.id);
                              }}
                              className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                              title="Delete"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setQjAddMode(true)}
                          className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 text-[10px] font-bold text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors mt-1"
                        >
                          <Zap className="w-3 h-3" />
                          Add Jump
                        </button>
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
                {VIEW_ICONS[currentPage || 'home']}
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
                        className={`w-full text-left px-4 py-3 min-h-11 rounded-lg text-sm font-medium transition-colors touch-manipulation flex items-center gap-2.5 ${
                          currentPage === id
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {VIEW_ICONS[id]}
                        <span>{label}</span>
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
