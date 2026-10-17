import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Maximize2,
  X,
  Volume2,
  VolumeX,
  PictureInPicture2,
  Radio,
  Move,
  Scaling,
} from 'lucide-react';
import { StreamItem } from '../types/stream';
import { VideoPlayer } from './VideoPlayer';

interface FloatingPipPlayerProps {
  stream: StreamItem;
  embedUrl: string;
  onExpandToFullPlayer: () => void;
  onClose: () => void;
  /** Index of this PiP among all open PiPs (for staggered placement) */
  index?: number;
  /** Total number of open PiPs */
  total?: number;
}

const MIN_W = 260;
const MIN_H = 200;
const DEFAULT_W = 340;

const storageKey = (id: string) => `streamgrid_pip_pos_${id}`;

interface PipState {
  x: number;
  y: number;
  w: number;
}

const loadPipState = (id: string, index: number): PipState => {
  // Try persisted position first
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (raw) {
      const saved = JSON.parse(raw);
      if (typeof saved.x === 'number' && typeof saved.y === 'number') {
        return {
          x: Math.max(0, Math.min(saved.x, window.innerWidth - 120)),
          y: Math.max(0, Math.min(saved.y, window.innerHeight - 100)),
          w: Math.max(MIN_W, Math.min(saved.w || DEFAULT_W, window.innerWidth - 20)),
        };
      }
    }
  } catch {
    // ignore corrupted storage
  }
  // Staggered default position so multiple PiPs don't overlap
  const offset = (index % 8) * 28;
  return {
    x: Math.max(16, window.innerWidth - DEFAULT_W - 24 - offset),
    y: Math.max(16, window.innerHeight - 320 - 24 - offset),
    w: DEFAULT_W,
  };
};

export const FloatingPipPlayer: React.FC<FloatingPipPlayerProps> = ({
  stream,
  embedUrl,
  onExpandToFullPlayer,
  onClose,
  index = 0,
  total = 1,
}) => {
  const [isMuted, setIsMuted] = useState(index > 0); // additional PiPs start muted
  const [volume] = useState(100);
  const [size, setSize] = useState<PipState>(() => loadPipState(stream.id, index));
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist position & size
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(stream.id), JSON.stringify(size));
    } catch {
      // storage full or unavailable — non-fatal
    }
  }, [size, stream.id]);

  // Keep PiP on screen when window resizes
  useEffect(() => {
    const handleResize = () => {
      setSize((prev) => ({
        ...prev,
        x: Math.max(0, Math.min(prev.x, window.innerWidth - 120)),
        y: Math.max(0, Math.min(prev.y, window.innerHeight - 100)),
        w: Math.max(MIN_W, Math.min(prev.w, window.innerWidth - 20)),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDragStart = useCallback(
    (clientX: number, clientY: number) => {
      if (isResizing) return;
      setIsDragging(true);
      dragOffset.current = { x: clientX - size.x, y: clientY - size.y };
    },
    [isResizing, size.x, size.y]
  );

  const handleResizeStart = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      resizeStart.current = {
        x: clientX,
        y: clientY,
        w: rect?.width || size.w,
        h: rect?.height || 0,
      };
      setIsResizing(true);
    },
    [size.w]
  );

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setSize((prev) => ({
          ...prev,
          x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 120)),
          y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 60)),
        }));
      } else if (isResizing) {
        const newW = Math.max(
          MIN_W,
          Math.min(resizeStart.current.w + (e.clientX - resizeStart.current.x), window.innerWidth - 20)
        );
        setSize((prev) => ({ ...prev, w: newW }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (isDragging) {
        e.preventDefault();
        setSize((prev) => ({
          ...prev,
          x: Math.max(0, Math.min(t.clientX - dragOffset.current.x, window.innerWidth - 120)),
          y: Math.max(0, Math.min(t.clientY - dragOffset.current.y, window.innerHeight - 60)),
        }));
      } else if (isResizing) {
        e.preventDefault();
        const newW = Math.max(
          MIN_W,
          Math.min(resizeStart.current.w + (t.clientX - resizeStart.current.x), window.innerWidth - 20)
        );
        setSize((prev) => ({ ...prev, w: newW }));
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

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
  }, [isDragging, isResizing]);

  const active = isDragging || isResizing;

  return (
    <div
      ref={containerRef}
      className={`fixed rounded-2xl bg-[#0e111a] border shadow-2xl overflow-hidden group ${
        active ? 'border-blue-500/60' : 'border-slate-700/80'
      }`}
      style={{
        zIndex: 9999 + index,
        left: size.x,
        top: size.y,
        width: size.w,
        pointerEvents: isDragging ? 'none' : 'auto',
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      onMouseDown={(e) => {
        // Only drag from header/footer areas, not from buttons or video
        const target = e.target as HTMLElement;
        if (target.closest('button')) return;
        handleDragStart(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button')) return;
        const t = e.touches[0];
        if (t) handleDragStart(t.clientX, t.clientY);
      }}
    >
      {/* Drag handle bar */}
      <div className="h-1.5 bg-gradient-to-r from-blue-600/50 via-purple-500/50 to-blue-600/50 cursor-grab active:cursor-grabbing" style={{ touchAction: 'none' }} />

      {/* PiP Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-slate-900/95 border-b border-slate-800 text-xs cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button')) return;
          handleDragStart(e.clientX, e.clientY);
        }}
      >
        <div className="flex items-center gap-2 truncate pr-2 flex-1">
          <span className="flex items-center justify-center w-5 h-5 rounded bg-blue-600/20 text-blue-400 shrink-0">
            <Radio className="w-3 h-3 animate-pulse" />
          </span>
          <span className="font-semibold text-slate-100 truncate text-[11px] sm:text-xs">
            {total > 1 && <span className="text-blue-400 font-bold mr-1">{index + 1}.</span>}
            {stream.title}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
          {/* Mute toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors touch-manipulation"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Expand to Full Theater Player */}
          <button
            onClick={onExpandToFullPlayer}
            className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors touch-manipulation"
            title="Expand to Full Player"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Close PiP */}
          <button
            onClick={onClose}
            className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-blue-400 rounded hover:bg-slate-800 transition-colors touch-manipulation"
            title="Close Picture-in-Picture"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Video Content Canvas */}
      <div className="relative aspect-video w-full bg-black">
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
        className="relative px-3 py-1.5 bg-slate-950/80 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-400 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button')) return;
          handleDragStart(e.clientX, e.clientY);
        }}
      >
        <span className="flex items-center gap-1 font-mono uppercase text-blue-400">
          <PictureInPicture2 className="w-3 h-3" />
          <span>PIP{total > 1 ? ` ${index + 1}/${total}` : ''}</span>
          <Move className="w-3 h-3 ml-1 opacity-50" />
        </span>
        <span className="text-slate-500 hidden sm:inline">Drag to move</span>

        {/* Resize handle (bottom-right corner) */}
        <div
          className="absolute right-0 bottom-0 w-5 h-5 cursor-nwse-resize flex items-end justify-end p-0.5"
          onMouseDown={(e) => {
            e.stopPropagation();
            handleResizeStart(e.clientX, e.clientY);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            const t = e.touches[0];
            if (t) handleResizeStart(t.clientX, t.clientY);
          }}
          title="Drag to resize"
        >
          <Scaling className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </div>
  );
};
