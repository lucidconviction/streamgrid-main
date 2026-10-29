import { StreamItem } from '../types/stream';
import { MatchRow } from './aiService';

/**
 * Sports channel matching.
 *
 * The EPG feed describes fixtures ("Arsenal vs Liverpool" — Premier League),
 * but the catalog holds *channels* ("Sky Sports Premier League"). This module
 * bridges the two so a "Watch" button can hand the player a real, playable
 * StreamItem instead of a placeholder object that renders an empty player.
 */

export type MatchBasis = 'teams' | 'league' | 'sports';

export interface ChannelResolution {
  channel: StreamItem;
  score: number;
  basis: MatchBasis;
}

/** A channel plus its pre-normalized searchable text. */
export interface ChannelCandidate {
  channel: StreamItem;
  text: string;
}

export type SportsChannelIndex = ChannelCandidate[];

/** League → channel-name fragments that usually carry that league (ordered by preference). */
const LEAGUE_HINTS: Array<{ pattern: RegExp; hints: string[] }> = [
  { pattern: /premier\s*league|\bepl\b/i, hints: ['premier league', 'premier sports', 'bt sport', 'sky sports'] },
  { pattern: /champions\s*league|\bucl\b/i, hints: ['champions league', 'champions', 'ucl', 'sky sports', 'dazn'] },
  { pattern: /la\s*liga|laliga/i, hints: ['la liga', 'laliga', 'movistar', 'dazn', 'calcio'] },
  { pattern: /serie\s*a\b/i, hints: ['serie a', 'calcio', 'dazn', 'premier sports'] },
  { pattern: /bundesliga/i, hints: ['bundesliga', 'dazn', 'sky sports'] },
  { pattern: /\bnba\b/i, hints: ['nba', 'espn', 'tnt'] },
  { pattern: /\bnfl\b/i, hints: ['nfl', 'fox sports', 'cbs sports', 'espn'] },
  { pattern: /\bmlb\b|baseball/i, hints: ['mlb', 'baseball', 'fs1', 'espn'] },
  { pattern: /\bnhl\b|hockey/i, hints: ['nhl', 'hockey', 'sportsnet'] },
  { pattern: /ufc|\bmma\b|boxing/i, hints: ['ufc', 'fight pass', 'espn', 'paramount'] },
  { pattern: /\bf1\b|formula|grand\s*prix/i, hints: ['f1', 'formula', 'grand prix'] },
  { pattern: /motorsport|moto\s*gp|nascar|indycar/i, hints: ['motorsport', 'moto', 'nascar', 'speedway'] },
  { pattern: /cricket/i, hints: ['cricket', 'willow', 'sony sports'] },
  { pattern: /rugby/i, hints: ['rugby', 'premier sports'] },
  { pattern: /golf/i, hints: ['golf'] },
  { pattern: /tennis/i, hints: ['tennis', 'eurosport'] },
  { pattern: /volley|handball|sepanak/i, hints: ['volley', 'handball', 'sepanak'] },
  { pattern: /world\s*cup/i, hints: ['world cup', 'sky sports', 'fox sports', 'tnt'] },
];

/** Generic sports channels used as a last resort when nothing matches the fixture. */
const SPORTS_FALLBACK_HINTS = [
  'main event',
  'espn',
  'dazn',
  'sky sports',
  'sky sport',
  'premier sports',
  'bein sports',
  'tnt sports',
  'nba tv',
  'nfl network',
  'fight pass',
  'sports',
];

/** Club-name noise that never helps identify a channel. */
const TEAM_STOPWORDS = new Set([
  'fc', 'afc', 'cf', 'sc', 'ac', 'as', 'the', 'and', 'of', 'de', 'la', 'le', 'cd', 'sd',
  'ud', 'fk', 'bk', 'if', 'ro', 'sv', 'vfl', 'vfb', 'bsc', 'us', 'ca', 'rc', 'rcd',
]);

/** Categories that mark a channel as sports content. */
const SPORTS_CATEGORIES = new Set([
  'live sports',
  'basketball',
  'football / soccer',
  'baseball',
  'motorsport / f1',
  'tennis',
  'golf',
  'combat / mma',
  'cricket',
  'ice hockey',
]);

const BOTH_TEAMS_SCORE = 120;
const ONE_TEAM_SCORE = 55;
const LEAGUE_NAME_SCORE = 60;
const LEAGUE_HINT_SCORE = 45;
const LEAGUE_HINT_STEP = 5;
const LEAGUE_MIN_ACCEPT = 25;
const SPORTS_BASE_SCORE = 12;
const LIVE_EVENT_BONUS = 10;
const CHANNEL_24_7_BONUS = 3;

/** Channels that carry the marquee feed of their sport ("Sky Sports Main Event"). */
const MAIN_CHANNEL_BONUS: Array<{ hint: string; bonus: number }> = [
  { hint: 'main event', bonus: 8 },
  { hint: 'main', bonus: 4 },
];

/** Compiled word-boundary regexes are cached — the catalog is re-scanned per row. */
const tokenRegexCache = new Map<string, RegExp>();

function tokenRegex(token: string): RegExp {
  let re = tokenRegexCache.get(token);
  if (!re) {
    re = new RegExp(`(^|\\s)${token}(\\s|$)`);
    tokenRegexCache.set(token, re);
  }
  return re;
}

/** Lowercase, strip accents and punctuation so titles can be compared loosely. */
export function normalizeSportsText(text: string | undefined): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Significant tokens of a club name ("Paris Saint-Germain" → paris, saint, germain). */
function teamTokens(team: string | undefined): string[] {
  return normalizeSportsText(team)
    .split(' ')
    .filter((t) => t.length >= 3 && !TEAM_STOPWORDS.has(t));
}

