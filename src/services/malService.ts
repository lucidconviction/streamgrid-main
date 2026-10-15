import { StreamItem } from '../types/stream';

/**
 * MyAnimeList (MAL) public API — free, no key required for basic search.
 * https://myanimelist.net/apiconfig/references/api/v2
 */

const CACHE_TTL = 20 * 60 * 1000;
const cache = new Map<string, { data: any; timestamp: number }>();

function cachedFetch<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.timestamp < CACHE_TTL) return Promise.resolve(hit.data);
  return fn().then((data) => { cache.set(key, { data, timestamp: Date.now() }); return data; });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MALAnime {
  id: number;
  title: string;
  main_picture?: { large: string; medium: string };
  media_type?: string;
  status?: string;
  num_episodes?: number;
  mean?: number;
  rank?: number;
  listed_count?: number;
  genres?: { id: number; name: string }[];
  start_date?: string;
  synopsis?: string;
}

// ── Search ─────────────────────────────────────────────────────────────────────

export async function searchMAL(query: string, limit = 20): Promise<MALAnime[]> {
  return cachedFetch(`mal-search-${query}-${limit}`, async () => {
    const res = await fetch(
      `https://api.myanimelist.net/v2/anime?q=${encodeURIComponent(query)}&limit=${limit}&nsfw=true`
    );
    if (!res.ok) throw new Error(`MyAnimeList search failed: ${res.status}`);
    const json = await res.json();
    return (json.data || [])
      .map((d: any) => d.node)
      .filter((n: MALAnime) => n.media_type !== 'music')
      .slice(0, limit) as MALAnime[];
  });
}

export async function getMALTopAnime(limit = 50): Promise<MALAnime[]> {
  return cachedFetch('mal-top-anime', async () => {
    const res = await fetch(
      `https://api.myanimelist.net/v2/anime?order=popularity&limit=${limit}&nsfw=true`
    );
    if (!res.ok) throw new Error(`MAL top anime failed: ${res.status}`);
    const json = await res.json();
    return (json.data || [])
      .map((d: any) => d.node)
      .filter((n: MALAnime) => n.media_type !== 'music')
      .slice(0, limit) as MALAnime[];
  });
}

export async function getMALFavorites(limit = 30): Promise<MALAnime[]> {
  return cachedFetch('mal-favorites', async () => {
    const res = await fetch(
      `https://api.myanimelist.net/v2/anime?order=favorites&limit=${limit}&nsfw=true`
    );
    if (!res.ok) throw new Error(`MAL favorites failed: ${res.status}`);
    const json = await res.json();
    return (json.data || [])
      .map((d: any) => d.node)
      .filter((n: MALAnime) => n.media_type !== 'music')
      .slice(0, limit) as MALAnime[];
  });
}

export async function getMALSeasonal(limit = 40): Promise<MALAnime[]> {
  return cachedFetch('mal-seasonal', async () => {
    const year = new Date().getFullYear();
    const season = new Date().getMonth() < 3 ? 'winter' : new Date().getMonth() < 6 ? 'spring' : new Date().getMonth() < 9 ? 'summer' : 'fall';
    const res = await fetch(
      `https://api.myanimelist.net/v2/anime/season/${season}/${year}?order=popularity&limit=${limit}&nsfw=true`
    );
    if (!res.ok) throw new Error(`MAL seasonal failed: ${res.status}`);
    const json = await res.json();
    return (json.data || [])
      .map((d: any) => d.node)
      .filter((n: MALAnime) => n.media_type !== 'music')
      .slice(0, limit) as MALAnime[];
  });
}

export async function getMALTrendingAnime(limit = 30): Promise<MALAnime[]> {
  return cachedFetch('mal-trending-anime', async () => {
    const res = await fetch(
      `https://api.myanimelist.net/v2/anime/order=ranking?limit=${limit}&nsfw=true`
    );
    if (!res.ok) throw new Error(`MAL trending failed: ${res.status}`);
    const json = await res.json();
    return (json.data || [])
      .map((d: any) => d.node)
      .filter((n: MALAnime) => n.media_type !== 'music')
      .slice(0, limit) as MALAnime[];
  });
}

// ── Stream conversion ─────────────────────────────────────────────────────────

export function malAnimeToStream(anime: MALAnime): StreamItem {
  return {
    id: `mal-${anime.id}`,
    title: anime.title,
    name: anime.title,
    category: 'Anime',
    poster: anime.main_picture?.large,
    status: 'live' as const,
    provider: 'anime' as const,
    streamType: 'embed' as const,
    directEmbedUrl: `https://embed.pstream.cfd/media/mal-${anime.id}`,
    viewers: Math.floor(Math.random() * 8000) + 500,
    date: anime.start_date ? parseInt(anime.start_date.slice(0, 4), 10) : undefined,
  };
}
