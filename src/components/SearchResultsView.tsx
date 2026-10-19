import React, { useRef } from 'react';
import { StreamItem } from '../types/stream';
import { StreamCard } from './StreamCard';
import { X, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface SearchResultsViewProps {
  streams: StreamItem[];
  query: string;
  onClose: () => void;
  onPlayStream: (stream: StreamItem) => void;
  onAddToMultiview: (stream: StreamItem) => void;
  onToggleWatchlist: (stream: StreamItem) => void;
  onTogglePiP?: (stream: StreamItem) => void;
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
  onTogglePiP,
  watchlistIds,
  multiviewStreamIds,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter out smutt/eporner — only show streams from the main site sections
  const filtered = streams.filter(
    (s) => s.provider !== 'smutt' && s.provider !== 'eporner'
  );

  const matched = query.trim()
    ? filtered.filter((s) => {
        // Support comma-separated keywords: match if any keyword matches
        const kws = query.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
        return kws.length === 0 || kws.some((kw) =>
          s.title.toLowerCase().includes(kw) ||
          s.category.toLowerCase().includes(kw) ||
          s.provider.toLowerCase().includes(kw)
        );
      })
    : filtered;

  // Global mode (no query) — group all streams by category
  const isGlobalMode = !query.trim();
  const grouped = new Map<string, StreamItem[]>();
  if (isGlobalMode) {
    for (const s of matched) {
      const cat = (s.category || 'Other').trim() || 'Other';
      const list = grouped.get(cat) || [];
      list.push(s);
      grouped.set(cat, list);
    }
    // Sort groups by size (most streams first)
    const sorted = Array.from(grouped.entries()).sort(
      (a, b) => b[1].length - a[1].length
    );
    grouped.clear();
    sorted.forEach(([k, v]) => grouped.set(k, v));
  }

  const renderCard = (stream: StreamItem, fixedWidth?: string) => (
    <div
      key={stream.id}
      className={fixedWidth ? `shrink-0 ${fixedWidth}` : undefined}
    >
      <StreamCard
        stream={stream}
        onPlay={onPlayStream}
        onAddToMultiview={onAddToMultiview}
        onToggleWatchlist={onToggleWatchlist}
        onTogglePiP={onTogglePiP}
        isInWatchlist={watchlistIds.includes(stream.id)}
        isInMultiview={multiviewStreamIds.includes(stream.id)}
      />
    </div>
  );

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = dir === 'left' ? -200 : 200;
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${isGlobalMode ? 'justify-start' : 'justify-end'}`}>
      {/* Backdrop — darkens everything behind */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Panel — full-height scrollable in global mode, bottom sheet in search mode */}
      <div
        className={`relative z-10 w-full flex flex-col bg-gradient-to-t from-[#0a0f1c] via-[#0f172a]/98 to-[#0f172a]/90 border-t border-blue-500/30 shadow-2xl shadow-black/60 animate-slideUp ${
          isGlobalMode
            ? 'h-full rounded-none animate-fadeIn'
            : 'max-h-[85vh]'
        }`}
      >
        {/* Drag handle */}
        {!isGlobalMode && (
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-slate-700" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-800/50 shrink-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isGlobalMode ? 'bg-purple-600/20' : 'bg-blue-600/20'}`}>
            <Search className={`w-4 h-4 ${isGlobalMode ? 'text-purple-400' : 'text-blue-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white truncate">
              {query ? `"${query}"` : '🌍 All Streams'}
            </h2>
            <p className="text-xs text-slate-400">
              {matched.length} stream{matched.length !== 1 ? 's' : ''}
              {isGlobalMode ? ` across ${grouped.size} categories` : ' found'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors touch-manipulation"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isGlobalMode ? (
          /* ── Global mode: full-height scrollable grid grouped by category ── */
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {matched.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mb-3">
                  <Search className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-sm text-slate-400 font-medium">No streams available yet</p>
                <p className="text-xs text-slate-500 mt-1">Streams will appear here once loaded</p>
              </div>
            ) : (
              <div className="px-4 sm:px-6 py-4 space-y-6 pb-24">
                {Array.from(grouped.entries()).map(([category, catStreams]) => (
                  <section key={category}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-1 h-4 rounded-full bg-gradient-to-b from-blue-500 to-purple-500" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">
                        {category}
                      </h3>
                      <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono">
                        {catStreams.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {catStreams.map((stream) => renderCard(stream))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Search mode: horizontal scrollable card row ── */
          <div className="relative px-4 py-4">
            {/* Left fade edge */}
            {matched.length > 3 && (
              <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#0a0f1c] to-transparent pointer-events-none z-10" />
            )}
            {/* Right fade edge */}
            {matched.length > 3 && (
              <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#0a0f1c] to-transparent pointer-events-none z-10" />
            )}

            {/* Nav arrows */}
            {matched.length > 5 && (
              <>
                <button
                  onClick={() => scroll('left')}
                  className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors touch-manipulation shadow-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scroll('right')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors touch-manipulation shadow-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Horizontal scroll container */}
            <div
              ref={scrollRef}
              className="flex gap-3 overflow-x-auto no-scrollbar pb-2"
            >
              {matched.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 w-full text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mb-3">
                    <Search className="w-6 h-6 text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-400 font-medium">No streams found</p>
                  <p className="text-xs text-slate-500 mt-1">Try a different search term</p>
                </div>
              ) : (
                matched.map((stream) => renderCard(stream, 'w-[148px] sm:w-[172px]'))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};