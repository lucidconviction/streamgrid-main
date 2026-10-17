import React from 'react';
import { StreamItem } from '../types/stream';
import { StreamCard } from './StreamCard';

interface SearchResultsViewProps {
  streams: StreamItem[];
  query: string;
  onClose: () => void;
  onPlayStream: (stream: StreamItem) => void;
  onAddToMultiview: (stream: StreamItem) => void;
  onToggleWatchlist: (stream: StreamItem) => void;
  watchlistIds: string[];
  multiviewStreamIds: string[];
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  streams,
  query,
  onClose,
  onPlayStream,
  onAddToMultiview,
  onToggleWatchlist,
  watchlistIds,
  multiviewStreamIds,
}) => {
  // Filter out smutt/eporner — only show streams from the main site sections
  const filtered = streams.filter(
    (s) => s.provider !== 'smutt' && s.provider !== 'eporner'
  );

  const matched = query.trim()
    ? filtered.filter((s) =>
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.category.toLowerCase().includes(query.toLowerCase()) ||
        s.provider.toLowerCase().includes(query.toLowerCase())
      )
    : filtered;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide-in panel — expands from left, covers ~85% of screen */}
      <div className="relative z-50 flex h-full w-full max-w-3xl bg-[#0f172a]/95 backdrop-blur-xl border-r border-blue-500/20 shadow-2xl shadow-black/50 transform transition-transform duration-300 ease-out translate-x-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {query ? `Results for "${query}"` : 'All Streams'}
              </h2>
              <p className="text-xs text-slate-400">
                {matched.length} stream{matched.length !== 1 ? 's' : ''} found
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors touch-manipulation"
            title="Close search"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Results Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {matched.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-base text-slate-400 font-medium">No streams found</p>
              <p className="text-sm text-slate-500 mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {matched.map((stream) => (
                <StreamCard
                  key={stream.id}
                  stream={stream}
                  onPlay={onPlayStream}
                  onAddToMultiview={onAddToMultiview}
                  onToggleWatchlist={onToggleWatchlist}
                  isInWatchlist={watchlistIds.includes(stream.id)}
                  isInMultiview={multiviewStreamIds.includes(stream.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};