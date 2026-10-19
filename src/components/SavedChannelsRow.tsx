import React from 'react';
import { ChevronLeft, ChevronRight, Bookmark, Loader2, ExternalLink } from 'lucide-react';
import { YouTubeStream, SavedChannelWithVideos } from '../types/stream';
import { fmtDuration } from '../services/youtubeService';

interface SavedChannelsRowProps {
  channels: SavedChannelWithVideos[];
  onRemoveChannel: (handle: string) => void;
  onOpenVideo: (stream: YouTubeStream) => void;
  onOpenChannel: (handle: string) => void;
}

export const SavedChannelsRow: React.FC<SavedChannelsRowProps> = ({
  channels,
  onRemoveChannel,
  onOpenVideo,
  onOpenChannel,
}) => {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') => {
    if (rowRef.current) {
      const amount = rowRef.current.clientWidth * 0.75;
      rowRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
    }
  };

  if (channels.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">
          <Bookmark className="w-5 h-5 text-red-400" />
          From Your Saved Channels
          <span className="text-sm font-mono text-slate-400 font-medium">
            ({channels.length})
          </span>
        </h2>
      </div>

      <div className="relative group">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-[#0a0f1a]/90 border border-red-500/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600/80"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div
          ref={rowRef}
          className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-2 px-1"
        >
          {channels.map((ch) => (
            <div
              key={ch.handle}
              className="w-[200px] sm:w-[240px] shrink-0 bg-[#0f121a] border border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-red-500/50 transition-all hover:-translate-y-1.5 group/card shadow-lg relative"
            >
              {/* Channel header */}
              <div
                className="flex items-center gap-2 p-2.5 border-b border-slate-800 cursor-pointer"
                onClick={() => onOpenChannel(ch.handle)}
              >
                <img
                  src={ch.avatar || `/src/assets/images/hero_championship_live_1792048678438.jpg`}
                  alt={ch.name}
                  className="w-7 h-7 rounded-full border border-slate-600"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-white truncate">{ch.name}</p>
                  <p className="text-[9px] text-slate-500 font-mono">{ch.subscribers} subs</p>
                </div>
                <ExternalLink className="w-3 h-3 text-slate-600 shrink-0" />
              </div>

              {/* Latest video */}
              {ch.loading ? (
                <div className="h-[110px] flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-red-400 animate-spin" />
                </div>
              ) : ch.videos.length > 0 ? (
                ch.videos.map((stream) => (
                  <div key={stream.id} className="relative">
                    <div
                      className="relative aspect-video w-full bg-slate-900 cursor-pointer"
                      onClick={() => onOpenVideo(stream)}
                    >
                      <img
                        src={stream.thumbnail}
                        alt={stream.title}
                        className="w-full h-full object-cover group-hover/card:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                      {stream.status === 'live' && (
                        <span className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-black">
                          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                          LIVE
                        </span>
                      )}
                      {stream.durationSeconds != null && stream.durationSeconds > 0 && (
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 text-white text-[9px] font-mono">
                          {fmtDuration(stream.durationSeconds)}
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p
                        className="text-xs font-bold text-slate-100 line-clamp-2 leading-snug group-hover/card:text-red-300 transition-colors cursor-pointer"
                        onClick={() => onOpenVideo(stream)}
                      >
                        {stream.title}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-[110px] flex items-center justify-center text-slate-600 text-xs">
                  No recent videos
                </div>
              )}

              {/* Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveChannel(ch.handle);
                }}
                className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full bg-slate-900/80 text-slate-400 hover:text-red-400 hover:bg-red-500/20 transition-colors text-[10px] font-bold opacity-0 group-hover/card:opacity-100"
                title="Remove from saved channels"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-[#0a0f1a]/90 border border-red-500/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600/80"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};