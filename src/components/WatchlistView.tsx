import React, { useState } from 'react';
import {
  Bookmark,
  Bell,
  BellRing,
  Play,
  LayoutGrid,
  Radio,
  CheckCircle,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { StreamItem } from '../types/stream';
import { StreamCard } from './StreamCard';
import { notificationService } from '../services/notificationService';

interface WatchlistViewProps {
  watchlistStreams: StreamItem[];
  onPlayStream: (stream: StreamItem) => void;
  onAddToMultiview: (stream: StreamItem) => void;
  onToggleWatchlist: (stream: StreamItem) => void;
  multiviewStreamIds: string[];
  onNavigateHome: () => void;
  onSimulateLiveTransition: (stream: StreamItem) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlistStreams,
  onPlayStream,
  onAddToMultiview,
  onToggleWatchlist,
  multiviewStreamIds,
  onNavigateHome,
  onSimulateLiveTransition,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>(
    notificationService.getPermission()
  );
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming'>('all');

  const handleRequestPermission = async () => {
    const res = await notificationService.requestPermission();
    setPermission(res);
  };

  const filteredStreams = watchlistStreams.filter((s) => {
    if (filter === 'live') return s.status === 'live' || s.status === '24/7';
    if (filter === 'upcoming') return s.status === 'upcoming' || s.status === 'offline';
    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <Bookmark className="w-6 h-6 text-blue-400 fill-blue-500" />
            <h1 className="text-2xl font-bold tracking-tight text-white">Your Watchlist</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Pinned sports matches, priority tournaments, and favorite 24/7 channels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 px-3 py-1.5 bg-slate-900 rounded-lg border border-slate-800">
            {watchlistStreams.length} Saved
          </span>
        </div>
      </div>

      {/* Live Stream Notification Alert Banner */}
      <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-blue-950/30 via-slate-900 to-[#0f121a] border border-blue-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 mt-0.5 sm:mt-0">
            <BellRing className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Live Broadcast Alerts</h3>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold">
                Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Instant toast alert and browser notification with sound chime when an offline or upcoming match goes live.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto shrink-0">
          {permission === 'granted' ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono px-3 py-1.5 bg-emerald-950/40 rounded-lg border border-emerald-800/60">
              <CheckCircle className="w-3.5 h-3.5" />
              Desktop Alerts On
            </span>
          ) : (
            <button
              onClick={handleRequestPermission}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
            >
              <Bell className="w-3.5 h-3.5 text-blue-400" />
              <span>Enable Browser Alerts</span>
            </button>
          )}

          {watchlistStreams.length > 0 && (
            <button
              onClick={() => onSimulateLiveTransition(watchlistStreams[0])}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all hover:scale-105 active:scale-95"
              title="Test the offline-to-live toast and sound notification"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Test Live Alert</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      {watchlistStreams.length > 0 && (
        <div className="mt-6 flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All ({watchlistStreams.length})
          </button>
          <button
            onClick={() => setFilter('live')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === 'live'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Live Now ({watchlistStreams.filter((s) => s.status === 'live' || s.status === '24/7').length})
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === 'upcoming'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Upcoming & Offline ({watchlistStreams.filter((s) => s.status === 'upcoming' || s.status === 'offline').length})
          </button>
        </div>
      )}

      {/* Content */}
      {watchlistStreams.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-4">
            <Bookmark className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-200 mb-1">Your Watchlist is empty</h3>
          <p className="text-xs text-slate-500 max-w-sm mb-6">
            Click the bookmark icon on any upcoming or live match to track it here and receive instant notifications when it goes live.
          </p>
          <button
            onClick={onNavigateHome}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-600/20 transition-all hover:scale-105"
          >
            Discover Live Channels
          </button>
        </div>
      ) : filteredStreams.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs">
          No streams matching current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mt-6">
          {filteredStreams.map((stream) => (
            <div key={stream.id} className="relative group/wrapper">
              <StreamCard
                stream={stream}
                onPlay={onPlayStream}
                onAddToMultiview={onAddToMultiview}
                onToggleWatchlist={onToggleWatchlist}
                isInWatchlist={true}
                isInMultiview={multiviewStreamIds.includes(stream.id)}
              />
              {/* Quick Test Alert trigger per stream */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSimulateLiveTransition(stream);
                }}
                className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded bg-black/80 hover:bg-blue-600 text-[10px] font-mono text-slate-300 hover:text-white border border-slate-700 opacity-0 group-hover/wrapper:opacity-100 transition-opacity"
                title="Trigger simulated 'Stream went live' notification"
              >
                Simulate Live Alert
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
