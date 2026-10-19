import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  MessageSquare,
  Bookmark,
  Maximize2,
  Minimize2,
  X,
  Bell,
  BellRing,
  ListVideo,
  Share2,
  Eye,
  Radio,
  CalendarClock,
} from 'lucide-react';
import { YouTubeStream } from '../types/stream';
import {
  fmtTime,
  fmtDuration,
  fmtViews,
  getRelated,
  getStreamsByChannel,
} from '../services/youtubeService';
import { useLiveViewers } from '../hooks/useLiveViewers';
import { ChannelBadge } from './StreamDeck';

interface YouTubePlayerProps {
  stream: YouTubeStream;
  onBack: () => void;
  onOpenStream: (stream: YouTubeStream) => void;
  isTheater: boolean;
  onToggleTheater: (v: boolean) => void;
}

interface ChatMsg {
  id: string;
  user: string;
  color: string;
  text: string;
}

const CHAT_NAMES = [
  'streamer_fan',
  'pixelgrrl',
  'gg_ez',
  'mod_kat',
  'lofi_larry',
  'clipz_4u',
  'noobmaster69',
  'clip_that_1',
];
const CHAT_COLORS = [
  'bg-red-600',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-purple-600',
  'bg-pink-600',
  'bg-cyan-600',
  'bg-orange-600',
];
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
  'PogChamp',
  'anyone else from the EU? 🇪🇺',
  'this chapter at 14:20 is gold',
  'can we get a replay of that?',
  'the chat needs to slow down lol',
  'who is casting this??',
];

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  stream,
  onBack,
  onOpenStream,
  isTheater,
  onToggleTheater,
}) => {
  const [showChat, setShowChat] = useState(true);
  const [showChapters, setShowChapters] = useState(true);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>(() =>
    Array.from({ length: 8 }).map((_, i) => ({
      id: `init-${i}`,
      user: CHAT_NAMES[i % CHAT_NAMES.length],
      color: CHAT_COLORS[i % CHAT_COLORS.length],
      text: CHAT_TEXTS[i % CHAT_TEXTS.length],
    }))
  );
  const [inputChat, setInputChat] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const [activeChapter, setActiveChapter] = useState(0);
  const [hoverChapter, setHoverChapter] = useState<YouTubeStream['chapters'][number] | null>(null);

  const liveViewers = useLiveViewers(stream.viewers ?? 12000);
  const related = useMemo(() => getRelated(stream), [stream]);
  const channelStreams = useMemo(
    () => getStreamsByChannel(stream.channel.id).filter((s) => s.id !== stream.id).slice(0, 10),
    [stream]
  );
  const duration = stream.durationSeconds ?? 7200;
  const isLive = stream.status === 'live';
  const isUpcoming = stream.status === 'upcoming';

  // Simulated chat feed
  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(() => {
      const user = CHAT_NAMES[Math.floor(Math.random() * CHAT_NAMES.length)];
      const text = CHAT_TEXTS[Math.floor(Math.random() * CHAT_TEXTS.length)];
      const color = CHAT_COLORS[Math.floor(Math.random() * CHAT_COLORS.length)];
      setChatMsgs((prev) => [...prev.slice(-40), { id: `c-${Date.now()}`, user, color, text }]);
    }, 5000);
    return () => clearInterval(t);
  }, [isLive]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMsgs]);

  const handleSend = () => {
    if (!inputChat.trim()) return;
    setChatMsgs((prev) => [
      ...prev.slice(-40),
      {
        id: `me-${Date.now()}`,
        user: 'you',
        color: 'bg-red-600',
        text: inputChat.trim(),
      },
    ]);
    setInputChat('');
  };

  const handleCopyShare = () => {
    navigator.clipboard.writeText(stream.embedUrl);
  };

  return (
    <div className={`w-full ${isTheater ? 'min-h-screen' : 'max-w-7xl mx-auto'} px-2 sm:px-6 py-4 animate-fadeIn`}>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-bold text-slate-300 hover:text-red-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Stream Hub
        </button>

        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[11px] font-black">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
              <span className="font-mono font-bold text-red-100">
                {fmtViews(liveViewers)}
              </span>
            </span>
          )}
          {isUpcoming && stream.scheduledAt && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-600 text-white text-[11px] font-black">
              <CalendarClock className="w-3 h-3" />
              UPCOMING
            </span>
          )}
          {stream.status === 'vod' && stream.durationSeconds && (
            <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold">
              {fmtDuration(stream.durationSeconds)}
            </span>
          )}
          <button
            onClick={() => onToggleTheater(!isTheater)}
            className={`p-2 rounded-lg transition-colors ${
              isTheater
                ? 'bg-red-600/20 text-red-400 border border-red-500/40'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700'
            }`}
            title={isTheater ? 'Exit Theater Mode' : 'Theater Mode'}
          >
            {isTheater ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Main player area ── */}
      <div className={`grid gap-4 ${isTheater ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-4'}`}>
        {/* ── Left: player + info ── */}
        <div className={isTheater ? '' : 'lg:col-span-3'}>
          {/* Player embed */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black aspect-video">
            {/* Simulated player — use embed if available */}
            <iframe
              src={stream.embedUrl}
              title={stream.title}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />

            {/* Top-right quick actions */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <button
                onClick={() => setShowChat(!showChat)}
                className={`p-2 rounded-lg backdrop-blur-md border transition-colors ${
                  showChat
                    ? 'bg-red-600/80 border-red-500/60 text-white'
                    : 'bg-black/60 border-white/25 text-white/80 hover:text-white'
                }`}
                title={showChat ? 'Hide Live Chat' : 'Show Live Chat'}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowChapters(!showChapters)}
                className={`p-2 rounded-lg backdrop-blur-md border transition-colors ${
                  showChapters
                    ? 'bg-red-600/80 border-red-500/60 text-white'
                    : 'bg-black/60 border-white/25 text-white/80 hover:text-white'
                }`}
                title={showChapters ? 'Hide Chapters' : 'Show Chapters'}
              >
                <ListVideo className="w-4 h-4" />
              </button>
              <button
                onClick={handleCopyShare}
                className="p-2 rounded-lg bg-black/60 border border-white/25 text-white/80 hover:text-white backdrop-blur-md transition-colors"
                title="Copy Share Link"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            {/* Floating social card */}
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
              {stream.channel.socialLinks?.discord && (
                <button
                  className="p-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/25 text-indigo-300 hover:text-indigo-200 transition-colors"
                  title="Discord"
                >
                  <span className="text-xs font-black">D</span>
                </button>
              )}
              {stream.channel.socialLinks?.twitter && (
                <button
                  className="p-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/25 text-sky-300 hover:text-sky-200 transition-colors"
                  title="Twitter / X"
                >
                  <span className="text-xs font-black">𝕏</span>
                </button>
              )}
              <button
                className="p-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/25 text-red-400 hover:text-red-300 transition-colors"
                title="YouTube Channel"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Chapter pins along the progress bar ── */}
          {showChapters && stream.chapters.length > 0 && (
            <div className="mt-3 relative h-12 bg-slate-900/60 rounded-lg border border-slate-800 overflow-visible">
              {/* Progress bar track */}
              <div className="absolute top-1/2 -translate-y-1/2 left-2 right-2 h-1.5 rounded-full bg-slate-800">
                {/* Filled portion (simulated) */}
                <div
                  className="h-full rounded-full bg-red-600"
                  style={{ width: `${(stream.chapters[activeChapter]?.timeSeconds ?? 0) / duration * 100}%` }}
                />
                {/* Chapter pins */}
                {stream.chapters.map((ch, i) => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChapter(i)}
                    onMouseEnter={() => setHoverChapter(ch)}
                    onMouseLeave={() => setHoverChapter(null)}
                    className={`absolute -top-1.5 w-4 h-4 rounded-full border-2 transition-all ${
                      i === activeChapter
                        ? 'bg-red-600 border-red-400 scale-125 z-10'
                        : 'bg-slate-600 border-slate-500 hover:bg-slate-500 scale-100'
                    }`}
                    style={{ left: `${(ch.timeSeconds / duration) * 100}%`, transform: 'translateX(-50%)' }}
                    title={`${ch.title} — ${fmtTime(ch.timeSeconds)}`}
                  />
                ))}
              </div>

              {/* Hover preview */}
              {hoverChapter && (
                <div
                  className="absolute -top-20 -translate-x-1/2 z-30 pointer-events-none"
                  style={{ left: `${(hoverChapter.timeSeconds / duration) * 100}%` }}
                >
                  <div className="rounded-lg overflow-hidden border border-blue-500/40 shadow-2xl shadow-black/60 bg-[#0f121a] w-48">
                    <img src={hoverChapter.thumbnail} alt="" className="w-full aspect-video object-cover" />
                    <div className="p-2">
                      <p className="text-[10px] font-bold text-white">{hoverChapter.title}</p>
                      <p className="text-[9px] text-slate-400 line-clamp-1">{hoverChapter.description}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Stream title + meta ── */}
          <div className="mt-4">
            <h1 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight">
              {stream.title}
            </h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <ChannelBadge channel={stream.channel} />
              {stream.tags.map((t) => (
                <span key={t} className="text-[10px] font-mono text-blue-400/70">
                  {t}
                </span>
              ))}
              {stream.playlistTitle && (
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <ListVideo className="w-3 h-3" />
                  {stream.playlistTitle}
                  {stream.playlistIndex ? ` • #${stream.playlistIndex}` : ''}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">{stream.description}</p>
          </div>

          {/* ── Actions ── */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {isUpcoming && (
              <button
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-colors"
              >
                <Bell className="w-3.5 h-3.5" />
                Set Reminder
              </button>
            )}
            <button
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5" />
              Save to Watchlist
            </button>
          </div>

          {/* ── Upcoming / related streams below the player ── */}
          <div className="mt-8">
            <h3 className="text-sm font-bold text-white mb-3">
              {channelStreams.length > 0 ? 'More from this channel' : 'Related Streams'}
            </h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {(channelStreams.length > 0 ? channelStreams : related).map((r) => (
                <button
                  key={r.id}
                  onClick={() => onOpenStream(r)}
                  className="shrink-0 w-[180px] sm:w-[220px] rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600 bg-[#0f121a] transition-all hover:-translate-y-0.5 text-left"
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
                    {r.durationSeconds != null && (
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
        </div>

        {/* ── Right: Live Chat (collapsible) ── */}
        {!isTheater && showChat && isLive && (
          <div className="lg:col-span-1 glass-card rounded-2xl p-4 h-fit lg:sticky lg:top-20">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Live Chat
            </h3>
            <div ref={chatRef} className="h-72 overflow-y-auto no-scrollbar space-y-2 pr-1">
              {chatMsgs.map((m) => (
                <div key={m.id} className="flex items-start gap-2">
                  <span
                    className={`w-5 h-5 rounded-full ${m.color} shrink-0 flex items-center justify-center text-[8px] font-black text-white mt-0.5`}
                  >
                    {m.user[0].toUpperCase()}
                  </span>
                  <p className="text-xs text-slate-300 leading-snug break-words">
                    <span className={`font-bold ${m.user === 'you' ? 'text-red-400' : 'text-slate-200'}`}>
                      {m.user}
                    </span>{' '}
                    {m.text}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input
                type="text"
                value={inputChat}
                onChange={(e) => setInputChat(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Say something…"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500/60"
              />
              <button
                onClick={handleSend}
                className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
                title="Send"
              >
                <X className="w-3.5 h-3.5 rotate-45" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default YouTubePlayer;