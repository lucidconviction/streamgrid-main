import React, { useState } from 'react';
import {
  Maximize2,
  X,
  Volume2,
  VolumeX,
  PictureInPicture2,
  Radio,
  Tv,
} from 'lucide-react';
import { StreamItem } from '../types/stream';
import { VideoPlayer } from './VideoPlayer';

interface FloatingPipPlayerProps {
  stream: StreamItem;
  embedUrl: string;
  onExpandToFullPlayer: () => void;
  onClose: () => void;
}

export const FloatingPipPlayer: React.FC<FloatingPipPlayerProps> = ({
  stream,
  embedUrl,
  onExpandToFullPlayer,
  onClose,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 rounded-2xl bg-[#0e111a] border border-slate-700/80 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 group">
      {/* PiP Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/95 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2 truncate pr-2">
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
            onClick={() => setIsMuted(!isMuted)}
            className="min-h-11 min-w-11 p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors touch-manipulation"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Expand to Full Theater Player */}
          <button
            onClick={onExpandToFullPlayer}
            className="min-h-11 min-w-11 p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors touch-manipulation"
            title="Expand to Full Player"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Close PiP */}
          <button
            onClick={onClose}
            className="min-h-11 min-w-11 p-1.5 text-slate-400 hover:text-blue-400 rounded hover:bg-slate-800 transition-colors touch-manipulation"
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
        onClick={onExpandToFullPlayer}
        className="px-3 py-1.5 bg-slate-950/80 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-400 cursor-pointer hover:text-slate-200 transition-colors"
      >
        <span className="flex items-center gap-1 font-mono uppercase text-blue-400">
          <PictureInPicture2 className="w-3 h-3" />
          <span>Picture-in-Picture</span>
        </span>
        <span className="text-slate-500 hover:text-slate-300">Click to expand ↑</span>
      </div>
    </div>
  );
};
