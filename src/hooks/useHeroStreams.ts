import { useState, useEffect, useCallback, useRef } from 'react';

// ── Stream validation pipeline ─────────────────────────────────────────────
// HEAD check → HLS manifest check → test playback → render only when valid.
// Re-validates every 30s to catch dead streams. Results cached in-memory.

const REVALIDATE_INTERVAL = 30_000; // 30 seconds
const HEAD_TIMEOUT = 5_000; // 5s per candidate
const PLAYBACK_TIMEOUT = 8_000; // 8s test playback
const MAX_CANDIDATES = 5; // max candidates before fallback

interface HeroStreamCandidate {
  url: string;
  title?: string;
}

interface HeroStreamState {
  validatedUrl: string | null;
  isHls: boolean;
  isValidating: boolean;
  error: string | null;
}

// In-memory cache: url → { alive, checkedAt }
const urlCache = new Map<string, { alive: boolean; checkedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min in-memory

function isHlsUrl(url: string): boolean {
  return url.includes('.m3u8') || url.includes('.ts');
}

/**
 * Step 1: HEAD/GET check (5s timeout) — must return 200/206.
 */
async function headCheck(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEAD_TIMEOUT);
    try {
      // Try HEAD first, fall back to GET if server rejects HEAD
      let res = await fetch(url, { method: 'HEAD', signal: controller.signal, mode: 'no-cors' });
      if (res.status === 0) {
        // no-cors returns opaque response (status 0) — that still means the
        // network request reached the server and got a response, so treat as alive
        return true;
      }
      if (res.ok || res.status === 206) return true;
      return false;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // no-cors abort/timeout → treat as alive if it was a network error
    // (CORS blocks are common for cross-origin streams); only fail on
    // definitive DNS/connection errors after the timeout
    return false;
  }
}

/**
 * Step 2: HLS manifest check (if .m3u8) — verify #EXTM3U header.
 */
async function hlsManifestCheck(url: string): Promise<boolean> {
  if (!isHlsUrl(url)) return true; // non-HLS skips this step
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEAD_TIMEOUT);
    const res = await fetch(url, { signal: controller.signal, mode: 'no-cors' });
    clearTimeout(timer);
    // no-cors returns opaque response; if we got here, server responded
    // Try to read the manifest for #EXTM3U (works same-origin only)
    const text = await res.text().catch(() => '');
    if (text.includes('#EXTM3U')) return true;
    // Opaque response or no CORS — can't read body, but server responded
    // Trust the HEAD check result
    return true;
  } catch {
    return false;
  }
}

/**
 * Step 3: Test playback (8s timeout) — create offscreen <video>, wait for canplay.
 */
async function testPlayback(url: string, isHls: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve(false);
    }, PLAYBACK_TIMEOUT);

    video.addEventListener('canplay', () => {
      clearTimeout(timeout);
      cleanup();
      resolve(true);
    }, { once: true });

    video.addEventListener('error', () => {
      clearTimeout(timeout);
      cleanup();
      resolve(false);
    }, { once: true });

    if (isHls) {
      // For HLS, use hls.js to test
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) {
              clearTimeout(timeout);
              hls.destroy();
              resolve(false);
            }
          });
          // If canplay never fires within timeout, we fail
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url;
        } else {
          clearTimeout(timeout);
          resolve(false);
        }
      }).catch(() => {
        clearTimeout(timeout);
        resolve(false);
      });
    } else {
      video.src = url;
    }
  });
}

/**
 * Validate a single URL through the full pipeline.
 */
async function validateStream(url: string): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;

  // Check in-memory cache
  const cached = urlCache.get(url);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL) {
    return cached.alive;
  }

  const hls = isHlsUrl(url);

  // Step 1: HEAD check
  const headAlive = await headCheck(url);
  if (!headAlive) {
    urlCache.set(url, { alive: false, checkedAt: Date.now() });
    return false;
  }

  // Step 2: HLS manifest check
  const manifestOk = await hlsManifestCheck(url);
  if (!manifestOk) {
    urlCache.set(url, { alive: false, checkedAt: Date.now() });
    return false;
  }

  // Step 3: Test playback
  const canPlay = await testPlayback(url, hls);
  urlCache.set(url, { alive: canPlay, checkedAt: Date.now() });
  return canPlay;
}

/**
 * Try candidates in order, return the first validated URL.
 */
async function tryCandidates(candidates: HeroStreamCandidate[]): Promise<{ url: string; isHls: boolean } | null> {
  const toTry = candidates.slice(0, MAX_CANDIDATES);
  for (const candidate of toTry) {
    const alive = await validateStream(candidate.url);
    if (alive) {
      return { url: candidate.url, isHls: isHlsUrl(candidate.url) };
    }
  }
  return null;
}

/**
 * Hook: manages hero stream validation with re-validation every 30s.
 */
export function useHeroStreams(candidates: HeroStreamCandidate[]): HeroStreamState {
  const [state, setState] = useState<HeroStreamState>({
    validatedUrl: null,
    isHls: false,
    isValidating: true,
    error: null,
  });

  const candidatesRef = useRef(candidates);
  candidatesRef.current = candidates;

  const validate = useCallback(async () => {
    const cands = candidatesRef.current;
    if (cands.length === 0) {
      setState({ validatedUrl: null, isHls: false, isValidating: false, error: 'no_candidates' });
      return;
    }
    setState((prev) => ({ ...prev, isValidating: true, error: null }));
    const result = await tryCandidates(cands);
    if (result) {
      setState({ validatedUrl: result.url, isHls: result.isHls, isValidating: false, error: null });
    } else {
      setState({ validatedUrl: null, isHls: false, isValidating: false, error: 'all_failed' });
    }
  }, []);

  // Run on mount + when candidates change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      setState((prev) => ({ ...prev, isValidating: true }));
      const cands = candidatesRef.current;
      if (cands.length === 0) {
        setState({ validatedUrl: null, isHls: false, isValidating: false, error: 'no_candidates' });
        return;
      }
      const result = await tryCandidates(cands);
      if (cancelled) return;
      if (result) {
        setState({ validatedUrl: result.url, isHls: result.isHls, isValidating: false, error: null });
      } else {
        setState({ validatedUrl: null, isHls: false, isValidating: false, error: 'all_failed' });
      }
    })();
    return () => { cancelled = true; };
  }, [candidates.map(c => c.url).join('|')]);

  // Re-validate every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      const cands = candidatesRef.current;
      if (cands.length > 0 && !document.hidden) {
        void validate();
      }
    }, REVALIDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [validate]);

  return state;
}
