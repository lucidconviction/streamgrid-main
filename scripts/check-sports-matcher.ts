/**
 * Ad-hoc check: does the TV guide resolve each fixture to a real channel?
 * Run with: npx tsx scripts/check-sports-matcher.ts
 */
import { existsSync, readFileSync } from 'fs';
import { resolveChannelForMatch } from '../src/services/sportsChannelService';
import type { StreamItem } from '../src/types/stream';

const BINTV_URL = 'https://bintvjson.lovable.app/api/public/bintvjson';
const CACHE = '/tmp/opencode/bintv.json';

async function loadFeed(): Promise<any> {
  if (existsSync(CACHE)) {
    return JSON.parse(readFileSync(CACHE, 'utf-8'));
  }
  const res = await fetch(BINTV_URL);
  if (!res.ok) throw new Error(`BinTV feed failed: ${res.status}`);
  return res.json();
}

const raw = await loadFeed();

// Mirror streamService's bintv mapping closely enough for matching.
const channels: StreamItem[] = [];
for (const ch of raw['24/7 Channels'] || []) {
  const first = ch.streams?.[0];
  channels.push({
    id: ch.id || `bintv-ch-${ch.name}`,
    title: `${ch.name} Live`,
    name: ch.name,
    category: '24/7 Channels',
    status: '24/7',
    provider: 'bintv',
    popular: /espn|hbo|abc|bbc|sky|bein|tnt|amc|cbs|nbc|fox/i.test(ch.name || ''),
    directEmbedUrl: first?.url || '',
    streams: (ch.streams || []).map((s: any, i: number) => ({
      streamNo: i + 1,
      name: s.name,
      embedUrl: s.url,
      hd: true,
    })),
  });
}
for (const ev of [...(raw['Live Events'] || []), ...(raw['Upcoming Events'] || [])]) {
  const first = ev.streams?.[0];
  channels.push({
    id: ev.id || `bintv-ev-${ev.name}`,
    title: ev.name,
    name: ev.name,
    category: ev.category || 'Live Sports',
    status: 'live',
    provider: 'bintv',
    popular: true,
    directEmbedUrl: first?.url || '',
    streams: (ev.streams || []).map((s: any, i: number) => ({
      streamNo: i + 1,
      name: s.name,
      embedUrl: s.url,
      hd: true,
    })),
  });
}

const matches = [
  { id: '1', league: 'Premier League', home: 'Arsenal', away: 'Liverpool' },
  { id: '2', league: 'La Liga', home: 'Real Madrid', away: 'Barcelona' },
  { id: '3', league: 'NBA', home: 'Phoenix Suns', away: 'Golden State Warriors' },
  { id: '4', league: 'Serie A', home: 'Juventus', away: 'Inter Milan' },
  { id: '5', league: 'Champions League', home: 'Bayern Munich', away: 'Paris Saint-Germain' },
  { id: '6', league: 'UFC', home: 'Conor McGregor', away: 'Dustin Poirier' },
  { id: '7', league: 'Premier League', home: 'Chelsea', away: 'Tottenham' },
  { id: '8', league: 'La Liga', home: 'Sevilla', away: 'Valencia' },
  { id: '9', league: 'Bundesliga', home: 'Dortmund', away: 'RB Leipzig' },
  { id: '10', league: 'NBA', home: 'Boston Celtics', away: 'Miami Heat' },
  { id: '11', league: 'NFL', home: 'Kansas City Chiefs', away: 'Buffalo Bills' },
  { id: '12', league: 'MLB', home: 'Los Angeles Dodgers', away: 'San Francisco Giants' },
  { id: '13', league: 'F1', home: 'Max Verstappen', away: 'Lewis Hamilton' },
  { id: '14', league: 'Cricket', home: 'India', away: 'Australia' },
  { id: '15', league: 'Tennis', home: 'Roger Federer', away: 'Rafael Nadal' },
  { id: '16', league: 'Some Unknown League', home: 'Team A', away: 'Team B' },
];

for (const m of matches) {
  const r = resolveChannelForMatch(m, channels);
  console.log(
    `${m.league.padEnd(20)} ${(m.home + ' vs ' + m.away).padEnd(38)} -> ` +
      (r ? `${r.channel.title}  [${r.basis} ${r.score}]` : 'NO MATCH')
  );
}
