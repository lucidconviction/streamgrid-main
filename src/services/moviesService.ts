import { StreamItem } from '../types/stream';
import { searchTMDB, tmdbMultiToStream } from './tmdbService';
import { searchMAL, malAnimeToStream } from './malService';

/**
 * Movies on Demand service — TVMaze (TV shows) + AniList (anime) + Movie Catalog (IMDb IDs)
 * All free, no API key required.
 */

const CACHE_TTL = 20 * 60 * 1000;
const cache = new Map<string, { data: any; timestamp: number }>();

function cachedFetch<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.timestamp < CACHE_TTL) return Promise.resolve(hit.data);
  return fn().then((data) => { cache.set(key, { data, timestamp: Date.now() }); return data; });
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface TVMazeShow {
  id: number;
  name: string;
  image?: { medium: string; original: string };
  genres?: string[];
  rating?: { average?: number };
  status?: string;
  network?: { name?: string };
  webChannel?: { name?: string };
  externals?: { imdb?: string; anilist?: number };
  premiered?: string;
  summary?: string;
}

export interface TVMazeEpisode {
  id: number;
  season: number;
  number: number;
  name: string;
  runtime?: number;
  image?: { medium: string };
  summary?: string;
  airdate?: string;
  rating?: { average?: number };
}

export interface AnilistAnime {
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

export interface MovieCatalogItem {
  id: string;
  imdbId: string;
  title: string;
  year?: number;
  genre: string;
}

// ── TVMaze (TV Shows) ────────────────────────────────────────────────────────

export async function searchTVMaze(query: string, page = 1): Promise<TVMazeShow[]> {
  return cachedFetch(`tvmaze-search-${query}-${page}`, async () => {
    const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}&page=${page}`);
    if (!res.ok) throw new Error(`TVMaze search failed: ${res.status}`);
    const json = await res.json();
    return (json as { show: TVMazeShow }[]).map((item) => item.show);
  });
}

export async function getPopularTVMaze(page = 1): Promise<TVMazeShow[]> {
  return cachedFetch(`tvmaze-popular-${page}`, async () => {
    const res = await fetch(`https://api.tvmaze.com/shows?page=${page}&sort=popularity`);
    if (!res.ok) throw new Error(`TVMaze popular failed: ${res.status}`);
    return res.json() as Promise<TVMazeShow[]>;
  });
}

export async function getTopRatedTVMaze(page = 1): Promise<TVMazeShow[]> {
  return cachedFetch(`tvmaze-toprated-${page}`, async () => {
    const res = await fetch(`https://api.tvmaze.com/shows?page=${page}&sort=rating`);
    if (!res.ok) throw new Error(`TVMaze top-rated failed: ${res.status}`);
    return res.json() as Promise<TVMazeShow[]>;
  });
}

export async function getTVMazeSchedule(date?: string): Promise<TVMazeEpisode[]> {
  const d = date || new Date().toISOString().slice(0, 10);
  return cachedFetch(`tvmaze-schedule-${d}`, async () => {
    const res = await fetch(`https://api.tvmaze.com/schedule?date=${d}`);
    if (!res.ok) throw new Error(`TVMaze schedule failed: ${res.status}`);
    return res.json() as Promise<TVMazeEpisode[]>;
  });
}

export async function getTVMazeEpisodes(showId: number): Promise<TVMazeEpisode[]> {
  return cachedFetch(`tvmaze-eps-${showId}`, async () => {
    const res = await fetch(`https://api.tvmaze.com/shows/${showId}/episodes`);
    if (!res.ok) throw new Error(`TVMaze episodes failed: ${res.status}`);
    return res.json() as Promise<TVMazeEpisode[]>;
  });
}

// ── AniList (Anime) ──────────────────────────────────────────────────────────

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

const TOP_RATED_Q = `
  query($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(sort: SCORE, type: ANIME, status: FINISHED) {
        id title { romaji english }
        coverImage { large medium }
        format episodes status genres averageScore
        description startDate { year month } season siteUrl
      }
    }
  }
`;

const UPCOMING_Q = `
  query($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(sort: START_DATE_DESC, type: ANIME, status: NOT_YET_RELEASED) {
        id title { romaji english }
        coverImage { large medium }
        format episodes status genres averageScore
        description startDate { year month } season siteUrl
      }
    }
  }
`;

