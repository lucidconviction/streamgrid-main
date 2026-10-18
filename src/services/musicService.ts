// Music service — ytmusicapi backend with albums, tracks, playlists, and YouTube iframe playback.

const MUSIC_BACKEND = '/api/music';
const CACHE_KEY_TOP50 = 'rdnutz_music_top50';
const CACHE_KEY_TOP100 = 'rdnutz_music_top100';
const CACHE_KEY_CATALOG_PREFIX = 'rdnutz_music_catalog_';
const CACHE_KEY_ALBUM_PREFIX = 'rdnutz_music_album_';
const CACHE_KEY_HISTORY = 'rdnutz_music_history';
const CACHE_KEY_RECENT = 'rdnutz_music_recent_artists';
const CACHE_KEY_PLAYLISTS = 'rdnutz_music_playlists';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_HISTORY = 10;
const MAX_RECENT = 8;

// ── Genres ────────────────────────────────────────────────────────────────────

export const GENRES = [
  { id: 'all',        label: 'All',         gradient: 'from-blue-500 to-purple-500' },
  { id: 'pop',        label: 'Pop',         gradient: 'from-pink-500 to-rose-400' },
  { id: 'hiphop',     label: 'Hip-Hop',     gradient: 'from-amber-500 to-orange-400' },
  { id: 'rnb',        label: 'R&B',         gradient: 'from-violet-500 to-purple-400' },
  { id: 'rock',       label: 'Rock',        gradient: 'from-red-600 to-orange-500' },
  { id: 'latin',      label: 'Latin',       gradient: 'from-yellow-400 to-green-500' },
  { id: 'kpop',       label: 'K-Pop',       gradient: 'from-pink-400 to-indigo-500' },
  { id: 'country',    label: 'Country',     gradient: 'from-amber-600 to-yellow-500' },
  { id: 'edm',        label: 'EDM',         gradient: 'from-cyan-400 to-blue-500' },
  { id: 'indie',      label: 'Indie',       gradient: 'from-emerald-400 to-teal-500' },
  { id: 'metal',      label: 'Metal',       gradient: 'from-slate-600 to-zinc-800' },
  { id: 'jazz',       label: 'Jazz',         gradient: 'from-yellow-600 to-amber-500' },
  { id: 'classical',  label: 'Classical',   gradient: 'from-slate-400 to-slate-600' },
  { id: 'afrobeats',  label: 'Afrobeats',   gradient: 'from-green-500 to-lime-400' },
  { id: 'reggaeton',  label: 'Reggaeton',   gradient: 'from-orange-400 to-pink-500' },
  { id: 'lofi',       label: 'Lo-Fi',       gradient: 'from-indigo-400 to-violet-500' },
];

export const GENRE_QUERIES: Record<string, string> = {
  pop: 'pop hits 2025',
  hiphop: 'hip hop hits 2025',
  rnb: 'r&b hits 2025',
  rock: 'rock hits 2025',
  latin: 'latin music hits',
  kpop: 'kpop hits 2025',
  country: 'country music hits',
  edm: 'edm dance hits',
  indie: 'indie music 2025',
  metal: 'metal hits 2025',
  jazz: 'jazz classics',
  classical: 'classical music',
  afrobeats: 'afrobeats hits',
  reggaeton: 'reggaeton hits',
  lofi: 'lofi hip hop study',
};

export type GenreId = keyof typeof GENRE_QUERIES | 'all';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MusicTrack {
  title: string;
  url?: string;               // kept for backward compat; unused for playback
  duration: number;
  thumbnail?: string;
  video_id?: string;
  artist?: string;
  album?: string;
  isExplicit?: boolean;
  views?: string;
}

export interface Album {
  title: string;
  year?: string;
  thumbnail: string;
  playlist_id: string;
  browse_id?: string;
  trackCount?: number;
}

export interface ArtistCatalog {
  artist: string;
  channel_id: string;
  thumbnail: string;
  subscribers?: string;
  monthly_listeners?: string;
  description?: string;
  tracks: MusicTrack[];
  albums: Album[];
  singles: Album[];
  related: Artist[];
}

export interface AlbumData {
  title: string;
  year?: string;
  thumbnail: string;
  tracks: MusicTrack[];
}

export interface Artist {
  name: string;
  thumbnail: string;
  channelId?: string;
}

// ── HD Thumbnail helper ───────────────────────────────────────────────────────

