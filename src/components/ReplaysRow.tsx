import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock, Play, Bookmark } from 'lucide-react';
import { ReplayVideo, fetchReplays, formatDuration, formatViews } from '../services/replaysService';
import { StreamItem } from '../types/stream';

const SPORT_IDS = ['ufc', 'nfl', 'nba', 'nhl', 'mlb'] as const;

interface ReplaysRowProps {
  onPlayStream: (stream: StreamItem) => void;
  watchlistIds: string[];
  onToggleWatchlist: (videoId: string) => void;
  onViewAll: () => void;
}

export const ReplaysRow: React.FC<ReplaysRowProps> = ({
  onPlayStream,
  watchlistIds,
  onToggleWatchlist,
  onViewAll,
}) => {
  const [videos, setVideos] = useState<ReplayVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoading(true);
    Promise.allSettled(SPORT_IDS.map((sportId) => fetchReplays(sportId)))
      .then((results) => {
        const all: ReplayVideo[] = [];
        for (const r of results) {
          if (r.status === 'fulfilled') {
            all.push(...r.value);
          }
        }
        const seen = new Set<string>();
        setVideos(all.filter((v) => {
          if (seen.has(v.videoId)) return false;
          seen.add(v.videoId);
          return true;
        }));
      })
      .finally(() => setIsLoading(false));
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const amount = rowRef.current.clientWidth * 0.75;
      rowRef.current.scrollBy({
        left: direction === 'left' ? -amount : amount,
        behavior: 'smooth',
      });
    }
  };

  const toStreamItem = (v: ReplayVideo): StreamItem => ({
    id: `replay-${v.videoId}`,
    title: v.title,
    category: `Replay Highlights — ${v.sport.toUpperCase()}`,
    poster: v.thumbnail,
    provider: 'streamed',
    status: 'offline',
    directEmbedUrl: v.embedUrl,
    bgVideoUrl: v.embedUrl,
    viewers: v.views,
  });

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">
            Sports Replays & Highlights
          </h2>
          <p className="text-sm text-slate-400 mt-0.5 font-medium">
            UFC, NFL, NBA, NHL, MLB — full game highlights and recaps
          </p>
        </div>
        <button
          onClick={onViewAll}
          className="text-sm font-bold text-red-400 hover:text-red-300 transition-colors"
        >
          View All →
        </button>
      </div>

      <div className="relative group">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-[#0a0f1a]/90 border border-red-500/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600/80"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-[#0a0f1a]/90 border border-red-500/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600/80"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div
          ref={rowRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-2"
        >
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[350px] sm:w-[400px] rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse">
                <div className="aspect-video bg-slate-800 rounded-t-xl" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-slate-800 rounded w-3/4" />
                  <div className="h-3 bg-slate-800 rounded w-1/2" />
                </div>
              </div>
            ))
          ) : videos.length === 0 ? (
            <div className="flex-1 py-12 text-center text-slate-500 text-sm">
              No replays available right now. Try again later.
            </div>
          ) : (
            videos.map((video) => {
              const stream = toStreamItem(video);
              const isWatchlisted = watchlistIds.includes(video.videoId);
              return (
                <div
                  key={video.id}
                  className="flex-shrink-0 w-[350px] sm:w-[400px] group/card relative rounded-xl bg-slate-900/60 border border-slate-800 hover:border-red-500/50 overflow-hidden transition-all hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                  onClick={() => onPlayStream(stream)}
                >
                  <div className="relative aspect-video bg-slate-800 overflow-hidden">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <span className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded bg-black/70 text-white backdrop-blur-sm">
                      {video.sport.toUpperCase()}
                    </span>
                    {video.duration > 0 && (
                      <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(video.duration)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity shadow-lg scale-90 group-hover/card:scale-100">
                        <Play className="w-5 h-5 text-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    <h3 className="text-sm font-bold text-white line-clamp-2 mb-1.5 group-hover/card:text-red-300 transition-colors leading-snug">
                      {video.title}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-medium text-slate-300 truncate max-w-[60%]">
                        {video.uploader}
                      </span>
                      {video.views > 0 && (
                        <span className="shrink-0">{formatViews(video.views)} views</span>
                      )}
                    </div>
                    {video.uploadDate && (
                      <span className="text-[10px] text-slate-500 mt-1 block">{video.uploadDate}</span>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWatchlist(video.videoId);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 transition-colors opacity-0 group-hover/card:opacity-100 z-20"
                    title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                  >
                    <Bookmark
                      className={`w-3.5 h-3.5 ${
                        isWatchlisted
                          ? 'fill-blue-500 text-blue-400'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>

                  <div className="absolute inset-0 z-10" />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
