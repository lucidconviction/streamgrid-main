import React, { useState, useEffect } from 'react';
import { Clock, Trophy, ArrowRight, Calendar } from 'lucide-react';

// Simulated live scores — replace with real API integration
const MOCK_SCHEDULE = [
  { id: '1', time: 'LIVE', league: 'Premier League', home: 'Man United', away: 'Liverpool', homeScore: 1, awayScore: 1, status: 'live', minute: "72'" },
  { id: '2', time: 'LIVE', league: 'Champions League', home: 'Real Madrid', away: 'Bayern Munich', homeScore: 2, awayScore: 0, status: 'live', minute: "58'" },
  { id: '3', time: 'LIVE', league: 'NBA', home: 'Lakers', away: 'Celtics', homeScore: 98, awayScore: 102, status: 'live', quarter: 'Q4 2:14' },
  { id: '4', time: '18:00', league: 'La Liga', home: 'Barcelona', away: 'Atletico', homeScore: null, awayScore: null, status: 'upcoming' },
  { id: '5', time: '20:45', league: 'Serie A', home: 'Juventus', away: 'AC Milan', homeScore: null, awayScore: null, status: 'upcoming' },
  { id: '6', time: '21:00', league: 'Premier League', home: 'Arsenal', away: 'Chelsea', homeScore: null, awayScore: null, status: 'upcoming' },
  { id: '7', time: '22:00', league: 'Champions League', home: 'PSG', away: 'Dortmund', homeScore: null, awayScore: null, status: 'upcoming' },
  { id: '8', time: 'FT', league: 'Bundesliga', home: 'Leipzig', away: 'Leverkusen', homeScore: 0, awayScore: 3, status: 'finished' },
];

interface SportsEPGProps {
  streams: Array<{ id: string; title: string; name?: string }>;
  onPlayStream?: (stream: { id: string; title: string }) => void;
}

export const SportsEPG: React.FC<SportsEPGProps> = ({ streams, onPlayStream }) => {
  const [activeTab, setActiveTab] = useState<'scores' | 'guide'>('scores');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const liveMatches = MOCK_SCHEDULE.filter((m) => m.status === 'live');
  const upcoming = MOCK_SCHEDULE.filter((m) => m.status === 'upcoming');
  const finished = MOCK_SCHEDULE.filter((m) => m.status === 'finished');

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5 mb-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 bg-slate-900/60 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('scores')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'scores'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          Live Scores
          {liveMatches.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black">
              {liveMatches.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'guide'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          TV Guide
          <span className="text-[10px] text-slate-500">{upcoming.length} today</span>
        </button>
      </div>

      {activeTab === 'scores' && (
        <div className="space-y-2">
          {liveMatches.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-900/50 border border-red-500/20 hover:border-red-500/40 transition-colors"
            >
              <span className="flex items-center gap-1 text-[10px] font-black text-red-400 uppercase tracking-wider shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Live
              </span>
              <span className="text-[10px] text-slate-500 font-mono shrink-0">{m.league}</span>
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-white truncate">{m.home}</span>
                <span className="flex items-center gap-1 text-sm font-black shrink-0">
                  <span className={m.homeScore !== null && m.homeScore >= m.awayScore ? 'text-green-400' : 'text-white'}>{m.homeScore ?? '–'}</span>
                  <span className="text-slate-600">:</span>
                  <span className={m.awayScore !== null && m.awayScore > m.homeScore ? 'text-green-400' : 'text-white'}>{m.awayScore ?? '–'}</span>
                </span>
                <span className="text-sm font-bold text-white truncate">{m.away}</span>
              </div>
              <span className="text-[10px] font-mono text-blue-400 shrink-0">{m.minute || ''}</span>
            </div>
          ))}

          {finished.length > 0 && (
            <>
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mt-3 mb-1.5">Completed</p>
              {finished.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-900/30 border border-slate-800/50 opacity-60"
                >
                  <span className="text-[10px] font-mono text-slate-600 shrink-0">{m.time}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">{m.league}</span>
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-400 truncate">{m.home}</span>
                    <span className="text-sm font-bold text-slate-300 shrink-0">{m.homeScore} – {m.awayScore}</span>
                    <span className="text-sm text-slate-400 truncate">{m.away}</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mt-3 mb-1.5">Upcoming</p>
              {upcoming.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-900/30 border border-slate-800/50"
                >
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {m.time}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0">{m.league}</span>
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-300 truncate">{m.home}</span>
                    <span className="text-[10px] text-slate-600 font-mono shrink-0">VS</span>
                    <span className="text-sm text-slate-300 truncate">{m.away}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {activeTab === 'guide' && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            Today's Schedule — {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          {MOCK_SCHEDULE.filter((m) => m.status === 'upcoming').map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800/50 hover:border-blue-500/30 transition-colors cursor-pointer"
              onClick={() => onPlayStream?.({ id: m.id, title: `${m.home} vs ${m.away}` })}
            >
              <div className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg bg-blue-600/20 min-w-[52px]">
                <span className="text-xs font-black text-blue-400">{m.time.split(':')[0]}</span>
                <span className="text-[9px] text-blue-500/70 font-mono">{(m.time.split(':')[1])}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{m.home} <span className="text-slate-500">vs</span> {m.away}</p>
                <p className="text-[10px] text-slate-500">{m.league}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
            </div>
          ))}
          {upcoming.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">No upcoming matches today</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
