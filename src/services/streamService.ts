import { StreamItem, StreamSource } from '../types/stream';
import { iptvService } from './iptvService';
import {
  fetchDaddyLiveEvents,
  fetchEmbedSportexEvents,
  fetchWeStreamEvents,
  fetchSportSRCEvents,
  SportsApiEvent,
  EmbedSportexEvent,
} from './sportsApiService';

const STREAMED_BASE = 'https://streamed.pk';
const WESTREAM_BASE = 'https://westream.su';
const BINTV_URL = 'https://bintvjson.lovable.app/api/public/bintvjson';
const BINTV_SOURCES_BASE = 'https://bintv-sources.pages.dev';

// In-memory cache
let cachedStreams: StreamItem[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Screenshot thumbnail cache (localStorage, 1 hour TTL) ────────────────────
const SCREENSHOT_CACHE_KEY = 'rdnutz_screenshot_thumbs';
const SCREENSHOT_TTL_MS = 60 * 60 * 1000; // 1 hour

interface ScreenshotCacheEntry {
  url: string;
  ts: number;
}

function getScreenshotCache(): Record<string, ScreenshotCacheEntry> {
  try {
    const raw = localStorage.getItem(SCREENSHOT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setScreenshotCache(entries: Record<string, ScreenshotCacheEntry>) {
  try {
    localStorage.setItem(SCREENSHOT_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // quota exceeded — ignore
  }
}

function getCachedScreenshot(embedUrl: string): string {
  if (!embedUrl || embedUrl.includes('/api/bintv-proxy') || !embedUrl.startsWith('http')) return '';
  const cache = getScreenshotCache();
  const entry = cache[embedUrl];
  if (entry && Date.now() - entry.ts < SCREENSHOT_TTL_MS) {
    return entry.url;
  }
  // Expired or missing — generate fresh and cache it
  const url = `https://image.thum.io/get/maxage/7200/width/400/fail/${encodeURIComponent(embedUrl)}`;
  cache[embedUrl] = { url, ts: Date.now() };
  setScreenshotCache(cache);
  return url;
}

/** Purge expired screenshot cache entries (call periodically) */
export function purgeExpiredScreenshots() {
  const cache = getScreenshotCache();
  let changed = false;
  for (const [key, entry] of Object.entries(cache)) {
    if (Date.now() - entry.ts >= SCREENSHOT_TTL_MS) {
      delete cache[key];
      changed = true;
    }
  }
  if (changed) setScreenshotCache(cache);
}

export const CATEGORIES = [
  'All',
  'Live Sports',
  '24/7 Channels',
  'IPTV Live',
  'Basketball',
  'Football / Soccer',
  'Baseball',
  'Motorsport / F1',
  'Tennis',
  'Golf',
  'Combat / MMA',
  'Cricket',
  'Ice Hockey',
  'Entertainment & Movies',
  'News & Documentaries',
] as const;

export type CategoryName = typeof CATEGORIES[number];

// ── Fallback Players ──────────────────────────────────────────────────────────

export const FALLBACK_PLAYERS = {
  /** Primary fallback for movie/content embeds */
  VIDFAST: 'https://vidfast.vc/',
  /** Secondary fallback for movies and TV shows */
  MOVIESAPI: 'https://moviesapi.to/#discover',
} as const;

/**
 * Generate fallback URLs for a stream when primary sources fail.
 * Returns ordered list of alternate embed URLs to try.
 */
export function getFallbackUrls(stream: StreamItem): string[] {
  const url = stream.directEmbedUrl || '';
  const results: string[] = [];

  // vidfast.vc - accept many embed formats
  if (url && !url.includes('vidfast')) {
    // Try direct ID extraction or use the URL as-is
    const idMatch = url.match(/id=([^&]+)/) || url.match(/\/embed\/([a-zA-Z0-9_-]+)/);
    const vidfastId = idMatch ? idMatch[1] : encodeURIComponent(url);
    results.push(`${FALLBACK_PLAYERS.VIDFAST}${vidfastId}`);
  }

  // moviesapi.to - for movie/TV content
  if (stream.provider === 'anime' && (stream.category === 'Movies' || stream.category === 'TV Shows')) {
    results.push(FALLBACK_PLAYERS.MOVIESAPI);
  }

  return results;
}

// Browser-safe base64url encoding (no Buffer dependency)
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

// Route bintv-sources URLs through the Vite proxy to bypass Cloudflare bot protection
export function routeBintvUrl(url: string): string {
  if (!url) return '';
  if (url.includes('bintv-sources.pages.dev') || url.includes('eihgembxe.cfd')) {
    return `/api/bintv-proxy?id=${base64UrlEncode(url)}`;
  }
  return url;
}

// Helper to normalize poster URL
function normalizePoster(rawUrl?: string): string {
  if (!rawUrl) {
    return '';
  }
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  if (rawUrl.startsWith('/api/')) {
    return `${STREAMED_BASE}${rawUrl}`;
  }
  return rawUrl;
}

/**
 * Generate a screenshot URL for a stream when no poster exists.
 * Uses image.thum.io to capture a live screenshot of the stream page.
 * Results are cached in localStorage with a 1-hour TTL.
 * Returns empty string if URL cannot be screenshotted.
 */
function getScreenshotUrl(embedUrl: string | undefined): string {
  if (!embedUrl) return '';
  return getCachedScreenshot(embedUrl);
}

// Fallback curated streams in case external APIs are temporarily unreachable
const FALLBACK_STREAMS: StreamItem[] = [
  {
    id: 'ppv-sky-sports-golf',
    title: 'Sky Sports Golf HD - Championship Live',
    name: 'Sky Sports Golf',
    category: 'Golf',
    status: 'live',
    popular: true,
    provider: 'streamed',
    poster: '/src/assets/images/hero_championship_live_1792048678438.jpg',
    directEmbedUrl: 'https://embed.st/embed/admin/ppv-sky-sports-golf/1',
    sources: [{ source: 'admin', id: 'ppv-sky-sports-golf' }],
    streams: [
      {
        streamNo: 1,
        language: 'English - 1080p',
        hd: true,
        embedUrl: 'https://embed.st/embed/admin/ppv-sky-sports-golf/1',
        viewers: 1420,
      },
      {
        streamNo: 2,
        language: 'English - 720p',
        hd: false,
        embedUrl: 'https://embed.st/embed/admin/ppv-sky-sports-golf/2',
        viewers: 380,
      },
    ],
    viewers: 1800,
  },
  {
    id: 'channel-espn',
    title: 'ESPN HD 24/7 Live Broadcast',
    name: 'ESPN HD',
    category: '24/7 Channels',
    status: '24/7',
    popular: true,
    provider: 'bintv',
    poster: 'https://cdn.abcotvs.com/dip/images/11479454_011822-cc-abc-generic-thumb-img.jpg',
    directEmbedUrl: routeBintvUrl('https://bintv-sources.pages.dev/?id=aHR0cHM6Ly9laGdlbWJ4ZS5jZmQvYmludHYvc3BkOGdwb2gtNjU4Ng'),
    streams: [
      {
        name: 'ESPN Feed 1',
        embedUrl: routeBintvUrl('https://bintv-sources.pages.dev/?id=aHR0cHM6Ly9laGdlbWJ4ZS5jZmQvYmludHYvc3BkOGdwb2gtNjU4Ng'),
      },
    ],
    viewers: 8900,
  },
  {
    id: 'channel-abc',
    title: 'ABC Network Prime 24/7',
    name: 'ABC Network',
    category: '24/7 Channels',
    status: '24/7',
    popular: true,
    provider: 'bintv',
    poster: 'https://cdn.abcotvs.com/dip/images/11479454_011822-cc-abc-generic-thumb-img.jpg',
    directEmbedUrl: routeBintvUrl('https://bintv-sources.pages.dev/?id=aHR0cHM6Ly9laGdlbWJ4ZS5jZmQvYmludHYvbmhtemt6ZXotMzAyOA'),
    streams: [
      {
        name: 'ABC Feed',
        embedUrl: routeBintvUrl('https://bintv-sources.pages.dev/?id=aHR0cHM6Ly9laGdlbWJ4ZS5jZmQvYmludHYvbmhtemt6ZXotMzAyOA'),
      },
    ],
    viewers: 5200,
  },
];


// ── Cinevid Stream Integration ───────────────────────────────────────────────
// Cinevid (cinevid.st) — sports streaming API with CORS support.
// Flow: events API → main-server API → ltv endpoint → M3U8 playlist

const CINEVID_API = 'https://cinevid.st/api/public/events';
const CINEVID_CDN = 'https://vidcdn.vip';
const CINEVID_PLAYER = 'https://cinevid.st/embed/live';

interface CinevidEvent {
  id: string;
  slug: string;
  title: string;
  sport: string;
  league: string;
  date: string;
  time: string;
  status: string;
  score?: string | null;
  playerUrl: string;
  homeTeamImage?: string;
  awayTeamImage?: string;
  thumbnail?: string;
}

interface CinevidChannel {
  id: string;
  name: string;
  speed: string;
  language: string;
  flag?: string;
  Main: string;
  live: boolean;
}

async function fetchCinevidStreams(
  aggregated: StreamItem[],
  stableId: (prefix: string, name: string, fallback?: string) => string,
): Promise<void> {
  try {
    const res = await fetch(CINEVID_API, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) { console.warn(`Cinevid API returned ${res.status}`); return; }
    const data = await res.json();
    if (!Array.isArray(data?.events)) return;

    for (const event of data.events as CinevidEvent[]) {
      if (event.status === 'Ended' || event.status === 'ended') continue;
      const status: 'live' | 'upcoming' = event.status === 'Live' ? 'live' : 'upcoming';
      const category = mapCategory(event.league || event.sport || 'Sports');
      const embedUrl = `${CINEVID_PLAYER}/${event.id}`;

      // Store resolved channels on the stream object for lazy loading
      const stream: StreamItem = {
        id: stableId('cinevid', event.title || event.slug, event.id),
        title: event.title || event.league || 'Cinevid Stream',
        name: event.title,
        category, status,
        poster: event.thumbnail || '',
        provider: 'cinevid', streamType: 'embed', popular: status === 'live',
        directEmbedUrl: embedUrl, bgVideoUrl: embedUrl,
        viewers: status === 'live' ? Math.floor(Math.random() * 5000) + 500 : 0,
        // Attach raw channel data for lazy resolution (not displayed directly)
        _cinevidData: { eventId: event.id, eventTitle: event.title, eventSlug: event.slug },
      };
      aggregated.push(stream);
    }
  } catch (e) {
    console.warn('Cinevid fetch failed:', e);
  }
}

// ── DaddyLive → StreamItem ─────────────────────────────────────────────────
async function fetchDaddyLiveIntegration(
  aggregated: StreamItem[],
  stableId: (prefix: string, name: string, fallback?: string) => string,
): Promise<void> {
  try {
    const events = await fetchDaddyLiveEvents();
    for (const ev of events) {
      const matchName = ev.event || ev.source || 'Sports';
      const category = mapCategory(matchName.split(/[:\s]+/).slice(-2).join(' ') || matchName);
      const firstUrl = ev.channels?.[0]?.url || '';
      if (!firstUrl) continue;
      aggregated.push({
        id: stableId('daddylive', ev.event || ev.source || 'event', ev.event || ev.source || 'event'),
        title: ev.event || 'Live Sports',
        name: ev.event,
        category,
        status: ev.time === 'Live' ? 'live' : 'upcoming',
        provider: 'daddylive',
        streamType: 'embed',
        popular: ev.time === 'Live',
        directEmbedUrl: firstUrl,
        bgVideoUrl: firstUrl,
        viewers: ev.time === 'Live' ? Math.floor(Math.random() * 8000) + 500 : 0,
        streams: (ev.channels || []).map((ch, idx) => ({
          streamNo: idx + 1,
          name: ch.name || `Stream ${idx + 1}`,
          embedUrl: ch.url,
        })),
      });
    }
  } catch (e) {
    console.warn('DaddyLive integration failed:', e);
  }
}

// ── EmbedSportex → StreamItem ──────────────────────────────────────────────
async function fetchEmbedSportexIntegration(
  aggregated: StreamItem[],
  stableId: (prefix: string, name: string, fallback?: string) => string,
): Promise<void> {
  try {
    const events = await fetchEmbedSportexEvents();
    for (const ev of events) {
      const tag = ev.tag || ev.league || 'Sports';
      const category = mapCategory(tag);
      const firstUrl = ev.iframes?.[0]?.url || '';
      aggregated.push({
        id: stableId('embsportex', ev.tag || ev.slug, ev.slug),
        title: ev.tag || tag,
        name: ev.tag,
        category,
        status: 'live', // events with iframes are considered live
        poster: ev.poster || '',
        provider: 'embsportex',
        streamType: 'embed',
        popular: true,
        directEmbedUrl: firstUrl,
        bgVideoUrl: firstUrl,
        viewers: Math.floor(Math.random() * 6000) + 300,
        streams: (ev.iframes || []).map((fr, idx) => ({
          streamNo: idx + 1,
          name: fr.server || `Stream ${idx + 1}`,
          embedUrl: fr.url,
        })),
      });
    }
  } catch (e) {
    console.warn('EmbedSportex integration failed:', e);
  }
}

// ── WeStream → StreamItem ──────────────────────────────────────────────────
async function fetchWeStreamIntegration(
  aggregated: StreamItem[],
  stableId: (prefix: string, name: string, fallback?: string) => string,
): Promise<void> {
  try {
    const matches = await fetchWeStreamEvents();
    for (const m of matches) {
      const firstSource = m.sources?.[0];
      const defaultEmbed = firstSource
        ? `${WESTREAM_BASE}/embed/${firstSource.source}/${firstSource.id}/1`
        : undefined;
      if (!defaultEmbed) continue;
      aggregated.push({
        id: m.id || stableId('westream', m.title || ''),
        title: m.title || 'Live Match',
        name: m.title,
        category: mapCategory(m.category || 'Sports'),
        status: m.popular ? 'live' : 'upcoming',
        poster: m.poster || '',
        provider: 'westream',
        sources: m.sources || [],
        directEmbedUrl: defaultEmbed,
        bgVideoUrl: defaultEmbed,
        viewers: Math.floor(Math.random() * 4000) + 800,
      });
    }
  } catch (e) {
    console.warn('WeStream integration failed:', e);
  }
}

// ── SportSRC → StreamItem (requires API key) ───────────────────────────────
async function fetchSportSRCIntegration(
  aggregated: StreamItem[],
  stableId: (prefix: string, name: string, fallback?: string) => string,
): Promise<void> {
  try {
    const matches = await fetchSportSRCEvents();
    for (const m of matches) {
      aggregated.push({
        id: stableId('sportsrc', m.home_team?.name || m.away_team?.name || m.competition?.name || '', m.match_id),
        title: m.tag || `${m.home_team?.name} vs ${m.away_team?.name}` || 'Live Match',
        name: m.tag || '',
        category: mapCategory(m.competition?.name || 'Sports'),
        status: m.is_live || m.status === 'inprogress' ? 'live' : 'upcoming',
        poster: m.cover?.thumb || m.cover?.banner || '',
        provider: 'sportsrc',
        popular: m.is_live ?? false,
        viewers: m.is_live ? Math.floor(Math.random() * 10000) + 500 : 0,
      });
    }
  } catch (e) {
    console.warn('SportSRC integration failed:', e);
  }
}

export const streamService = {
  async fetchAllStreams(forceRefresh = false): Promise<StreamItem[]> {
    const now = Date.now();
    if (!forceRefresh && cachedStreams.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
      return cachedStreams;
    }

    const aggregated: StreamItem[] = [];

    // Helper: generate a stable ID from stream metadata (no Math.random)
    const stableId = (prefix: string, name: string, fallback?: string) => {
      const slug = name
        ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : fallback || `fallback-${Math.floor(Math.random() * 99999)}`;
      return `${prefix}-${slug}`;
    };

    // 1. Fetch from bintvjson (Live Events, Upcoming Events, 24/7 Channels)
    try {
      const res = await fetch(BINTV_URL, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const data = await res.json();
        // Live Events
        if (Array.isArray(data['Live Events'])) {
          data['Live Events'].forEach((item: any) => {
            const firstStream = item.streams?.[0];
            const rawUrl = firstStream?.url || '';
            const embedUrl = routeBintvUrl(rawUrl);
            aggregated.push({
              id: item.id || stableId('bintv-live', item.name),
              title: item.name || 'Live Match',
              name: item.name,
              category: mapCategory(item.category || 'Live Sports'),
              status: 'live',
              poster: normalizePoster(item.poster) || getScreenshotUrl(rawUrl),
              provider: 'bintv',
              popular: true,
              streams: item.streams?.map((s: any, idx: number) => ({
                streamNo: idx + 1,
                name: s.name || `Stream ${idx + 1}`,
                embedUrl: routeBintvUrl(s.url),
                hd: true,
              })),
              directEmbedUrl: embedUrl,
              bgVideoUrl: rawUrl,
              viewers: Math.floor(Math.random() * 4000) + 1200,
            });
          });
        }

        // Upcoming Events
        if (Array.isArray(data['Upcoming Events'])) {
          data['Upcoming Events'].forEach((item: any) => {
            const firstStream = item.streams?.[0];
            const rawUrl = firstStream?.url || '';
            const embedUrl = routeBintvUrl(rawUrl);
            aggregated.push({
              id: item.id || stableId('bintv-up', item.name),
              title: item.name || 'Upcoming Match',
              name: item.name,
              category: mapCategory(item.category || 'Live Sports'),
              status: 'upcoming',
              poster: normalizePoster(item.poster) || getScreenshotUrl(rawUrl),
              provider: 'bintv',
              popular: false,
              streams: item.streams?.map((s: any, idx: number) => ({
                streamNo: idx + 1,
                name: s.name || `Stream ${idx + 1}`,
                embedUrl: routeBintvUrl(s.url),
              })),
              directEmbedUrl: embedUrl,
              bgVideoUrl: rawUrl,
              viewers: Math.floor(Math.random() * 1000) + 200,
            });
          });
        }

        // 24/7 Channels
        if (Array.isArray(data['24/7 Channels'])) {
          data['24/7 Channels'].forEach((ch: any) => {
            const firstStream = ch.streams?.[0];
            const rawUrl = firstStream?.url || '';
            const embedUrl = routeBintvUrl(rawUrl);
            const channelCategory = categorizeChannel(ch.name || '');
            aggregated.push({
              id: ch.id || `bintv-ch-${ch.name?.replace(/\s+/g, '-').toLowerCase()}`,
              title: `${ch.name} Live`,
              name: ch.name,
              category: channelCategory,
              status: '24/7',
              poster: normalizePoster(ch.poster) || getScreenshotUrl(rawUrl),
              provider: 'bintv',
              popular: isPopularChannel(ch.name),
              streams: ch.streams?.map((s: any, idx: number) => ({
                streamNo: idx + 1,
                name: s.name || `${ch.name} Stream`,
                embedUrl: routeBintvUrl(s.url),
                hd: true,
              })),
              directEmbedUrl: embedUrl,
              bgVideoUrl: rawUrl,
              viewers: Math.floor(Math.random() * 8000) + 1500,
            });
          });
        }
      }
    } catch (e) {
      console.warn('bintvjson fetch failed, using fallback or streamed.pk', e);
    }

    // 2. Fetch from Cinevid (sports events with HLS resolution)
    await fetchCinevidStreams(aggregated, stableId);

    // 3. Fetch from DaddyLive (sports embed events)
    await fetchDaddyLiveIntegration(aggregated, stableId);

    // 4. Fetch from EmbedSportex (sports iframe events)
    await fetchEmbedSportexIntegration(aggregated, stableId);

    // 5. Fetch from WeStream (matches with sources)
    await fetchWeStreamIntegration(aggregated, stableId);

    // 6. Fetch from SportSRC (requires API key)
    await fetchSportSRCIntegration(aggregated, stableId);

    // 3. Fetch from streamed.pk (matches/all)
    try {
      const res = await fetch(`${STREAMED_BASE}/api/matches/all`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const matches = await res.json();
        if (Array.isArray(matches)) {
          matches.forEach((m: any) => {
            // streamed.pk item structure:
            // { id, title, category, date, poster, popular, sources: [{source, id}] }
            const cat = mapCategory(m.category);
            const firstSource = m.sources?.[0];
            // By standard convention: https://embed.st/embed/{source}/{id}/1
            const defaultEmbed = firstSource
              ? `https://embed.st/embed/${firstSource.source}/${firstSource.id}/1`
              : undefined;

            aggregated.push({
              id: m.id || stableId('streamed', m.title || ''),
              title: m.title || 'Live Match',
              name: m.title,
              category: cat,
              status: 'live',
              date: m.date,
              poster: normalizePoster(m.poster) || getScreenshotUrl(defaultEmbed),
              popular: m.popular ?? true,
              provider: 'streamed',
              sources: m.sources || [],
              directEmbedUrl: defaultEmbed,
              bgVideoUrl: defaultEmbed,
              viewers: Math.floor(Math.random() * 5000) + 850,
            });
          });
        }
      }
    } catch (e) {
      console.warn('streamed.pk fetch failed', e);
    }

    // 3. Fetch from westream.su (matches/all)
    try {
      const res = await fetch(`${WESTREAM_BASE}/matches/all`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const matches = await res.json();
        if (Array.isArray(matches)) {
          matches.forEach((m: any) => {
            const cat = mapCategory(m.category);
            const firstSource = m.sources?.[0];
            const defaultEmbed = firstSource
              ? `https://westream.su/embed/${firstSource.source}/${firstSource.id}/1`
              : undefined;

            aggregated.push({
              id: m.id || stableId('westream', m.title || ''),
              title: m.title || 'Live Match',
              name: m.title,
              category: cat,
              status: m.popular ? 'live' : 'upcoming',
              date: m.date,
              poster: normalizePoster(m.poster) || getScreenshotUrl(defaultEmbed),
              popular: m.popular ?? true,
              provider: 'westream',
              sources: m.sources || [],
              directEmbedUrl: defaultEmbed,
              bgVideoUrl: defaultEmbed,
              viewers: Math.floor(Math.random() * 5000) + 850,
            });
          });
        }
      }
    } catch (e) {
      console.warn('westream.su fetch failed', e);
    }

    if (aggregated.length === 0) {
      cachedStreams = FALLBACK_STREAMS;
    } else {
      cachedStreams = aggregated;
      lastFetchTime = Date.now();
    }

    return cachedStreams;
  },

  // ── Lazy IPTV fetch — called only when user navigates to IPTV page ──────────
  async fetchIptvStreams(): Promise<StreamItem[]> {
    return iptvService.fetchAllIptvChannels();
  },

  // Resolve active sources for a stream (queries /api/stream/{source}/{id} if streamed.pk)
  async resolveStreamSources(stream: StreamItem): Promise<StreamSource[]> {
    if (stream.streams && stream.streams.length > 0) {
      return stream.streams;
    }

    if ((stream.provider === 'streamed' || stream.provider === 'westream') && stream.sources && stream.sources.length > 0) {
      const first = stream.sources[0];
      const base = stream.provider === 'westream' ? WESTREAM_BASE : STREAMED_BASE;
      const embedHost = stream.provider === 'westream' ? 'westream.su/embed' : 'embed.st/embed';
      try {
        const res = await fetch(`${base}/api/stream/${first.source}/${first.id}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const mapped: StreamSource[] = list.map((s: any, idx: number) => ({
              id: s.id,
              source: s.source,
              streamNo: s.streamNo || idx + 1,
              language: s.language || 'English',
              hd: s.hd ?? true,
              embedUrl: s.embedUrl || `https://${embedHost}/${first.source}/${first.id}/${idx + 1}`,
              viewers: s.viewers || 100,
            }));
            stream.streams = mapped;
            if (!stream.directEmbedUrl && mapped[0]?.embedUrl) {
              stream.directEmbedUrl = mapped[0].embedUrl;
            }
            return mapped;
          }
        }
      } catch (e) {
        console.warn(`Error resolving stream sources from ${stream.provider}`, e);
      }
    }

    // Cinevid: lazy-resolve channel list from main-server API
    if (stream.provider === 'cinevid' && !stream.streams && stream._cinevidData) {
      try {
        const serverRes = await fetch(
          `${CINEVID_CDN}/api/main-server?id=${stream._cinevidData.eventId}`,
          { signal: AbortSignal.timeout(6000), headers: { 'Referer': 'https://cinevid.st/' } },
        );
        if (serverRes.ok) {
          const serverData = await serverRes.json() as { channels: CinevidChannel[] };
          const channels = serverData?.channels || [];
          if (channels.length > 0) {
            const mapped: StreamSource[] = channels
              .filter(c => c.Main)
              .map((channel, idx) => {
                const ltvMatch = channel.Main.match(/id=([^\s&]+)/);
                const ltvId = ltvMatch ? ltvMatch[1] : channel.Main;
                const hlsUrl = `${CINEVID_CDN}/ltv?id=${encodeURIComponent(ltvId)}`;
                return {
                  streamNo: idx + 1,
                  name: channel.name,
                  language: channel.language || 'English',
                  hd: channel.speed === 'HD',
                  embedUrl: hlsUrl,
                };
              });
            if (mapped.length > 0) {
              stream.streams = mapped;
              stream.directEmbedUrl = mapped[0].embedUrl;
              stream.bgVideoUrl = mapped[0].embedUrl;
              stream.streamType = 'hls';
              return mapped;
            }
          }
        }
      } catch (e) {
        console.warn('Cinevid channel resolution failed:', e);
      }
      // Fall back to embed URL
      stream.streams = [{
        streamNo: 1,
        name: stream.title || 'Main Feed',
        language: 'English',
        hd: true,
        embedUrl: stream.directEmbedUrl || '',
      }];
      return stream.streams;
    }

    // Default fallback source
    const fallbackUrl =
      stream.directEmbedUrl ||
      (stream.sources?.[0]
        ? stream.provider === 'westream'
          ? `https://westream.su/embed/${stream.sources[0].source}/${stream.sources[0].id}/1`
          : `https://embed.st/embed/${stream.sources[0].source}/${stream.sources[0].id}/1`
        : 'https://bintv-sources.pages.dev/?id=aHR0cHM6Ly9laGdlbWJ4ZS5jZmQvYmludHYvc3BkOGdwb2gtNjU4Ng');

    return [
      {
        streamNo: 1,
        name: `${stream.title} - Main Feed`,
        language: 'English',
        hd: true,
        embedUrl: fallbackUrl,
      },
    ];
  },
};

// Map raw API category to standard UI category
function mapCategory(raw: string = ''): string {
  const lower = raw.toLowerCase();
  if (lower.includes('basket') || lower.includes('nba')) return 'Basketball';
  if (lower.includes('foot') || lower.includes('soccer') || lower.includes('epl') || lower.includes('liga'))
    return 'Football / Soccer';
  if (lower.includes('base') || lower.includes('mlb')) return 'Baseball';
  if (lower.includes('f1') || lower.includes('motor') || lower.includes('nascar') || lower.includes('racing'))
    return 'Motorsport / F1';
  if (lower.includes('tenn')) return 'Tennis';
  if (lower.includes('golf')) return 'Golf';
  if (lower.includes('comb') || lower.includes('mma') || lower.includes('ufc') || lower.includes('box'))
    return 'Combat / MMA';
  if (lower.includes('crick')) return 'Cricket';
  if (lower.includes('hock') || lower.includes('nhl')) return 'Ice Hockey';
  if (lower.includes('24/7') || lower.includes('channel')) return '24/7 Channels';
  return 'Live Sports';
}

// Categorize 24/7 TV channels into clean genres
function categorizeChannel(name: string): string {
  const lower = name.toLowerCase();
  if (
    lower.includes('sport') ||
    lower.includes('espn') ||
    lower.includes('bein') ||
    lower.includes('arena') ||
    lower.includes('tennis') ||
    lower.includes('golf') ||
    lower.includes('nfl') ||
    lower.includes('nba') ||
    lower.includes('mlb') ||
    lower.includes('fight') ||
    lower.includes('wwe') ||
    lower.includes('racing') ||
    lower.includes('super')
  ) {
    return 'Live Sports';
  }
  if (
    lower.includes('movie') ||
    lower.includes('hbo') ||
    lower.includes('cinema') ||
    lower.includes('film') ||
    lower.includes('amc') ||
    lower.includes('comedy') ||
    lower.includes('tnt') ||
    lower.includes('tbs') ||
    lower.includes('fx') ||
    lower.includes('starz') ||
    lower.includes('showtime')
  ) {
    return 'Entertainment & Movies';
  }
  if (
    lower.includes('news') ||
    lower.includes('cnn') ||
    lower.includes('bbc') ||
    lower.includes('cbs') ||
    lower.includes('abc') ||
    lower.includes('nbc') ||
    lower.includes('fox') ||
    lower.includes('msnbc') ||
    lower.includes('discovery') ||
    lower.includes('nat geo') ||
    lower.includes('history') ||
    lower.includes('weather')
  ) {
    return 'News & Documentaries';
  }
  return '24/7 Channels';
}

function isPopularChannel(name: string): boolean {
  const popularKeywords = ['espn', 'hbo', 'abc', 'bbc', 'sky', 'bein', 'tnt', 'amc', 'cbs', 'nbc', 'fox'];
  const lower = name.toLowerCase();
  return popularKeywords.some((k) => lower.includes(k));
}
