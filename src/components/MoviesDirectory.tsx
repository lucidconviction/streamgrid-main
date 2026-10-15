import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Play, ChevronRight, Film, Tv, Star,
  PauseCircle, Loader2, X, ChevronLeft,
} from 'lucide-react';
import { StreamItem } from '../types/stream';
import {
  searchTVMaze, getPopularTVMaze, getTVMazeEpisodes, getTopRatedTVMaze, getTVMazeSchedule,
  tvMazeShowToStream,
  getMovies, searchMovies, pstreamMovieToStream,
  buildPstreamUrl, getResumeTime, saveProgress, getProgress,
  searchAllSources, getTvShowsByGenre,
  flattenSearchSources,
  type SearchSource,
  type TVMazeEpisode,
} from '../services/moviesService';
import {
  getTMDBPopularMovies, getTMDBNowPlaying, getTMDBTopRatedMovies,
  getTMDBPopularTV, getTMDBTopRatedTV, getTMDBAiringTodayTV, getTMDBOnTheAirTV,
  getTMDBMovieByImdbId,
  tmdbMovieToStream, tmdbTVShowToStream,
} from '../services/tmdbService';
import {
  getFallbackSources, getFallbackLabel,
  type FallbackSource,
} from '../services/fallbackPlayerService';

type SubTab = 'movies' | 'tvmaze';
type ContentMode = 'browse' | 'search' | 'episodes';

interface MoviesDirectoryProps {
  onPlayStream: (stream: StreamItem) => void;
  watchlistIds: string[];
  onToggleWatchlist: (stream: StreamItem) => void;
  onAddToMultiview?: (stream: StreamItem) => void;
}

// ── Movie Card (aether.ist style: portrait poster + title + year) ─────────────

interface MovieCardProps {
  item: StreamItem;
  onClick: (item: StreamItem) => void;
  source?: string;
}

const MovieCard: React.FC<MovieCardProps> = ({ item, onClick, source }) => {
  const [imgError, setImgError] = useState(false);

  const isMovie = item.category === 'Movies';
  const isAnime = item.category === 'Anime';
  const typeBadge = isMovie ? 'Movie' : isAnime ? 'Anime' : 'TV';
  const year = item.date ? String(item.date).slice(0, 4) : '';

  // Generate a cinematic gradient based on title hash
  const gradient = useMemoGradient(item.title);

  return (
    <button
      onClick={() => onClick(item)}
      className="group flex flex-col items-start text-left w-full transition-transform duration-200 hover:-translate-y-1 focus:outline-none"
    >
      <div className="relative overflow-hidden rounded-lg shadow-lg aspect-[2/3] w-full bg-slate-800">
        {!imgError && item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center p-3"
            style={{ background: gradient }}
          >
            <span className="text-2xl mb-1.5 drop-shadow-lg">
              {isMovie ? '🎬' : isAnime ? '🎌' : '📺'}
            </span>
            <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest text-center px-1 line-clamp-2">
              {item.title}
            </span>
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-blue-600/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 scale-75 group-hover:scale-100 shadow-lg">
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* Type badge */}
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/70 backdrop-blur-sm text-white/90">
          {typeBadge}
        </div>

        {/* Year badge */}
        {year && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/70 backdrop-blur-sm text-slate-300">
            {year}
          </div>
        )}

        {/* Source tag for search results */}
        {source && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-600/90 backdrop-blur-sm text-white">
            {source}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="mt-2 w-full min-w-0">
        <p className="text-xs font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
          {item.title}
        </p>
        {item.category !== 'Movies' && (
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">{item.category}</p>
        )}
      </div>
    </button>
  );
};

// Simple seeded gradient generator for movie placeholders
function useMemoGradient(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 40 + Math.abs(hash >> 8) % 60) % 360;
  return `linear-gradient(135deg, hsl(${h1},60%,15%) 0%, hsl(${h2},50%,10%) 100%)`;
}

// ── Horizontal Scroll Row ────────────────────────────────────────────────────

interface ScrollRowProps {
  title: string;
  subtitle?: string;
  items: StreamItem[];
  onPlay?: (item: StreamItem) => void;
  sourceTag?: string;
}

