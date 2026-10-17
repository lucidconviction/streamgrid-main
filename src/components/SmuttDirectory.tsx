import React, { useState, useMemo, useEffect } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { StreamItem } from '../types/stream';
import { StreamCard } from './StreamCard';
import { smuttService, getGroupIcons } from '../services/smuttService';
import { epornerService } from '../services/epornerService';
import { getCategoryGradient } from '../services/smuttThumbnailService';

// Check sessionStorage for age verification (persists during tab session)
const getAgeVerified = (): boolean => sessionStorage.getItem('rdnutz_smutt_verified') === 'true';
const setAgeVerified = (v: boolean): void => sessionStorage.setItem('rdnutz_smutt_verified', String(v));

interface SmuttDirectoryProps {
  onPlayStream: (stream: StreamItem) => void;
  onAddToMultiview: (stream: StreamItem) => void;
  onToggleWatchlist: (stream: StreamItem) => void;
  onTogglePiP?: (stream: StreamItem) => void;
  watchlistIds: string[];
  multiviewStreamIds: string[];
  onSetStreams?: (streams: StreamItem[]) => void;
}

export const SmuttDirectory: React.FC<SmuttDirectoryProps> = ({
  onPlayStream,
  onAddToMultiview,
  onToggleWatchlist,
  onTogglePiP,
  watchlistIds,
  multiviewStreamIds,
  onSetStreams,
}) => {
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [selectedEpornerSubCat, setSelectedEpornerSubCat] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [displayCount, setDisplayCount] = useState<number>(40);
  const [ageVerified, setAgeVerified] = useState(getAgeVerified);

  useEffect(() => {
    if (!ageVerified) return; // Don't load content until user verifies age
    Promise.all([
      smuttService.fetchAllSmuttStreams(),
      epornerService.fetchAllEpornStreams(),
    ]).then(([smuttData, epornData]) => {
      const all = [...epornData, ...smuttData];
      setStreams(all);
      if (onSetStreams) onSetStreams(all);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, [ageVerified]);

  const handleAgeVerification = (verified: boolean) => {
    setAgeVerified(verified);
    if (!verified) {
      window.dispatchEvent(new CustomEvent('rdnutz-smutt-denied'));
    }
  };

  // Listen for deny event from child (redundant safety)
  useEffect(() => {
    const handler = () => setAgeVerified(false);
    window.addEventListener('rdnutz-smutt-denied', handler);
    return () => window.removeEventListener('rdnutz-smutt-denied', handler);
  }, []);

  // Get Eporner sub-categories for the sub-filter tabs
  const epornerSubCats = useMemo(() => {
    const epornStreams = streams.filter(s => s.provider === 'eporner');
    return epornerService.getCategoryBreakdown(epornStreams);
  }, [streams]);

  // Groups are only from non-Eporner streams
  const groups = useMemo(() => {
    const groupSet = new Set<string>();
    streams.filter(s => s.provider !== 'eporner').forEach((s) => {
      groupSet.add(s.groupTitle || s.category);
    });
    return ['All', ...Array.from(groupSet).sort()];
  }, [streams]);

  // Build filterable stream list
  const filtered = useMemo(() => {
    return streams.filter((s) => {
      // Eporner subcategory filter
      if (s.provider === 'eporner') {
        if (selectedGroup === 'All' && selectedEpornerSubCat === 'All') {
          // Show all eporner
        } else if (selectedGroup === 'All') {
          // Show only selected eporner subcat
          if ((s.subCategory || 'All') !== selectedEpornerSubCat) return false;
        } else if (selectedGroup !== 'Eporner') {
          // Not showing Eporner tab, so this shouldn't appear
          return false;
        }
        // If Eporner tab is selected and subcat is All, show all eporner
        if (selectedGroup === 'Eporner' && selectedEpornerSubCat !== 'All') {
          if ((s.subCategory || 'All') !== selectedEpornerSubCat) return false;
        }
      } else {
        // Non-Eporner streams: filter by group
        const matchesGroup =
          selectedGroup === 'All' ||
          (s.groupTitle && s.groupTitle.toLowerCase() === selectedGroup.toLowerCase());
        if (!matchesGroup) return false;
      }

      // Search filter
      const matchesSearch =
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        (s.groupTitle && s.groupTitle.toLowerCase().includes(search.toLowerCase())) ||
        (s.category && s.category.toLowerCase().includes(search.toLowerCase()));

      return matchesSearch;
    });
  }, [streams, selectedGroup, selectedEpornerSubCat, search]);

  const displayedStreams = useMemo(() => {
    return filtered.slice(0, displayCount);
  }, [filtered, displayCount]);

  const groupIcons = { ...getGroupIcons(), ...epornerService.getGroupIcons() };

  // Age verification overlay — shown FIRST, before any content loading
  if (!ageVerified) {
    return (
      <div className="relative w-full min-h-[80vh] flex items-center justify-center overflow-hidden">
        {/* Blurred background */}
        <div className="absolute inset-0 backdrop-blur-3xl bg-black/60 z-0" />

        {/* Verification card */}
        <div className="relative z-10 max-w-md mx-4 bg-[#0f121a] border border-rose-500/30 rounded-2xl p-8 shadow-2xl shadow-rose-900/20">
          {/* XXX Emblem */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-600 to-red-700 flex items-center justify-center shadow-lg shadow-rose-600/40 relative">
              <svg viewBox="0 0 100 100" className="w-14 h-14 text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="50" y="68" textAnchor="middle" fill="currentColor" fontSize="32" fontWeight="bold" fontFamily="Arial, sans-serif">XXX</text>
                <line x1="20" y1="20" x2="80" y2="80" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-black text-white text-center mb-2">
            Adult Content Warning
          </h2>
          <p className="text-rose-400 text-center text-sm font-bold mb-4 uppercase tracking-wider">
            🔞 Explicit Material Inside
          </p>
          <p className="text-slate-300 text-sm text-center mb-2 leading-relaxed">
            This section contains <span className="text-rose-400 font-bold">extreme adult content</span> including explicit sexual material.
          </p>
          <p className="text-slate-400 text-xs text-center mb-6">
            By entering, you confirm you are at least <span className="text-white font-bold">18 years old</span> (or the age of majority in your jurisdiction).
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => handleAgeVerification(false)}
              className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-sm transition-all hover:text-white"
            >
              No — Leave
            </button>
            <button
              onClick={() => handleAgeVerification(true)}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-sm transition-all shadow-lg shadow-rose-600/30 hover:shadow-rose-500/40"
            >
              Yes, I&apos;m 18+
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-in fade-in duration-200">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {/* XXX Circle Cross Emblem */}
          <svg viewBox="0 0 100 100" className="w-10 h-10 text-rose-400 animate-pulse mb-4" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="8" />
            <text x="50" y="66" textAnchor="middle" fill="currentColor" fontSize="30" fontWeight="bold" fontFamily="Arial, sans-serif">XXX</text>
            <line x1="18" y1="18" x2="82" y2="82" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
          </svg>
          <p className="text-sm font-semibold text-slate-300">Loading Nett Smutt 4.0...</p>
          <p className="text-xs text-slate-500 mt-1">Fetching adult content library</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-in fade-in duration-200">
      {/* Directory Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-600 to-red-700 flex items-center justify-center shadow-md shadow-rose-600/30">
              {/* XXX Circle Cross Emblem */}
              <svg viewBox="0 0 100 100" className="w-5 h-5 text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="8" />
                <text x="50" y="66" textAnchor="middle" fill="currentColor" fontSize="30" fontWeight="bold" fontFamily="Arial, sans-serif">XXX</text>
                <line x1="18" y1="18" x2="82" y2="82" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Nett <span className="text-rose-500">Smutt</span> 4.0
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {streams.length} videos from Nett Smutt + Eporner API
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search videos..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setDisplayCount(40);
              }}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 w-52 sm:w-64"
            />
          </div>

          <button
            onClick={() => {
              Promise.all([
                smuttService.fetchAllSmuttStreams(true),
                epornerService.fetchAllEpornStreams(true),
              ]).then(([s, e]) => {
                const all = [...e, ...s];
                setStreams(all);
                if (onSetStreams) onSetStreams(all);
              });
            }}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Refresh all streams"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-rose-500' : ''}`} />
          </button>

          <div className="text-xs font-mono text-slate-400 px-3 py-1.5 bg-slate-900 rounded-lg border border-slate-800">
            {filtered.length} Videos
          </div>
        </div>
      </div>

      {/* Primary Group Filter Tabs */}
      <div className="pb-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {groups.map((group) => (
          <button
            key={group}
            onClick={() => {
              setSelectedGroup(group);
              setSelectedEpornerSubCat('All');
              setDisplayCount(40);
            }}
            className={`px-3.5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedGroup === group
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700'
            }`}
          >
            {group !== 'All' && groupIcons[group] && <span>{groupIcons[group]}</span>}
            {group}
          </button>
        ))}

        {/* Eporner tab with sub-category toggle indicator */}
        <button
          onClick={() => {
            setSelectedGroup('Eporner');
            setDisplayCount(40);
          }}
          className={`px-3.5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            selectedGroup === 'Eporner'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
              : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700'
          }`}
        >
          <span>{groupIcons['Eporner'] || '🔴'}</span>
          Eporner
          <span className="text-[10px] opacity-60">{epornerSubCats.length - 1}</span>
        </button>
      </div>

      {/* Eporner Sub-Category Tabs */}
      {selectedGroup === 'Eporner' && (
        <div className="pb-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-800/50">
          <button
            onClick={() => setSelectedEpornerSubCat('All')}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedEpornerSubCat === 'All'
                ? 'bg-slate-700 text-white'
                : 'bg-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            🎬 All
          </button>
          {epornerSubCats.filter(c => c.name !== 'All').map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedEpornerSubCat(cat.name)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedEpornerSubCat === cat.name
                  ? 'bg-rose-600/20 text-rose-400 border border-rose-600/40'
                  : 'bg-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {cat.icon} {cat.name}
              <span className="ml-1 text-[10px] opacity-60">({cat.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Video Grid */}
      {displayedStreams.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <svg viewBox="0 0 100 100" className="w-10 h-10 text-slate-600 mb-3" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="8" />
            <text x="50" y="66" textAnchor="middle" fill="currentColor" fontSize="30" fontWeight="bold" fontFamily="Arial, sans-serif">XXX</text>
            <line x1="18" y1="18" x2="82" y2="82" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
          </svg>
          <p className="text-sm font-semibold text-slate-300 mb-1">No videos found</p>
          <p className="text-xs text-slate-500 max-w-sm">
            Try adjusting your search or selecting a different group.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {displayedStreams.map((stream) => (
              <StreamCard
                key={stream.id}
                stream={stream}
                onPlay={onPlayStream}
                onAddToMultiview={onAddToMultiview}
                onToggleWatchlist={onToggleWatchlist}
                onTogglePiP={onTogglePiP}
                isInWatchlist={watchlistIds.includes(stream.id)}
                isInMultiview={multiviewStreamIds.includes(stream.id)}
              />
            ))}
          </div>

          {/* Load More */}
          {filtered.length > displayCount && (
            <div className="mt-8 flex items-center justify-center">
              <button
                onClick={() => setDisplayCount((prev) => prev + 40)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold shadow-md transition-colors"
              >
                Load More ({displayedStreams.length} of {filtered.length.toLocaleString()})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
