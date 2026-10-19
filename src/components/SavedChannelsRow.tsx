import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Bookmark, Loader2, ExternalLink } from 'lucide-react';
import { YouTubeStream, SavedChannel } from '../types/stream';
import { fetchChannelVideos, fmtDuration } from '../services/youtubeService';

interface SavedChannelsRowProps {
  savedChannels: SavedChannel[];
  onRemoveChannel: (handle: string) => void;
  onOpenVideo: (stream: YouTubeStream) => void;
  onOpenChannel: (handle: string) => void;
}

interface ChannelVideo {
  stream: YouTubeStream;
  channel: SavedChannel;
}

export const SavedChannelsRow: React.FC<SavedChannelsRowProps> = ({
  savedChannels,
  onRemoveChannel,
  onOpenVideo,
  onOpenChannel,
}) => {
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch latest video from each saved channel (NewPipe)
  useEffect(() => {
    let cancelled = false;
    if (savedChannels.length === 0) {
      setVideos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(
      savedChannels.map(async (ch) => {
        const vids = await fetchChannelVideos(ch.handle, 1);
        if (vids.length > 0) {
          return { stream: vids[0], channel: ch };
        }
        return null;
      })
    ).then((results) => {
      if (!cancelled) {
        setVideos(results.filter(Boolean) as ChannelVideo[]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [savedChannels]);

  const rowRef = React.useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') => {
    if (rowRef.current) {
      const amount = rowRef.current.clientWidth * 0.75;
      rowRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
    }
  };

  if (savedChannels.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">
          <Bookmark className="w-5 h-5 text-red-400" />
          From Your Saved Channels
          <span className="text-sm font-mono text-slate-400 font-medium">
            ({savedChannels.length})
          </span>
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-slate-400 py-8">
          <Loader2 className="w-5 h-5 animate-spin text-red-400" />
          <span className="text-sm">Fetching latest uploads from your channels…</span>
        </div>
      ) : (
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
            {videos.length === 0 ? (
              <p className="text-slate-500 text-sm py-6">
                No recent videos found from your saved channels yet.
              </p>
            ) : (
              videos.map(({ stream, channel }) => (
                <div
                  key={`${channel.handle}-${stream.id}`}
                  className="w-[200px] sm:w-[240px] shrink-0 bg-[#0f121a] border border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-red-500/50 transition-all hover:-translate-y-1.5 group/card shadow-lg relative"
                >
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
                    {/* Channel avatar + name overlay */}
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5">
                      <img
                        src={channel.avatar}
                        alt={channel.name}
                        className="w-5 h-5 rounded-full border border-slate-500"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[10px] font-bold text-white drop-shadow">
                        {channel.name}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5">
                    <p
                      className="text-xs font-bold text-slate-100 line-clamp-2 leading-snug group-hover/card:text-red-300 transition-colors cursor-pointer"
                      onClick={() => onOpenVideo(stream)}
                    >
                      {stream.title}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span
                        className="text-[10px] text-slate-500 font-mono cursor-pointer hover:text-red-400 transition-colors"
                        onClick={() => onOpenChannel(channel.handle)}
                      >
                        {channel.subscribers} subs
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveChannel(channel.handle);
                        }}
                        className="text-[10px] text-slate-500 hover:text-red-400 transition-colors font-bold"
                        title="Remove from saved channels"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-[#0a0f1a]/90 border border-red-500/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600/80"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
