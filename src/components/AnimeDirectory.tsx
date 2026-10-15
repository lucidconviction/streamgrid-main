import React, { useState, useMemo, useCallback } from 'react';
import { Play, Search, RefreshCw, ExternalLink, Loader2 } from 'lucide-react';
import { StreamItem } from '../types/stream';
import { StreamCard } from './StreamCard';
import { consumetService } from '../services/consumetService';
import { moviesApiService } from '../services/moviesApiService';
import { vidfastService } from '../services/vidfastService';
import {
  searchAnilist,
  getTrendingAnilist,
  getPopularAnilist,
  getTopRatedAnilist,
  getUpcomingAnilist,
  anilistAnimeToStream,
} from '../services/moviesService';

interface AnimeDirectoryProps {
  onPlayStream: (stream: StreamItem) => void;
  onAddToMultiview: (stream: StreamItem) => void;
  onToggleWatchlist: (stream: StreamItem) => void;
  watchlistIds: string[];
  multiviewStreamIds: string[];
}

type ActiveService = 'catalog' | 'consumet' | 'pstream' | 'vidfast' | 'moviesapi';
type ActiveTab = 'search' | 'trending' | 'popular';

const SERVICES: { id: ActiveService; label: string; emoji: string; description: string; endpoint: string; repo?: string }[] = [
  { id: 'catalog', label: 'Anime Catalog', emoji: '📚', description: '6-row curated catalog — top rated, trending, popular, upcoming, action & shonen', endpoint: 'https://anilist.co' },
  { id: 'consumet', label: 'Consumet API', emoji: '📺', description: 'Multi-provider streams (Gogoanime, Zoro/Hianime, AnimePahe)', endpoint: 'https://api.consumet.org', repo: 'github.com/consumet/api.consumet.org' },
  { id: 'pstream', label: 'P-Streams', emoji: '🎬', description: 'Anime streaming via P-Stream embeds (AniList metadata)', endpoint: 'https://embed.pstream.cfd' },
  { id: 'vidfast', label: 'VidFast', emoji: '🎥', description: 'Anime streaming via VidFast embeds (AniList metadata)', endpoint: 'https://vidfast.xyz' },
  { id: 'moviesapi', label: 'MoviesAPI', emoji: '🍿', description: 'Movie catalog from MoviesAPI database', endpoint: 'https://movies-api.com' },
];

