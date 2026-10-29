import { StreamItem } from '../types/stream';
import { parseGroupTitle, COUNTRY_ORDER, COUNTRY_LABELS, GENRE_OPTIONS } from '../services/iptvMetadata';

export interface IptvPlaylistSource {
  id: string;
  name: string;
  /** Remote copy — used when the local M3U SRC file is unavailable. */
  url: string;
  /** Local file from the `M3U SRC` directory, served by the Vite dev server. */
  proxyUrl: string;
  description: string;
  /** Category grouping used by the playlist picker in the IPTV directory. */
  group: string;
}

interface PlaylistDef {
  id: string;
  name: string;
  file: string;
  group: string;
  description: string;
}

/**
 * Every `.m3u` file that lives in the local `M3U SRC` directory.
 *
 * The files are served straight off disk by the `local-m3u-src` Vite plugin
 * (`/api/iptv/local/<file>`); if a file is missing the service transparently
 * falls back to the matching copy on https://iptv.rdnutz.us.
 *
 * Adult playlists are intentionally *not* listed here — they are served by
 * `smuttService` into the dedicated Smutt directory instead.
 */
const PLAYLIST_DEFS: PlaylistDef[] = [
  // ── FAST / free-to-air ────────────────────────────────────────────────────
  {
    id: 'fast-combined',
    name: 'FAST Combined',
    file: 'fast_combined.m3u',
    group: 'FAST Channels',
    description: 'Samsung TV Plus, Tubi, Xumo & Stirr combined (653 channels)',
  },
  {
    id: 'samsung-tv-plus',
    name: 'Samsung TV Plus',
    file: 'samsung_tv_plus.m3u',
    group: 'FAST Channels',
    description: 'Samsung TV Plus FAST channels (300 channels)',
  },
  {
    id: 'pluto-tv',
    name: 'Pluto TV',
    file: 'pluto_tv.m3u',
    group: 'FAST Channels',
    description: 'Pluto TV live channels (300 channels)',
  },
  {
    id: 'tubi',
    name: 'Tubi',
    file: 'tubi.m3u',
    group: 'FAST Channels',
    description: 'Tubi live channels (157 channels)',
  },
  {
    id: 'xumo',
    name: 'Xumo',
    file: 'xumo.m3u',
    group: 'FAST Channels',
    description: 'Xumo live channels (107 channels)',
  },
  {
    id: 'stirr',
    name: 'Stirr',
    file: 'stirr.m3u',
    group: 'FAST Channels',
    description: 'Stirr live channels (89 channels)',
  },

  // ── Live broadcast TV ─────────────────────────────────────────────────────
  {
    id: 'rdtv-us-uk-ca',
    name: 'RDTV US/UK/CA',
    file: 'RDTV_us_uk_ca.m3u',
    group: 'Live TV',
    description: 'Live broadcast cable & network channels across the US, UK & Canada (3,747 channels)',
  },

  // ── Sports ────────────────────────────────────────────────────────────────
  {
    id: 'rdtv-sports-live',
    name: 'RDTV Sports Live',
    file: 'RDTV_Sports_Live.m3u',
    group: 'Sports',
    description: 'Live sport feeds — DLHD, Streamed, RabbitMeow & StreamFree (120 channels)',
  },
  {
    id: 'live-sports-today',
    name: 'Live Sports Today',
    file: 'LiveSportsToday.m3u',
    group: 'Sports',
    description: 'Today’s live fixtures across MLB, Bundesliga, WWIN & more (64 events)',
  },
  {
    id: 'fight-night',
    name: 'Fight Night',
    file: 'FightNight.m3u',
    group: 'Sports',
    description: 'Fight-night PPV cards (4 events)',
  },

  // ── Video on demand ───────────────────────────────────────────────────────
  {
    id: 'rdtv-vod',
    name: 'RDTV VOD',
    file: 'RDTV_VOD.m3u',
    group: 'On Demand',
    description: 'Action, drama, sci-fi & uncategorised VOD catalogue (5,662 titles)',
  },
  {
    id: 'rdtv-vod-24-7',
    name: 'RDTV VOD 24/7',
    file: 'RDTV_VOD_24_7.m3u',
    group: 'On Demand',
    description: 'The 24/7 always-on VOD loop (5,662 titles)',
  },
  {
    id: 'rdtv-xxx',
    name: 'RDTV XXX',
    file: 'RDTV_XXX.m3u',
    group: 'On Demand',
    description: 'XXX VOD catalogue (335 titles)',
  },

  // ── Resource portals ──────────────────────────────────────────────────────
  {
    id: 'all-resources-english',
    name: 'All Resources (English)',
    file: 'All_Resources_Combined_English.m3u',
    group: 'Resources',
    description: 'Special events, DAZN sports, HBO, Prime PPV and English entertainment feeds (817 channels)',
  },
  {
    id: 'all-resources',
    name: 'All Resources (Full)',
    file: 'All_Resources_Combined.m3u',
    group: 'Resources',
    description: 'Complete combined feed including non-English channels — the largest playlist (37,791 channels)',
  },
  {
    id: 'rdnutztv-resource',
    name: 'RDNutzTV Resource',
    file: 'RDNUTZTV_RESOURCE.m3u',
    group: 'Resources',
    description: 'RDNutzTV resource portal — radios, free TV & PPV feeds (3,899 channels)',
  },
  {
    id: 'rdnutztv-resource-2',
    name: 'RDNutzTV Resource 2',
    file: 'RDNUTZTV_RESOURCE2.m3u',
    group: 'Resources',
    description: 'Second RDNutzTV resource portal (3,622 channels)',
  },
  {
    id: 'resource-stalker',
    name: 'Resource Stalker',
    file: 'RDNUTZTV RESOURCE_stalker.m3u',
    group: 'Resources',
    description: 'Stalker resource mirrors (1,991 channels)',
  },
  {
    id: 'rdnutztv-ultimate',
    name: 'RdNutzTV Ultimate',
    file: 'RdNutzTV_Ultimate.m3u',
    group: 'Resources',
    description: 'Ultimate portal mix — planets2.space plus regional FAST portals (6,655 channels)',
  },
  {
    id: 'ultimate-tv',
    name: 'UltimateTV',
    file: 'Robbdeeze_UltimateTV.m3u',
    group: 'Resources',
    description: 'US channels, FAST channels, portal sports & general portals (4,884 channels)',
  },

  // ── Portals ───────────────────────────────────────────────────────────────
  {
    id: 'portal-scans',
    name: 'Portal Scans',
    file: 'Robbdeeze_PortalScans.m3u',
    group: 'Portals',
    description: 'Scanned portal endpoints (201 channels)',
  },
  {
    id: 'portal-scraped',
    name: 'Portal Scraped',
    file: 'Robbdeeze_PortalScraped.m3u',
    group: 'Portals',
    description: 'Auto-scraped portal endpoints',
  },
  {
    id: 'youtube-live',
    name: 'YouTube Live',
    file: 'Robbdeeze_YouTubeLive.m3u',
    group: 'Portals',
    description: 'YouTube live news & sport feeds',
  },
];

