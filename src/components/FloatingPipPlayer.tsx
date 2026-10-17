import React, { useState, useRef, useEffect } from 'react';
import {
  Maximize2,
  X,
  Volume2,
  VolumeX,
  PictureInPicture2,
  Radio,
  Move,
} from 'lucide-react';
import { StreamItem } from '../types/stream';
import { VideoPlayer } from './VideoPlayer';

interface FloatingPipPlayerProps {
  stream: StreamItem;
  embedUrl: string;
  onExpandToFullPlayer: () => void;
  onClose: () => void;
}

const DEFAULT_X = window.innerWidth - 340;
const DEFAULT_Y = window.innerHeight - 400;

export const FloatingPipPlayer: React.FC<FloatingPipPlayerProps> = ({
  stream,
  embedUrl,
  onExpandToFullPlayer,
  onClose,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [pos, setPos] = useState({ x: DEFAULT_X, y: DEFAULT_Y });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep window size in sync
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => ({
        x: Math.min(prev.x, window.innerWidth - 200),
        y: Math.min(prev.y, window.innerHeight - 300),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragOffset.current = {
      x: clientX - pos.x,
      y: clientY - pos.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      setPos({
        x: Math.max(0, Math.min(newX, window.innerWidth - 200)),
        y: Math.max(0, Math.min(newY, window.innerHeight - 300)),
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !e.touches[0]) return;
      const newX = e.touches[0].clientX - dragOffset.current.x;
      const newY = e.touches[0].clientY - dragOffset.current.y;
      setPos({
        x: Math.max(0, Math.min(newX, window.innerWidth - 200)),
        y: Math.max(0, Math.min(newY, window.innerHeight - 300)),
      });
    };

    const handleTouchEnd = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className="fixed shadow-2xl rounded-2xl overflow-hidden group"
      style={{
        zIndex: 9999,
        left: pos.x,
        top: pos.y,
        width: 340,
        pointerEvents: isDragging ? 'none' : 'auto',
        cursor: 'grab',
        opacity: 1,
        transition: 'none',
      }}
      onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
      onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
    >
      {/* Drag handle bar */}
      <div className="h-1 bg-gradient-to-r from-blue-600/40 via-purple-500/40 to-blue-600/40" />

      {/* PiP Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/95 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2 truncate pr-2 flex-1">
          <span className="flex items-center justify-center w-5 h-5 rounded bg-blue-600/20 text-blue-400 shrink-0">
            <Radio className="w-3 h-3 animate-pulse" />
          </span>
          <span className="font-semibold text-slate-100 truncate text-[11px] sm:text-xs">
            {stream.title}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Mute toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
            className="min-h-11 min-w-11 p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors touch-manipulation"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Expand to Full Theater Player */}
          <button
            onClick={(e) => { e.stopPropagation(); onExpandToFullPlayer(); }}
            className="min-h-11 min-w-11 p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors touch-manipulation"
            title="Expand to Full Player"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Close PiP */}
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="min-h-11 min-w-11 p-1.5 text-slate-400 hover:text-blue-400 rounded hover:bg-slate-800 transition-colors touch-manipulation"
            title="Close Picture-in-Picture"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Video Content Canvas */}
      <div className="relative aspect-video w-full bg-black cursor-grab">
        <VideoPlayer
          url={embedUrl}
          title={stream.title}
          streamType={stream.streamType}
          isMuted={isMuted}
          volume={volume}
          autoPlay={true}
        />
      </div>

      {/* PiP Footer Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="px-3 py-1.5 bg-slate-950/80 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-400 cursor-grab"
      >
        <span className="flex items-center gap-1 font-mono uppercase text-blue-400">
          <PictureInPicture2 className="w-3 h-3" />
          <span>PIP</span>
          <Move className="w-3 h-3 ml-1 opacity-50" />
        </span>
        <span className="text-slate-500">Drag to move</span>
      </div>
    </div>
  );
};