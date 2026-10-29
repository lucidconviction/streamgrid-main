/**
 * AI Service — routes through the local FreeLLM API gateway (Vite dev proxy
 * `/api/ai` → http://127.0.0.1:3001/v1/messages). The API key stays in the
 * dev-server middleware (vite.plugins.ts) and never ships to the browser.
 */

export interface MatchRow {
  id: string;
  time: string; // 'LIVE' | 'FT' | 'HH:MM'
  league: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'live' | 'upcoming' | 'finished';
  minute?: string; // "67'"
  quarter?: string; // "Q4 2:14"
}

export interface SportsFeed {
  matches: MatchRow[];
  insight: string;
  updatedAt: number;
}

interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResult {
  text: string | null;
  /** True when the gateway answered but the reply was empty or truncated. */
  retryable: boolean;
}

async function chatOnce(
  system: string,
  user: string,
  maxTokens: number,
  temperature: number
): Promise<ChatResult> {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system,
        messages: [{ role: 'user', content: user } as AiMessage],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.error?.message) detail = body.error.message;
        else if (typeof body?.error === 'string') detail = body.error;
      } catch {
        /* non-JSON error body — keep the status code */
      }
      console.warn('[ai] gateway request failed:', detail);
      return { text: null, retryable: false };
    }

    const data = await res.json();
    if (!Array.isArray(data?.content)) {
      console.warn('[ai] unexpected gateway payload:', JSON.stringify(data)?.slice(0, 300));
      return { text: null, retryable: false };
    }

    const text = data.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('')
      .trim();

    if (!text) return { text: null, retryable: true };
    // `max_tokens` — the reply was cut short, a bigger budget usually completes it.
    return { text, retryable: data.stop_reason === 'max_tokens' };
  } catch (e) {
    console.warn('[ai] gateway unreachable:', e);
    return { text: null, retryable: false };
  }
}

async function rawChat(system: string, user: string, maxTokens = 1500, temperature = 0.4): Promise<string | null> {
  const first = await chatOnce(system, user, maxTokens, temperature);
  if (first.text && !first.retryable) return first.text;
  if (!first.retryable) return null;

  // The gateway occasionally answers with an empty or truncated body — retry
  // once with a more generous budget.
  const second = await chatOnce(system, user, Math.max(maxTokens * 2, 512), temperature);
  return second.text;
}

/** Strip code fences / prose and pull the first JSON object out of a model reply. */
function extractJson(text: string): any | null {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  if (start === -1) return null;

  // Walk a balanced brace scan so trailing prose after the JSON doesn't break us.
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const SCORE_TTL = 60_000; // refresh live scores every 60s
let feedCache: SportsFeed | null = null;
let inflight: Promise<SportsFeed | null> | null = null;

function isValidStatus(s: any): s is MatchRow['status'] {
  if (typeof s !== 'string') return false;
  const norm = s.toLowerCase().trim();
  return norm === 'live' || norm === 'upcoming' || norm === 'finished';
}

function normalizeStatus(s: any): MatchRow['status'] {
  if (typeof s !== 'string') return 'upcoming';
  const norm = s.toLowerCase().trim();
  if (norm === 'live') return 'live';
  if (norm === 'finished') return 'finished';
  return 'upcoming';
}

/**
 * Run a chat call and extract JSON. If extraction fails, retry once with a
 * stricter instruction — the gateway's `auto` model is a reasoning model that
 * sometimes thinks out loud before answering.
 */
async function tryChatJson(
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
  maxAttempts = 2
): Promise<any | null> {
  let lastText: string | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptSystem =
      attempt === 0
        ? system
        : 'CRITICAL: You are a JSON-only API. Output ONLY a single JSON object. ' +
          'No thinking, no reasoning, no explanation, no markdown, no code fences. ' +
          'Begin your response with { and end with }.';
    const text = await rawChat(attemptSystem, user, maxTokens, temperature);
    lastText = text;
    if (!text) continue;
    const json = extractJson(text);
    if (json) return json;
  }
  return null;
}

