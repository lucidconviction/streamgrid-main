import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, X, Volume2, VolumeX,
  Maximize2, ChevronDown, Music, Loader2, Heart,
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
    if (isPlaying) audio.play().catch(() => {});
    audio.volume = volume / 100;
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
    if (audioRef.current) audioRef.current.volume = volume / 100;
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
      <div className="fixed bottom-6 right-6 z-50 w-72 bg-[#282828] rounded-lg shadow-2xl overflow-hidden border border-[#3E3E3E]">
        <div className="p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[#1DB954] animate-spin shrink-0" />
          <p className="text-sm text-[#B3B3B3]">Loading tracks...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <audio ref={audioRef} preload="auto" />

      {/* Mini Player — Spotify style floating bar */}
      <div className="fixed bottom-6 right-6 z-50 w-80 bg-[#282828] rounded-lg shadow-2xl overflow-hidden border border-[#3E3E3E]">
        <div className="flex items-center gap-3 px-4 py-3">
          <img
            src={artistThumbnail || currentTrack.thumbnail || '/hero.png'}
            alt={artistName}
            className="w-10 h-10 rounded object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{currentTrack.title}</p>
            <p className="text-xs text-[#B3B3B3] truncate font-mono">{artistName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#3E3E3E] rounded text-[#B3B3B3] hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pb-3">
          {/* Progress */}
          {duration > 0 && (
            <div className="mb-2">
              <div
                onClick={handleSeek}
                className="h-1 bg-[#4D4D4D] rounded-full cursor-pointer group relative"
              >
                <div
                  className="h-full bg-white group-hover:bg-[#1DB954] rounded-full transition-colors"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#B3B3B3] mt-0.5 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setVolume(v => v > 0 ? 0 : 80)}
              className="p-1.5 text-[#B3B3B3] hover:text-white transition-colors"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-1">
              <button onClick={prevTrack} className="p-2 hover:bg-[#3E3E3E] rounded-full text-[#B3B3B3] hover:text-white transition-colors">
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={togglePlay}
                className="w-9 h-9 rounded-full bg-[#1DB954] hover:bg-[#1ed760] flex items-center justify-center transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4 text-black fill-current" /> : <Play className="w-4 h-4 text-black fill-current ml-0.5" />}
              </button>
              <button onClick={nextTrack} className="p-2 hover:bg-[#3E3E3E] rounded-full text-[#B3B3B3] hover:text-white transition-colors">
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setIsExpanded(true)}
              className="p-1.5 text-[#B3B3B3] hover:text-white transition-colors"
              title="Expand player"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Volume slider */}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="range" min="0" max="100" value={volume}
              onChange={e => setVolume(parseInt(e.target.value))}
              className="w-full h-0.5 bg-[#4D4D4D] rounded-full appearance-none cursor-pointer accent-[#1DB954]"
            />
          </div>
        </div>
      </div>

      {/* Expanded Player Modal — Spotify style */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-[#121212] flex flex-col" onClick={(e) => { if (e.target === e.currentTarget) setIsExpanded(false); }}>
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-5">
            <button onClick={() => setIsExpanded(false)} className="text-white hover:scale-110 transition-transform">
              <ChevronDown className="w-7 h-7" />
            </button>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#B3B3B3]">Now Playing</p>
            <div className="w-7" />
          </div>

          <div className="flex-1 flex overflow-hidden px-8 pb-8">
            {/* Left: Album art + controls */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <img
                src={artistThumbnail || currentTrack.thumbnail || '/hero.png'}
                alt={artistName}
                className="w-72 h-72 rounded-lg shadow-2xl object-cover mb-8"
              />
              <div className="w-full max-w-md">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h2 className="text-2xl font-black text-white">{currentTrack.title}</h2>
                    <p className="text-[#B3B3B3] text-base mt-1">{currentTrack.artist || artistName}</p>
                  </div>
                  <Heart className="w-7 h-7 text-[#1DB954] fill-current" />
                </div>

                {/* Progress */}
                <div className="mt-6">
                  <div
                    onClick={handleSeek}
                    className="h-1 bg-[#4D4D4D] rounded-full cursor-pointer group relative mb-1"
                  >
                    <div
                      className="h-full bg-white group-hover:bg-[#1DB954] rounded-full transition-colors"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-[#B3B3B3] font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-6 mt-4">
                  <button className="text-[#B3B3B3] hover:text-white transition-colors"><SkipBack className="w-6 h-6" /></button>
                  <button
                    onClick={togglePlay}
                    className="w-14 h-14 rounded-full bg-white hover:scale-105 flex items-center justify-center transition-transform"
                  >
                    {isPlaying ? <Pause className="w-6 h-6 text-black fill-current" /> : <Play className="w-6 h-6 text-black fill-current ml-1" />}
                  </button>
                  <button className="text-[#B3B3B3] hover:text-white transition-colors"><SkipForward className="w-6 h-6" /></button>
                </div>
              </div>
            </div>

            {/* Right: Track list */}
            <div className="w-96 bg-[#181818] rounded-lg ml-8 overflow-y-auto">
              <div className="px-6 py-4 border-b border-[#282828]">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#B3B3B3]">{tracks.length} Tracks</p>
              </div>
              {tracks.map((track, i) => (
                <button
                  key={track.url || i}
                  onClick={() => { setCurrentTrackIndex(i); setIsPlaying(true); }}
                  className={`w-full flex items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-[#282828] ${i === currentTrackIndex ? 'bg-[#282828]' : ''}`}
                >
                  <span className={`w-6 text-center text-sm font-mono ${i === currentTrackIndex ? 'text-[#1DB954]' : 'text-[#B3B3B3]'}`}>
                    {i === currentTrackIndex && isPlaying ? (
                      <span className="flex items-center justify-center gap-0.5">
                        {[...Array(3)].map((_, j) => (
                          <span key={j} className="w-0.5 bg-[#1DB954] animate-pulse" style={{ height: `${8 + j * 3}px`, animationDelay: `${j * 0.15}s` }} />
                        ))}
                      </span>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${i === currentTrackIndex ? 'text-[#1DB954]' : 'text-white'}`}>{track.title}</p>
                    <p className="text-xs text-[#B3B3B3] truncate">{track.artist || artistName}</p>
                  </div>
                  <span className="text-xs text-[#B3B3B3] font-mono">{formatTime(track.duration)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
