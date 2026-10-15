// Music service — combines YouTube Music API (artist discovery) with
// yt-dlp backend for full-length track URLs. LocalStorage caches results.

const YT_MUSIC_SEARCH = '/api/ytmusic/youtubei/v1/search';
const MUSIC_BACKEND = '/api/music';
const CACHE_KEY_TOP50 = 'rdnutz_music_top50';
const CACHE_KEY_TRACKS_PREFIX = 'rdnutz_music_tracks_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Types ────────────────────────────────────────────────────────────────────

export interface YouTubeMusicResult {
  id: string;
  title: string;
  channel: string;
  channelId?: string;
  thumbnail: string;
  duration?: string;
}

export interface MusicTrack {
  title: string;
  url: string;
  duration: number;
  thumbnail?: string;
  video_id?: string;
  artist?: string;
}

export interface Artist {
  name: string;
  thumbnail: string;
  channelId?: string;
}

// ── LocalStorage caching helpers ─────────────────────────────────────────────

function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCached<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* storage full — ignore */ }
}

// ── YouTube Music API (artist discovery) ────────────────────────────────────

const YT_MUSIC_ARTIST_FILTER = 'EgMQARoCAlE%3D';

export const getYouTubeChannelAvatar = (channelId: string, apiThumbnail?: string): string => {
  if (apiThumbnail && apiThumbnail.startsWith('http')) return apiThumbnail;
  return `https://yt3.googleusercontent.com/${channelId}/avatar.jpg`;
};

/** Search YouTube Music for artists (uses official API, returns artist cards) */
export const searchYouTubeMusic = async (query: string, limit: number = 10): Promise<YouTubeMusicResult[]> => {
  try {
    const response = await fetch(YT_MUSIC_SEARCH + '?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        query,
        params: YT_MUSIC_ARTIST_FILTER,
        context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20221021.01.00' } },
      }),
    });
    if (!response.ok) return [];
    const data = await response.json();

    const results: YouTubeMusicResult[] = [];
    const sections = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    for (const section of sections) {
      const cardShelf = section.musicCardShelfRenderer;
      if (cardShelf) {
        const title = cardShelf.title?.runs?.[0]?.text || '';
        const subtitle = cardShelf.subtitle?.runs?.[0]?.text || '';
        const thumbnail = cardShelf.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url || '';
        const navigationId = cardShelf.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '';
        if (title && navigationId) {
          results.push({
            id: navigationId,
            title,
            channel: subtitle,
            channelId: navigationId.startsWith('UC') ? navigationId : undefined,
            thumbnail,
          });
        }
        continue;
      }
      const itemContents = section.itemSectionRenderer?.contents || [];
      for (const content of itemContents.slice(0, limit)) {
        const item = content.musicResponsiveListItemRenderer;
        if (!item) continue;
        const title = item.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || '';
        const subtitle = item.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || '';
        const thumbnail = item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url || '';
        const navigationId = item.navigationEndpoint?.browseEndpoint?.browseId || '';
        if (title && navigationId) {
          results.push({
            id: navigationId,
            title,
            channel: subtitle,
            channelId: navigationId.startsWith('UC') ? navigationId : undefined,
            thumbnail,
          });
        }
      }
    }
    return results;
  } catch (e) {
    console.warn('YouTube Music search failed:', e);
    return [];
  }
};

// ── Top 50 Artists (YouTube Music API, cached in localStorage) ─────────────

