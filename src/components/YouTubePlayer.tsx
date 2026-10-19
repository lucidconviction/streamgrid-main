import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  Play,
  Bookmark,
  MessageSquare,
  Maximize2,
  Minimize2,
  X,
  Bell,
  BellRing,
  ListVideo,
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
  parseVideoId,
  fetchChannelVideos,
} from '../services/youtubeService';
import { useLiveViewers } from '../hooks/useLiveViewers';
import { ChannelBadge } from './StreamDeck';

interface YouTubePlayerProps {
  stream: YouTubeStream;
  onBack: () => void;
  onOpenStream: (stream: YouTubeStream) => void;
  onPlayNext?: (stream: YouTubeStream) => void;
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
  onPlayNext,
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
  const playerRef = useRef<any>(null);
  const playerDivRef = useRef<HTMLDivElement>(null);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const liveViewers = useLiveViewers(stream.viewers ?? 12000);
  const related = useMemo(() => getRelated(stream), [stream]);
  const channelStreams = useMemo(
    () => getStreamsByChannel(stream.channel.id).filter((s) => s.id !== stream.id).slice(0, 10),
    [stream]
  );
  const duration = stream.durationSeconds ?? 7200;
  const isLive = stream.status === 'live';
  const isUpcoming = stream.status === 'upcoming';

  // Real channel videos from the NewPipe engine (when the channel handle/ID is known)
  const [realChannelVideos, setRealChannelVideos] = useState<YouTubeStream[]>([]);
  const ytChannelId = stream.channel.youtubeChannelId || '';

  // Resolve a handle usable by fetchChannelVideos: prefer @handle, fall back to extracting from channel.id
  const resolveChannelHandle = useCallback((): string => {
    if (ytChannelId.startsWith('@')) return ytChannelId;
    if (ytChannelId.startsWith('UC')) return `@${ytChannelId}`; // engine doesn't always give UC→handle mapping, try it anyway
    // Try extracting from channel.id (might be a URL or bare handle)
    const raw = stream.channel.id || '';
    const h = raw.match(/\/@([A-Za-z0-9_.-]+)/);
    if (h) return `@${h[1]}`;
    const c = raw.match(/\/channel\/([A-Za-z0-9_-]+)/);
    if (c) return `@${c[1]}`;
    if (raw && !raw.startsWith('http')) return raw.startsWith('@') ? raw : `@${raw}`;
    return '';
  }, [ytChannelId, stream.channel.id]);

  const channelHandle = resolveChannelHandle();
  useEffect(() => {
    if (!channelHandle) {
      setRealChannelVideos([]);
      return;
    }
    let cancelled = false;
    fetchChannelVideos(channelHandle, 12)
      .then((vids) => {
        if (!cancelled) setRealChannelVideos(vids.filter((v) => v.id !== stream.id).slice(0, 10));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [channelHandle, stream.id]);

  // "More from this channel" — prefer real engine videos, fall back to local catalog
  const effectiveChannelStreams = realChannelVideos.length > 0 ? realChannelVideos : channelStreams;

  // Auto-play-next queue: channel streams first, then related
  const upNextQueue = useMemo(() => {
    const q = effectiveChannelStreams.length > 0 ? effectiveChannelStreams : related;
    return q.filter((s) => s.id !== stream.id);
  }, [effectiveChannelStreams, related, stream.id]);

  // YouTube IFrame API — listen for ENDED to auto-advance
  useEffect(() => {
    if (!playerDivRef.current) return;
    let cancelled = false;

    const loadApi = () => {
      const w = window as any;
      if (w.YT && w.YT.Player) return w.YT.Player;
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
      return null;
    };

    const init = () => {
      const w = window as any;
      const YT = w.YT;
      if (!YT || !YT.Player || !playerDivRef.current) {
        // Retry once after a short delay
        setTimeout(init, 500);
        return;
      }
      const vid = parseVideoId(stream.embedUrl);
      if (playerRef.current) {
        try { playerRef.current.loadVideoById(vid); } catch {}
        return;
      }
      playerRef.current = new YT.Player(playerDivRef.current, {
        videoId: vid,
        playerVars: {
          autoplay: 1,
          rel: 0,
          fs: 1,
          iv_load_policy: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (e: any) => {
            if (isLive) e.target.play();
          },
          onStateChange: (e: any) => {
            const st = e.target.getState?.();
            if (st === w.YT.PlayerState.ENDED && !cancelled && upNextQueue.length > 0) {
              startCountdown();
            }
          },
        },
      });
    };

    const existing = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      existing?.();
      init();
    };
    if ((window as any).YT && (window as any).YT.Player) {
      init();
    } else {
      loadApi();
      // Fallback: poll for the API
      const poll = setInterval(() => {
        if ((window as any).YT && (window as any).YT.Player) {
          clearInterval(poll);
          init();
        }
      }, 500);
      setTimeout(() => clearInterval(poll), 15000);
    }

    return () => {
      cancelled = true;
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
      stopCountdown();
    };
  }, [stream.id, upNextQueue.length]);

  const startCountdown = () => {
    if (nextCountdown !== null) return;
    setNextCountdown(5);
    let n = 5;
    countdownRef.current = setInterval(() => {
      n--;
      if (n <= 0) {
        stopCountdown();
        playNext();
      } else {
        setNextCountdown(n);
      }
    }, 1000);
  };

  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setNextCountdown(null);
  };

  const playNext = () => {
    if (upNextQueue.length === 0) return;
    const next = upNextQueue[0];
    onPlayNext?.(next);
  };

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
          {/* Player embed (YouTube IFrame API for auto-play-next) */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black aspect-video">
            <div ref={playerDivRef} className="absolute inset-0 w-full h-full" />
            {nextCountdown !== null && upNextQueue.length > 0 && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                <p className="text-2xl font-black text-white">Next in {nextCountdown}s</p>
                <p className="text-sm text-slate-300 mt-1 truncate max-w-[80%]">
                  {upNextQueue[0].title}
                </p>
                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={playNext}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black transition-colors"
                  >
                    Play Now
                  </button>
                  <button
                    onClick={stopCountdown}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
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
            {upNextQueue.length > 0 && (
              <button
                onClick={playNext}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black transition-colors touch-manipulation"
              >
                <Play className="w-3.5 h-3.5" />
                Play Next
              </button>
            )}
          </div>

          {/* ── Upcoming / related streams below the player ── */}
          <div className="mt-8">
            <h3 className="text-sm font-bold text-white mb-3">
              {effectiveChannelStreams.length > 0 ? 'More from this channel' : 'Related Streams'}
            </h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {(effectiveChannelStreams.length > 0 ? effectiveChannelStreams : related).map((r) => (
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