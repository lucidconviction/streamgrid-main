import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, X, Volume2, VolumeX,
  Maximize2, ChevronDown, Music, Loader2,
} from 'lucide-react';

interface MusicTrack {
  title: string;
  url: string;
  duration: number;
  thumbnail?: string;
  video_id?: string;
  artist?: string;
}

interface FloatingMusicPlayerProps {
  artistName: string;
  artistThumbnail: string;
  tracks: MusicTrack[];
  onClose: () => void;
}

/** Animated equalizer bars — the Musike brand signature */
const Equalizer: React.FC<{ paused?: boolean }> = ({ paused }) => (
  <span className="musike-eq" style={paused ? { animationPlayState: 'paused', opacity: 0.4 } : undefined} aria-hidden="true">
    <span />
    <span />
    <span />
    <span />
    <span />
    <span />
    <span />
  </span>
);

export const FloatingMusicPlayer: React.FC<FloatingMusicPlayerProps> = ({
  artistName,
  artistThumbnail,
  tracks,
  onClose,
}) => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentTrack = tracks[currentTrackIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    audio.src = currentTrack.url;
    audio.load();
    if (isPlaying) {
      audio.play().catch(() => console.warn('Autoplay blocked'));
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      if (currentTrackIndex < tracks.length - 1) {
        setCurrentTrackIndex(i => i + 1);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentTrackIndex, tracks.length]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
  }, [volume]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const nextTrack = () => {
    if (tracks.length === 0) return;
    setCurrentTrackIndex(prev => (prev + 1) % tracks.length);
    setIsPlaying(true);
  };

  const prevTrack = () => {
    if (tracks.length === 0) return;
    setCurrentTrackIndex(prev => (prev - 1 + tracks.length) % tracks.length);
    setIsPlaying(true);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  if (!currentTrack) {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-72 musike-island musike-panel-radius shadow-2xl overflow-hidden">
        <div className="p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 musike-accent-text animate-spin shrink-0" />
          <p className="text-sm musike-text-2">Loading tracks...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <audio ref={audioRef} preload="auto" />

      {/* Mini Player — Musike floating island */}
      <div className="fixed bottom-6 right-6 z-50 w-72 musike-island musike-panel-radius shadow-2xl overflow-hidden musike-transition">
        {/* Track info bar */}
        <div className="flex items-center gap-3 px-4 py-3">
          <img
            src={artistThumbnail || currentTrack.thumbnail || '/placeholder.jpg'}
            alt={artistName}
            className="w-10 h-10 musike-card-radius object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-[#e8ecf4] truncate">{currentTrack.title}</p>
              {isPlaying && <Equalizer paused={false} />}
            </div>
            <p className="text-xs musike-text-3 truncate font-mono">{artistName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:musike-surface-2 rounded-lg musike-text-3 hover:text-white transition-colors duration-200 shrink-0 musike-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="px-4 pb-3">
          {/* Progress */}
          {duration > 0 && (
            <div className="mb-2">
              <div
                onClick={handleSeek}
                className="h-1 musike-surface-3 rounded-full cursor-pointer group relative"
              >
                <div
                  className="h-full bg-[#3b82f6] rounded-full transition-[width] duration-150"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] musike-text-3 mt-0.5 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setVolume(v => v > 0 ? 0 : 80)}
              className="p-1.5 text-[#8b97ad] hover:text-white transition-colors duration-200 musike-press"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-1">
              <button onClick={prevTrack} className="p-2 hover:musike-surface-2 rounded-full text-[#8b97ad] hover:text-white transition-colors duration-200 musike-press">
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={togglePlay}
                className="w-9 h-9 rounded-full bg-[#3b82f6] hover:bg-[#2563eb] flex items-center justify-center transition-colors duration-200 musike-press"
              >
                {isPlaying ? <Pause className="w-4 h-4 text-white fill-current" /> : <Play className="w-4 h-4 text-white fill-current ml-0.5" />}
              </button>
              <button onClick={nextTrack} className="p-2 hover:musike-surface-2 rounded-full text-[#8b97ad] hover:text-white transition-colors duration-200 musike-press">
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setIsExpanded(true)}
              className="p-1.5 text-[#8b97ad] hover:text-white transition-colors duration-200 musike-press"
              title="Expand player"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Volume slider */}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={e => setVolume(parseInt(e.target.value))}
              className="w-full h-0.5 musike-surface-3 rounded-full appearance-none cursor-pointer accent-[#3b82f6]"
            />
          </div>
        </div>
      </div>

      {/* Expanded Player Modal — Musike style */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setIsExpanded(false); }}>
          <div className="musike-island musike-panel-radius w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-4 px-5 py-5 border-b border-[rgb(255_255_255/0.07)] bg-[#111a30] shrink-0">
              <img
                src={artistThumbnail}
                alt={artistName}
                className="w-14 h-14 musike-card-radius object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-white tracking-tight truncate">{artistName}</h2>
                  {isPlaying && <Equalizer paused={false} />}
                </div>
                <p className="text-xs musike-text-3 mt-0.5 font-mono">{tracks.length} tracks • Full length from YouTube</p>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 hover:musike-surface-2 rounded-lg text-[#8b97ad] hover:text-white transition-colors duration-200 musike-press"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Now Playing */}
            <div className="px-5 py-4 border-b border-[rgb(255_255_255/0.07)] shrink-0">
              <div className="flex items-center gap-4">
                <button
                  onClick={togglePlay}
                  className="w-12 h-12 musike-pill bg-[#3b82f6] hover:bg-[#2563eb] flex items-center justify-center transition-colors duration-200 shrink-0 musike-press"
                >
                  {isPlaying ? <Pause className="w-5 h-5 text-white fill-current" /> : <Play className="w-5 h-5 text-white fill-current ml-0.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-white truncate">{currentTrack.title}</p>
                    {isPlaying && <Equalizer paused={false} />}
                  </div>
                  <p className="text-xs musike-text-3 font-mono mt-0.5">{currentTrack.artist || artistName}</p>
                </div>
              </div>
              {duration > 0 && (
                <div className="mt-3">
                  <div
                    onClick={handleSeek}
                    className="h-1.5 musike-surface-3 rounded-full cursor-pointer"
                  >
                    <div
                      className="h-full bg-[#3b82f6] rounded-full transition-[width] duration-150"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] musike-text-3 mt-1 font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              )}
              <div className="mt-3 flex items-center justify-center gap-3">
                <button onClick={prevTrack} className="p-3 hover:musike-surface-2 rounded-full text-[#8b97ad] hover:text-white transition-colors duration-200 musike-press">
                  <SkipBack className="w-5 h-5" />
                </button>
                <button onClick={nextTrack} className="p-3 hover:musike-surface-2 rounded-full text-[#8b97ad] hover:text-white transition-colors duration-200 musike-press">
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Track List */}
            <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
              <p className="text-xs font-bold musike-text-3 uppercase tracking-wider mb-3 font-mono">Tracks</p>
              <div className="space-y-1">
                {tracks.map((track, i) => (
                  <button
                    key={track.url || i}
                    onClick={() => {
                      setCurrentTrackIndex(i);
                      setIsPlaying(true);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 musike-transition musike-press ${
                      i === currentTrackIndex
                        ? 'musike-surface-2'
                        : 'hover:musike-surface-2'
                    }`}
                  >
                    <span className="w-6 text-center text-xs font-mono musike-text-3">
                      {i === currentTrackIndex && isPlaying
                        ? <Equalizer paused={false} />
                        : (i + 1).toString()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${i === currentTrackIndex ? 'text-[#3b82f6]' : 'text-[#e8ecf4]'}`}>
                        {track.title}
                      </p>
                      <p className="text-xs musike-text-3 truncate">{track.artist || artistName}</p>
                    </div>
                    <span className="text-xs font-mono musike-text-3">{formatTime(track.duration)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
