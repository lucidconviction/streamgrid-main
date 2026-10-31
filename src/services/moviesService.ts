/**
 * Movies / TV / Anime Service
 *
 * Discovery:
 *  - Movies & TV: TMDB API (key via VITE_TMDB_API_KEY, already configured)
 *  - Anime: AniList GraphQL (no key, CORS-enabled)
 *
 * Embedding (iframe fallback chain, per integration guide):
 *  1. VidSrc (vidsrc.sh)
 *  2. 2embed
 *  3. VidLink
 *  4. pstream (existing fallback in this codebase)
 *  5. Smashy Stream
 *  6. Embed.su
 */

const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
const ANILIST = 'https://graphql.anilist.co';

import {
  TMDBMovie,
  TMDBTVShow,
  getTMDBPopularMovies,
  getTMDBNowPlaying,
  getTMDBTopRatedMovies,
  getTMDBPopularTV,
  getTMDBTopRatedTV,
  getTMDBUpcoming,
  getTMDBAiringTodayTV,
  getTMDBOnTheAirTV,
  getMovieTrailer,
  getTVTrailer,
  searchTMDB,
} from './tmdbService';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MediaType = 'movie' | 'tv' | 'anime';

export interface MovieItem {
  id: string;
  idMal?: number;
  title: string;
  year?: number;
  poster?: string;
  backdrop?: string;
  overview?: string;
  rating?: number;
  type: MediaType;
  tmdbId?: number;
  imdbId?: string;
  extra?: string;
  trailerKey?: string;
}

// ── Embed fallback chains ─────────────────────────────────────────────────────

export function movieEmbedChain(tmdbId: number, imdbId?: string): string[] {
  const chain: string[] = [];
  chain.push(`https://vidsrc.sh/embed/movie?tmdb=${tmdbId}`);
  if (imdbId) chain.push(`https://vidsrc.sh/embed/movie?imdb=${imdbId}`);
  chain.push(`https://vidrock.to/embed/movie/${tmdbId}`);
  chain.push(`https://vidstorm.to/embed/movie/${tmdbId}`);
  chain.push(`https://www.2embed.cc/embed/${tmdbId}`);
  chain.push(`https://vidlink.pro/movie/${tmdbId}`);
  chain.push(`https://anyembed.xyz/embed/tmdb-movie-${tmdbId}`);
  chain.push(`https://embed.smashystream.com/playere.php?tmdb=${tmdbId}`);
  return chain;
}

export function tvEmbedChain(tmdbId: number, imdbId?: string): string[] {
  const chain: string[] = [];
  chain.push(`https://vidsrc.sh/embed/tv?tmdb=${tmdbId}`);
  if (imdbId) chain.push(`https://vidsrc.sh/embed/tv?imdb=${imdbId}`);
  chain.push(`https://vidrock.to/embed/tv/${tmdbId}/1/1`);
  chain.push(`https://vidstorm.to/embed/tv/${tmdbId}/1/1`);
  chain.push(`https://www.2embed.cc/embed/tv/${tmdbId}`);
  chain.push(`https://vidlink.pro/tv/${tmdbId}/1/1`);
  chain.push(`https://anyembed.xyz/embed/tmdb-tv-${tmdbId}`);
  return chain;
}

export function animeEmbedChain(anilistId: number): string[] {
  const chain: string[] = [];
  chain.push(`https://vidrock.to/embed/anime/${anilistId}`);
  chain.push(`https://vidsrc.sh/embed/anime?id=${anilistId}`);
  chain.push(`https://vidstorm.to/embed/anime/${anilistId}`);
  chain.push(`https://vidzee.tv/embed/anime/${anilistId}`);
  chain.push(`https://vidnest.to/embed/anime/${anilistId}`);
  chain.push(`https://vidlink.pro/anime/${anilistId}`);
  chain.push(`https://vidfast.vc/embed/anime/${anilistId}`);
  chain.push(`https://www.videasy.to/embed/anime/${anilistId}`);
  return chain;
}

// ── Movies (TMDB) ─────────────────────────────────────────────────────────────
function movieToItem(m: TMDBMovie): MovieItem {
  const year = m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : undefined;
  return {
    id: `tmdb-movie-${m.id}`,
    title: m.title,
    year,
    poster: m.poster_path ? `${IMG_BASE}${m.poster_path}` : undefined,
    backdrop: m.backdrop_path ? `${IMG_BASE}${m.backdrop_path}` : undefined,
    overview: m.overview,
    rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : undefined,
    type: 'movie',
    tmdbId: m.id,
  };
}

