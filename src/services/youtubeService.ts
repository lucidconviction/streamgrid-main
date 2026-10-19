import {
  YouTubeStream,
  YouTubeChannel,
  YouTubePlaylist,
  YouTubeChapter,
  SavedChannel,
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

// ── Channels (real YouTube profiles) ────────────────────────────────────────

const AVATAR_PALETTES: Array<[string, string]> = [
  ['#ef4444', '#7f1d1d'],
  ['#3b82f6', '#1e3a8a'],
  ['#22c55e', '#14532d'],
  ['#a855f7', '#581c87'],
  ['#f59e0b', '#78350f'],
  ['#0ea5e9', '#0c4a6e'],
  ['#ec4899', '#831843'],
  ['#64748b', '#1e293b'],
];

function makeAvatar(name: string, index: number): string {
  const initials = name
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  const [c0, c1] = AVATAR_PALETTES[index % AVATAR_PALETTES.length];
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'>` +
    `<defs><linearGradient id='a' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${c0}'/><stop offset='1' stop-color='${c1}'/>` +
    `</linearGradient></defs>` +
    `<rect width='128' height='128' fill='url(#a)'/>` +
    `<text x='64' y='78' text-anchor='middle' font-family='Arial Black, Arial' font-size='44' font-weight='900' fill='white' opacity='0.95'>${escapeXml(initials)}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** [name, youtubeHandle, subscribers, verified] */
const REAL_PROFILES: Array<[string, string, string, boolean]> = [
  ['UFC', 'ufc', '22.9M', true],
  ['WORLDSTARHIPHOP', 'worldstarhiphop', '27.7M', true],
  ['The Diary Of A CEO', 'TheDiaryOfACEO', '19.3M', true],
  ['NFL', 'NFL', '16.5M', true],
  ['ESPN', 'espn', '14.5M', true],
  ['The Daily Show', 'TheDailyShow', '14M', true],
  ['NPR Music', 'nprmusic', '12.9M', true],
  ['MrBallen', 'MrBallen', '11.2M', true],
  ['Jubilee', 'jubilee', '11M', true],
  ['VICE News', 'VICENews', '9.3M', true],
  ['Complex', 'Complex', '6.98M', true],
  ['djvlad', 'vladtv', '6.43M', true],
  ['Candace Owens', 'RealCandaceO', '6.08M', true],
  ['StarTalk', 'StarTalk', '5.88M', true],
  ['BETNetworks', 'BETNetworks', '5.42M', true],
  ['No Jumper', 'NoJumper', '4.97M', true],
  ['All Def', 'Alldef', '4.61M', true],
  ['Netflix Is A Joke', 'netflixisajoke', '4.58M', true],
  ['STREETBEEFS', 'STREETBEEFS_', '4.49M', true],
  ['Piers Morgan Uncensored', 'PiersMorganUncensored', '4.46M', true],
  ['Fireship', 'Fireship', '4.26M', true],
  ['Mighty Car Mods', 'mightycarmods', '3.98M', true],
  ['ALTER', 'WatchALTER', '3.87M', true],
  ['T Pain', 'tpain', '3.89M', true],
  ['Smokin\' & Grillin with AB', 'SmokinandGrillinwithAB', '3.79M', true],
  ['Absolute History', 'AbsoluteHistory', '3.69M', true],
  ['Danny Kim', 'DannyGrubs', '3.34M', true],
  ['REVOLT', 'revolt', '3.33M', true],
  ['The Andrew Schulz', 'TheAndrewSchulz', '2.99M', true],
  ['The 85 South Comedy Show', 'The85SouthShow', '2.83M', true],
  ['Ed Bassmaster', 'edbassmaster', '2.83M', true],
  ['Hayls World', 'HaylsWorld', '2.72M', true],
  ['Coin Bureau', 'CoinBureau', '2.73M', true],
  ['Paul Barron Network', 'PaulBarronNetwork', '2.63M', true],
  ['Speakeasy', 'speakeasy', '2.6M', true],
  ['STRELKA STREET FIGHTS', 'Tronmma', '2.52M', true],
  ['Amala Ekpunobi', 'TheAmalaEkpunobi', '2.5M', true],
  ['The Trading Parrot', 'TheTradingParrot', '2.52K', false],
  ['Roland S. Martin', 'rolandsmartin', '1.95M', true],
  ['African Diaspora News Channel', 'AfricanDiasporaNews', '1.93M', true],
  ['Kevin Samuels', 'byKevinSamuels', '1.92M', true],
  ['The Majority Report w/ Sam Seder', 'TheMajorityReport', '2.09M', true],
  ['Flossy Carter', 'FlossyCarter', '2.14M', true],
  ['Real Crime', 'RealCrime', '2.17M', true],
  ['Ross Cameron - Warrior Trading', 'DaytradeWarrior', '2.1M', true],
  ['Trilogy Media', 'TrilogyMedia', '1.84M', true],
  ['Shane Hummus', 'ShaneHummus', '1.68M', true],
  ['Shout! Studios', 'ShoutStudios', '1.35M', true],
  ['Joe Budden TV', 'joebuddentv', '1.63M', true],
  ['The Fumble', 'thefumble', '1.59M', true],
  ['Anton Daniels', 'AntonDaniels', '1.52M', true],
  ['Daym Drops', 'DaymDrops', '1.73M', true],
  ['SJohnsonVoiceOvers', 'SJohnsonVoiceOvers', '1.74M', true],
  ['NOT ANOTHER COOKING SHOW', 'NOTANOTHERCOOKINGSHOW', '1.41M', true],
  ['Stalekracker Official', 'stalekrackerofficial4240', '1.41M', false],
  ['Stephen A. Smith', 'MrStephenASmith', '1.4M', true],
  ['Android Developers', 'AndroidDevelopers', '1.43M', true],
  ['Discover Crypto', 'DiscoverCrypto_', '1.38M', true],
  ['Omma', 'Omma', '1.37M', true],
  ['Gary Owen', 'garyowencom', '1.37M', true],
  ['Mr.ChimeTime', 'mr.chimetime', '1.25M', true],
  ['4biddenknowledge Podcast Network', '4biddenKnowledgePodcast', '1.24M', true],
  ['Kimmy\'s Kreations', 'kimmyskreations1', '1.12M', true],
  ['Electrical MD', 'ElectricalMD', '1.12M', true],
  ['The Art Of Dialogue', 'TheArtOfDialogue', '1.12M', true],
  ['McQueen On Air', 'McQueenOnAir', '1.03M', true],
  ['LATRYGUY', 'LATRYGUY', '1.02M', true],
  ['FLAGRANT CLIPS', 'flagrantclips', '1.04M', true],
  ['DeVory Darkins', 'DeVoryDarkins', '1.14M', true],
  ['MrLboyd Reacts', 'MrLboydReacts', '1.14M', true],
  ['Matt Wolfe', 'mreflow', '1M', true],
  ['Nate Herk | AI Automation', 'nateherk', '978K', true],
  ['Kenan Grace', 'KenanGrace', '977K', true],
  ['Demons Row', 'DemonsRow', '982K', true],
  ['Bounty Tank', 'BountyTank', '908K', true],
  ['Crank Lucas', 'cranklucas', '863K', true],
  ['The Angryman', 'TheAngrymanChannel', '835K', false],
  ['UNINTERRUPTED', 'UNINTERRUPTED', '797K', true],
  ['Custom Offsets', 'CustomOffsetsTV', '750K', true],
  ['Futurepedia', 'futurepedia_io', '746K', false],
  ['Stock Moe', 'StockMoe', '722K', false],
  ['AI Search', 'theAIsearch', '724K', true],
  ['Mark Stache', 'Mark_Stache', '710K', false],
  ['Hes Kicks', 'heskicks', '687K', false],
  ['allthingsbbq', 'allthingsbbq', '662K', false],
  ['The Trey King Show', 'TheTreyKingShow', '658K', false],
  ['Lil Poudii', 'LilPoudii', '642K', false],
  ['Nice Kicks', 'nicekicks', '642K', false],
  ['Matthew Berman', 'matthew_berman', '632K', true],
  ['Mark J Kohler', 'MarkJKohler', '616K', false],
  ['Social Proof', 'RealSocialProof', '615K', false],
  ['KINGDOM REACTS', 'KINGDOMREACTS', '586K', false],
  ['The AI Daily Brief: AI News', 'AIDailyBrief', '585K', false],
  ['The Dr. Phil Podcast', 'DrPhilPodcast', '583K', true],
  ['Eddie Griffin', 'EddieGriffinTV', '553K', false],
  ['FUNarios', 'FUNarios', '565K', false],
  ['Derrick Grace II', 'DerrickGracetwo', '208K', false],
  ['Millionaire Morning Show', 'MillionaireMorningShow', '455K', true],
  ['The Ariel Helwani Show', 'ArielHelwani', '457K', false],
  ['Sabby Sabs', 'SabbySabs', '420K', false],
  ['Julian Goldie SEO', 'JulianGoldieSEO', '422K', false],
  ['Poetik Flakko', 'PoetikFlakko', '438K', false],
  ['Mother Jones', 'MotherJones', '359K', true],
  ['The Kwak Brothers', 'TheKwakBrothers', '347K', false],
  ['Wes Roth', 'WesRoth', '326K', false],
  ['Mecum Auctions', 'mecum', '319K', true],
  ['Trading Fraternity', 'Thetradingfraternity', '310K', false],
  ['Killer Mike', 'KillerMikeGTO', '296K', true],
  ['Helena Liu', 'HELENA-LIU', '286K', true],
  ['The Saint', 'TheSaintandTheSinner', '263K', false],
  ['ScottieDTV', 'ScottieDTV', '263K', false],
  ['WorldofAI', 'intheworldofai', '235K', false],
  ['Alex Finn', 'AlexFinnOfficial', '233K', false],
  ['Prompt Engineering', 'engineerprompt', '246K', false],
  ['The_Perseverance', 'The_Perseverance', '257K', false],
  ['Full Value Dan', 'FullValueDan', '224K', false],
  ['GabeTrades', 'GabeTrades', '211K', false],
  ['The Bleu Channel', 'thebleuchannel', '212K', false],
  ['LNSPLTBLVD', 'LNSPLTBLVD', '210K', false],
  ['Duncan Rogoff | Learn Claude Code', 'duncanrogoff', '85.9K', false],
  ['World Of Fuush', 'Worldoffuush', '71.8K', false],
  ['60MvTv', '60mvtv', '35K', false],
  ['CoinDesk', 'CoinDesk', '195K', true],
  ['Holley', 'HolleyPerformance', '176K', true],
  ['MylesG Investments', 'MylesGInvestments', '166K', false],
  ['Zubair Trabzada | AI Workshop', 'AI-GPTWorkshop', '158K', false],
  ['MustangMedic', 'MustangMedic', '157K', false],
  ['Her Patriot Voice', 'HerPatriotVoice', '163K', false],
  ['G Rich', 'GRich01', '163K', false],
  ['Big Brandoh', 'BigBrandoh', '142K', false],
  ['Sav Says', 'SavSays', '143K', false],
  ['The Conscious Lee', 'TheConsciousLee', '138K', false],
  ['Industry Secrets', 'Industry-Secrets', '128K', false],
  ['Smoke N\' Scan', 'SmokeNScan', '126K', false],
  ['Koh', 'KCryptoYT', '113K', false],
  ['Hannibal Is Hungry', 'hannibalishungry', '187K', false],
  ['newtech', 'firesticksetup', '185K', false],
  ['corbin', 'Corbin_Brown', '185K', false],
  ['Detour Shirts', 'DetourShirts', '186K', false],
  ['Timeless Barbers', 'TimelessBarbers', '180K', false],
  ['Be The Boss Of Your Motorcycle!', 'BeTheBossOfYourMotorcycle', '197K', false],
  ['The Dawgfatha\'s BBQ', 'TheDawgfathasBBQ', '201K', false],
  ['The Officer Tatum', 'TheOfficerTatum', '3.84M', false],
  ['Cocoa Butter', 'CocoaButter', '1.32M', false],
  ['The Next New Thing', 'TheNextNewThingAI', '49.8K', false],
  ['MattVidPro', 'MattVidPro', '304K', false],
  ['TheFigCo', 'TheFigCo', '67.9K', false],
  ['The Clever Millionaire', 'TheCleverMillionaire', '71.6K', false],
  ['ManuAGI - AutoGPT Tutorials', 'ManuAGI', '42K', false],
  ['TheAIGRID', 'TheAiGrid', '398K', false],
  ['HYPE+', 'HypePlusTV', '1.09M', false],
  ['BULLRUNNERS', 'Bullrunners', '395K', false],
  ['AIQUEST', 'AIQuestAcademy', '26.5K', false],
  ['Tech-Practice', 'tech-practice9805', '8.73K', false],
  ['9CHINO2CHING5', 'chinoching-topic', '227', false],
  ['Tyrin Barney', 'TyrinBarneyAI', '3.32K', false],
  ['Rob The AI Guy', 'realrobtheaiguy', '96.4K', false],
  ['Everything Kevo', 'EverythingKevo', '89.5K', false],
  ['Dennis Kirk, Inc.', 'DennisKirk', '53K', false],
  ['AshandtheChaos', 'AshandtheChaos', '86.7K', false],
  ['Yaad Life\'s Good', 'YaadLifesGood', '93.9K', false],
  ['All Your Tech AI', 'allyourtechai', '27.7K', false],
  ['FHO ATLANTA, GA.', 'FHOHNIC', '31.8K', false],
  ['AXS TV', 'AXSTV', '487K', true],
  ['Breakfast Club Power 105.1 FM', 'BreakfastClubPower1051FM', '6.04M', true],
  ['HOT 97', 'hot97', '4M', true],
  ['URBAN POLITICIANS TV', 'urbanpoliticianstv4115', '415K', false],
  ['Hip Hop News Uncensored', 'HipHopNewsUncensored', '911K', false],
  ['The B Hayes Show', 'StockPlug_', '38.9K', false],
  ['Jay Williams Let\'s Live Life', 'Jaywilliamsletslivelife', '385K', false],
];

export const CHANNELS: YouTubeChannel[] = REAL_PROFILES.map(
  ([name, handle, subscribers, verified], i) => ({
    id: handle.toLowerCase(),
    name,
    avatar: makeAvatar(name, i),
    subscribers,
    verified,
    bio: `@${handle} • ${subscribers} subscribers`,
    youtubeChannelId: handle,
    socialLinks: { youtube: `https://www.youtube.com/@${handle}` },
  })
);

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