export const AnimeDirectory: React.FC<AnimeDirectoryProps> = ({
  onPlayStream,
  onAddToMultiview,
  onToggleWatchlist,
  watchlistIds,
  multiviewStreamIds,
}) => {
  const [activeService, setActiveService] = useState<ActiveService>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');
  const [results, setResults] = useState<StreamItem[]>([]);
  const [catalogRows, setCatalogRows] = useState<{ label: string; items: StreamItem[] }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [displayCount, setDisplayCount] = useState<number>(40);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('trending');

  const loadCatalogRows = useCallback(async () => {
    const rows: { label: string; items: StreamItem[] }[] = [];
    try {
      const [topRated, trending, popular, upcoming, action, shonen] = await Promise.all([
        getTopRatedAnilist(),
        getTrendingAnilist(),
        getPopularAnilist(),
        getUpcomingAnilist(),
        searchAnilist('action'),
        searchAnilist('shonen'),
      ]);
      rows.push(
        { label: '⭐ Top Rated', items: topRated.map((a) => anilistAnimeToStream(a)) },
        { label: '📈 Trending Now', items: trending.map((a) => anilistAnimeToStream(a)) },
        { label: '🔥 Popular', items: popular.map((a) => anilistAnimeToStream(a)) },
        { label: '🚀 Upcoming', items: upcoming.map((a) => anilistAnimeToStream(a)) },
        { label: '⚔️ Action', items: action.map((a) => anilistAnimeToStream(a)) },
        { label: '⚔️ Shonen', items: shonen.map((a) => anilistAnimeToStream(a)) },
      );
    } catch (err) {
      console.error('Catalog load failed:', err);
      setError('Failed to load anime catalog. Please try again.');
    }
    setCatalogRows(rows);
  }, []);

  const fetchResults = useCallback(async (query: string, service: ActiveService, tab: ActiveTab) => {
    if (!query.trim() && tab === 'search' && service !== 'moviesapi') {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      let items: StreamItem[] = [];

      switch (service) {
        case 'catalog':
          if (tab === 'search' && query.trim()) {
            const data = await searchAnilist(query);
            items = data.map((a) => anilistAnimeToStream(a));
          } else {
            await loadCatalogRows();
          }
          break;

        case 'consumet':
          if (tab === 'trending') {
            const data = await consumetService.getRecentAnimeFallback();
            items = data.map((a) => consumetService.parseConsumetToStream(a));
          } else {
            const data = await consumetService.searchWithAnilistFallback(query);
            items = data.map((a) => consumetService.parseConsumetToStream(a));
          }
          break;

        case 'pstream':
          if (tab === 'trending') {
            const data = await getTrendingAnilist();
            items = data.map((a) => anilistAnimeToStream(a));
          } else if (tab === 'popular') {
            const data = await getPopularAnilist();
            items = data.map((a) => anilistAnimeToStream(a));
          } else if (tab === 'search' && query.trim()) {
            const data = await searchAnilist(query);
            items = data.map((a) => anilistAnimeToStream(a));
          } else {
            const data = await getTrendingAnilist();
            items = data.map((a) => anilistAnimeToStream(a));
          }
          break;

        case 'vidfast':
          if (tab === 'trending') {
            const data = await vidfastService.getTrendingAniListForVidfast();
            items = data.map((a) => vidfastService.vidfastAnimeToStream(a));
          } else if (tab === 'popular') {
            const data = await vidfastService.getPopularAniListForVidfast();
            items = data.map((a) => vidfastService.vidfastAnimeToStream(a));
          } else {
            const data = await vidfastService.searchAniListForVidfast(query);
            items = data.map((a) => vidfastService.vidfastAnimeToStream(a));
          }
          break;

        case 'moviesapi':
          if (tab === 'trending' || tab === 'popular' || !query.trim()) {
            const data = await moviesApiService.getMoviesApiCatalog();
            items = data.map((m) => moviesApiService.moviesApiMovieToStream(m));
          } else {
            // Search by title
            const movies = await moviesApiService.fetchMultipleRandomMovies(20);
            items = movies.map((m) => moviesApiService.moviesApiMovieToStream(m));
          }
          break;
      }

      setResults(items);
    } catch (err) {
      console.error(`Failed to fetch from ${service}:`, err);
      setError(`Failed to load from ${SERVICES.find(s => s.id === service)?.label}. The API may be unavailable.`);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const displayedResults = useMemo(() => {
    return results.slice(0, displayCount);
  }, [results, displayCount]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDisplayCount(40);
    setActiveTab('search');
    fetchResults(searchQuery, activeService, 'search');
  };

  const handleTabSwitch = (tab: ActiveTab) => {
    setActiveTab(tab);
    setDisplayCount(40);
    if (activeService === 'catalog') {
      if (tab === 'search' && searchQuery.trim()) {
        fetchResults(searchQuery, activeService, 'search');
      } else {
        loadCatalogRows();
      }
    } else if (tab === 'search' && searchQuery.trim()) {
      fetchResults(searchQuery, activeService, 'search');
    } else {
      fetchResults('', activeService, tab);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchResults(searchQuery, activeService, activeTab);
    setIsRefreshing(false);
  };

  const activeServiceInfo = SERVICES.find((s) => s.id === activeService)!;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🎌</span>
            <h1 className="text-2xl font-bold tracking-tight text-white">Anime Hub</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Discover and stream anime from multiple sources — metadata powered by AniList.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={`Search ${activeServiceInfo.label}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48 sm:w-64"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || isRefreshing}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-xs font-medium transition-colors"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
            </button>
          </form>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
          </button>

          {/* View toggle */}
          <div className="flex bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
            <button
              onClick={() => setDisplayMode('grid')}
              className={`px-2.5 py-1.5 text-xs transition-colors ${displayMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Grid
            </button>
            <button
              onClick={() => setDisplayMode('list')}
              className={`px-2.5 py-1.5 text-xs transition-colors ${displayMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Content Tabs: Search / Trending / Popular */}
      <div className="pb-3 flex items-center gap-2 pt-4">
        {(['search', 'trending', 'popular'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabSwitch(tab)}
            className={`px-3.5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === tab
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700'
            }`}
          >
            {tab === 'search' ? `🔍 Search` : tab === 'trending' ? '📈 Trending' : '⭐ Popular'}
          </button>
        ))}
      </div>

      {/* Service Tabs */}
      <div className="pb-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {SERVICES.map((svc) => {
          const isActive = activeService === svc.id;
          return (
            <button
              key={svc.id}
              onClick={() => {
                setActiveService(svc.id);
                setSearchQuery('');
                setResults([]);
                setCatalogRows([]);
                if (svc.id === 'catalog') {
                  setActiveTab('trending');
                  loadCatalogRows();
                } else {
                  setActiveTab('trending');
                  fetchResults('', svc.id, 'trending');
                }
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700'
              }`}
            >
              <span>{svc.emoji}</span>
              <span>{svc.label}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            </button>
          );
        })}
      </div>

      {/* Service Info Card */}
      <div className="mb-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
        <span className="text-xl">{activeServiceInfo.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white">{activeServiceInfo.label}</p>
          <p className="text-[11px] text-slate-400 truncate">{activeServiceInfo.description}</p>
        </div>
        <a
          href={activeServiceInfo.endpoint}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] text-slate-400 hover:text-white transition-colors shrink-0"
        >
          <ExternalLink className="w-3 h-3" />
          Website
        </a>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-blue-950/40 border border-blue-800/60 flex items-center gap-2">
          <span className="text-blue-400 text-xs">{error}</span>
        </div>
      )}

      {/* Catalog Mode - 6 Rows */}
      {activeService === 'catalog' ? (
        isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-300">Loading anime catalog...</p>
            <p className="text-xs text-slate-500 mt-1">Fetching 6 curated rows</p>
          </div>
        ) : catalogRows.length === 0 && !error ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <span className="text-4xl mb-3">📚</span>
            <p className="text-sm font-semibold text-slate-300 mb-1">No catalog data</p>
            <p className="text-xs text-slate-500">Failed to load anime catalog. Please try again.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {catalogRows.map((row, rowIdx) => (
              <section key={row.label}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2 drop-shadow-[0_0_6px_rgba(244,114,182,0.3)]">
                    <span className="text-2xl">{['⭐', '📈', '🔥', '🚀', '⚔️', '⚔️'][rowIdx]}</span>
                    {row.label}
                    <span className="text-sm font-medium text-slate-300 ml-2">({row.items.length} anime)</span>
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {row.items.slice(0, 12).map((stream) => (
                    <StreamCard
                      key={stream.id}
                      stream={stream}
                      onPlay={onPlayStream}
                      onAddToMultiview={onAddToMultiview}
                      onToggleWatchlist={onToggleWatchlist}
                      isInWatchlist={watchlistIds.includes(stream.id)}
                      isInMultiview={multiviewStreamIds.includes(stream.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : (
        /* Standard Service Mode */
        <>
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-300">
                {activeService === 'moviesapi' ? `Loading MoviesAPI catalog...` : `Loading ${activeTab}...`}
              </p>
              <p className="text-xs text-slate-500 mt-1">Fetching anime library</p>
            </div>
          ) : results.length === 0 && !error ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <span className="text-4xl mb-3">{activeServiceInfo.emoji}</span>
              <p className="text-sm font-semibold text-slate-300 mb-1">
                {activeTab === 'search' ? 'Search for anime' : `No ${activeTab} results`}
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                {activeService === 'moviesapi'
                  ? 'MoviesAPI provides a catalog of popular movies. Select "Trending" or "Popular" to browse.'
                  : activeTab === 'search'
                    ? 'Enter a title to search. Try "One Piece", "Naruto", "Attack on Titan", etc.'
                    : `Showing ${activeTab} anime from ${activeServiceInfo.label}.`
                }
              </p>
            </div>
          ) : (
            <>
              {displayMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {displayedResults.map((stream) => (
                    <StreamCard
                      key={stream.id}
                      stream={stream}
                      onPlay={onPlayStream}
                      onAddToMultiview={onAddToMultiview}
                      onToggleWatchlist={onToggleWatchlist}
                      isInWatchlist={watchlistIds.includes(stream.id)}
                      isInMultiview={multiviewStreamIds.includes(stream.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedResults.map((stream) => (
                    <div
                      key={stream.id}
                      onClick={() => onPlayStream(stream)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-blue-700/60 cursor-pointer transition-colors"
                    >
                      {stream.poster ? (
                        <img src={stream.poster} alt={stream.title} className="w-12 h-16 object-cover rounded-md bg-slate-800" />
                      ) : (
                        <div className="w-12 h-16 rounded-md bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center shrink-0">
                          <span className="text-lg">🎌</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-200 line-clamp-1">{stream.title}</p>
                        <p className="text-[11px] text-slate-500">{stream.category}</p>
                      </div>
                      <Play className="w-4 h-4 text-blue-400 shrink-0" />
                    </div>
                  ))}
                </div>
              )}

              {results.length > displayCount && (
                <div className="mt-8 flex items-center justify-center">
                  <button
                    onClick={() => setDisplayCount((prev) => prev + 40)}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold shadow-md transition-colors"
                  >
                    Load More ({displayedResults.length} of {results.length.toLocaleString()})
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
