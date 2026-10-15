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
      <div className="fixed bottom-6 right-6 z-50 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-yellow-400 animate-spin shrink-0" />
          <p className="text-sm text-slate-400">Loading tracks...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <audio ref={audioRef} preload="auto" />

      {/* Mini Player */}
      <div className="fixed bottom-6 right-6 z-50 w-72 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Track info bar */}
        <div className="flex items-center gap-3 px-4 py-3">
          <img
            src={artistThumbnail || currentTrack.thumbnail || '/placeholder.jpg'}
            alt={artistName}
            className="w-10 h-10 rounded-lg object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{currentTrack.title}</p>
            <p className="text-xs text-slate-400 truncate">{artistName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors shrink-0"
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
                className="h-1 bg-slate-700 rounded-full cursor-pointer group relative"
              >
                <div
                  className="h-full bg-yellow-400 rounded-full transition-[width]"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setVolume(v => v > 0 ? 0 : 80)}
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-1">
              <button onClick={prevTrack} className="p-2 hover:bg-slate-800 rounded-full text-slate-300 hover:text-white transition-colors">
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={togglePlay}
                className="w-9 h-9 rounded-full bg-yellow-400 hover:bg-yellow-300 flex items-center justify-center transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4 text-slate-900 fill-current" /> : <Play className="w-4 h-4 text-slate-900 fill-current ml-0.5" />}
              </button>
              <button onClick={nextTrack} className="p-2 hover:bg-slate-800 rounded-full text-slate-300 hover:text-white transition-colors">
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setIsExpanded(true)}
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
              title="Expand player"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Volume slider (shown on hover area) */}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={e => setVolume(parseInt(e.target.value))}
              className="w-full h-0.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-yellow-400"
            />
          </div>
        </div>
      </div>

      {/* Expanded Player Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setIsExpanded(false); }}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-4 p-5 border-b border-slate-800 bg-slate-950 shrink-0">
              <img
                src={artistThumbnail}
                alt={artistName}
                className="w-14 h-14 rounded-xl object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-black text-white truncate">{artistName}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{tracks.length} tracks • Full length from YouTube</p>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Now Playing */}
            <div className="px-5 py-4 bg-slate-950/50 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-4">
                <button
                  onClick={togglePlay}
                  className="w-11 h-11 rounded-full bg-yellow-400 hover:bg-yellow-300 flex items-center justify-center transition-colors shrink-0"
                >
                  {isPlaying ? <Pause className="w-5 h-5 text-slate-950 fill-current" /> : <Play className="w-5 h-5 text-slate-950 fill-current ml-0.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{currentTrack.title}</p>
                  <p className="text-xs text-slate-400">{formatTime(currentTime)} / {formatTime(duration)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={prevTrack} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button onClick={nextTrack} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {duration > 0 && (
                <div className="mt-3">
                  <div
                    onClick={handleSeek}
                    className="h-1.5 bg-slate-700 rounded-full cursor-pointer group relative"
                  >
                    <div
                      className="h-full bg-yellow-400 rounded-full transition-[width]"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Track List */}
            <div className="flex-1 overflow-y-auto p-2">
              {tracks.map((track, index) => (
                <button
                  key={track.video_id || index}
                  onClick={() => {
                    setCurrentTrackIndex(index);
                    setIsPlaying(true);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                    index === currentTrackIndex
                      ? 'bg-blue-600/20 border border-blue-500/40'
                      : 'hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <span className={`text-xs font-mono w-6 text-center shrink-0 ${
                    index === currentTrackIndex ? 'text-blue-400' : 'text-slate-500'
                  }`}>
                    {index === currentTrackIndex && isPlaying ? (
                      <span className="inline-flex items-center justify-center w-4 h-4">
                        <Pause className="w-3 h-3 text-blue-400" />
                      </span>
                    ) : (
                      index + 1
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${
                      index === currentTrackIndex ? 'text-blue-300' : 'text-white'
                    }`}>
                      {track.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{artistName}</p>
                  </div>
                  <span className="text-xs font-mono text-slate-500 shrink-0">
                    {formatTime(track.duration)}
                  </span>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 text-center shrink-0">
              <p className="text-xs text-slate-500">
                Powered by yt-dlp • Full-length tracks from YouTube
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