function formatSubscriberCount(n: number): string {
  return fmtViews(n);
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
    const thumbSub = isShort ? '⚡ SHORT' : isLive ? '🔴 LIVE NOW' : s.status === 'upcoming' ? 'UPCOMING' : s.category;
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
  ...finalize(SHORTS, 16).map((s) => ({ ...s, status: 'shorts' as const })),
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

/** Live pool of real streams fetched from the NewPipe engine (populated by loadEngineStreams). */
let _enginePool: YouTubeStream[] = [];
export function setEnginePool(streams: YouTubeStream[]): void {
  _enginePool = streams;
}

/** All streams: engine (real) first, then mock catalog. */
function allKnownStreams(): YouTubeStream[] {
  if (_enginePool.length === 0) return YOUTUBE_STREAMS;
  const seen = new Set<string>(_enginePool.map((s) => s.id));
  return [..._enginePool, ...YOUTUBE_STREAMS.filter((s) => !seen.has(s.id))];
}

export function getStreamsByStatus(status: string): YouTubeStream[] {
  if (status === 'all') return allKnownStreams();
  if (status === 'live') return allKnownStreams().filter((s) => s.status === 'live');
  if (status === 'upcoming') return allKnownStreams().filter((s) => s.status === 'upcoming');
  if (status === 'vod') return allKnownStreams().filter((s) => s.status === 'vod' || s.status === 'shorts');
  if (status === 'shorts') return allKnownStreams().filter((s) => s.status === 'shorts');
  if (status === 'playlists') return allKnownStreams().filter((s) => s.playlistId);
  return allKnownStreams();
}

export function getStreamById(id: string): YouTubeStream | undefined {
  return allKnownStreams().find((s) => s.id === id);
}

export function getStreamsByChannel(channelId: string): YouTubeStream[] {
  return allKnownStreams().filter((s) => s.channel.id === channelId);
}

export function getRelated(stream: YouTubeStream): YouTubeStream[] {
  const pool = allKnownStreams();
  const fromPool = pool.filter(
    (s) => s.id !== stream.id && (s.category === stream.category || s.channel.id === stream.channel.id)
  );
  return fromPool.length > 0 ? fromPool.slice(0, 6) : pool.filter((s) => s.id !== stream.id).slice(0, 6);
}

export function getPlaylistsFor(stream: YouTubeStream): YouTubePlaylist[] {
  return YOUTUBE_PLAYLISTS.filter((p) => p.streamIds.includes(stream.id));
}

// Simulated live viewer drift
export function driftViewers(base: number): number {
  const jitter = Math.floor((Math.random() - 0.45) * base * 0.04);
  return Math.max(100, base + jitter);
}

// ── NewPipeExtractor engine (real YouTube data) ──────────────────────────────

const YOUTUBE_BACKEND = '/api/youtube';
const _cache: Record<string, { data: unknown; ts: number }> = {};
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes (matches Java server)

async function cachedFetch<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  if (_cache[key] && now - _cache[key].ts < CACHE_TTL) {
    return _cache[key].data as T;
  }
  const data = await fn();
  _cache[key] = { data, ts: now };
  return data;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // NewPipeExtractor returns errors as HTTP 200 with { error: "..." }
  if (json && typeof json === 'object' && 'error' in json && json.error) {
    throw new Error(String(json.error));
  }
  return json as T;
}

