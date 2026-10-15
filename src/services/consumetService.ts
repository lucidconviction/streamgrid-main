import { StreamItem } from '../types/stream';

/**
 * Consumet API service — multi-provider anime aggregator
 * Uses AniList as backend data source when Consumet is unavailable
 */

const CACHE_TTL = 30 * 60 * 1000;
const cache = new Map<string, { data: any; timestamp: number }>();

function cachedFetch<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return Promise.resolve(entry.data);
  }
  return fetchFn().then((data) => {
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  });
}

export interface ConsumetAnime {
  id: string;
  title: string;
  japanese?: string;
  image?: string;
  releaseDate?: string;
  description?: string;
  type?: string;
  status?: string;
  genres?: string[];
  totalEpisodes?: number;
}

// Fallback: use AniList to populate stream cards when Consumet is down
export async function searchWithAnilistFallback(query: string, page = 1): Promise<ConsumetAnime[]> {
  // First try Consumet
  try {
    const res = await fetch(`https://api.consumet.org/meta/anilist/search?keyword=${encodeURIComponent(query)}&page=${page}`);
    if (res.ok) {
      const json = await res.json();
      if (json.results?.length > 0) return json.results as ConsumetAnime[];
    }
  } catch {
    // Consumet unavailable, fall through to AniList
  }

  // Fallback to AniList GraphQL
  return cachedFetch(`consumet-fallback-${query}-${page}`, async () => {
    const anilistRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($search: String, $page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { media(search: $search, type: ANIME, sort: SEARCH_MATCH) { id title { romaji english } coverImage { large } format episodes status genres averageScore description startDate { year month } season seasonYear siteUrl } } }`,
        variables: { search: query, page, perPage: 20 },
      }),
    });
    if (!anilistRes.ok) throw new Error(`AniList fallback failed: ${anilistRes.status}`);
    const json = await anilistRes.json();
    return (json.data?.Page?.media || []).map((m: any) => ({
      id: String(m.id),
      title: m.title.english || m.title.romaji,
      japanese: m.title.romaji,
      image: m.coverImage?.large,
      type: m.format,
      status: m.status,
      genres: m.genres,
      totalEpisodes: m.episodes,
      description: m.description,
    }));
  });
}

export async function getRecentAnimeFallback(page = 1): Promise<ConsumetAnime[]> {
  return cachedFetch(`consumet-recent-fallback-${page}`, async () => {
    const anilistRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { media(sort: TRENDING, type: ANIME, season: CURRENT) { id title { romaji english } coverImage { large } format episodes status genres averageScore description startDate { year month } season seasonYear siteUrl } } }`,
        variables: { page, perPage: 20 },
      }),
    });
    if (!anilistRes.ok) throw new Error(`AniList recent failed: ${anilistRes.status}`);
    const json = await anilistRes.json();
    return (json.data?.Page?.media || []).map((m: any) => ({
      id: String(m.id),
      title: m.title.english || m.title.romaji,
      japanese: m.title.romaji,
      image: m.coverImage?.large,
      type: m.format,
      status: m.status,
      genres: m.genres,
      totalEpisodes: m.episodes,
      description: m.description,
    }));
  });
}

export function parseConsumetToStream(anime: ConsumetAnime, episodeUrl?: string): StreamItem {
  const isEpisode = !!episodeUrl;
  return {
    id: isEpisode ? `consumet-${anime.id}-ep-${episodeUrl}` : `consumet-${anime.id}`,
    title: isEpisode ? `${anime.title} - Episode` : anime.title,
    name: anime.title,
    category: 'Anime',
    poster: anime.image,
    status: 'live',
    provider: 'anime',
    streamType: 'embed',
    directEmbedUrl: episodeUrl || '',
    viewers: Math.floor(Math.random() * 8000) + 500,
  };
}

export const consumetService = {
  searchWithAnilistFallback,
  getRecentAnimeFallback,
  parseConsumetToStream,
};
