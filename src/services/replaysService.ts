/**
 * Sports Replays Service — full match replays, highlights & recaps.
 *
 * Layered per the sports-replays-api.md doc:
 *   1. Highlightly Sports API (primary, needs HIGHLIGHTLY_KEY) — 9 sports,
 *      verified highlights, 100 req/day free. Served via /api/replays/:sport.
 *   2. Official YouTube channel search (fallback, keyless) via the existing
 *      NewPipe-backed /api/youtube/search proxy.
 *
 * If no Highlightly key is configured the service transparently falls back to
 * the YouTube search layer so the UI keeps working out of the box.
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
  /** 'highlightly' when sourced from the Highlightly API, 'youtube' otherwise */
  source: 'highlightly' | 'youtube';
  /** match info when available (Highlightly) */
  home?: string;
  away?: string;
  score?: string;
  category?: string;
  /** direct playable embed (Highlightly embedUrl or YouTube embed) */
  embedUrl: string;
}

export interface SportConfig {
  id: string;
  label: string;
  icon: string;
  queries: string[];
  /** Highlightly sport path (primary source), e.g. 'basketball' */
  highlightly?: string;
}

export const SPORTS: SportConfig[] = [
  { id: 'nba', label: 'NBA', icon: '🏀', highlightly: 'basketball', queries: ['NBA full game highlights', 'NBA game recap', 'NBA best plays'] },
  { id: 'nfl', label: 'NFL', icon: '🏈', highlightly: 'american-football', queries: ['NFL full game highlights', 'NFL game recap', 'NFL top plays'] },
  { id: 'mlb', label: 'MLB', icon: '⚾', highlightly: 'baseball', queries: ['MLB full game highlights', 'MLB game recap', 'MLB top plays'] },
  { id: 'nhl', label: 'NHL', icon: '🏒', highlightly: 'nhl', queries: ['NHL full game highlights', 'NHL game recap', 'NHL top plays'] },
  { id: 'soccer', label: 'Soccer', icon: '⚽', highlightly: 'football', queries: ['Soccer full match highlights', 'Premier League highlights', 'Champions League highlights'] },
  { id: 'ncaaf', label: 'College Football', icon: '🏈', highlightly: 'american-football', queries: ['College Football full game highlights', 'CFP highlights'] },
  { id: 'ncaab', label: 'College Basketball', icon: '🏀', highlightly: 'basketball', queries: ['March Madness full game highlights', 'NCAA basketball highlights'] },
  { id: 'f1', label: 'F1', icon: '🏎️', highlightly: undefined, queries: ['F1 race highlights', 'Formula 1 race recap'] },
  { id: 'ufc', label: 'UFC', icon: '🥊', highlightly: 'martial-arts', queries: ['UFC full fight highlights', 'UFC knockout compilation'] },
  { id: 'tennis', label: 'Tennis', icon: '🎾', highlightly: undefined, queries: ['Tennis match highlights', 'Wimbledon highlights', 'US Open highlights'] },
  { id: 'wwe', label: 'WWE', icon: '🤼', highlightly: undefined, queries: ['WWE Raw highlights', 'WWE SmackDown highlights', 'WWE match highlights'] },
  { id: 'golf', label: 'Golf', icon: '🏌️', highlightly: undefined, queries: ['PGA Tour highlights', 'Masters Tournament highlights', 'golf tournament recap'] },
];

const HIGHLIGHTLY_BASE = '/api/replays';
const YOUTUBE_SEARCH = '/api/youtube/search';
const cache = new Map<string, { data: ReplayVideo[]; ts: number }>();
// Cache aggressively — highlight results appear 0-48h after the match.
const CACHE_TTL = 30 * 60 * 1000;

// ─── Layer 1: Highlightly (primary) ────────────────────────────────────────
async function fetchFromHighlightly(sport: SportConfig, date: string, limit = 20): Promise<ReplayVideo[]> {
  if (!sport.highlightly) return [];
  try {
    const url = `${HIGHLIGHTLY_BASE}/${sport.highlightly}?date=${date}&limit=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const json = await res.json();
    const items: any[] = json.data || json.highlights || [];
    return items.map((h) => ({
      id: String(h.id),
      videoId: String(h.id),
      title: h.title,
      thumbnail: h.imgUrl || h.thumbnail || '',
      duration: 0,
      views: 0,
      uploader: h.channel || h.source || 'Highlightly',
      uploadDate: (h.match?.date || date).slice(0, 10),
      sport: sport.id,
      query: `${sport.label} highlights ${date}`,
      source: 'highlightly' as const,
      home: h.match?.homeTeam?.displayName || '',
      away: h.match?.awayTeam?.displayName || '',
      score: h.match?.state?.score?.current || '',
      category: h.category || '',
      embedUrl: h.embedUrl || h.url || '',
    }));
  } catch {
    return [];
  }
}

// ─── Layer 2: YouTube search (keyless fallback) ────────────────────────────
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
  const videoId = r.videoId;
  return {
    id: videoId,
    videoId,
    title: r.title,
    thumbnail: thumb,
    duration: r.durationSeconds || 0,
    views: r.viewCount || 0,
    uploader: r.uploaderName || '',
    uploadDate: r.uploadDate || '',
    sport,
    query,
    source: 'youtube',
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
  };
}

export async function fetchReplays(sportId: string): Promise<ReplayVideo[]> {
  const sport = SPORTS.find((s) => s.id === sportId);
  if (!sport) return [];

  const date = new Date().toISOString().slice(0, 10);
  const cacheKey = `replays-${sportId}-${date}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

  // Primary: Highlightly (only when a key is configured server-side; the
  // /api/replays endpoint returns an empty array when the key is absent).
  const highlightlyResults = await fetchFromHighlightly(sport, date);
  let all: ReplayVideo[] = [...highlightlyResults];

  // Fallback / supplement: YouTube search over the sport's queries.
  if (all.length === 0) {
    const seen = new Set<string>();
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
  }

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
