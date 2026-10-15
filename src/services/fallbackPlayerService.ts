import { StreamItem } from '../types/stream';

/**
 * Fallback Player Service
 * Generates alternate embed URLs from multiple providers when the primary stream fails.
 */

// ── Provider URL Templates ────────────────────────────────────────────────────

const PROVIDERS = {
  VIDFAST: 'https://vidfast.xyz',
  VIDFAST_V2: 'https://vidfast.vc',
  PSTREAM: 'https://embed.pstream.cfd',
  MOVIESAPI: 'https://moviesapi.to',
  DoodStream: 'https://dood.ws/e/',
} as const;

// ── ID Extraction ─────────────────────────────────────────────────────────────

interface StreamIds {
  tmdbId?: number;
  anilistId?: number;
  imdbId?: string;
  malId?: number;
}

export function extractStreamIds(stream: StreamItem): StreamIds {
  const ids: StreamIds = {};
  const id = stream.id || '';

  // TMDB: tmdb-12345 or tmdb-12345-movie or tmdb-12345-tv
  const tmdbMatch = id.match(/^tmdb-(\d+)(?:-(movie|tv))?$/);
  if (tmdbMatch) {
    ids.tmdbId = parseInt(tmdbMatch[1], 10);
    return ids;
  }

  // AniList: anilist-12345 or anilist-anime-12345
  const anilistMatch = id.match(/anilist[-_]?(anime[-_]?)?(\d+)/i);
  if (anilistMatch) {
    ids.anilistId = parseInt(anilistMatch[2], 10);
    return ids;
  }

  // MAL: mal-12345
  const malMatch = id.match(/^mal-(\d+)/i);
  if (malMatch) {
    ids.malId = parseInt(malMatch[1], 10);
    return ids;
  }

  // IMDB: tt1234567
  const imdbMatch = id.match(/(tt\d+)/i);
  if (imdbMatch) {
    ids.imdbId = imdbMatch[1];
    return ids;
  }

  // Try to extract from directEmbedUrl
  const url = stream.directEmbedUrl || '';
  const pstreamMatch = url.match(/pstream\.cfd\/(?:media\/)?tmdb-tv-(\d+)/i) ||
                       url.match(/pstream\.cfd\/movie\/tmdb-(\d+)/i);
  if (pstreamMatch) {
    ids.tmdbId = parseInt(pstreamMatch[1], 10);
    return ids;
  }

  const anilistUrlMatch = url.match(/anilist[-_]?(anime[-_]?)?(\d+)/i);
  if (anilistUrlMatch) {
    ids.anilistId = parseInt(anilistUrlMatch[2], 10);
    return ids;
  }

  return ids;
}

// ── Fallback URL Generators ───────────────────────────────────────────────────

function generateVidFastUrls(ids: StreamIds): string[] {
  const urls: string[] = [];
  if (ids.anilistId) {
    urls.push(`${PROVIDERS.VIDFAST}/embed/anime/${ids.anilistId}`);
    urls.push(`${PROVIDERS.VIDFAST_V2}/embed/anime/${ids.anilistId}`);
  }
  if (ids.tmdbId) {
    urls.push(`${PROVIDERS.VIDFAST}/embed/movie/${ids.tmdbId}`);
    urls.push(`${PROVIDERS.VIDFAST_V2}/embed/movie/${ids.tmdbId}`);
  }
  return urls;
}

function generatePStreamUrls(ids: StreamIds): string[] {
  const urls: string[] = [];
  if (ids.tmdbId) {
    urls.push(`${PROVIDERS.PSTREAM}/media/tmdb-tv-${ids.tmdbId}`);
    urls.push(`${PROVIDERS.PSTREAM}/movie/tmdb-${ids.tmdbId}`);
  }
  if (ids.anilistId) {
    urls.push(`${PROVIDERS.PSTREAM}/media/anilist-anime-${ids.anilistId}`);
  }
  if (ids.malId) {
    urls.push(`${PROVIDERS.PSTREAM}/media/mal-${ids.malId}`);
  }
  if (ids.imdbId) {
    urls.push(`${PROVIDERS.PSTREAM}/movie/${ids.imdbId}`);
  }
  return urls;
}

