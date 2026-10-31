// ── Embed player URL detection ───────────────────────────────────────────────
//
// Streams come from a mix of providers: some hand us a direct HLS/media URL
// that plays in a <video> element, others hand us an HTML page that has to be
// loaded in an <iframe>. Several providers ship their player behind a wrapper
// domain, and BinTV in particular can resolve to a handful of different
// player hosts depending on which feed a stream points at.
//
// This module keeps that knowledge in one place so the player components do
// not each have to re-implement (and slowly drift apart on) the checks.

/** Hosts / path fragments that serve a self-contained HTML player. */
const EMBED_PLAYER_MARKERS = [
  'bintv-sources.pages.dev',
  'event-decoder-lite.lovable.app',
  'ehgembxe.cfd',
  'embed.st',
  'westream.su/embed',
  'adultembed.com',
  'eporner.com/embed',
  'pstream.cfd',
  'youtube.com/embed',
];

/** Local proxy path used to bypass the BinTV player's Cloudflare checks. */
export const BINTV_PROXY_PATH = '/api/bintv-proxy';

/**
 * True when the URL must be rendered in an <iframe> rather than a <video>.
 */
export function isEmbedPlayerUrl(url: string | undefined, streamType?: 'hls' | 'embed'): boolean {
  if (!url) return false;
  if (streamType === 'embed') return true;
  if (url.startsWith(BINTV_PROXY_PATH)) return true;
  return EMBED_PLAYER_MARKERS.some((marker) => url.includes(marker));
}