/** True when every token of the team appears in the candidate text. */
function textHasTeam(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  return tokens.every((token) =>
    token.length >= 4 ? tokenRegex(token).test(text) : text.includes(token)
  );
}

/** Score a candidate text against the league of a fixture (0 = no match). */
function leagueScore(league: string | undefined, text: string): number {
  const raw = (league || '').trim();
  if (!raw) return 0;

  const normalizedLeague = normalizeSportsText(raw);
  let best = 0;

  // The league named verbatim is the strongest possible signal.
  if (normalizedLeague.length >= 4 && text.includes(normalizedLeague)) {
    best = LEAGUE_NAME_SCORE;
  }

  const entry = LEAGUE_HINTS.find((l) => l.pattern.test(raw));
  if (entry) {
    entry.hints.forEach((hint, index) => {
      if (text.includes(hint)) {
        const score = LEAGUE_HINT_SCORE - index * LEAGUE_HINT_STEP;
        if (score > best) best = score;
      }
    });
  }

  return best;
}

/** Score a candidate text as a generic sports channel (used as the fallback tier). */
function sportsFallbackScore(text: string): number {
  for (let i = 0; i < SPORTS_FALLBACK_HINTS.length; i++) {
    if (text.includes(SPORTS_FALLBACK_HINTS[i])) return SPORTS_BASE_SCORE + i;
  }
  return 0;
}

/** Searchable text for a channel: title, name and category. */
function channelText(channel: StreamItem): string {
  return normalizeSportsText(
    [channel.title, channel.name, channel.category].filter(Boolean).join(' ')
  );
}

/** True when the channel carries sports content. */
export function isSportsChannel(channel: StreamItem): boolean {
  if (channel.iptvGenre === 'sports') return true;
  const category = (channel.category || '').toLowerCase();
  if (SPORTS_CATEGORIES.has(category)) return true;
  const text = channelText(channel);
  return SPORTS_FALLBACK_HINTS.some((hint) => text.includes(hint));
}

/** Build the searchable index once — the guide resolves a row on every render. */
export function buildSportsChannelIndex(channels: StreamItem[]): SportsChannelIndex {
  return (channels || []).map((channel) => ({ channel, text: channelText(channel) }));
}

/** Bonus for the marquee channel of a sport ("Sky Sports Main Event"). */
function mainChannelBonus(text: string): number {
  for (const { hint, bonus } of MAIN_CHANNEL_BONUS) {
    if (text.includes(hint)) return bonus;
  }
  return 0;
}

/** Prefer live channels, then HD, then the shorter (cleaner) title. */
function tieBreak(a: StreamItem, b: StreamItem): number {
  const statusRank = (s?: string) => (s === 'live' ? 0 : s === '24/7' ? 1 : 2);
  const byStatus = statusRank(a.status) - statusRank(b.status);
  if (byStatus !== 0) return byStatus;

  const hd = (s: StreamItem) => (s.streams?.some((src) => src.hd) ? 0 : 1);
  const byHd = hd(a) - hd(b);
  if (byHd !== 0) return byHd;

  const byTitle = (a.title || '').length - (b.title || '').length;
  if (byTitle !== 0) return byTitle;

  return (a.id || '').localeCompare(b.id || '');
}

/**
 * Find the best channel for a fixture.
 *
 * Priority: both team names → one team name → league → any sports channel.
 * Returns null when the catalog holds nothing worth showing.
 */
export function resolveChannelForMatch(
  match: Pick<MatchRow, 'league' | 'home' | 'away'>,
  channels: StreamItem[]
): ChannelResolution | null {
  return resolveChannelForIndex(match, buildSportsChannelIndex(channels));
}

/** Same as {@link resolveChannelForMatch} but reuses a pre-built index. */
export function resolveChannelForIndex(
  match: Pick<MatchRow, 'league' | 'home' | 'away'>,
  index: SportsChannelIndex
): ChannelResolution | null {
  if (!index || index.length === 0) return null;

  const homeTokens = teamTokens(match.home);
  const awayTokens = teamTokens(match.away);

  let best: ChannelResolution | null = null;

  for (const { channel, text } of index) {
    if (!text) continue;

    let score = 0;
    let basis: MatchBasis = 'sports';

    const homeHit = textHasTeam(text, homeTokens);
    const awayHit = textHasTeam(text, awayTokens);
    if (homeHit && awayHit) {
      score += BOTH_TEAMS_SCORE;
      basis = 'teams';
    } else if (homeHit || awayHit) {
      score += ONE_TEAM_SCORE;
      basis = 'teams';
    }

    const league = leagueScore(match.league, text);
    if (league > 0) {
      score += league;
      if (basis !== 'teams') basis = 'league';
    }

    if (score === 0) {
      const fallback = sportsFallbackScore(text);
      if (fallback === 0) continue;
      score += fallback;
      basis = 'sports';
    }

    // A real live event is the best possible target for a fixture.
    if (channel.status === 'live') score += LIVE_EVENT_BONUS;
    else if (channel.status === '24/7') score += CHANNEL_24_7_BONUS;
    score += mainChannelBonus(text);

    if (!best || score > best.score || (score === best.score && tieBreak(channel, best.channel) < 0)) {
      best = { channel, score, basis };
    }
  }

  if (!best) return null;

  // League hints always score at or above the floor, so anything weaker is noise.
  if (best.basis === 'league' && best.score < LEAGUE_MIN_ACCEPT) return null;

  return best;
}

/** Human readable explanation of why a channel was picked (used in tooltips). */
export function describeResolution(resolution: ChannelResolution | null): string {
  if (!resolution) return 'No live channel available for this match';
  return `Watch on ${resolution.channel.title}`;
}
