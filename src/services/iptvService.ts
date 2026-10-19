import { StreamItem } from '../types/stream';

export interface IptvPlaylistSource {
  id: string;
  name: string;
  url: string;
  proxyUrl: string;
  description: string;
}

export const IPTV_PLAYLISTS: IptvPlaylistSource[] = [
  {
    id: 'local-fast',
    name: 'FAST Combined (Samsung TV Plus)',
    url: 'https://iptv.rdnutz.us/fast_combined.m3u',
    proxyUrl: '/api/iptv/local/fast_combined.m3u',
    description: '650+ FAST cable channels from Samsung TV Plus, CloudFront & Akamai HLS (served from the local M3U SRC directory; falls back to remote if the file is missing)',
  },
  {
    id: 'local-rdtv',
    name: 'RDTV (US, UK & Canada Live)',
    url: 'https://iptv.rdnutz.us/RDTV_us_uk_ca.m3u',
    proxyUrl: '/api/iptv/local/RDTV_us_uk_ca.m3u',
    description: 'Validated live broadcast cable & network channels across US, UK & Canada (local M3U SRC, falls back to remote)',
  },
  {
    id: 'local-combined',
    name: 'All Resources (PPV, DAZN & Premium)',
    url: 'https://iptv.rdnutz.us/All_Resources_Combined_English.m3u',
    proxyUrl: '/api/iptv/local/All_Resources_Combined_English.m3u',
    description: 'Special events, DAZN sports, HBO, Prime PPV and English entertainment feeds (local M3U SRC, falls back to remote)',
  },
  {
    id: 'local-all',
    name: 'All Resources (full, incl. non-English)',
    url: 'https://iptv.rdnutz.us/All_Resources_Combined.m3u',
    proxyUrl: '/api/iptv/local/All_Resources_Combined.m3u',
    description: 'Complete combined feed including non-English channels — largest playlist (local M3U SRC, falls back to remote)',
  },
];

// In-memory cache of parsed channels
const playlistCache = new Map<string, StreamItem[]>();

export function parseM3U(text: string, sourceName: string): StreamItem[] {
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
      poster: logo && logo.startsWith('http') ? logo : undefined,
      directEmbedUrl: streamUrl,
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

    const parsed = parseM3U(rawText, playlist.name);
    playlistCache.set(playlist.id, parsed);
    return parsed;
  },

  async fetchAllIptvChannels(): Promise<StreamItem[]> {
    if (playlistCache.has('all')) {
      return playlistCache.get('all')!;
    }

    const results = await Promise.allSettled(
      IPTV_PLAYLISTS.map((pl) => this.fetchPlaylist(pl))
    );

    const aggregated: StreamItem[] = [];
    results.forEach((r) => {
      if (r.status === 'fulfilled') {
        aggregated.push(...r.value);
      }
    });

    playlistCache.set('all', aggregated);
    return aggregated;
  },
};
