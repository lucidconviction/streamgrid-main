import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StreamItem } from '../types/stream';
import { StreamCard } from './StreamCard';
interface StreamCarouselProps {
  title: string;
  subtitle?: string;
  streams: StreamItem[];
  onPlayStream: (stream: StreamItem) => void;
  onAddToMultiview: (stream: StreamItem) => void;
  onToggleWatchlist: (stream: StreamItem) => void;
  watchlistIds: string[];
  multiviewStreamIds: string[];
  onViewAll?: () => void;
}

export const StreamCarousel: React.FC<StreamCarouselProps> = ({
  title,
  subtitle,
  streams,
  onPlayStream,
  onAddToMultiview,
  onToggleWatchlist,
  watchlistIds,
  multiviewStreamIds,
  onViewAll,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [screenshotUrls, setScreenshotUrls] = useState<Map<string, string | null>>(new Map());

  // Use remote screenshot service (image.thum.io) for streams without a poster
  // This is fast and doesn't block the UI with HLS instance creation
  useEffect(() => {
    // Cap to 100 streams to avoid generating thousands of URLs
    const cappedStreams = streams.slice(0, 100);
    const streamsWithoutPoster = cappedStreams.filter((s) => s.directEmbedUrl && !s.poster);
    if (streamsWithoutPoster.length === 0) return;

    const newUrls = new Map(screenshotUrls);
    streamsWithoutPoster.forEach((stream) => {
      if (newUrls.has(stream.id)) return;
      const url = stream.directEmbedUrl!.startsWith('http')
        ? stream.directEmbedUrl!
        : `${window.location.origin}${stream.directEmbedUrl!}`;
      newUrls.set(stream.id, `https://image.thum.io/get/maxage/7200/width/320/fail/${encodeURIComponent(url)}`);
    });
    setScreenshotUrls(new Map(newUrls));
  }, [streams]);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const scrollAmount = rowRef.current.clientWidth * 0.75;
      rowRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="mb-8">
      {/* Row Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">{title}</h2>
          {subtitle && (
            <p className="text-sm text-slate-300 mt-0.5 font-medium">{subtitle}</p>
          )}
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
          >
            View All →
          </button>
        )}
      </div>

      {/* Carousel */}
      <div className="relative group">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-[#0a0f1a]/90 border border-blue-500/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600/80"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-[#0a0f1a]/90 border border-blue-500/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600/80"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Stream Cards */}
        <div
          ref={rowRef}
          className="flex gap-5 overflow-x-auto no-scrollbar scroll-smooth pb-2"
        >
          {streams.map((stream) => (
            <div key={stream.id} className="flex-shrink-0 w-[240px] sm:w-56 md:w-64">
              <StreamCard
                stream={stream}
                onPlay={onPlayStream}
                onAddToMultiview={onAddToMultiview}
                onToggleWatchlist={onToggleWatchlist}
                isInWatchlist={watchlistIds.includes(stream.id)}
                isInMultiview={multiviewStreamIds.includes(stream.id)}
                screenshotUrl={screenshotUrls.get(stream.id) || null}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};