export interface EngineStreamData {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  uploadDate?: string;
  category?: string;
  tags: string[];
  thumbnails: Array<{ url: string; width: number; height: number }>;
  hlsUrl: string;
  dashMpdUrl: string;
  streamType: string;
  contentAvailability: string;
  status: string;
  embedUrl: string;
  url: string;
  channel: { id: string; name: string; verified: boolean; subscriberCount: number; avatars: Array<{ url: string }> };
  isShortFormContent: boolean;
  // Search-item / channel-item fields (alternate shape)
  uploaderName?: string;
  uploaderUrl?: string;
  uploaderAvatars?: Array<{ url: string }>;
  uploaderSubscriberCount?: number;
  videoId?: string; // extracted video ID from watch URL
}

export interface EngineChannelData {
  id: string;
  name: string;
  url: string;
  description: string;
  verified: boolean;
  subscriberCount: number;
  avatars: Array<{ url: string }>;
  banners?: Array<{ url: string }>;
  thumbnails: Array<{ url: string }>;
  videos: EngineStreamData[];
}

export interface EnginePlaylistData {
  id: string;
  title: string;
  description: string;
  videoCount: number;
  thumbnails: Array<{ url: string }>;
  uploaderName: string;
  uploaderUrl: string;
  items: EngineStreamData[];
}