const M3U_REMOTE_BASE = 'https://iptv.rdnutz.us';

export const IPTV_PLAYLISTS: IptvPlaylistSource[] = PLAYLIST_DEFS.map((def) => ({
  id: def.id,
  name: def.name,
  url: `${M3U_REMOTE_BASE}/${encodeURIComponent(def.file)}`,
  proxyUrl: `/api/iptv/local/${encodeURIComponent(def.file)}`,
  description: def.description,
  group: def.group,
}));

/** Playlist groupings in display order. */
export const IPTV_PLAYLIST_GROUPS: string[] = Array.from(new Set(PLAYLIST_DEFS.map((d) => d.group)));

// In-memory cache of parsed channels
const playlistCache = new Map<string, StreamItem[]>();

export function parseM3U(text: string, sourceName: string, playlistId?: string): StreamItem[] {
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
    const rawGroup = groupMatch ? groupMatch[1] : 'General';
    const rawName = line.split(',').slice(1).join(',').trim();

    // Look ahead for stream URL
    let streamUrl = '';
    for (let j = i + 1; j < lines.length; j++) {
      const candidate = lines[j].trim();
      if (candidate && !candidate.startsWith('#')) {
        streamUrl = candidate;
        i = j; // Advance outer loop
        break;
      }
    }

    if (!streamUrl) continue;

    // Normalize category
    const cleanGroup = mapIptvGroup(rawGroup, rawName);
    const cleanTitle = cleanChannelName(rawName);
    const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('.ts');
    // Country + genre derived from the group-title (and channel name)
    const meta = parseGroupTitle(rawGroup, rawName);

    items.push({
      id: `iptv-${sourceName.toLowerCase()}-${items.length}-${Math.random().toString(36).substr(2, 4)}`,
      title: cleanTitle,
      name: cleanTitle,
      category: cleanGroup,
      groupTitle: rawGroup,
      status: '24/7',
      popular: isPopularIptv(cleanTitle, rawGroup),
      provider: 'iptv',
      streamType: isHls ? 'hls' : 'embed',
      m3uSource: sourceName,
      m3uPlaylistId: playlistId,
      poster: logo && logo.startsWith('http') ? logo : undefined,
      directEmbedUrl: streamUrl,
      iptvCountry: meta.country,
      iptvGenre: meta.genre,
      streams: [
        {
          streamNo: 1,
          name: `${cleanTitle} (${isHls ? 'HLS Direct' : 'Stream'})`,
          embedUrl: streamUrl,
          hd: cleanTitle.toLowerCase().includes('1080') || cleanTitle.toLowerCase().includes('hd'),
        },
      ],
      viewers: Math.floor(Math.random() * 4500) + 800,
    });
  }

  return items;
}

