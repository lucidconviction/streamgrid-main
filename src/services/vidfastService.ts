import { StreamItem } from '../types/stream';

/**
 * VidFast embed service — generates VidFast embed URLs from AniList anime metadata.
 * VidFast supports anime, movies, and TV shows.
 * URL pattern: https://vidfast.xyz/embed/anime/{anilist-id}
 * Fallback: https://vidfast.net/embed/anime/{anilist-id}
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

export interface AnilistAnimeMeta {
  id: number;
  title: { romaji: string; english?: string };
  coverImage?: { large: string; medium: string };
  format?: string;
  episodes?: number;
  status?: string;
  genres?: string[];
  averageScore?: number;
  description?: string;
  startDate?: { year?: number; month?: number };
  siteUrl?: string;
}

const ANILIST_GRAPHQL = 'https://graphql.anilist.co';

const SEARCH_Q = `
  query($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id title { romaji english }
        coverImage { large medium }
        format episodes status genres averageScore
        description startDate { year month } season siteUrl
      }
    }
  }
`;

const TRENDING_Q = `
  query($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(sort: TRENDING, type: ANIME, season: CURRENT) {
        id title { romaji english }
        coverImage { large medium }
        format episodes status genres averageScore
        description startDate { year month } season siteUrl
      }
    }
  }
`;

const POPULAR_Q = `
  query($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(sort: POPULARITY, type: ANIME) {
        id title { romaji english }
        coverImage { large medium }
        format episodes status genres averageScore
        description startDate { year month } season siteUrl
      }
    }
  }
`;

export async function searchAniListForVidfast(query: string, page = 1): Promise<AnilistAnimeMeta[]> {
  return cachedFetch(`vidfast-search-${query}-${page}`, async () => {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: SEARCH_Q, variables: { search: query, page, perPage: 20 } }),
    });
    if (!res.ok) throw new Error(`AniList search failed: ${res.status}`);
    const json = await res.json();
    return (json.data?.Page?.media || []) as AnilistAnimeMeta[];
  });
}

export async function getTrendingAniListForVidfast(): Promise<AnilistAnimeMeta[]> {
  return cachedFetch('vidfast-trending', async () => {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: TRENDING_Q, variables: { page: 1, perPage: 20 } }),
    });
    if (!res.ok) throw new Error(`AniList trending failed: ${res.status}`);
    const json = await res.json();
    return (json.data?.Page?.media || []) as AnilistAnimeMeta[];
  });
}

export async function getPopularAniListForVidfast(): Promise<AnilistAnimeMeta[]> {
  return cachedFetch('vidfast-popular', async () => {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: POPULAR_Q, variables: { page: 1, perPage: 20 } }),
    });
    if (!res.ok) throw new Error(`AniList popular failed: ${res.status}`);
    const json = await res.json();
    return (json.data?.Page?.media || []) as AnilistAnimeMeta[];
  });
}

/**
 * Generate VidFast embed URL from AniList anime ID.
 * VidFast uses the AniList ID directly in their embed URLs.
 */
export function buildVidFastUrl(anilistId: number, episode?: number): string {
  const epSuffix = episode ? `/${episode}` : '';
  return `https://vidfast.xyz/embed/anime/${anilistId}${epSuffix}`;
}

export function vidfastAnimeToStream(anime: AnilistAnimeMeta, episode?: number): StreamItem {
  const isEp = !!episode;
  return {
    id: isEp ? `vidfast-${anime.id}-ep-${episode}` : `vidfast-${anime.id}`,
    title: isEp ? `${anime.title.english || anime.title.romaji} - Episode ${episode}` : (anime.title.english || anime.title.romaji),
    name: anime.title.english || anime.title.romaji,
    category: 'Anime',
    poster: anime.coverImage?.large,
    status: 'live' as const,
    provider: 'anime' as const,
    streamType: 'embed' as const,
    directEmbedUrl: buildVidFastUrl(anime.id, episode),
    viewers: Math.floor(Math.random() * 10000) + 500,
    date: anime.startDate?.year,
  };
}

export const vidfastService = {
  searchAniListForVidfast,
  getTrendingAniListForVidfast,
  getPopularAniListForVidfast,
  buildVidFastUrl,
  vidfastAnimeToStream,
};
