import { StreamItem } from '../types/stream';

/**
 * MoviesAPI service — free movie database (no API key required).
 * Endpoint: https://movies-api.com/api/movies/random
 * Returns movie metadata including id, title, director, year, rating, genres.
 * Used as a supplementary catalog in the Anime tab.
 */

const CACHE_TTL = 10 * 60 * 1000;
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

export interface MoviesApiMovie {
  id: string;
  title: string;
  director: string;
  year: number;
  rating: number;
  releaseDate: string;
  genres: string[];
  writers: string[];
  stars: string[];
}

const MOVIES_API_BASE = 'https://movies-api.com/api/movies';

export async function fetchRandomMovie(): Promise<MoviesApiMovie> {
  const res = await fetch(`${MOVIES_API_BASE}/random`);
  if (!res.ok) throw new Error(`MoviesAPI random failed: ${res.status}`);
  return res.json();
}

export async function fetchMultipleRandomMovies(count = 20): Promise<MoviesApiMovie[]> {
  const promises = Array.from({ length: count }, () =>
    fetchRandomMovie().catch(() => null)
  );
  const results = await Promise.allSettled(promises);
  return results
    .filter((r): r is PromiseFulfilledResult<MoviesApiMovie> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);
}

export async function getMoviesApiCatalog(): Promise<MoviesApiMovie[]> {
  return cachedFetch('moviesapi-catalog', async () => {
    return fetchMultipleRandomMovies(20);
  });
}

/**
 * Generate a P-Stream embed URL from a movie title search.
 * P-Stream accepts IMDb IDs — we construct a search-based URL.
 */
export function buildMoviesApiEmbedUrl(movie: MoviesApiMovie): string {
  const encodedTitle = encodeURIComponent(movie.title);
  return `https://embed.pstream.cfd/search/${encodedTitle}`;
}

export function moviesApiMovieToStream(movie: MoviesApiMovie): StreamItem {
  return {
    id: `moviesapi-${movie.id}`,
    title: movie.title,
    name: movie.title,
    category: 'Movies',
    poster: undefined,
    status: 'live' as const,
    provider: 'anime' as const,
    streamType: 'embed' as const,
    directEmbedUrl: buildMoviesApiEmbedUrl(movie),
    viewers: Math.floor(Math.random() * 15000) + 2000,
    date: movie.year,
  };
}

export const moviesApiService = {
  fetchRandomMovie,
  fetchMultipleRandomMovies,
  getMoviesApiCatalog,
  buildMoviesApiEmbedUrl,
  moviesApiMovieToStream,
};