function cleanChannelName(raw: string): string {
  return raw
    .replace(/\[\d+p\]/gi, '')
    .replace(/\(\d+p\)/gi, '')
    .replace(/\[Geo-blocked\]/gi, '')
    .replace(/CA - /gi, '')
    .replace(/US - /gi, '')
    .replace(/UK - /gi, '')
    .replace(/CAFR - /gi, '')
    .trim();
}

function mapIptvGroup(group: string, name: string): string {
  const combined = (group + ' ' + name).toLowerCase();
  if (
    combined.includes('sport') ||
    combined.includes('dazn') ||
    combined.includes('espn') ||
    combined.includes('ppv') ||
    combined.includes('nfl') ||
    combined.includes('nba') ||
    combined.includes('tva')
  ) {
    return 'Live Sports';
  }
  if (
    combined.includes('movie') ||
    combined.includes('cinema') ||
    combined.includes('hbo') ||
    combined.includes('film') ||
    combined.includes('action')
  ) {
    return 'Entertainment & Movies';
  }
  if (
    combined.includes('news') ||
    combined.includes('weather') ||
    combined.includes('accuweather') ||
    combined.includes('cnn') ||
    combined.includes('bbc')
  ) {
    return 'News & Documentaries';
  }
  if (group.includes('CA') || group.includes('Canada')) return 'Canada TV';
  if (group.includes('UK') || group.includes('United Kingdom')) return 'UK TV';
  if (group.includes('US') || group.includes('Samsung')) return 'US & FAST Channels';
  return '24/7 Channels';
}

function isPopularIptv(name: string, group: string): boolean {
  const target = (name + ' ' + group).toLowerCase();
  const popularKeywords = ['hbo', 'dazn', 'abc', 'acc', 'a&e', 'espn', 'ppv', 'outtv', 'prime', 'acorn'];
  return popularKeywords.some((k) => target.includes(k));
}

// Re-export IPTV metadata constants for the directory UI
export { COUNTRY_ORDER, COUNTRY_LABELS, GENRE_OPTIONS } from './iptvMetadata';
export type { IptvMeta } from './iptvMetadata';

export const iptvService = {
  getPlaylists(): IptvPlaylistSource[] {
    return IPTV_PLAYLISTS;
  },

  /** Drop the in-memory M3U cache so the next fetch re-reads from disk/remote. */
  invalidateCache(): void {
    playlistCache.clear();
  },

  async fetchPlaylist(playlist: IptvPlaylistSource): Promise<StreamItem[]> {
    if (playlistCache.has(playlist.id)) {
      return playlistCache.get(playlist.id)!;
    }

    // Try proxy URL first (bypasses CORS in Vite dev server and proxy)
    const targetUrls = [playlist.proxyUrl, playlist.url];
    let rawText = '';

    for (const u of targetUrls) {
      try {
        const res = await fetch(u, { signal: AbortSignal.timeout(20000) });
        if (res.ok) {
          rawText = await res.text();
          if (rawText.includes('#EXTINF') || rawText.includes('#EXTM3U')) {
            break;
          }
        }
      } catch (err) {
        console.warn(`Failed fetching from ${u}:`, err);
      }
    }

    if (!rawText) {
      console.warn(`Could not load M3U for ${playlist.name}`);
      return [];
    }

    const parsed = parseM3U(rawText, playlist.name, playlist.id);
    playlistCache.set(playlist.id, parsed);
    return parsed;
  },

  /**
   * Load every M3U SRC playlist and merge the result.
   *
   * The playlists overlap heavily (All Resources is a superset of the
   * RDNutzTV resource files, RDTV VOD and RDTV VOD 24/7 are identical, the
   * FAST files are subsets of `fast_combined`, …), so channels are deduped by
   * their stream URL and the first playlist that provides a URL wins.
   */
  async fetchAllIptvChannels(): Promise<StreamItem[]> {
    if (playlistCache.has('all')) {
      return playlistCache.get('all')!;
    }

    const results = await Promise.allSettled(
      IPTV_PLAYLISTS.map((pl) => this.fetchPlaylist(pl))
    );

    const aggregated: StreamItem[] = [];
    const seenUrls = new Set<string>();

    results.forEach((r) => {
      if (r.status !== 'fulfilled') return;
      for (const item of r.value) {
        const key = item.directEmbedUrl || item.id;
        if (seenUrls.has(key)) continue;
        seenUrls.add(key);
        aggregated.push(item);
      }
    });

    playlistCache.set('all', aggregated);
    return aggregated;
  },
};