export interface EngineComment {
  id: string;
  text: string;
  authorName: string;
  authorUrl: string;
  authorAvatar: Array<{ url: string }>;
  publishedAt: string;
  likeCount: number;
  replyCount: number;
  isLikedByUploader: boolean;
}

export async function engineFetchStream(videoId: string): Promise<EngineStreamData> {
  return cachedFetch(`stream:${videoId}`, () =>
    fetchJson<EngineStreamData>(`${YOUTUBE_BACKEND}/stream?id=${encodeURIComponent(videoId)}`)
  );
}

export async function engineFetchChannel(channelId: string): Promise<EngineChannelData> {
  return cachedFetch(`channel:${channelId}`, () =>
    fetchJson<EngineChannelData>(`${YOUTUBE_BACKEND}/channel?id=${encodeURIComponent(channelId)}`)
  );
}

export async function engineFetchChannelByHandle(handle: string): Promise<EngineChannelData> {
  return cachedFetch(`channel:${handle}`, () =>
    fetchJson<EngineChannelData>(`${YOUTUBE_BACKEND}/channel?id=${encodeURIComponent(handle)}`)
  );
}

/** Fetch a channel's recent videos as YouTubeStream objects. */
export async function fetchChannelVideos(
  handle: string,
  limit = 12
): Promise<YouTubeStream[]> {
  try {
    // Normalize: ensure leading @ for handle URLs
    const normalized = handle.startsWith('@') ? handle : `@${handle}`;
    const res = await cachedFetch(`channel-videos:${normalized}:${limit}`, () =>
      fetchJson<EngineChannelData>(`${YOUTUBE_BACKEND}/channel?id=${encodeURIComponent(normalized)}`)
    );
    const items = (res.videos || []).slice(0, limit);
    const channel: EngineChannelData = {
      id: res.id || handle,
      name: res.name,
      url: res.url,
      description: res.description,
      verified: res.verified,
      subscriberCount: res.subscriberCount,
      avatars: res.avatars || [],
      thumbnails: res.thumbnails || [],
      videos: [],
    };
    return items.map((v) => engineToStream(v as EngineStreamData, channel));
  } catch (e) {
    console.warn(`[youtube] channel videos failed for ${handle}:`, (e as Error).message);
    return [];
  }
}

