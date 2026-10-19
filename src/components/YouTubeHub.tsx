import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Play, Clock, Loader2, Bookmark, BookmarkCheck } from 'lucide-react';
import { StreamDeck } from './StreamDeck';
import { StreamDetail } from './StreamDetail';
import YouTubePlayer from './YouTubePlayer';
import { YouTubeStream } from '../types/stream';
import {
  YOUTUBE_STREAMS,
  CHANNELS,
  loadEngineStreams,
  engineSearch,
  engineToStream,
  fmtDuration,
} from '../services/youtubeService';

interface YouTubeHubProps {
  watchlistIds: string[];
  onToggleWatchlist: (stream: YouTubeStream) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
  reminders: string[];
  onToggleReminder: (streamId: string) => void;
  savedChannelIds: string[];
  onToggleSavedChannel: (handle: string) => void;
  onOpenChannel: (handle: string) => void;
}

export const YouTubeHub: React.FC<YouTubeHubProps> = ({
  watchlistIds,
  onToggleWatchlist,
  onShowToast,
  reminders,
  onToggleReminder,
  savedChannelIds,
  onToggleSavedChannel,
  onOpenChannel,
}) => {
  const [selected, setSelected] = useState<YouTubeStream | null>(null);
  const [playing, setPlaying] = useState<YouTubeStream | null>(null);
  const [isTheater, setIsTheater] = useState(false);
  const [streams, setStreams] = useState<YouTubeStream[]>(YOUTUBE_STREAMS);

  // Search state
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeStream[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadEngineStreams().then((s) => {
      if (!cancelled && s.length) setStreams(s);
    });
    return () => { cancelled = true; };
  }, []);

  // Debounced YouTube search (engine-backed with local fallback)
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSearchError(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    const q = value.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await engineSearch(q, 24);
        if (!cancelledRef.current && res.results?.length) {
          setSearchResults(res.results.map((r) => engineToStream(r)));
        } else {
          // Local fallback: match against loaded streams + catalog
          const pool = searchResults ? streams : streams;
          const lower = q.toLowerCase();
          const local = pool.filter(
            (s) =>
              s.title.toLowerCase().includes(lower) ||
              s.channel.name.toLowerCase().includes(lower) ||
              (s.category || '').toLowerCase().includes(lower)
          );
          setSearchResults(local.length ? local : null);
        }
      } catch {
        // Engine unavailable — local fallback
        const lower = q.toLowerCase();
        const local = streams.filter(
          (s) =>
            s.title.toLowerCase().includes(lower) ||
            s.channel.name.toLowerCase().includes(lower) ||
            (s.category || '').toLowerCase().includes(lower)
        );
        setSearchResults(local.length ? local : null);
      } finally {
        setSearching(false);
      }
    }, 450);
  };

  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  const handleOpen = (stream: YouTubeStream) => {
    setSelected(stream);
    setPlaying(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setSelected(null);
    setPlaying(null);
  };

  const handlePlay = (stream: YouTubeStream) => {
    setPlaying(stream);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearSearch = () => {
    setQuery('');
    setSearchResults(null);
    setSearchError(null);
  };

  if (playing) {
    return (
      <YouTubePlayer
        stream={playing}
        onBack={() => setPlaying(null)}
        onOpenStream={handleOpen}
        isTheater={isTheater}
        onToggleTheater={setIsTheater}
      />
    );
  }

  if (selected) {
    return (
      <StreamDetail
        stream={selected}
        onBack={handleBack}
        onPlay={handlePlay}
        onOpenStream={handleOpen}
        isInWatchlist={watchlistIds.includes(selected.id)}
        onToggleWatchlist={onToggleWatchlist}
        reminders={reminders}
        onToggleReminder={onToggleReminder}
        onShowToast={onShowToast}
      />
    );
  }

  const showSearchResults = query.trim().length >= 2;

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Stream Hub
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Discover live streams, VODs, shorts and playlists — powered by NewPipeExtractor.
        </p>
      </div>

      {/* ── Search bar ── */}
      <div className="relative mb-6">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search YouTube — videos, channels, live streams…"
            className="w-full glass-card rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 outline-none border border-slate-700/60 focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 transition-all"
          />
          {searching && (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400 animate-spin" />
          )}
          {query && !searching && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-700/60 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {showSearchResults ? (
        /* ── Search results grid ── */
        <div className="animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">
              {searchResults && searchResults.length > 0
                ? `${searchResults.length} results for “${query.trim()}”`
                : 'No results found'}
            </h2>
            {searchResults && searchResults.length > 0 && (
              <button
                onClick={clearSearch}
                className="text-xs font-bold text-slate-400 hover:text-red-400 transition-colors"
              >
                ← Back to streams
              </button>
            )}
          </div>
          {searchError && (
            <p className="text-xs text-amber-400 mb-3 font-mono">⚠ {searchError}</p>
          )}
          {searchResults && searchResults.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {searchResults.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleOpen(s)}
                  className="glass-card rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600 bg-[#0f121a] transition-all hover:-translate-y-0.5 text-left touch-manipulation"
                >
                  <div className="relative aspect-video bg-slate-900">
                    <img
                      src={s.thumbnail}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    {s.status === 'live' && (
                      <span className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-black">
                        <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                        LIVE
                      </span>
                    )}
                    {s.durationSeconds != null && s.durationSeconds > 0 && (
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 text-white text-[9px] font-mono">
                        {fmtDuration(s.durationSeconds)}
                      </span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-bold text-white line-clamp-2 leading-snug">{s.title}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <img
                        src={s.channel.avatar}
                        alt=""
                        className="w-5 h-5 rounded-full border border-slate-600"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[10px] text-slate-400 truncate flex-1">{s.channel.name}</span>
                      <span className="text-[9px] font-mono text-slate-600">{s.channel.subscribers}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <Search className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">
                Nothing found for “{query.trim()}”{searching ? ' — still searching…' : ''}
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <StreamDeck
            streams={streams}
            onOpenStream={handleOpen}
            reminders={reminders}
            onToggleReminder={onToggleReminder}
          />

          {/* ── Channel grid (real YouTube profiles) ── */}
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Channels</h2>
              <span className="text-[11px] font-mono text-slate-500">{CHANNELS.length} profiles</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {CHANNELS.map((ch) => {
                const isSaved = savedChannelIds.includes(ch.youtubeChannelId || ch.id);
                return (
                  <div
                    key={ch.id}
                    className="glass-card rounded-xl p-3 flex flex-col items-center text-center hover:border-slate-600 transition-colors touch-manipulation relative group/ch"
                  >
                    <button
                      onClick={() => onOpenChannel(ch.youtubeChannelId || ch.id)}
                      className="flex flex-col items-center text-center"
                    >
                      <div className="relative">
                        <img
                          src={ch.avatar}
                          alt={ch.name}
                          className="w-14 h-14 rounded-full border-2 border-slate-700"
                          referrerPolicy="no-referrer"
                        />
                        {ch.verified && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-blue-500 border-2 border-slate-900 flex items-center justify-center text-white text-[9px] font-black">
                            ✓
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-white truncate w-full mt-2">{ch.name}</p>
                      <p className="text-[9px] text-slate-500 font-mono">{ch.subscribers} subs</p>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSavedChannel(ch.youtubeChannelId || ch.id);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-800/80 text-slate-400 hover:text-amber-400 hover:bg-amber-500/20 transition-colors opacity-0 group-hover/ch:opacity-100"
                      aria-label={isSaved ? 'Unsave channel' : 'Save channel'}
                      title={isSaved ? 'Unsave channel' : 'Save channel'}
                    >
                      {isSaved ? (
                        <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Bookmark className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
