import React, { useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Radio } from 'lucide-react';
import {
  UpcomingEvent,
  SPORT_INFO,
  formatEventTime,
} from '../services/sportsCalendarService';

interface UpcomingEventsRowProps {
  events: UpcomingEvent[];
  isLoading: boolean;
  onViewAll: () => void;
}

export const UpcomingEventsRow: React.FC<UpcomingEventsRowProps> = ({
  events,
  isLoading,
  onViewAll,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shown = events.slice(0, 10);

  const scrollBy = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  if (isLoading && shown.length === 0) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <Calendar className="w-4 h-4 text-blue-400" />
          <h2 className="text-base font-bold text-white">Upcoming Events</h2>
          <span className="text-xs text-slate-500 animate-pulse">loading…</span>
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="w-72 shrink-0 h-24 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (shown.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <Calendar className="w-4 h-4 text-blue-400" />
          <h2 className="text-base font-bold text-white">Upcoming Events</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollBy(-1)}
            className="p-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onViewAll}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors"
          >
            View All
          </button>
          <button
            onClick={() => scrollBy(1)}
            className="p-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {shown.map((e) => {
          const info = SPORT_INFO[e.sport];
          const isLive = e.state === 'in';
          return (
            <div
              key={e.id}
              className="w-72 shrink-0 p-3.5 rounded-xl bg-gradient-to-br from-slate-900/80 to-[#0f121a] border border-slate-800 hover:border-blue-700/60 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {info?.emoji} {e.league}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isLive
                      ? 'bg-red-600/20 text-red-300'
                      : 'bg-emerald-600/15 text-emerald-300'
                  }`}
                >
                  {isLive ? '● LIVE' : 'UPCOMING'}
                </span>
              </div>
              <div className="space-y-1 mb-2.5">
                <div className="flex items-center gap-2">
                  {e.awayLogo && (
                    <img src={e.awayLogo} alt="" className="w-5 h-5 object-contain" loading="lazy" />
                  )}
                  <span className="text-sm font-semibold text-slate-200 truncate">{e.away}</span>
                </div>
                <div className="flex items-center gap-2">
                  {e.homeLogo && (
                    <img src={e.homeLogo} alt="" className="w-5 h-5 object-contain" loading="lazy" />
                  )}
                  <span className="text-sm font-semibold text-slate-200 truncate">{e.home}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {formatEventTime(e.date)}
                </span>
                {e.broadcast && (
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Radio className="w-3 h-3" /> {e.broadcast}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