const ScrollRow: React.FC<ScrollRowProps> = ({ title, subtitle, items, onPlay, sourceTag }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="mb-8 group/row">
      {/* Row header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2 drop-shadow-[0_0_6px_rgba(59,130,246,0.3)]">
            {title}
            <span className="text-sm font-medium text-slate-300">{items.length} titles</span>
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-300 mt-0.5 font-medium">{subtitle}</p>
          )}
        </div>
        {sourceTag && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-600/10 border border-blue-600/30 px-2 py-0.5 rounded-full">
            {sourceTag}
          </span>
        )}
      </div>

      {/* Scrollable container */}
      <div className="relative">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-4 z-10 w-10 flex items-center justify-center bg-gradient-to-r from-[#090a0f] to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-4 z-10 w-10 flex items-center justify-center bg-gradient-to-l from-[#090a0f] to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 overflow-x-auto no-scrollbar pb-2"
        >
          {items.map((item) => (
            <div key={item.id} className="flex-shrink-0 w-[140px] sm:w-[160px]">
              <MovieCard item={item} onClick={() => onPlay?.(item)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

export const MoviesDirectory: React.FC<MoviesDirectoryProps> = ({
  onPlayStream,
  watchlistIds,
  onToggleWatchlist,
  onAddToMultiview,
}) => {
  const [subTab, setSubTab] = useState<SubTab>('movies');
  const [contentMode, setContentMode] = useState<ContentMode>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStream, setSelectedStream] = useState<StreamItem | null>(null);
  const [resumeTimes, setResumeTimes] = useState<Map<string, number>>(new Map());
  const [fallbackSources, setFallbackSources] = useState<FallbackSource[]>([]);
  const [activeFallbackIndex, setActiveFallbackIndex] = useState(-1);
  const [playerError, setPlayerError] = useState(false);

  // Data states
  const [movies, setMovies] = useState<StreamItem[]>([]);
  const [tvShows, setTvShows] = useState<StreamItem[]>([]);
  const [searchResults, setSearchResults] = useState<SearchSource[]>([]);
  const [episodes, setEpisodes] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Row data — all rows shown simultaneously ───────────────────────────────
  const [tmdbPopMovies, setTmdbPopMovies] = useState<StreamItem[]>([]);
  const [tmdbNowPlaying, setTmdbNowPlaying] = useState<StreamItem[]>([]);
  const [tmdbTopMovies, setTmdbTopMovies] = useState<StreamItem[]>([]);
  const [tmdbPopTV, setTmdbPopTV] = useState<StreamItem[]>([]);
  const [tmdbTopTV, setTmdbTopTV] = useState<StreamItem[]>([]);
  const [tmdbAiringToday, setTmdbAiringToday] = useState<StreamItem[]>([]);
  const [tmdbOnTheAir, setTmdbOnTheAir] = useState<StreamItem[]>([]);

  // Track P-Stream progress events from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://embed.pstream.cfd') return;
      try {
        const data = event.data;
        if (data?.type === 'pstream' && data.event === 'time' && selectedStream) {
          const prog = getProgress(selectedStream.id);
          const newTime = typeof data.time === 'number' ? data.time : 0;
          const newTotal = typeof data.duration === 'number' ? data.duration : (prog?.total || 0);
          if (newTime > 30 && newTime < (newTotal || Infinity) * 0.95) {
            saveProgress(selectedStream.id, newTime, newTotal);
          }
        }
      } catch { /* ignore malformed messages */ }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedStream]);

  // Build fallback mirror sources when a stream is selected
  useEffect(() => {
    if (!selectedStream) return;
    const sources = getFallbackSources(selectedStream);
    setFallbackSources(sources);
    setActiveFallbackIndex(-1);
    setPlayerError(false);
  }, [selectedStream?.id]);

  // Load initial data
  useEffect(() => {
    loadBrowseData();
  }, []);

  const loadBrowseData = async () => {
    setLoading(true);
    try {
      // ── Local IMDb catalog ──
      const allMovies = getMovies();
      const moviesWithPosters = await Promise.all(
        allMovies.map(async (m) => {
          const item = pstreamMovieToStream(m);
          try {
            const tmdb = await getTMDBMovieByImdbId(m.imdbId);
            if (tmdb?.poster_path) item.poster = `https://image.tmdb.org/t/p/w500${tmdb.poster_path}`;
          } catch { /* ignore missing posters */ }
          return item;
        })
      );
      setMovies(moviesWithPosters);

      // ── TVMaze popular ──
      try {
        const shows = await getPopularTVMaze();
        setTvShows(shows.slice(0, 80).map(tvMazeShowToStream));
      } catch { /* TVMaze unavailable */ }

      // ── TMDB (requires VITE_TMDB_API_KEY env var) ──
      const [pMov, nowPlay, topMov, pTV, topTV, airingToday, onTheAir] = await Promise.allSettled([
        getTMDBPopularMovies(),
        getTMDBNowPlaying(),
        getTMDBTopRatedMovies(),
        getTMDBPopularTV(),
        getTMDBTopRatedTV(),
        getTMDBAiringTodayTV(),
        getTMDBOnTheAirTV(),
      ]);
      if (pMov.status === 'fulfilled') setTmdbPopMovies(pMov.value.map(tmdbMovieToStream));
      if (nowPlay.status === 'fulfilled') setTmdbNowPlaying(nowPlay.value.map(tmdbMovieToStream));
      if (topMov.status === 'fulfilled') setTmdbTopMovies(topMov.value.map(tmdbMovieToStream));
      if (pTV.status === 'fulfilled') setTmdbPopTV(pTV.value.map(tmdbTVShowToStream));
      if (topTV.status === 'fulfilled') setTmdbTopTV(topTV.value.map(tmdbTVShowToStream));
      if (airingToday.status === 'fulfilled') setTmdbAiringToday(airingToday.value.map(tmdbTVShowToStream));
      if (onTheAir.status === 'fulfilled') setTmdbOnTheAir(onTheAir.value.map(tmdbTVShowToStream));

    } catch (err) {
      console.error('Initial data load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setContentMode('search');
    try {
      const sources = await searchAllSources(searchQuery);
      setSearchResults(sources);

      // Preload resume times from flat results
      const flat = flattenSearchSources(sources);
      const times = new Map<string, number>();
      for (const item of flat) {
        const t = getResumeTime(item.id);
        if (t > 0) times.set(item.id, t);
      }
      setResumeTimes(times);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodes = async (showId: number, imdbId: string) => {
    setLoading(true);
    try {
      const eps = await getTVMazeEpisodes(showId);
      const streamEpisodes: StreamItem[] = eps.map((ep) => {
        const epId = `tvmaze-${showId}-s${ep.season}-ep${ep.number}`;
        return {
          id: epId,
          title: `S${ep.season}E${ep.number}: ${ep.name}`,
          name: ep.name,
          category: 'TV Shows',
          poster: ep.image?.medium,
          status: 'live' as const,
          provider: 'anime' as const,
          streamType: 'embed' as const,
          directEmbedUrl: `https://embed.pstream.cfd/media/tmdb-tv-${imdbId}/${ep.season}/${ep.number}`,
          viewers: 0,
          date: ep.airdate ? new Date(ep.airdate).getFullYear() : undefined,
        };
      });
      setEpisodes(streamEpisodes);
      setContentMode('episodes');

      const times = new Map<string, number>();
      for (const ep of streamEpisodes) {
        const t = getResumeTime(ep.id);
        if (t > 0) times.set(ep.id, t);
      }
      setResumeTimes(times);
    } catch (err) {
      console.error('Episode fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (item: StreamItem) => {
    // TV Shows: click to load episodes
    if (subTab === 'tvmaze' && item.directEmbedUrl?.includes('tmdb-tv') && !item.directEmbedUrl?.includes('/media/tmdb-tv-')) {
      const showId = parseInt(item.id.replace('tvmaze-', ''), 10);
      const imdbId = item.directEmbedUrl?.match(/tmdb-tv-([^/?]+)/)?.[1];
      if (showId && imdbId) {
        loadEpisodes(showId, imdbId);
        return;
      }
    }
    setSelectedStream(item);
  };

  const handleSubTabSwitch = (sub: SubTab) => {
    setSubTab(sub);
    setContentMode('browse');
    setSearchQuery('');
    setSelectedStream(null);
    setEpisodes([]);
    setSearchResults([]);
  };

  const handleBackToBrowse = () => {
    setContentMode('browse');
    setSearchQuery('');
    setSelectedStream(null);
    setEpisodes([]);
    setSearchResults([]);
  };

  // Load schedule data when on TV tab (for Airing Tonight display)
  const [scheduleEpisodes, setScheduleEpisodes] = useState<TVMazeEpisode[]>([]);
  useEffect(() => {
    if (subTab === 'tvmaze') {
      getTVMazeSchedule().then(setScheduleEpisodes).catch(() => {});
    }
  }, [subTab]);

  // ── Computed browse rows ───────────────────────────────────────────────────

  const currentResumeTime = selectedStream ? (resumeTimes.get(selectedStream.id) || 0) : 0;
  const pstreamUrl = selectedStream
    ? buildPstreamUrl(selectedStream.directEmbedUrl || '', currentResumeTime)
    : '';

  // Resolve active embed URL: primary P-Stream, or selected fallback mirror
  const activeEmbedUrl = selectedStream
    ? (activeFallbackIndex >= 0 && fallbackSources[activeFallbackIndex])
      ? fallbackSources[activeFallbackIndex].url
      : pstreamUrl
    : '';

  const tryNextFallback = () => {
    if (fallbackSources.length === 0) return;
    const nextIndex = activeFallbackIndex + 1;
    if (nextIndex >= fallbackSources.length) {
      setActiveFallbackIndex(0);
      return;
    }
    setActiveFallbackIndex(nextIndex);
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#090a0f]">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-[#090a0f]/90 backdrop-blur-md border-b border-slate-800/60">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
          {/* Top row: Title + Search */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              {contentMode !== 'browse' && (
                <button
                  onClick={handleBackToBrowse}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-2xl">{subTab === 'movies' ? '🎬' : '📺'}</span>
                  {subTab === 'movies' ? 'Movies' : 'TV Shows'}
                </h1>
                {contentMode === 'search' && searchQuery && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Results for &quot;<span className="text-white font-medium">{searchQuery}</span>&quot;
                  </p>
                )}
              </div>
            </div>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search movies, TV, anime…"
                  className="bg-slate-900/80 border border-slate-700/60 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 w-48 sm:w-64 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !searchQuery.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-sm font-bold transition-colors shadow-md shadow-blue-600/30"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </button>
            </form>
          </div>

          {/* Sub-tabs: Movies / TV Shows */}
          <div className="flex gap-1 bg-slate-900/60 p-1 rounded-xl w-fit mb-3">
            {([
              { id: 'movies' as SubTab, label: 'Movies', emoji: '🎬' },
              { id: 'tvmaze' as SubTab, label: 'TV Shows', emoji: '📺' },
            ]).map((svc) => (
              <button
                key={svc.id}
                onClick={() => handleSubTabSwitch(svc.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  subTab === svc.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <span>{svc.emoji}</span>
                {svc.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        {loading && contentMode === 'browse' ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
            <p className="text-sm font-medium text-slate-300">Loading library...</p>
            <p className="text-xs text-slate-500 mt-1">Fetching movies & TV shows</p>
          </div>
        ) : contentMode === 'search' ? (
          /* ── Multi-source Search Results ── */
          searchResults.length > 0 ? (
            searchResults.map((src) => (
              <ScrollRow
                key={src.source}
                title={`${src.label} (${src.items.length})`}
                items={src.items}
                onPlay={handleCardClick}
                sourceTag={src.source.toUpperCase()}
              />
            ))
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
              <p className="text-sm font-medium text-slate-300">Searching all sources…</p>
              <p className="text-xs text-slate-500 mt-1">Movies · TV Shows</p>
            </div>
          ) : (
            <div className="text-center py-32">
              <Search className="w-12 h-12 mx-auto mb-4 text-slate-700" />
              <p className="text-base font-semibold text-slate-300 mb-1">
                No results for &quot;{searchQuery}&quot;
              </p>
              <p className="text-sm text-slate-500">
                Try a different title or browse by genre below
              </p>
            </div>
          )
        ) : contentMode === 'episodes' ? (
          /* ── Episode List ── */
          <div>
            <ScrollRow title="Episodes" items={episodes} onPlay={handleCardClick} />
          </div>
        ) : (
          /* ── Browse: All rows shown simultaneously ── */
          <>
            {/* ═══ MOVIES ═══ */}
            {subTab === 'movies' && (
              <>
                {tmdbPopMovies.length > 0 && (
                  <ScrollRow
                    title="Popular Movies"
                    subtitle="Source: TMDB — real-time popularity data"
                    items={tmdbPopMovies}
                    onPlay={handleCardClick}
                    sourceTag="TMDB"
                  />
                )}
                {tmdbNowPlaying.length > 0 && (
                  <ScrollRow
                    title="Now Playing"
                    subtitle="Source: TMDB — currently in theaters"
                    items={tmdbNowPlaying}
                    onPlay={handleCardClick}
                    sourceTag="TMDB"
                  />
                )}
                {tmdbTopMovies.length > 0 && (
                  <ScrollRow
                    title="Top Rated Movies"
                    subtitle="Source: TMDB — highest rated of all time"
                    items={tmdbTopMovies}
                    onPlay={handleCardClick}
                    sourceTag="TMDB"
                  />
                )}
                {movies.length > 0 && (
                  <ScrollRow
                    title="IMDb Catalog"
                    subtitle="Source: IMDb top-rated classics (local catalog)"
                    items={movies}
                    onPlay={handleCardClick}
                    sourceTag="IMDb"
                  />
                )}
              </>
            )}

            {/* ═══ TV SHOWS ═══ */}
            {subTab === 'tvmaze' && (
              <>
                {tvShows.length > 0 && (
                  <ScrollRow
                    title="Popular TV Shows"
                    subtitle="Source: TVMaze — real-time popularity data"
                    items={tvShows}
                    onPlay={handleCardClick}
                    sourceTag="TVMaze"
                  />
                )}
                {tmdbPopTV.length > 0 && (
                  <ScrollRow
                    title="Popular on TMDB"
                    subtitle="Source: TMDB — trending TV series"
                    items={tmdbPopTV}
                    onPlay={handleCardClick}
                    sourceTag="TMDB"
                  />
                )}
                {tmdbTopTV.length > 0 && (
                  <ScrollRow
                    title="Top Rated TV Series"
                    subtitle="Source: TMDB — highest rated shows"
                    items={tmdbTopTV}
                    onPlay={handleCardClick}
                    sourceTag="TMDB"
                  />
                )}
                {tmdbAiringToday.length > 0 && (
                  <ScrollRow
                    title="Airing Today"
                    subtitle="Source: TMDB — episodes airing today"
                    items={tmdbAiringToday}
                    onPlay={handleCardClick}
                    sourceTag="TMDB"
                  />
                )}
                {tmdbOnTheAir.length > 0 && (
                  <ScrollRow
                    title="On The Air"
                    subtitle="Source: TMDB — currently production / active series"
                    items={tmdbOnTheAir}
                    onPlay={handleCardClick}
                    sourceTag="TMDB"
                  />
                )}
              </>
            )}

            {/* Empty state */}
            {((subTab === 'movies' && tmdbPopMovies.length === 0 && movies.length === 0) ||
              (subTab === 'tvmaze' && tvShows.length === 0 && tmdbPopTV.length === 0)) && (
              <div className="text-center py-32">
                <Film className="w-12 h-12 mx-auto mb-4 text-slate-700" />
                <p className="text-base font-semibold text-slate-300 mb-1">No content available</p>
                <p className="text-sm text-slate-500">Check your connection and try again</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Right-side Player Panel ── */}
      {selectedStream && (
        <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] md:w-[560px] lg:w-[600px] bg-[#090a0f] border-l border-slate-800/60 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
          {/* Player header */}
          <div className="px-5 py-4 border-b border-slate-800/60 flex items-start justify-between shrink-0">
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-white text-base truncate">{selectedStream.title}</h2>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                {selectedStream.directEmbedUrl?.includes('/movie/tt') && <Film className="w-3 h-3" />}
                {selectedStream.directEmbedUrl?.includes('/media/tmdb-tv') && <Tv className="w-3 h-3" />}
                {selectedStream.directEmbedUrl?.includes('/movie/tt')
                  ? 'Movie — P-Stream'
                  : selectedStream.directEmbedUrl?.includes('/media/tmdb-tv')
                    ? 'TV Show — P-Stream'
                    : 'Ready to play'}
              </p>
            </div>
            <button
              onClick={() => setSelectedStream(null)}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0 ml-3"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Player */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4 shrink-0">
              {activeEmbedUrl ? (
                <div className="relative rounded-xl overflow-hidden shadow-2xl bg-black aspect-video">
                  <iframe
                    key={activeFallbackIndex}
                    src={activeEmbedUrl}
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    allowFullScreen
                    onError={tryNextFallback}
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-xl bg-slate-900 flex items-center justify-center">
                  <div className="text-center text-slate-500">
                    <Play className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No stream URL available</p>
                  </div>
                </div>
              )}
            </div>

            {/* Mirror Sources Toolbar */}
            {fallbackSources.length > 0 && (
              <div className="px-4 pb-2 shrink-0">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  <span className="text-xs text-slate-500 font-mono uppercase tracking-wider shrink-0">
                    Mirrors:
                  </span>
                  {fallbackSources.map((fb, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveFallbackIndex(activeFallbackIndex === idx ? -1 : idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                        activeFallbackIndex === idx
                          ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                          : activeFallbackIndex === -1 && idx === 0
                            ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                            : 'bg-slate-900/60 text-slate-500 hover:text-emerald-300 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-700/30'
                      }`}
                    >
                      {getFallbackLabel(fb, idx)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Resume indicator */}
            {currentResumeTime > 0 && (
              <div className="px-4 pb-2 shrink-0">
                <button
                  onClick={() => {
                    const url = buildPstreamUrl(selectedStream.directEmbedUrl || '', currentResumeTime);
                    setSelectedStream({ ...selectedStream, directEmbedUrl: url });
                  }}
                  className="w-full flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 px-3 py-2.5 rounded-xl transition-colors"
                >
                  <PauseCircle className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">Resume from {formatTime(currentResumeTime)}</span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="px-4 pb-3 flex items-center gap-2 shrink-0">
              <button
                onClick={() => onPlayStream(selectedStream)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <Play className="w-4 h-4 fill-white" />
                Watch Full Title
              </button>
              <button
                onClick={() => onToggleWatchlist(selectedStream)}
                className={`p-2.5 rounded-xl border transition-colors ${
                  watchlistIds.includes(selectedStream.id)
                    ? 'bg-blue-950/80 border-blue-700 text-blue-400'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
                title={watchlistIds.includes(selectedStream.id) ? 'In Watchlist' : 'Add to Watchlist'}
              >
                <svg className="w-4 h-4" fill={watchlistIds.includes(selectedStream.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </button>
              {onAddToMultiview && (
                <button
                  onClick={() => onAddToMultiview(selectedStream)}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                  title="Add to Multiview"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="2" y="3" width="14" height="14" rx="2" />
                    <rect x="8" y="7" width="14" height="14" rx="2" />
                  </svg>
                </button>
              )}
            </div>

            {/* Episodes list (for TV shows) */}
            {episodes.length > 0 && (
              <div className="flex-1 px-4 pb-4 overflow-y-auto">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Episodes</h3>
                <div className="space-y-1.5">
                  {episodes.map((ep) => (
                    <button
                      key={ep.id}
                      onClick={() => handleCardClick(ep)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-3 ${
                        selectedStream.id === ep.id
                          ? 'bg-blue-600/20 border border-blue-600/40 text-white'
                          : 'bg-slate-900/60 border border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className={`text-[10px] font-mono w-6 shrink-0 ${
                        selectedStream.id === ep.id ? 'text-blue-400' : 'text-slate-600'
                      }`}>
                        {selectedStream.id === ep.id ? '▶' : ep.title.match(/S(\d+)E(\d+)/)?.[0] || ''}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{ep.title}</p>
                      </div>
                      {resumeTimes.get(ep.id) ? (
                        <span className="text-[10px] text-amber-400 shrink-0">
                          {formatTime(resumeTimes.get(ep.id)!)}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
