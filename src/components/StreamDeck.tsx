import React, { useState, useMemo } from 'react';
import {
  Play,
  Eye,
  Clock,
  CalendarClock,
  ListVideo,
  Bell,
  BellRing,
} from 'lucide-react';
import { YouTubeStream } from '../types/stream';
import { fmtDuration, fmtViews } from '../services/youtubeService';
import { useLiveViewers } from '../hooks/useLiveViewers';

const FILTERS = [
  { id: 'live', label: '🔴 Live Now' },
  { id: 'upcoming', label: '📅 Upcoming' },
  { id: 'vod', label: '🎬 Streams / VODs' },
  { id: 'shorts', label: '⚡ Highlights / Shorts' },
  { id: 'playlists', label: '📚 Playlists' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

interface StreamDeckProps {
  streams: YouTubeStream[];
  onOpenStream: (stream: YouTubeStream) => void;
  reminders: string[];
  onToggleReminder: (streamId: string) => void;
}

export const StreamDeck: React.FC<StreamDeckProps> = ({
  streams,
  onOpenStream,
  reminders,
  onToggleReminder,
}) => {
  const [filter, setFilter] = useState<FilterId>('live');
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = useMemo(() => {
    if (filter === 'live') return streams.filter((s) => s.status === 'live');
    if (filter === 'upcoming')
      return streams
        .filter((s) => s.status === 'upcoming')
        .sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0));
    if (filter === 'vod') return streams.filter((s) => s.status === 'vod');
    if (filter === 'shorts') return streams.filter((s) => s.status === 'shorts');
    if (filter === 'playlists') return streams.filter((s) => s.playlistId);
    return streams;
  }, [streams, filter]);

  const safeIdx = filtered.length > 0 ? activeIdx % filtered.length : 0;
  const active = filtered[safeIdx];

  const counts = useMemo(
    () => ({
      live: streams.filter((s) => s.status === 'live').length,
      upcoming: streams.filter((s) => s.status === 'upcoming').length,
      vod: streams.filter((s) => s.status === 'vod').length,
      shorts: streams.filter((s) => s.status === 'shorts').length,
      playlists: streams.filter((s) => s.playlistId).length,
    }),
    [streams]
  );

  // Deck rotation: position cards around the active index in a 3D arc
  const deckItems = useMemo(() => {
    if (filtered.length === 0) return [];
    const span = 3; // cards visible on each side of the focus
    const items: Array<{ stream: YouTubeStream; offset: number }> = [];
    for (let off = -span; off <= span; off++) {
      // Proper positive modulo (JS % returns negatives for negative dividends)
      const idx = ((safeIdx + off) % filtered.length + filtered.length) % filtered.length;
      items.push({ stream: filtered[idx], offset: off });
    }
    return items;
  }, [filtered, safeIdx]);

  const goTo = (idx: number) => {
    if (filtered.length === 0) return;
    setActiveIdx(((idx % filtered.length) + filtered.length) % filtered.length);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      if (e.deltaX > 20) goTo(safeIdx + 1);
      else if (e.deltaX < -20) goTo(safeIdx - 1);
    } else if (e.deltaY > 20) goTo(safeIdx + 1);
    else if (e.deltaY < -20) goTo(safeIdx - 1);
  };

  return (
    <div className="select-none">
      {/* ── Filter chips ── */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setFilter(f.id);
              setActiveIdx(0);
            }}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border transition-all touch-manipulation ${
              filter === f.id
                ? 'bg-red-600/20 border-red-500/60 text-red-300 shadow-lg shadow-red-900/30'
                : 'bg-slate-900/60 border-slate-700/60 text-slate-400 hover:text-white hover:border-slate-600'
            }`}
          >
            <span>{f.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                filter === f.id ? 'bg-red-500/30 text-red-200' : 'bg-slate-800 text-slate-500'
              }`}
            >
              {counts[f.id as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-slate-500 text-sm">Nothing here yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* ── 3D Card Deck ── */}
          <div
            className="relative h-[340px] sm:h-[380px] md:h-[420px]"
            style={{ perspective: '1400px' }}
            onWheel={onWheel}
          >
            {/* Deck background glow */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-64 bg-red-600/10 blur-3xl rounded-full pointer-events-none" />

            {deckItems.map(({ stream, offset }) => (
              <DeckCard
                key={stream.id}
                stream={stream}
                offset={offset}
                isFocused={offset === 0}
                hasReminder={reminders.includes(stream.id)}
                onOpen={() => (offset === 0 ? onOpenStream(stream) : goTo(safeIdx + offset))}
                onToggleReminder={() => onToggleReminder(stream.id)}
              />
            ))}

            {/* Arrows */}
            <button
              onClick={() => goTo(safeIdx - 1)}
              className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700 text-white flex items-center justify-center hover:bg-slate-800 transition-colors shadow-xl touch-manipulation"
              aria-label="Previous stream"
            >
              ←
            </button>
            <button
              onClick={() => goTo(safeIdx + 1)}
              className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700 text-white flex items-center justify-center hover:bg-slate-800 transition-colors shadow-xl touch-manipulation"
              aria-label="Next stream"
            >
              →
            </button>

            {/* Dot indicators */}
            <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5 z-30">
              {filtered.slice(0, 30).map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === safeIdx ? 'w-5 bg-red-500' : 'w-1.5 bg-slate-600 hover:bg-slate-500'
                  }`}
                  aria-label={`Go to ${s.title}`}
                />
              ))}
            </div>
          </div>

          {/* ── Focused stream detail strip ── */}
          {active && (
            <div className="mt-4 glass-card rounded-2xl p-4 sm:p-5 animate-fadeIn" key={active.id}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <ChannelBadge channel={active.channel} />
                    {active.status === 'live' && <LiveBadge viewers={active.viewers ?? 0} />}
                    {active.status === 'upcoming' && active.scheduledAt && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-300 text-[10px] font-bold">
                        <CalendarClock className="w-3 h-3" />
                        {fmtUpcoming(active.scheduledAt)}
                      </span>
                    )}
                    {active.status === 'vod' && active.durationSeconds && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold">
                        <Clock className="w-3 h-3" />
                        {fmtDuration(active.durationSeconds)}
                      </span>
                    )}
                    {active.status === 'shorts' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                        SHORT
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-snug mb-1">
                    {active.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-2">{active.description}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {active.tags.slice(0, 4).map((t) => (
                      <span key={t} className="text-[10px] font-mono text-blue-400/80">
                        {t}
                      </span>
                    ))}
                    {active.playlistTitle && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                        <ListVideo className="w-3 h-3" />
                        {active.playlistTitle}
                        {active.playlistIndex ? ` • #${active.playlistIndex}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onOpenStream(active)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all touch-manipulation"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    {active.status === 'upcoming' ? 'View Details' : 'Watch Now'}
                  </button>
                  {active.status === 'upcoming' && (
                    <button
                      onClick={() => onToggleReminder(active.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-colors touch-manipulation ${
                        reminders.includes(active.id)
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
                      }`}
                      title={reminders.includes(active.id) ? 'Reminder set' : 'Set reminder'}
                    >
                      {reminders.includes(active.id) ? (
                        <BellRing className="w-4 h-4" />
                      ) : (
                        <Bell className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">
                        {reminders.includes(active.id) ? 'Reminded' : 'Remind Me'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Channel badge ───────────────────────────────────────────────────────────

export const ChannelBadge: React.FC<{ channel: YouTubeStream['channel'] }> = ({ channel }) => (
  <span className="flex items-center gap-1.5">
    <img
      src={channel.avatar}
      alt=""
      className="w-4 h-4 rounded-full border border-slate-600"
      referrerPolicy="no-referrer"
    />
    <span className="text-[11px] font-bold text-slate-300">{channel.name}</span>
    {channel.verified && (
      <span className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center text-white text-[8px] font-black">
        ✓
      </span>
    )}
  </span>
);

// ── Live badge (drifts live) ────────────────────────────────────────────────

const LiveBadge: React.FC<{ viewers: number }> = ({ viewers }) => {
  const liveViewers = useLiveViewers(viewers);
  return (
    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600/90 text-white text-[10px] font-black tracking-wide">
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      LIVE
      <span className="flex items-center gap-0.5 font-mono font-bold text-red-100">
        <Eye className="w-3 h-3" />
        {fmtViews(liveViewers)}
      </span>
    </span>
  );
};

function fmtUpcoming(ts: number): string {
  const delta = ts - Date.now();
  const h = Math.floor(delta / 3600000);
  if (h < 1) return 'Starting soon';
  if (h < 24) return `In ${h}h`;
  return new Date(ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Individual deck card ────────────────────────────────────────────────────

interface DeckCardProps {
  stream: YouTubeStream;
  offset: number;
  isFocused: boolean;
  hasReminder: boolean;
  onOpen: () => void;
  onToggleReminder: () => void;
}

const DeckCard: React.FC<DeckCardProps> = ({
  stream,
  offset,
  isFocused,
  hasReminder,
  onOpen,
  onToggleReminder,
}) => {
  const abs = Math.abs(offset);
  const side = offset >= 0 ? 1 : -1;
  const scale = isFocused ? 1 : Math.max(0.62, 1 - abs * 0.09);
  const rotateY = isFocused ? 0 : -side * (24 + abs * 4);
  const translateX = isFocused ? 0 : side * (150 + abs * 55);
  const translateZ = isFocused ? 60 : -abs * 90;
  const z = isFocused ? 20 : 10 - abs;
  const dim = isFocused
    ? 'opacity-100'
    : abs > 2
      ? 'opacity-30 blur-[2px]'
      : abs > 1
        ? 'opacity-55 blur-[1px]'
        : 'opacity-80';

  return (
    <button
      onClick={onOpen}
      className={`absolute left-1/2 top-1/2 w-[300px] sm:w-[360px] md:w-[400px] rounded-2xl overflow-hidden border transition-all duration-500 ease-out cursor-pointer ${dim} ${
        isFocused
          ? 'border-red-500/50 shadow-2xl shadow-red-900/40 ring-1 ring-red-500/30'
          : 'border-slate-700/70 shadow-xl shadow-black/50'
      }`}
      style={{
        transform: `translate(-50%, -50%) translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
        transformStyle: 'preserve-3d',
        zIndex: z,
        transitionProperty: 'transform, opacity, filter, border-color, box-shadow',
      }}
      aria-label={stream.title}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-slate-900">
        <img
          src={stream.thumbnail}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

        {/* Status badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          {stream.status === 'live' && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-600 text-white text-[10px] font-black">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          )}
          {stream.status === 'upcoming' && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 text-white text-[10px] font-black">
              UPCOMING
            </span>
          )}
          {stream.status === 'vod' && (
            <span className="px-2 py-1 rounded-md bg-black/80 text-white text-[10px] font-bold border border-white/20">
              VOD
            </span>
          )}
          {stream.status === 'shorts' && (
            <span className="px-2 py-1 rounded-md bg-amber-500 text-black text-[10px] font-black">
              SHORT
            </span>
          )}
        </div>

        {stream.status === 'live' && stream.viewers != null && (
          <span className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/80 text-white text-[10px] font-bold">
            <Eye className="w-3 h-3" />
            {fmtViews(stream.viewers)}
          </span>
        )}
        {(stream.status === 'vod' || stream.status === 'shorts') && stream.durationSeconds && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/85 text-white text-[10px] font-mono font-bold">
            {fmtDuration(stream.durationSeconds)}
          </span>
        )}
        {stream.status === 'upcoming' && stream.scheduledAt && (
          <span className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/85 text-blue-300 text-[10px] font-bold">
            {fmtUpcoming(stream.scheduledAt)}
          </span>
        )}

        {/* Focus CTA */}
        {isFocused && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/95 text-white text-sm font-black shadow-xl shadow-red-900/50 hover:bg-red-500 transition-colors">
              <Play className="w-4 h-4 fill-white" />
              {stream.status === 'upcoming' ? 'View' : 'Watch Now'}
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="bg-[#0f121a] px-3 py-2.5">
        <p className="text-xs sm:text-[13px] font-bold text-white truncate">{stream.title}</p>
        <div className="flex items-center justify-between mt-1.5">
          <ChannelBadge channel={stream.channel} />
          <span className="text-[9px] font-mono text-slate-500 uppercase">{stream.category}</span>
        </div>
      </div>

      {/* Reminder chip for upcoming, visible when focused */}
      {isFocused && stream.status === 'upcoming' && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onToggleReminder();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              onToggleReminder();
            }
          }}
          className={`absolute bottom-14 right-3 p-2 rounded-full border backdrop-blur-md transition-colors ${
            hasReminder
              ? 'bg-amber-500/30 border-amber-400/60 text-amber-200'
              : 'bg-black/60 border-white/25 text-white/80 hover:text-white'
          }`}
          title={hasReminder ? 'Reminder set' : 'Set reminder'}
        >
          {hasReminder ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
        </span>
      )}
    </button>
  );
};
