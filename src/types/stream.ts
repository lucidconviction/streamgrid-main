export interface StreamSource {
  id?: string;
  source?: string;
  streamNo?: number;
  name?: string;
  language?: string;
  hd?: boolean;
  embedUrl: string;
  viewers?: number;
}

export interface StreamItem {
  id: string;
  title: string;
  name?: string;
  category: string;
  date?: number | string;
  poster?: string;
  popular?: boolean;
  status?: 'live' | 'upcoming' | 'offline' | '24/7';
  provider: 'streamed' | 'bintv' | 'westream' | 'daddylive' | 'iptv' | 'smutt' | 'eporner' | 'anime';
  streamType?: 'hls' | 'embed';
  m3uSource?: string;
  groupTitle?: string;
  sources?: Array<{ source: string; id: string }>;
  streams?: StreamSource[];
  directEmbedUrl?: string;
  /** Original unproxied URL for screenshot capture (not used for playback) */
  screenshotUrl?: string;
  /** Background video URL — original stream URL for autoplay hero/banner video */
  bgVideoUrl?: string;
  viewers?: number;
  teams?: {
    home?: string;
    away?: string;
  };
  smuttEmoji?: string; // Emoji for smutt streams without thumbnails
  subCategory?: string; // Eporner sub-category (Asian, Japanese, etc.)
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  favoriteCategories: string[];
  autoplay: boolean;
  defaultQuality: 'hd' | 'auto' | 'sd';
  theme: 'midnight' | 'oled' | 'cyber';
  liveAlertsEnabled?: boolean;
  soundAlertsEnabled?: boolean;
  browserNotificationsEnabled?: boolean;
  createdAt: number;
}

export interface WatchHistoryEntry {
  id: string;
  streamId: string;
  title: string;
  category: string;
  poster?: string;
  embedUrl: string;
  provider: string;
  watchedAt: number;
  progressPercent: number; // 0-100
  durationMinutes?: number;
}

export interface MultiviewSlot {
  slotId: number;
  stream: StreamItem | null;
  resolvedEmbedUrl?: string;
  isMuted: boolean;
  volume: number;
  label?: string;
  /** User-assigned bookmark / label for this slot */
  bookmark?: string;
}

export type MultiviewLayout =
  | 'single'
  | 'dual'
  | 'triple'
  | 'quad'
  | 'six'
  | 'six-wide'
  | 'six-tall'
  | 'focus-5'
  | 'big-center';

export interface MultiviewPreset {
  id: string;
  name: string;
  layout: MultiviewLayout;
  streamIds: string[];
  createdAt: number;
}

// ── YouTube Hub Types ──────────────────────────────────────────────────────

export type YouTubeStreamStatus = 'live' | 'upcoming' | 'vod' | 'shorts';

export interface YouTubeChannel {
  id: string;
  name: string;
  avatar: string;
  subscribers: string;
  verified: boolean;
  bio: string;
  youtubeChannelId?: string; // real YouTube channel ID or @handle
  socialLinks?: {
    discord?: string;
    twitter?: string;
    youtube?: string;
  };
}

export interface YouTubeChapter {
  id: string;
  title: string;
  timeSeconds: number;
  description: string;
  thumbnail: string;
}

export interface YouTubeStream {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channel: YouTubeChannel;
  status: YouTubeStreamStatus;
  category: string;
  tags: string[];
  viewers?: number;
  durationSeconds?: number;
  scheduledAt?: number;
  publishedAt?: number;
  chapters: YouTubeChapter[];
  playlistId?: string;
  playlistTitle?: string;
  playlistIndex?: number;
  embedUrl: string;
  isMemberOnly?: boolean;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoCount: number;
  streamIds: string[];
}

export interface SavedChannel {
  handle: string;
  name: string;
  subscribers: string;
  avatar: string;
  verified: boolean;
  savedAt: number;
}
