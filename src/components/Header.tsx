import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StreamItem } from '../types/stream';
import Hls from 'hls.js';

interface HeaderProps {
  onNavigate: (view: string) => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  liveStreams: StreamItem[];
  onPlayStream: (stream: StreamItem) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  onToggleSidebar,
  sidebarOpen,
  liveStreams,
  onPlayStream,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [currentBgStream, setCurrentBgStream] = useState<StreamItem | null>(null);
  const [bgReady, setBgReady] = useState(false);

  // Pick the first available live stream for instant playback
  const pickBgStream = useCallback(() => {
    const live = liveStreams.filter(s => s.directEmbedUrl && s.status === 'live');
    return live.length > 0 ? live[0] : null;
  }, [liveStreams]);

  // Set up HLS background player — fires immediately on mount
  const setupBgPlayer = useCallback((stream: StreamItem) => {
    const video = videoRef.current;
    if (!video) return;

    const url = stream.directEmbedUrl || '';
    if (!url) { setBgReady(true); return; }

    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    video.pause();
    video.removeAttribute('src');
    video.load();
    video.muted = true;
    video.volume = 0;

    if (Hls.isSupported() && url.includes('.m3u8')) {
      const hls = new Hls({
        maxBufferLength: 16,
        maxMaxBufferLength: 32,
        startLevel: 0,
        lowLatencyMode: true,
        liveDurationInfinity: true,
        manifestLoadingTimeOut: 3000,
        levelLoadingTimeOut: 3000,
        fragLoadingTimeOut: 3000,
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
        setBgReady(true);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              hlsRef.current = null;
              setBgReady(false);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play().catch(() => {}).finally(() => setBgReady(true));
    } else {
      setBgReady(true);
    }
  }, []);

  // Start playing immediately when streams load
  useEffect(() => {
    if (liveStreams.length === 0) return;

    const stream = pickBgStream();
    if (stream) {
      setCurrentBgStream(stream);
      setupBgPlayer(stream);
    }
  }, [liveStreams]);

  return (
    <>
      {/* Background Live Stream Player */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover opacity-35"
          muted
          playsInline
          autoPlay
          loop
          preload="auto"
        />
        {/* Gradient overlay — reduced opacity so video shows through */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050810]/70 via-[#050810]/50 to-[#050810]/70" />
        {!bgReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-500/60 border-t-blue-400/80 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Header Bar */}
      <header className="sticky top-0 z-50 w-full glass-panel border-b border-blue-500/20 transition-colors">
        <div className="flex items-center justify-between gap-4 px-3 sm:px-4 py-3">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2 text-left group focus:outline-none"
            >
              <img
                src="/src/assets/images/logo.png"
                alt="RdNutz TV"
                className="w-8 h-8 rounded-lg object-contain shadow-md shadow-blue-500/30"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div
                className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-sky-400 flex items-center justify-center text-white shadow-md shadow-blue-500/30 neon-glow-blue"
                style={{ display: 'none' }}
              >
                <span className="text-sm font-bold">R</span>
              </div>
              <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
                <span className="text-yellow-400">RdNutz</span>
                <span className="text-orange-400">TV</span>
                <span className="text-slate-400 text-sm font-medium ml-0.5">Streams</span>
              </span>
            </button>
          </div>

          {/* Right: Sidebar Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSidebar}
              className={`p-2 rounded-lg transition-colors ${
                sidebarOpen
                  ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