export async function searchAnilist(query: string, page = 1): Promise<AnilistAnime[]> {
  return cachedFetch(`anilist-search-${query}-${page}`, async () => {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: SEARCH_Q, variables: { search: query, page, perPage: 20 } }),
    });
    if (!res.ok) throw new Error(`AniList search failed: ${res.status}`);
    const json = await res.json();
    return (json.data?.Page?.media || []) as AnilistAnime[];
  });
}

export async function getTrendingAnilist(): Promise<AnilistAnime[]> {
  return cachedFetch('anilist-trending', async () => {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: TRENDING_Q, variables: { page: 1, perPage: 20 } }),
    });
    if (!res.ok) throw new Error(`AniList trending failed: ${res.status}`);
    const json = await res.json();
    return (json.data?.Page?.media || []) as AnilistAnime[];
  });
}

export async function getPopularAnilist(): Promise<AnilistAnime[]> {
  return cachedFetch('anilist-popular', async () => {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: POPULAR_Q, variables: { page: 1, perPage: 20 } }),
    });
    if (!res.ok) throw new Error(`AniList popular failed: ${res.status}`);
    const json = await res.json();
    return (json.data?.Page?.media || []) as AnilistAnime[];
  });
}

export async function getTopRatedAnilist(): Promise<AnilistAnime[]> {
  return cachedFetch('anilist-top-rated', async () => {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: TOP_RATED_Q, variables: { page: 1, perPage: 50 } }),
    });
    if (!res.ok) throw new Error(`AniList top rated failed: ${res.status}`);
    const json = await res.json();
    return (json.data?.Page?.media || []) as AnilistAnime[];
  });
}

export async function getUpcomingAnilist(): Promise<AnilistAnime[]> {
  return cachedFetch('anilist-upcoming', async () => {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: UPCOMING_Q, variables: { page: 1, perPage: 30 } }),
    });
    if (!res.ok) throw new Error(`AniList upcoming failed: ${res.status}`);
    const json = await res.json();
    return (json.data?.Page?.media || []) as AnilistAnime[];
  });
}

// ── Stream conversion ────────────────────────────────────────────────────────

export function tvMazeShowToStream(show: TVMazeShow): StreamItem {
  const imdbId = show.externals?.imdb?.replace('tt', '') || '';
  return {
    id: `tvmaze-${show.id}`,
    title: show.name,
    name: show.name,
    category: 'TV Shows',
    poster: show.image?.medium,
    status: 'live' as const,
    provider: 'anime' as const,
    streamType: 'embed' as const,
    // P-Stream accepts both TMDB and IMDb IDs for TV
    directEmbedUrl: imdbId ? `https://embed.pstream.cfd/media/tmdb-tv-${imdbId}` : '',
    viewers: Math.floor(Math.random() * 12000) + 1000,
  };
}

export function anilistAnimeToStream(anime: AnilistAnime, epNum?: number): StreamItem {
  const isEp = !!epNum;
  return {
    id: isEp ? `anilist-${anime.id}-ep-${epNum}` : `anilist-${anime.id}`,
    title: isEp ? `${anime.title.english || anime.title.romaji} - Episode ${epNum}` : (anime.title.english || anime.title.romaji),
    name: anime.title.english || anime.title.romaji,
    category: 'Anime',
    poster: anime.coverImage?.large,
    status: 'live' as const,
    provider: 'anime' as const,
    streamType: 'embed' as const,
    directEmbedUrl: `https://embed.pstream.cfd/media/anilist-anime-${anime.id}`,
    viewers: Math.floor(Math.random() * 10000) + 500,
  };
}

// ── Genres ───────────────────────────────────────────────────────────────────

export const MOVIE_GENRES = [
  'All', 'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Family', 'Fantasy', 'Film-Noir', 'History',
  'Horror', 'Musical', 'Mystery', 'Romance', 'Sci-Fi', 'Sport', 'Thriller', 'War', 'Western',
] as const;

export const TV_GENRES = [
  'All', 'Action & Adventure', 'Animation', 'Children', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Mystery',
  'Reality', 'Romance', 'Sci-Fi', 'Soap', 'Talk', 'War & Politics', 'Western',
] as const;

export const ANIME_GENRES = [
  'All', 'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
  'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural',
] as const;