/** Build a SavedChannel entry from a known profile (used when saving a channel). */
export function savedChannelFromProfile(profile: {
  handle: string;
  name: string;
  subscribers: string;
  avatar: string;
  verified: boolean;
}): SavedChannel {
  return {
    handle: profile.handle,
    name: profile.name,
    subscribers: profile.subscribers,
    avatar: profile.avatar,
    verified: profile.verified,
    savedAt: Date.now(),
  };
}

export function profileToSavedChannel(ch: YouTubeChannel): SavedChannel {
  return {
    handle: ch.youtubeChannelId || ch.id,
    name: ch.name,
    subscribers: ch.subscribers,
    avatar: ch.avatar,
    verified: ch.verified,
    savedAt: Date.now(),
  };
}

export async function engineFetchPlaylist(playlistId: string): Promise<EnginePlaylistData> {
  return cachedFetch(`playlist:${playlistId}`, () =>
    fetchJson<EnginePlaylistData>(`${YOUTUBE_BACKEND}/playlist?id=${encodeURIComponent(playlistId)}`)
  );
}

export async function engineSearch(query: string, limit = 10): Promise<{ query: string; results: EngineStreamData[]; error?: string }> {
  return cachedFetch(`search:${query}:${limit}`, () =>
    fetchJson(`${YOUTUBE_BACKEND}/search?q=${encodeURIComponent(query)}&limit=${limit}`)
  );
}

