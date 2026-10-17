import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Maximize2,
  Minimize2,
  Tv,
  LayoutGrid,
  Bookmark,
  Share2,
  RefreshCw,
  MessageSquare,
  Send,
  Eye,
  Radio,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ShieldAlert,
  PictureInPicture2,
  Users,
  AlertCircle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { StreamItem, StreamSource } from '../types/stream';
import { streamService } from '../services/streamService';
import { getStreamGradient } from '../services/smuttThumbnailService';
import { StreamCard } from './StreamCard';
import { VideoPlayer } from './VideoPlayer';
import { WatchPartyModal } from './WatchPartyModal';
import { WatchPartyPanel } from './WatchPartyPanel';
import { watchPartyService } from '../services/watchPartyService';

interface PlayerViewProps {
  stream: StreamItem;
  onClose: () => void;
  onPlayStream: (stream: StreamItem) => void;
  onAddToMultiview: (stream: StreamItem) => void;
  onToggleWatchlist: (stream: StreamItem) => void;
  isInWatchlist: boolean;
  isInMultiview: boolean;
  relatedStreams: StreamItem[];
  watchlistIds: string[];
  multiviewStreamIds: string[];
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
  onTogglePiP?: () => void;
  onVideoEnd?: () => void;
  allStreams?: StreamItem[];
  currentIndex?: number;
}

interface ChatMessage {
  id: string;
  user: string;
  avatarColor: string;
  text: string;
  time: string;
}

const SAMPLE_CHAT_NAMES = ['GoalHunter', 'ApexFan99', 'HoopsCentral', 'Veloce_F1', 'CourtSide_Ace', 'PuckDrop'];
const SAMPLE_CHAT_TEXTS = [
  'What an incredible play right there!! 🔥',
  '1080p stream is running butter smooth!',
  'Defense is completely locked in today.',
  'Switching this over to multiview quad screen now!',
  'Great audio sync on this stream feed.',
  'Who do you have taking the win here??',
];

