import React, { useState, useEffect, useCallback } from 'react';
import { Tv, Search, Filter, Radio, RefreshCw, Play, Shuffle, Bookmark, Eye, LayoutGrid, Star } from 'lucide-react';
import Hls from 'hls.js';
import { isEmbedPlayerUrl } from '../services/embedUrls';
import { StreamItem } from '../types/stream';
import { StreamCard } from './StreamCard';

// ── Stream validation cache ───────────────────────────────────────────────
// ── Stream validation cache (URL → bool) ──────────────────────────────────
// Uses localStorage to persist across page reloads — saves ~5-10s on return visits
const LS_KEY = 'sg_hero_validated_channels';
const HERO_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface HeroCacheEntry {
  timestamp: number;
  urls: Record<string, boolean>; // url → isAlive
}

function loadHeroCache(): HeroCacheEntry | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as HeroCacheEntry;
    if (Date.now() - entry.timestamp > HERO_CACHE_TTL) {
      localStorage.removeItem(LS_KEY);
      return null;
    }
    return entry;
  } catch { return null; }
}

function saveHeroCache(entry: HeroCacheEntry): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(entry)); } catch {}
}

// In-memory supplement for the current session
const heroUrlCache = new Map<string, boolean>();
const heroCacheTimes = new Map<string, number>();

async function testStreamAlive(url: string): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;
  // Check in-memory cache first
  const memCached = heroUrlCache.get(url);
  const memCachedAt = heroCacheTimes.get(url) ?? 0;
  if (memCached !== undefined && Date.now() - memCachedAt < HERO_CACHE_TTL) return memCached;
  // Check localStorage cache
  const lsEntry = loadHeroCache();
  if (lsEntry?.urls[url] !== undefined) {
    heroUrlCache.set(url, lsEntry.urls[url]);
    heroCacheTimes.set(url, lsEntry.timestamp);
    return lsEntry.urls[url];
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(url, { method: 'HEAD', signal: controller.signal, mode: 'no-cors' });
    clearTimeout(timer);
    const alive = resp.ok || resp.status === 0;
    heroUrlCache.set(url, alive);
    heroCacheTimes.set(url, Date.now());
    // Save to localStorage in background
    void saveHeroCache({ timestamp: Date.now(), urls: { [url]: alive, ...(lsEntry?.urls ?? {}) } });
    return alive;
  } catch {
    heroUrlCache.set(url, false);
    heroCacheTimes.set(url, Date.now());
    void saveHeroCache({ timestamp: Date.now(), urls: { [url]: false, ...(lsEntry?.urls ?? {}) } });
    return false;
  }
}

function collectCandidateUrls(streams: StreamItem[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const s of streams) {
    for (const key of ['directEmbedUrl', 'bgVideoUrl'] as const) {
      const url = s[key];
      if (!url || seen.has(url)) continue;
      seen.add(url);
      if (isEmbedPlayerUrl(url)) continue;
      urls.push(url);
    }
  }
  return urls;
}

async function validateHeroStreams(streams: StreamItem[]): Promise<StreamItem[]> {
  const candidateUrls = collectCandidateUrls(streams);
  if (candidateUrls.length === 0) return [];
  // Preload localStorage cache into memory
  const lsEntry = loadHeroCache();
  if (lsEntry) {
    for (const [url, alive] of Object.entries(lsEntry.urls)) {
      heroUrlCache.set(url, alive);
      heroCacheTimes.set(url, lsEntry.timestamp);
    }
  }
  // Only test URLs not already cached
  const uncached = candidateUrls.filter(u => !heroUrlCache.has(u));
  const tests = uncached.length > 0
    ? await Promise.allSettled(uncached.map(url => testStreamAlive(url)))
    : Array(uncached.length).fill({ status: 'fulfilled', value: true });
  const aliveUrls = new Set<string>();
  candidateUrls.forEach(url => {
    if (heroUrlCache.get(url)) aliveUrls.add(url);
  });
  return streams.filter(s => {
    for (const key of ['directEmbedUrl', 'bgVideoUrl'] as const) {
      if (aliveUrls.has(s[key] ?? '')) return true;
    }
    return false;
  });
}

interface ChannelDirectoryProps {
  title: string;
  subtitle: string;
  streams: StreamItem[];
  onPlayStream: (stream: StreamItem) => void;
  onAddToMultiview: (stream: StreamItem) => void;
  onToggleWatchlist: (stream: StreamItem) => void;
  onTogglePiP?: (stream: StreamItem) => void;
  watchlistIds: string[];
  multiviewStreamIds: string[];
  initialCategory?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  showHero?: boolean;
}

