import { StreamItem } from '../types/stream';

/**
 * TMDB API service — movies & TV shows
 * API key injected via Vite env: VITE_TMDB_API_KEY
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
const CACHE_TTL = 20 * 60 * 1000;
const cache = new Map<string, { data: any; timestamp: number }>();

function apiKey(): string {
  return (import.meta.env as any).VITE_TMDB_API_KEY || '';
}

function cachedFetch<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.timestamp < CACHE_TTL) return Promise.resolve(hit.data);
  return fn().then((data) => { cache.set(key, { data, timestamp: Date.now() }); return data; });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TMDBMovie {
  id: number;
  title: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  vote_average?: number;
  overview?: string;
  genre_ids?: number[];
}

export interface TMDBTVShow {
  id: number;
  name: string;
  poster_path?: string;
  backdrop_path?: string;
  first_air_date?: string;
  vote_average?: number;
  overview?: string;
  genre_ids?: number[];
  origin_country?: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tmdbPoster(path?: string): string {
  return path ? `${IMG_BASE}${path}` : '';
}

function makeUrl(path: string, params: Record<string, string> = {}): string {
  const key = apiKey();
  const qs = new URLSearchParams({ api_key: key, ...params }).toString();
  return `${TMDB_BASE}${path}?${qs}`;
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchTMDB(query: string, page = 1): Promise<any[]> {
  if (!apiKey()) return [];
  return cachedFetch(`tmdb-search-${query}-${page}`, async () => {
    const res = await fetch(makeUrl('/search/multi', { query, page: String(page) }));
    if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`);
    const json = await res.json();
    return (json.results || []) as any[];
  });
}

// ── Movies ────────────────────────────────────────────────────────────────────

export async function getTMDBMovieByImdbId(imdbId: string): Promise<TMDBMovie | null> {
  if (!apiKey()) return null;
  return cachedFetch(`tmdb-imdb-${imdbId}`, async () => {
    const res = await fetch(makeUrl(`/movie/${imdbId}`, { external_source: 'imdb_id' }));
    if (!res.ok) return null;
    return res.json() as Promise<TMDBMovie>;
  });
}

export async function getTMDBPopularMovies(page = 1): Promise<TMDBMovie[]> {
  if (!apiKey()) return [];
  return cachedFetch(`tmdb-pop-mov-${page}`, async () => {
    const res = await fetch(makeUrl('/movie/popular', { page: String(page) }));
    if (!res.ok) throw new Error(`TMDB popular movies failed: ${res.status}`);
    const json = await res.json();
    return (json.results || []) as TMDBMovie[];
  });
}

export async function getTMDBNowPlaying(page = 1): Promise<TMDBMovie[]> {
  if (!apiKey()) return [];
  return cachedFetch(`tmdb-now-playing-${page}`, async () => {
    const res = await fetch(makeUrl('/movie/now_playing', { page: String(page) }));
    if (!res.ok) throw new Error(`TMDB now playing failed: ${res.status}`);
    const json = await res.json();
    return (json.results || []) as TMDBMovie[];
  });
}

export async function getTMDBUpcoming(page = 1): Promise<TMDBMovie[]> {
  if (!apiKey()) return [];
  return cachedFetch(`tmdb-upcoming-${page}`, async () => {
    const res = await fetch(makeUrl('/movie/upcoming', { page: String(page) }));
    if (!res.ok) throw new Error(`TMDB upcoming failed: ${res.status}`);
    const json = await res.json();
    return (json.results || []) as TMDBMovie[];
  });
}

export async function getTMDBTopRatedMovies(page = 1): Promise<TMDBMovie[]> {
  if (!apiKey()) return [];
  return cachedFetch(`tmdb-top-mov-${page}`, async () => {
    const res = await fetch(makeUrl('/movie/top_rated', { page: String(page) }));
    if (!res.ok) throw new Error(`TMDB top rated movies failed: ${res.status}`);
    const json = await res.json();
    return (json.results || []) as TMDBMovie[];
  });
}

// ── TV Shows ──────────────────────────────────────────────────────────────────

export async function getTMDBPopularTV(page = 1): Promise<TMDBTVShow[]> {
  if (!apiKey()) return [];
  return cachedFetch(`tmdb-pop-tv-${page}`, async () => {
    const res = await fetch(makeUrl('/tv/popular', { page: String(page) }));
    if (!res.ok) throw new Error(`TMDB popular TV failed: ${res.status}`);
    const json = await res.json();
    return (json.results || []) as TMDBTVShow[];
  });
}

export async function getTMDBTopRatedTV(page = 1): Promise<TMDBTVShow[]> {
  if (!apiKey()) return [];
  return cachedFetch(`tmdb-top-tv-${page}`, async () => {
    const res = await fetch(makeUrl('/tv/top_rated', { page: String(page) }));
    if (!res.ok) throw new Error(`TMDB top rated TV failed: ${res.status}`);
    const json = await res.json();
    return (json.results || []) as TMDBTVShow[];
  });
}

export async function getTMDBAiringTodayTV(): Promise<TMDBTVShow[]> {
  if (!apiKey()) return [];
  return cachedFetch('tmdb-airing-today', async () => {
    const res = await fetch(makeUrl('/tv/airing_today'));
    if (!res.ok) throw new Error(`TMDB airing today failed: ${res.status}`);
    const json = await res.json();
    return (json.results || []) as TMDBTVShow[];
  });
}

export async function getTMDBOnTheAirTV(): Promise<TMDBTVShow[]> {
  if (!apiKey()) return [];
  return cachedFetch('tmdb-on-the-air', async () => {
    const res = await fetch(makeUrl('/tv/on_the_air'));
    if (!res.ok) throw new Error(`TMDB on the air failed: ${res.status}`);
    const json = await res.json();
    return (json.results || []) as TMDBTVShow[];
  });
}

// ── Trailers ───────────────────────────────────────────────────────────────────

export interface TMDBTrailer {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export async function getMovieTrailer(tmdbId: number): Promise<TMDBTrailer | null> {
  if (!apiKey()) return null;
  return cachedFetch(`tmdb-movie-trailer-${tmdbId}`, async () => {
    const res = await fetch(makeUrl(`/movie/${tmdbId}/videos`));
    if (!res.ok) return null;
    const json = await res.json();
    const results: any[] = json.results || [];
    // Prefer official YouTube trailers
    const trailer = results.find(
      (v: any) => v.site === 'YouTube' && v.type === 'Trailer'
    ) || results.find(
      (v: any) => v.site === 'YouTube' && v.type === 'Teaser'
    ) || results.find(
      (v: any) => v.site === 'YouTube'
    );
    return trailer ? {
      id: trailer.id,
      key: trailer.key,
      name: trailer.name,
      site: trailer.site,
      type: trailer.type,
      official: trailer.official || false,
    } : null;
  });
}

export async function getTVTrailer(tmdbId: number): Promise<TMDBTrailer | null> {
  if (!apiKey()) return null;
  return cachedFetch(`tmdb-tv-trailer-${tmdbId}`, async () => {
    const res = await fetch(makeUrl(`/tv/${tmdbId}/videos`));
    if (!res.ok) return null;
    const json = await res.json();
    const results: any[] = json.results || [];
    const trailer = results.find(
      (v: any) => v.site === 'YouTube' && v.type === 'Trailer'
    ) || results.find(
      (v: any) => v.site === 'YouTube' && v.type === 'Teaser'
    ) || results.find(
      (v: any) => v.site === 'YouTube'
    );
    return trailer ? {
      id: trailer.id,
      key: trailer.key,
      name: trailer.name,
      site: trailer.site,
      type: trailer.type,
      official: trailer.official || false,
    } : null;
  });
}

// ── Stream conversion ─────────────────────────────────────────────────────────

export function tmdbMovieToStream(movie: TMDBMovie): StreamItem {
  const year = movie.release_date ? String(movie.release_date).slice(0, 4) : '';
  return {
    id: `tmdb-movie-${movie.id}`,
    title: movie.title,
    name: movie.title,
    category: 'Movies',
    poster: tmdbPoster(movie.poster_path),
    status: 'live' as const,
    provider: 'anime' as const,
    streamType: 'embed' as const,
    directEmbedUrl: `https://embed.pstream.cfd/movie/tmdb-${movie.id}`,
    viewers: Math.floor(Math.random() * 12000) + 1000,
    date: year ? parseInt(year, 10) : undefined,
  };
}

export function tmdbTVShowToStream(show: TMDBTVShow): StreamItem {
  const year = show.first_air_date ? String(show.first_air_date).slice(0, 4) : '';
  return {
    id: `tmdb-tv-${show.id}`,
    title: show.name,
    name: show.name,
    category: 'TV Shows',
    poster: tmdbPoster(show.poster_path),
    status: 'live' as const,
    provider: 'anime' as const,
    streamType: 'embed' as const,
    directEmbedUrl: `https://embed.pstream.cfd/media/tmdb-tv-${show.id}`,
    viewers: Math.floor(Math.random() * 10000) + 500,
    date: year ? parseInt(year, 10) : undefined,
  };
}

/** Convert a generic TMDB multi-search result to a StreamItem */
export function tmdbMultiToStream(item: any): StreamItem | null {
  if (!item) return null;
  const mediaType = item.media_type || item.type || 'movie';
  const title = item.title || item.name || item.original_title || item.original_name;
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const poster = tmdbPoster(item.poster_path);

  if (mediaType === 'tv') {
    return {
      id: `tmdb-tv-${item.id}`,
      title,
      name: title,
      category: 'TV Shows',
      poster,
      status: 'live' as const,
      provider: 'anime' as const,
      streamType: 'embed' as const,
      directEmbedUrl: `https://embed.pstream.cfd/media/tmdb-tv-${item.id}`,
      viewers: Math.floor(Math.random() * 10000) + 500,
      date: year ? parseInt(year, 10) : undefined,
    };
  }
  // movie or person — treat as movie
  return {
    id: `tmdb-movie-${item.id}`,
    title,
    name: title,
    category: 'Movies',
    poster,
    status: 'live' as const,
    provider: 'anime' as const,
    streamType: 'embed' as const,
    directEmbedUrl: `https://embed.pstream.cfd/movie/tmdb-${item.id}`,
    viewers: Math.floor(Math.random() * 12000) + 1000,
    date: year ? parseInt(year, 10) : undefined,
  };
}
