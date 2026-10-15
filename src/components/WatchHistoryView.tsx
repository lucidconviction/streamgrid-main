import React, { useState, useMemo } from 'react';
import { History, Trash2, Play, Search, Clock, Calendar, Check, X } from 'lucide-react';
import { WatchHistoryEntry, StreamItem } from '../types/stream';

interface WatchHistoryViewProps {
  history: WatchHistoryEntry[];
  onPlayHistoryItem: (entry: WatchHistoryEntry) => void;
  onRemoveItem: (historyId: string) => void;
  onClearAll: () => void;
  onNavigateHome: () => void;
}

export const WatchHistoryView: React.FC<WatchHistoryViewProps> = ({
  history,
  onPlayHistoryItem,
  onRemoveItem,
  onClearAll,
  onNavigateHome,
}) => {
  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const filteredHistory = useMemo(() => {
    return history.filter(
      (h) =>
        h.title.toLowerCase().includes(search.toLowerCase()) ||
        h.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [history, search]);

  const formatWatchedTime = (timestamp: number) => {
    const deltaMs = Date.now() - timestamp;
    const minutes = Math.floor(deltaMs / (60 * 1000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <History className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">Watch History</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Pick up right where you left off. Stored locally per user profile.
          </p>
        </div>

        {/* Search & Clear actions */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 sm:w-60"
            />
          </div>

          {history.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-2 bg-blue-950/80 border border-blue-700/80 px-3 py-1.5 rounded-lg text-xs">
                <span className="text-blue-200">Clear all?</span>
                <button
                  onClick={() => {
                    onClearAll();
                    setConfirmClear(false);
                  }}
                  className="text-blue-400 hover:text-white font-bold"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-blue-950/40 text-slate-400 hover:text-blue-400 border border-slate-800 hover:border-blue-900/60 rounded-lg text-xs font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* History Items List */}
      {filteredHistory.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-200 mb-1">
            {history.length === 0 ? 'No watch history yet' : 'No matching history items found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mb-6">
            {history.length === 0
              ? 'Streams and live matches you watch will appear here automatically so you can resume them anytime.'
              : 'Try clearing your search query to see other watched streams.'}
          </p>
          <button
            onClick={onNavigateHome}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-600/20 transition-all hover:scale-105"
          >
            Explore Live Broadcasts
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/60 mt-4">
          {filteredHistory.map((item) => (
            <div
              key={item.id}
              className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-slate-900/40 px-3 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* Thumbnail */}
                <div
                  onClick={() => onPlayHistoryItem(item)}
                  className="relative aspect-video w-32 sm:w-40 rounded-lg overflow-hidden bg-slate-900 shrink-0 cursor-pointer group/thumb"
                >
                  <img
                    src={item.poster || '/src/assets/images/hero_championship_live_1792048678438.jpg'}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        '/src/assets/images/hero_championship_live_1792048678438.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                    <Play className="w-6 h-6 fill-white text-white" />
                  </div>
                  {/* Progress bar */}
                  <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-800">
                    <div
                      className="h-full bg-blue-600"
                      style={{ width: `${item.progressPercent || 65}%` }}
                    />
                  </div>
                </div>

                {/* Info */}
                <div className="truncate">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-normal mb-1">
                    <span>{item.category}</span>
                    <span>·</span>
                    <span className="font-mono">{item.provider.toUpperCase()}</span>
                    <span>·</span>
                    <span className="font-mono text-slate-500">{formatWatchedTime(item.watchedAt)}</span>
                  </div>
                  <h3
                    onClick={() => onPlayHistoryItem(item)}
                    className="text-sm font-semibold text-slate-100 hover:text-blue-400 cursor-pointer truncate transition-colors"
                  >
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-mono">
                    <span>Watched ~{item.durationMinutes || 24} mins</span>
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  onClick={() => onPlayHistoryItem(item)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600/90 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Resume</span>
                </button>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Remove from history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
