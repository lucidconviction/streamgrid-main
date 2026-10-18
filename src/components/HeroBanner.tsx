import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, LayoutGrid, Bookmark, Eye, Radio } from 'lucide-react';
import { StreamItem } from '../types/stream';
import Hls from 'hls.js';

interface HeroBannerProps {
  featuredStream: StreamItem | null;
  onPlayStream: (stream: StreamItem) => void;
  onAddToMultiview: (stream: StreamItem) => void;
  onToggleWatchlist: (stream: StreamItem) => void;
  isInWatchlist: boolean;
  upcomingLiveEvents?: StreamItem[];
  onSelectHeroStream?: (stream: StreamItem) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Cleanup HLS instance on unmount or stream change
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Determine stream URL and type once per featured stream
  const streamData = useMemo(() => {
    if (!featuredStream) return null;
    // Use bgVideoUrl (original) for video autoplay, directEmbedUrl (proxied) for iframe display
    const videoUrl = featuredStream.bgVideoUrl || featuredStream.directEmbedUrl || featuredStream.streams?.[0]?.embedUrl || '';
    const url = videoUrl;
    const isHls = url.includes('.m3u8') || url.includes('.ts');
    const isDirectVideo = url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mkv');
    const isEmbed = url.includes('/embed/') || url.includes('pages.dev') || url.includes('embed.st') || url.includes('pstream.cfd') || url.includes('/api/bintv-proxy');
    return { url, isHls, isDirectVideo, isEmbed };
  }, [featuredStream?.id]);

  // Set up video player when featured stream changes
  useEffect(() => {
    if (!featuredStream || videoError) {
      setVideoError(false);
      return;
    }

    if (!streamData || !streamData.url || streamData.isEmbed) {
      setPosterSrc(featuredStream.poster || '');
      return;
    }

    const { url, isHls } = streamData;

    setPosterSrc(featuredStream.poster || '');
    setVideoError(false);

    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;
    if (!video) return;

    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.muted = true;
          video.play().catch(() => setVideoError(true));
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) { setVideoError(true); hls.destroy(); hlsRef.current = null; }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', () => {
          video.muted = true;
          video.play().catch(() => setVideoError(true));
        });
      }
    } else {
      video.src = url;
      video.addEventListener('loadeddata', () => {
        video.muted = true;
        video.play().catch(() => setVideoError(true));
      });
      video.addEventListener('error', () => setVideoError(true));
    }
  }, [featuredStream?.id, streamData]);

  if (!featuredStream) {
    return (
      <div className="relative w-full h-[50vh] sm:h-[60vh] lg:h-[520px] bg-slate-900 animate-pulse rounded-2xl mb-8" />
    );
  }

  const displayPoster = posterSrc || '/src/assets/images/hero_championship_live_1792048678438.jpg';

  return (
    <div className="relative w-full rounded-2xl overflow-hidden mb-10 border border-blue-500/20 bg-[#0c1220]">
      {/* ── Background layer ── */}
      {!videoError && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          {/* Iframe embed for streams that provide an embed URL */}
          {streamData?.isEmbed && streamData?.url && (
            <iframe
              ref={iframeRef}
              src={streamData.url}
              className="pointer-events-none w-full h-full object-cover filter brightness-105"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              style={{ border: 'none' }}
              title={`${featuredStream.title} stream background`}
            />
          )}

          {/* Native video for HLS/direct video URLs */}
          {streamData && !streamData.isEmbed && streamData.url && !videoError && (
            <video
              ref={videoRef}
              className="w-full h-full object-cover object-center filter brightness-105"
              muted
              autoPlay
              playsInline
              onError={() => setVideoError(true)}
            />
          )}

          {/* Static poster fallback */}
          {(videoError || !streamData?.url) && (
            <img
              src={displayPoster}
              alt={featuredStream.title}
              className="w-full h-full object-cover object-center filter brightness-105 transition-all duration-700"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  '/src/assets/images/hero_championship_live_1792048678438.jpg';
              }}
            />
          )}
        </div>
      )}

      {/* ── Gradient Scrim Overlay — dims the background so text stays readable ── */}
      <div className="absolute inset-0 z-[1]" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-t from-[#050810] via-[#050810]/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050810] via-[#050810]/20 to-transparent" />
        <div className="absolute inset-0 bg-blue-900/10" />
      </div>

      {/* ── Hero Content — sits above everything ── */}
      <div className="relative z-10 px-5 sm:px-10 py-10 sm:py-16 max-w-3xl flex flex-col justify-end min-h-[50vh] sm:min-h-[460px] lg:min-h-[520px]">
        {/* Clean unboxed metadata with separators (Zero-Pill discipline) */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-3 tracking-wide">
          <span className="flex items-center gap-1.5 text-blue-400 font-semibold uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            Live Broadcast
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>{featuredStream.category}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="font-mono tabular-nums flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-slate-400" />
            {(featuredStream.viewers || 3400).toLocaleString()} watching
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-400 uppercase text-[11px] font-mono">
            {featuredStream.provider === 'streamed' ? 'Streamed HD' : 'BinTV 24/7'}
          </span>
        </div>

        {/* Hero Title with text-wrap: balance */}
        <h1
          className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4"
          style={{ textWrap: 'balance' }}
        >
          {featuredStream.title}
        </h1>

        <p className="text-sm sm:text-base text-slate-300 line-clamp-2 max-w-xl mb-6 font-normal">
          Instant high-definition live stream with theater cinema playback, switchable commentary audio, and multi-screen grid integration.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onPlayStream(featuredStream)}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition-all shadow-lg shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] neon-glow-blue"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Watch Live</span>
          </button>

          <button
            onClick={() => onAddToMultiview(featuredStream)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700/90 text-slate-100 rounded-lg font-medium text-sm border border-slate-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <LayoutGrid className="w-4 h-4 text-blue-400" />
            <span>Add to Multiview</span>
          </button>

          <button
            onClick={() => onToggleWatchlist(featuredStream)}
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
      </div>

      {/* Quick live switcher strip at bottom */}
      {upcomingLiveEvents.length > 0 && onSelectHeroStream && (
        <div className="relative z-10 hidden lg:flex items-center gap-3 px-6 py-3 bg-black/60 backdrop-blur-md border-t border-slate-800/80 text-xs">
          <span className="text-slate-400 uppercase tracking-wider font-mono text-[11px] shrink-0">
            Featured Streamers:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {upcomingLiveEvents.slice(0, 4).map((evt) => (
              <button
                key={evt.id}
                onClick={() => onSelectHeroStream(evt)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors whitespace-nowrap shrink-0 ${
                  evt.id === featuredStream.id
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
