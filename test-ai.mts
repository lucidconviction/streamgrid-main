/**
 * Exercises the real src/services/aiService.ts against the running dev server
 * (which proxies to the FreeLLMAPI gateway).
 */
import { aiSearchChannels, askAI, fetchSportsFeed, aiMatchPreview } from './src/services/aiService';

const BASE = 'http://localhost:4207';
const realFetch = globalThis.fetch;

(globalThis as any).fetch = (input: any, init?: any) => {
  const url = typeof input === 'string' && input.startsWith('/') ? BASE + input : input;
  return realFetch(url, init);
};

// Build a catalog that mirrors what the app hands over (IPTV channels).
const catalog = [
  { title: 'ESPN HD', iptvCountry: 'US', iptvGenre: 'Live Sports', category: 'Sports', provider: 'iptv' },
  { title: 'ESPN 2', iptvCountry: 'US', iptvGenre: 'Live Sports', category: 'Sports', provider: 'iptv' },
  { title: 'Sky Sports Main Event', iptvCountry: 'UK', iptvGenre: 'Live Sports', category: 'Sports', provider: 'iptv' },
  { title: 'La Liga TV', iptvCountry: 'ES', iptvGenre: 'Live Sports', category: 'Sports', provider: 'iptv' },
  { title: 'CNN International', iptvCountry: 'US', iptvGenre: 'News & Documentaries', category: 'News', provider: 'iptv' },
  { title: 'Cartoon Network', iptvCountry: 'US', iptvGenre: 'Kids', category: 'Entertainment', provider: 'iptv' },
  { title: 'Nickelodeon', iptvCountry: 'US', iptvGenre: 'Kids', category: 'Entertainment', provider: 'iptv' },
  { title: 'HBO Max Movies', iptvCountry: 'US', iptvGenre: 'Entertainment & Movies', category: 'Movies', provider: 'iptv' },
  { title: 'AMC HD', iptvCountry: 'US', iptvGenre: 'Entertainment & Movies', category: 'Movies', provider: 'iptv' },
  { title: 'BeIN Sports 1', iptvCountry: 'QA', iptvGenre: 'Live Sports', category: 'Sports', provider: 'iptv' },
];

async function step(name: string, fn: () => Promise<any>) {
  const t0 = Date.now();
  try {
    const out = await fn();
    console.log(`\n=== ${name} (${Date.now() - t0}ms) ===`);
    console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2).slice(0, 1400));
    if (out === null || out === undefined) console.log('!! returned null');
  } catch (e: any) {
    console.log(`\n=== ${name} FAILED after ${Date.now() - t0}ms ===`);
    console.log(e?.message || e);
  }
}

await step('askAI (conversational)', () => askAI('What should I watch for a movie night?', 500));
await step('aiSearchChannels (sports query)', () =>
  aiSearchChannels('find live sports channels', catalog, 5)
);
await step('aiSearchChannels (spanish query)', () =>
  aiSearchChannels('canales de deportes en español', catalog, 5)
);
await step('aiMatchPreview', () =>
  aiMatchPreview('Liverpool', 'Arsenal', 'Premier League', 'live')
);
await step('fetchSportsFeed', () => fetchSportsFeed(true));
