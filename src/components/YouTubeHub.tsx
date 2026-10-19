import React, { useState, useEffect } from 'react';
import { StreamDeck } from './StreamDeck';
import { StreamDetail } from './StreamDetail';
import YouTubePlayer from './YouTubePlayer';
import { YouTubeStream } from '../types/stream';
import { YOUTUBE_STREAMS, loadEngineStreams } from '../services/youtubeService';

interface YouTubeHubProps {
  watchlistIds: string[];
  onToggleWatchlist: (stream: YouTubeStream) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
  reminders: string[];
  onToggleReminder: (streamId: string) => void;
}

export const YouTubeHub: React.FC<YouTubeHubProps> = ({
  watchlistIds,
  onToggleWatchlist,
  onShowToast,
  reminders,
  onToggleReminder,
}) => {
  const [selected, setSelected] = useState<YouTubeStream | null>(null);
  const [playing, setPlaying] = useState<YouTubeStream | null>(null);
  const [isTheater, setIsTheater] = useState(false);
  const [streams, setStreams] = useState<YouTubeStream[]>(YOUTUBE_STREAMS);

  useEffect(() => {
    let cancelled = false;
    loadEngineStreams().then((s) => {
      if (!cancelled && s.length) setStreams(s);
    });
    return () => { cancelled = true; };
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

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Stream Hub
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Discover live streams, VODs, shorts and playlists.
        </p>
      </div>

      <StreamDeck
        streams={streams}
        onOpenStream={handleOpen}
        reminders={reminders}
        onToggleReminder={onToggleReminder}
      />

      {/* ── Featured / related section ── */}
      <div className="mt-10">
        <h2 className="text-lg font-bold text-white mb-4">All Channels</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {streams
            .reduce(
              (acc, s) => {
                if (!acc.find((c) => c.id === s.channel.id)) acc.push(s.channel);
                return acc;
              },
              [] as typeof streams[number]['channel'][]
            )
            .map((ch) => (
              <button
                key={ch.id}
                onClick={() => {
                  const first = streams.find((s) => s.channel.id === ch.id);
                  if (first) handleOpen(first);
                }}
                className="glass-card rounded-xl p-3 flex flex-col items-center text-center hover:border-slate-600 transition-colors touch-manipulation"
              >
                <img
                  src={ch.avatar}
                  alt=""
                  className="w-14 h-14 rounded-full border-2 border-slate-700 mb-2"
                  referrerPolicy="no-referrer"
                />
                <p className="text-xs font-bold text-white truncate w-full">{ch.name}</p>
                <p className="text-[10px] text-slate-500 font-mono">{ch.subscribers}</p>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};