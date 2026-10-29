import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Clock, Trophy, Calendar, Filter, Play, PauseCircle, CheckCircle2, Sparkles, RefreshCw, Tv } from 'lucide-react';
import { fetchSportsFeed, aiMatchPreview, MatchRow } from '../services/aiService';
import {
  buildSportsChannelIndex,
  resolveChannelForIndex,
  describeResolution,
  ChannelResolution,
} from '../services/sportsChannelService';
import { StreamItem } from '../types/stream';

// Local fallback — shown when the AI gateway is unreachable
const MOCK_SCHEDULE: MatchRow[] = [
  // Live matches - realistic current scores
  { id: '1', time: 'LIVE', league: 'Premier League', home: 'Arsenal', away: 'Liverpool', homeScore: 2, awayScore: 2, status: 'live', minute: "68'" },
  { id: '2', time: 'LIVE', league: 'La Liga', home: 'Real Madrid', away: 'Barcelona', homeScore: 1, awayScore: 2, status: 'live', minute: "75'" },
  { id: '3', time: 'LIVE', league: 'NBA', home: 'Phoenix Suns', away: 'Golden State Warriors', homeScore: 112, awayScore: 108, status: 'live', quarter: 'Q4 8:23' },
  { id: '4', time: 'LIVE', league: 'Serie A', home: 'Juventus', away: 'Inter Milan', homeScore: 0, awayScore: 1, status: 'live', minute: "54'" },
  { id: '5', time: 'LIVE', league: 'Champions League', home: 'Bayern Munich', away: 'Paris Saint-Germain', homeScore: 3, awayScore: 1, status: 'live', minute: "82'" },
  { id: '6', time: 'LIVE', league: 'UFC', home: 'Conor McGregor', away: 'Dustin Poirier', homeScore: 1, awayScore: 4, status: 'live', minute: "Round 2" },
  // Upcoming matches - realistic future times
  { id: '7', time: '19:30', league: 'Premier League', home: 'Chelsea', away: 'Tottenham', homeScore: null, awayScore: null, status: 'upcoming' },
  { id: '8', time: '20:15', league: 'La Liga', home: 'Sevilla', away: 'Valencia', homeScore: null, awayScore: null, status: 'upcoming' },
  { id: '9', time: '21:00', league: 'Bundesliga', home: 'Dortmund', away: 'RB Leipzig', homeScore: null, awayScore: null, status: 'upcoming' },
  { id: '10', time: '21:45', league: 'NBA', home: 'Boston Celtics', away: 'Miami Heat', homeScore: null, awayScore: null, status: 'upcoming' },
  // Finished matches - realistic final scores
  { id: '11', time: 'FT', league: 'NFL', home: 'Kansas City Chiefs', away: 'Buffalo Bills', homeScore: 27, awayScore: 24, status: 'finished' },
  { id: '12', time: 'FT', league: 'MLB', home: 'Los Angeles Dodgers', away: 'San Francisco Giants', homeScore: 8, awayScore: 3, status: 'finished' },
];

