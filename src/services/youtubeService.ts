import {
  YouTubeStream,
  YouTubeChannel,
  YouTubePlaylist,
  YouTubeChapter,
} from '../types/stream';

// ── Thumbnail generator (no external assets needed) ─────────────────────────

const THUMB_PALETTES: Array<[string, string, string]> = [
  ['#1e3a8a', '#3b82f6', '#93c5fd'],
  ['#7f1d1d', '#ef4444', '#fca5a5'],
  ['#14532d', '#22c55e', '#86efac'],
  ['#581c87', '#a855f7', '#d8b4fe'],
  ['#78350f', '#f59e0b', '#fcd34d'],
  ['#0c4a6e', '#0ea5e9', '#7dd3fc'],
  ['#831843', '#ec4899', '#f9a8d4'],
  ['#1e293b', '#64748b', '#cbd5e1'],
];

let thumbSeed = 0;

export function makeThumb(label: string, sub: string, index: number): string {
  const [c0, c1, c2] = THUMB_PALETTES[index % THUMB_PALETTES.length];
  thumbSeed += 1;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${c0}'/><stop offset='1' stop-color='${c1}'/>` +
    `</linearGradient></defs>` +
    `<rect width='640' height='360' fill='url(#g)'/>` +
    `<circle cx='540' cy='80' r='140' fill='${c2}' opacity='0.18'/>` +
    `<circle cx='90' cy='300' r='110' fill='black' opacity='0.25'/>` +
    `<text x='32' y='185' font-family='Arial Black, Arial' font-size='44' font-weight='900' fill='white' opacity='0.95'>${escapeXml(label)}</text>` +
    `<text x='32' y='235' font-family='Arial' font-size='22' fill='white' opacity='0.75'>${escapeXml(sub)}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;');
}

// ── Channels ────────────────────────────────────────────────────────────────

export const CHANNELS: YouTubeChannel[] = [
  {
    id: 'ch-nova',
    name: 'NovaPlay',
    avatar: makeThumb('NP', 'Gaming Network', 0),
    subscribers: '4.2M',
    verified: true,
    bio: 'Competitive gaming streams, esports watch-alongs and behind-the-scenes dev content.',
    socialLinks: { discord: '#', twitter: '#', youtube: '#' },
  },
  {
    id: 'ch-mesh',
    name: 'TechMesh',
    avatar: makeThumb('TM', 'Hardware Lab', 5),
    subscribers: '1.8M',
    verified: true,
    bio: 'Hands-on tech reviews, deep dives and daily hardware news.',
    socialLinks: { discord: '#', twitter: '#', youtube: '#' },
  },
  {
    id: 'ch-arena',
    name: 'ArenaCast',
    avatar: makeThumb('AC', 'Esports Hub', 1),
    subscribers: '8.7M',
    verified: true,
    bio: 'Official esports watch-parties for every major league and tournament.',
    socialLinks: { discord: '#', twitter: '#', youtube: '#' },
  },
  {
    id: 'ch-loom',
    name: 'LoomTalks',
    avatar: makeThumb('LT', 'Podcast Studio', 3),
    subscribers: '920K',
    verified: false,
    bio: 'Weekly creator economy, streamer culture and interview podcasts.',
    socialLinks: { twitter: '#', youtube: '#' },
  },
  {
    id: 'ch-pulse',
    name: 'GamePulse Shorts',
    avatar: makeThumb('GP', 'Clips & Shorts', 6),
    subscribers: '2.3M',
    verified: true,
    bio: 'The fastest clips, highlights and Shorts from the gaming world.',
    socialLinks: { twitter: '#', youtube: '#' },
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

const now = Date.now();
const H = 3600;
const D = 24 * H;

function chapters(
  items: Array<[string, number, string]>,
  thumbBase: string,
  idx: number
): YouTubeChapter[] {
  return items.map(([title, timeSeconds, description], i) => ({
    id: `chp-${idx}-${i}`,
    title,
    timeSeconds,
    description,
    thumbnail: makeThumb(title, `${fmtTime(timeSeconds)}`, idx + i),
  }));
}

export function fmtTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDuration(totalSeconds: number): string {
  if (totalSeconds < 3600) return `${Math.floor(totalSeconds / 60)}m`;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

// ── Stream catalog ──────────────────────────────────────────────────────────

const LIVES = [
  {
    id: 'yt-lv-1',
    title: 'RANKED GRIND TO RADIANT — Road to Grandmaster',
    description: 'Climbing the ranked ladder live with full analysis between games. Ask anything in chat about positioning, economy and teamfighting.',
    channel: CHANNELS[0],
    category: 'Gaming',
    tags: ['#Gaming', '#Ranked', '#Strategy'],
    viewers: 48210,
    playlistId: 'pl-nova-ranked',
    playlistTitle: 'Ranked Grind',
    playlistIndex: 42,
    chapters: chapters(
      [
        ['Start of stream', 0, 'Lobby, warmups and game plan'],
        ['First Blood Clutch', 860, '1v3 outplay on mid lane'],
        ['Elo Spike Moment', 2190, 'The teamfight that broke the game'],
        ['Q&A Break', 3450, 'Answering chat questions'],
      ],
      'LIVE',
      0,
    ),
  },
  {
    id: 'yt-lv-2',
    title: 'LCS WATCH-ALONG: Playoffs Day 3 + Pro Analysis',
    description: 'Full broadcast watch-along with play-by-play commentary and post-game analysis with a pro coach guest.',
    channel: CHANNELS[2],
    category: 'Esports',
    tags: ['#Esports', '#LCS', '#WatchAlong'],
    viewers: 112400,
    playlistId: 'pl-arena-lcs',
    playlistTitle: 'LCS Watch-Along',
    playlistIndex: 18,
    chapters: chapters(
      [
        ['Pre-game predictions', 0, 'Odds and pick predictions'],
        ['Game 1: Top Seed Sweep', 900, 'How the favorites took the opener'],
        ['Mid-boss fight replay', 2600, 'Frame-by-frame of the famous 5v5'],
        ['Coach breakdown', 4200, 'Guest coach dissects macro play'],
      ],
      'WATCH',
      1,
    ),
  },
  {
    id: 'yt-lv-3',
    title: 'NEW CONSOLE UNBOXING + First Impressions (LIVE Q&A)',
    description: 'First look at the new handheld — unboxing, hardware tour, benchmark runs and a long-form live Q&A.',
    channel: CHANNELS[1],
    category: 'Tech',
    tags: ['#TechReview', '#Hardware', '#Unboxing'],
    viewers: 23840,
    chapters: chapters(
      [
        ['Unboxing', 0, 'Opening the box and first impressions'],
        ['Hardware tour', 640, 'Ports, screen, battery and build quality'],
        ['Benchmark marathon', 1500, 'Thermal and fps benchmarks'],
        ['Live Q&A', 2900, 'Everything chat asked'],
      ],
      'TECH',
      2,
    ),
  },
  {
    id: 'yt-lv-4',
    title: 'IRL: 24 Hours of Coding — Building a Stream Hub',
    description: 'Building this very kind of stream hub from scratch, live. Coffee, code and zero mercy on the TODO list.',
    channel: CHANNELS[0],
    category: 'IRL',
    tags: ['#IRL', '#Coding', '#BuildInPublic'],
    viewers: 8930,
    chapters: chapters(
      [
        ['Setup & roadmap', 0, 'What we are building today'],
        ['Component sprint #1', 1800, 'Card deck and filters'],
        ['Player integration', 5400, 'Embedding the player and chat'],
        ['Ship it', 9600, 'Final polish and deploy'],
      ],
      'IRL',
      3,
    ),
  },
];

const UPCOMING = [
  {
    id: 'yt-up-1',
    title: 'WORLDS FINALS: Championship Match Watch-Party',
    description: 'The biggest broadcast of the year. Full watch-party with casters, pro analyst guest and chat superchat rewards.',
    channel: CHANNELS[2],
    category: 'Esports',
    tags: ['#Esports', '#Worlds', '#Finals'],
    scheduledAt: now + 6 * H,
    playlistId: 'pl-arena-lcs',
    playlistTitle: 'LCS Watch-Along',
    chapters: [],
  },
  {
    id: 'yt-up-2',
    title: 'NEW EPISODE: The Creator Economy in 2026',
    description: 'Sitting down with three top creators to talk sponsorships, AI, and what changed this year.',
    channel: CHANNELS[3],
    category: 'Podcast',
    tags: ['#Podcast', '#CreatorEconomy', '#Interview'],
    scheduledAt: now + D,
    chapters: [],
  },
  {
    id: 'yt-up-3',
    title: 'SPEEDRUN MARATHON — Any% Gauntlet (Charity)',
    description: '8 hours of speedruns to raise money for charity. All-time record attempts possible.',
    channel: CHANNELS[4],
    category: 'Gaming',
    tags: ['#Speedrun', '#Charity', '#Marathon'],
    scheduledAt: now + 2 * D,
    chapters: [],
  },
  {
    id: 'yt-up-4',
    title: 'LAB REPORT: Budget 4K Setup Under $500',
    description: 'We build a full 4K gaming setup for under five hundred dollars. Every part itemized on stream.',
    channel: CHANNELS[1],
    category: 'Tech',
    tags: ['#Tech', '#BudgetBuild', '#4K'],
    scheduledAt: now + 3 * D,
    chapters: [],
  },
];

const VODS = [
  {
    id: 'yt-vd-1',
    title: 'GRANDMASTER GAME — The Play That Broke Patch 14.2',
    description: 'The ranked game that sparked a meta shift. Full replay with commentary and a detailed post-game breakdown.',
    channel: CHANNELS[0],
    category: 'Gaming',
    tags: ['#Gaming', '#Replay', '#Meta'],
    durationSeconds: 8100,
    publishedAt: now - 2 * D,
    chapters: chapters(
      [
        ['Game start', 0, 'Loadout picks and early map'],
        ['The famous outplay', 1120, 'The 1v2 that changed the meta'],
        ['Post-game breakdown', 6200, 'Frame-by-frame analysis'],
        ['Chat Q&A', 7400, 'Questions from viewers'],
      ],
      'VOD',
      4,
    ),
  },
  {
    id: 'yt-vd-2',
    title: 'GPU SHOWDOWN: 6 Flagships Tested For 30 Days',
    description: 'One month of daily driving six flagship GPUs. Thermals, noise, power draw and real game performance.',
    channel: CHANNELS[1],
    category: 'Tech',
    tags: ['#TechReview', '#GPU', '#Benchmark'],
    durationSeconds: 2460,
    publishedAt: now - 5 * D,
    chapters: chapters(
      [
        ['Methodology', 0, 'How the test was run'],
        ['Gaming performance', 480, 'Fps in 12 AAA titles'],
        ['Thermals & noise', 1300, 'Real-world thermals after 30 days'],
        ['Verdict', 2200, 'Which one to buy'],
      ],
      'GPU',
      5,
    ),
  },
  {
    id: 'yt-vd-3',
    title: 'EP 42: Talking Burnout With Full-Time Streamers',
    description: 'A raw conversation about burnout, mental health and sustainability for full-time creators.',
    channel: CHANNELS[3],
    category: 'Podcast',
    tags: ['#Podcast', '#MentalHealth', '#Streaming'],
    durationSeconds: 5100,
    publishedAt: now - 1 * D,
    chapters: chapters(
      [
        ['Introduction', 0, 'Guests and topics'],
        ['When streaming stopped being fun', 900, 'Recognizing the signs'],
        ['Building boundaries', 2600, 'Practical systems that work'],
        ['Listener letters', 4400, 'Reading messages from the community'],
      ],
      'EP42',
      6,
    ),
  },
  {
    id: 'yt-vd-4',
    title: 'CHAMPIONSHIP HIGHLIGHTS — Top 50 Plays of the Season',
    description: 'A full season of esports distilled into the 50 best plays, ranked by our panel of pros.',
    channel: CHANNELS[2],
    category: 'Esports',
    tags: ['#Esports', '#Highlights', '#Season'],
    durationSeconds: 1560,
    publishedAt: now - 8 * D,
    chapters: chapters(
      [
        ['Plays 50-40', 0, 'Solid starts'],
        ['Plays 30-20', 320, 'The crowd favorites'],
        ['Plays 10-6', 800, 'Getting personal'],
        ['Top 5', 1180, 'The final countdown'],
      ],
      'TOP50',
      7,
    ),
  },
];

const SHORTS = [
  {
    id: 'yt-sh-1',
    title: 'IMPOSSIBLE 1v5 — Did you see that??',
    description: 'The clip everyone is talking about this week.',
    channel: CHANNELS[4],
    category: 'Shorts',
    tags: ['#Shorts', '#Clutch'],
    durationSeconds: 42,
    publishedAt: now - 3 * 3600,
    chapters: [],
  },
  {
    id: 'yt-sh-2',
    title: 'This GPU trick saves 30% power',
    description: 'Underrated setting everyone should change today.',
    channel: CHANNELS[4],
    category: 'Shorts',
    tags: ['#Shorts', '#TechTip'],
    durationSeconds: 58,
    publishedAt: now - 9 * 3600,
    chapters: [],
  },
  {
    id: 'yt-sh-3',
    title: 'Speedrun world record attempt #7',
    description: 'New PB or not? Watch to the end.',
    channel: CHANNELS[4],
    category: 'Shorts',
    tags: ['#Shorts', '#Speedrun'],
    durationSeconds: 34,
    publishedAt: now - 1 * D,
    chapters: [],
  },
];

// Assemble with thumbnails + embeds
function finalize(
  arr: Array<Partial<YouTubeStream> & { id: string; title: string; channel: YouTubeChannel; category: string; tags: string[] }>,
  offset: number
): YouTubeStream[] {
  return arr.map((s, i) => {
    const idx = offset + i;
    const isLive = s.status === 'live';
    const isShort = s.status === 'shorts';
    const thumbLabel = s.title.split('—')[0].split(':')[0].trim().slice(0, 18).toUpperCase();
    const thumbSub = isLive ? '🔴 LIVE NOW' : s.status === 'upcoming' ? 'UPCOMING' : s.category;
    return {
      description: s.description || '',
      status: isLive ? 'live' : isShort ? 'shorts' : s.status === 'upcoming' ? 'upcoming' : 'vod',
      thumbnail: makeThumb(thumbLabel, thumbSub, idx),
      embedUrl: `https://www.youtube.com/embed/yt${s.id.replace(/\W/g, '')}?${isLive ? 'autoplay=1' : ''}`,
      chapters: s.chapters || [],
      ...s,
    } as YouTubeStream;
  });
}

