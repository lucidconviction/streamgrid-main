/**
 * Sports Replays Service — full match replays, highlights & recaps.
 *
 * Uses the existing NewPipe YouTube search backend at /api/youtube/search
 * (keyless, CORS-enabled via the app's own proxy) to find official channel
 * replays for each sport. Falls back to general YouTube search.
 *
 * No API keys required. No signup.
 */

export interface ReplayVideo {
  id: string;
  videoId: string;
  title: string;
  thumbnail: string;
  duration: number;
  views: number;
  uploader: string;
  uploadDate: string;
  sport: string;
  query: string;
}

export interface SportConfig {
  id: string;
  label: string;
  icon: string;
  queries: string[];
}

export const SPORTS: SportConfig[] = [
  { id: 'nba', label: 'NBA', icon: '🏀', queries: ['NBA full game highlights', 'NBA game recap', 'NBA best plays'] },
  { id: 'nfl', label: 'NFL', icon: '🏈', queries: ['NFL full game highlights', 'NFL game recap', 'NFL top plays'] },
  { id: 'mlb', label: 'MLB', icon: '⚾', queries: ['MLB full game highlights', 'MLB game recap', 'MLB top plays'] },
  { id: 'nhl', label: 'NHL', icon: '🏒', queries: ['NHL full game highlights', 'NHL game recap', 'NHL top plays'] },
  { id: 'soccer', label: 'Soccer', icon: '⚽', queries: ['Soccer full match highlights', 'Premier League highlights', 'Champions League highlights'] },
  { id: 'ncaaf', label: 'College Football', icon: '🏈', queries: ['College Football full game highlights', 'CFP highlights'] },
  { id: 'ncaab', label: 'College Basketball', icon: '🏀', queries: ['March Madness full game highlights', 'NCAA basketball highlights'] },
  { id: 'f1', label: 'F1', icon: '🏎️', queries: ['F1 race highlights', 'Formula 1 race recap'] },
  { id: 'ufc', label: 'UFC', icon: '🥊', queries: ['UFC full fight highlights', 'UFC knockout compilation'] },
  { id: 'tennis', label: 'Tennis', icon: '🎾', queries: ['Tennis match highlights', 'Wimbledon highlights', 'US Open highlights'] },
  { id: 'wwe', label: 'WWE', icon: '🤼', queries: ['WWE Raw highlights', 'WWE SmackDown highlights', 'WWE match highlights'] },
  { id: 'golf', label: 'Golf', icon: '🏌️', queries: ['PGA Tour highlights', 'Masters Tournament highlights', 'golf tournament recap'] },
];

const YOUTUBE_SEARCH = '/api/youtube/search';
const cache = new Map<string, { data: ReplayVideo[]; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000;

async function searchYouTube(query: string, limit = 12): Promise<any[]> {
  const url = `${YOUTUBE_SEARCH}?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`);
  const json = await res.json();
  return json.results || [];
}

function toReplayVideo(r: any, sport: string, query: string): ReplayVideo {
  const thumb = r.thumbnails?.[r.thumbnails.length - 1]?.url
    || r.thumbnails?.[0]?.url
    || '';
  return {
    id: r.videoId,
    videoId: r.videoId,
    title: r.title,
    thumbnail: thumb,
    duration: r.durationSeconds || 0,
    views: r.viewCount || 0,
    uploader: r.uploaderName || '',
    uploadDate: r.uploadDate || '',
    sport,
    query,
  };
}

export async function fetchReplays(sportId: string): Promise<ReplayVideo[]> {
  const sport = SPORTS.find((s) => s.id === sportId);
  if (!sport) return [];

  const cacheKey = `replays-${sportId}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

  const seen = new Set<string>();
  const all: ReplayVideo[] = [];

  for (const query of sport.queries) {
    try {
      const results = await searchYouTube(query, 12);
      for (const r of results) {
        const v = toReplayVideo(r, sportId, query);
        if (!seen.has(v.videoId)) {
          seen.add(v.videoId);
          all.push(v);
        }
      }
    } catch (err) {
      console.warn(`Replay search failed for "${query}":`, err);
    }
  }

  all.sort((a, b) => b.views - a.views);
  cache.set(cacheKey, { data: all, ts: Date.now() });
  return all;
}

export function getSportConfig(id: string): SportConfig | undefined {
  return SPORTS.find((s) => s.id === id);
}

export function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatViews(n: number): string {
  if (!n) return '';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}