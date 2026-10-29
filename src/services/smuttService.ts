import { StreamItem } from '../types/stream';
import { resolveSmuttThumbnail, CATEGORY_EMOJI } from './smuttThumbnailService';

export const SMUTT_M3U_URL = import.meta.env.VITE_SMUTT_M3U_URL || '/api/iptv/local/Nett_Smutt_4.0.m3u';

/**
 * Adult playlists from the local `M3U SRC` directory. The first entry can be
 * overridden with `VITE_SMUTT_M3U_URL`; the rest are always read from disk.
 */
export const SMUTT_M3U_URLS: string[] = [
  SMUTT_M3U_URL,
  '/api/iptv/local/Nett_Smutt_2.0.m3u',
  '/api/iptv/local/Robbdeeze_Nett_Smutt.m3u',
];

export const getGroupIcons = () => CATEGORY_EMOJI;

// URL transformation helpers for adult embed providers
export function tryTransformToEpornerEmbed(rawUrl: string): string | null {
  // Match eporner.com/video/ID/slug pattern
  const epornerMatch = rawUrl.match(/eporner\.com\/video\/(\d+)\/([^/]+)/);
  if (epornerMatch) {
    const slug = epornerMatch[2].replace(/-/g, ' ').replace(/[^\w\s]/g, '');
    return `https://www.eporner.com/embed/${slug}/`;
  }
  // Match /video/ID/slug path directly
  const pathMatch = rawUrl.match(/\/video\/(\d+)\/([^/?]+)/);
  if (pathMatch) {
    const slug = pathMatch[2].replace(/-/g, ' ').replace(/[^\w\s]/g, '');
    return `https://www.eporner.com/embed/${slug}/`;
  }
  return null;
}

export function tryTransformToAdultembed(rawUrl: string): string | null {
  // Try adultembed.com/api/ pattern
  const adultMatch = rawUrl.match(/adultembed\.com\/api\/([a-zA-Z0-9_-]+)/);
  if (adultMatch) {
    return `https://adultembed.com/api/${adultMatch[1]}`;
  }
  return null;
}

export function transformStreamUrl(rawUrl: string): string {
  // Try eporner embed first
  const epornerUrl = tryTransformToEpornerEmbed(rawUrl);
  if (epornerUrl) return epornerUrl;

  // Try adultembed
  const adultUrl = tryTransformToAdultembed(rawUrl);
  if (adultUrl) return adultUrl;

  // Return original URL (direct MP4/HLS streams)
  return rawUrl;
}

// In-memory cache
let cachedStreams: StreamItem[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes for smutt (less frequent changes)

export const GROUP_ICONS: Record<string, string> = {
  'Worldstar Hip Hop': '🎤',
  'LiveGore': '🔴',
  'Vidmax': '📹',
  'ZFilmzOriginals': '🎬',
  'HorribleVideos': '⚠️',
  'Crazyshit': '🤪',
  'Kaotic': '🎥',
  'DaftPorn': '💋',
  'TheYNC': '💀',
  'USACrime': '🗞️',
  'HeavyFetish': '⛓️',
  'Xrares': '🎞️',
};

// Groups to exclude from the directory
const EXCLUDED_GROUPS = new Set(['Dailymotion', 'eFukt', 'HeavyFetish', 'Inhumanity', 'NothingToxic', 'Xrares']);

export function parseSmuttM3U(text: string): StreamItem[] {
  const lines = text.split('\n');
  const items: StreamItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXTINF')) continue;

    // Parse metadata
    const logoMatch = line.match(/tvg-logo="([^"]*)"/);
    const groupMatch = line.match(/group-title="([^"]*)"/);
    const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);

    const logo = logoMatch ? logoMatch[1] : undefined;
    const rawGroup = groupMatch ? groupMatch[1] : 'Adult';
    // Extract title from after the last comma
    const rawName = line.split(',').slice(1).join(',').trim();
    // Clean up the title
    const cleanTitle = rawName
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/[`']/g, "'")
      .trim();

    // Look ahead for stream URL
    let streamUrl = '';
    for (let j = i + 1; j < lines.length; j++) {
      const candidate = lines[j].trim();
      if (candidate && !candidate.startsWith('#')) {
        streamUrl = candidate;
        i = j;
        break;
      }
    }

    if (!streamUrl) continue;

    // Transform URL through embed providers
    const transformedUrl = transformStreamUrl(streamUrl);
    const isHls =
      streamUrl.includes('.m3u8') ||
      streamUrl.includes('.ts') ||
      transformedUrl.includes('eporner.com/embed') ||
      transformedUrl.includes('adultembed.com');
    const isEmbedUrl =
      transformedUrl.includes('eporner.com/embed') ||
      transformedUrl.includes('adultembed.com') ||
      streamUrl.includes('pages.dev') ||
      streamUrl.includes('embed.st') ||
      streamUrl.includes('/embed/');
    // Direct video URLs (mp4, etc.) should use native <video>, not iframe
    const isDirectVideo = !isHls && !isEmbedUrl;

    // Resolve poster/thumbnail
    const thumbUrl = resolveSmuttThumbnail(streamUrl, rawGroup);
    const emoji = CATEGORY_EMOJI[rawGroup] || '🎬';

    items.push({
      id: `smutt-${rawGroup.toLowerCase()}-${items.length}-${Math.random().toString(36).substr(2, 4)}`,
      title: cleanTitle,
      name: cleanTitle,
      category: rawGroup,
      groupTitle: rawGroup,
      status: 'live',
      popular: false,
      provider: 'smutt',
      streamType: isHls ? 'hls' : 'embed',
      m3uSource: 'Nett_Smutt',
      poster: thumbUrl || undefined,
      directEmbedUrl: transformedUrl,
      smuttEmoji: emoji,

      streams: [
        {
          streamNo: 1,
          name: `${cleanTitle} (${rawGroup})`,
          embedUrl: transformedUrl,
          hd: transformedUrl.includes('eporner') || transformedUrl.includes('adultembed'),
        },
      ],
      viewers: Math.floor(Math.random() * 3000) + 500,
    });
  }

  return items;
}

export const smuttService = {
  async fetchAllSmuttStreams(forceRefresh = false): Promise<StreamItem[]> {
    const now = Date.now();
    if (!forceRefresh && cachedStreams.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
      return cachedStreams;
    }

    // Load every adult playlist from the local M3U SRC directory. The files
    // overlap, so entries are deduped by their stream URL.
    const results = await Promise.allSettled(
      SMUTT_M3U_URLS.map(async (url) => {
        const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
        const text = await res.text();
        return parseSmuttM3U(text).filter((s) => !EXCLUDED_GROUPS.has(s.groupTitle || ''));
      }),
    );

    const merged: StreamItem[] = [];
    const seen = new Set<string>();

    results.forEach((r) => {
      if (r.status !== 'fulfilled') return;
      for (const item of r.value) {
        const key = item.directEmbedUrl || item.id;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
      }
    });

    if (merged.length > 0) {
      cachedStreams = merged;
      lastFetchTime = Date.now();
    } else {
      console.warn('Smutt M3U fetch failed');
    }

    return cachedStreams;
  },

  getGroupIcons(): Record<string, string> {
    return GROUP_ICONS;
  },
};
