import React from 'react';
import { StreamItem } from '../types/stream';
import { Search, X, Eye, Radio } from 'lucide-react';

interface SearchResultsProps {
  streams: StreamItem[];
  query: string;
  isOpen: boolean;
  onClose: () => void;
  onPlayStream: (stream: StreamItem) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  streams,
  query,
  isOpen,
  onClose,
  onPlayStream,
}) => {
  const results = query.trim()
    ? streams.filter((s) =>
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.category.toLowerCase().includes(query.toLowerCase()) ||
        s.provider.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[400px] md:w-[480px] z-50 bg-[#0a0f1a]/95 backdrop-blur-xl border-l border-blue-500/20 shadow-2xl shadow-blue-900/30 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">
              {query ? `Results for "${query}"` : 'Search Streams'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto h-[calc(100vh-var(--header-height,65px))] p-3">
          {!query ? (
            /* Empty state - show categories */
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-mono px-2 mb-3">
                Browse by category
              </p>
              {['Live Sports', '24/7 Channels', 'Basketball', 'Football / Soccer', 'IPTV Live', 'Anime', 'Movies & TV'].map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => onClose()}
                    className="w-full text-left px-3 py-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/30 text-slate-300 hover:text-white text-sm transition-all"
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mb-3">
                <Search className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-sm text-slate-400">No streams found</p>
              <p className="text-xs text-slate-500 mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 font-mono px-2 mb-3">
                {results.length} stream{results.length !== 1 ? 's' : ''} found
              </p>
              {results.map((stream) => (
                <button
                  key={stream.id}
                  onClick={() => onPlayStream(stream)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 hover:bg-blue-950/40 border border-slate-800 hover:border-blue-500/40 transition-all text-left group"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-10 rounded-lg bg-slate-800 overflow-hidden shrink-0">
                    <img
                      src={stream.poster || '/src/assets/images/hero_championship_live_1792048678438.jpg'}
                      alt={stream.title}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          '/src/assets/images/hero_championship_live_1792048678438.jpg';
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                      {stream.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-400">{stream.category}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-[11px] text-slate-500 capitalize">{stream.provider}</span>
                      {stream.status === 'live' && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="flex items-center gap-1 text-[11px] text-blue-400">
                            <Radio className="w-3 h-3 animate-pulse" />
                            LIVE
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Viewers */}
                  {stream.viewers && (
                    <div className="flex items-center gap-1 text-slate-500 text-xs shrink-0">
                      <Eye className="w-3.5 h-3.5" />
                      <span>{stream.viewers.toLocaleString()}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