/** Known artist queries ordered by global popularity */
const TOP_50_QUERIES = [
  'Taylor Swift', 'Drake', 'The Weeknd', 'Billie Eilish', 'Ariana Grande',
  'Travis Scott', 'Kendrick Lamar', 'Dua Lipa', 'Ed Sheeran', 'Bad Bunny',
  'Post Malone', 'Olivia Rodrigo', 'Harry Styles', 'Beyoncé', 'Rihanna',
  'Bruno Mars', 'Justin Bieber', 'Lady Gaga', 'Imagine Dragons', 'Coldplay',
  'Kanye West', 'Playboi Carti', 'Lil Uzi Vert', 'Frank Ocean', 'Tyler The Creator',
  'Doja Cat', 'Lana Del Rey', 'Juice WRLD', 'Eminem', 'SZA',
  'Miley Cyrus', 'Selena Gomez', 'The Kid LAROI', 'Ice Spice', 'Sabrina Carpenter',
  'Chappell Roan', 'Benson Boone', 'Shaboozey', 'Kodak Black', 'Lil Durk',
  'Gunna', 'Lil Baby', 'Megan Thee Stallion', 'Adele', 'Mariah Carey',
  'Ariana Grande', 'Billie Eilish', 'Olivia Rodrigo', 'Taylor Swift', 'Drake',
];

export const fetchTop50Artists = async (): Promise<Artist[]> => {
  // Check local cache first
  const cached = getCached<Artist[]>(CACHE_KEY_TOP50);
  if (cached && cached.length >= 50) return cached;

  const allArtists: Artist[] = [];
  const seen = new Set<string>();

  // Fetch from YouTube Music API in parallel batches
  const batchSize = 5;
  for (let i = 0; i < TOP_50_QUERIES.length && allArtists.length < 50; i += batchSize) {
    const batch = TOP_50_QUERIES.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(q => searchYouTubeMusic(q, 3))
    );

    for (const item of results.flat()) {
      const key = item.title.toLowerCase();
      if (!seen.has(key) && item.channelId) {
        seen.add(key);
        allArtists.push({
          name: item.title,
          thumbnail: getYouTubeChannelAvatar(item.channelId || '', item.thumbnail),
          channelId: item.channelId,
        });
      }
      if (allArtists.length >= 50) break;
    }
  }

  if (allArtists.length >= 50) {
    setCached(CACHE_KEY_TOP50, allArtists.slice(0, 50));
  }

  return allArtists.slice(0, 50);
};

export const get_cachedTop50Artists = (): Artist[] | null => getCached<Artist[]>(CACHE_KEY_TOP50);

// ── Artist Tracks (via yt-dlp backend) ─────────────────────────────────────

export const fetchArtistTracks = async (artistName: string): Promise<{ artist: string; thumbnail: string; tracks: MusicTrack[] } | null> => {
  // Check local cache
  const cacheKey = CACHE_KEY_TRACKS_PREFIX + artistName.toLowerCase().replace(/\s+/g, '_');
  const cached = getCached<{ artist: string; thumbnail: string; tracks: MusicTrack[] }>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${MUSIC_BACKEND}/tracks/${encodeURIComponent(artistName)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.tracks || data.tracks.length === 0) return null;

    const result = {
      artist: data.artist || artistName,
      thumbnail: data.thumbnail || '',
      tracks: data.tracks.map((t: any) => ({
        title: t.title || 'Unknown',
        url: t.url || '',
        duration: t.duration || 0,
        thumbnail: t.thumbnail,
        video_id: t.video_id,
        artist: t.artist || data.artist || artistName,
      })),
    };

    setCached(cacheKey, result);
    return result;
  } catch (e) {
    console.warn('Failed to fetch tracks:', e);
    return null;
  }
};

export const getCachedArtistTracks = (artistName: string): { artist: string; thumbnail: string; tracks: MusicTrack[] } | null => {
  const cacheKey = CACHE_KEY_TRACKS_PREFIX + artistName.toLowerCase().replace(/\s+/g, '_');
  return getCached(cacheKey);
};

// ── Search (combines YT Music API for discovery) ────────────────────────────

export const searchArtists = async (query: string, limit: number = 30): Promise<Artist[]> => {
  const ytResults = await searchYouTubeMusic(query, limit);
  return ytResults
    .filter(r => r.channelId)
    .map(r => ({
      name: r.title,
      thumbnail: getYouTubeChannelAvatar(r.channelId || '', r.thumbnail),
      channelId: r.channelId,
    }))
    .slice(0, limit);
};