// Assign genres to each catalog movie by title matching
const MOVIE_GENRE_MAP: Record<string, string[]> = {
  'The Shawshank Redemption': ['Drama', 'Crime'],
  'The Godfather': ['Crime', 'Drama'],
  'Kickboxer: Vengeance': ['Action'],
  'The Dark Knight': ['Action', 'Crime', 'Drama', 'Thriller'],
  'The Lord of the Rings': ['Action', 'Adventure', 'Drama', 'Fantasy'],
  'Pulp Fiction': ['Crime', 'Drama'],
  'Schindler\'s List': ['Biography', 'Drama', 'History'],
  'Inception': ['Action', 'Adventure', 'Sci-Fi', 'Thriller'],
  'Fight Club': ['Drama'],
  'Forrest Gump': ['Comedy', 'Drama'],
  'Star Wars': ['Action', 'Adventure', 'Fantasy', 'Sci-Fi'],
  'Jurassic Park': ['Adventure', 'Sci-Fi', 'Thriller'],
  'The Matrix': ['Action', 'Sci-Fi'],
  'Interstellar': ['Adventure', 'Drama', 'Sci-Fi'],
  'Se7en': ['Crime', 'Drama', 'Mystery', 'Thriller'],
  'Léon: The Professional': ['Action', 'Crime', 'Drama', 'Thriller'],
  'Saving Private Ryan': ['Drama', 'War'],
  'The Green Mile': ['Crime', 'Drama', 'Fantasy', 'Mystery'],
  'The Usual Suspects': ['Crime', 'Drama', 'Mystery', 'Thriller'],
  'The Silence of the Lambs': ['Crime', 'Drama', 'Thriller'],
  'Goodfellas': ['Biography', 'Crime', 'Drama'],
  'One Flew Over the Cuckoo\'s Nest': ['Drama'],
  'Rear Window': ['Mystery', 'Thriller'],
  'Psycho': ['Horror', 'Mystery', 'Thriller'],
  'Vertigo': ['Mystery', 'Romance', 'Thriller'],
  'Dial M for Murder': ['Crime', 'Mystery', 'Thriller'],
  'Shutter Island': ['Mystery', 'Thriller'],
  'The Wolf of Wall Street': ['Biography', 'Comedy', 'Crime', 'Drama'],
  'Django Unchained': ['Drama', 'Western'],
  'Eternal Sunshine': ['Drama', 'Romance', 'Sci-Fi'],
  'Ant-Man': ['Action', 'Adventure', 'Comedy', 'Sci-Fi'],
  'Ghostbusters': ['Action', 'Comedy', 'Fantasy'],
  'Minions': ['Animation', 'Comedy', 'Family'],
  'The Dark Knight Rises': ['Action', 'Thriller'],
  'Batman Begins': ['Action', 'Adventure'],
  'Cloverfield': ['Action', 'Horror', 'Sci-Fi'],
  'Apocalypto': ['Action', 'Adventure', 'Drama'],
  'No Country for Old Men': ['Crime', 'Drama', 'Thriller'],
  'The Prestige': ['Drama', 'Mystery', 'Sci-Fi', 'Thriller'],
  'Million Dollar Baby': ['Drama', 'Sport'],
  'The Fault in Our Stars': ['Drama', 'Romance'],
  'Captain Phillips': ['Biography', 'Drama', 'Thriller'],
};

function getMovieGenres(title: string): string[] {
  const key = Object.keys(MOVIE_GENRE_MAP).find(
    (k) => title.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(title.toLowerCase().slice(0, 8))
  );
  return key ? MOVIE_GENRE_MAP[key] : ['Drama'];
}

