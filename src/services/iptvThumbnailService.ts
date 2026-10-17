import Hls from 'hls.js';

// In-memory cache: url -> data URL (JPEG)
const screenshotCache = new Map<string, string>();
const capturing = new Map<string, Promise<string | null>>();
const intervals = new Map<string, ReturnType<typeof setInterval>>();

/**
 * Fast screenshot capture from an HLS stream as a JPEG data URL.
 * Optimized for speed: 4s timeout, 200ms polling, small canvas.
 * Optionally seeks to a random time between 0 and maxSeekSeconds for VOD.
 */
export async function captureIptvScreenshot(
  streamUrl: string,
  width = 240,
  maxSeekSeconds = 30,
): Promise<string | null> {
  const cacheKey = `${streamUrl}-${width}-${maxSeekSeconds}`;

  if (screenshotCache.has(cacheKey)) {
    return screenshotCache.get(cacheKey) ?? null;
  }

  if (capturing.has(cacheKey)) {
    return capturing.get(cacheKey)!;
  }

  const promise = (async () => {
    let video: HTMLVideoElement | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let hls: Hls | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let captured = false;

    try {
      video = document.createElement('video');
      canvas = document.createElement('canvas');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('data-iptv-screenshot', '1');
      video.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;visibility:hidden;';

      canvas.width = width;
      canvas.height = Math.round(width * 9 / 16);

      const drawFrame = () => {
        if (captured || !video || !canvas) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          captured = true;
          try {
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
            screenshotCache.set(cacheKey, dataUrl);
            cleanup();
          } catch { cleanup(); }
        }
      };

      // Hard 8-second timeout for more reliable capture
      timeout = setTimeout(() => cleanup(), 8000);

      const startCapture = () => {
        video?.play().then(() => {
          // Attempt immediate capture (works for already-buffered content)
          drawFrame();

          // Listen for first meaningful frame
          video?.addEventListener('loadeddata', () => {
            drawFrame();
          }, { once: true });

          // If seeking, wait for seeked
          video?.addEventListener('seeked', () => {
            drawFrame();
          }, { once: true });

          // Aggressive polling: 200ms intervals, 30 attempts = 6s max
          let attempts = 0;
          const interval = setInterval(() => {
            attempts++;
            if (attempts >= 30 || captured) {
              clearInterval(interval);
              intervals.delete(cacheKey);
              cleanup();
              return;
            }
            drawFrame();
          }, 200);
          intervals.set(cacheKey, interval);
        }).catch(cleanup);
      };

      if (Hls.isSupported()) {
        hls = new Hls({
          // Balanced settings for reliable frame capture
          maxBufferLength: 8,
          maxMaxBufferLength: 16,
          maxBufferSize: 6 * 1024 * 1024,
          startLevel: -1, // Auto select quality
          lowLatencyMode: false,
          liveDurationInfinity: true,
          manifestLoadingTimeOut: 5000,
          levelLoadingTimeOut: 5000,
          fragLoadingTimeOut: 5000,
          nudgeMaxRetry: 10,
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          // For VOD, seek to random position before playing
          if (maxSeekSeconds > 0 && video) {
            const seekTime = Math.floor(Math.random() * Math.min(maxSeekSeconds, 30));
            video.currentTime = seekTime;
          }
          startCapture();
        });

        hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
          // On fatal error, give up
          if (data.fatal) {
            console.warn('IPTV screenshot capture failed for', cacheKey, data.type);
            cleanup();
          }
          // On recoverable errors, keep trying
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadeddata', () => {
          if (video && canvas) drawFrame();
        }, { once: true });
        video.play().catch(cleanup);
      } else {
        cleanup();
      }
    } catch {
      cleanup();
    }

    return null;

    function cleanup() {
      if (timeout) { clearTimeout(timeout); timeout = null; }
      const interval = intervals.get(cacheKey);
      if (interval) { clearInterval(interval); intervals.delete(cacheKey); }
      if (hls) { hls.destroy(); hls = null; }
      if (video) {
        video.pause();
        video.src = '';
        video.removeAttribute('src');
        video.load();
        video.remove();
        video = null;
      }
      capturing.delete(cacheKey);
    }
  })();

  capturing.set(cacheKey, promise);
  promise.finally(() => capturing.delete(cacheKey));
  return promise;
}