/**
 * Fetch today's live scores + TV guide from the LLM (cached 60s).
 * Returns null on failure so callers can fall back to local mock data.
 */
export async function fetchSportsFeed(force = false): Promise<SportsFeed | null> {
  if (!force && feedCache && Date.now() - feedCache.updatedAt < SCORE_TTL) return feedCache;
  if (inflight) return inflight;

  inflight = (async () => {
    const now = new Date();
    const system =`You are a live sports data engine for RdNutz TV Streams (rdnutztv_streams, iptv.rdnutz.us). ` +
      'Respond with the JSON object ONLY — no thinking, no reasoning, no preamble, no markdown, no code fences. ' +
      'Start your response immediately with { and end it immediately with }.';
    const user = `Today is ${now.toUTCString()}. REAL-TIME data.

Produce: 4-6 LIVE matches, 2-3 UPCOMING, 1-2 FINISHED (total 7-9 max).
Each LIVE match MUST include "minute" (e.g. "67'") for ball sports or "quarter" (e.g. "Q3 4:12") for basketball.
UPCOMING: homeScore and awayScore MUST be null.
FINISHED: include final scores.
Mix leagues: Premier League, La Liga, NBA, NFL, UFC, F1, Serie A, Bundesliga, Champions League.
Use REAL teams/fighters/drivers/players.

Output ONLY this JSON structure — no preamble, no reasoning, no markdown, no code fences:
{"insight":"string","matches":[{"id":"1","time":"LIVE","league":"Premier League","home":"Liverpool","away":"Arsenal","homeScore":2,"awayScore":1,"status":"live","minute":"73'"}}]`;

    const json = await tryChatJson(system, user, 5000, 0.3);
    if (!json || !Array.isArray(json.matches) || json.matches.length === 0) {
      inflight = null;
      return null;
    }

    const matches: MatchRow[] = json.matches
      .filter((m: any) => m && typeof m.league === 'string' && typeof m.home === 'string' && typeof m.away === 'string')
      .map((m: any, i: number): MatchRow => {
        const status = normalizeStatus(m.status);
        // Derive time from status as a fallback so live/finished rows always show the right badge
        const fallbackTime = status === 'live' ? 'LIVE' : status === 'finished' ? 'FT' : 'TBD';
        return {
          id: String(m.id ?? `ai-${i + 1}`),
          time: String(m.time ?? fallbackTime),
          league: String(m.league),
          home: String(m.home),
          away: String(m.away),
          homeScore: typeof m.homeScore === 'number' && Number.isFinite(m.homeScore) ? m.homeScore : null,
          awayScore: typeof m.awayScore === 'number' && Number.isFinite(m.awayScore) ? m.awayScore : null,
          status,
          minute: typeof m.minute === 'string' ? m.minute : undefined,
          quarter: typeof m.quarter === 'string' ? m.quarter : undefined,
        };
      });

    if (matches.length === 0) {
      inflight = null;
      return null;
    }

    feedCache = {
      matches,
      insight: typeof json.insight === 'string' ? json.insight : '',
      updatedAt: Date.now(),
    };
    inflight = null;
    return feedCache;
  })();

  return inflight;
}

/** Generic one-shot AI question — returns the raw text answer or null on failure. */
export async function askAI(question: string, maxTokens = 400): Promise<string | null> {
  return rawChat(
    'You are a helpful, concise assistant embedded in RdNutz TV Streams (rdnutztv_streams, iptv.rdnutz.us). Answer briefly in plain text.',
    question,
    maxTokens,
    0.6
  );
}

// ── Natural-language channel search (full-catalog aware) ────────────

export interface AiChannelSuggestion {
  title: string;
  country?: string;
  genre?: string;
  reason: string;
}

export interface ChannelRef {
  title: string;
  iptvCountry?: string;
  iptvGenre?: string;
  category?: string;
  provider?: string;
}

interface AiSearchResponse {
  matches: AiChannelSuggestion[];
  explanation: string;
}

