/**
 * Sports API Service — integrates DaddyLive, EmbedSportex, WeStream, SportSRC
 * All fetchers are wrapped in try/catch so a single provider failure
 * never breaks the whole stream aggregation pipeline.
 */

// ── Constants ──────────────────────────────────────────────────────────────
const DADDYLIVE_API = 'https://daddylive.app/api/events';
const EMBEDSPORTEX_API = 'https://api.esportex.site/api/streams';
const WESTREAM_BASE = 'https://westream.su';
const SPORTSRC_API = 'https://api.sportsrc.org/v3';

// ── Types ──────────────────────────────────────────────────────────────────
export interface SportsApiChannel {
  name: string;
  url: string;
}

export interface SportsApiEvent {
  time: string;
  event: string;
  source?: string;
  channels: SportsApiChannel[];
}

export interface EmbedSportexIframe {
  server: string;
  url: string;
}

export interface EmbedSportexEvent {
  slug: string;
  tag: string;
  kickoff: string;
  endTime: string;
  poster: string | null;
  iframes: EmbedSportexIframe[];
  league: string;
}

// ── DaddyLive ──────────────────────────────────────────────────────────────
export async function fetchDaddyLiveEvents(): Promise<SportsApiEvent[]> {
  const events: SportsApiEvent[] = [];
  try {
    const res = await fetch(DADDYLIVE_API, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) { console.warn(`DaddyLive API returned ${res.status}`); return events; }
    const data = await res.json();
    if (!data?.categories) return events;

    for (const [catName, catEvents] of Object.entries(data.categories)) {
      if (!Array.isArray(catEvents)) continue;
      for (const ev of catEvents as SportsApiEvent[]) {
        events.push({
          time: ev.time || 'Live',
          event: ev.event || catName,
          source: ev.source,
          channels: ev.channels || [],
        });
      }
    }
    console.log(`DaddyLive: ${events.length} events loaded`);
  } catch (e) {
    console.warn('DaddyLive fetch failed:', e);
  }
  return events;
}

// ── EmbedSportex ────────────────────────────────────────────────────────────
export async function fetchEmbedSportexEvents(): Promise<EmbedSportexEvent[]> {
  const events: EmbedSportexEvent[] = [];
  try {
    const res = await fetch(EMBEDSPORTEX_API, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) { console.warn(`EmbedSportex API returned ${res.status}`); return events; }
    const data = await res.json();
    if (!data || typeof data !== 'object') return events;

    for (const [sportName, sportEvents] of Object.entries(data)) {
      if (sportName === 'success' || sportName === 'timestamp' || sportName === 'READ_ME') continue;
      if (!Array.isArray(sportEvents)) continue;
      for (const ev of sportEvents as EmbedSportexEvent[]) {
        if (ev.iframes && ev.iframes.length > 0) {
          events.push(ev);
        }
      }
    }
    console.log(`EmbedSportex: ${events.length} events loaded`);
  } catch (e) {
    console.warn('EmbedSportex fetch failed:', e);
  }
  return events;
}

// ── WeStream (matches/all) ──────────────────────────────────────────────────
export async function fetchWeStreamEvents(): Promise<any[]> {
  const events: any[] = [];
  try {
    const res = await fetch(`${WESTREAM_BASE}/matches/all`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) { console.warn(`WeStream API returned ${res.status}`); return events; }
    const data = await res.json();
    if (Array.isArray(data)) {
      events.push(...data);
      console.log(`WeStream: ${events.length} events loaded`);
    }
  } catch (e) {
    console.warn('WeStream fetch failed:', e);
  }
  return events;
}

// ── SportSRC (requires API key — stub, returns empty on failure) ─────────────
export async function fetchSportSRCEvents(): Promise<any[]> {
  const events: any[] = [];
  const apiKey = process.env.SPORTSRC_API_KEY;
  if (!apiKey) {
    console.warn('SportSRC: no API key configured, skipping');
    return events;
  }
  try {
    const res = await fetch(`${SPORTSRC_API}/matches/live`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'X-API-KEY': apiKey },
    });
    if (!res.ok) { console.warn(`SportSRC API returned ${res.status}`); return events; }
    const data = await res.json();
    if (Array.isArray(data)) {
      events.push(...data);
      console.log(`SportSRC: ${events.length} events loaded`);
    }
  } catch (e) {
    console.warn('SportSRC fetch failed:', e);
  }
  return events;
}