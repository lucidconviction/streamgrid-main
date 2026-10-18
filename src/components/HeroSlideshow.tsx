import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, LayoutGrid, Bookmark, Eye, Radio } from 'lucide-react';
import { StreamItem } from '../types/stream';
import Hls from 'hls.js';

interface HeroSlideshowProps {
  featuredStream: StreamItem | null;
  onPlayStream: (stream: StreamItem) => void;
  onAddToMultiview: (stream: StreamItem) => void;
  onToggleWatchlist: (stream: StreamItem) => void;
  isInWatchlist: boolean;
  upcomingLiveEvents?: StreamItem[];
  onSelectHeroStream?: (stream: StreamItem) => void;
}

export const HeroSlideshow: React.FC<HeroSlideshowProps> = ({
  featuredStream,
  onPlayStream,
  onAddToMultiview,
  onToggleWatchlist,
  isInWatchlist,
  upcomingLiveEvents = [],
  onSelectHeroStream,
}) => {
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [posterSrc, setPosterSrc] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rotationMs, setRotationMs] = useState(12000); // 12s per slide
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingUrlRef = useRef<string | null>(null);

  // Determine 4 candidates from live streams + upcoming events
  const candidates = useMemo(() => {
    const pool: StreamItem[] = [];
    if (featuredStream) pool.push(featuredStream);
    upcomingLiveEvents.slice(0, 3).forEach((s) => {
      if (!pool.find((p) => p.id === s.id)) pool.push(s);
    });
    return pool.length >= 4 ? pool.slice(0, 4) : pool;
  }, [featuredStream, upcomingLiveEvents]);

  const currentStream = candidates[currentIndex] || featuredStream || candidates[0] || null;
  const streamData = useMemo(() => {
    if (!currentStream) return null;
    const videoUrl = currentStream.bgVideoUrl || currentStream.directEmbedUrl || currentStream.streams?.[0]?.embedUrl || '';
    const url = videoUrl;
    const isHls = url.includes('.m3u8') || url.includes('.ts');
    const isEmbed = url.includes('/embed/') || url.includes('pages.dev') || url.includes('embed.st') || url.includes('pstream.cfd') || url.includes('/api/bintv-proxy');
    return { url, isHls, isEmbed };
  }, [currentStream?.id]);

  // Verify stream works before showing — preload and check
  const verifyAndLoad = useCallback((url: string, isHls: boolean) => {
    const video = videoRef.current;
    if (!video) return;

    // Pre-verify: create a temporary HLS or video element to check if stream is live
    const verify = document.createElement('video');
    verify.muted = true;
    verify.style.display = 'none';
    document.body.appendChild(verify);

    let resolve = (v: boolean) => {};
    const p = new Promise<boolean>((r) => { resolve = r; });

    const timeout = setTimeout(() => {
      verify.remove();
      resolve(false);
    }, 5000); // 5s timeout

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 4, maxMaxBufferLength: 8 });
      hls.loadSource(url);
      hls.attachMedia(verify);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { clearTimeout(timeout); resolve(true); });
      hls.on(Hls.Events.ERROR, () => { clearTimeout(timeout); resolve(false); });
    } else {
      verify.src = url;
      verify.addEventListener('canplay', () => { clearTimeout(timeout); resolve(true); });
      verify.addEventListener('error', () => { clearTimeout(timeout); resolve(false); });
    }

    return p;
  }, []);

  // Setup player for current stream
  const setupPlayer = useCallback(async (stream: StreamItem) => {
    const url = stream.bgVideoUrl || stream.directEmbedUrl || stream.streams?.[0]?.embedUrl || '';
    if (!url) {
      setPosterSrc(stream.poster || '');
      return;
    }

    const isHls = url.includes('.m3u8') || url.includes('.ts');

    // Try to verify stream works first
    try {
      const works = await verifyAndLoad(url, isHls);
      if (!works) {
        // Stream doesn't work, mark error
        setVideoError(true);
        return;
      }
    } catch {
      setVideoError(true);
      return;
    }

    setPosterSrc(stream.poster || '');
    setVideoError(false);

    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;
    if (!video) return;

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 16,
        maxMaxBufferLength: 32,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.muted = true;
        video.play().catch(() => setVideoError(true));
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setVideoError(true);
          hls.destroy();
          hlsRef.current = null;
        }
      });
    } else {
      video.src = url;
      video.addEventListener('loadeddata', () => {
        video.muted = true;
        video.play().catch(() => setVideoError(true));
      });
      video.addEventListener('error', () => setVideoError(true));
    }
  }, [verifyAndLoad]);

  // Handle stream changes
  useEffect(() => {
    if (currentStream) {
      setVideoError(false);
      setupPlayer(currentStream);
    }
  }, [currentStream?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-rotate through slides
  const goToNext = useCallback(() => {
    const next = (currentIndex + 1) % candidates.length;
    setCurrentIndex(next);
    setVideoError(false);
  }, [currentIndex, candidates.length]);

  useEffect(() => {
    if (candidates.length <= 1) return;
    
    intervalRef.current = setInterval(() => {
      goToNext();
    }, rotationMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [candidates.length, rotationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle video errors — skip to next slide
  const handleError = useCallback(() => {
    setVideoError(true);
    if (candidates.length > 1) {
      const next = (currentIndex + 1) % candidates.length;
      setCurrentIndex(next);
    }
  }, [candidates.length, currentIndex]);

  if (!candidates.length) {
    return (
      <div className="relative w-full h-[50vh] sm:h-[60vh] lg:h-[520px] bg-slate-900 animate-pulse rounded-2xl mb-8" />
    );
  }

  const displayPoster = posterSrc || '/src/assets/images/hero_championship_live_1792048678438.jpg';

  return (
    <div className="relative w-full rounded-2xl overflow-hidden mb-10 border border-blue-500/20 bg-[#0c1220]">
      {/* Slide indicators */}
      {candidates.length > 1 && (
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          {candidates.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrentIndex(i); setVideoError(false); }}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIndex ? 'bg-blue-400 w-6' : 'bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* ── Background layer ── */}
      {!videoError && currentStream && streamData?.url && !streamData.isEmbed && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover object-center scale-175 filter brightness-105"
            muted
            autoPlay
            playsInline
            onError={handleError}
          />
        </div>
      )}

      {/* Static poster fallback */}
      {(videoError || !streamData?.url || streamData.isEmbed) && currentStream && (
        <img
          src={displayPoster}
          alt={currentStream.title}
          className="w-full h-full object-cover object-center scale-175 filter brightness-105 transition-all duration-700"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              '/src/assets/images/hero_championship_live_1792048678438.jpg';
          }}
        />
      )}

      {/* ── Gradient Scrim Overlay ── */}
      <div className="absolute inset-0 z-[1]" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-t from-[#050810] via-[#050810]/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050810] via-[#050810]/20 to-transparent" />
        <div className="absolute inset-0 bg-blue-900/10" />
      </div>

      {/* ── Hero Content ── */}
      <div className="relative z-10 px-5 sm:px-10 py-10 sm:py-16 max-w-3xl flex flex-col justify-end min-h-[50vh] sm:min-h-[460px] lg:min-h-[520px]">
        {currentStream && (
          <>
            {/* Clean unboxed metadata */}
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-3 tracking-wide">
              <span className="flex items-center gap-1.5 text-blue-400 font-semibold uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                Live Broadcast
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>{currentStream.category}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="font-mono tabular-nums flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                {(currentStream.viewers || 3400).toLocaleString()} watching
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-400 uppercase text-[11px] font-mono">
                {currentStream.provider === 'streamed' ? 'Streamed HD' : 'BinTV 24/7'}
              </span>
            </div>

            {/* Title */}
            <h1
              className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4"
              style={{ textWrap: 'balance' }}
            >
              {currentStream.title}
            </h1>

            <p className="text-sm sm:text-base text-slate-300 line-clamp-2 max-w-xl mb-6 font-normal">
              Instant high-definition live stream with theater cinema playback, switchable commentary audio, and multi-screen grid integration.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => onPlayStream(currentStream)}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition-all shadow-lg shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] neon-glow-blue"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Watch Live</span>
              </button>

              <button
                onClick={() => onAddToMultiview(currentStream)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700/90 text-slate-100 rounded-lg font-medium text-sm border border-slate-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <LayoutGrid className="w-4 h-4 text-blue-400" />
                <span>Add to Multiview</span>
              </button>

              <button
                onClick={() => onToggleWatchlist(currentStream)}
                className={`p-2.5 rounded-lg border transition-all ${
                  isInWatchlist
                    ? 'bg-blue-950/60 border-blue-700 text-blue-400'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title={isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                aria-label="Toggle Watchlist"
              >
                <Bookmark className={`w-4 h-4 ${isInWatchlist ? 'fill-blue-500' : ''}`} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Quick live switcher strip at bottom */}
      {upcomingLiveEvents.length > 0 && onSelectHeroStream && candidates.length > 1 && (
        <div className="relative z-10 hidden lg:flex items-center gap-3 px-6 py-3 bg-black/60 backdrop-blur-md border-t border-slate-800/80 text-xs">
          <span className="text-slate-400 uppercase tracking-wider font-mono text-[11px] shrink-0">
            Featured Streams:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {candidates.map((evt, idx) => (
              <button
                key={evt.id}
                onClick={() => { onSelectHeroStream(evt); setCurrentIndex(idx); setVideoError(false); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors whitespace-nowrap shrink-0 ${
                  idx === currentIndex
                    ? 'bg-blue-600/30 border border-blue-500/50 text-white font-medium'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <span className="truncate max-w-[180px]">{evt.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