const SEARCH_TTL = 10_000; // 10s cache for search results
let searchCache: { key: string; data: AiSearchResponse; ts: number } | null = null;
// The in-flight request is tracked *with its key* — a second, different query
// must not be handed the first query's results.
let searchInflight: { key: string; promise: Promise<AiSearchResponse | null> } | null = null;

// ── Local pre-filter: rank the ENTIRE catalog against the query (no LLM) ────

const STOPWORDS = new Set([
  'the', 'a', 'an', 'me', 'my', 'find', 'show', 'some', 'on', 'in', 'for', 'with',
  'that', 'this', 'what', 'which', 'any', 'i', 'am', 'is', 'are', 'do', 'you',
  'please', 'channel', 'channels', 'tv', 'live', 'now', 'right', 'playing',
  'watch', 'watching', 'stream', 'streaming', 'content', 'give', 'want', 'like',
  'good', 'best', 'of', 'and', 'or',
]);

const QUERY_SYNONYMS: Record<string, string[]> = {
  spanish: ['es', 'esp', 'espana', 'espanol', 'latino', 'deportes'],
  english: ['en', 'eng', 'usa', 'uk'],
  french: ['fr', 'france', 'francais'],
  german: ['de', 'germany', 'deutsch'],
  italian: ['it', 'italy', 'italiano'],
  portuguese: ['pt', 'brazil', 'brasil', 'portugal', 'esportes'],
  arabic: ['arab', 'arabia', 'msa'],
  russian: ['ru', 'russia'],
  turkish: ['tr', 'turkey', 'turk'],
  hindi: ['india'],
  basketball: ['nba', 'hoops'],
  soccer: ['football', 'premier league', 'champions league', 'ucl', 'laliga', 'bundesliga'],
  football: ['soccer', 'premier league', 'epl'],
  kids: ['cartoons', 'cartoon', 'nick', 'nickelodeon', 'disney', 'children', 'junior', 'toon'],
  cartoons: ['cartoon', 'nick', 'disney', 'kids', 'toon', 'junior'],
  movie: ['movies', 'film', 'cinema'],
  movies: ['movie', 'film', 'cinema'],
  news: ['cnn', 'msnbc', 'sky news', 'al jazeera'],
  music: ['mtv', 'vh1', 'concerts'],
  wrestling: ['wwe', 'aew', 'tna'],
  boxing: ['ufc', 'mma', 'combat'],
  racing: ['formula', 'nascar', 'indycar'],
  sports: ['espn', 'dazn', 'bein', 'sky sports', 'sportsnet'],
  comedy: ['comedy central', 'tbs'],
  cricket: ['willow'],
  golf: ['pga'],
  tennis: ['atp', 'wta'],
  anime: ['animation'],
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Tokenize + expand a natural-language query into search tokens. */
function expandQuery(q: string): string[] {
  const raw = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const tokens = new Set<string>();
  for (const t of raw) {
    if (STOPWORDS.has(t)) continue;
    tokens.add(t);
    for (const syn of QUERY_SYNONYMS[t] || []) tokens.add(syn);
  }
  return Array.from(tokens);
}

/**
 * Pre-compiled matcher for a single query token.
 *
 * The catalog holds tens of thousands of channels, so the regex used to test a
 * token is compiled once per query instead of once per channel × token.
 */
interface TokenMatcher {
  /** Fast path: does the token appear anywhere in the channel blob? */
  re: RegExp | null;
  needle: string | null;
  test: (hay: string) => boolean;
}

function compileToken(token: string): TokenMatcher {
  if (token.includes(' ')) {
    const needle = token.toLowerCase();
    return {
      re: null,
      needle,
      test: (hay) => hay.includes(needle),
    };
  }
  const re = new RegExp(`\\b${escapeRegex(token)}\\b`, 'i');
  return {
    re,
    needle: null,
    test: (hay) => re.test(hay),
  };
}

/**
 * Score EVERY channel in the catalog against the query tokens and return the
 * top `poolSize` (quality variants of the same channel deduped to 2 each).
 * If the query matches nothing, fall back to a stratified sample so the LLM
 * still gets representative channels.
 */
function rankCatalog(
  channels: ChannelRef[],
  query: string,
  poolSize = 50
): ChannelRef[] {
  const tokens = expandQuery(query);
  const matchers = tokens.map(compileToken);

  interface Scored { ref: ChannelRef; score: number }
  const hits: Scored[] = [];

  for (let i = 0; i < channels.length; i++) {
    const ref = channels[i];
    const title = (ref.title || '').toLowerCase();
    const country = (ref.iptvCountry || '').toLowerCase();
    const genre = (ref.iptvGenre || '').toLowerCase();
    const category = (ref.category || '').toLowerCase();
    const provider = (ref.provider || '').toLowerCase();
    const blob = `${title} ${country} ${genre} ${category} ${provider}`;

    let score = 0;
    for (let t = 0; t < matchers.length; t++) {
      const m = matchers[t];
      // Fast reject — only channels that mention the token at all are scored
      // field-by-field.
      const mentioned = m.re ? m.re.test(blob) : blob.includes(m.needle!);
      if (!mentioned) continue;
      if (m.test(title)) score += 5;
      if (m.test(country) || m.test(genre)) score += 4;
      if (m.test(category) || m.test(provider)) score += 3;
    }
    if (score > 0) hits.push({ ref, score });
  }

  hits.sort((a, b) => b.score - a.score);

  const seen = new Map<string, number>();
  const pool: ChannelRef[] = [];
  for (const { ref } of hits) {
    const base = (ref.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/(hd|fhd|uhd|4k|sd)$/, '');
    const count = seen.get(base) || 0;
    if (count >= 2) continue;
    seen.set(base, count + 1);
    pool.push(ref);
    if (pool.length >= poolSize) break;
  }

  // Fallback: query matched nothing — give the LLM a stratified sample instead
  if (pool.length < 8) {
    const byGenre = new Map<string, ChannelRef[]>();
    for (const ref of channels) {
      const key = ref.iptvGenre || ref.provider || 'general';
      if (!byGenre.has(key)) byGenre.set(key, []);
      const list = byGenre.get(key)!;
      if (list.length < 6) list.push(ref);
    }
    for (const list of byGenre.values()) {
      for (const ref of list) {
        if (!pool.some((p) => p.title === ref.title)) pool.push(ref);
        if (pool.length >= poolSize) break;
      }
      if (pool.length >= poolSize) break;
    }
  }

  return pool;
}

/** One-paragraph digest of the whole catalog so the LLM knows the site's scope. */
function buildCatalogSummary(channels: ChannelRef[]): string {
  const genres: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const providers: Record<string, number> = {};
  for (const c of channels) {
    const g = c.iptvGenre || c.category || c.provider || 'general';
    genres[g] = (genres[g] || 0) + 1;
    if (c.iptvCountry) countries[c.iptvCountry] = (countries[c.iptvCountry] || 0) + 1;
    if (c.provider) providers[c.provider] = (providers[c.provider] || 0) + 1;
  }
  const top = (obj: Record<string, number>, n: number) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => `${k} (${v})`)
      .join(', ');
  return (
    `Full catalog: ${channels.length} channels across the site. ` +
    `Genres: ${top(genres, 8)}. Top regions: ${top(countries, 8)}. ` +
    `Sources: ${top(providers, 6)}.`
  );
}