interface SportsEPGProps {
  /** Channels that can back a fixture — the guide resolves each row to one of these. */
  channels: StreamItem[];
  /** Plays the resolved channel. Receives a real, playable stream. */
  onPlayStream?: (stream: StreamItem) => void;
  /** Optional toast for "no channel available" feedback. */
  onShowToast?: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

const LEAGUE_COLORS: Record<string, string> = {
  'Premier League': 'text-emerald-400',
  'Champions League': 'text-violet-400',
  'La Liga': 'text-cyan-400',
  'Serie A': 'text-amber-400',
  'Bundesliga': 'text-red-400',
  'NBA': 'text-orange-400',
  'NFL': 'text-blue-400',
  'F1': 'text-rose-400',
  'UFC': 'text-yellow-400',
};

const REFRESH_INTERVAL = 60_000; // auto-refresh AI feed every minute

export const SportsEPG: React.FC<SportsEPGProps> = ({ channels, onPlayStream, onShowToast }) => {
  const [activeTab, setActiveTab] = useState<'scores' | 'guide'>('scores');
  const [now, setNow] = useState(new Date());
  const [selectedLeagues, setSelectedLeagues] = useState<Record<string, boolean>>({});
  const [matches, setMatches] = useState<MatchRow[]>(MOCK_SCHEDULE);
  const [aiLive, setAiLive] = useState(false);
  const [aiInsight, setAiInsight] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({}); // matchId → AI preview
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  // Pre-normalized channel text — the guide resolves a row on every render.
  const channelIndex = useMemo(() => buildSportsChannelIndex(channels || []), [channels]);

  // Match → playable channel, memoized per feed revision.
  const resolutions = useMemo(() => {
    const map: Record<string, ChannelResolution | null> = {};
    matches.forEach((m) => {
      map[m.id] = resolveChannelForIndex(m, channelIndex);
    });
    return map;
  }, [matches, channelIndex]);

  const refreshFeed = useCallback(async (force = false) => {
    setIsRefreshing(true);
    const feed = await fetchSportsFeed(force);
    if (!mountedRef.current) return;
    if (feed) {
        // Sort so LIVE games always show first, UPCOMING in the middle,
        // and FINISHED games drop to the rear
        const sorted = [...feed.matches].sort((a, b) => {
          const order = { live: 0, upcoming: 1, finished: 2 };
          return (order[a.status] ?? 3) - (order[b.status] ?? 3);
        });
        // Fallback to mock schedule if the AI returned no matches
        setMatches(sorted.length > 0 ? sorted : MOCK_SCHEDULE);
      setAiLive(true);
      setAiInsight(feed.insight);
      setUpdatedAt(feed.updatedAt);
    } else {
      setAiLive(false);
    }
    setIsRefreshing(false);
  }, []);

  const fetchPreview = useCallback(async (m: MatchRow) => {
    setLoadingPreviewId(m.id);
    const text = await aiMatchPreview(m.home, m.away, m.league, m.status);
    if (text && mountedRef.current) {
      setPreviews((p) => ({ ...p, [m.id]: text }));
    }
    if (mountedRef.current) setLoadingPreviewId(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refreshFeed();
    const t = setInterval(() => setNow(new Date()), 30000);
    const ai = setInterval(() => refreshFeed(), REFRESH_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(t);
      clearInterval(ai);
    };
  }, [refreshFeed]);

  const availableLeagues = Array.from(new Set(matches.map((m) => m.league)));

  const filteredLive = matches.filter((m) => m.status === 'live' && (
    Object.keys(selectedLeagues).length === 0 || selectedLeagues[m.league]
  ));
  const filteredUpcoming = matches.filter((m) => m.status === 'upcoming' && (
    Object.keys(selectedLeagues).length === 0 || selectedLeagues[m.league]
  ));
  const filteredFinished = matches.filter((m) => m.status === 'finished' && (
    Object.keys(selectedLeagues).length === 0 || selectedLeagues[m.league]
  ));

  const hasActiveFilter = Object.values(selectedLeagues).some(Boolean);

  const resetFilters = () => setSelectedLeagues({});

  /**
   * Play the channel that actually carries this fixture. The feed only knows
   * teams and leagues, so the channel is resolved from the catalog — passing a
   * made-up match object to the player would only render an empty player.
   */
  const handleWatch = useCallback((m: MatchRow) => {
    const resolution = resolutions[m.id];
    if (!resolution) {
      onShowToast?.(
        `No live channel found for ${m.home} vs ${m.away} — check the Live Sports Center below`,
        'warning'
      );
      return;
    }
    onPlayStream?.(resolution.channel);
  }, [resolutions, onPlayStream, onShowToast]);

  const scrollByAmount = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const amt = Math.min(scrollRef.current.clientWidth * 0.6, 280);
      scrollRef.current.scrollBy({ left: dir === 'left' ? -amt : amt, behavior: 'smooth' });
    }
  };

