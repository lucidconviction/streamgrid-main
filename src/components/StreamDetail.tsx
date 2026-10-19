import React, { useState, useMemo, useRef } from 'react';
import {
  Play,
  ExternalLink,
  Bell,
  BellRing,
  Bookmark,
  ListVideo,
  ChevronLeft,
  Clock,
  Eye,
  MessageSquare,
  CalendarClock,
  Share2,
} from 'lucide-react';
import { YouTubeStream, YouTubeChapter } from '../types/stream';
import { fmtDuration, fmtTime, fmtViews, getRelated, getPlaylistsFor } from '../services/youtubeService';
import { ChannelBadge } from './StreamDeck';

interface StreamDetailProps {
  stream: YouTubeStream;
  onBack: () => void;
  onPlay: (stream: YouTubeStream) => void;
  onOpenStream: (stream: YouTubeStream) => void;
  isInWatchlist: boolean;
  onToggleWatchlist: (stream: YouTubeStream) => void;
  reminders: string[];
  onToggleReminder: (streamId: string) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

const CHAT_COLORS = ['bg-red-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-purple-600'];

interface ChatMsg {
  id: string;
  user: string;
  color: string;
  text: string;
}

const CHAT_NAMES = ['streamer_fan', 'pixelgrrl', 'gg_ez', 'mod_kat', 'lofi_larry', 'clipz_4u'];
const CHAT_TEXTS = [
  'this is insane 🔥',
  'first time on the stream, loving it',
  'what settings are you running?',
  'clutch!!',
  'chat is this real',
  'subbed, thanks for the content',
  'the production quality is wild',
  'brb coffee',
  'W streamer',
  'that was the play of the year',
];

export const StreamDetail: React.FC<StreamDetailProps> = ({
  stream,
  onBack,
  onPlay,
  onOpenStream,
  isInWatchlist,
  onToggleWatchlist,
  reminders,
  onToggleReminder,
  onShowToast,
}) => {
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>(() =>
    Array.from({ length: 6 }).map((_, i) => ({
      id: `init-${i}`,
      user: CHAT_NAMES[i % CHAT_NAMES.length],
      color: CHAT_COLORS[i % CHAT_COLORS.length],
      text: CHAT_TEXTS[i % CHAT_TEXTS.length],
    }))
  );
  const chatRef = useRef<HTMLDivElement>(null);

  // Simulated live chat feed
  React.useEffect(() => {
    const t = setInterval(() => {
      const user = CHAT_NAMES[Math.floor(Math.random() * CHAT_NAMES.length)];
      const text = CHAT_TEXTS[Math.floor(Math.random() * CHAT_TEXTS.length)];
      const color = CHAT_COLORS[Math.floor(Math.random() * CHAT_COLORS.length)];
      setChatMsgs((prev) => [...prev.slice(-40), { id: `c-${Date.now()}`, user, color, text }]);
    }, 7000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMsgs]);

  const related = useMemo(() => getRelated(stream), [stream]);
  const playlists = useMemo(() => getPlaylistsFor(stream), [stream]);

  const handleSubscribe = () => {
    onShowToast(`Subscribed to ${stream.channel.name} (simulated)`, 'success');
  };

  const handleCopyShare = () => {
    navigator.clipboard.writeText(stream.embedUrl);
    onShowToast('Share link copied to clipboard', 'success');
  };

  const isUpcoming = stream.status === 'upcoming';
  const hasReminder = reminders.includes(stream.id);

  return (
    <div className="animate-fadeIn">
      {/* ── Back button ── */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-bold text-slate-300 hover:text-red-400 transition-colors mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Stream Hub
      </button>

      {/* ── Hero banner ── */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 mb-6">
        <div className="relative aspect-[21/9] sm:aspect-[21/8] bg-slate-900">
          <img
            src={stream.thumbnail}
            alt=""
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1c] via-[#0a0f1c]/40 to-transparent" />

          {/* Play overlay */}
          {!isUpcoming && (
            <button
              onClick={() => onPlay(stream)}
              className="absolute inset-0 flex items-center justify-center group"
              aria-label="Play stream"
            >
              <span className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-red-600/95 group-hover:bg-red-500 text-white text-base font-black shadow-2xl shadow-red-900/50 transition-all group-hover:scale-105">
                <Play className="w-5 h-5 fill-white" />
                Watch Stream
              </span>
            </button>
          )}

          {isUpcoming && stream.scheduledAt && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center px-4">
                <p className="flex items-center justify-center gap-2 text-blue-300 text-xs font-bold uppercase tracking-widest mb-2">
                  <CalendarClock className="w-4 h-4" />
                  Starts {fmtUpcomingLabel(stream.scheduledAt)}
                </p>
                <button
                  onClick={() => onToggleReminder(stream.id)}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                    hasReminder
                      ? 'bg-amber-500/25 border-amber-400/70 text-amber-200'
                      : 'bg-blue-600/80 border-blue-400/50 text-white hover:bg-blue-500/80'
                  }`}
                >
                  {hasReminder ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                  {hasReminder ? 'Reminder Set' : 'Set Reminder'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Overlay meta */}
        <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {stream.status === 'live' && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[11px] font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
                {stream.viewers != null && (
                  <span className="font-mono font-bold text-red-100">{fmtViews(stream.viewers)} watching</span>
                )}
              </span>
            )}
            {stream.status === 'upcoming' && (
              <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white text-[11px] font-black">
                UPCOMING
              </span>
            )}
            {stream.status === 'vod' && (
              <span className="px-2.5 py-1 rounded-full bg-black/80 border border-white/25 text-white text-[11px] font-bold">
                VOD • {stream.durationSeconds ? fmtDuration(stream.durationSeconds) : ''}
              </span>
            )}
            {stream.tags.slice(0, 3).map((t) => (
              <span key={t} className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white/90 text-[11px] font-medium">
                {t}
              </span>
            ))}
          </div>
          <h1 className="text-xl sm:text-3xl font-black text-white leading-tight tracking-tight drop-shadow-lg">
            {stream.title}
          </h1>
        </div>
      </div>

      {/* ── Channel row + actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <img
            src={stream.channel.avatar}
            alt=""
            className="w-12 h-12 rounded-full border-2 border-slate-700"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white">{stream.channel.name}</span>
              {stream.channel.verified && (
                <span className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[9px] font-black">
                  ✓
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {stream.channel.subscribers} subscribers
            </p>
          </div>
          <button
            onClick={handleSubscribe}
            className="ml-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black transition-colors touch-manipulation"
          >
            Subscribe
          </button>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          {isUpcoming && (
            <button
              onClick={() => onToggleReminder(stream.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                hasReminder
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {hasReminder ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
              {hasReminder ? 'Reminder Set' : 'Remind Me'}
            </button>
          )}
          <button
            onClick={() => onToggleWatchlist(stream)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
              isInWatchlist
                ? 'bg-blue-950/80 border-blue-700 text-blue-300'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isInWatchlist ? 'fill-blue-400' : ''}`} />
            {isInWatchlist ? 'Saved' : 'Save'}
          </button>
          <button
            onClick={handleCopyShare}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Copy share link"
          >
            <Share2 className="w-4 h-4" />
          </button>
          {stream.channel.socialLinks?.discord && (
            <a
              href={stream.channel.socialLinks.discord}
              onClick={(e) => e.preventDefault()}
              className="p-2 rounded-xl bg-slate-900 hover:bg-indigo-900/60 text-indigo-300 border border-slate-700 hover:border-indigo-500/60 transition-colors"
              title="Discord community"
            >
              <span className="text-xs font-black">D</span>
            </a>
          )}
          {stream.channel.socialLinks?.twitter && (
            <a
              href={stream.channel.socialLinks.twitter}
              onClick={(e) => e.preventDefault()}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 hover:border-sky-500/60 transition-colors"
              title="Twitter / X"
            >
              <span className="text-xs font-black">𝕏</span>
            </a>
          )}
          <a
            href={stream.channel.socialLinks?.youtube || '#'}
            onClick={(e) => e.preventDefault()}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-red-400 border border-slate-700 hover:border-red-500/60 transition-colors"
            title="YouTube channel"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* ── Description + chapters ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
              About this stream
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">{stream.description}</p>
            {stream.publishedAt && stream.status !== 'live' && stream.status !== 'upcoming' && (
              <p className="text-[11px] text-slate-500 mt-3 font-mono">
                {new Date(stream.publishedAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>

          {playlists.length > 0 && (
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                In Playlists
              </h3>
              <div className="flex flex-wrap gap-2">
                {playlists.map((pl) => (
                  <span
                    key={pl.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/15 border border-blue-500/30 text-blue-300 text-xs font-bold"
                  >
                    <ListVideo className="w-3.5 h-3.5" />
                    {pl.title}
                    <span className="text-[10px] text-slate-500 font-mono">{pl.videoCount}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chapter strip — vertical list on mobile, horizontal scroll on desktop */}
        {stream.chapters.length > 0 && (
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Key Moments
            </h3>
            <div className="space-y-2 max-h-[320px] overflow-y-auto no-scrollbar">
              {stream.chapters.map((ch) => (
                <ChapterPill
                  key={ch.id}
                  chapter={ch}
                  isLive={stream.status === 'live'}
                  onJump={(t) => onShowToast(`Jumping to ${fmtTime(t)}…`, 'info')}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Past broadcasts / playlist archive strip ── */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">
            {stream.playlistTitle ? `More from “${stream.playlistTitle}”` : 'More from this channel'}
          </h2>
          <span className="text-[11px] font-mono text-slate-500">{related.length} streams</span>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {related.map((r) => (
            <button
              key={r.id}
              onClick={() => onOpenStream(r)}
              className="shrink-0 w-[200px] sm:w-[240px] rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600 bg-[#0f121a] transition-all hover:-translate-y-0.5 text-left"
            >
              <div className="relative aspect-video bg-slate-900">
                <img src={r.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                {r.status === 'live' && (
                  <span className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-black">
                    <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                    LIVE
                  </span>
                )}
                {r.status === 'upcoming' && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-black">
                    UPCOMING
                  </span>
                )}
                {(r.durationSeconds != null) && (
                  <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 text-white text-[9px] font-mono">
                    {fmtDuration(r.durationSeconds)}
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-[11px] font-bold text-white truncate">{r.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {r.channel.name}
                  {r.status === 'live' && r.viewers != null ? ` • ${fmtViews(r.viewers)} watching` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Live chat preview (theater side panel preview) ── */}
      {stream.status === 'live' && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Live Chat Preview
          </h3>
          <div ref={chatRef} className="h-48 overflow-y-auto no-scrollbar space-y-2 pr-2">
            {chatMsgs.map((m) => (
              <div key={m.id} className="flex items-start gap-2">
                <span className={`w-5 h-5 rounded-full ${m.color} shrink-0 flex items-center justify-center text-[8px] font-black text-white mt-0.5`}>
                  {m.user[0].toUpperCase()}
                </span>
                <p className="text-xs text-slate-300 leading-snug">
                  <span className="font-bold text-slate-200">{m.user}</span> {m.text}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 font-mono mt-2">
            Full chat opens in the player's theater mode
          </p>
        </div>
      )}
    </div>
  );
};

// ── Chapter pill with hover preview ─────────────────────────────────────────

const ChapterPill: React.FC<{
  chapter: YouTubeChapter;
  isLive: boolean;
  onJump: (t: number) => void;
}> = ({ chapter, isLive, onJump }) => {
  const [hover, setHover] = useState(false);

  return (
    <div className="relative">
      <button
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => onJump(chapter.timeSeconds)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/40 transition-colors text-left group"
      >
        <span className="px-2 py-1 rounded-md bg-blue-600/25 border border-blue-500/40 text-blue-300 text-[10px] font-mono font-bold shrink-0">
          {fmtTime(chapter.timeSeconds)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
            {chapter.title}
          </p>
        </div>
        <Play className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 shrink-0 transition-colors" />
      </button>

      {/* Hover preview popup */}
      {hover && (
        <div className="absolute left-0 right-0 -bottom-2 z-30 translate-y-full">
          <div className="rounded-xl overflow-hidden border border-blue-500/40 shadow-2xl shadow-black/60 bg-[#0f121a]">
            <img src={chapter.thumbnail} alt="" className="w-full aspect-video object-cover" />
            <div className="p-2.5">
              <p className="text-[11px] font-bold text-white">{chapter.title}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{chapter.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function fmtUpcomingLabel(ts: number): string {
  const delta = ts - Date.now();
  const h = Math.floor(delta / 3600000);
  if (h < 1) return 'in under an hour';
  if (h < 24) return `in ${h} hours`;
  return new Date(ts).toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
