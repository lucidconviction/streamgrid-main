import React, { useState, useEffect, useCallback } from 'react';
import { Tv, Search, Filter, Radio, RefreshCw, Play, Shuffle, Bookmark, Eye, LayoutGrid, Star } from 'lucide-react';
import { HeroVideo } from './HeroVideo';
import { StreamItem } from '../types/stream';
import { StreamCard } from './StreamCard';

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

  // Hero stream state — picked from live/24-7 candidates with playable URLs
  const [heroStream, setHeroStream] = useState<StreamItem | null>(null);

  const pickRandomHero = useCallback(async () => {
    const candidates = streams.filter((s) => s.directEmbedUrl || s.bgVideoUrl);
    if (candidates.length === 0) return;
    const random = candidates[Math.floor(Math.random() * candidates.length)];
    setHeroStream(random);
  }, [streams]);

  // Pick an initial hero stream once when streams load
  useEffect(() => {
    if (heroStream || streams.length === 0) return;
    const candidates = streams.filter((s) => s.directEmbedUrl || s.bgVideoUrl);
    if (candidates.length > 0) {
      setHeroStream(candidates[Math.floor(Math.random() * candidates.length)]);
    }
  }, [streams.length, heroStream]);




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
      {/* Hero Video — full-bleed validated stream, edge to edge */}
      {showHero && heroStream && (
        <HeroVideo
          candidates={[heroStream.bgVideoUrl || heroStream.directEmbedUrl ? { url: heroStream.bgVideoUrl || heroStream.directEmbedUrl || "", title: heroStream.title } : { url: "", title: "" }].filter(c => c.url)}
          variant="premium247"
          badge="24/7 PREMIUM"
          badgeIcon="📺"
          title={heroStream.title}
          subtitle="ESPN, HBO, Sky, ABC — HD continuous broadcasts from around the world"
          ctaLabel="Watch Now"
          onCta={() => onPlayStream(heroStream)}
          secondaryCtaLabel="Play Random"
          onSecondaryCta={pickRandomHero}
        >
          <div className="flex items-center gap-2 mt-4">
            <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">Category:</span>
            <span className="text-xs text-slate-300">{heroStream.category}</span>
          </div>
        </HeroVideo>
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
