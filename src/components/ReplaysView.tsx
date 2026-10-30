import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Play, RefreshCw, Bookmark } from 'lucide-react';
import { ReplayVideo, fetchReplays, SPORTS, formatDuration, formatViews } from '../services/replaysService';

interface ReplaysViewProps {
  activeProfileId: string;
  onPlayVideo: (video: ReplayVideo) => void;
  watchlistIds: string[];
  onToggleWatchlist: (videoId: string) => void;
}

export const ReplaysView: React.FC<ReplaysViewProps> = ({
  activeProfileId,
  onPlayVideo,
  watchlistIds,
  onToggleWatchlist,
}) => {
  const [selectedSport, setSelectedSport] = useState<string>('nba');
  const [replays, setReplays] = useState<ReplayVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetchReplays(selectedSport)
      .then((results) => setReplays(results))
      .finally(() => setIsLoading(false));
  }, [selectedSport]);

  return (
    <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-600/25 border border-red-500/50 flex items-center justify-center">
            <Play className="w-5 h-5 text-red-300" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Sports Replays</h1>
            <p className="text-xs text-slate-400">Full game highlights & recaps from official channels</p>
          </div>
        </div>
        <button
          onClick={() => {
            setIsLoading(true);
            fetchReplays(selectedSport)
              .then((results) => setReplays(results))
              .finally(() => setIsLoading(false));
          }}
          disabled={isLoading}
          className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Sport Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SPORTS.map((sport) => (
          <button
            key={sport.id}
            onClick={() => setSelectedSport(sport.id)}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold border transition-all ${
              selectedSport === sport.id
                ? 'bg-red-600 border-red-500 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            {sport.icon} {sport.label}
          </button>
        ))}
      </div>

      {isLoading && replays.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40 animate-pulse" />
          Loading replays...
        </div>
      ) : replays.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
          No replays found for this sport.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {replays.map((video) => (
            <div
              key={video.id}
              className="group relative rounded-xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/50 overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-slate-800 overflow-hidden">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                {/* Duration badge */}
                {video.duration > 0 && (
                  <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(video.duration)}
                  </div>
                )}
                {/* Play button overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-blue-600/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-3">
                <h3 className="text-sm font-bold text-white line-clamp-2 mb-1.5 group-hover:text-blue-300 transition-colors">
                  {video.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium text-slate-300">{video.uploader}</span>
                  <span>{formatViews(video.views)} views</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] text-slate-500">{video.uploadDate}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWatchlist(video.videoId);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                    title={watchlistIds.includes(video.videoId) ? 'Remove from watchlist' : 'Add to watchlist'}
                  >
                    <Bookmark
                      className={`w-4 h-4 ${
                        watchlistIds.includes(video.videoId)
                          ? 'fill-blue-500 text-blue-400'
                          : 'text-slate-400'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Click to play */}
              <button
                onClick={() => onPlayVideo(video)}
                className="absolute inset-0 z-10"
                aria-label={`Play ${video.title}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};