export const PlayerView: React.FC<PlayerViewProps> = ({
  stream,
  onClose,
  onPlayStream,
  onAddToMultiview,
  onToggleWatchlist,
  isInWatchlist,
  isInMultiview,
  relatedStreams,
  watchlistIds,
  multiviewStreamIds,
  onShowToast,
  onTogglePiP,
  onVideoEnd,
  allStreams,
  currentIndex,
}) => {
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputChat, setInputChat] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const [showChannelList, setShowChannelList] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [playerError, setPlayerError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Watch Party state
  const [showWatchPartyModal, setShowWatchPartyModal] = useState(false);
  const [watchPartyActive, setWatchPartyActive] = useState(false);
  const [syncCommand, setSyncCommand] = useState<{ type: 'play' | 'pause' | 'seek'; time: number } | null>(null);

  // Track watch party activity via service events
  useEffect(() => {
    let unsubscribed = false;
    watchPartyService.connect({
      onEvent: (event) => {
        if (unsubscribed) return;
        switch (event.type) {
          case 'room_created':
          case 'room_joined':
            setWatchPartyActive(true);
            break;
          case 'kicked':
            setWatchPartyActive(false);
            setShowWatchPartyModal(true);
            break;
          case 'peer_left':
            // Stay active if peers remain
            if (!event.peers || event.peers.length === 0) {
              setWatchPartyActive(false);
            }
            break;
        }
      },
    });
    return () => { unsubscribed = true; watchPartyService.disconnect(); };
  }, []);

  // Build group tabs from available streams
  const groups = useMemo(() => {
    const source = allStreams || relatedStreams;
    const groupSet = new Set<string>();
    source.forEach((s) => {
      if (s.provider === 'iptv') return; // IPTV handled separately
      const g = s.groupTitle || s.category || 'Uncategorized';
      groupSet.add(g);
    });
    return ['All', 'IPTV', 'Live Sports', '24/7', ...Array.from(groupSet).sort()];
  }, [allStreams, relatedStreams]);

  // Filter channels based on selected tab
  const filteredChannels = useMemo(() => {
    const source = allStreams || relatedStreams;
    if (selectedGroup === 'All') return source;
    if (selectedGroup === 'IPTV') return source.filter((s) => s.provider === 'iptv');
    if (selectedGroup === 'Live Sports') return source.filter((s) => s.status === 'live' && (s.category.includes('Sport') || s.category.includes('Basketball') || s.category.includes('Football') || s.category.includes('Combat') || s.category.includes('Golf') || s.category.includes('Motorsport') || s.category.includes('Tennis') || s.category.includes('Cricket') || s.category.includes('Rugby') || s.category.includes('Hockey') || s.category.includes('Baseball') || s.category.includes('MMA') || s.category.includes('Boxing') || s.category.includes('Soccer')));
    if (selectedGroup === '24/7') return source.filter((s) => s.status === '24/7');
    return source.filter((s) => s.provider !== 'iptv' && (s.groupTitle === selectedGroup || s.category === selectedGroup));
  }, [allStreams, relatedStreams, selectedGroup]);

  // Group counts for tab badges
  const groupCounts = useMemo(() => {
    const source = allStreams || relatedStreams;
    const counts: Record<string, number> = { 'All': source.length, 'IPTV': 0, 'Live Sports': 0, '24/7': 0 };
    source.forEach((s) => {
      if (s.provider === 'iptv') {
        counts['IPTV']++;
        return;
      }
      if (s.status === 'live' && (s.category.includes('Sport') || s.category.includes('Basketball') || s.category.includes('Football') || s.category.includes('Combat') || s.category.includes('Golf') || s.category.includes('Motorsport') || s.category.includes('Tennis') || s.category.includes('Cricket') || s.category.includes('Rugby') || s.category.includes('Hockey') || s.category.includes('Baseball') || s.category.includes('MMA') || s.category.includes('Boxing') || s.category.includes('Soccer'))) {
        counts['Live Sports']++;
      }
      if (s.status === '24/7') counts['24/7']++;
      const g = s.groupTitle || s.category || 'Uncategorized';
      counts[g] = (counts[g] || 0) + 1;
    });
    return counts;
  }, [allStreams, relatedStreams]);

  // Load stream sources on mount or stream change
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingSources(true);

    streamService
      .resolveStreamSources(stream)
      .then((resolved) => {
        if (!isCancelled) {
          setSources(resolved);
          setActiveSourceIndex(0);
          setIsLoadingSources(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setIsLoadingSources(false);
        }
      });

    // Populate initial chat
    const initialMsgs: ChatMessage[] = Array.from({ length: 5 }).map((_, i) => ({
      id: `chat-${Date.now()}-${i}`,
      user: SAMPLE_CHAT_NAMES[i % SAMPLE_CHAT_NAMES.length],
      avatarColor: ['bg-blue-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-purple-600'][i % 5],
      text: SAMPLE_CHAT_TEXTS[i % SAMPLE_CHAT_TEXTS.length],
      time: 'Just now',
    }));
    setChatMessages(initialMsgs);

    return () => {
      isCancelled = true;
    };
  }, [stream]);

  // Periodic simulated live chat messages
  useEffect(() => {
    if (!showChat) return;
    const interval = setInterval(() => {
      const randomUser = SAMPLE_CHAT_NAMES[Math.floor(Math.random() * SAMPLE_CHAT_NAMES.length)];
      const randomText = SAMPLE_CHAT_TEXTS[Math.floor(Math.random() * SAMPLE_CHAT_TEXTS.length)];
      const randomColor = ['bg-blue-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-purple-600'][
        Math.floor(Math.random() * 5)
      ];

      setChatMessages((prev) => [
        ...prev.slice(-40),
        {
          id: `chat-${Date.now()}`,
          user: randomUser,
          avatarColor: randomColor,
          text: randomText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 8000);

    return () => clearInterval(interval);
  }, [showChat]);

  // Auto scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const activeEmbedUrl =
    sources[activeSourceIndex]?.embedUrl ||
    stream.directEmbedUrl ||
    '';

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputChat.trim()) return;

    setChatMessages((prev) => [
      ...prev,
      {
        id: `chat-${Date.now()}`,
        user: 'You',
        avatarColor: 'bg-blue-600',
        text: inputChat.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInputChat('');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeEmbedUrl);
    onShowToast('Stream embed link copied to clipboard!', 'success');
  };

  const handleRefreshStream = () => {
    setIframeKey((prev) => prev + 1);
    setPlayerError(false);
    onShowToast('Reloading video player feed...', 'info');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 py-4 animate-in fade-in duration-200">
      {/* Top back breadcrumb */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm font-bold text-slate-300 hover:text-blue-400 transition-colors"
        >
          <span className="text-slate-400">←</span>
          <span>Back to All Channels &amp; Streams</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTheaterMode(!isTheaterMode)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-sm text-slate-300 hover:text-white border border-slate-700 transition-colors font-medium"
            title="Toggle Theater / Cinema Mode"
          >
            {isTheaterMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isTheaterMode ? 'Standard View' : 'Theater Cinema'}</span>
          </button>
        </div>
      </div>

      {/* Main Player Grid */}
      <div
        className={`grid gap-6 ${
          isTheaterMode ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'
        }`}
      >
        {/* Video Player Column */}
        <div className={isTheaterMode ? 'w-full' : 'lg:col-span-8'}>
          {/* Responsive 16:9 Video Canvas */}
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-slate-800/90 shadow-2xl">
            {isLoadingSources ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mb-3" />
                <p className="text-sm font-medium text-slate-300">Connecting to stream feed...</p>
                <p className="text-xs text-slate-500 mt-1 font-mono">Resolving live media gateway</p>
              </div>
            ) : (
              <VideoPlayer
                key={iframeKey}
                url={activeEmbedUrl}
                title={stream.title}
                streamType={stream.streamType}
                isMuted={isMuted}
                autoPlay={true}
                onRefresh={handleRefreshStream}
                onTogglePiP={onTogglePiP}
                onVideoEnd={onVideoEnd}
                onSyncPlay={(time) => watchPartyService.syncPlay(time)}
                onSyncPause={(time) => watchPartyService.syncPause(time)}
                onSyncSeek={(time) => watchPartyService.syncSeek(time)}
                syncCommand={syncCommand}
              />
            )}
          </div>

          {/* Channel Up/Down — left of sources bar, directly under player */}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => {
                const list = allStreams || relatedStreams;
                const idx = list.findIndex((s) => s.id === stream.id);
                const prev = idx > 0 ? list[idx - 1] : list[list.length - 1];
                if (prev) onPlayStream(prev);
              }}
              className="flex-1 h-12 rounded-xl bg-blue-600/90 hover:bg-blue-500 active:bg-blue-700 text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/30 touch-manipulation text-sm font-bold"
              title="Previous channel"
            >
              <ChevronUp className="w-5 h-5" />
              <span>Channel Up</span>
            </button>
            <button
              onClick={() => setIsMuted((m) => !m)}
              className={`flex-1 h-12 rounded-xl flex items-center justify-center gap-2 transition-all touch-manipulation text-sm font-bold ${
                isMuted
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  : 'bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              <span>{isMuted ? 'Unmute' : 'Muted'}</span>
            </button>
            <div className="flex-1 bg-[#0f121a] rounded-xl border border-slate-800/80 px-4 py-2.5">
              <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Channel</span>
              <p className="text-sm font-bold text-white mt-0.5 truncate">{stream.title}</p>
            </div>
            <button
              onClick={() => {
                const list = allStreams || relatedStreams;
                const idx = list.findIndex((s) => s.id === stream.id);
                const next = idx < list.length - 1 ? list[idx + 1] : list[0];
                if (next) onPlayStream(next);
              }}
              className="flex-1 h-12 rounded-xl bg-blue-600/90 hover:bg-blue-500 active:bg-blue-700 text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/30 touch-manipulation text-sm font-bold"
              title="Next channel"
            >
              <span>Channel Down</span>
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Player Toolbar & Sources */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-[#0f121a] p-3 rounded-xl border border-slate-800/80">
            {/* Stream Mirror Sources Switcher */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-xs text-slate-400 font-mono uppercase tracking-wider shrink-0 mr-1">
                Sources:
              </span>
              {sources.map((src, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSourceIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    activeSourceIndex === idx
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {src.name || `Stream ${idx + 1}`} {src.hd ? 'HD' : ''}
                </button>
              ))}
            </div>

            {/* Quick Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshStream}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                title="Reload Stream Player"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={onTogglePiP}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors"
                title="Pop out into floating Picture-in-Picture window"
              >
                <PictureInPicture2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Picture-in-Picture</span>
              </button>

              <button
                onClick={() => onAddToMultiview(stream)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isInMultiview
                    ? 'bg-blue-950/80 border-blue-700 text-blue-300'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
                }`}
                title="Watch alongside other streams in Multiview"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
                <span>{isInMultiview ? 'In Multiview' : 'Multiview'}</span>
              </button>

              <button
                onClick={() => onToggleWatchlist(stream)}
                className={`p-2 rounded-lg border transition-colors ${
                  isInWatchlist
                    ? 'bg-blue-950/80 border-blue-700 text-blue-400'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
                title={isInWatchlist ? 'Saved to Watchlist' : 'Save to Watchlist'}
              >
                <Bookmark className={`w-4 h-4 ${isInWatchlist ? 'fill-blue-400' : ''}`} />
              </button>

              <button
                onClick={handleCopyLink}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                title="Copy Stream Link"
              >
                <Share2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowChat(!showChat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  showChat
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Live Chat</span>
              </button>

              <button
                onClick={() => {
                  if (watchPartyActive) {
                    // Toggle panel open/close
                    setShowWatchPartyModal((p) => !p);
                  } else {
                    setShowWatchPartyModal(true);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  watchPartyActive
                    ? 'bg-blue-950/80 border-blue-700 text-blue-300'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
                }`}
                title="Watch Party"
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Watch Party</span>
              </button>
            </div>
          </div>

          {/* Stream Information (YouTube / Netflix Title Section) */}
          <div className="mt-4 p-5 bg-[#0f121a] rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2">
              <span className="flex items-center gap-1 text-blue-400 font-semibold uppercase">
                <Radio className="w-3 h-3 animate-pulse" />
                {stream.status === '24/7' ? '24/7 Channel' : 'Live Stream'}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>{stream.category}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="font-mono tabular-nums text-slate-300 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                {(stream.viewers || 3200).toLocaleString()} watching
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">{stream.title}</h1>
            <p className="text-base text-slate-300 leading-relaxed max-w-3xl font-medium">
              High-definition direct streaming broadcast from {stream.provider.toUpperCase()} provider networks.
              Equipped with synchronized low-latency delivery, theater mode presentation, and multi-screen split view compatibility.
            </p>
          </div>
        </div>

        {/* Right Sidebar: Channel List & Chat */}
        <div className={isTheaterMode ? 'w-full grid grid-cols-1 md:grid-cols-2 gap-6' : 'lg:col-span-4 flex flex-col gap-4'}>

          {/* Now Playing Card */}
          <div className="bg-[#0f121a] rounded-xl border border-slate-800/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Now Playing</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                #{currentIndex !== undefined ? currentIndex + 1 : '?'} / {allStreams?.length || relatedStreams.length + 1}
              </span>
            </div>

            <div className="p-3">
              <div className="flex items-center gap-3">
                <div className="relative w-20 aspect-video rounded-md overflow-hidden bg-slate-900 shrink-0">
                  <img
                    src={stream.poster || '/src/assets/images/hero_championship_live_1792048678438.jpg'}
                    alt={stream.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/src/assets/images/hero_championship_live_1792048678438.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white drop-shadow">NOW</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white line-clamp-2 leading-tight">{stream.title}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{stream.category}</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                    <span className="uppercase text-slate-500">Source:</span> {stream.provider}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      const list = allStreams || relatedStreams;
                      const idx = list.findIndex((s) => s.id === stream.id);
                      const prev = idx > 0 ? list[idx - 1] : list[list.length - 1];
                      if (prev) onPlayStream(prev);
                    }}
                    className="w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors shadow-lg shadow-blue-600/30"
                    title="Previous channel"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      const list = allStreams || relatedStreams;
                      const idx = list.findIndex((s) => s.id === stream.id);
                      const next = idx < list.length - 1 ? list[idx + 1] : list[0];
                      if (next) onPlayStream(next);
                    }}
                    className="w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors shadow-lg shadow-blue-600/30"
                    title="Next channel"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Full Channel List (toggleable) */}
          <div className="bg-[#0f121a] rounded-xl border border-slate-800/80 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white">Channel List</span>
                <span className="text-[10px] font-mono text-slate-500">{filteredChannels.length} channels</span>
              </div>
              <button
                onClick={() => setShowChannelList(!showChannelList)}
                className="text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showChannelList ? '▲ Less' : '▼ Show'}
              </button>
            </div>
            {showChannelList && (
              <>
                {/* Category Tabs */}
                <div className="px-3 py-2 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {groups.map((group) => (
                    <button
                      key={group}
                      onClick={() => setSelectedGroup(group)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                        selectedGroup === group
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {group === 'Live Sports' && '⚡ '}
                      {group === '24/7' && '📺 '}
                      {group === 'IPTV' && '📡 '}
                      {group}
                      <span className={`ml-1 text-[10px] ${selectedGroup === group ? 'text-white/70' : 'text-slate-600'}`}>
                        {groupCounts[group] || 0}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Filtered Channel List */}
                <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-800/50">
                  {filteredChannels.map((item, idx) => {
                      const isCurrent = item.id === stream.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => !isCurrent && onPlayStream(item)}
                          className={`flex items-center gap-3 p-2.5 transition-colors ${
                            isCurrent
                              ? 'bg-blue-600/15 border-l-2 border-blue-500'
                              : 'hover:bg-slate-900/80 cursor-pointer'
                          }`}
                        >
                          <span className={`text-[10px] font-mono w-4 shrink-0 ${isCurrent ? 'text-blue-400 font-bold' : 'text-slate-600'}`}>
                            {isCurrent ? '▶' : idx + 1}
                          </span>
                          <div className="relative w-16 aspect-video rounded-md overflow-hidden shrink-0">
                            {item.provider === 'iptv' && !item.poster ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                                <div
                                  className="absolute inset-0"
                                  style={{
                                    background: `linear-gradient(135deg, ${getStreamGradient(item)?.[0] || '#334155'}, ${getStreamGradient(item)?.[1] || '#1e293b'})`,
                                  }}
                                />
                                <span className="relative text-lg leading-none">📡</span>
                                <span className="relative text-[7px] font-bold text-white/80 uppercase tracking-tight px-1 truncate max-w-full">
                                  {(item.m3uSource || '').replace(/\s*\(.*/, '')}
                                </span>
                              </div>
                            ) : item.poster ? (
                              <img
                                src={item.poster}
                                alt={item.title}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  const gradient = getStreamGradient(item);
                                  if (gradient) {
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent) {
                                      const gradDiv = document.createElement('div');
                                      gradDiv.className = 'absolute inset-0';
                                      gradDiv.style.background = `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`;
                                      parent.appendChild(gradDiv);
                                    }
                                  } else {
                                    target.src = '/src/assets/images/hero_championship_live_1792048678438.jpg';
                                  }
                                }}
                              />
                            ) : (
                              <div
                                className="absolute inset-0"
                                style={{
                                  background: `linear-gradient(135deg, ${getStreamGradient(item)?.[0] || '#334155'}, ${getStreamGradient(item)?.[1] || '#1e293b'})`,
                                }}
                              />
                            )}
                            {isCurrent && (
                              <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                                <span className="text-[9px] font-bold text-white">LIVE</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold line-clamp-1 ${isCurrent ? 'text-blue-400' : 'text-slate-200'}`}>
                              {item.title}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {item.provider === 'iptv' ? item.m3uSource || item.category : item.category}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              </>
            )}
          </div>

          {/* Chat or Watch Party Panel */}
          {watchPartyActive ? (
            <WatchPartyPanel
              currentStream={stream}
              isOpen={true}
              onToggle={() => {
                setWatchPartyActive(false);
                setShowWatchPartyModal(true);
              }}
            />
          ) : showChat && (
            <div className="flex flex-col h-[260px] sm:h-[320px] bg-[#0f121a] rounded-xl border border-slate-800/80 overflow-hidden shadow-lg">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">Live Chat</span>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  {chatMessages.length} comments
                </span>
              </div>
              <div ref={chatScrollRef} className="flex-1 p-3 overflow-y-auto space-y-3 font-normal text-xs">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="flex items-start gap-2.5">
                    <div
                      className={`w-5 h-5 rounded-full ${msg.avatarColor} text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5`}
                    >
                      {msg.user[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">{msg.user}</span>
                        <span className="text-[10px] font-mono text-slate-500">{msg.time}</span>
                      </div>
                      <p className="text-slate-300 mt-0.5 break-words">{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} className="p-2.5 border-t border-slate-800 bg-slate-900/80 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Say something..."
                  value={inputChat}
                  onChange={(e) => setInputChat(e.target.value)}
                  className="flex-1 bg-black/50 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Watch Party Modal */}
      <WatchPartyModal
        isOpen={showWatchPartyModal}
        onClose={() => setShowWatchPartyModal(false)}
        currentStream={stream}
        onAddToQueue={() => {}}
      />
    </div>
  );
};