/**
 * Natural-language search over ALL site streams. A local pre-filter ranks the
 * entire catalog; the LLM re-ranks the top candidates with real intent
 * understanding. Returns matches with a short explanation.
 */
export async function aiSearchChannels(
  query: string,
  available: ChannelRef[],
  limit = 8
): Promise<AiSearchResponse | null> {
  const q = query.trim();
  if (!q || available.length === 0) return null;

  const cacheKey = `${q.toLowerCase()}|${limit}|${available.length}`;
  if (searchCache && searchCache.key === cacheKey && Date.now() - searchCache.ts < SEARCH_TTL) {
    return searchCache.data;
  }
  if (searchInflight && searchInflight.key === cacheKey) return searchInflight.promise;

  const promise = (async () => {
    const summary = buildCatalogSummary(available);
    const pool = rankCatalog(available, q, 50);
    const poolJson = JSON.stringify(
      pool.map((s) => ({
        title: s.title,
        country: s.iptvCountry || '',
        genre: s.iptvGenre || s.category || '',
        provider: s.provider || '',
      }))
    );

    const system =
      'You are a JSON API. Output ONLY a JSON object, nothing else. ' +
      'No thinking, no reasoning, no explanation, no markdown, no code fences. ' +
      'Start immediately with { and end with }.';

    const user = `${summary}

User query: "${q}"

The list below is pre-ranked by relevance (best first). Pick the top ${limit} that match the query intent. Copy "title" EXACTLY. Set "country" and "genre" from the row. Add a one-sentence "reason" (max 15 words). Use "explanation" for one short sentence (max 20 words) about what the user wants. If none match, return empty matches array.

${poolJson}

JSON: {"explanation":"...","matches":[{"title":"...","country":"...","genre":"...","reason":"..."}]}`;

    const json = await tryChatJson(system, user, 4096, 0.3);
    if (!json || !Array.isArray(json.matches)) {
      if (searchInflight?.key === cacheKey) searchInflight = null;
      return null;
    }

    const validTitles = new Set(available.map((a) => a.title.trim().toLowerCase()));
    const matches: AiChannelSuggestion[] = json.matches
      .filter((m: any) => m && typeof m.title === 'string' && validTitles.has(m.title.trim().toLowerCase()))
      .slice(0, limit)
      .map((m: any): AiChannelSuggestion => ({
        title: String(m.title),
        country: typeof m.country === 'string' && m.country ? m.country : undefined,
        genre: typeof m.genre === 'string' && m.genre ? m.genre : undefined,
        reason: typeof m.reason === 'string' ? m.reason : '',
      }));

    if (matches.length === 0) {
      if (searchInflight?.key === cacheKey) searchInflight = null;
      return null;
    }

    const data: AiSearchResponse = {
      matches,
      explanation: typeof json.explanation === 'string' ? json.explanation : '',
    };
    searchCache = { key: cacheKey, data, ts: Date.now() };
    if (searchInflight?.key === cacheKey) searchInflight = null;
    return data;
  })();

  searchInflight = { key: cacheKey, promise };
  return promise;
}

