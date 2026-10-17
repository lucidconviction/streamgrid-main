import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  AlertCircle,
  RefreshCw,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Maximize2,
  PictureInPicture2,
  Captions,
  CaptionsOff,
} from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  title: string;
  streamType?: 'hls' | 'embed';
  isMuted?: boolean;
  volume?: number;
  autoPlay?: boolean;
  className?: string;
  onRefresh?: () => void;
  onTogglePiP?: () => void;
  onVideoEnd?: () => void;
  onError?: () => void;
  onSyncPlay?: (time: number) => void;
  onSyncPause?: (time: number) => void;
  onSyncSeek?: (time: number) => void;
  /** External sync command — applies play/pause/seek from watch party */
  syncCommand?: { type: 'play' | 'pause' | 'seek'; time: number } | null;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  title,
  streamType,
  isMuted = false,
  volume = 100,
  autoPlay = true,
  className = '',
  onRefresh,
  onTogglePiP,
  onVideoEnd,
  onError,
  onSyncPlay,
  onSyncPause,
  onSyncSeek,
  syncCommand,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const isSeekingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [iframeSrc, setIframeSrc] = useState(url);
  const [captionsDisabled, setCaptionsDisabled] = useState(true);

  // Sync iframeSrc when url prop changes (fixes stream switching)
  useEffect(() => {
    setIframeSrc(url);
  }, [url]);

  // Apply CC-disable URL param on mount if captions start disabled
  useEffect(() => {
    if (captionsDisabled && isEmbedUrl) {
      const separator = url.includes('?') ? '&' : '?';
      setIframeSrc(`${url}${separator}cc=false`);
    }
  }, []); // mount only

  // Check whether this is a direct video/HLS stream (not an iframe embed)
  const isEmbedUrl =
    url.includes('pages.dev') ||
    url.includes('embed.st') ||
    url.includes('/embed/') ||
    url.includes('westream.su/embed') ||
    url.includes('adultembed.com') ||
    url.includes('eporner.com/embed') ||
    url.includes('pstream.cfd') ||
    url.includes('/api/bintv-proxy') ||
    streamType === 'embed';
  const isHls =
    streamType === 'hls' ||
    url.includes('.m3u8') ||
    url.includes('.ts') ||
    (!isEmbedUrl && !url.endsWith('.mp4') && !url.endsWith('.webm') && !url.endsWith('.mkv') && !url.includes('crazyshit.com') && !url.includes('mediav.'));


  // Try disabling captions via URL parameter for supported players
  useEffect(() => {
    if (!captionsDisabled || !isEmbedUrl) return;
    const separator = url.includes('?') ? '&' : '?';
    setIframeSrc(`${url}${separator}cc=false`);
  }, [captionsDisabled, isEmbedUrl, url]);

  useEffect(() => {
    setHasError(false);
    setIsLoading(true);

    const video = videoRef.current;

    // For iframe embeds, there's no video element to wait for
    if (isEmbedUrl) {
      // Hide loading after a short delay to allow iframe to start loading
      const timer = setTimeout(() => setIsLoading(false), 800);
      return () => clearTimeout(timer);
    }

    if (!video) return;

    // Destroy any existing Hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHls) {
      // HLS stream — use hls.js
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
        });
        hlsRef.current = hls;

        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          if (autoPlay) {
            video.play().catch(() => {
              video.muted = true;
              video.play().catch((e) => console.debug('Autoplay fallback', e));
            });
          }
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn('HLS Network Error, attempting recovery...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn('HLS Media Error, attempting recovery...');
                hls.recoverMediaError();
                break;
              default:
                console.warn('Unrecoverable HLS error — trying next fallback');
                setHasError(true);
                setErrorMessage('Stream unavailable or offline');
                hls.destroy();
                onError?.();
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          if (autoPlay) video.play().catch(console.debug);
        });
        video.addEventListener('error', () => {
          setHasError(true);
          setErrorMessage('Playback error on native video');
          onError?.();
        });
      } else {
        setHasError(true);
        setErrorMessage('HLS playback is not supported in this browser');
      }
    } else {
      // Direct video URL (MP4, WebM, etc.) — play natively
      video.src = url;
      video.addEventListener('loadeddata', () => {
        setIsLoading(false);
        if (autoPlay) {
          video.play().catch(() => {
            video.muted = true;
            video.play().catch((e) => console.debug('Autoplay fallback', e));
          });
        }
      });
      video.addEventListener('error', () => {
        setHasError(true);
        setErrorMessage('Video playback failed — the source may be offline or blocked.');
        onError?.();
      });
      video.addEventListener('ended', () => {
        if (onVideoEnd) {
          onVideoEnd();
        }
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.src = '';
      video.load();
    };
  }, [url, isHls, autoPlay]);

  // Sync mute & volume changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = volume / 100;
    }
  }, [isMuted, volume]);

  // Watch party sync command handler
  useEffect(() => {
    if (!syncCommand || !videoRef.current || isEmbedUrl) return;
    const video = videoRef.current;
    switch (syncCommand.type) {
      case 'play':
        video.currentTime = syncCommand.time;
        video.play().catch(() => { video.muted = true; video.play(); });
        setIsPlaying(true);
        onSyncPlay?.(syncCommand.time);
        break;
      case 'pause':
        video.pause();
        setIsPlaying(false);
        onSyncPause?.(syncCommand.time);
        break;
      case 'seek':
        video.currentTime = syncCommand.time;
        onSyncSeek?.(syncCommand.time);
        break;
    }
  }, [syncCommand, isEmbedUrl]);

  // Handle iframe reload for watch party sync (embed streams)
  useEffect(() => {
    if (!syncCommand || !isEmbedUrl) return;
    const separator = url.includes('?') ? '&' : '?';
    setIframeSrc(`${url}${separator}t=${Math.floor(syncCommand.time)}`);
  }, [syncCommand, url, isEmbedUrl]);

  // Time update tracking for progress bar
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isEmbedUrl) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration || 0);
    const onTimeUpdate = () => {
      if (!isSeekingRef.current) setCurrentTime(video.currentTime);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('durationchange', updateDuration);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('durationchange', updateDuration);
    };
  }, [url, isEmbedUrl]);

  // Seek handler
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current || isEmbedUrl) return;
    isSeekingRef.current = true;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = ratio * (videoRef.current.duration || 0);
    videoRef.current.currentTime = newTime;
    onSyncSeek?.(newTime);
    setTimeout(() => { isSeekingRef.current = false; }, 100);
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isSeekingRef.current = true;
    handleSeek(e);
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(ratio * (videoRef.current.duration || 0));
  };

  const handleProgressMouseLeave = () => {
    setHoverTime(null);
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      onSyncPlay?.(videoRef.current.currentTime);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      onSyncPause?.(videoRef.current.currentTime);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handleTogglePiP = async () => {
    if (onTogglePiP) {
      onTogglePiP();
      return;
    }
    if (document.pictureInPictureEnabled && videoRef.current) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('Native PiP failed', err);
      }
    }
  };

  return (
    <div className={`relative w-full h-full bg-black overflow-hidden flex items-center justify-center group ${className} ${captionsDisabled ? 'captions-off' : ''}`}>
      {/* Video Rendering */}
      {isEmbedUrl ? (
        <div className="relative w-full h-full">
          <iframe
            src={iframeSrc}
            title={title}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <video
          ref={videoRef}
          playsInline
          className="w-full h-full object-contain"
          onClick={handleTogglePlay}
        />
      )}

      {/* Loading state */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-slate-400 z-10">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mb-2" />
          <span className="text-xs font-mono">Connecting to live feed...</span>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 bg-black/85 p-4 flex flex-col items-center justify-center text-center text-slate-300 z-10">
          <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
          <p className="text-xs font-semibold text-white">{errorMessage}</p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
            This stream channel may be currently offline or cycling keys.
          </p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Stream</span>
            </button>
          )}
        </div>
      )}

      {/* Hover Video Controls Overlay — hidden for embed URLs so iframe controls stay accessible */}
      {!isEmbedUrl && (
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 text-white text-xs z-30">
        {/* Progress Bar — only for non-HLS, non-embed (VOD) content */}
        {!isHls && !isEmbedUrl && duration > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-300 w-12 text-right shrink-0">{formatTime(currentTime)}</span>
            <div
              ref={progressRef}
              className="flex-1 h-1.5 bg-slate-700/80 rounded-full cursor-pointer group/progress relative"
              onMouseDown={handleProgressMouseDown}
              onMouseMove={handleProgressMouseMove}
              onMouseLeave={handleProgressMouseLeave}
            >
              {/* Buffered range (optional visual) */}
              <div className="absolute inset-0 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-500/40 rounded-full"
                  style={{ width: `${Math.min(100, ((currentTime + 10) / duration) * 100)}%` }}
                />
              </div>
              {/* Playhead */}
              <div
                className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-[width] duration-150"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              {/* Hover preview thumb */}
              {hoverTime !== null && (
                <div
                  className="absolute -top-7 px-1.5 py-0.5 bg-slate-900 text-white text-[10px] font-mono rounded pointer-events-none whitespace-nowrap border border-slate-700"
                  style={{ left: `calc(${((hoverTime / duration) * 100)}% - 20px)` }}
                >
                  {formatTime(hoverTime)}
                </div>
              )}
              {/* Thumb dot on hover */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none"
                style={{ left: `calc(${(currentTime / duration) * 100}% - 6px)` }}
              />
            </div>
            <span className="text-[11px] font-mono text-slate-400 w-12 shrink-0">{formatTime(duration)}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isHls && (
              <button
                onClick={handleTogglePlay}
                className="p-1 hover:text-blue-400 transition-colors"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
              </button>
            )}

            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              {isHls ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-blue-400 font-semibold">LIVE</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-green-400 font-semibold">VOD</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* PiP Button */}
            <button
              onClick={handleTogglePiP}
              className="p-1 text-slate-300 hover:text-blue-400 transition-colors"
              title="Picture-in-Picture"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={handleFullscreen}
              className="p-1 text-slate-300 hover:text-blue-400 transition-colors"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Permanent CC Toggle — always visible for iframe embeds */}
      <button
        onClick={() => setCaptionsDisabled((v) => !v)}
        className={`absolute bottom-2 right-2 z-40 p-1.5 rounded-lg backdrop-blur-sm transition-all ${
          captionsDisabled
            ? 'bg-blue-600/80 text-white shadow-lg shadow-blue-600/30'
            : 'bg-black/50 text-slate-400 hover:text-white hover:bg-black/70'
        }`}
        title={captionsDisabled ? 'Enable captions' : 'Disable captions'}
      >
        {captionsDisabled ? <CaptionsOff className="w-3.5 h-3.5" /> : <Captions className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};