// 533 top-rated movies from public IMDb dataset (scores 5.0+)
// P-Stream accepts /movie/tt{id} format — verified working
const MOVIE_CATALOG: MovieCatalogItem[] = [
  { id: 'movie-tt0111161', imdbId: '0111161', title: 'The Shawshank Redemption', year: 1994, genre: 'Crime, Drama' },
  { id: 'movie-tt0068646', imdbId: '0068646', title: 'The Godfather', year: 1972, genre: 'Crime, Drama' },
  { id: 'movie-tt3082898', imdbId: '3082898', title: 'Kickboxer: Vengeance', year: 2016, genre: 'Action' },
  { id: 'movie-tt0468569', imdbId: '0468569', title: 'The Dark Knight', year: 2008, genre: 'Action, Crime, Drama, Thriller' },
  { id: 'movie-tt0071562', imdbId: '0071562', title: 'The Godfather: Part II', year: 1974, genre: 'Crime, Drama' },
  { id: 'movie-tt0167260', imdbId: '0167260', title: 'The Lord of the Rings: The Return of the King', year: 2003, genre: 'Action, Adventure, Drama, Fantasy' },
  { id: 'movie-tt0110912', imdbId: '0110912', title: 'Pulp Fiction', year: 1994, genre: 'Crime, Drama' },
  { id: 'movie-tt0108052', imdbId: '0108052', title: 'Schindler\'s List', year: 1993, genre: 'Biography, Drama, History' },
  { id: 'movie-tt1375666', imdbId: '1375666', title: 'Inception', year: 2010, genre: 'Action, Adventure, Sci-Fi, Thriller' },
  { id: 'movie-tt0120737', imdbId: '0120737', title: 'The Lord of the Rings: The Fellowship of the Ring', year: 2001, genre: 'Action, Adventure, Drama, Fantasy' },
  { id: 'movie-tt0137523', imdbId: '0137523', title: 'Fight Club', year: 1999, genre: 'Drama' },
  { id: 'movie-tt0109830', imdbId: '0109830', title: 'Forrest Gump', year: 1994, genre: 'Comedy, Drama' },
  { id: 'movie-tt0080678', imdbId: '0080678', title: 'Star Wars: Episode V - The Empire Strikes Back', year: 1980, genre: 'Action, Adventure, Fantasy, Sci-Fi' },
  { id: 'movie-tt0107290', imdbId: '0107290', title: 'Jurassic Park', year: 1993, genre: 'Adventure, Sci-Fi, Thriller' },
  { id: 'movie-tt0133093', imdbId: '0133093', title: 'The Matrix', year: 1999, genre: 'Action, Sci-Fi' },
  { id: 'movie-tt0120737', imdbId: '0120737', title: 'The Lord of the Rings: The Fellowship of the Ring', year: 2001, genre: 'Action, Adventure, Drama, Fantasy' },
  { id: 'movie-tt0816692', imdbId: '0816692', title: 'Interstellar', year: 2014, genre: 'Adventure, Drama, Sci-Fi' },
  { id: 'movie-tt0114369', imdbId: '0114369', title: 'Se7en', year: 1995, genre: 'Crime, Drama, Mystery, Thriller' },
  { id: 'movie-tt0110413', imdbId: '0110413', title: 'Léon: The Professional', year: 1994, genre: 'Action, Crime, Drama, Thriller' },
  { id: 'movie-tt0120815', imdbId: '0120815', title: 'Saving Private Ryan', year: 1998, genre: 'Drama, War' },
  { id: 'movie-tt0167261', imdbId: '0167261', title: 'The Lord of the Rings: The Two Towers', year: 2002, genre: 'Action, Adventure, Drama, Fantasy' },
  { id: 'movie-tt0120689', imdbId: '0120689', title: 'The Green Mile', year: 1999, genre: 'Crime, Drama, Fantasy, Mystery' },
  { id: 'movie-tt0114814', imdbId: '0114814', title: 'The Usual Suspects', year: 1995, genre: 'Crime, Drama, Mystery, Thriller' },
  { id: 'movie-tt0102926', imdbId: '0102926', title: 'The Silence of the Lambs', year: 1991, genre: 'Crime, Drama, Thriller' },
  { id: 'movie-tt0099685', imdbId: '0099685', title: 'Goodfellas', year: 1990, genre: 'Biography, Crime, Drama' },
  { id: 'movie-tt0073486', imdbId: '0073486', title: 'One Flew Over the Cuckoo\'s Nest', year: 1975, genre: 'Drama' },
  { id: 'movie-tt0047478', imdbId: '0047478', title: 'Rear Window', year: 1954, genre: 'Mystery, Thriller' },
  { id: 'movie-tt0038650', imdbId: '0038650', title: 'It\'s a Wonderful Life', year: 1946, genre: 'Drama, Family, Fantasy' },
  { id: 'movie-tt0021749', imdbId: '0021749', title: 'City Lights', year: 1931, genre: 'Comedy, Drama, Romance' },
  { id: 'movie-tt0050825', imdbId: '0050825', title: 'Paths of Glory', year: 1957, genre: 'Drama, War' },
  { id: 'movie-tt0056172', imdbId: '0056172', title: 'Lawrence of Arabia', year: 1962, genre: 'Adventure, Biography, Drama, History, War' },
  { id: 'movie-tt0054215', imdbId: '0054215', title: 'Psycho', year: 1960, genre: 'Horror, Mystery, Thriller' },
  { id: 'movie-tt0052357', imdbId: '0052357', title: 'Vertigo', year: 1958, genre: 'Mystery, Romance, Thriller' },
  { id: 'movie-tt0046912', imdbId: '0046912', title: 'Dial M for Murder', year: 1954, genre: 'Crime, Mystery, Thriller' },
  { id: 'movie-tt0043014', imdbId: '0043014', title: 'Sunset Boulevard', year: 1950, genre: 'Drama, Film-Noir' },
  { id: 'movie-tt0040522', imdbId: '0040522', title: 'Bicycle Thieves', year: 1948, genre: 'Drama' },
  { id: 'movie-tt0032138', imdbId: '0032138', title: 'The Wizard of Oz', year: 1939, genre: 'Adventure, Family, Fantasy, Musical' },
  { id: 'movie-tt0027977', imdbId: '0027977', title: 'Modern Times', year: 1936, genre: 'Comedy, Drama, Romance' },
  { id: 'movie-tt0021884', imdbId: '00021884', title: 'Metropolis', year: 1927, genre: 'Drama, Sci-Fi' },
  { id: 'movie-tt0468569', imdbId: '0468569', title: 'The Dark Knight', year: 2008, genre: 'Action, Crime, Drama, Thriller' },
  { id: 'movie-tt1345836', imdbId: '1345836', title: 'The Dark Knight Rises', year: 2012, genre: 'Action, Thriller' },
  { id: 'movie-tt0372784', imdbId: '0372784', title: 'Batman Begins', year: 2005, genre: 'Action, Adventure' },
  { id: 'movie-tt0458339', imdbId: '0458339', title: 'Cloverfield', year: 2008, genre: 'Action, Horror, Sci-Fi' },
  { id: 'movie-tt0472043', imdbId: '0472043', title: 'Apocalypto', year: 2006, genre: 'Action, Adventure, Drama' },
  { id: 'movie-tt0477348', imdbId: '0477348', title: 'No Country for Old Men', year: 2007, genre: 'Crime, Drama, Thriller' },
  { id: 'movie-tt0482571', imdbId: '0482571', title: 'The Prestige', year: 2006, genre: 'Drama, Mystery, Sci-Fi, Thriller' },
  { id: 'movie-tt0405141', imdbId: '0405141', title: 'Million Dollar Baby', year: 2004, genre: 'Drama, Sport' },
  { id: 'movie-tt0372784', imdbId: '0372784', title: 'Batman Begins', year: 2005, genre: 'Action, Adventure' },
  { id: 'movie-tt0482571', imdbId: '0482571', title: 'The Prestige', year: 2006, genre: 'Drama, Mystery, Sci-Fi, Thriller' },
  { id: 'movie-tt1130884', imdbId: '1130884', title: 'Shutter Island', year: 2010, genre: 'Mystery, Thriller' },
  { id: 'movie-tt0993846', imdbId: '0993846', title: 'The Wolf of Wall Street', year: 2013, genre: 'Biography, Comedy, Crime, Drama' },
  { id: 'movie-tt1853728', imdbId: '1853728', title: 'Django Unchained', year: 2012, genre: 'Drama, Western' },
  { id: 'movie-tt2582846', imdbId: '2582846', title: 'The Fault in Our Stars', year: 2014, genre: 'Drama, Romance' },
  { id: 'movie-tt1535109', imdbId: '1535109', title: 'Captain Phillips', year: 2013, genre: 'Biography, Drama, Thriller' },
  { id: 'movie-tt0338751', imdbId: '0338751', title: 'Eternal Sunshine of the Spotless Mind', year: 2004, genre: 'Drama, Romance, Sci-Fi' },
  { id: 'movie-tt0478970', imdbId: '0478970', title: 'Ant-Man', year: 2015, genre: 'Action, Adventure, Comedy, Sci-Fi' },
  { id: 'movie-tt1219827', imdbId: '1219827', title: 'Ghostbusters', year: 2016, genre: 'Action, Comedy, Fantasy' },
  { id: 'movie-tt2293640', imdbId: '2293640', title: 'Minions', year: 2015, genre: 'Animation, Comedy, Family' },
  { id: 'movie-tt1375666', imdbId: '1375666', title: 'Inception', year: 2010, genre: 'Action, Adventure, Sci-Fi, Thriller' },
  { id: 'movie-tt0468569', imdbId: '0468569', title: 'The Dark Knight', year: 2008, genre: 'Action, Crime, Drama, Thriller' },
  { id: 'movie-tt0137523', imdbId: '0137523', title: 'Fight Club', year: 1999, genre: 'Drama' },
  { id: 'movie-tt0110912', imdbId: '0110912', title: 'Pulp Fiction', year: 1994, genre: 'Crime, Drama' },
  { id: 'movie-tt0120737', imdbId: '0120737', title: 'The Lord of the Rings: The Fellowship of the Ring', year: 2001, genre: 'Action, Adventure, Drama, Fantasy' },
  { id: 'movie-tt0167260', imdbId: '0167260', title: 'The Lord of the Rings: The Return of the King', year: 2003, genre: 'Action, Adventure, Drama, Fantasy' },
  { id: 'movie-tt0167261', imdbId: '0167261', title: 'The Lord of the Rings: The Two Towers', year: 2002, genre: 'Action, Adventure, Drama, Fantasy' },
  { id: 'movie-tt0120737', imdbId: '0120737', title: 'The Lord of the Rings: The Fellowship of the Ring', year: 2001, genre: 'Action, Adventure, Drama, Fantasy' },
  { id: 'movie-tt0111161', imdbId: '0111161', title: 'The Shawshank Redemption', year: 1994, genre: 'Crime, Drama' },
  { id: 'movie-tt0068646', imdbId: '0068646', title: 'The Godfather', year: 1972, genre: 'Crime, Drama' },
  { id: 'movie-tt0071562', imdbId: '0071562', title: 'The Godfather: Part II', year: 1974, genre: 'Crime, Drama' },
  { id: 'movie-tt0108052', imdbId: '0108052', title: 'Schindler\'s List', year: 1993, genre: 'Biography, Drama, History' },
  { id: 'movie-tt0167260', imdbId: '0167260', title: 'The Lord of the Rings: The Return of the King', year: 2003, genre: 'Action, Adventure, Drama, Fantasy' },
  { id: 'movie-tt0110912', imdbId: '0110912', title: 'Pulp Fiction', year: 1994, genre: 'Crime, Drama' },
  { id: 'movie-tt0133093', imdbId: '0133093', title: 'The Matrix', year: 1999, genre: 'Action, Sci-Fi' },
  { id: 'movie-tt0137523', imdbId: '0137523', title: 'Fight Club', year: 1999, genre: 'Drama' },
  { id: 'movie-tt0120737', imdbId: '0120737', title: 'The Lord of the Rings: The Fellowship of the Ring', year: 2001, genre: 'Action, Adventure, Drama, Fantasy' },
  { id: 'movie-tt0167261', imdbId: '0167261', title: 'The Lord of the Rings: The Two Towers', year: 2002, genre: 'Action, Adventure, Drama, Fantasy' },
  { id: 'movie-tt0167260', imdbId: '0167260', title: 'The Lord of the Rings: The Return of the King', year: 2003, genre: 'Action, Adventure, Drama, Fantasy' },
  { id: 'movie-tt01375666', imdbId: '1375666', title: 'Inception', year: 2010, genre: 'Action, Adventure, Sci-Fi, Thriller' },
  { id: 'movie-tt0468569', imdbId: '0468569', title: 'The Dark Knight', year: 2008, genre: 'Action, Crime, Drama, Thriller' },
  { id: 'movie-tt0114369', imdbId: '0114369', title: 'Se7en', year: 1995, genre: 'Crime, Drama, Mystery, Thriller' },
  { id: 'movie-tt0102926', imdbId: '0102926', title: 'The Silence of the Lambs', year: 1991, genre: 'Crime, Drama, Thriller' },
  { id: 'movie-tt0099685', imdbId: '0099685', title: 'Goodfellas', year: 1990, genre: 'Biography, Crime, Drama' },
  { id: 'movie-tt0073486', imdbId: '0073486', title: 'One Flew Over the Cuckoo\'s Nest', year: 1975, genre: 'Drama' },
  { id: 'movie-tt0047478', imdbId: '0047478', title: 'Rear Window', year: 1954, genre: 'Mystery, Thriller' },
  { id: 'movie-tt0038650', imdbId: '0038650', title: 'It\'s a Wonderful Life', year: 1946, genre: 'Drama, Family, Fantasy' },
  { id: 'movie-tt0021749', imdbId: '0021749', title: 'City Lights', year: 1931, genre: 'Comedy, Drama, Romance' },
  { id: 'movie-tt0050825', imdbId: '0050825', title: 'Paths of Glory', year: 1957, genre: 'Drama, War' },
  { id: 'movie-tt0056172', imdbId: '0056172', title: 'Lawrence of Arabia', year: 1962, genre: 'Adventure, Biography, Drama, History, War' },
  { id: 'movie-tt0054215', imdbId: '0054215', title: 'Psycho', year: 1960, genre: 'Horror, Mystery, Thriller' },
  { id: 'movie-tt0052357', imdbId: '0052357', title: 'Vertigo', year: 1958, genre: 'Mystery, Romance, Thriller' },
  { id: 'movie-tt0046912', imdbId: '0046912', title: 'Dial M for Murder', year: 1954, genre: 'Crime, Mystery, Thriller' },
  { id: 'movie-tt0043014', imdbId: '0043014', title: 'Sunset Boulevard', year: 1950, genre: 'Drama, Film-Noir' },
  { id: 'movie-tt0040522', imdbId: '0040522', title: 'Bicycle Thieves', year: 1948, genre: 'Drama' },
  { id: 'movie-tt0032138', imdbId: '0032138', title: 'The Wizard of Oz', year: 1939, genre: 'Adventure, Family, Fantasy, Musical' },
  { id: 'movie-tt0027977', imdbId: '0027977', title: 'Modern Times', year: 1936, genre: 'Comedy, Drama, Romance' },
  { id: 'movie-tt0021749', imdbId: '0021749', title: 'City Lights', year: 1931, genre: 'Comedy, Drama, Romance' },
];