  const renderCompactScore = (m: MatchRow, isLive: boolean) => (
    <div
      key={m.id}
      className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-xs ${
        isLive
          ? 'bg-slate-900/60 border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5'
          : 'bg-slate-900/30 border border-slate-800/50 hover:bg-slate-800/50 hover:border-slate-700/70'
      } min-w-[180px] first:ml-1 last:mr-1`}
    >
      {isLive && (
        <span className="absolute top-0.5 left-2 flex items-center gap-0.5 text-[8px] font-black text-red-400 uppercase">
          <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
          LIVE
        </span>
      )}
      <span className={`text-[9px] font-mono uppercase ${LEAGUE_COLORS[m.league] || 'text-slate-400'} mt-0.5`}>
        {m.league.split(' ')[0]}
      </span>
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between gap-1">
          <span className="font-bold text-white truncate">{m.home}</span>
          <span className="font-black text-blue-400 min-w-[24px] text-right">
            {m.homeScore ?? '—'}
          </span>
        </div>
        <div className="flex justify-between gap-1">
          <span className="font-bold text-slate-300 truncate">{m.away}</span>
          <span className="font-black text-blue-400 min-w-[24px] text-right">
            {m.awayScore ?? '—'}
          </span>
        </div>
      </div>
      <span className="text-[8px] font-mono text-slate-600 whitespace-nowrap ml-1">
        {m.minute || m.quarter || ''}
      </span>
    </div>
  );

  return (
    <div className="glass-card rounded-2xl mb-6 overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-900/60 border-b border-slate-800/50">
        <button
          onClick={() => setActiveTab('scores')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'scores'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          Scores
          {filteredLive.length > 0 && (
            <span className="px-1 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black">
              {filteredLive.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'guide'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          TV Guide
          <span className="text-[9px] text-slate-500">{filteredUpcoming.length} today</span>
        </button>

        {/* AI status + refresh + league filter */}
        <div className="flex items-center gap-1 pl-2">
          <span
            className={`hidden sm:flex items-center gap-0.5 text-[9px] font-mono ${aiLive ? 'text-purple-400' : 'text-slate-600'}`}
            title={aiLive ? 'AI-generated scores' : 'AI offline — showing fallback data'}
          >
            <Sparkles className="w-3 h-3" />
            {aiLive ? 'AI' : 'OFF'}
          </span>
          <button
            onClick={() => refreshFeed(true)}
            disabled={isRefreshing}
            className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-all disabled:opacity-50"
            title="Refresh scores"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
          <button
            onClick={() => {
              if (hasActiveFilter) resetFilters();
              else setSelectedLeagues(Object.fromEntries(availableLeagues.map((l) => [l, true])));
            }}
            className={`p-1 rounded-md text-xs font-medium transition-all ${
              hasActiveFilter
                ? 'text-blue-300 bg-blue-600/20'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
            title="Toggle league filter"
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
          {hasActiveFilter && (
            <button
              onClick={resetFilters}
              className="p-0.5 rounded text-[9px] text-slate-500 hover:text-slate-300"
              title="Clear filters"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* AI insight banner */}
      {aiLive && aiInsight && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-950/40 to-slate-900/40 border-b border-purple-500/20">
          <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
          <p className="text-[11px] text-purple-200/90 truncate flex-1">{aiInsight}</p>
          {updatedAt && (
            <span className="text-[9px] font-mono text-slate-500 shrink-0">
              {Math.max(0, Math.floor((Date.now() - updatedAt) / 60000))}m ago
            </span>
          )}
        </div>
      )}

      {/* Scores content */}
      {activeTab === 'scores' && (
        <div className="p-2">
          {/* Live ticker — horizontal scroll */}
          {filteredLive.length > 0 && (
            <>
              <div className="relative">
                {/* Gradient edges */}
                <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-slate-900 to-transparent pointer-events-none z-10" />
                <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-slate-900 to-transparent pointer-events-none z-10" />

                {/* Scroll buttons (only show on hover) */}
                <button
                  onClick={() => scrollByAmount('left')}
                  className="absolute left-0.5 top-1/2 -translate-y-1/2 z-20 p-1 rounded-md bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/80 transition-all opacity-0 group-hover:opacity-100"
                >
                  ‹
                </button>
                <button
                  onClick={() => scrollByAmount('right')}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 z-20 p-1 rounded-md bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/80 transition-all opacity-0 group-hover:opacity-100"
                >
                  ›
                </button>

                <div
                  ref={scrollRef}
                  className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-px-1 py-2"
                >
                  {filteredLive.map((m) => renderCompactScore(m, true))}
                </div>
              </div>

              <div className="h-px bg-slate-800/50 my-2" />
            </>
          )}

          {/* Compact upcoming list */}
          {filteredUpcoming.length > 0 && (
            <div className="mt-1 space-y-0.5">
              <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                Upcoming ({filteredUpcoming.length})
              </p>
              {filteredUpcoming.slice(0, 5).map((m) => {
                const resolution = resolutions[m.id];
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/30 border border-slate-800/40 hover:bg-slate-800/50 transition-colors ${resolution ? 'cursor-pointer' : 'opacity-60'}`}
                    onClick={() => handleWatch(m)}
                    title={describeResolution(resolution ?? null)}
                  >
                    <span className="flex items-center gap-0.5 text-[9px] font-mono text-slate-400 shrink-0">
                      <Clock className="w-2.5 h-2.5" />
                      {m.time}
                    </span>
                    <span className={`text-[9px] font-mono uppercase ${LEAGUE_COLORS[m.league] || 'text-slate-400'} shrink-0`}>
                      {m.league.split(' ').pop() || m.league}
                    </span>
                    <span className="text-xs font-medium text-slate-300 truncate">
                      {m.home} <span className="text-slate-600">vs</span> {m.away}
                    </span>
                    {resolution && (
                      <span className="ml-auto hidden sm:flex items-center gap-1 text-[9px] font-mono text-slate-500 truncate max-w-[140px]">
                        <Tv className="w-2.5 h-2.5 shrink-0" />
                        {resolution.channel.title}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Compact finished list */}
          {filteredFinished.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                Completed
              </p>
              {filteredFinished.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/20 opacity-60"
                >
                  <CheckCircle2 className="w-3 h-3 text-slate-600 shrink-0" />
                  <span className="text-[9px] font-mono text-slate-500 uppercase shrink-0">{m.league.split(' ')[0]}</span>
                  <span className="text-xs text-slate-400 truncate flex-1">
                    {m.home} <span className="text-slate-600">—</span> {m.away}
                  </span>
                  <span className="text-xs font-mono text-slate-500 shrink-0">
                    {m.homeScore}–{m.awayScore}
                  </span>
                </div>
              ))}
            </div>
          )}

          {filteredLive.length === 0 && filteredUpcoming.length === 0 && (
            <div className="py-6 text-center">
              <PauseCircle className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No matches in selected leagues</p>
            </div>
          )}
        </div>
      )}

      {/* TV Guide content */}
      {activeTab === 'guide' && (
        <div className="p-2">
          <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>

          <div className="border border-slate-800/50 rounded-lg overflow-hidden bg-slate-900/30">
            <div className="grid grid-cols-[48px_100px_1fr_44px_44px_24px] gap-1 px-2 py-1 bg-slate-800/40 border-b border-slate-800/50 text-[9px] font-mono uppercase tracking-wider text-slate-500">
              <span>Time</span>
              <span>League</span>
              <span>Match</span>
              <span>Status</span>
              <span>Watch</span>
              <span />
            </div>

            <div className="max-h-56 overflow-y-auto">
              {filteredUpcoming.map((m) => {
                const resolution = resolutions[m.id];
                return (
                  <div
                    key={m.id}
                    className="grid grid-cols-[48px_100px_1fr_44px_44px_24px] gap-1 items-center px-2 py-1.5 border-b border-slate-800/30 last:border-0 hover:bg-slate-800/30 transition-colors"
                  >
                    <span className="text-xs font-mono text-slate-400">{m.time}</span>
                    <span className={`text-[9px] font-mono uppercase ${LEAGUE_COLORS[m.league] || 'text-slate-400'}`}>{m.league.split(' ').pop() || m.league}</span>
                    <span className="text-xs text-slate-300 truncate">{m.home} vs {m.away}</span>
                    <span className="text-[9px] font-mono text-slate-600">UPCOMING</span>                    <button
                      onClick={() => handleWatch(m)}
                      disabled={!resolution}
                      className={`flex items-center justify-center w-9 h-6 mx-auto rounded-md transition-colors ${
                        resolution
                          ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                          : 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
                      }`}
                      title={describeResolution(resolution ?? null)}
                    >
                      <Play className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => fetchPreview(m)}
                      disabled={loadingPreviewId === m.id}
                      className="flex items-center justify-center w-5 h-5 mx-auto rounded-md text-slate-600 hover:text-purple-400 hover:bg-purple-900/30 transition-all disabled:opacity-50"
                      title="AI preview - why watch this?"
                    >
                      {loadingPreviewId === m.id ? (
                        <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
                      ) : previews[m.id] ? (
                        <CheckCircle2 className="w-3 h-3 text-purple-400" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                    </button>
                    {previews[m.id] && (
                      <div className="px-4 py-1 bg-purple-950/20 border-b border-purple-500/10 text-[10px] text-purple-200/90 flex items-start gap-1.5">
                        <Sparkles className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
                        <span>{previews[m.id]}</span>
                      </div>
                    )}

                  </div>
                );
              })}

              {filteredLive.map((m) => {
                const resolution = resolutions[m.id];
                return (
                  <div
                    key={`live-${m.id}`}
                    className="grid grid-cols-[48px_100px_1fr_44px_44px_24px] gap-1 items-center px-2 py-1.5 border-b border-slate-800/30 last:border-0 bg-red-500/5"
                  >
                    <span className="text-xs font-mono text-red-400">{m.minute || m.quarter || 'LIVE'}</span>
                    <span className={`text-[9px] font-mono uppercase ${LEAGUE_COLORS[m.league] || 'text-red-400'}`}>{m.league.split(' ').pop() || m.league}</span>
                    <span className="text-xs font-bold text-white truncate">{m.home} {m.homeScore} — {m.awayScore} {m.away}</span>
                    <span className="text-[8px] font-black text-red-400 uppercase">LIVE</span>
                    <button
                      onClick={() => handleWatch(m)}
                      disabled={!resolution}
                      className={`flex items-center justify-center w-9 h-6 mx-auto rounded-md transition-colors ${
                        resolution
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          : 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
                      }`}
                      title={describeResolution(resolution ?? null)}
                    >
                      <Play className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => fetchPreview(m)}
                      disabled={loadingPreviewId === m.id}
                      className="flex items-center justify-center w-5 h-5 mx-auto rounded-md text-slate-600 hover:text-purple-400 hover:bg-purple-900/30 transition-all disabled:opacity-50"
                      title="AI preview - why watch this?"
                    >
                      {loadingPreviewId === m.id ? (
                        <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
                      ) : previews[m.id] ? (
                        <CheckCircle2 className="w-3 h-3 text-purple-400" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                    </button>
                    {previews[m.id] && (
                      <div className="px-4 py-1 bg-purple-950/20 border-b border-purple-500/10 text-[10px] text-purple-200/90 flex items-start gap-1.5">
                        <Sparkles className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
                        <span>{previews[m.id]}</span>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            {filteredUpcoming.length === 0 && filteredLive.length === 0 && (
              <div className="py-6 text-center">
                <Calendar className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No matches scheduled for selected leagues</p>
                {hasActiveFilter && (
                  <button
                    onClick={resetFilters}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    Clear league filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
