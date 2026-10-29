/**
 * Sports Calendar Service — upcoming events from the ESPN unofficial API.
 *
 * No API key, no signup. CORS is enabled (Access-Control-Allow-Origin: *),
 * so the browser can call the API directly.
 *
 * Coverage: NFL, College Football, NBA, College Basketball, NHL, MLB,
 * Soccer (global), F1, NASCAR, UFC, Tennis (ATP/WTA), PGA Golf, WWE, Cricket (IPL).
 */

// ── Types ──────────────────────────────────────────────────────────────────
export interface UpcomingEvent {
  id: string;
  sport: string;
  league: string;
  name: string;
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  /** ISO start time */
  date: string;
  /** pre | in | post */
  state: string;
  detail: string;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
  broadcast?: string;
}

// ── Sport registry ─────────────────────────────────────────────────────────
export interface SportInfo {
  slug: string;
  path: string;
  label: string;
  emoji: string;
}

export const SPORTS: SportInfo[] = [
  { slug: 'nfl', path: 'football/nfl', label: 'NFL', emoji: '🏈' },
  { slug: 'college-football', path: 'football/college-football', label: 'College FB', emoji: '🏈' },
  { slug: 'nba', path: 'basketball/nba', label: 'NBA', emoji: '🏀' },
  { slug: 'college-basketball', path: 'basketball/college-basketball', label: 'College BKB', emoji: '🏀' },
  { slug: 'nhl', path: 'hockey/nhl', label: 'NHL', emoji: '🏒' },
  { slug: 'mlb', path: 'baseball/mlb', label: 'MLB', emoji: '⚾' },
  { slug: 'soccer', path: 'soccer', label: 'Soccer', emoji: '⚽' },
  { slug: 'f1', path: 'motorsports/f1', label: 'Formula 1', emoji: '🏎️' },
  { slug: 'nascar', path: 'racing/nascar', label: 'NASCAR', emoji: '🏁' },
  { slug: 'ufc', path: 'mma/ufc', label: 'UFC', emoji: '🥊' },
  { slug: 'atp', path: 'tennis/atp', label: 'ATP', emoji: '🎾' },
  { slug: 'wta', path: 'tennis/wta', label: 'WTA', emoji: '🎾' },
  { slug: 'pga', path: 'golf/pga', label: 'PGA Golf', emoji: '⛳' },
  { slug: 'wwe', path: 'wrestling/wwe', label: 'WWE', emoji: '💪' },
  { slug: 'ipl', path: 'cricket/ipl', label: 'IPL', emoji: '🏏' },
];

export const SPORT_INFO: Record<string, SportInfo> = Object.fromEntries(
  SPORTS.map((s) => [s.slug, s])
);

// ── Cache (module level, 15 min TTL) ───────────────────────────────────────
const CACHE_TTL_MS = 15 * 60 * 1000;
let cache: { ts: number; events: UpcomingEvent[] } | null = null;

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = (d: Date): string =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

function mapEvent(e: any, sportSlug: string, leagueName: string): UpcomingEvent | null {
  try {
    if (!e || !e.id) return null;
    const comp = e.competitions?.[0];
    if (!comp) return null;
    const state = comp.status?.type?.state;
    // Only keep upcoming + live events; drop finished games
    if (state === 'post' || comp.status?.type?.completed) return null;

    const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
    const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
    const broadcast = e.broadcast?.broadcasters?.[0]?.name;

    return {
      id: String(e.id),
      sport: sportSlug,
      league: leagueName || sportSlug,
      name: e.name || '',
      home: home?.team?.name || home?.displayName || home?.name || '',
      away: away?.team?.name || away?.displayName || away?.name || '',
      homeLogo: home?.team?.logo || undefined,
      awayLogo: away?.team?.logo || undefined,
      date: e.date || '',
      state: state || 'pre',
      detail: comp.status?.type?.detail || '',
      homeScore: typeof home?.score === 'number' ? home.score : undefined,
      awayScore: typeof away?.score === 'number' ? away.score : undefined,
      venue: e.venue?.fullName || undefined,
      broadcast: broadcast || undefined,
    };
  } catch {
    return null;
  }
}

// ── Fetch ──────────────────────────────────────────────────────────────────
/**
 * Fetch upcoming + live events for today and the next 14 days across all sports.
 * ESPN's scoreboard supports a `from`/`to` date range (max 31 days).
 * Falls back to the last cached payload if the network fails.
 */
export async function fetchUpcomingEvents(force = false): Promise<UpcomingEvent[]> {
  if (!force && cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return cache.events;
  }

  const now = new Date();
  const from = fmtDate(now);
  const to = new Date(now.getTime() + 14 * 86400000);
  const toStr = fmtDate(to);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await Promise.all(
      SPORTS.map(async (s) => {
        try {
          const url = `https://site.api.espn.com/apis/site/v2/sports/${s.path}/scoreboard?from=${from}&to=${toStr}`;
          const r = await fetch(url, { signal: controller.signal });
          if (!r.ok) return null;
          return { slug: s.slug, data: await r.json() };
        } catch {
          return null;
        }
      })
    );
    clearTimeout(timer);

    const events: UpcomingEvent[] = [];
    const seen = new Set<string>();
    for (const entry of res) {
      if (!entry) continue;
      const leagueName = entry.data?.headers?.league?.name || entry.data?.headers?.content?.title || '';
      for (const e of entry.data?.events || []) {
        const mapped = mapEvent(e, entry.slug, leagueName);
        if (mapped && !seen.has(mapped.id)) {
          seen.add(mapped.id);
          events.push(mapped);
        }
      }
    }
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    cache = { ts: Date.now(), events };
    return events;
  } catch (err) {
    console.warn('Upcoming events fetch failed:', err);
    return cache?.events || [];
  }
}

/** Distinct YYYY-MM-DD dates present in the event list, sorted. */
export function getEventDates(events: UpcomingEvent[]): string[] {
  const set = new Set<string>();
  events.forEach((e) => {
    if (e.date) set.add(e.date.slice(0, 10));
  });
  return Array.from(set).sort();
}

/** Distinct sport slugs present, in SPORTS registry order. */
export function getEventSports(events: UpcomingEvent[]): string[] {
  const set = new Set<string>();
  events.forEach((e) => set.add(e.sport));
  return SPORTS.map((s) => s.slug).filter((s) => set.has(s));
}

/** Format an ISO datetime as a short local label, e.g. "Thu 7:30 PM" or "Tomorrow 1:00 PM". */
export function formatEventTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const isToday = d.toDateString() === today.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  if (isToday) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ` ${time}`;
}