export const YOUTUBE_STREAMS: YouTubeStream[] = [
  ...finalize(LIVES, 0).map((s) => ({ ...s, status: 'live' as const, viewers: s.viewers ?? Math.floor(5000 + Math.random() * 120000) })),
  ...finalize(UPCOMING, 8).map((s) => ({ ...s, status: 'upcoming' as const })),
  ...finalize(VODS, 12),
  ...finalize(SHORTS, 16),
];

export const YOUTUBE_PLAYLISTS: YouTubePlaylist[] = [
  {
    id: 'pl-nova-ranked',
    title: 'Ranked Grind',
    description: 'Every ranked climb, archived. Season 14 complete.',
    thumbnail: makeThumb('RANKED', 'Playlist', 0),
    videoCount: 87,
    streamIds: YOUTUBE_STREAMS.filter((s) => s.playlistId === 'pl-nova-ranked').map((s) => s.id),
  },
  {
    id: 'pl-arena-lcs',
    title: 'LCS Watch-Along',
    description: 'Every playoff watch-party from this split.',
    thumbnail: makeThumb('LCS', 'Playlist', 1),
    videoCount: 24,
    streamIds: YOUTUBE_STREAMS.filter((s) => s.playlistId === 'pl-arena-lcs').map((s) => s.id),
  },
  {
    id: 'pl-tech-2026',
    title: 'Tech 2026 Reviews',
    description: 'Every major review published this year.',
    thumbnail: makeThumb('TECH', 'Playlist', 5),
    videoCount: 31,
    streamIds: YOUTUBE_STREAMS.filter((s) => s.channel.id === 'ch-mesh' && s.status === 'vod').map((s) => s.id),
  },
];

