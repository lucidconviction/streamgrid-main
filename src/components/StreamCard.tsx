import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { Layers, Bookmark, Play, PictureInPicture2, Headphones, Star } from 'lucide-react';
import { StreamItem } from '../types/stream';
import { getCategoryGradient } from '../services/smuttThumbnailService';
import { COUNTRY_LABELS } from '../services/iptvService';

interface StreamCardProps {
  stream: StreamItem;
  onPlay: (stream: StreamItem) => void;
  onAddToMultiview: (stream: StreamItem) => void;
  onToggleWatchlist: (stream: StreamItem) => void;
  onTogglePiP?: (stream: StreamItem) => void;
  isInWatchlist: boolean;
  isInMultiview?: boolean;
  screenshotUrl?: string | null;
  onCardClick?: (stream: StreamItem) => void;
}

export const StreamCard: React.FC<StreamCardProps> = ({
  stream,
  onPlay,
  onAddToMultiview,
  onToggleWatchlist,
  onTogglePiP,
  isInWatchlist,
  isInMultiview,
  screenshotUrl,
  onCardClick,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsAudioRef = useRef<Hls | null>(null);

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

  // Hover preview for ALL stream types (skipped for movie/TV — tap to navigate)
  useEffect(() => {
    if (!isHovered || !videoRef.current || isMovieOrTV) return;
    const video = videoRef.current;

    // Stop any existing playback
    video.pause();
    video.src = '';

    const streamUrl = stream.directEmbedUrl;
    if (!streamUrl) return;

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    // HLS streams with resilience (auto-reconnect on fatal error)
    if ((streamUrl.includes('.m3u8') || streamUrl.includes('.ts')) && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        lowLatencyMode: true,
        enableWorker: true,
        fragLoadingTimeOut: 5000,
        manifestLoadingTimeOut: 5000,
        startLevel: -1,
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      const onManifestParsed = () => {
        video.play().catch(() => {});
      };
      hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);

      // Resilience: auto-reconnect on fatal errors with backoff
      let reconnectAttempts = 0;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              reconnectAttempts = 0;
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              reconnectAttempts = 0;
              break;
            default:
              reconnectAttempts += 1;
              if (reconnectAttempts <= 3) {
                setTimeout(() => hls.startLoad(), Math.min(1000 * reconnectAttempts, 8000));
              } else {
                hls.destroy();
              }
              break;
          }
        }
      });

      return () => {
        hls.destroy();
        video.pause();
        video.src = '';
      };
    } else if (streamUrl.includes('.m3u8') || streamUrl.includes('.ts')) {
      // Safari native HLS fallback with resilience
      video.src = streamUrl;
      video.load();
      video.play().catch(() => {});
    } else if (streamUrl.includes('.mp4') || streamUrl.includes('.webm')) {
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

  // Hover-to-Listen: play audio-only from bgVideoUrl when hovering
  useEffect(() => {
    if (!isHovered || !audioRef.current || isMovieOrTV) return;
    const audio = audioRef.current;
    const url = stream.bgVideoUrl;
    if (!url) return;

    // Clean up previous audio
    audio.pause();
    audio.src = '';
    if (hlsAudioRef.current) { hlsAudioRef.current.destroy(); hlsAudioRef.current = null; }

    const isHls = url.includes('.m3u8') || url.includes('.ts');
    audio.volume = 0.5;

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 16,
        lowLatencyMode: true,
        enableWorker: true,
      });
      hlsAudioRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(audio);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        audio.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_ev, data) => {
        if (data.fatal && hlsAudioRef.current) {
          hlsAudioRef.current.destroy();
          hlsAudioRef.current = null;
        }
      });
    } else {
      audio.src = url;
      audio.play().catch(() => {});
    }

    return () => {
      audio.pause();
      audio.src = '';
      if (hlsAudioRef.current) { hlsAudioRef.current.destroy(); hlsAudioRef.current = null; }
    };
  }, [isHovered, stream.bgVideoUrl]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }
  };

  // Determine if we should show an iframe preview on hover for embed providers
  const isEmbedProvider = ['bintv', 'streamed', 'westream', 'daddylive'].includes(stream.provider);
  const showIframePreview = isHovered && isEmbedProvider && stream.directEmbedUrl;

  return (
    <div className={`group relative flex flex-col bg-[#0f121a] transition-all duration-200 ${
      isMovieOrTV
        ? 'overflow-hidden hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40'
        : 'border border-slate-800/80 hover:border-slate-700 rounded-xl overflow-hidden'
    }`}>
      {/* Hover-to-Listen badge */}
      {isHovered && stream.bgVideoUrl && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 backdrop-blur-sm text-[10px] font-bold text-white/90 pointer-events-none">
          <Headphones className="w-3 h-3 text-blue-400" />
          <span>Listen</span>
        </div>
      )}
      {/* Thumbnail Aspect Ratio 16:9 */}
      <div
        className={`relative w-full overflow-hidden bg-slate-900 cursor-pointer ${isMovieOrTV ? "aspect-[9/16]" : "aspect-video"}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => onCardClick ? onCardClick(stream) : onPlay(stream)}
      >
        {/* Live Video Preview — visible on hover for all stream types */}
        {isHovered && stream.directEmbedUrl && !isMovieOrTV ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
            autoPlay
            preload="auto"
          />
        ) : isIptv ? (
          /* IPTV: screenshot as background, logo at bottom-left */
          <div className="relative w-full h-full">
            {/* Base background: logo centered, always present to prevent flickering */}
            <img
              src="/logo.png"
              alt=""
              className="absolute inset-0 w-full h-full object-contain opacity-20 z-0"
              referrerPolicy="no-referrer"
            />
            {/* Gradient overlay to ensure readability */}
            <div className="absolute inset-0 z-0" style={{ background: iptvGradient ? 'none' : 'linear-gradient(135deg, rgba(14,165,233,0.3), rgba(2,132,199,0.3))' }} />
            {screenshotUrl ? (
              <img
                src={screenshotUrl}
                alt={stream.title}
                className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105 relative z-10"
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
              />
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center relative z-10"
              >
                <img
                  src="/logo.png"
                  alt={stream.title}
                  className="w-12 h-12 mb-2 opacity-60"
                  referrerPolicy="no-referrer"
                />
                {iptvLabel && (
                  <span className="text-[9px] font-bold text-white/80 uppercase tracking-widest px-2 text-center truncate w-full">
                    {iptvLabel}
                  </span>
                )}
              </div>
            )}
            {stream.poster && (
              <img
                src={stream.poster}
                alt=""
                className="absolute bottom-1 left-1 w-8 h-8 object-contain rounded bg-black/50 p-0.5"
                referrerPolicy="no-referrer"
                onError={() => {}}
              />
            )}
          </div>
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
        ) : (
          /* High quality fallback with logo center */
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-slate-500 p-4 text-center">
            <img src="/logo.png" alt="" className="w-10 h-10 mb-2 opacity-40" referrerPolicy="no-referrer" />
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
      </div>

      {/* Card Info Details */}
      <div className="p-3.5 flex flex-col flex-1 justify-between">
        <div>
          {/* Metadata line — country/genre chips for IPTV, category+viewers for others */}
          <div className="flex items-center gap-2 text-[12px] text-slate-300 mb-1.5 font-medium">
            {isIptv && stream.iptvCountry ? (
              <>
                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold uppercase tracking-wide">
                  {COUNTRY_LABELS[stream.iptvCountry] || stream.iptvCountry}
                </span>
                {stream.iptvGenre && stream.iptvGenre !== 'general' ? (
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold uppercase tracking-wide">
                    {stream.iptvGenre}
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <span className="truncate">{stream.category}</span>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className="font-mono tabular-nums text-slate-300">
                  {(stream.viewers || 1200).toLocaleString()} viewers
                </span>
              </>
            )}
          </div>

          <h3
            onClick={() => onCardClick ? onCardClick(stream) : onPlay(stream)}
            className="text-sm font-semibold text-slate-100 hover:text-blue-400 transition-colors line-clamp-1 cursor-pointer"
            title={stream.title}
          >
            {stream.title}
          </h3>

          {!isMovieOrTV && (
            <>
                        {/* Buttons row — Multiview | Play | PiP | Watch — compact on mobile */}
                        <div className="mt-2 grid grid-cols-4 gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); onAddToMultiview(stream); }}
                            className={`flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-200 ${
                              isInMultiview
                                ? 'bg-blue-600 text-white border border-blue-500'
                                : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:border-blue-500/60 hover:text-blue-300 hover:bg-blue-600/20'
                            }`}
                            title={isInMultiview ? 'Remove from multiview' : 'Add to multiview'}
                          >
                            <Layers className="w-3 h-3 shrink-0" />
                            <span className="truncate text-[9px] leading-none">{isInMultiview ? 'In View' : 'Multi'}</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onPlay(stream); }}
                            className="flex items-center justify-center w-full h-full min-h-[30px] rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/30"
                            title="Play stream"
                          >
                            <Play className="w-3.5 h-3.5 fill-white" />
                          </button>
                          {onTogglePiP && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onTogglePiP(stream); }}
                              className="flex items-center justify-center w-full h-full min-h-[30px] rounded-lg bg-red-600 hover:bg-red-500 text-white transition-all shadow-md shadow-red-600/30"
                              title="Picture-in-Picture"
                            >
                              <PictureInPicture2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleWatchlist(stream); }}
                            className={`flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-200 ${
                              isInWatchlist
                                ? 'bg-amber-500 text-black border border-amber-400'
                                : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:border-amber-500/60 hover:text-amber-300 hover:bg-amber-500/20'
                            }`}
                            title={isInWatchlist ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Star className={`w-3 h-3 shrink-0 ${isInWatchlist ? 'fill-black' : ''}`} />
                            <span className="truncate text-[9px] leading-none">{isInWatchlist ? 'Fav' : 'Fav'}</span>
                          </button>
              </div>
            </>
          )}
        </div>

      {/* Bottom subtle kicker */}
        <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span className="uppercase">{stream.category}</span>
          <span>{stream.sources?.length ? `${stream.sources.length} sources` : 'HD Feed'}</span>
        </div>
      </div>

      {/* Hidden audio element for Hover-to-Listen */}
      <audio ref={audioRef} playsInline preload="none" />
    </div>
  );
};
