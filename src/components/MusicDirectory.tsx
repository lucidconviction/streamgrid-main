import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Search, Play, Pause, SkipBack, SkipForward,
  ChevronLeft,
  Search as SearchIcon, Clock, Music2, Disc3,
} from 'lucide-react';
import {
  fetchTop50Artists, get_cachedTop50Artists, fetchTop100Artists, get_cachedTop100Artists, searchArtists,
  fetchArtistCatalog, fetchAlbumTracks,
  getSearchHistory, addSearchHistory, clearSearchHistory,
  getRecentArtists, addRecentArtist,
  searchArtistsByGenre, GENRES, type GenreId,
  type Artist, type MusicTrack, type ArtistCatalog, type AlbumData, type Album,
  getPlaylists, createPlaylist, deletePlaylist,
  fetchPopularTracks, fetchRadioTracks, type MusicPlaylist,
} from '../services/musicService';
import {
  Plus, Trash2, Heart, ListMusic, Radio, Shuffle, Flame,
  Play as PlayIcon, ChevronRight, Pencil, Check, X as XIcon,
} from 'lucide-react';

interface MusicDirectoryProps {
  onPlayStream: (stream: any) => void;
  onAddToMultiview: (stream: any) => void;
  onToggleWatchlist: (stream: any) => void;
  watchlistIds: string[];
  multiviewStreamIds: string[];
  onSetFloatingArtist?: (artist: { name: string; thumbnail: string } | null) => void;
  onSetTracks?: (tracks: MusicTrack[], startIndex?: number, channelId?: string) => void;
  onSetLoadingTracks?: (loading: boolean) => void;
  defaultPlayMode?: 'audio' | 'video';
  onSetPlayMode?: (mode: 'audio' | 'video') => void;
}

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
  defaultPlayMode,
  onSetPlayMode,
}) => {
  // ── Browse state ──
  const [view, setView] = useState<'home' | 'artist' | 'album' | 'playlists'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [top50Artists, setTop50Artists] = useState<Artist[]>([]);
  const [top100Artists, setTop100Artists] = useState<Artist[]>([]);
  const [activeGenre, setActiveGenre] = useState<GenreId>('all');
  const [genreArtists, setGenreArtists] = useState<Artist[]>([]);
  const [isGenreLoading, setIsGenreLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [recentArtists, setRecentArtists] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTop50, setIsLoadingTop50] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Player state (mirrors floating player in App) ──
  const [activeTracks, setActiveTracks] = useState<MusicTrack[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [activeChannelId, setActiveChannelId] = useState('');
  const [playMode, setPlayMode] = useState<'audio' | 'video'>(() => {
    try { return localStorage.getItem('rdnutz_music_playmode') as 'audio' | 'video' || defaultPlayMode || 'audio'; } catch { return defaultPlayMode || 'audio'; }
  });

  // Persist play mode
  useEffect(() => {
    try { localStorage.setItem('rdnutz_music_playmode', playMode); } catch {}
    onSetPlayMode?.(playMode);
  }, [playMode]);

  // ── Artist / Album view state ──
  const [catalog, setCatalog] = useState<ArtistCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [albumData, setAlbumData] = useState<AlbumData | null>(null);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [albumBackTo, setAlbumBackTo] = useState<Album | null>(null);

  const activeArtistName = catalog?.artist || '';
  const activeArtistThumbnail = catalog?.thumbnail || '';

  // ── Playlist state ──
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>(getPlaylists());
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlistModalMode, setPlaylistModalMode] = useState<'create' | 'add'>('create');
  const [playlistNameInput, setPlaylistNameInput] = useState('');
  const [playlistSelectedTracks, setPlaylistSelectedTracks] = useState<Set<string>>(new Set());
  const [quickMixTracks, setQuickMixTracks] = useState<MusicTrack[]>([]);
  const [quickMixLoading, setQuickMixLoading] = useState(false);
  const [quickPopularTracks, setQuickPopularTracks] = useState<MusicTrack[]>([]);
  const [quickPopularLoading, setQuickPopularLoading] = useState(false);

  // ── Genre selection modal ──
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [genreModalMode, setGenreModalMode] = useState<'mix' | 'popular'>('mix');

  // ── Start/replace the global floating player queue ──
  const playQueue = useCallback((tracks: MusicTrack[], index: number, artist: { name: string; thumbnail: string }, channelId?: string) => {
    if (!tracks.length) return;
    onSetFloatingArtist?.(artist);
    onSetTracks?.(tracks, index, channelId || '');
    setActiveTracks(tracks);
    setCurrentTrackIndex(index);
    if (channelId) setActiveChannelId(channelId);
  }, [onSetFloatingArtist, onSetTracks]);

  // ── Playlist actions ──────────────────────────────────────────────────────────

  const openCreatePlaylist = (fromTracks?: MusicTrack[], name = '') => {
    setPlaylistModalMode('create');
    setPlaylistNameInput(name);
    setPlaylistSelectedTracks(new Set(fromTracks?.map(t => t.video_id || '').filter(Boolean)));
    setShowPlaylistModal(true);
  };

  const openAddToPlaylist = (tracks: MusicTrack[]) => {
    setPlaylistModalMode('add');
    setPlaylistNameInput('');
    setPlaylistSelectedTracks(new Set(tracks.map(t => t.video_id || '').filter(Boolean)));
    setShowPlaylistModal(true);
  };

  const handleSavePlaylist = () => {
    if (!playlistNameInput.trim()) return;
    const selected = activeTracks.filter(t => playlistSelectedTracks.has(t.video_id || ''));
    if (selected.length === 0) return;
    const pl = createPlaylist(playlistNameInput.trim(), selected);
    setPlaylists(getPlaylists());
    setShowPlaylistModal(false);
    setPlaylistNameInput('');
    setPlaylistSelectedTracks(new Set());
  };

  const handleDeletePlaylist = (id: string) => {
    deletePlaylist(id);
    setPlaylists(getPlaylists());
  };

  const handlePlayPlaylist = (pl: MusicPlaylist) => {
    playQueue(pl.tracks, 0, { name: pl.name, thumbnail: pl.tracks[0]?.thumbnail || '' });
  };

  const openGenreModal = (mode: 'mix' | 'popular') => {
    setGenreModalMode(mode);
    setShowGenreModal(true);
  };

  const handlePlayGenre = async (genreId: GenreId) => {
    setShowGenreModal(false);
    if (genreModalMode === 'mix') {
      await playGenreMix(genreId);
    } else {
      await playGenrePopular(genreId);
    }
  };

  const playGenreMix = async (genreId: GenreId) => {
    setQuickMixLoading(true);
    try {
      const genreArtists = await searchArtistsByGenre(genreId, 40);
      const shuffled = genreArtists.sort(() => Math.random() - 0.5).slice(0, 15);
      const allTracks: MusicTrack[] = [];
      for (const a of shuffled) {
        const c = await fetchArtistCatalog(a.name, 5);
        if (c && c.tracks.length > 0) {
          allTracks.push(...c.tracks);
        }
        if (allTracks.length >= 30) break;
      }
      const mixed = allTracks.sort(() => Math.random() - 0.5);
      setQuickMixTracks(mixed);
      if (mixed.length > 0) {
        playQueue(mixed, 0, { name: `${GENRES.find(g => g.id === genreId)?.label || genreId} Mix`, thumbnail: '' });
      }
    } finally {
      setQuickMixLoading(false);
    }
  };

  const playGenrePopular = async (genreId: GenreId) => {
    setQuickPopularLoading(true);
    try {
      const genreArtists = await searchArtistsByGenre(genreId, 20);
      const allTracks: MusicTrack[] = [];
      for (const a of genreArtists) {
        const c = await fetchArtistCatalog(a.name, 3);
        if (c && c.tracks.length > 0) {
          allTracks.push(...c.tracks);
        }
        if (allTracks.length >= 30) break;
      }
      const shuffled = allTracks.sort(() => Math.random() - 0.5);
      setQuickPopularTracks(shuffled);
      if (shuffled.length > 0) {
        playQueue(shuffled, 0, { name: `${GENRES.find(g => g.id === genreId)?.label || genreId} Popular`, thumbnail: '' });
      }
    } finally {
      setQuickPopularLoading(false);
    }
  };
  const handleArtistClick = useCallback(async (artist: Artist) => {
    addRecentArtist(artist);
    setRecentArtists(getRecentArtists());
    setError(null);
    setView('artist');
    setCatalog(null);
    setCatalogLoading(true);
    onSetLoadingTracks?.(true);
    try {
      const c = await fetchArtistCatalog(artist.name, 30);
      if (c && (c.tracks.length > 0 || c.albums.length > 0)) {
        setCatalog(c);
        if (c.tracks.length > 0) {
          playQueue(c.tracks, 0, { name: c.artist, thumbnail: c.thumbnail }, c.channel_id);
        }
      } else {
        setCatalog(null);
        setError(`No music found for "${artist.name}".`);
      }
    } catch {
      setError('Failed to load artist. Please try again.');
    } finally {
      setCatalogLoading(false);
      onSetLoadingTracks?.(false);
    }
  }, [onSetLoadingTracks, playQueue]);

  // ── Album click: fetch album tracks ──
  const handleAlbumClick = useCallback(async (album: Album, thumb: string) => {
    setView('album');
    setAlbumBackTo(album);
    setAlbumData(null);
    setAlbumLoading(true);
    setError(null);
    try {
      const d = await fetchAlbumTracks(album.playlist_id, thumb);
      if (d && d.tracks.length > 0) {
        setAlbumData(d);
      } else {
        setError(`No tracks found in "${album.title}".`);
        setView('artist');
      }
    } catch {
      setError('Failed to load album. Please try again.');
      setView('artist');
    } finally {
      setAlbumLoading(false);
    }
  }, []);

  // ── Browse: top artists ──
  useEffect(() => {
    const cached = get_cachedTop50Artists();
    if (cached && cached.length >= 50) {
      setTop50Artists(cached);
      setIsLoadingTop50(false);
    }
  }, []);

  useEffect(() => {
    if (top100Artists.length > 0) return;
    fetchTop100Artists().then(setTop100Artists).finally(() => setIsLoadingTop50(false));
  }, [top100Artists.length]);

  // ── Keyboard: '/' focuses search ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ── Load search history & recent artists ──
  useEffect(() => {
    setSearchHistory(getSearchHistory());
    setRecentArtists(getRecentArtists());
  }, []);

  // ── Genre selection ──
  const handleGenreSelect = useCallback(async (genreId: GenreId) => {
    if (genreId === activeGenre && !searchActive) return;
    setActiveGenre(genreId);
    if (genreId === 'all') {
      setGenreArtists([]);
      return;
    }
    setIsGenreLoading(true);
    try {
      const results = await searchArtistsByGenre(genreId, 40);
      setGenreArtists(results);
    } catch {
      setGenreArtists([]);
    } finally {
      setIsGenreLoading(false);
    }
  }, [activeGenre, searchActive]);

  // ── Search ──
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || isLoading) return;
    addSearchHistory(query);
    setSearchHistory(getSearchHistory());
    setIsLoading(true);
    setError(null);
    setSearchActive(true);
    setView('home');
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

  const clearSearch = () => {
    setSearchActive(false);
    setArtists([]);
    setSearchQuery('');
  };

  const isCurrentTrack = (t: MusicTrack) => {
    const cur = activeTracks[currentTrackIndex];
    return !!cur && !!t.video_id && cur.video_id === t.video_id;
  };

  return (
    <div className="flex h-[calc(100vh-65px)] bg-[#0a0f1c] overflow-hidden">
      {/* Ambient gradient animation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#3b82f6]/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute top-1/3 -right-20 w-72 h-72 bg-[#8b5cf6]/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-[#06b6d4]/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
      </div>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto relative bg-gradient-to-b from-[#1a2235] to-[#0a0f1c]">
        <div className="px-8 pb-32">

          {/* ════════════════ HOME VIEW ════════════════ */}
          {view === 'home' && (
            <>
              <h1 className="text-3xl font-black text-white mb-6">{getGreeting()}</h1>

              {/* ── Video / Audio Toggle ── */}
              <div className="mb-6 flex items-center gap-3">
                <span className="text-xs font-mono uppercase tracking-widest text-[#8b97ad]">Playback</span>
                <button
                  onClick={() => setPlayMode('audio')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    playMode === 'audio'
                      ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/30'
                      : 'bg-[#1a2235] text-[#8b97ad] hover:bg-[#243049] hover:text-white'
                  }`}
                >
                  <span className="text-base">♪</span> Audio
                </button>
                <button
                  onClick={() => setPlayMode('video')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    playMode === 'video'
                      ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/30'
                      : 'bg-[#1a2235] text-[#8b97ad] hover:bg-[#243049] hover:text-white'
                  }`}
                >
                  <span className="text-base">▶</span> Video
                </button>
                <span className="text-[10px] text-[#8b97ad] ml-2">
                  {playMode === 'video' ? 'Video overlay · audio in background' : 'Audio only'}
                </span>
              </div>

              {/* ── Search ── */}
              <div className="mb-6">
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

              {/* ── Search History ── */}
              {!searchActive && searchHistory.length > 0 && (
                <div className="mb-6 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#8b97ad] uppercase tracking-widest shrink-0">Recent:</span>
                  {searchHistory.slice(0, 6).map((q, i) => (
                    <button
                      key={i}
                      onClick={() => { setSearchQuery(q); setTimeout(() => handleSubmit({ preventDefault: () => {} } as any), 0); }}
                      className="px-3 py-1 text-xs font-medium bg-[#1a2235] hover:bg-[#243049] text-[#8b97ad] hover:text-white rounded-full transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                  <button onClick={clearSearchHistory} className="ml-1 text-xs text-[#8b97ad]/50 hover:text-[#D25454] transition-colors">
                    Clear
                  </button>
                </div>
              )}

              {/* ── Genre Chips ── */}
              {!searchActive && (
                <div className="mb-8">
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {GENRES.map((genre) => (
                      <button
                        key={genre.id}
                        onClick={() => handleGenreSelect(genre.id)}
                        className={`shrink-0 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                          activeGenre === genre.id
                            ? `bg-gradient-to-r ${genre.gradient} text-white shadow-lg scale-105`
                            : 'bg-[#1a2235] text-[#8b97ad] hover:bg-[#243049] hover:text-white'
                        }`}
                      >
                        {genre.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mb-6 p-4 bg-[#D25454]/20 border border-[#D25454]/40 rounded-lg text-[#D25454] text-sm font-bold">
                  {error}
                </div>
              )}

              {/* ── Quick Actions ── */}
              {!searchActive && activeGenre === 'all' && (
                <section className="mb-8">
                  <h2 className="text-xl font-black text-white mb-4">Quick Play</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    <button
                      onClick={() => openGenreModal('mix')}
                      disabled={quickMixLoading}
                      className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-50"
                    >
                      {quickMixLoading ? (
                        <Clock className="w-5 h-5 animate-spin" />
                      ) : (
                        <Shuffle className="w-5 h-5" />
                      )}
                      <span>Mix</span>
                    </button>
                    <button
                      onClick={() => openGenreModal('popular')}
                      disabled={quickPopularLoading}
                      className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-50"
                    >
                      {quickPopularLoading ? (
                        <Clock className="w-5 h-5 animate-spin" />
                      ) : (
                        <Flame className="w-5 h-5" />
                      )}
                      <span>Popular</span>
                    </button>
                    <button
                      onClick={() => openCreatePlaylist()}
                      className="flex items-center gap-3 px-4 py-3 bg-[#1a2235] hover:bg-[#243049] border border-slate-700 rounded-xl text-white font-bold text-sm transition-all"
                    >
                      <Plus className="w-5 h-5 text-[#3b82f6]" />
                      <span>Create Playlist</span>
                    </button>
                    {playlists.length > 0 && (
                      <button
                        onClick={() => { setView('playlists'); }}
                        className="flex items-center gap-3 px-4 py-3 bg-[#1a2235] hover:bg-[#243049] border border-slate-700 rounded-xl text-white font-bold text-sm transition-all"
                      >
                        <ListMusic className="w-5 h-5 text-[#8b5cf6]" />
                        <span>My Playlists ({playlists.length})</span>
                      </button>
                    )}
                  </div>
                </section>
              )}

              {/* ── Search Results ── */}
              {searchActive && (
                <div>
                  {isLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                  ) : (
                    <div>
                      <h2 className="text-2xl font-black text-white mb-4">
                        {artists.length > 0 ? `Results for "${searchQuery}"` : 'No artists found'}
                      </h2>
                      {artists.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                          {artists.map((artist, i) => (
                            <RevealCard key={`${artist.name}-${i}`} delay={i * 30}>
                              <ArtistCard artist={artist} onClick={() => handleArtistClick(artist)} isActive={false} />
                            </RevealCard>
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
                </div>
              )}

              {/* ── Genre Results ── */}
              {!searchActive && activeGenre !== 'all' && (
                <section className="mb-10">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-black text-white">
                      {GENRES.find(g => g.id === activeGenre)?.label || activeGenre} Artists
                    </h2>
                    <button
                      onClick={() => { setActiveGenre('all'); setGenreArtists([]); }}
                      className="text-xs font-bold text-[#3b82f6] hover:text-white transition-colors"
                    >
                      Show All
                    </button>
                  </div>
                  {isGenreLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                  ) : genreArtists.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {genreArtists.map((artist, i) => (
                        <RevealCard key={`${artist.name}-${i}`} delay={i * 25}>
                          <ArtistCard artist={artist} onClick={() => handleArtistClick(artist)} isActive={activeArtistName === artist.name} />
                        </RevealCard>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center text-center">
                      <p className="text-base font-bold text-white mb-2">No results for this genre</p>
                      <p className="text-sm text-[#8b97ad]">Try another genre or search manually</p>
                    </div>
                  )}
                </section>
              )}

              {/* ── My Playlists ── */}
              {!searchActive && activeGenre === 'all' && playlists.length > 0 && (
                <section className="mb-10">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-black text-white flex items-center gap-2">
                      <ListMusic className="w-6 h-6 text-[#8b5cf6]" /> My Playlists
                    </h2>
                    <button
                      onClick={() => openCreatePlaylist()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#1a2235] hover:bg-[#243049] text-[#8b97ad] hover:text-white rounded-full border border-slate-700 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> New Playlist
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {playlists.map((pl, i) => (
                      <RevealCard key={pl.id} delay={i * 30}>
                        <PlaylistCard
                          playlist={pl}
                          onPlay={() => handlePlayPlaylist(pl)}
                          onDelete={() => handleDeletePlaylist(pl.id)}
                          onAdd={() => {
                            if (catalog && catalog.tracks.length > 0) {
                              openAddToPlaylist(catalog.tracks);
                            }
                          }}
                        />
                      </RevealCard>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Recently Played ── */}
              {!searchActive && activeGenre === 'all' && recentArtists.length > 0 && !isGenreLoading && (
                <section className="mb-10">
                  <h2 className="text-xl font-black text-white mb-4">Recently Played</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {recentArtists.map((artist, i) => (
                      <RevealCard key={`rec-${artist.name}-${i}`} delay={i * 30}>
                        <ArtistCard artist={artist} onClick={() => handleArtistClick(artist)} isActive={activeArtistName === artist.name} />
                      </RevealCard>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Top 100 Artists ── */}
              {!searchActive && activeGenre === 'all' && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-black text-white">Top 100 Artists</h2>
                    <span className="text-xs font-bold text-[#8b97ad] uppercase tracking-widest">{top100Artists.length} artists</span>
                  </div>
                  {isGenreLoading || top100Artists.length === 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {Array.from({ length: 18 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {top100Artists.map((artist, i) => (
                        <RevealCard key={`${artist.name}-${i}`} delay={Math.min(i * 15, 300)}>
                          <ArtistCard artist={artist} onClick={() => handleArtistClick(artist)} isActive={activeArtistName === artist.name} />
                        </RevealCard>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          {/* ════════════════ ARTIST VIEW ════════════════ */}
          {view === 'artist' && (
            <div>
              <button
                onClick={() => { setView('home'); setCatalog(null); setError(null); }}
                className="flex items-center gap-1 text-sm font-bold text-[#8b97ad] hover:text-white mb-6 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back to browse
              </button>

              {error && (
                <div className="mb-6 p-4 bg-[#D25454]/20 border border-[#D25454]/40 rounded-lg text-[#D25454] text-sm font-bold">
                  {error}
                </div>
              )}

              {catalogLoading ? (
                <div>
                  <div className="flex items-end gap-8 mb-10">
                    <div className="w-52 h-52 rounded-lg bg-[#1e2a42] animate-pulse" />
                    <div className="pb-4 w-full max-w-sm">
                      <div className="h-3 w-16 bg-[#1e2a42] rounded mb-3 animate-pulse" />
                      <div className="h-10 w-2/3 bg-[#1e2a42] rounded mb-3 animate-pulse" />
                      <div className="h-4 w-1/2 bg-[#1e2a42] rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
                  </div>
                </div>
              ) : catalog ? (
                <>
                  {/* ── Hero ── */}
                  <div className="flex flex-col sm:flex-row items-start gap-8 mt-2 mb-12">
                    <img
                      src={catalog.thumbnail}
                      alt={catalog.artist}
                      className="w-52 h-52 rounded-lg object-cover shadow-2xl shrink-0"
                    />
                    <div className="pb-2 min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#8b97ad]">Artist</p>
                      <h1 className="text-5xl font-black text-white leading-tight">{catalog.artist}</h1>
                      <p className="text-[#8b97ad] mt-3">
                        {[catalog.monthly_listeners && `${catalog.monthly_listeners} monthly listeners`, catalog.subscribers].filter(Boolean).join('  ·  ')}
                      </p>
                      {catalog.tracks.length > 0 && (
                        <button
                          onClick={() => playQueue(catalog.tracks, 0, { name: catalog.artist, thumbnail: catalog.thumbnail }, catalog.channel_id)}
                          className="mt-5 w-14 h-14 rounded-full bg-[#3b82f6] hover:bg-[#2563eb] hover:scale-105 flex items-center justify-center shadow-xl shadow-[#3b82f6]/30 transition-all"
                          title="Play all"
                        >
                          <Play className="w-6 h-6 text-white fill-current ml-0.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── Top Songs ── */}
                  {catalog.tracks.length > 0 && (
                    <section className="mb-12">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-black text-white flex items-center gap-2">
                          <Music2 className="w-5 h-5 text-[#3b82f6]" /> Top Songs
                          <span className="text-xs font-bold text-[#8b97ad]">{catalog.tracks.length} tracks</span>
                        </h2>
                        <button
                          onClick={() => openCreatePlaylist(catalog.tracks, `${catalog.artist} · Top Tracks`)}
                          className="px-4 py-2 text-xs font-bold bg-[#1a2235] hover:bg-[#243049] text-[#8b97ad] hover:text-white rounded-full border border-slate-700 transition-colors flex items-center gap-1.5"
                        >
                          <ListMusic className="w-3.5 h-3.5" /> Save to Playlist
                        </button>
                      </div>
                      <TrackList
                        tracks={catalog.tracks}
                        currentVideoId={activeTracks[currentTrackIndex]?.video_id}
                        onPlay={(i) => playQueue(catalog.tracks, i, { name: catalog.artist, thumbnail: catalog.thumbnail }, catalog.channel_id)}
                      />
                    </section>
                  )}

                  {/* ── Albums ── */}
                  {catalog.albums.length > 0 && (
                    <section className="mb-12">
                      <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
                        <Disc3 className="w-5 h-5 text-[#3b82f6]" /> Albums
                        <span className="text-xs font-bold text-[#8b97ad]">{catalog.albums.length} albums</span>
                      </h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {catalog.albums.map((album, i) => (
                          <RevealCard key={`${album.playlist_id}-${i}`} delay={Math.min(i * 20, 300)}>
                            <AlbumCard album={album} onClick={() => handleAlbumClick(album, album.thumbnail)} />
                          </RevealCard>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* ── Singles ── */}
                  {catalog.singles.length > 0 && (
                    <section className="mb-12">
                      <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
                        <Disc3 className="w-5 h-5 text-[#8b5cf6]" /> Singles
                        <span className="text-xs font-bold text-[#8b97ad]">{catalog.singles.length} singles</span>
                      </h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {catalog.singles.map((single, i) => (
                          <RevealCard key={`${single.playlist_id}-${i}`} delay={Math.min(i * 20, 300)}>
                            <AlbumCard album={single} onClick={() => handleAlbumClick(single, single.thumbnail)} />
                          </RevealCard>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* ── Related Artists ── */}
                  {catalog.related.length > 0 && (
                    <section>
                      <h2 className="text-2xl font-black text-white mb-4">Related Artists</h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {catalog.related.map((rel, i) => (
                          <RevealCard key={`rel-${rel.name}-${i}`} delay={Math.min(i * 20, 200)}>
                            <ArtistCard
                              artist={{ name: rel.name, thumbnail: rel.thumbnail, channelId: rel.channelId }}
                              onClick={() => handleArtistClick({ name: rel.name, thumbnail: rel.thumbnail, channelId: rel.channelId })}
                              isActive={false}
                            />
                          </RevealCard>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                !error && (
                  <div className="py-16 flex flex-col items-center text-center">
                    <p className="text-lg font-bold text-white mb-2">No music found</p>
                    <button onClick={() => setView('home')} className="text-sm font-bold text-[#3b82f6] hover:text-white">Go back</button>
                  </div>
                )
              )}
            </div>
          )}

          {/* ════════════════ ALBUM VIEW ════════════════ */}
          {view === 'album' && (
            <div>
              <button
                onClick={() => { setView('artist'); setAlbumData(null); }}
                className="flex items-center gap-1 text-sm font-bold text-[#8b97ad] hover:text-white mb-6 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back to {albumBackTo?.title || 'artist'}
              </button>

              {albumLoading ? (
                <div>
                  <div className="flex items-end gap-8 mb-10">
                    <div className="w-52 h-52 rounded-lg bg-[#1e2a42] animate-pulse" />
                    <div className="pb-4 w-full max-w-sm">
                      <div className="h-3 w-16 bg-[#1e2a42] rounded mb-3 animate-pulse" />
                      <div className="h-10 w-2/3 bg-[#1e2a42] rounded mb-3 animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-14 bg-[#1e2a42] rounded animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : albumData ? (
                <>
                  {/* ── Album Hero ── */}
                  <div className="flex flex-col sm:flex-row items-start gap-8 mt-2 mb-12">
                    <img
                      src={albumData.thumbnail || albumBackTo?.thumbnail}
                      alt={albumData.title}
                      className="w-52 h-52 rounded-lg object-cover shadow-2xl shrink-0"
                    />
                    <div className="pb-2 min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#8b97ad]">
                        {albumBackTo ? 'Album' : 'Playlist'}{albumData.year ? ` · ${albumData.year}` : ''}
                      </p>
                      <h1 className="text-4xl font-black text-white leading-tight">{albumData.title}</h1>
                      <p className="text-[#8b97ad] mt-3">{catalog?.artist}  ·  {albumData.tracks.length} tracks</p>
                      <button
                        onClick={() => playQueue(albumData.tracks, 0, {
                          name: catalog?.artist || albumData.title,
                          thumbnail: albumData.thumbnail || albumBackTo?.thumbnail || '',
                        })}
                        className="mt-5 w-14 h-14 rounded-full bg-[#3b82f6] hover:bg-[#2563eb] hover:scale-105 flex items-center justify-center shadow-xl shadow-[#3b82f6]/30 transition-all"
                        title="Play album"
                      >
                        <Play className="w-6 h-6 text-white fill-current ml-0.5" />
                      </button>
                    </div>
                  </div>

                  <TrackList
                    tracks={albumData.tracks}
                    currentVideoId={activeTracks[currentTrackIndex]?.video_id}
                    onPlay={(i) => playQueue(albumData.tracks, i, {
                      name: catalog?.artist || albumData.title,
                      thumbnail: albumData.thumbnail || albumBackTo?.thumbnail || '',
                    })}
                  />
                </>
              ) : (
                !error && (
                  <div className="py-16 flex flex-col items-center text-center">
                    <p className="text-lg font-bold text-white mb-2">Album not available</p>
                    <button onClick={() => setView('artist')} className="text-sm font-bold text-[#3b82f6] hover:text-white">Go back</button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </main>

      {/* Playlist Modal */}
      {showPlaylistModal && (
        <PlaylistModal
          mode={playlistModalMode}
          name={playlistNameInput}
          setName={setPlaylistNameInput}
          selectedTracks={playlistSelectedTracks}
          allTracks={activeTracks}
          setSelectedTracks={setPlaylistSelectedTracks}
          onSave={handleSavePlaylist}
          onClose={() => setShowPlaylistModal(false)}
        />
      )}

      {/* Genre Selection Modal */}
      {showGenreModal && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowGenreModal(false); }}
        >
          <div className="bg-[#121826] rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white">
                  {genreModalMode === 'mix' ? '🔀 Mix' : '🔥 Popular'}
                </h3>
                <p className="text-[11px] text-[#8b97ad] mt-0.5">Pick a genre to get started</p>
              </div>
              <button onClick={() => setShowGenreModal(false)} className="text-[#8b97ad] hover:text-white transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto space-y-1.5 no-scrollbar">
              {GENRES.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => handlePlayGenre(genre.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    genre.id === 'all'
                      ? 'bg-[#1a2235] hover:bg-[#243049] text-white'
                      : `bg-gradient-to-r ${genre.gradient} text-white shadow-md`
                  }`}
                >
                  <span className="text-base font-bold">{genre.label}</span>
                  {genre.id !== 'all' && (
                    <ChevronRight className="w-4 h-4 text-white/70 ml-auto" />
                  )}
                </button>
              ))}
            </div>
            <div className="px-6 py-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => handlePlayGenre('all')}
                className="px-4 py-2 text-xs font-bold text-[#8b97ad] hover:text-white transition-colors"
              >
                Skip — Play All Genres
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Track List (rows with hover play) ────────────────────────────────────────

const TrackList: React.FC<{
  tracks: MusicTrack[];
  currentVideoId?: string;
  onPlay: (index: number) => void;
}> = ({ tracks, currentVideoId, onPlay }) => (
  <div className="bg-[#121826]/60 rounded-lg overflow-hidden border border-[#1a2235]">
    {tracks.map((track, i) => {
      const isCurrent = !!track.video_id && track.video_id === currentVideoId;
      return (
        <button
          key={track.video_id || `${track.title}-${i}`}
          onClick={() => onPlay(i)}
          className={`w-full flex items-center gap-4 px-4 py-2.5 text-left transition-colors group hover:bg-[#1a2235] ${isCurrent ? 'bg-[#1a2235]' : ''} ${i > 0 ? 'border-t border-[#1a2235]/50' : ''}`}
        >
          {/* Index / play */}
          <span className="w-6 text-center shrink-0">
            {isCurrent ? (
              <span className="flex items-center justify-center gap-0.5">
                {[...Array(3)].map((_, j) => (
                  <span key={j} className="w-0.5 bg-[#3b82f6] animate-pulse" style={{ height: `${8 + j * 3}px`, animationDelay: `${j * 0.15}s` }} />
                ))}
              </span>
            ) : (
              <>
                <span className="text-sm font-mono text-[#8b97ad] group-hover:hidden">{i + 1}</span>
                <span className="hidden group-hover:inline text-white"><Play className="w-3.5 h-3.5 fill-current inline" /></span>
              </>
            )}
          </span>

          {/* Art */}
          {track.thumbnail && (
            <img src={track.thumbnail} alt="" className="w-10 h-10 rounded object-cover shrink-0" loading="lazy" />
          )}

          {/* Title */}
          <span className="flex-1 min-w-0">
            <span className={`block text-sm font-bold truncate ${isCurrent ? 'text-[#3b82f6]' : 'text-white'}`}>
              {track.title}
              {track.isExplicit && (
                <span className="ml-2 align-middle text-[9px] font-black text-[#8b97ad] bg-[#243049] px-1 py-0.5 rounded">E</span>
              )}
            </span>
            <span className="block text-xs text-[#8b97ad] truncate">
              {[track.album, track.artist && track.album ? '' : track.artist].filter(Boolean).join(' · ')}
            </span>
          </span>

          <span className="text-xs text-[#8b97ad] font-mono shrink-0">{formatTime(track.duration)}</span>
        </button>
      );
    })}
  </div>
);

// ─── Album Card ───────────────────────────────────────────────────────────────

const AlbumCard: React.FC<{ album: Album; onClick: () => void }> = ({ album, onClick }) => (
  <button
    onClick={onClick}
    className="group rounded-lg p-3 transition-all duration-200 text-left w-full bg-[#121826] hover:bg-[#1a2235] hover:shadow-lg hover:shadow-[#3b82f6]/10"
  >
    <div className="relative aspect-square rounded-md overflow-hidden mb-3 shadow-lg">
      <img
        src={album.thumbnail || 'https://via.placeholder.com/600x600/1e293b/475569?text=Album'}
        alt={album.title}
        className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-110"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-[#3b82f6]/0 group-hover:bg-[#3b82f6]/10 transition-all duration-300 rounded-md" />
    </div>
    <p className="text-sm font-black text-white truncate">{album.title}</p>
    <p className="text-xs text-[#8b97ad] mt-0.5 truncate">{album.year || 'Album'}</p>
  </button>
);

// ─── Scroll-reveal wrapper ────────────────────────────────────────────────────

const RevealCard: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTimeout(() => setVisible(true), delay); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      {children}
    </div>
  );
};

// ─── Skeleton card ────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="rounded-lg p-3 animate-pulse">
    <div className="aspect-square rounded-md bg-[#1e2a42] mb-3" />
    <div className="h-3 bg-[#1e2a42] rounded w-3/4 mb-1.5" />
    <div className="h-2.5 bg-[#1e2a42]/60 rounded w-1/2" />
  </div>
);

// ─── Artist Card (Spotify style) ─────────────────────────────────────────────

const ArtistCard: React.FC<{
  artist: Artist;
  onClick: () => void;
  isActive: boolean;
}> = ({ artist, onClick, isActive }) => (
  <button
    onClick={onClick}
    className={`group rounded-lg p-3 transition-all duration-200 text-left w-full relative ${
      isActive
        ? 'bg-[#1a2235] ring-1 ring-[#3b82f6]/40'
        : 'bg-[#121826] hover:bg-[#1a2235]'
    } hover:shadow-lg hover:shadow-[#3b82f6]/10`}
  >
    {isActive && (
      <div className="absolute top-0 left-3 right-3 h-0.5 bg-[#3b82f6] rounded-full" />
    )}
    <div className="relative aspect-square rounded-md overflow-hidden mb-3 shadow-lg">
      <img
        src={artist.thumbnail || 'https://via.placeholder.com/300x300/1e293b/475569?text=' + encodeURIComponent(artist.name)}
        alt={artist.name}
        className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-110"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-[#3b82f6]/0 group-hover:bg-[#3b82f6]/10 transition-all duration-300 rounded-md" />
      <div className={`absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center shadow-xl transition-all duration-300 ${
        isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
      }`}>
        <Play className="w-4 h-4 text-black fill-current ml-0.5" />
      </div>
    </div>
    <p className={`text-sm font-black truncate ${isActive ? 'text-[#3b82f6]' : 'text-white'}`}>{artist.name}</p>
    <p className="text-xs text-[#8b97ad] mt-0.5 truncate">Artist</p>
  </button>
);

// ─── Playlist Card ────────────────────────────────────────────────────────────

const PlaylistCard: React.FC<{
  playlist: MusicPlaylist;
  onPlay: () => void;
  onDelete: () => void;
  onAdd: () => void;
}> = ({ playlist, onPlay, onDelete, onAdd }) => (
  <div className="group rounded-lg p-3 transition-all duration-200 text-left w-full bg-[#121826] hover:bg-[#1a2235] hover:shadow-lg hover:shadow-[#8b5cf6]/10">
    <div className="relative aspect-square rounded-md overflow-hidden mb-3 shadow-lg bg-[#1e2a42]">
      {playlist.tracks.length > 0 ? (
        <img
          src={playlist.tracks[0].thumbnail || ''}
          alt={playlist.name}
          className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-110"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ListMusic className="w-8 h-8 text-[#8b97ad]" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 rounded-md flex items-center justify-center">
        <button
          onClick={onPlay}
          className="w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300"
        >
          <PlayIcon className="w-4 h-4 text-black fill-current ml-0.5" />
        </button>
      </div>
      <span className="absolute bottom-2 right-2 text-[10px] font-mono text-white/70 bg-black/60 px-1.5 py-0.5 rounded">
        {playlist.tracks.length} tracks
      </span>
    </div>
    <p className="text-sm font-black text-white truncate">{playlist.name}</p>
    <div className="flex items-center gap-1 mt-1.5">
      <button
        onClick={onAdd}
        className="p-1 text-[#8b97ad] hover:text-white transition-colors"
        title="Add current tracks"
      >
        <Plus className="w-3 h-3" />
      </button>
      <button
        onClick={onDelete}
        className="p-1 text-[#8b97ad] hover:text-red-400 transition-colors ml-auto"
        title="Delete playlist"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  </div>
);

// ─── Playlist Modal ────────────────────────────────────────────────────────────

const PlaylistModal: React.FC<{
  mode: 'create' | 'add';
  name: string;
  setName: (n: string) => void;
  selectedTracks: Set<string>;
  allTracks: MusicTrack[];
  setSelectedTracks: (s: Set<string>) => void;
  onSave: () => void;
  onClose: () => void;
}> = ({ mode, name, setName, selectedTracks, allTracks, setSelectedTracks, onSave, onClose }) => (
  <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="bg-[#121826] rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <h3 className="text-lg font-black text-white">
          {mode === 'create' ? 'Create Playlist' : 'Add to Playlist'}
        </h3>
        <button onClick={onClose} className="text-[#8b97ad] hover:text-white transition-colors">
          <XIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6">
        {mode === 'create' && (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playlist name..."
            className="w-full bg-[#1a2235] border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm font-medium placeholder-[#8b97ad] focus:outline-none focus:border-[#3b82f6] transition-colors mb-4"
            autoFocus
          />
        )}
        <p className="text-xs font-bold text-[#8b97ad] uppercase tracking-widest mb-3">
          {selectedTracks.size} of {allTracks.length} tracks selected
        </p>
        <div className="max-h-60 overflow-y-auto space-y-1">
          {allTracks.map((track, i) => {
            const vid = track.video_id || '';
            const checked = vid ? selectedTracks.has(vid) : false;
            return (
              <button
                key={vid || i}
                onClick={() => {
                  const next = new Set(selectedTracks);
                  if (checked) next.delete(vid); else next.add(vid);
                  setSelectedTracks(next);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${checked ? 'bg-blue-950/40' : 'hover:bg-[#1a2235]'}`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-[#3b82f6] border-[#3b82f6]' : 'border-slate-600'}`}>
                  {checked && <Check className="w-3 h-3 text-black" />}
                </div>
                {track.thumbnail && (
                  <img src={track.thumbnail} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${checked ? 'text-[#3b82f6]' : 'text-white'}`}>{track.title}</p>
                  <p className="text-xs text-[#8b97ad] truncate">{track.artist}</p>
                </div>
                <span className="text-xs text-[#8b97ad] font-mono shrink-0">{formatTime(track.duration)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-bold text-[#8b97ad] hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={selectedTracks.size === 0 || (mode === 'create' && !name.trim())}
          className="px-5 py-2 text-sm font-black bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-[#243049] disabled:text-[#8b97ad] text-white rounded-lg transition-colors"
        >
          {mode === 'create' ? 'Create Playlist' : 'Add Selected'}
        </button>
      </div>
    </div>
  </div>
);
