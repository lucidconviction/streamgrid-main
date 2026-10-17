import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Loader2, Play, Music, Clock } from 'lucide-react';
import {
  fetchTop50Artists, get_cachedTop50Artists, searchArtists, fetchArtistTracks,
  type Artist, type MusicTrack,
} from '../services/musicService';

interface MusicDirectoryProps {
  onPlayStream: (stream: any) => void;
  onAddToMultiview: (stream: any) => void;
  onToggleWatchlist: (stream: any) => void;
  watchlistIds: string[];
  multiviewStreamIds: string[];
  onSetFloatingArtist?: (artist: { name: string; thumbnail: string } | null) => void;
  onSetTracks?: (tracks: MusicTrack[]) => void;
  onSetLoadingTracks?: (loading: boolean) => void;
}

/** Animated equalizer bars — the Musike brand signature (musike-eq CSS in index.css) */
const Equalizer: React.FC<{ paused?: boolean }> = ({ paused }) => (
  <span className="musike-eq" style={paused ? { animationPlayState: 'paused', opacity: 0.4 } : undefined} aria-hidden="true">
    <span />
    <span />
    <span />
    <span />
    <span />
    <span />
    <span />
  </span>
);

/** Artist card — Musike style: square tile, 14px radius, tone separation, pill play button */
const ArtistCard: React.FC<{
  artist: Artist;
  onClick: () => void;
  isActive: boolean;
  isPlaying: boolean;
}> = ({ artist, onClick, isActive, isPlaying }) => (
  <button
    onClick={onClick}
    className={`group musike-card-radius overflow-hidden text-left w-full transition-all duration-300 musike-transition
      ${isActive ? 'musike-active-ring musike-surface-2' : 'musike-surface-1 hover:musike-surface-2'}
      musike-press`}
  >
    <div className="relative aspect-square overflow-hidden">
      <img
        src={artist.thumbnail || 'https://via.placeholder.com/300x300/1e293b/475569?text=' + encodeURIComponent(artist.name)}
        alt={artist.name}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
      {/* Overlay with play pill */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent transition-opacity duration-300 flex items-end justify-between p-3 ${
          isActive || isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <span className="musike-eq flex-1" aria-hidden="true">
          <span style={isPlaying ? undefined : { animationPlayState: 'paused' }} />
          <span style={isPlaying ? undefined : { animationPlayState: 'paused' }} />
          <span style={isPlaying ? undefined : { animationPlayState: 'paused' }} />
          <span style={isPlaying ? undefined : { animationPlayState: 'paused' }} />
          <span style={isPlaying ? undefined : { animationPlayState: 'paused' }} />
          <span style={isPlaying ? undefined : { animationPlayState: 'paused' }} />
          <span style={isPlaying ? undefined : { animationPlayState: 'paused' }} />
        </span>
        <span
          className="musike-pill w-10 h-10 flex items-center justify-center bg-[#3b82f6] text-[#0a0f1c] shadow-lg shrink-0 musike-transition"
          aria-hidden="true"
        >
          <Play className="w-4 h-4 fill-current ml-0.5" />
        </span>
      </div>
    </div>
    <div className="px-3 py-2.5 flex items-center justify-between gap-2">
      <p className="text-[13px] font-bold text-[#e8ecf4] truncate">{artist.name}</p>
      {isActive && <span className="musike-text-3 text-[10px] font-mono shrink-0">NOW PLAYING</span>}
    </div>
  </button>
);

const formatTime = (seconds: number): string => {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const MusicDirectory: React.FC<MusicDirectoryProps> = ({
  onPlayStream,
  onAddToMultiview,
  onToggleWatchlist,
  watchlistIds,
  multiviewStreamIds,
  onSetFloatingArtist,
  onSetTracks,
  onSetLoadingTracks,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [top50Artists, setTop50Artists] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTop50, setIsLoadingTop50] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [activeLoadingArtist, setActiveLoadingArtist] = useState<string | null>(null);
  const [activeArtist, setActiveArtist] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load cached top 50 from localStorage on mount
  useEffect(() => {
    const cached = get_cachedTop50Artists();
    if (cached && cached.length >= 50) {
      setTop50Artists(cached);
      setIsLoadingTop50(false);
    }
  }, []);

  // Load top 50 artists on mount (if not cached)
  useEffect(() => {
    if (top50Artists.length > 0) return;

    const loadTop50 = async () => {
      try {
        const results = await fetchTop50Artists();
        setTop50Artists(results);
      } catch (e) {
        console.error('Top 50 load failed:', e);
      } finally {
        setIsLoadingTop50(false);
      }
    };
    loadTop50();
  }, [top50Artists.length]);

  // Keyboard shortcut: "/" focuses search (desktop)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setShowResults(true);

    try {
      const results = await searchArtists(query, 30);
      setArtists(results);

      setSearchHistory(prev => {
        const updated = [query, ...prev.filter(q => q !== query)].slice(0, 8);
        return updated;
      });
    } catch (e) {
      setError('Failed to search. Please try again.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };

  const handleHistoryClick = (query: string) => {
    setSearchQuery(query);
    handleSearch(query);
  };

  const handleClearResults = () => {
    setShowResults(false);
    setArtists([]);
    setSearchQuery('');
  };

  const handleArtistClick = useCallback(async (artist: Artist) => {
    setActiveLoadingArtist(artist.name);
    onSetLoadingTracks?.(true);

    try {
      const result = await fetchArtistTracks(artist.name);
      if (result && result.tracks.length > 0) {
        setActiveArtist(artist.name);
        onSetFloatingArtist?.({ name: result.artist, thumbnail: result.thumbnail || artist.thumbnail });
        onSetTracks?.(result.tracks);
      } else {
        setError(`No tracks found for "${artist.name}".`);
      }
    } catch (e) {
      console.error('Failed to load tracks:', e);
      setError('Failed to load tracks. Please try again.');
    } finally {
      setActiveLoadingArtist(null);
      onSetLoadingTracks?.(false);
    }
  }, [onSetFloatingArtist, onSetTracks, onSetLoadingTracks]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 relative">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 musike-panel-radius musike-island flex items-center justify-center">
            <Music className="w-6 h-6 musike-accent-text" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white mb-0.5">
              Music<span className="musike-accent-text">.</span>
            </h1>
            <p className="text-sm font-medium" style={{ color: 'var(--musike-text-2)' }}>
              Your music, no interruptions — full-length tracks from YouTube
            </p>
          </div>
        </div>
      </div>

      {/* Search — pill input, one tap, no separate button */}
      <div className="mb-8">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Search className="w-5 h-5 musike-text-3 absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search artists…  (press / to focus)"
              className="musike-pill w-full musike-surface-2 border font-medium pr-24 py-4 text-base text-[#e8ecf4] placeholder-[#5a6580] focus:outline-none transition-colors duration-200
                border-[rgb(255_255_255/0.08)] focus:border-[rgba(59,130,246,0.5)] musike-transition"
              style={{ paddingLeft: '3.25rem' }}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {showResults && (
                <button
                  type="button"
                  onClick={handleClearResults}
                  className="musike-pill px-4 h-9 text-xs font-bold musike-text-2 hover:text-white musike-surface-3 musike-transition musike-press"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                disabled={isLoading || !searchQuery.trim()}
                className="musike-pill h-10 px-5 bg-[#3b82f6] hover:bg-[#2563eb] disabled:musike-surface-3 disabled:text-[#5a6580] text-[#0a0f1c] text-sm font-black transition-colors duration-200 musike-transition musike-press flex items-center"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </button>
            </div>
          </div>
        </form>

        {/* Search History chips */}
        {searchHistory.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <Clock className="w-3.5 h-3.5 musike-text-3" />
            {searchHistory.slice(0, 6).map((q) => (
              <button
                key={q}
                onClick={() => handleHistoryClick(q)}
                className="musike-pill px-3.5 py-1.5 musike-surface-1 hover:musike-surface-2 border border-[rgb(255_255_255/0.07)] text-xs font-bold musike-text-2 hover:text-white transition-colors duration-200 musike-transition musike-press"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 musike-card-radius bg-red-950/30 border border-red-800/50 text-red-400 text-sm font-bold">
          {error}
        </div>
      )}

      {/* Search Loading State */}
      {isLoading && (
        <div className="py-20 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 musike-accent-text animate-spin mb-4" />
          <p className="text-base font-bold text-white">Searching…</p>
        </div>
      )}

      {/* Track loading overlay for active artist */}
      {activeLoadingArtist && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="musike-island musike-panel-radius p-8 flex flex-col items-center w-[90vw] max-w-sm">
            <div className="w-14 h-14 musike-pill musike-surface-2 flex items-center justify-center mb-4">
              <Loader2 className="w-7 h-7 musike-accent-text animate-spin" />
            </div>
            <p className="text-base font-bold text-white">Loading tracks</p>
            <p className="text-sm mt-1" style={{ color: 'var(--musike-text-2)' }}>{activeLoadingArtist}</p>
            <p className="text-xs mt-3 font-mono musike-mono musike-text-3">resolving stream · yt-dlp</p>
          </div>
        </div>
      )}

      {/* Top 50 Artists Grid */}
      {!showResults && !isLoading && !activeLoadingArtist && (
        <div>
          {isLoadingTop50 ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 musike-accent-text animate-spin mb-4" />
              <p className="text-base font-bold text-white">Loading top artists…</p>
              <p className="text-xs font-mono musike-mono musike-text-3 mt-2">building your music library</p>
            </div>
          ) : top50Artists.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-white tracking-tight">
                  Top 50 Artists
                  {top50Artists.length === 50 && (
                    <span className="ml-2 text-sm font-mono musike-mono musike-accent-text font-bold">✓ cached</span>
                  )}
                </h2>
                <span className="text-sm font-mono musike-mono musike-text-3">{top50Artists.length}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {top50Artists.map((artist, i) => (
                  <ArtistCard
                    key={`${artist.name}-${i}`}
                    artist={artist}
                    onClick={() => handleArtistClick(artist)}
                    isActive={activeArtist === artist.name}
                    isPlaying={activeArtist === artist.name}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 musike-pill musike-surface-1 musike-island flex items-center justify-center mb-4">
                <Music className="w-10 h-10 text-[#5a6580]" />
              </div>
              <p className="text-lg font-bold text-[#cbd5e1] mb-2">No artists yet</p>
              <p className="text-sm" style={{ color: 'var(--musike-text-2)' }}>Search for an artist to get started</p>
            </div>
          )}
        </div>
      )}

      {/* Search Results Grid */}
      {showResults && !isLoading && artists.length > 0 && !activeLoadingArtist && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-white tracking-tight">
              Results for &quot;{searchQuery}&quot;
            </h2>
            <span className="text-sm font-mono musike-mono musike-text-3">{artists.length}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {artists.map((artist, i) => (
              <ArtistCard
                key={`${artist.name}-${i}`}
                artist={artist}
                onClick={() => handleArtistClick(artist)}
                isActive={activeArtist === artist.name}
                isPlaying={activeArtist === artist.name}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty search results */}
      {showResults && !isLoading && artists.length === 0 && !activeLoadingArtist && (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 musike-pill musike-surface-1 musike-island flex items-center justify-center mb-4">
            <Search className="w-10 h-10 text-[#5a6580]" />
          </div>
          <p className="text-lg font-bold text-[#cbd5e1] mb-2">No artists found</p>
          <p className="text-sm" style={{ color: 'var(--musike-text-2)' }}>Try a different search term</p>
        </div>
      )}
    </div>
  );
};