export async function engineTrending(): Promise<{ kiosk: string; items: EngineStreamData[] }> {
  return cachedFetch('trending', () =>
    fetchJson(`${YOUTUBE_BACKEND}/trending`)
  );
}

export async function engineLive(): Promise<{ kiosk: string; items: EngineStreamData[] }> {
  return cachedFetch('live', () =>
    fetchJson(`${YOUTUBE_BACKEND}/live`)
  );
}

export async function engineComments(videoId: string, limit = 20): Promise<EngineComment[]> {
  return cachedFetch(`comments:${videoId}`, () =>
    fetchJson<{ comments: EngineComment[] }>(`${YOUTUBE_BACKEND}/comments?id=${encodeURIComponent(videoId)}&limit=${limit}`)
      .then(r => r.comments)
  );
}

/** Extract a YouTube video ID from a watch URL, ID, or handle. */
export function parseVideoId(s: string): string {
  if (!s) return '';
  if (/^https?:\/\//.test(s)) {
    try {
      const u = new URL(s);
      if (u.hostname === 'youtu.be') return u.pathname.split('/')[0] || '';
      const v = u.searchParams.get('v');
      if (v) return v;
      const parts = u.pathname.split('/');
      if (parts.length >= 2 && parts[1] === 'watch') return parts[parts.length - 1];
    } catch { /* fall through */ }
    const m = s.match(/[?&]v=([\w-]{6,})/);
    if (m) return m[1];
  }
  return s;
}