function generateMoviesApiUrls(ids: StreamIds): string[] {
  const urls: string[] = [];
  if (ids.tmdbId) {
    urls.push(`${PROVIDERS.MOVIESAPI}/embed/tv/${ids.tmdbId}`);
    urls.push(`${PROVIDERS.MOVIESAPI}/embed/movie/${ids.tmdbId}`);
  }
  if (ids.imdbId) {
    const numericId = ids.imdbId.replace('tt', '');
    urls.push(`${PROVIDERS.MOVIESAPI}/embed/movie/${numericId}`);
  }
  return urls;
}

function generateGenericFallbacks(stream: StreamItem): string[] {
  const urls: string[] = [];
  const url = stream.directEmbedUrl || '';

  if (!url) return urls;

  // VidFast accepts raw URLs
  urls.push(`${PROVIDERS.VIDFAST_V2}${encodeURIComponent(url)}`);
  urls.push(`${PROVIDERS.VIDFAST}/embed?url=${encodeURIComponent(url)}`);

  // Try extracting any numeric ID from the URL
  const numMatch = url.match(/(\d{5,})/);
  if (numMatch) {
    urls.push(`${PROVIDERS.PSTREAM}/media/${numMatch[1]}`);
    urls.push(`${PROVIDERS.VIDFAST_V2}${numMatch[1]}`);
  }

  return urls;
}

// ── Main Export ────────────────────────────────────────────────────────────────

export interface FallbackSource {
  name: string;
  url: string;
}

export function getFallbackSources(stream: StreamItem): FallbackSource[] {
  const ids = extractStreamIds(stream);
  const results: FallbackSource[] = [];
  const seen = new Set<string>();

  const add = (name: string, url: string) => {
    if (!seen.has(url)) {
      seen.add(url);
      results.push({ name, url });
    }
  };

  // Priority order based on stream type
  const isAnime = stream.provider === 'anime' || stream.category.toLowerCase().includes('anime');
  const isMovie = stream.provider === 'anime' && stream.category === 'Movies';
  const isTV = stream.provider === 'anime' && stream.category === 'TV Shows';
  const isIPTV = stream.provider === 'iptv';
  const hasPrimary = !!(stream.directEmbedUrl || (stream.streams?.[0]?.embedUrl));

  // Always add the primary source first
  if (stream.directEmbedUrl) {
    add('Main', stream.directEmbedUrl);
  } else if (stream.streams?.[0]?.embedUrl) {
    add('Main', stream.streams[0].embedUrl);
  }

  // IPTV streams: try generic fallbacks
  if (isIPTV) {
    generateGenericFallbacks(stream).forEach((url) => add('Backup', url));
    return results;
  }

  // Movies/TV (including anime movies): P-Stream + MoviesAPI + VidFast
  if (isMovie || isTV) {
    generatePStreamUrls(ids).forEach((url) => add('P-Stream', url));
    generateMoviesApiUrls(ids).forEach((url) => add('MoviesAPI', url));
    generateVidFastUrls(ids).forEach((url) => add('VidFast', url));
    return results;
  }

  // General anime (shows/series): VidFast + P-Stream
  if (isAnime) {
    generateVidFastUrls(ids).forEach((url) => add('VidFast', url));
    generatePStreamUrls(ids).forEach((url) => add('P-Stream', url));
    return results;
  }

  // General streams: generic fallbacks
  generateGenericFallbacks(stream).forEach((url) => add('Backup', url));

  // Always add a few universal fallbacks if we have IDs
  if (ids.tmdbId) {
    add('P-Stream', `${PROVIDERS.PSTREAM}/media/tmdb-tv-${ids.tmdbId}`);
    add('MoviesAPI', `${PROVIDERS.MOVIESAPI}/embed/tv/${ids.tmdbId}`);
  }
  if (ids.anilistId) {
    add('VidFast', `${PROVIDERS.VIDFAST}/embed/anime/${ids.anilistId}`);
    add('P-Stream', `${PROVIDERS.PSTREAM}/media/anilist-anime-${ids.anilistId}`);
  }

  return results;
}

/**
 * Get a friendly label for a fallback source
 */
export function getFallbackLabel(source: FallbackSource, index: number): string {
  const url = source.url.toLowerCase();
  if (url.includes('vidfast')) return `VidFast ${index + 1}`;
  if (url.includes('pstream')) return `P-Stream ${index + 1}`;
  if (url.includes('moviesapi')) return `MoviesAPI ${index + 1}`;
  if (url.includes('dood')) return `DoodStream ${index + 1}`;
  return `Mirror ${index + 1}`;
}
