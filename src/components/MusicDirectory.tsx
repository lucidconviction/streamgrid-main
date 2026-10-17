import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Search, Home, Library, Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Heart, Repeat, Shuffle, Music as MusicIcon,
  Clock, ChevronLeft, ChevronRight, User, Settings,
  Home as HomeIcon, Search as SearchIcon, Library as LibraryIcon,
  Disc, Radio, TrendingUp, Star,
} from 'lucide-react';
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

const THEME = {
  accent: '#3b82f6',
  accentHover: '#2563eb',
  bg: '#0a0f1c',
  surface: '#121826',
  surface2: '#1a2235',
  surface3: '#243049',
  text: '#e8ecf4',
  textMuted: '#8b97ad',
  white: '#FFFFFF',
};

/** Time-based greeting */
const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const formatTime = (seconds: number): string => {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ─── Mini Player (bottom bar) ────────────────────────────────────────────────

interface MiniPlayerProps {
  currentTrack: MusicTrack | null;
  artistName: string;
  artistThumbnail: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (v: number) => void;
  onMute: () => void;
  onExpand: () => void;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({
  currentTrack, artistName, artistThumbnail, isPlaying,
  currentTime, duration, volume,
  onPlayPause, onNext, onPrev, onSeek, onVolumeChange, onMute, onExpand,
}) => {
  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-20 bg-[#121826] border-t border-[#1a2235] flex items-center px-4" style={{ paddingLeft: '160px' }}>
      {/* Track info */}
      <div className="flex items-center gap-3 w-[30%] min-w-0">
        <img
          src={artistThumbnail || '/hero.png'}
          alt={artistName}
          className="w-14 h-14 rounded object-cover shrink-0"
        />
        <div className="min-w-0">
          <p className="text-white text-sm font-bold truncate">{currentTrack.title}</p>
          <p className="text-[#8b97ad] text-xs truncate">{artistName}</p>
        </div>
        <button className="text-[#8b97ad] hover:text-white ml-2 shrink-0 transition-colors">
          <Heart className="w-4 h-4" />
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center flex-1 max-w-xl">
        <div className="flex items-center gap-4 mb-1">
          <button className="text-[#8b97ad] hover:text-white transition-colors" title="Shuffle">
            <Shuffle className="w-4 h-4" />
          </button>
          <button onClick={onPrev} className="text-[#8b97ad] hover:text-white transition-colors" title="Previous">
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={onPlayPause}
            className="w-8 h-8 rounded-full bg-white hover:scale-105 flex items-center justify-center transition-transform"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4 text-black fill-current" /> : <Play className="w-4 h-4 text-black fill-current ml-0.5" />}
          </button>
          <button onClick={onNext} className="text-[#8b97ad] hover:text-white transition-colors" title="Next">
            <SkipForward className="w-5 h-5" />
          </button>
          <button className="text-[#8b97ad] hover:text-white transition-colors" title="Repeat">
            <Repeat className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 w-full">
          <span className="text-[11px] text-[#8b97ad] font-mono w-10 text-right">{formatTime(currentTime)}</span>
          <div
            className="flex-1 h-1 bg-[#243049] rounded-full cursor-pointer group relative"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              onSeek(ratio * duration);
            }}
          >
            <div
              className="h-full bg-white group-hover:bg-[#3b82f6] rounded-full transition-colors"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
          <span className="text-[11px] text-[#8b97ad] font-mono w-10">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume + expand */}
      <div className="flex items-center gap-3 w-[30%] justify-end">
        <button onClick={onMute} className="text-[#8b97ad] hover:text-white transition-colors">
          {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <input
          type="range" min="0" max="100" value={volume}
          onChange={(e) => onVolumeChange(parseInt(e.target.value))}
          className="w-24 h-1 accent-[#3b82f6] cursor-pointer"
        />
        <button onClick={onExpand} className="text-[#8b97ad] hover:text-white transition-colors" title="Expand player">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ─── Full Player Modal ────────────────────────────────────────────────────────

interface FullPlayerProps {
  currentTrack: MusicTrack;
  trackIndex: number;
  tracks: MusicTrack[];
  artistName: string;
  artistThumbnail: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onClose: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (v: number) => void;
  onTrackSelect: (index: number) => void;
}

const FullPlayer: React.FC<FullPlayerProps> = ({
  currentTrack, trackIndex, tracks, artistName, artistThumbnail,
  isPlaying, currentTime, duration, volume,
  onClose, onPlayPause, onNext, onPrev, onSeek, onVolumeChange, onTrackSelect,
}) => {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0f1c] flex flex-col" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <button onClick={onClose} className="text-white hover:scale-110 transition-transform">
          <ChevronLeft className="w-8 h-8" />
        </button>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#8b97ad]">Now Playing</p>
        <div className="w-8" />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Album art + controls */}
        <div className="flex-1 flex flex-col items-center justify-center px-12">
          <img
            src={artistThumbnail || '/hero.png'}
            alt={artistName}
            className="w-72 h-72 rounded-lg shadow-2xl object-cover mb-8"
          />
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-2xl font-black text-white">{currentTrack.title}</h2>
                <p className="text-[#8b97ad] text-base mt-1">{artistName}</p>
              </div>
              <Heart className="w-7 h-7 text-[#3b82f6] fill-current" />
            </div>

            {/* Progress */}
            <div className="mt-6 mb-2">
              <div
                className="h-1 bg-[#243049] rounded-full cursor-pointer group relative"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  onSeek(ratio * duration);
                }}
              >
                <div className="h-full bg-white group-hover:bg-[#3b82f6] rounded-full transition-colors" style={{ width: `${progress}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `calc(${progress}% - 6px)` }} />
              </div>
              <div className="flex justify-between text-[11px] text-[#8b97ad] font-mono mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mt-4">
              <button className="text-[#8b97ad] hover:text-white"><Shuffle className="w-5 h-5" /></button>
              <button onClick={onPrev} className="text-white hover:scale-110 transition-transform"><SkipBack className="w-7 h-7" /></button>
              <button
                onClick={onPlayPause}
                className="w-14 h-14 rounded-full bg-white hover:scale-105 flex items-center justify-center transition-transform"
              >
                {isPlaying ? <Pause className="w-6 h-6 text-black fill-current" /> : <Play className="w-6 h-6 text-black fill-current ml-1" />}
              </button>
              <button onClick={onNext} className="text-white hover:scale-110 transition-transform"><SkipForward className="w-7 h-7" /></button>
              <button className="text-[#8b97ad] hover:text-white"><Repeat className="w-5 h-5" /></button>
            </div>
          </div>
        </div>

        {/* Track list */}
        <div className="w-96 bg-[#121826] overflow-y-auto">
          <div className="px-6 py-4 border-b border-[#1a2235]">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#8b97ad]">{tracks.length} Tracks</p>
          </div>
          {tracks.map((track, i) => (
            <button
              key={track.url || i}
              onClick={() => onTrackSelect(i)}
              className={`w-full flex items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-[#1a2235] ${i === trackIndex ? 'bg-[#1a2235]' : ''}`}
            >
              <span className={`w-6 text-center text-sm font-mono ${i === trackIndex ? 'text-[#3b82f6]' : 'text-[#8b97ad]'}`}>
                {i === trackIndex && isPlaying ? (
                  <span className="flex items-center justify-center gap-0.5">
                    {[...Array(3)].map((_, j) => (
                      <span key={j} className="w-0.5 bg-[#3b82f6] animate-pulse" style={{ height: `${8 + j * 3}px`, animationDelay: `${j * 0.15}s` }} />
                    ))}
                  </span>
                ) : (
                  i + 1
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate ${i === trackIndex ? 'text-[#3b82f6]' : 'text-white'}`}>{track.title}</p>
                <p className="text-xs text-[#8b97ad] truncate">{track.artist || artistName}</p>
              </div>
              <span className="text-xs text-[#8b97ad] font-mono">{formatTime(track.duration)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main Music Directory (Spotify Layout) ────────────────────────────────────

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
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [top50Artists, setTop50Artists] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTop50, setIsLoadingTop50] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Player state
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeArtistName, setActiveArtistName] = useState('');
  const [activeArtistThumbnail, setActiveArtistThumbnail] = useState('');
  const [activeTracks, setActiveTracks] = useState<MusicTrack[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTrack = activeTracks[currentTrackIndex];

  // Load cached top 50
  useEffect(() => {
    const cached = get_cachedTop50Artists();
    if (cached && cached.length >= 50) {
      setTop50Artists(cached);
      setIsLoadingTop50(false);
    }
  }, []);

  // Load top 50
  useEffect(() => {
    if (top50Artists.length > 0) return;
    fetchTop50Artists().then(setTop50Artists).finally(() => setIsLoadingTop50(false));
  }, [top50Artists.length]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === ' ' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentTrack, isPlaying]);

  // Audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    audio.src = currentTrack.url;
    audio.load();
    if (isPlaying) audio.play().catch(() => {});
    audio.volume = volume / 100;
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      if (currentTrackIndex < activeTracks.length - 1) {
        setCurrentTrackIndex(i => i + 1);
      } else {
        setIsPlaying(false);
      }
    };
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentTrackIndex, activeTracks.length]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  // Search
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    setSearchActive(true);
    try {
      const results = await searchArtists(query, 30);
      setArtists(results);
    } catch {
      setError('Failed to search. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };

  // Player controls
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, currentTrack]);

  const nextTrack = useCallback(() => {
    setCurrentTrackIndex(prev => (prev + 1) % activeTracks.length);
    setIsPlaying(true);
  }, [activeTracks.length]);

  const prevTrack = useCallback(() => {
    setCurrentTrackIndex(prev => (prev - 1 + activeTracks.length) % activeTracks.length);
    setIsPlaying(true);
  }, [activeTracks.length]);

  const handleSeek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleArtistClick = useCallback(async (artist: Artist) => {
    onSetLoadingTracks?.(true);
    try {
      const result = await fetchArtistTracks(artist.name);
      if (result && result.tracks.length > 0) {
        setActiveArtistName(result.artist);
        setActiveArtistThumbnail(result.thumbnail || artist.thumbnail);
        setActiveTracks(result.tracks);
        setCurrentTrackIndex(0);
        setIsPlaying(true);
        onSetFloatingArtist?.({ name: result.artist, thumbnail: result.thumbnail || artist.thumbnail });
        onSetTracks?.(result.tracks);
      } else {
        setError(`No tracks found for "${artist.name}".`);
      }
    } catch {
      setError('Failed to load tracks. Please try again.');
    } finally {
      onSetLoadingTracks?.(false);
    }
  }, [onSetFloatingArtist, onSetTracks, onSetLoadingTracks]);

  // Clear search
  const clearSearch = () => {
    setSearchActive(false);
    setArtists([]);
    setSearchQuery('');
  };

  return (
    <div className="flex h-[calc(100vh-65px)] bg-[#000000] overflow-hidden">
      <audio ref={audioRef} preload="auto" />

      {/* ─── Sidebar ─── */}
      <nav className="w-40 bg-[#000000] flex flex-col shrink-0 py-6 px-3 gap-2">
        <div className="px-3 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#3b82f6] flex items-center justify-center">
              <MusicIcon className="w-4 h-4 text-black" />
            </div>
            <span className="text-white font-black text-sm">Music</span>
          </div>
        </div>

        <button className="flex items-center gap-4 px-3 py-2 text-white hover:text-white transition-colors text-sm font-bold">
          <HomeIcon className="w-6 h-6" />
          Home
        </button>
        <button className="flex items-center gap-4 px-3 py-2 text-white hover:text-white transition-colors text-sm font-bold">
          <SearchIcon className="w-6 h-6" />
          Search
        </button>
        <button className="flex items-center gap-4 px-3 py-2 text-white hover:text-white transition-colors text-sm font-bold">
          <LibraryIcon className="w-6 h-6" />
          Your Library
        </button>

        <div className="mt-6 pt-4 border-t border-[#1a2235]">
          <button className="flex items-center gap-4 px-3 py-2 text-[#8b97ad] hover:text-white transition-colors text-sm font-bold">
            <div className="w-6 h-6 bg-[#8b97ad] rounded flex items-center justify-center">
              <Play className="w-3 h-3 text-black fill-current" />
            </div>
            Create Playlist
          </button>
          <button className="flex items-center gap-4 px-3 py-2 text-[#8b97ad] hover:text-white transition-colors text-sm font-bold">
            <div className="w-6 h-6 bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] rounded flex items-center justify-center">
              <Heart className="w-3 h-3 text-white fill-current" />
            </div>
            Liked Songs
          </button>
        </div>
      </nav>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-[#1a2235] to-[#0a0f1c]">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 bg-[#0a0f1c]/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 text-sm font-bold text-[#8b97ad] hover:text-white transition-colors">Sign up</button>
            <button className="px-6 py-3 bg-[#3b82f6] text-white text-sm font-black rounded-full hover:bg-[#2563eb] hover:scale-105 transition-transform">Log in</button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 pb-32">
          {/* Greeting */}
          {!searchActive && (
            <h1 className="text-3xl font-black text-white mb-6">{getGreeting()}</h1>
          )}

          {/* Search */}
          <div className="mb-8">
            <form onSubmit={handleSubmit} className="relative">
              <Search className="w-5 h-5 text-[#8b97ad] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="What do you want to listen to?"
                className="w-full max-w-md bg-[#1a2235] border border-transparent focus:border-[#3b82f6] rounded-full py-3 pl-12 pr-24 text-white placeholder-[#8b97ad] font-medium text-sm focus:outline-none transition-colors"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {searchActive && (
                  <button type="button" onClick={clearSearch} className="px-3 py-1.5 text-xs font-bold text-[#8b97ad] hover:text-white bg-[#243049] rounded-full transition-colors">
                    Clear
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isLoading || !searchQuery.trim()}
                  className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-[#243049] disabled:text-[#8b97ad] text-white text-sm font-black rounded-full transition-colors flex items-center gap-2"
                >
                  {isLoading ? <Clock className="w-4 h-4 animate-spin" /> : 'Search'}
                </button>
              </div>
            </form>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-[#D25454]/20 border border-[#D25454]/40 rounded-lg text-[#D25454] text-sm font-bold">
              {error}
            </div>
          )}

          {/* Search Results */}
          {searchActive && !isLoading && (
            <div>
              <h2 className="text-2xl font-black text-white mb-4">
                {artists.length > 0 ? `Results for "${searchQuery}"` : 'No artists found'}
              </h2>
              {artists.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {artists.map((artist, i) => (
                    <ArtistCard key={`${artist.name}-${i}`} artist={artist} onClick={() => handleArtistClick(artist)} isActive={false} />
                  ))}
                </div>
              ) : (
                <div className="py-16 flex flex-col items-center text-center">
                  <SearchIcon className="w-12 h-12 text-[#8b97ad] mb-4" />
                  <p className="text-lg font-bold text-white mb-2">No artists found</p>
                  <p className="text-sm text-[#8b97ad]">Try a different search term</p>
                </div>
              )}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="py-16 flex flex-col items-center">
              <Clock className="w-10 h-10 text-[#3b82f6] animate-spin mb-4" />
              <p className="text-base font-bold text-white">Searching...</p>
            </div>
          )}

          {/* Top Artists */}
          {!searchActive && !isLoading && (
            <>
              {/* Quick picks */}
              {top50Artists.length > 0 && (
                <section className="mb-10">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-black text-white">Top Artists</h2>
                    <span className="text-xs font-bold text-[#8b97ad] uppercase tracking-widest">{top50Artists.length} artists</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {top50Artists.slice(0, 12).map((artist, i) => (
                      <ArtistCard
                        key={`${artist.name}-${i}`}
                        artist={artist}
                        onClick={() => handleArtistClick(artist)}
                        isActive={activeArtistName === artist.name}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* All top 50 */}
              {top50Artists.length > 12 && (
                <section className="mb-10">
                  <h2 className="text-xl font-black text-white mb-4">All Artists</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {top50Artists.slice(12).map((artist, i) => (
                      <ArtistCard
                        key={`${artist.name}-${i + 12}`}
                        artist={artist}
                        onClick={() => handleArtistClick(artist)}
                        isActive={activeArtistName === artist.name}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      {/* ─── Mini Player Bar ─── */}
      <MiniPlayer
        currentTrack={currentTrack || null}
        artistName={activeArtistName}
        artistThumbnail={activeArtistThumbnail}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        onPlayPause={togglePlay}
        onNext={nextTrack}
        onPrev={prevTrack}
        onSeek={handleSeek}
        onVolumeChange={setVolume}
        onMute={() => setVolume(v => v > 0 ? 0 : 80)}
        onExpand={() => setIsExpanded(true)}
      />

      {/* ─── Full Player Modal ─── */}
      {isExpanded && currentTrack && (
        <FullPlayer
          currentTrack={currentTrack}
          trackIndex={currentTrackIndex}
          tracks={activeTracks}
          artistName={activeArtistName}
          artistThumbnail={activeArtistThumbnail}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          onClose={() => setIsExpanded(false)}
          onPlayPause={togglePlay}
          onNext={nextTrack}
          onPrev={prevTrack}
          onSeek={handleSeek}
          onVolumeChange={setVolume}
          onTrackSelect={(i) => { setCurrentTrackIndex(i); setIsPlaying(true); }}
        />
      )}
    </div>
  );
};

// ─── Artist Card (Spotify style) ─────────────────────────────────────────────

const ArtistCard: React.FC<{
  artist: Artist;
  onClick: () => void;
  isActive: boolean;
}> = ({ artist, onClick, isActive }) => (
  <button
    onClick={onClick}
    className={`group rounded-lg p-3 transition-all duration-200 text-left w-full ${
      isActive ? 'bg-[#1a2235]' : 'bg-[#121826] hover:bg-[#1a2235]'
    }`}
  >
    <div className="relative aspect-square rounded-md overflow-hidden mb-3 shadow-lg">
      <img
        src={artist.thumbnail || 'https://via.placeholder.com/300x300/1e293b/475569?text=' + encodeURIComponent(artist.name)}
        alt={artist.name}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      {/* Play button */}
      <div className={`absolute bottom-2 right-2 w-12 h-12 rounded-full bg-[#3b82f6] flex items-center justify-center shadow-xl transition-all duration-300 ${
        isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
      }`}>
        <Play className="w-5 h-5 text-black fill-current ml-0.5" />
      </div>
    </div>
    <p className={`text-sm font-black truncate ${isActive ? 'text-[#3b82f6]' : 'text-white'}`}>{artist.name}</p>
    <p className="text-xs text-[#8b97ad] mt-0.5 truncate">Artist</p>
  </button>
);
