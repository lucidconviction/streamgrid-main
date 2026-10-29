import React, { useState, useMemo, useCallback } from 'react';
import { Layers, Search, RefreshCw, Globe, List } from 'lucide-react';
import { StreamItem } from '../types/stream';
import { StreamCard } from './StreamCard';
import { COUNTRY_ORDER, COUNTRY_LABELS, GENRE_OPTIONS } from '../services/iptvService';

interface IptvDirectoryProps {
  iptvStreams: StreamItem[];
  onPlayStream: (stream: StreamItem) => void;
  onAddToMultiview: (stream: StreamItem) => void;
  onToggleWatchlist: (stream: StreamItem) => void;
  onTogglePiP?: (stream: StreamItem) => void;
  watchlistIds: string[];
  multiviewStreamIds: string[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const ITEMS_PER_PAGE = 60;
const PAGE_SIZE_OPTIONS = [48, 60, 96, 144];

export const IptvDirectory: React.FC<IptvDirectoryProps> = ({
  iptvStreams,
  onPlayStream,
  onAddToMultiview,
  onToggleWatchlist,
  onTogglePiP,
  watchlistIds,
  multiviewStreamIds,
  onRefresh,
  isRefreshing,
}) => {
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(ITEMS_PER_PAGE);
  const [countryExpanded, setCountryExpanded] = useState<boolean>(false);

  const availableCountries = useMemo(() => {
    const counts: Record<string, number> = {};
    iptvStreams.forEach((s) => {
      const c = s.iptvCountry || 'OTHER';
      counts[c] = (counts[c] || 0) + 1;
    });
    return COUNTRY_ORDER
      .filter((c) => counts[c] > 0)
      .map((c) => ({ code: c, label: COUNTRY_LABELS[c] || c, count: counts[c] }));
  }, [iptvStreams]);

  const filtered = useMemo(() => {
    const countryFilter = selectedCountries.size > 0;
    const genreFilter = selectedGenres.size > 0;
    const q = search.toLowerCase().trim();
    return iptvStreams.filter((s) => {
      if (countryFilter && !selectedCountries.has(s.iptvCountry || 'OTHER')) return false;
      if (genreFilter && !selectedGenres.has(s.iptvGenre || 'general')) return false;
      if (q) {
        const hay = `${s.title} ${s.groupTitle || ''} ${s.m3uSource || ''} ${s.name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [iptvStreams, selectedCountries, selectedGenres, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const onCountriesChange = useCallback((next: Set<string>) => { setSelectedCountries(next); setPage(1); }, []);
  const onGenresChange = useCallback((next: Set<string>) => { setSelectedGenres(next); setPage(1); }, []);

  const toggleCountry = (code: string) => {
    const next = new Set(selectedCountries);
    next.has(code) ? next.delete(code) : next.add(code);
    onCountriesChange(next);
  };

  const toggleGenre = (key: string) => {
    const next = new Set(selectedGenres);
    next.has(key) ? next.delete(key) : next.add(key);
    onGenresChange(next);
  };

  const hasActiveFilters = selectedCountries.size > 0 || selectedGenres.size > 0 || search.length > 0;
  const clearAllFilters = () => { setSelectedCountries(new Set()); setSelectedGenres(new Set()); setSearch(''); setPage(1); };

  const getPageNumbers = (): (number | string)[] => {
    const range: (number | string)[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) range.push(i); return range; }
    range.push(1);
    if (page > 4) range.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) range.push(i);
    if (page < totalPages - 3) range.push('...');
    range.push(totalPages);
    return range;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-in fade-in duration-200">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">IPTV M3U Channels Hub</h1>
          </div>
          {iptvStreams.length > 0 && (
            <p className="text-sm text-slate-300 mt-1 font-medium">{iptvStreams.length.toLocaleString()} live channels indexed</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search channels by name, group..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-52 sm:w-64"
            />
          </div>
          {onRefresh && (
            <button onClick={onRefresh} disabled={isRefreshing}
              className="p-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="Refresh IPTV playlists">
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          )}
          <div className="text-xs font-mono text-slate-200 px-3 py-1.5 bg-slate-900/80 rounded-lg border border-slate-700 font-bold">
            {filtered.length.toLocaleString()} Channels
          </div>
        </div>
      </div>

      {/* ── Country Filter ── */}
      <div className="py-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-bold text-white">Country / Region</span>
          {selectedCountries.size > 0 && (
            <span className="text-xs font-mono text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded">{selectedCountries.size} selected</span>
          )}
        </div>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {(countryExpanded ? availableCountries : availableCountries.slice(0, 12)).map(({ code, label, count }) => {
            const active = selectedCountries.has(code);
            return (
              <button key={code} onClick={() => toggleCountry(code)}
                className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  active ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-950/30'
                         : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:border-slate-600 hover:text-white'}`}>
                <span>{label}</span>
                <span className={`px-1.5 rounded font-mono ${active ? 'bg-white/20' : 'bg-slate-800 text-slate-500'}`}>{count.toLocaleString()}</span>
              </button>
            );
          })}
        </div>
        {availableCountries.length > 12 && (
          <button onClick={() => setCountryExpanded(!countryExpanded)}
            className="mt-2 text-xs text-slate-400 hover:text-white">{countryExpanded ? 'Show less' : `+ ${availableCountries.length - 12} more countries`}</button>
        )}
      </div>

      {/* ── Genre Filter ── */}
      <div className="pb-4">
        <div className="flex items-center gap-2 mb-2">
          <List className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-bold text-white">Genre</span>
          {selectedGenres.size > 0 && (
            <span className="text-xs font-mono text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded">{selectedGenres.size} selected</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {GENRE_OPTIONS.map((g) => {
            const active = selectedGenres.has(g.key);
            return (
              <button key={g.key} onClick={() => toggleGenre(g.key)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  active ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-950/30'
                         : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:border-slate-600 hover:text-white'}`}>
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Active filters summary ── */}
      {hasActiveFilters && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            {selectedCountries.size > 0 && (
              <span>Countries: {Array.from(selectedCountries).map((c) => COUNTRY_LABELS[c] || c).join(', ')}</span>
            )}
            {selectedGenres.size > 0 && (
              <span>Genres: {Array.from(selectedGenres).map((g) => GENRE_OPTIONS.find((x) => x.key === g)?.label || g).join(', ')}</span>
            )}
            {search && <span>Search: "{search}"</span>}
          </div>
          <button onClick={clearAllFilters}
            className="self-start sm:self-auto flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium">
            Clear all
          </button>
        </div>
      )}

      {/* ── Channels Grid ── */}
      {filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-slate-300 mb-1">No matching IPTV channels found</p>
          {hasActiveFilters ? (
            <button onClick={clearAllFilters} className="text-sm text-blue-400 hover:text-blue-300">Clear all filters</button>
          ) : (
            <p className="text-xs text-slate-500 max-w-sm">No channels available — try refreshing the playlists.</p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {paginated.map((stream) => (
              <StreamCard key={stream.id} stream={stream} onPlay={onPlayStream} onAddToMultiview={onAddToMultiview}
                onToggleWatchlist={onToggleWatchlist} onTogglePiP={onTogglePiP}
                isInWatchlist={watchlistIds.includes(stream.id)} isInMultiview={multiviewStreamIds.includes(stream.id)} />
            ))}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 py-4 border-t border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span>Per page:</span>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500">
                  {PAGE_SIZE_OPTIONS.map((sz) => (<option key={sz} value={sz}>{sz}</option>))}
                </select>
              </div>
              <div className="text-xs font-mono text-slate-300 text-center">
                {filtered.length > 0
                  ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filtered.length)} of ${filtered.length.toLocaleString()}`
                  : '0 results'}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="First page">
                  {'<<'}
                </button>
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                  className="px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="Previous page">
                  {'<'}
                </button>
                {/* Page numbers hidden on mobile to save space */}
                <div className="hidden sm:flex items-center">
                  {getPageNumbers().map((p, i) =>
                    p === '...' ? (
                      <span key={`e${i}`} className="px-1 text-slate-500">…</span>
                    ) : (
                      <button key={p} onClick={() => setPage(p as number)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          page === p ? 'bg-blue-600 text-white shadow-md shadow-blue-950/30'
                                     : 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700'}`}>
                        {p}
                      </button>
                    )
                  )}
                </div>
                <span className="px-2 text-[10px] text-slate-500 sm:hidden">
                  {page}/{totalPages}
                </span>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                  className="px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="Next page">
                  {'>'}
                </button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="Last page">
                  {'>>'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};