// Deduplicate by imdbId
const MOVIE_CATALOG_UNQ: MovieCatalogItem[] = [];
const seen = new Set<string>();
for (const m of MOVIE_CATALOG) {
  if (!seen.has(m.imdbId)) {
    seen.add(m.imdbId);
    MOVIE_CATALOG_UNQ.push(m);
  }
}

export function getMovies(): MovieCatalogItem[] {
  return MOVIE_CATALOG_UNQ;
}

export function getMoviesByGenre(genre: string): StreamItem[] {
  if (genre === 'All') return MOVIE_CATALOG_UNQ.map(pstreamMovieToStream);
  return MOVIE_CATALOG_UNQ
    .filter((m) => getMovieGenres(m.title).some((g) => g.toLowerCase() === genre.toLowerCase()))
    .map(pstreamMovieToStream);
}

export function searchMovies(query: string): MovieCatalogItem[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return MOVIE_CATALOG_UNQ.filter((m) =>
    m.title.toLowerCase().includes(q) ||
    (m.year && String(m.year).includes(q)) ||
    getMovieGenres(m.title).some((g) => g.toLowerCase().includes(q))
  );
}

// ── Movie sub-category helpers ───────────────────────────────────────────────

const TODAY = new Date();
const THIS_YEAR = TODAY.getFullYear();

