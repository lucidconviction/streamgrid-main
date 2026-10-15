import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Loader2, Play, Music } from 'lucide-react';
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

// ArtistGrid style card — matches artistgrid.cx
const ArtistCard: React.FC<{ artist: Artist; onClick: () => void }> = ({ artist, onClick }) => (
  <button
    onClick={onClick}
    className="group bg-slate-950 hover:bg-slate-900 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-white/10 text-left w-full"
  >
    <div className="relative aspect-[3/4] overflow-hidden">
      <img
        src={artist.thumbnail || 'https://via.placeholder.com/300x400/1e293b/475569?text=♪'}
        alt={artist.name}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <Play className="w-6 h-6 text-white ml-0.5" />
        </div>
      </div>
    </div>
    <div className="p-3">
      <p className="text-sm font-bold text-white truncate">{artist.name}</p>
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

  const handleArtistClick = useCallback(async (artist: Artist) => {
    setActiveLoadingArtist(artist.name);
    onSetLoadingTracks?.(true);

    try {
      const result = await fetchArtistTracks(artist.name);
      if (result && result.tracks.length > 0) {
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
        <h1 className="text-4xl font-black tracking-tight text-white mb-2">
          Music<span className="text-yellow-400">.</span>
        </h1>
        <p className="text-slate-400 font-medium">Full-length tracks from YouTube — powered by yt-dlp</p>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search artists..."
              className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-12 pr-4 py-4 text-base text-white placeholder-slate-500 focus:outline-none focus:border-yellow-400/60 transition-colors font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !searchQuery.trim()}
            className="px-6 py-4 bg-yellow-400 hover:bg-yellow-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl text-base font-black transition-colors shadow-lg shadow-yellow-400/30"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
          </button>
        </form>

        {/* Search History */}
        {searchHistory.length > 0 && !showResults && (
          <div className="mt-3 flex flex-wrap gap-2">
            {searchHistory.slice(0, 6).map((q) => (
              <button
                key={q}
                onClick={() => handleHistoryClick(q)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/30 border border-red-800/50 text-red-400 text-sm font-bold">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="py-20 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mb-4" />
          <p className="text-base font-bold text-white">Searching...</p>
        </div>
      )}

      {/* Track loading overlay for active artist */}
      {activeLoadingArtist && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center min-w-[320px]">
            <Loader2 className="w-10 h-10 text-yellow-400 animate-spin mb-4" />
            <p className="text-base font-bold text-white">Loading tracks</p>
            <p className="text-sm text-slate-400 mt-1">{activeLoadingArtist}</p>
            <p className="text-xs text-slate-500 mt-2">Fetching from YouTube via yt-dlp…</p>
          </div>
        </div>
      )}

      {/* Top 50 Artists Grid */}
      {!showResults && !isLoading && !activeLoadingArtist && (
        <div>
          {isLoadingTop50 ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mb-4" />
              <p className="text-base font-bold text-white">Loading top artists…</p>
              <p className="text-xs text-slate-500 mt-2">Building your music library</p>
            </div>
          ) : top50Artists.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-white">
                  Top 50 Artists
                  {top50Artists.length === 50 && (
                    <span className="ml-2 text-sm font-mono text-emerald-400 font-bold">✓ Cached</span>
                  )}
                </h2>
                <span className="text-sm font-mono text-slate-500 font-bold">{top50Artists.length}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {top50Artists.map((artist, i) => (
                  <ArtistCard
                    key={`${artist.name}-${i}`}
                    artist={artist}
                    onClick={() => handleArtistClick(artist)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center mb-4">
                <Music className="w-10 h-10 text-slate-600" />
              </div>
              <p className="text-lg font-bold text-slate-300 mb-2">No artists yet</p>
              <p className="text-sm text-slate-500">Search for an artist to get started</p>
            </div>
          )}
        </div>
      )}

      {/* Search Results Grid */}
      {showResults && !isLoading && artists.length > 0 && !activeLoadingArtist && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-white">
              Results for &quot;{searchQuery}&quot;
            </h2>
            <span className="text-sm font-mono text-slate-500 font-bold">{artists.length}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {artists.map((artist, i) => (
              <ArtistCard
                key={`${artist.name}-${i}`}
                artist={artist}
                onClick={() => handleArtistClick(artist)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty search results */}
      {showResults && !isLoading && artists.length === 0 && !activeLoadingArtist && (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center mb-4">
            <Search className="w-10 h-10 text-slate-600" />
          </div>
          <p className="text-lg font-bold text-slate-300 mb-2">No artists found</p>
          <p className="text-sm text-slate-500">Try a different search term</p>
        </div>
      )}
    </div>
  );
};