export const hdThumb = (url: string, size = 1000): string => {
  if (!url || !url.includes('=')) return url;
  return url.replace(/=w\d+-h\d+/, `=w${size}-h${size}`);
};

// ── LocalStorage helpers ──────────────────────────────────────────────────────

function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function setCached<T>(key: string, data: T): void {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

// ── YouTube channel avatar fallback ──────────────────────────────────────────

export const getYouTubeChannelAvatar = (channelId: string, apiThumbnail?: string): string => {
  if (apiThumbnail && apiThumbnail.startsWith('http')) return apiThumbnail;
  if (!channelId) return '';
  return `https://yt3.googleusercontent.com/${channelId}/avatar.jpg`;
};

// ── Search artists ─────────────────────────────────────────────────────────────

export const searchArtists = async (query: string, limit: number = 20): Promise<Artist[]> => {
  try {
    const res = await fetch(`${MUSIC_BACKEND}/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data: Array<{ name: string; thumbnail?: string; channel_id?: string }> = await res.json();
    if (!Array.isArray(data)) return [];
    return data.filter(a => a.name).map(a => ({
      name: a.name,
      thumbnail: a.thumbnail || getYouTubeChannelAvatar(a.channel_id || ''),
      channelId: a.channel_id,
    })).slice(0, limit);
  } catch (e) {
    console.warn('Music search failed:', e);
    return [];
  }
};

// ── Top artists ────────────────────────────────────────────────────────────────

const TOP_50_QUERIES = [
  'Taylor Swift', 'Chappell Roan', 'Sabrina Carpenter', 'Billie Eilish', 'Kendrick Lamar',
  'Post Malone', 'Ariana Grande', 'Drake', 'The Weeknd', 'Bad Bunny',
  'Benson Boone', 'Shaboozey', 'Miley Cyrus', 'Dua Lipa', 'Travis Scott',
  'Olivia Rodrigo', 'Ed Sheeran', 'Beyoncé', 'Lady Gaga', 'Rihanna',
  'Bruno Mars', 'Justin Bieber', 'Imagine Dragons', 'Coldplay', 'Kanye West',
  'Playboi Carti', 'Lil Uzi Vert', 'Frank Ocean', 'Tyler The Creator', 'Doja Cat',
  'Lana Del Rey', 'Juice WRLD', 'Eminem', 'SZA', 'Ice Spice',
  'Lil Durk', 'Gunna', 'Lil Baby', 'Megan Thee Stallion', 'Adele',
  'Mariah Carey', 'Halsey', 'Lizzo', 'Tate McRae', 'Rema',
  'Tyla', 'Chase Atlantic', '21 Savage', 'Future', 'Metro Boomin',
];

export const fetchTop50Artists = async (): Promise<Artist[]> => {
  const cached = getCached<Artist[]>(CACHE_KEY_TOP50);
  if (cached && cached.length >= 50) return cached;

  const allArtists: Artist[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < TOP_50_QUERIES.length && allArtists.length < 50; i += 10) {
    const batch = TOP_50_QUERIES.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(q => fetch(`${MUSIC_BACKEND}/search?q=${encodeURIComponent(q)}`)
        .then(r => r.ok ? r.json() : Promise.resolve([])))
    );
    for (const result of results) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        const top = result.value.find((a: any) => a.name);
        if (top) {
          const key = top.name.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            allArtists.push({
              name: top.name,
              thumbnail: top.thumbnail || getYouTubeChannelAvatar(top.channel_id || ''),
              channelId: top.channel_id,
            });
          }
        }
        if (allArtists.length >= 50) break;
      }
    }
  }

  if (allArtists.length >= 50) setCached(CACHE_KEY_TOP50, allArtists.slice(0, 50));
  return allArtists.slice(0, 50);
};

export const get_cachedTop50Artists = (): Artist[] | null => getCached<Artist[]>(CACHE_KEY_TOP50);

export const fetchTop100Artists = async (): Promise<Artist[]> => {
  const cached = getCached<Artist[]>(CACHE_KEY_TOP100);
  if (cached && cached.length >= 100) return cached;
  try {
    const res = await fetch(`${MUSIC_BACKEND}/top`);
    if (!res.ok) return cached ?? [];
    const data = await res.json();
    const artists: Artist[] = (data.artists || []).map((a: any) => ({
      name: a.name,
      thumbnail: a.thumbnail || getYouTubeChannelAvatar(a.channel_id || ''),
      channelId: a.channel_id,
    }));
    if (artists.length >= 100) setCached(CACHE_KEY_TOP100, artists.slice(0, 100));
    return artists.slice(0, 100);
  } catch { return cached ?? []; }
};

export const get_cachedTop100Artists = (): Artist[] | null => getCached<Artist[]>(CACHE_KEY_TOP100);

// ── Full artist catalog (tracks + albums + singles) ──────────────────────────

export const fetchArtistCatalog = async (
  artistName: string,
  trackLimit: number = 30,
): Promise<ArtistCatalog | null> => {
  const cacheKey = CACHE_KEY_CATALOG_PREFIX + artistName.toLowerCase().replace(/\s+/g, '_');
  const cached = getCached<ArtistCatalog>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${MUSIC_BACKEND}/full?name=${encodeURIComponent(artistName)}&limit=${trackLimit}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.tracks) return null;

    const result: ArtistCatalog = {
      artist: data.artist || artistName,
      channel_id: data.channel_id || '',
      thumbnail: hdThumb(data.thumbnail || '', 1200),
      subscribers: data.subscribers,
      monthly_listeners: data.monthly_listeners,
      description: data.description || '',
      tracks: (data.tracks || []).map((t: any) => ({
        title: t.title || 'Unknown',
        duration: t.duration || 0,
        thumbnail: hdThumb(t.thumbnail || '', 600),
        video_id: t.video_id,
        artist: t.artist || data.artist || artistName,
        album: t.album || '',
        isExplicit: t.isExplicit || false,
        views: t.views || '',
      })),
      albums: (data.albums || []).map((a: any) => ({
        title: a.title || '',
        year: a.year || '',
        thumbnail: hdThumb(a.thumbnail || '', 600),
        playlist_id: a.playlist_id || '',
        browse_id: a.browse_id || '',
      })),
      singles: (data.singles || []).map((s: any) => ({
        title: s.title || '',
        year: s.year || '',
        thumbnail: hdThumb(s.thumbnail || '', 600),
        playlist_id: s.playlist_id || '',
        browse_id: s.browse_id || '',
      })),
      related: (data.related || []).map((r: any) => ({
        name: r.name || '',
        thumbnail: hdThumb(r.thumbnail || '', 300),
        channelId: r.channel_id || '',
      })),
    };

    setCached(cacheKey, result);
    return result;
  } catch (e) {
    console.warn('Failed to fetch artist catalog:', e);
    return null;
  }
};

// ── Album tracks ──────────────────────────────────────────────────────────────

export const fetchAlbumTracks = async (playlistId: string, cachedThumb?: string): Promise<AlbumData | null> => {
  const cacheKey = CACHE_KEY_ALBUM_PREFIX + playlistId;
  const cached = getCached<AlbumData>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${MUSIC_BACKEND}/playlist-tracks?id=${encodeURIComponent(playlistId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.tracks) return null;

    const result: AlbumData = {
      title: data.title || 'Album',
      year: data.year || '',
      thumbnail: hdThumb(data.thumbnail || cachedThumb || '', 600),
      tracks: (data.tracks || []).map((t: any) => ({
        title: t.title || 'Unknown',
        duration: t.duration || 0,
        thumbnail: hdThumb(t.thumbnail || '', 600),
        video_id: t.video_id,
        artist: t.artist || '',
        album: t.album || result.title,
        isExplicit: t.isExplicit || false,
      })),
    };

    setCached(cacheKey, result);
    return result;
  } catch (e) {
    console.warn('Failed to fetch album tracks:', e);
    return null;
  }
};

// ── Search History ─────────────────────────────────────────────────────────────

export const getSearchHistory = (): string[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const addSearchHistory = (query: string): void => {
  if (!query.trim()) return;
  try {
    const list: string[] = localStorage.getItem(CACHE_KEY_HISTORY)
      ? JSON.parse(localStorage.getItem(CACHE_KEY_HISTORY)!) : [];
    const updated = [query, ...list.filter((q: string) => q !== query)].slice(0, MAX_HISTORY);
    localStorage.setItem(CACHE_KEY_HISTORY, JSON.stringify(updated));
  } catch {}
};

export const clearSearchHistory = (): void => {
  localStorage.removeItem(CACHE_KEY_HISTORY);
};

// ── Recently Played Artists ────────────────────────────────────────────────────

export const getRecentArtists = (): Artist[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_RECENT);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const addRecentArtist = (artist: Artist): void => {
  try {
    const list: Artist[] = localStorage.getItem(CACHE_KEY_RECENT)
      ? JSON.parse(localStorage.getItem(CACHE_KEY_RECENT)!) : [];
    const updated = [{ ...artist }, ...list.filter((a: Artist) => a.name !== artist.name)].slice(0, MAX_RECENT);
    localStorage.setItem(CACHE_KEY_RECENT, JSON.stringify(updated));
  } catch {}
};

// ── Playlist Types & CRUD ─────────────────────────────────────────────────────

export interface MusicPlaylist {
  id: string;
  name: string;
  tracks: MusicTrack[];
  createdAt: number;
}

export const getPlaylists = (): MusicPlaylist[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PLAYLISTS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const savePlaylists = (playlists: MusicPlaylist[]): void => {
  try { localStorage.setItem(CACHE_KEY_PLAYLISTS, JSON.stringify(playlists)); } catch {}
};

export const createPlaylist = (name: string, tracks: MusicTrack[]): MusicPlaylist => {
  const playlist: MusicPlaylist = {
    id: `pl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name,
    tracks,
    createdAt: Date.now(),
  };
  const list = getPlaylists();
  list.unshift(playlist);
  savePlaylists(list);
  return playlist;
};

export const deletePlaylist = (id: string): void => {
  const list = getPlaylists().filter(p => p.id !== id);
  savePlaylists(list);
};

export const renamePlaylist = (id: string, name: string): void => {
  const list = getPlaylists().map(p => p.id === id ? { ...p, name } : p);
  savePlaylists(list);
};

export const appendToPlaylist = (playlistId: string, tracks: MusicTrack[]): void => {
  const list = getPlaylists().map(p =>
    p.id === playlistId ? { ...p, tracks: [...p.tracks, ...tracks] } : p
  );
  savePlaylists(list);
};

// ── Radio / Auto-mix ───────────────────────────────────────────────────────────

export const fetchRadioTracks = async (channelId: string, limit = 50): Promise<MusicTrack[]> => {
  try {
    const res = await fetch(`${MUSIC_BACKEND}/radio?channel_id=${encodeURIComponent(channelId)}&limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !data.tracks) return [];
    return data.tracks.map((t: any) => ({
      title: t.title || 'Unknown',
      duration: t.duration || 0,
      thumbnail: hdThumb(t.thumbnail || '', 600),
      video_id: t.video_id,
      artist: t.artist || 'Unknown Artist',
    }));
  } catch (e) {
    console.warn('Radio fetch failed:', e);
    return [];
  }
};

// ── Popular Tracks ─────────────────────────────────────────────────────────────

export const fetchPopularTracks = async (limit = 30): Promise<MusicTrack[]> => {
  try {
    const res = await fetch(`${MUSIC_BACKEND}/popular?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !data.tracks) return [];
    return data.tracks.map((t: any) => ({
      title: t.title || 'Unknown',
      duration: t.duration || 0,
      thumbnail: hdThumb(t.thumbnail || '', 600),
      video_id: t.video_id,
      artist: t.artist || 'Various Artists',
    }));
  } catch (e) {
    console.warn('Popular fetch failed:', e);
    return [];
  }
};

// ── Genre Search ───────────────────────────────────────────────────────────────

export const searchArtistsByGenre = async (genreId: string, limit: number = 40): Promise<Artist[]> => {
  if (genreId === 'all') return [];
  const query = GENRE_QUERIES[genreId as keyof typeof GENRE_QUERIES] || genreId;
  return searchArtists(query, limit);
};

// ── Favorites ──────────────────────────────────────────────────────────────────

const CACHE_KEY_FAVORITES = 'rdnutz_music_favorites';

export const getFavorites = (): Set<string> => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_FAVORITES);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};

export const isFavorite = (trackUrl: string): boolean => getFavorites().has(trackUrl);

export const toggleFavorite = (trackUrl: string): void => {
  try {
    const s = getFavorites();
    if (s.has(trackUrl)) s.delete(trackUrl); else s.add(trackUrl);
    localStorage.setItem(CACHE_KEY_FAVORITES, JSON.stringify([...s]));
  } catch {}
};

export const getFavoriteTracks = (tracks: MusicTrack[]): MusicTrack[] => {
  const favs = getFavorites();
  return tracks.filter(t => favs.has(t.url || ''));
};

// ── YouTube IFrame API loader ─────────────────────────────────────────────────

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: (() => void) | undefined;
  }
}

export const loadYouTubeAPI = (): Promise<any> => {
  return new Promise((resolve) => {
    if (window.YT?.Player) { resolve(window.YT); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  });
};
