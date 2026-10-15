import { StreamItem } from '../types/stream';

// Per-category gradient colors for fallback thumbnails
const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  'Crazyshit': ['#7c3aed', '#4f46e5'],
  'DaftPorn': ['#db2777', '#be185d'],
  'Eporner': ['#ef4444', '#dc2626'],
  'LiveGore': ['#dc2626', '#991b1b'],
  'Vidmax': ['#059669', '#047857'],
  'ZFilmzOriginals': ['#7c3aed', '#5b21b6'],
  'HorribleVideos': ['#d97706', '#b45309'],
  'Worldstar Hip Hop': ['#ea580c', '#c2410c'],
  // Eporner sub-categories
  'Asian': ['#dc2626', '#991b1b'],
  'Japanese': ['#7c3aed', '#4f46e5'],
  'Big Tits': ['#db2777', '#be185d'],
  'Blowjob': ['#c026d3', '#a21caf'],
  'Creampie': ['#0891b2', '#0e7490'],
  'Brunette': ['#78350f', '#451a03'],
  'Redhead': ['#ea580c', '#c2410c'],
  'Blonde': ['#ca8a04', '#a16207'],
  'Teen': ['#e11d48', '#9f1239'],
  'MILF': ['#9333ea', '#7e22ce'],
  'Solo': ['#059669', '#047857'],
  'Threesome': ['#be185d', '#9d174d'],
  'BBW': ['#d97706', '#b45309'],
  'Lesbian': ['#2563eb', '#1d4ed8'],
  'HD': ['#64748b', '#475569'],
  'Outdoor': ['#16a34a', '#15803d'],
  'Indoor': ['#475569', '#334155'],
  'Cumshot': ['#ea580c', '#c2410c'],
  'Handjob': ['#0891b2', '#0e7490'],
  'Bondage': ['#374151', '#1f2937'],
  'Stepmom': ['#7c3aed', '#5b21b6'],
  'Student': ['#059669', '#047857'],
  'Teacher': ['#2563eb', '#1d4ed8'],
  'Office': ['#475569', '#334155'],
  'Beauty': ['#db2777', '#be185d'],
  'Cuckold': ['#dc2626', '#991b1b'],
  'Anal': ['#7c3aed', '#4f46e5'],
  'Masturbation': ['#c026d3', '#a21caf'],
  'Deepthroat': ['#e11d48', '#9f1239'],
  'Facefuck': ['#db2777', '#be185d'],
  // IPTV playlists
  'FAST Combined (Samsung TV Plus)': ['#0ea5e9', '#0284c7'],
  'RDTV (US, UK & Canada Live)': ['#16a34a', '#15803d'],
  'All Resources (PPV, DAZN & Premium)': ['#dc2626', '#b91c1c'],
};

/**
 * Emoji icon per category for fallback display.
 */
export const CATEGORY_EMOJI: Record<string, string> = {
  'Crazyshit': '🤪',
  'DaftPorn': '💋',
  'Eporner': '🔴',
  'LiveGore': '🔴',
  'Vidmax': '📹',
  'ZFilmzOriginals': '🎬',
  'HorribleVideos': '⚠️',
  'Worldstar Hip Hop': '🎤',
  // Eporner sub-categories
  'Asian': '🌏',
  'Japanese': '🇯🇵',
  'Big Tits': '🍒',
  'Blowjob': '💋',
  'Creampie': '💦',
  'Brunette': '🤎',
  'Redhead': '🦁',
  'Blonde': '✨',
  'Teen': '🔥',
  'MILF': '👩',
  'Solo': '🎯',
  'Threesome': '💕',
  'BBW': '🍑',
  'Lesbian': '👭',
  'HD': '📺',
  'Outdoor': '🌴',
  'Indoor': '🏠',
  'Cumshot': '🌟',
  'Handjob': '🤲',
  'Bondage': '⛓️',
  'Stepmom': '👩‍👧',
  'Student': '📚',
  'Teacher': '👨‍🏫',
  'Office': '💼',
  'Beauty': '💄',
  'Cuckold': '😈',
  'Anal': '🍑',
  'Masturbation': '🖐️',
  'Deepthroat': '🫦',
  'Facefuck': '😳',
};

/**
 * Get gradient colors for any stream based on category, groupTitle, or m3uSource.
 */
export function getStreamGradient(item: { category?: string; groupTitle?: string; m3uSource?: string; provider?: string }): [string, string] | null {
  const key = item.m3uSource || item.groupTitle || item.category;
  if (!key) return null;
  return CATEGORY_GRADIENTS[key] ?? null;
}

/**
 * Resolve thumbnail URL for a smutt stream based on its source URL.
 * Returns null if no known pattern matches (caller should use gradient fallback).
 */
export function resolveSmuttThumbnail(streamUrl: string, group?: string): string | null {
  // 1. Crazyshit: mediav.crazyshit.com/content/{year}/{month}/{hash}.mp4
  //    → media.crazyshit.com/thumbs/{year}/{month}/{hash}.jpg (confirmed 200)
  const crazyshitMatch = streamUrl.match(/mediav\.crazyshit\.com\/content\/(\d{4})\/(\d{2})\/([a-f0-9]+)\.mp4/);
  if (crazyshitMatch) {
    const [, year, month, hash] = crazyshitMatch;
    return `https://media.crazyshit.com/thumbs/${year}/${month}/${hash}.jpg`;
  }

  // 2. Dailymotion: cdndirector.dailymotion.com/cdn/manifest/video/{id}.m3u8
  //    Try dmcdn thumbnail patterns (may not work for all videos)
  const dmMatch = streamUrl.match(/cdndirector\.dailymotion\.com\/cdn\/manifest\/video\/([a-zA-Z0-9]+)\.m3u8/);
  if (dmMatch) {
    const videoId = dmMatch[1];
    try {
      return `https://s2.dmcdn.net/v/${btoa(videoId)}/x720.jpg`;
    } catch { /* ignore */ }
  }

  // 3. Dailymotion HLS manifest with numeric ID
  const dmNumMatch = streamUrl.match(/\/video\/fmp4\/(\d+)\/h264_aac/);
  if (dmNumMatch) {
    return `https://s2.dmcdn.net/v/${dmNumMatch[1]}/x720.jpg`;
  }

  // 4. Worldstar: hw-videos.worldstarhiphop.com or hw-mobile.worldstar.com
  //    Thumbnail APIs return 410/404, skip
  if (group === 'Worldstar Hip Hop') return null;

  // 5. LiveGore, HorribleVideos, Vidmax, ZFilmz, Inhumanity, eFukt, DaftPorn, Xrares, HeavyFetish, NothingToxic
  //    No reliable public thumbnail patterns found
  return null;
}

/**
 * Get CSS gradient string for a category fallback thumbnail.
 */
export function getCategoryGradient(group: string): string {
  const colors = CATEGORY_GRADIENTS[group] || ['#1e293b', '#0f172a'];
  return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
}