// ── Query API ───────────────────────────────────────────────────────────────

export function getStreamsByStatus(status: string): YouTubeStream[] {
  if (status === 'all') return YOUTUBE_STREAMS;
  if (status === 'live') return YOUTUBE_STREAMS.filter((s) => s.status === 'live');
  if (status === 'upcoming') return YOUTUBE_STREAMS.filter((s) => s.status === 'upcoming');
  if (status === 'vod') return YOUTUBE_STREAMS.filter((s) => s.status === 'vod' || s.status === 'shorts');
  if (status === 'shorts') return YOUTUBE_STREAMS.filter((s) => s.status === 'shorts');
  if (status === 'playlists') return YOUTUBE_STREAMS.filter((s) => s.playlistId);
  return YOUTUBE_STREAMS;
}

export function getStreamById(id: string): YouTubeStream | undefined {
  return YOUTUBE_STREAMS.find((s) => s.id === id);
}

export function getStreamsByChannel(channelId: string): YouTubeStream[] {
  return YOUTUBE_STREAMS.filter((s) => s.channel.id === channelId);
}

export function getRelated(stream: YouTubeStream): YouTubeStream[] {
  return YOUTUBE_STREAMS.filter(
    (s) => s.id !== stream.id && (s.category === stream.category || s.channel.id === stream.channel.id)
  ).slice(0, 6);
}

export function getPlaylistsFor(stream: YouTubeStream): YouTubePlaylist[] {
  return YOUTUBE_PLAYLISTS.filter((p) => p.streamIds.includes(stream.id));
}

// Simulated live viewer drift
export function driftViewers(base: number): number {
  const jitter = Math.floor((Math.random() - 0.45) * base * 0.04);
  return Math.max(100, base + jitter);
}