function tvToItem(t: TMDBTVShow): MovieItem {
  const year = t.first_air_date ? parseInt(t.first_air_date.slice(0, 4), 10) : undefined;
  return {
    id: `tmdb-tv-${t.id}`,
    title: t.name,
    year,
    poster: t.poster_path ? `${IMG_BASE}${t.poster_path}` : undefined,
    backdrop: t.backdrop_path ? `${IMG_BASE}${t.backdrop_path}` : undefined,
    overview: t.overview,
    rating: t.vote_average ? Math.round(t.vote_average * 10) / 10 : undefined,
    type: 'tv',
    tmdbId: t.id,
  };
}

export async function fetchMovies(section: 'popular' | 'now' | 'top' | 'upcoming' | 'trending' | 'action' | 'comedy' | 'drama' | 'horror' | 'sci_fi' | 'thriller' | 'romance' | 'animation' | 'family' | 'fantasy' | 'adventure' | 'crime' | 'documentary' | 'mystery' | 'war' | 'western' = 'popular'): Promise<MovieItem[]> {
  const [primary, secondary] = section === 'popular'
    ? await Promise.allSettled([getTMDBPopularMovies(1), getTMDBNowPlaying(1)])
    : section === 'now'
      ? await Promise.allSettled([getTMDBNowPlaying(1), getTMDBPopularMovies(1)])
      : section === 'upcoming'
        ? await Promise.allSettled([getTMDBUpcoming(1), getTMDBPopularMovies(1)])
        : section === 'trending'
          ? await Promise.allSettled([getTMDBTopRatedMovies(1), getTMDBNowPlaying(1)])
          : MOVIE_GENRE_MAP[section as keyof typeof MOVIE_GENRE_MAP]
            ? await Promise.allSettled([getTMDBDiscoverMovies(MOVIE_GENRE_MAP[section as keyof typeof MOVIE_GENRE_MAP]), getTMDBPopularMovies(1)])
            : await Promise.allSettled([getTMDBTopRatedMovies(1), getTMDBPopularMovies(1)]);

  const primaryData = primary.status === 'fulfilled' ? primary.value : [];
  const secondaryData = secondary.status === 'fulfilled' ? secondary.value : [];

  const seen = new Set<number>();
  const out: MovieItem[] = [];
  for (const m of [...primaryData, ...secondaryData]) {
    if (!m.poster_path || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(movieToItem(m));
  }
  return out;
}

export async function fetchTVShows(section: 'popular' | 'onair' | 'top' | 'trending' | 'airing' | 'action_adventure' | 'animation' | 'comedy' | 'crime' | 'documentary' | 'drama' | 'family' | 'kids' | 'mystery' | 'reality' | 'romance' | 'sci_fi_fantasy' | 'soap' | 'talk' | 'thriller' | 'war' = 'popular'): Promise<MovieItem[]> {
  const [primary, secondary] = section === 'popular'
    ? await Promise.allSettled([getTMDBPopularTV(1), getTMDBOnTheAirTV()])
    : section === 'onair'
      ? await Promise.allSettled([getTMDBOnTheAirTV(), getTMDBPopularTV(1)])
      : section === 'airing'
        ? await Promise.allSettled([getTMDBAiringTodayTV(), getTMDBOnTheAirTV()])
        : section === 'trending'
          ? await Promise.allSettled([getTMDBTopRatedTV(1), getTMDBPopularTV(1)])
          : TV_GENRE_MAP[section as keyof typeof TV_GENRE_MAP]
            ? await Promise.allSettled([getTMDBDiscoverTV(TV_GENRE_MAP[section as keyof typeof TV_GENRE_MAP]), getTMDBPopularTV(1)])
            : await Promise.allSettled([getTMDBTopRatedTV(1), getTMDBPopularTV(1)]);

  const primaryData = primary.status === 'fulfilled' ? primary.value : [];
  const secondaryData = secondary.status === 'fulfilled' ? secondary.value : [];

  const seen = new Set<number>();
  const out: MovieItem[] = [];
  for (const t of [...primaryData, ...secondaryData]) {
    if (!t.poster_path || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(tvToItem(t));
  }
  return out;
}

// ── Anime (AniList GraphQL — no key) ──────────────────────────────────────────

interface AniListRaw {
  id: number;
  idMal: number;
  title: { romaji: string; english: string | null };
  coverImage: { large: string };
  averageScore: number;
  episodes: number | null;
  status: string;
  format: string;
  description?: string;
  nextAiringEpisode?: { episode: number; timeUntilAiring: number } | null;
  genres?: string[];
}

const ANIME_QUERY = `query ($page: Int, $search: String) {
  Page(page: $page, perPage: 24) {
    media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
      id
      idMal
      title { romaji english }
      coverImage { large }
      averageScore
      episodes
      status
      format
      description(asHtml: false)
      nextAiringEpisode { episode timeUntilAiring }
      genres
    }
  }
}`;

const ANIME_TRENDING_QUERY = `query ($page: Int) {
  Page(page: $page, perPage: 24) {
    media(type: ANIME, sort: TRENDING_DESC) {
      id
      idMal
      title { romaji english }
      coverImage { large }
      averageScore
      episodes
      status
      format
      description(asHtml: false)
      nextAiringEpisode { episode timeUntilAiring }
      genres
    }
  }
}`;

async function anilistFetch(query: string, variables: Record<string, unknown>): Promise<AniListRaw[]> {
  const res = await fetch(ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList request failed: ${res.status}`);
  const json = await res.json();
  const data: AniListRaw[] = json?.data?.Page?.media || [];
  return data.filter((m) => m.coverImage?.large);
}

function animeToItem(a: AniListRaw): MovieItem {
  return {
    id: `anime-${a.id}`,
    title: a.title.english || a.title.romaji,
    poster: a.coverImage.large,
    overview: a.description
      ? a.description.replace(/\\n/g, '\n').slice(0, 300)
      : undefined,
    rating: a.averageScore ? a.averageScore / 10 : undefined,
    type: 'anime',
    idMal: a.idMal,
    tmdbId: a.idMal,
    extra: [
      a.format,
      a.episodes ? `${a.episodes} eps` : null,
      a.nextAiringEpisode ? `Next ep ${a.nextAiringEpisode.episode}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

export async function fetchAnime(section: 'trending' | 'popular' | 'action' | 'adventure' | 'comedy' | 'drama' | 'fantasy' | 'horror' | 'romance' | 'sci_fi' | 'sports' | 'mystery' | 'thriller' | 'slice_of_life' | 'mecha' = 'trending'): Promise<MovieItem[]> {
  const query = section === 'trending' ? ANIME_TRENDING_QUERY : ANIME_QUERY;
  const variables = section === 'trending' ? { page: 1 } : { page: 1, search: '' };
  const data = await anilistFetch(query, variables);
  if (section === 'trending' || section === 'popular') return data.map(animeToItem);
  const filtered = data.filter((a) => a.genres?.some((g) => g.toLowerCase() === section));
  return filtered.length > 0 ? filtered.map(animeToItem) : data.slice(0, 24).map(animeToItem);
}


const MOVIE_GENRE_MAP: Record<string, number> = {
  action: 28, adventure: 12, animation: 16, comedy: 35, crime: 80,
  documentary: 99, drama: 18, family: 10751, fantasy: 14, horror: 27,
  mystery: 9648, romance: 10743, sci_fi: 878, thriller: 53, war: 37, western: 37,
};

const TV_GENRE_MAP: Record<string, number> = {
  action_adventure: 10759, animation: 16, comedy: 35, crime: 80,
  documentary: 99, drama: 18, family: 10751, kids: 10762,
  mystery: 9648, reality: 10764, romance: 10743, sci_fi_fantasy: 10765,
  soap: 10766, talk: 10767, thriller: 53, war: 37,
};

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchAll(query: string, type: MediaType): Promise<MovieItem[]> {
  if (!query.trim()) return [];

  if (type === 'anime') {
    try {
      const data = await anilistFetch(ANIME_QUERY, { page: 1, search: query });
      return data.map(animeToItem);
    } catch (err) {
      console.warn('Anime search failed:', err);
      return [];
    }
  }

  try {
    const results = await searchTMDB(query, 1);
    const items: MovieItem[] = [];
    for (const r of results) {
      if (r.media_type === 'movie' && r.poster_path) {
        items.push(movieToItem({ ...r, release_date: r.first_air_date || r.release_date } as TMDBMovie));
      } else if (r.media_type === 'tv' && r.poster_path) {
        items.push(tvToItem(r as TMDBTVShow));
      }
    }
    return items;
  } catch (err) {
    console.warn('TMDB search failed:', err);
    return [];
  }
}

// ── Trailers ──────────────────────────────────────────────────────────────────

export async function fetchTrailerKey(item: MovieItem): Promise<string | null> {
  try {
    if (item.type === 'movie' && item.tmdbId) {
      const t = await getMovieTrailer(item.tmdbId);
      return t?.key || null;
    }
    if (item.type === 'tv' && item.tmdbId) {
      const t = await getTVTrailer(item.tmdbId);
      return t?.key || null;
    }
    return null;
  } catch {
    return null;
  }
}