import { StreamItem } from '../types/stream';

// Use the Vite proxy to avoid CORS issues
const EPORNER_PROXY = '/api/eporner/api/v2/video/search/';

// How many pages to fetch (each page = 200 videos, 5 pages = ~1000)
const MAX_PAGES = 5;
const PER_PAGE = 200;

let cachedStreams: StreamItem[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 30 * 60 * 1000;

const PROXY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.eporner.com/',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

// Top tags to use as primary categories (frequency-based selection)
const TOP_CATEGORIES = [
  'Asian', 'Japanese', 'Big Tits', 'Blowjob', 'Creampie',
  'Brunette', 'Redhead', 'Blonde', 'Teen', 'MILF',
  'Solo', 'Threesome', 'BBW', 'Lesbian', 'HD',
  'Outdoor', 'Indoor', 'Cumshot', 'Handjob', 'Bondage',
  'Stepmom', 'Student', 'Teacher', 'Office', 'Beauty',
  'Cuckold', 'Anal', 'Masturbation', 'Deepthroat', 'Facefuck',
];

function extractSubCategory(keywords: string): string {
  if (!keywords) return 'All';
  
  // Split by comma and clean up
  const tags = keywords.split(',').map(t => t.trim()).filter(Boolean);
  
  // Check against known categories first
  for (const tag of tags) {
    const cleanTag = tag.replace(/[^a-zA-Z]/g, '').toLowerCase();
    for (const cat of TOP_CATEGORIES) {
      if (cleanTag.includes(cat.toLowerCase()) || cat.toLowerCase().includes(cleanTag)) {
        return cat;
      }
    }
  }
  
  // Fall back to first meaningful tag
  const firstTag = tags[0]?.trim() || 'All';
  // Clean and title-case it
  return firstTag.replace(/^./, s => s.toUpperCase());
}

export interface EpornerCategory {
  name: string;
  count: number;
  icon: string;
}

export const epornerService = {
  async fetchAllEpornStreams(forceRefresh = false): Promise<StreamItem[]> {
    const now = Date.now();
    if (!forceRefresh && cachedStreams.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
      return cachedStreams;
    }

    try {
      const allVideos: Array<{
        id: string;
        title: string;
        views: number;
        rate: string;
        embed: string;
        thumb: string;
        keywords: string;
      }> = [];

      for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `${EPORNER_PROXY}?query=all&per_page=${PER_PAGE}&page=${page}&format=json&order=top-weekly`;
        try {
          const res = await fetch(url, {
            signal: AbortSignal.timeout(10000),
            headers: PROXY_HEADERS,
          });
          if (!res.ok) break;
          const json = await res.json();
          if (!json.videos || json.videos.length === 0) break;
          allVideos.push(...json.videos.map((v: any) => ({
            id: v.id,
            title: v.title,
            views: v.views || 0,
            rate: v.rate || '0',
            embed: v.embed || `https://www.eporner.com/embed/${v.id}/`,
            thumb: v.default_thumb?.src || '',
            keywords: v.keywords || '',
          })));
        } catch {
          break;
        }
      }

      const items: StreamItem[] = allVideos.map((v, i) => {
        const subCat = extractSubCategory(v.keywords);
        return {
          id: `eporner-${v.id}`,
          title: v.title,
          name: v.title,
          category: subCat,
          groupTitle: 'Eporner',
          subCategory: subCat,
          status: 'live',
          popular: v.views > 500000,
          provider: 'eporner',
          streamType: 'embed',
          m3uSource: 'Eporner_API',
          poster: v.thumb || undefined,
          directEmbedUrl: v.embed,
          viewers: v.views,
          streams: [
            {
              streamNo: 1,
              name: v.title,
              embedUrl: v.embed,
              hd: true,
            },
          ],
        };
      });

      cachedStreams = items;
      lastFetchTime = Date.now();
      return items;
    } catch (e) {
      console.warn('Eporner API fetch failed', e);
      return cachedStreams;
    }
  },

  getGroupIcons(): Record<string, string> {
    return {
      Eporner: '🔴',
      Asian: '🌏',
      Japanese: '🇯🇵',
      'Big Tits': '🍒',
      Blowjob: '💋',
      Creampie: '💦',
      Brunette: '🤎',
      Redhead: '🦁',
      Blonde: '✨',
      Teen: '🔥',
      MILF: '👩',
      Solo: '🎯',
      Threesome: '💕',
      BBW: '🍑',
      Lesbian: '👭',
      HD: '📺',
      Outdoor: '🌴',
      Indoor: '🏠',
      Cumshot: '🌟',
      Handjob: '🤲',
      Bondage: '⛓️',
      Stepmom: '👩‍👧',
      Student: '📚',
      Teacher: '👨‍🏫',
      Office: '💼',
      Beauty: '💄',
      Cuckold: '😈',
      Anal: '🍑',
      Masturbation: '🖐️',
      Deepthroat: '🫦',
      Facefuck: '😳',
    };
  },

  /** Returns category breakdown for Eporner streams */
  getCategoryBreakdown(streams: StreamItem[]): EpornerCategory[] {
    const counts: Record<string, number> = {};
    streams.forEach(s => {
      const cat = s.subCategory || 'All';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        icon: this.getGroupIcons()[name] || '🎬',
      }))
      .sort((a, b) => b.count - a.count);
  },
};