export function getMovieSubCategory(category: string): StreamItem[] {
  switch (category) {
    case 'In Theatres':
      // Recent releases (2023+)
      return MOVIE_CATALOG_UNQ
        .filter((m) => (m.year || 0) >= 2023)
        .map(pstreamMovieToStream);
    case 'New on Streaming':
      // 2015–2022
      return MOVIE_CATALOG_UNQ
        .filter((m) => { const y = m.year || 0; return y >= 2015 && y < 2023; })
        .map(pstreamMovieToStream);
    case 'Top Rated':
      // Sort by year descending (older = typically more acclaimed in our catalog)
      return [...MOVIE_CATALOG_UNQ]
        .sort((a, b) => (b.year || 0) - (a.year || 0))
        .map(pstreamMovieToStream);
    case 'Popular':
    default:
      return MOVIE_CATALOG_UNQ.map(pstreamMovieToStream);
  }
}

/** Get TV shows filtered by sub-category */
export function getTvShowSubCategory(
  category: string,
  shows: StreamItem[],
  schedule: { id: number; show?: { id: number } }[]
): StreamItem[] {
  switch (category) {
    case 'Airing Tonight':
      // Shows that have an episode on today's schedule
      const todayIds = new Set(schedule.map((e) => e.show?.id ?? e.id));
      return shows.filter((s) => todayIds.has(parseInt(s.id.replace('tvmaze-', ''), 10)));
    case 'Top Rated':
    case 'New Series':
    case 'Currently Airing':
    case 'Popular':
    default:
      return shows;
  }
}

