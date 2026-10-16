import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { Layers, Bookmark, Play } from 'lucide-react';
import { StreamItem } from '../types/stream';
import { getCategoryGradient } from '../services/smuttThumbnailService';
import { getMovieTrailer, getTVTrailer } from '../services/tmdbService';

interface StreamCardProps {
  stream: StreamItem;
  onPlay: (stream: StreamItem) => void;
  onAddToMultiview: (stream: StreamItem) => void;
  onToggleWatchlist: (stream: StreamItem) => void;
  isInWatchlist: boolean;
  isInMultiview?: boolean;
  screenshotUrl?: string | null;
}

export const StreamCard: React.FC<StreamCardProps> = ({
  stream,
  onPlay,
  onAddToMultiview,
  onToggleWatchlist,
  isInWatchlist,
  isInMultiview,
  screenshotUrl,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [isLoadingTrailer, setIsLoadingTrailer] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trailerIframeRef = useRef<HTMLIFrameElement>(null);

  const posterUrl = stream.poster || '/hero.png';
  const isSmutt = stream.provider === 'smutt';
  const smuttEmoji = stream.smuttEmoji || '🎬';
  const isIptv = stream.provider === 'iptv';
  const isMovieOrTV = stream.provider === 'anime' && (stream.category === 'Movies' || stream.category === 'TV Shows');
  const iptvGradient = isIptv ? getCategoryGradient(stream.m3uSource || stream.category || '') : null;
  const iptvLabel = isIptv ? (stream.m3uSource || stream.category || 'IPTV').replace(/\s*\(.*/, '') : null;
  // Use screenshot only if no poster is attached
  const hasPoster = !!stream.poster;
  const thumbUrl = (!hasPoster && screenshotUrl) ? screenshotUrl : posterUrl;

  // Extract TMDB ID from stream id
  const tmdbId = isMovieOrTV ? stream.id.replace('tmdb-', '').replace('-movie', '').replace('-tv', '') : null;
  const parsedTmdbId = tmdbId ? parseInt(tmdbId, 10) : null;

  // Fetch trailer on hover
  useEffect(() => {
    if (!isHovered || !parsedTmdbId) return;

    setIsLoadingTrailer(true);
    const fetchTrailer = async () => {
      const trailer = stream.category === 'Movies'
        ? await getMovieTrailer(parsedTmdbId)
        : await getTVTrailer(parsedTmdbId);
      if (trailer) {
        setTrailerKey(trailer.key);
      }
      setIsLoadingTrailer(false);
    };
    fetchTrailer();
  }, [isHovered, parsedTmdbId, stream.category]);

  // Hover preview for ALL stream types
  useEffect(() => {
    if (!isHovered || !videoRef.current) return;
    const video = videoRef.current;

    // Stop any existing playback
    video.pause();
    video.src = '';

    const streamUrl = stream.directEmbedUrl;
    if (!streamUrl) return;

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    // HLS streams — use HLS.js (same approach as iptvThumbnailService)
    if ((streamUrl.includes('.m3u8') || streamUrl.includes('.ts')) && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        lowLatencyMode: true,
        enableWorker: true,
        fragLoadingTimeOut: 5000,
        manifestLoadingTimeOut: 5000,
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      const onManifestParsed = () => {
        video.play().catch(() => {});
      };
      hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);

      return () => {
        hls.destroy();
        video.pause();
        video.src = '';
      };
    } else if (streamUrl.includes('.m3u8') || streamUrl.includes('.ts')) {
      // Safari native HLS fallback
      video.src = streamUrl;
      video.load();
      video.play().catch(() => {});
    } else if (streamUrl.includes('.mp4') || streamUrl.includes('.webm')) {
      // Direct video files
      video.src = streamUrl;
      video.play().catch(() => {});
    }
    // For embed-based streams (bintv, streamed, westream, daddylive),
    // the iframe overlay handles the preview below

    return () => {
      video.pause();
      video.src = '';
    };
  }, [isHovered, stream.directEmbedUrl, stream.sources]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTrailerKey(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }
  };

  // Determine if we should show an iframe preview on hover for embed providers
  const isEmbedProvider = ['bintv', 'streamed', 'westream', 'daddylive'].includes(stream.provider);
  const showIframePreview = isHovered && isEmbedProvider && stream.directEmbedUrl && !trailerKey;

  return (
    <div className="group relative flex flex-col bg-[#0f121a] border border-slate-800/80 hover:border-slate-700 rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40">
      {/* Thumbnail Aspect Ratio 16:9 */}
      <div
        className="relative aspect-video w-full overflow-hidden bg-slate-900 cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => onPlay(stream)}
      >
        {/* Live Video Preview — visible on hover for all stream types */}
        {isHovered && stream.directEmbedUrl ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
            autoPlay
            preload="auto"
          />
        ) : !imageError && !isSmutt ? (
          <img
            src={thumbUrl}
            alt={stream.title}
            className={`w-full h-full object-cover transition-all duration-500 ${screenshotUrl ? 'opacity-100' : 'opacity-90'} group-hover:scale-105`}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : isSmutt ? (
          /* Smutt gradient fallback with category emoji */
          <div
            className="w-full h-full flex flex-col items-center justify-center"
            style={{ background: getCategoryGradient(stream.category || '') }}
          >
            <span className="text-4xl mb-1 drop-shadow-lg">{smuttEmoji}</span>
            <span className="text-[10px] text-white/60 font-mono uppercase tracking-wider px-2 text-center truncate w-full">{stream.category}</span>
          </div>
        ) : isIptv && screenshotUrl ? (
          /* IPTV screenshot from stream capture */
          <img
            src={screenshotUrl}
            alt={stream.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : isIptv ? (
          /* IPTV playlist gradient with satellite icon */
          <div
            className="w-full h-full flex flex-col items-center justify-center"
            style={{ background: iptvGradient || 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}
          >
            <span className="text-3xl mb-1 drop-shadow-lg">📡</span>
            {iptvLabel && (
              <span className="text-[9px] font-bold text-white/80 uppercase tracking-widest px-2 text-center truncate w-full">
                {iptvLabel}
              </span>
            )}
          </div>
        ) : (
          /* High quality fallback SVG container per Zero-Broken-Image Policy */
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-slate-500 p-4 text-center">
            <svg className="w-8 h-8 mb-2 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-medium text-slate-400 line-clamp-1">{stream.title}</span>
          </div>
        )}

        {/* Status badges — hidden when hovering (preview takes over) */}
        {!isHovered && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded text-[11px] font-semibold text-white z-10">
            {stream.status === '24/7' ? (
              <span className="text-amber-400 font-mono">24/7 TV</span>
            ) : stream.status === 'upcoming' ? (
              <span className="text-sky-400 font-mono">UPCOMING</span>
            ) : stream.status === 'live' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-blue-400 uppercase tracking-wider font-mono">LIVE</span>
              </>
            ) : null}
          </div>
        )}

        {/* Trailer iframe overlay on hover (movies/TV) */}
        {isHovered && isMovieOrTV && trailerKey && (
          <div className="absolute inset-0 bg-black">
            <iframe
              ref={trailerIframeRef}
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1`}
              title={`${stream.title} trailer`}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {/* Embed preview overlay on hover for non-IPTV streams with embed URLs */}
        {showIframePreview && isEmbedProvider && (
          <div className="absolute inset-0 bg-black">
            <iframe
              src={stream.directEmbedUrl}
              title={stream.title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; camera; microphone"
              allowFullScreen
            />
          </div>
        )}

        {/* Loading spinner while fetching trailer */}
        {isHovered && isMovieOrTV && isLoadingTrailer && !trailerKey && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Card Info Details */}
      <div className="p-3.5 flex flex-col flex-1 justify-between">
        <div>
          {/* Metadata line with dot separators (Zero-Pill discipline) */}
          <div className="flex items-center gap-2 text-[12px] text-slate-300 mb-1.5 font-medium">
            <span className="truncate">{stream.category}</span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span className="font-mono tabular-nums text-slate-300">
              {(stream.viewers || 1200).toLocaleString()} viewers
            </span>
          </div>

          <h3
            onClick={() => onPlay(stream)}
            className="text-sm font-semibold text-slate-100 hover:text-blue-400 transition-colors line-clamp-1 cursor-pointer"
            title={stream.title}
          >
            {stream.title}
          </h3>

          {/* Multiview + Play + Watch buttons — side by side under title */}
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onAddToMultiview(stream); }}
              className={`flex-1 flex items-center justify-center gap-0.5 px-1.5 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 ${
                isInMultiview
                  ? 'bg-blue-600 text-white border border-blue-500'
                  : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:border-blue-500/60 hover:text-blue-300 hover:bg-blue-600/20'
              }`}
              title={isInMultiview ? 'Remove from multiview' : 'Add to multiview'}
            >
              <Layers className="w-2.5 h-2.5" />
              <span>{isInMultiview ? 'In View' : 'Multiview'}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onPlay(stream); }}
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/30 hover:shadow-blue-500/40"
              title="Play stream"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleWatchlist(stream); }}
              className={`flex-1 flex items-center justify-center gap-0.5 px-1.5 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 ${
                isInWatchlist
                  ? 'bg-amber-500 text-black border border-amber-400'
                  : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:border-amber-500/60 hover:text-amber-300 hover:bg-amber-500/20'
              }`}
              title={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              <Bookmark className={`w-2.5 h-2.5 ${isInWatchlist ? 'fill-black' : ''}`} />
              <span>{isInWatchlist ? 'Watched' : 'Watch'}</span>
            </button>
          </div>
        </div>

        {/* Bottom subtle kicker */}
        <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span className="uppercase">{stream.provider}</span>
          <span>{stream.sources?.length ? `${stream.sources.length} sources` : 'HD Feed'}</span>
        </div>
      </div>
    </div>
  );
};