/** Convert an engine stream to the UI's YouTubeStream shape. */
export function engineToStream(data: EngineStreamData, channel?: EngineChannelData): YouTubeStream {
  const thumb = data.thumbnails?.[data.thumbnails.length - 1]?.url || data.thumbnails?.[0]?.url || '';
  // Prefer real YouTube channel avatar when available
  const avatar = channel?.avatars?.[channel.avatars.length - 1]?.url
    || channel?.avatars?.[0]?.url
    || data.channel?.avatars?.[data.channel.avatars.length - 1]?.url
    || data.channel?.avatars?.[0]?.url
    || data.uploaderAvatars?.[data.uploaderAvatars.length - 1]?.url
    || data.uploaderAvatars?.[0]?.url
    || '';
  const vid = parseVideoId(data.videoId || data.id);

  // Extract a clean channel handle/ID from uploaderUrl (e.g. https://www.youtube.com/@ufc or https://www.youtube.com/channel/UC...)
  const cleanChannelId = (() => {
    const url = data.uploaderUrl || '';
    if (!url) return undefined;
    const handleMatch = url.match(/\/@([A-Za-z0-9_.-]+)/);
    if (handleMatch) return `@${handleMatch[1]}`;
    const channelMatch = url.match(/\/channel\/([A-Za-z0-9_-]+)/);
    if (channelMatch) return channelMatch[1];
    return url; // fall back to raw value
  })();

  const chId = channel?.id || data.channel?.id || cleanChannelId || '';
  return {
    id: vid,
    title: data.title,
    description: data.description || '',
    thumbnail: thumb,
    channel: {
      id: chId,
      name: channel?.name || data.channel?.name || data.uploaderName || '',
      avatar,
      subscribers: formatSubscriberCount(channel?.subscriberCount || data.channel?.subscriberCount || data.uploaderSubscriberCount || 0),
      verified: channel?.verified || data.channel?.verified || false,
      bio: channel?.description || '',
      youtubeChannelId: cleanChannelId || (chId.startsWith('UC') ? chId : undefined),
      socialLinks: undefined,
    },
    status: data.status as YouTubeStream['status'],
    category: data.category || 'General',
    tags: data.tags || [],
    viewers: data.status === 'live' ? data.viewCount : undefined,
    durationSeconds: data.durationSeconds,
    chapters: [],
    embedUrl: data.embedUrl || `https://www.youtube.com/embed/${vid}`,
    isMemberOnly: data.contentAvailability === 'MEMBERSHIP',
  };
}

/** Load all streams from the engine (live + trending), enriching with real channel avatars. */
export async function loadEngineStreams(): Promise<YouTubeStream[]> {
  const channelById = new Map<string, YouTubeChannel>(
    CHANNELS.map((c) => [c.youtubeChannelId?.toLowerCase() || c.id, c])
  );

  const enrich = (stream: YouTubeStream): YouTubeStream => {
    // Normalize channel id: strip protocol+host to get just @handle or UC...
    const rawId = stream.channel.id || '';
    let cid = rawId.toLowerCase();
    // If it's a full URL, extract the handle/ID part
    if (cid.startsWith('http')) {
      const h = cid.match(/\/@([A-Za-z0-9_.-]+)/);
      if (h) cid = `@${h[1]}`.toLowerCase();
      else {
        const c = cid.match(/\/channel\/([A-Za-z0-9_-]+)/);
        if (c) cid = c[1].toLowerCase();
      }
    }
    const cat = channelById.get(cid);
    if (cat) {
      return {
        ...stream,
        channel: {
          ...stream.channel,
          avatar: cat.avatar,
          subscribers: cat.subscribers,
          verified: cat.verified,
          bio: cat.bio,
          youtubeChannelId: cat.youtubeChannelId,
          socialLinks: cat.socialLinks,
        },
      };
    }
    return stream;
  };

  const tryFetch = async (
    fn: () => Promise<{ items: EngineStreamData[] }>,
    label: string
  ): Promise<EngineStreamData[]> => {
    try {
      const r = await fn();
      return r.items || [];
    } catch (e) {
      console.warn(`[youtube] ${label} failed:`, (e as Error).message);
      return [];
    }
  };

  try {
    const [liveItems, trendingItems] = await Promise.all([
      tryFetch(engineLive, 'live'),
      tryFetch(engineTrending, 'trending'),
    ]);

    const seen = new Set<string>();
    const streams: YouTubeStream[] = [];
    const add = (data: EngineStreamData) => {
      if (!data || seen.has(data.id)) return;
      seen.add(data.id);
      streams.push(enrich(engineToStream(data)));
    };
    for (const s of liveItems) add(s);
    for (const s of trendingItems) add(s);

    if (streams.length === 0) return YOUTUBE_STREAMS; // fallback to mock catalog
    setEnginePool(streams);
    return streams;
  } catch (e) {
    console.warn('[youtube] engine load failed:', (e as Error).message);
    return YOUTUBE_STREAMS; // fallback to mock catalog
  }
}
