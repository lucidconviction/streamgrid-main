/**
 * Sports Replays backend proxy (see sports-replays-api.md "Backend Integration").
 *
 * Serves Highlightly highlights behind the app's own origin so the API key
 * never reaches the browser:
 *
 *   GET /api/replays/:hlSport?date=YYYY-MM-DD&limit=20
 *     → proxies https://sports.highlightly.net/{hlSport}/highlights
 *       with x-rapidapi-key from HIGHLIGHTLY_KEY (env / .env.local).
 *     Returns the upstream JSON ({ data: [...], pagination, plan }) or
 *     { data: [], note } when no key is configured / upstream fails.
 *
 *   GET /api/replays/today?sports=nba,nfl
 *     → all-sports feed: for each sport, the top 5 highlights for today.
 *
 * The frontend (src/services/replaysService.ts) calls these; when no key is
 * set it transparently falls back to the keyless YouTube search layer.
 */
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const HIGHLIGHTLY_BASE = 'https://sports.highlightly.net';

// Allowed Highlightly sport paths — anything else is rejected so this can't
// be turned into an open proxy.
const ALLOWED_HL_SPORTS = new Set([
  'american-football',
  'basketball',
  'baseball',
  'nhl',
  'football',
  'martial-arts',
  'cricket',
  'rugby',
  'handball',
  'volleyball',
]);

// Sport id → Highlightly sport path (doc §Backend Integration).
const SPORT_TO_HL: Record<string, string> = {
  nfl: 'american-football',
  ncaaf: 'american-football',
  nba: 'basketball',
  ncaab: 'basketball',
  nhl: 'nhl',
  mlb: 'baseball',
  soccer: 'football',
  ufc: 'martial-arts',
  cricket: 'cricket',
};

function readEnvValue(file: string, key: string): string {
  try {
    const text = readFileSync(file, 'utf8');
    const match = text.match(new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=\\s*(.+)$`, 'm'));
    if (!match) return '';
    return match[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    return '';
  }
}

function resolveHighlightlyKey(): string {
  return (
    process.env.HIGHLIGHTLY_KEY ||
    readEnvValue(resolve(process.cwd(), '.env.local'), 'HIGHLIGHTLY_KEY') ||
    ''
  );
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(body));
}

export function replaysPlugin(): Plugin {
  return {
    name: 'replays-proxy',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = new URL(req.url || '', 'http://localhost');

        // ── GET /api/replays/today?sports=nba,nfl ─────────────────────────
        if (url.pathname === '/api/replays/today') {
          const key = resolveHighlightlyKey();
          const date = new Date().toISOString().slice(0, 10);
          const sportIds = (url.searchParams.get('sports') || 'nba,nfl,nhl,mlb,soccer,ufc')
            .split(',')
            .map((s) => s.trim())
            .filter((s) => SPORT_TO_HL[s]);

          if (!key) {
            json(res, 200, {
              date,
              results: {},
              note: 'Set HIGHLIGHTLY_KEY in .env.local for replay data. Use YouTube fallback for now.',
            });
            return;
          }

          const results: Record<string, any[]> = {};
          await Promise.allSettled(
            sportIds.map(async (sport) => {
              const hlSport = SPORT_TO_HL[sport];
              try {
                const upstream = await fetch(
                  `${HIGHLIGHTLY_BASE}/${hlSport}/highlights?date=${date}&limit=10`,
                  { headers: { 'x-rapidapi-key': key }, signal: AbortSignal.timeout(8000) },
                );
                const data = await upstream.json();
                results[sport] = (data.data || [])
                  .slice(0, 5)
                  .map((h: any) => ({
                    id: h.id,
                    title: h.title,
                    embedUrl: h.embedUrl,
                    url: h.url,
                    thumbnail: h.imgUrl,
                    category: h.category,
                    home: h.match?.homeTeam?.displayName || '',
                    away: h.match?.awayTeam?.displayName || '',
                    score: h.match?.state?.score?.current || '',
                  }));
              } catch {
                /* skip sport */
              }
            }),
          );

          json(res, 200, { date, results });
          return;
        }

        // ── GET /api/replays/:hlSport?date=YYYY-MM-DD&limit=20 ────────────
        const m = url.pathname.match(/^\/api\/replays\/([a-z-]+)$/);
        if (!m) return next();

        // Accept either the sport id ('nba') or the raw Highlightly path ('basketball').
        const raw = m[1];
        const hlSport = ALLOWED_HL_SPORTS.has(raw) ? raw : SPORT_TO_HL[raw];
        if (!hlSport || !ALLOWED_HL_SPORTS.has(hlSport)) {
          json(res, 404, { error: 'Unknown sport' });
          return;
        }

        const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 40);
        const key = resolveHighlightlyKey();

        if (!key) {
          json(res, 200, {
            date,
            data: [],
            note: 'Set HIGHLIGHTLY_KEY in .env.local for replay data. Use YouTube fallback for now.',
          });
          return;
        }

        try {
          const upstream = await fetch(
            `${HIGHLIGHTLY_BASE}/${hlSport}/highlights?date=${date}&limit=${limit}`,
            { headers: { 'x-rapidapi-key': key }, signal: AbortSignal.timeout(10000) },
          );
          const data = await upstream.json();
          const highlights = (data.data || []).map((h: any) => ({
            id: h.id,
            title: h.title,
            description: h.description,
            url: h.url,
            embedUrl: h.embedUrl,
            thumbnail: h.imgUrl,
            source: h.source,
            channel: h.channel,
            category: h.category,
            home: h.match?.homeTeam?.displayName || '',
            away: h.match?.awayTeam?.displayName || '',
            score: h.match?.state?.score?.current || '',
            date: h.match?.date || date,
          }));
          json(res, 200, {
            date,
            sport: raw,
            highlights,
            total: data.pagination?.totalCount,
            data: data.data || [],
          });
        } catch (e: any) {
          json(res, 200, {
            date,
            data: [],
            error: 'Highlightly unavailable',
            note: e?.message || 'upstream error',
          });
        }
      });
    },
  };
}
