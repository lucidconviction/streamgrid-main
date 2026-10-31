import React, { useState, useEffect, useRef } from 'react';
import { Play, Bookmark, X, Search, Film, Tv, Sparkles, ChevronRight, RotateCcw } from 'lucide-react';
import { MovieDetailsView } from './MovieDetailsView';
import { MovieItem, fetchMovies, fetchTVShows, fetchAnime, searchAll, movieEmbedChain, tvEmbedChain, animeEmbedChain, MediaType } from '../services/moviesService';

interface MoviesViewProps {
  activeProfileId: string;
  watchlistIds: string[];
  onToggleWatchlist: (id: string) => void;
  preselectedItem?: any;
}

export const MoviesView: React.FC<MoviesViewProps> = ({
  activeProfileId,
  watchlistIds,
  onToggleWatchlist,
  preselectedItem,
}) => {
  const [tab, setTab] = useState<'movies' | 'tv' | 'anime'>('movies');
  const [section, setSection] = useState<'popular' | 'now' | 'top' | 'onair' | 'trending' | 'upcoming' | 'airing' | 'action' | 'comedy' | 'drama' | 'horror' | 'sci_fi' | 'thriller' | 'romance' | 'animation' | 'family' | 'fantasy' | 'adventure' | 'crime' | 'documentary' | 'mystery' | 'war' | 'western' | 'action_adventure' | 'kids' | 'reality' | 'soap' | 'talk' | 'slice_of_life' | 'mecha' | 'sports' | 'sci_fi_fantasy'>('popular');
  const [items, setItems] = useState<MovieItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MovieItem | null>(null);
  const [detailItem, setDetailItem] = useState<MovieItem | null>(null);
  const [embedUrl, setEmbedUrl] = useState('');
  const [failedCount, setFailedCount] = useState(0);
  const [showTrailer, setShowTrailer] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Handle preselected item from App.tsx (clicked from explore/home page)
  useEffect(() => {
    if (!preselectedItem || !preselectedItem.id) return;
    const category = preselectedItem.category || '';
    const isMovie = category.includes('Movie');
    const isTV = category.includes('TV');
    const isAnime = preselectedItem.provider === 'anime' || category.includes('Anime');
    const movieItem: MovieItem = {
      id: preselectedItem.id,
      title: preselectedItem.title || preselectedItem.name || 'Unknown',
      type: isAnime ? 'anime' : isTV ? 'tv' : 'movie',
      tmdbId: (isMovie || isTV) ? parseInt(preselectedItem.id.replace('tmdb-', '').replace('-movie', '').replace('-tv', ''), 10) || undefined : undefined,
      idMal: isAnime ? parseInt(preselectedItem.id.replace('anime-', ''), 10) || undefined : undefined,
      poster: preselectedItem.poster,
    };
    setDetailItem(movieItem);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [preselectedItem]);
  useEffect(() => {
    loadContent();
  }, [tab, section]);

  async function loadContent() {
    setIsLoading(true);
    try {
      if (tab === 'movies') {
        setItems(await fetchMovies(section as any));
      } else if (tab === 'tv') {
        setItems(await fetchTVShows(section as any));
      } else {
        setItems(await fetchAnime(section === 'popular' ? 'popular' : 'trending'));
      }
    } catch (err) {
      console.error('Failed to load content:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch(q: string) {
    if (!q.trim()) return;
    setIsSearching(true);
    setSearchQuery(q);
    try {
      setItems(await searchAll(q, tab as MediaType));
    } finally {
      setIsSearching(false);
    }
  }

  function openPlayer(item: MovieItem) {
    setSelectedItem(item);
    setFailedCount(0);
    if (item.type === 'movie') {
      const urls = movieEmbedChain(item.tmdbId!, item.imdbId);
      setEmbedUrl(urls[0] || '');
    } else if (item.type === 'tv') {
      const urls = tvEmbedChain(item.tmdbId!, item.imdbId);
      setEmbedUrl(urls[0] || '');
    } else {
      // Anime - use anime embed chain
      const urls = animeEmbedChain(item.idMal!);
      setEmbedUrl(urls[0] || '');
    }
  }

  function nextFallback() {
    if (!selectedItem) return;
    const urls = selectedItem.type === 'movie'
      ? movieEmbedChain(selectedItem.tmdbId!, selectedItem.imdbId)
      : selectedItem.type === 'tv'
        ? tvEmbedChain(selectedItem.tmdbId!, selectedItem.imdbId)
        : selectedItem.type === 'anime'
          ? animeEmbedChain(selectedItem.idMal!)
          : [];
    const nextIndex = failedCount + 1;
    if (nextIndex < urls.length) {
      setEmbedUrl(urls[nextIndex]);
      setFailedCount(nextIndex);
    } else {
      setEmbedUrl('');
    }
  }

  function showTrailerKey(item: MovieItem) {
    // Simplified: just open a trailer in a new tab
    if (item.tmdbId) {
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(item.title + ' trailer')}`, '_blank');
    }
  }

  const tabConfig = {
    movies: { label: 'Movies', icon: Film, sections: ['popular', 'now', 'top', 'upcoming', 'trending', 'action', 'comedy', 'drama', 'horror', 'romance', 'sci_fi', 'thriller', 'animation', 'family', 'fantasy', 'adventure', 'crime', 'documentary', 'mystery', 'war', 'western'] as const },
    tv: { label: 'TV Shows', icon: Tv, sections: ['popular', 'onair', 'top', 'trending', 'airing', 'action_adventure', 'animation', 'comedy', 'crime', 'drama', 'family', 'kids', 'mystery', 'romance', 'sci_fi_fantasy', 'thriller', 'war', 'reality', 'documentary'] as const },
    anime: { label: 'Anime', icon: Sparkles, sections: ['trending', 'popular', 'action', 'adventure', 'comedy', 'drama', 'fantasy', 'horror', 'romance', 'sci_fi', 'slice_of_life', 'mecha', 'sports', 'mystery', 'thriller'] as const },
  };

  // Details page takes over when a title is opened
  if (detailItem) {
    return (
      <MovieDetailsView
        item={detailItem}
        onBack={() => setDetailItem(null)}
        onSelectItem={(s) => setDetailItem(s)}
        watchlistIds={watchlistIds}
        onToggleWatchlist={onToggleWatchlist}
      />
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-purple-600/25 border border-purple-500/50 flex items-center justify-center">
          <Film className="w-5 h-5 text-purple-300" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Movies & Shows</h1>
          <p className="text-xs text-slate-400">Latest movies, TV shows & anime</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-slate-900/80 rounded-xl w-fit">
        {(Object.keys(tabConfig) as Array<keyof typeof tabConfig>).map((t) => {
          const config = tabConfig[t];
          const Icon = config.icon;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                tab === t
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {tabConfig[tab].sections.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              section === s
                ? 'bg-purple-600 border-purple-500 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}

        {/* Search */}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder={`Search ${tabConfig[tab].label}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              className="w-48 sm:w-64 pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <button
            onClick={() => handleSearch(searchQuery)}
            disabled={isSearching}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors disabled:opacity-50"
          >
            {isSearching ? '...' : 'Search'}
          </button>
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSection('popular'); loadContent(); }}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Film className="w-10 h-10 mx-auto mb-3 opacity-40 animate-pulse" />
          Loading...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Film className="w-10 h-10 mx-auto mb-3 opacity-40" />
          No {tabConfig[tab].label} found.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/50 overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl cursor-pointer"
              onClick={() => setDetailItem(item)}
            >
              {/* Poster */}
              <div className="relative aspect-[2/3] bg-slate-800 overflow-hidden">
                <img
                  src={item.poster}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://via.placeholder.com/300x450/1e293b/64748b?text=${encodeURIComponent(item.title.slice(0, 10))}`;
                  }}
                />
                {/* Play overlay — tap to open description page */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all duration-200 pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 scale-75 group-hover:scale-100">
                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                  </div>
                </div>
                {/* Rating badge */}
                {item.rating && (
                  <div className="absolute top-2 left-2 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-bold text-yellow-400">
                    ⭐ {item.rating}
                  </div>
                )}
                {/* Type badge */}
                <div className="absolute top-2 right-2 bg-purple-600/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-white uppercase">
                  {item.type}
                </div>
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-purple-600/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-2.5">
                <h3 className="text-xs font-bold text-white line-clamp-1 group-hover:text-purple-300 transition-colors">
                  {item.title}
                </h3>
                {item.year && (
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.year}</p>
                )}
                {item.extra && (
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{item.extra}</p>
                )}
              </div>

              {/* Watchlist button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWatchlist(item.id);
                }}
                className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/50 hover:bg-black/70 transition-colors"
                title={watchlistIds.includes(item.id) ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                <Bookmark
                  className={`w-3.5 h-3.5 ${
                    watchlistIds.includes(item.id)
                      ? 'fill-purple-500 text-purple-400'
                      : 'text-slate-300'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Player Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setSelectedItem(null)} />

          {/* Modal */}
          <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedItem.title}</h2>
                <p className="text-sm text-slate-400">
                  {selectedItem.year && `${selectedItem.year} · `}
                  {selectedItem.type === 'movie' ? 'Movie' : selectedItem.type === 'tv' ? 'TV Series' : 'Anime'}
                  {selectedItem.rating && ` · ⭐ ${selectedItem.rating}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => showTrailerKey(selectedItem)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  Trailer
                </button>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Player */}
            <div className="relative aspect-video bg-black">
              {embedUrl ? (
                <iframe
                  ref={iframeRef}
                  src={embedUrl}
                  className="w-full h-full"
                  allowFullScreen
                  allow="autoplay; encrypted-media"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  onLoad={(e) => {
                    // Check if iframe loaded successfully
                    const iframe = e.currentTarget;
                    try {
                      if (!iframe.contentDocument?.body || iframe.contentDocument.body.innerHTML === '') {
                        nextFallback();
                      }
                    } catch {
                      // Cross-origin, assume loaded
                    }
                  }}
                  onError={() => nextFallback()}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                  <RotateCcw className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No working stream available</p>
                </div>
              )}
              {/* Fallback button */}
              {failedCount > 0 && (
                <button
                  onClick={nextFallback}
                  className="absolute bottom-4 right-4 px-3 py-2 bg-black/80 hover:bg-black/90 border border-slate-600 rounded-lg text-sm text-white transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Next Source ({failedCount})
                </button>
              )}
              {/* Autoplay next item button */}
              <button
                onClick={() => {
                  const idx = items.findIndex(i => i.id === selectedItem.id);
                  const next = idx < items.length - 1 ? items[idx + 1] : items[0];
                  if (next) {
                    setSelectedItem(next);
                    setFailedCount(0);
                    if (next.type === 'movie') {
                      setEmbedUrl(movieEmbedChain(next.tmdbId!, next.imdbId)[0] || '');
                    } else if (next.type === 'tv') {
                      setEmbedUrl(tvEmbedChain(next.tmdbId!, next.imdbId)[0] || '');
                    } else {
                      setEmbedUrl(animeEmbedChain(next.idMal!)[0] || '');
                    }
                  }
                }}
                className="absolute bottom-4 left-4 px-3 py-2 bg-purple-600/80 hover:bg-purple-500 border border-purple-500/50 rounded-lg text-sm text-white transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Autoplay Next
              </button>
            </div>

            {/* Info */}
            {selectedItem.overview && (
              <div className="px-6 py-4 border-t border-slate-800">
                <p className="text-sm text-slate-300 leading-relaxed">{selectedItem.overview}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};