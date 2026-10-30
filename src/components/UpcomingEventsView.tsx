import React, { useState, useMemo } from 'react';
import { Calendar, Clock, Radio, ChevronRight, Bookmark } from 'lucide-react';
import {
  UpcomingEvent,
  SPORT_INFO,
  formatEventTime,
} from '../services/sportsCalendarService';

interface UpcomingEventsViewProps {
  events: UpcomingEvent[];
  isLoading: boolean;
  onRefresh: () => void;
  watchlistIds?: string[];
  onToggleWatchlist?: (eventId: string) => void;
}

export const UpcomingEventsView: React.FC<UpcomingEventsViewProps> = ({
  events,
  isLoading,
  onRefresh,
  watchlistIds = [],
  onToggleWatchlist,
}) => {
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  const sportSlugs = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => set.add(e.sport));
    return Array.from(set);
  }, [events]);

  const dates = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => e.date && set.add(e.date.slice(0, 10)));
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (sportFilter !== 'all' && e.sport !== sportFilter) return false;
      if (dateFilter !== 'all' && e.date.slice(0, 10) !== dateFilter) return false;
      return true;
    });
  }, [events, sportFilter, dateFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, UpcomingEvent[]>();
    for (const e of filtered) {
      const key = e.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const dateLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86400000);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleToggleWatchlist = (eventId: string) => {
    if (onToggleWatchlist) {
      onToggleWatchlist(eventId);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/25 border border-blue-500/50 flex items-center justify-center text-blue-300">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Upcoming Events</h1>
            <p className="text-xs text-slate-400">Live & upcoming matches across all sports</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button
          onClick={() => setSportFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
            sportFilter === 'all'
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
          }`}
        >
          All Sports
        </button>
        {sportSlugs.map((slug) => {
          const info = SPORT_INFO[slug];
          return (
            <button
              key={slug}
              onClick={() => setSportFilter(slug)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                sportFilter === slug
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              {info?.emoji} {info?.label || slug}
            </button>
          );
        })}
      </div>

      {/* Date pills */}
      {dates.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              dateFilter === 'all'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            All Dates
          </button>
          {dates.map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                dateFilter === d
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              {dateLabel(d)}
            </button>
          ))}
        </div>
      )}

      {isLoading && events.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40 animate-pulse" />
          Loading events…
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
          No upcoming events found for this filter.
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([date, dayEvents]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 rounded bg-blue-500" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  {dateLabel(date)}
                </h2>
                <span className="text-xs text-slate-500 font-mono">
                  {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dayEvents.map((e) => {
                  const info = SPORT_INFO[e.sport];
                  const isLive = e.state === 'in';
                  const inWatchlist = watchlistIds.includes(e.id);
                  return (
                    <div
                      key={e.id}
                      className="p-3.5 rounded-xl bg-gradient-to-br from-slate-900/80 to-[#0f121a] border border-slate-800 hover:border-blue-700/60 transition-colors relative"
                    >
                      <button
                        onClick={() => handleToggleWatchlist(e.id)}
                        className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-800 transition-colors z-10"
                        title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                      >
                        <Bookmark
                          className={`w-4 h-4 ${
                            inWatchlist
                              ? 'fill-blue-500 text-blue-400'
                              : 'text-slate-400'
                          }`}
                        />
                      </button>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {info?.emoji} {e.league}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-bold">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {formatEventTime(e.date)}
                        </span>
                      </div>
                      <div className="space-y-1.5 mb-2.5">
                        <div className="flex items-center gap-2">
                          {e.awayLogo && (
                            <img
                              src={e.awayLogo}
                              alt=""
                              className="w-5 h-5 object-contain"
                              loading="lazy"
                            />
                          )}
                          <span className="text-sm font-semibold text-slate-200 truncate flex-1">
                            {e.away}
                          </span>
                          {e.awayScore !== undefined && (
                            <span
                              className={`text-sm font-bold font-mono px-1.5 py-0.5 rounded ${
                                isLive ? 'bg-blue-600/30 text-blue-200' : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {e.awayScore}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {e.homeLogo && (
                            <img
                              src={e.homeLogo}
                              alt=""
                              className="w-5 h-5 object-contain"
                              loading="lazy"
                            />
                          )}
                          <span className="text-sm font-semibold text-slate-200 truncate flex-1">
                            {e.home}
                          </span>
                          {e.homeScore !== undefined && (
                            <span
                              className={`text-sm font-bold font-mono px-1.5 py-0.5 rounded ${
                                isLive ? 'bg-blue-600/30 text-blue-200' : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {e.homeScore}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                            isLive
                              ? 'bg-red-600/20 text-red-300 border border-red-500/40'
                              : 'bg-emerald-600/15 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isLive ? `● ${e.detail || 'Live'}` : e.detail || 'Upcoming'}
                        </span>
                        {e.broadcast && (
                          <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                            <Radio className="w-3 h-3" /> {e.broadcast}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