// ── Match preview / "Why watch" ─────────────────────────────────────────────

const PREVIEW_TTL = 60_000; // 1 minute
let previewCache: { key: string; data: string; ts: number } | null = null;

/**
 * Ask the LLM for a one-line "Why watch" preview for a match.
 */
export async function aiMatchPreview(
  home: string,
  away: string,
  league: string,
  status: 'live' | 'upcoming' | 'finished'
): Promise<string | null> {
  const key = `${league}|${home}|${away}|${status}`;
  if (previewCache && previewCache.key === key && Date.now() - previewCache.ts < PREVIEW_TTL) {
    return previewCache.data;
  }

    const prompt =
    status === 'live'
      ? `Live ${league} match on RdNutz TV Streams: ${home} vs ${away}. In one short sentence (max 14 words), describe the current drama — score, momentum, or what's at stake.`
      : status === 'upcoming'
      ? `Upcoming ${league} match on RdNutz TV Streams: ${home} vs ${away}. In one short sentence (max 14 words), why should a viewer care — rivalry, title implications, or star players?`
      : `Finished ${league} match on RdNutz TV Streams: ${home} vs ${away}. In one short sentence (max 14 words), summarize the result and its significance.`;

  const text = await rawChat(
    'You are a sports commentator. Be punchy and concise. One short sentence only. No emojis.',
    prompt,
    400,
    0.6
  );

  if (!text) return null;
  previewCache = { key, data: text, ts: Date.now() };
  return text;
}