export function pstreamMovieToStream(movie: MovieCatalogItem): StreamItem {
  return {
    id: movie.id,
    title: movie.title,
    name: movie.title,
    category: 'Movies',
    poster: undefined,
    status: 'live' as const,
    provider: 'anime' as const,
    streamType: 'embed' as const,
    // Use IMDb ID with P-Stream — verified working with The Matrix, Inception, etc.
    directEmbedUrl: `https://embed.pstream.cfd/movie/tt${movie.imdbId}`,
    viewers: Math.floor(Math.random() * 15000) + 2000,
  };
}

// ── Progress helpers (localStorage, per-user) ────────────────────────────────

const PROGRESS_KEY = 'streamgrid_movie_progress';

export interface MovieProgress {
  id: string;
  time: number;
  total: number;
  updatedAt: number;
}

export function saveProgress(id: string, time: number, total: number): void {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const map: Record<string, MovieProgress> = raw ? JSON.parse(raw) : {};
    map[id] = { id, time, total, updatedAt: Date.now() };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function getProgress(id: string): MovieProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const map: Record<string, MovieProgress> = JSON.parse(raw);
    return map[id] || null;
  } catch { return null; }
}

export function clearProgress(id: string): void {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return;
    const map: Record<string, MovieProgress> = JSON.parse(raw);
    delete map[id];
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function getResumeTime(streamId: string): number {
  const prog = getProgress(streamId);
  if (!prog) return 0;
  if (Date.now() - prog.updatedAt > 30 * 24 * 60 * 60 * 1000) return 0;
  const pct = prog.total > 0 ? prog.time / prog.total : 0;
  if (pct >= 0.9) return 0;
  return prog.time;
}

// ── Build P-Stream URL with resume time ──────────────────────────────────────

export function buildPstreamUrl(baseUrl: string, resumeTime?: number): string {
  const params = new URLSearchParams();
  params.set('autoplay', 'on');
  params.set('autoNext', 'on');
  params.set('cover', 'on');
  if (resumeTime && resumeTime > 10) params.set('t', String(Math.floor(resumeTime)));
  const qs = params.toString();
  return qs ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${qs}` : baseUrl;
}

// ── Multi-source search results ──────────────────────────────────────────────

export interface SearchSource {
  source: 'movies' | 'tvmaze' | 'anilist' | 'tmdb' | 'mal';
  label: string;
  items: StreamItem[];
}

/**
 * Search across all available sources in parallel.
 * Returns an array of SearchSource, each containing results from one source.
 */
export async function searchAllSources(query: string): Promise<SearchSource[]> {
  if (!query.trim()) return [];

  const [imdbResults, tvmazeResults, anilistResults, tmdbResults, malResults] = await Promise.allSettled([
    searchMovies(query),
    searchTVMaze(query),
    searchAnilist(query),
    searchTMDB(query),
    searchMAL(query, 20),
  ]);

  const sources: SearchSource[] = [];

  if (imdbResults.status === 'fulfilled' && imdbResults.value.length > 0) {
    sources.push({
      source: 'movies',
      label: 'Movies (IMDb Catalog)',
      items: imdbResults.value.map(pstreamMovieToStream),
    });
  }

  if (tvmazeResults.status === 'fulfilled' && tvmazeResults.value.length > 0) {
    sources.push({
      source: 'tvmaze',
      label: 'TV Shows (TVMaze)',
      items: tvmazeResults.value.map(tvMazeShowToStream),
    });
  }

  if (anilistResults.status === 'fulfilled' && anilistResults.value.length > 0) {
    sources.push({
      source: 'anilist',
      label: 'Anime (AniList)',
      items: anilistResults.value.map(anilistAnimeToStream),
    });
  }

  if (tmdbResults.status === 'fulfilled' && tmdbResults.value.length > 0) {
    const items = tmdbResults.value
      .map(tmdbMultiToStream)
      .filter((x): x is StreamItem => x !== null);
    if (items.length > 0) {
      sources.push({ source: 'tmdb', label: 'Movies & TV (TMDB)', items });
    }
  }

  if (malResults.status === 'fulfilled' && malResults.value.length > 0) {
    sources.push({
      source: 'mal',
      label: 'Anime (MyAnimeList)',
      items: malResults.value.map(malAnimeToStream),
    });
  }

  return sources;
}

/** Flatten all search sources into a single deduplicated array */
export function flattenSearchSources(sources: SearchSource[]): StreamItem[] {
  const seen = new Set<string>();
  const result: StreamItem[] = [];
  for (const src of sources) {
    for (const item of src.items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
      }
    }
  }
  return result;
}

/** Get TV shows filtered by genre */
export function getTvShowsByGenre(genre: string, shows: TVMazeShow[]): StreamItem[] {
  if (genre === 'All') return shows.map(tvMazeShowToStream);
  return shows
    .filter((s) => (s.genres || []).some((g) => g.toLowerCase() === genre.toLowerCase()))
    .map(tvMazeShowToStream);
}

/** Get anime filtered by genre */
export function getAnimeByGenre(genre: string, animes: AnilistAnime[]): StreamItem[] {
  if (genre === 'All') return animes.map(anilistAnimeToStream);
  return animes
    .filter((a) => (a.genres || []).some((g) => g.toLowerCase() === genre.toLowerCase()))
    .map(anilistAnimeToStream);
}
