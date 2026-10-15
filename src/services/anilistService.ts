import { StreamItem } from '../types/stream';

/**
 * AniList GraphQL API service — rich anime metadata and search
 * https://anilist.gitbook.io/anilist-apiv2-docs/
 */

const ANILIST_GRAPHQL = 'https://graphql.anilist.co';

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

export interface AnilistMedia {
  id: number;
  title: { romaji: string; english?: string; native?: string };
  coverImage: { large: string; medium: string };
  format?: string;
  episodes?: number;
  status?: string;
  genres?: string[];
  averageScore?: number;
  description?: string;
  startDate?: { year?: number; month?: number };
  season?: string;
  seasonYear?: number;
  siteUrl?: string;
}

export interface AnilistSearchResult {
  id: number;
  title: { romaji: string; english?: string };
  coverImage: { large: string; medium: string };
  format?: string;
  episodes?: number;
  status?: string;
  genres?: string[];
  averageScore?: number;
  description?: string;
  startDate?: { year?: number; month?: number };
  season?: string;
  seasonYear?: number;
  siteUrl?: string;
}

const SEARCH_QUERY = `
  query($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title { romaji english native }
        coverImage { large medium }
        format
        episodes
        status
        genres
        averageScore
        description
        startDate { year month }
        season
        seasonYear
        siteUrl
      }
    }
  }
`;

const TRENDING_QUERY = `
  query($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(sort: TRENDING, type: ANIME, season: CURRENT) {
        id
        title { romaji english native }
        coverImage { large medium }
        format
        episodes
        status
        genres
        averageScore
        description
        startDate { year month }
        season
        seasonYear
        siteUrl
      }
    }
  }
`;

const POPULAR_QUERY = `
  query($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(sort: POPULARITY, type: ANIME) {
        id
        title { romaji english native }
        coverImage { large medium }
        format
        episodes
        status
        genres
        averageScore
        description
        startDate { year month }
        season
        seasonYear
        siteUrl
      }
    }
  }
`;

export async function searchAniList(query: string, page = 1): Promise<AnilistSearchResult[]> {
  return cachedFetch(`anilist-search-${query}-${page}`, async () => {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: query, page, perPage: 20 } }),
    });
    if (!res.ok) throw new Error(`AniList search failed: ${res.status}`);
    const json = await res.json();
    return (json.data?.Page?.media || []) as AnilistSearchResult[];
  });
}

export async function getTrendingAnime(page = 1): Promise<AnilistSearchResult[]> {
  return cachedFetch(`anilist-trending-${page}`, async () => {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: TRENDING_QUERY, variables: { page, perPage: 20 } }),
    });
    if (!res.ok) throw new Error(`AniList trending failed: ${res.status}`);
    const json = await res.json();
    return (json.data?.Page?.media || []) as AnilistSearchResult[];
  });
}

export async function getPopularAnime(page = 1): Promise<AnilistSearchResult[]> {
  return cachedFetch(`anilist-popular-${page}`, async () => {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: POPULAR_QUERY, variables: { page, perPage: 20 } }),
    });
    if (!res.ok) throw new Error(`AniList popular failed: ${res.status}`);
    const json = await res.json();
    return (json.data?.Page?.media || []) as AnilistSearchResult[];
  });
}

export function parseAnilistToStream(anime: AnilistSearchResult, episodeUrl?: string): StreamItem {
  const isEpisode = !!episodeUrl;
  return {
    id: isEpisode ? `anilist-${anime.id}-ep-${episodeUrl}` : `anilist-${anime.id}`,
    title: isEpisode ? `${anime.title.english || anime.title.romaji} - Episode` : (anime.title.english || anime.title.romaji),
    name: anime.title.english || anime.title.romaji,
    category: 'Anime',
    poster: anime.coverImage?.large,
    status: 'live',
    provider: 'anime',
    streamType: 'embed',
    directEmbedUrl: episodeUrl || (anime.siteUrl || ''),
    viewers: Math.floor(Math.random() * 8000) + 500,
  };
}

export const anilistService = {
  searchAniList,
  getTrendingAnime,
  getPopularAnime,
  parseAnilistToStream,
};