export const ChannelDirectory: React.FC<ChannelDirectoryProps> = ({
  title,
  subtitle,
  streams,
  onPlayStream,
  onAddToMultiview,
  onToggleWatchlist,
  onTogglePiP,
  watchlistIds,
  multiviewStreamIds,
  initialCategory = 'All',
  onRefresh,
  isRefreshing,
  showHero = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [search, setSearch] = useState('');
  const [screenshotUrls, setScreenshotUrls] = useState<Map<string, string | null>>(new Map());

  // Hero banner state for random stream
  const [heroStream, setHeroStream] = useState<StreamItem | null>(null);
  const [heroVideoError, setHeroVideoError] = useState(false);
  const heroVideoRef = React.useRef<HTMLVideoElement>(null);
  const heroHlsRef = React.useRef<Hls | null>(null);
  const [heroPosterSrc, setHeroPosterSrc] = useState('');

  const pickRandomHero = useCallback(async () => {
    const candidates = streams.filter((s) => s.status === 'live' || s.status === '24/7' || s.directEmbedUrl);
    if (candidates.length === 0) return;
    try {
      const working = await validateHeroStreams(candidates);
      if (working.length === 0) {
        const fallback = candidates.find((s) => s.directEmbedUrl || s.bgVideoUrl);
        if (fallback) { setHeroStream(fallback); setHeroVideoError(false); }
        return;
      }
      const random = working[Math.floor(Math.random() * working.length)];
      setHeroStream(random);
      setHeroVideoError(false);
    } catch {
      const fallback = candidates.find((s) => s.directEmbedUrl || s.bgVideoUrl);
      if (fallback) { setHeroStream(fallback); setHeroVideoError(false); }
    }
  }, [streams]);

  // Pick a random stream for the hero — tries to play, falls back to poster on error
  React.useEffect(() => {
    if (!streams.length) return;
    const candidates = streams.filter((s) => s.directEmbedUrl || s.bgVideoUrl);
    if (candidates.length === 0) return;
    // Use cached results if available, otherwise just pick randomly
    const cachedEntry = loadHeroCache();
    const cachedWorking = cachedEntry
      ? candidates.filter(s => {
          for (const key of ['directEmbedUrl', 'bgVideoUrl'] as const) {
            if (cachedEntry.urls[s[key] ?? '']) return true;
          }
          return false;
        })
      : [];
    if (cachedWorking.length > 0) {
      const random = cachedWorking[Math.floor(Math.random() * cachedWorking.length)];
      setHeroStream(random);
      setHeroVideoError(false);
      return;
    }
    // No cache — pick a random candidate immediately, don't wait for HEAD checks
    const random = candidates[Math.floor(Math.random() * candidates.length)];
    setHeroStream(random);
    setHeroVideoError(false);
    // Run background validation for future reloads
    void validateHeroStreams(candidates);
  }, [streams.length]);

  // Cleanup HLS on unmount
  React.useEffect(() => {
    return () => {
      if (heroHlsRef.current) {
        heroHlsRef.current.destroy();
        heroHlsRef.current = null;
      }
    };
  }, []);

  // Setup hero video player
  React.useEffect(() => {
    if (!heroStream || heroVideoError) {
      setHeroVideoError(false);
      return;
    }
    const url = heroStream.bgVideoUrl || heroStream.directEmbedUrl || '';
    if (!url) {
      setHeroPosterSrc(heroStream.poster || '');
      return;
    }
    const isEmbed = isEmbedPlayerUrl(url, heroStream.streamType);
    if (isEmbed) {
      setHeroPosterSrc(heroStream.poster || '');
      return;
    }
    setHeroPosterSrc(heroStream.poster || '');
    setHeroVideoError(false);
    if (heroHlsRef.current) {
      heroHlsRef.current.destroy();
      heroHlsRef.current = null;
    }
    const video = heroVideoRef.current;
    if (!video) return;
    const isHls = url.includes('.m3u8') || url.includes('.ts');
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
      heroHlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.muted = true;
        video.play().catch(() => setHeroVideoError(true));
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) { setHeroVideoError(true); hls.destroy(); heroHlsRef.current = null; }
      });
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        video.muted = true;
        video.play().catch(() => setHeroVideoError(true));
      });
    } else {
      video.src = url;
      video.addEventListener('loadeddata', () => {
        video.muted = true;
        video.play().catch(() => setHeroVideoError(true));
      });
      video.addEventListener('error', () => setHeroVideoError(true));
    }
  }, [heroStream?.id]);

  const heroInWatchlist = heroStream ? watchlistIds.includes(heroStream.id) : false;

  // Extract unique categories from streams
  const categories = [
    'All',
    'Live Sports',
    '24/7 Channels',
    'Basketball',
    'Football / Soccer',
    'Entertainment & Movies',
    'News & Documentaries',
    'Motorsport / F1',
    'Tennis',
    'Golf',
  ];

  const filtered = streams.filter((s) => {
    const matchesCat =
      selectedCategory === 'All' ||
      s.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
      (selectedCategory === '24/7 Channels' && s.status === '24/7');

    const matchesSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase()) ||
      (s.name && s.name.toLowerCase().includes(search.toLowerCase()));

    return matchesCat && matchesSearch;
  });

  // Use remote screenshot service for instant display (no HLS instances created)
  // Only fetch once on mount, cache results in state to prevent flickering
  useEffect(() => {
    const iptvStreams = streams.filter((s) => s.provider === 'iptv' && s.directEmbedUrl);
    if (iptvStreams.length === 0) return;

    const newUrls = new Map(screenshotUrls);
    iptvStreams.slice(0, 30).forEach((stream) => {
      if (newUrls.has(stream.id)) return;
      const url = stream.directEmbedUrl!.startsWith('http')
        ? stream.directEmbedUrl!
        : `${window.location.origin}${stream.directEmbedUrl!}`;
      newUrls.set(stream.id, `https://image.thum.io/get/maxage/7200/width/320/fail/${encodeURIComponent(url)}`);
    });
    setScreenshotUrls(new Map(newUrls));
  }, []); // Run once on mount only

  return (
    <div className="w-full animate-in fade-in duration-200">
      {/* Hero Banner — full-bleed video header, edge to edge */}
      {showHero && heroStream && (
        <div className="relative w-full overflow-hidden mb-4 sm:mb-6 bg-[#050810] select-none" style={{ height: 'clamp(240px, 38vh, 700px)' }}>
          {/* Full-bleed video background */}
          <div className="absolute inset-0 z-0">
            <video
              ref={heroVideoRef}
              className="w-full h-full object-cover filter brightness-75"
              muted
              autoPlay
              playsInline
              loop
              onError={() => setHeroVideoError(true)}
            />
            {(heroVideoError || !heroStream.bgVideoUrl) && (
              <img
                src={heroPosterSrc || heroStream.poster || ''}
                alt={heroStream.title}
                className="w-full h-full object-cover filter brightness-75"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = heroStream.poster || '';
                }}
              />
            )}
          </div>
          {/* Gradient overlays for text readability */}
          <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#050810] via-[#050810]/30 to-transparent" />
          <div className="absolute inset-0 z-[1] bg-gradient-to-r from-[#050810]/70 via-transparent to-transparent" />
          {/* Content overlay */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 h-full flex flex-col justify-end pb-10 sm:pb-14">
            <div className="flex items-end justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-3">
                  <span className="flex items-center gap-1.5 text-blue-400 font-semibold uppercase tracking-wider">
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    24/7 Live
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-300">{heroStream.category}</span>
                </div>
                <h2 className="text-3xl sm:text-5xl font-black text-white leading-none drop-shadow-lg">{heroStream.title}</h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onPlayStream(heroStream)}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-xl shadow-blue-600/40"
                >
                  <Play className="w-5 h-5 fill-white" />
                  <span>Watch Now</span>
                </button>
                <button
                  onClick={pickRandomHero}
                  className="p-3 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-600 transition-colors"
                  title="Play Random"
                >
                  <Shuffle className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onToggleWatchlist(heroStream)}
                  className={`p-3 rounded-xl border transition-colors ${
                    heroInWatchlist
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:text-white'
                  }`}
                  title={heroInWatchlist ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star className={`w-5 h-5 ${heroInWatchlist ? 'fill-amber-400' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <Tv className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          </div>
          <p className="text-sm text-slate-300 mt-1">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search channels & matches..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-52 sm:w-64"
            />
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Refresh Stream Directory"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          )}

          <div className="text-xs font-mono text-slate-400 px-3 py-1.5 bg-slate-900 rounded-lg border border-slate-800">
            {filtered.length} Channels
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="py-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
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

      {/* Stream Cards Grid */}
      {filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-slate-300 mb-1">No channels found</p>
          <p className="text-xs text-slate-500 max-w-sm">
            Try adjusting your search query or selecting a different category tab.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mt-2">
          {filtered.map((stream) => (
            <StreamCard
              key={stream.id}
              stream={stream}
              onPlay={onPlayStream}
              onAddToMultiview={onAddToMultiview}
              onToggleWatchlist={onToggleWatchlist}
              onTogglePiP={onTogglePiP}
              isInWatchlist={watchlistIds.includes(stream.id)}
              isInMultiview={multiviewStreamIds.includes(stream.id)}
              screenshotUrl={screenshotUrls.get(stream.id) ?? undefined}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
};
