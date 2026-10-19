import { useEffect, useState } from 'react';
import { driftViewers } from '../services/youtubeService';

/**
 * Returns a live-drifting viewer count that jitters around a base value
 * on a fixed interval — simulates real-time viewer movement.
 */
export function useLiveViewers(base: number, intervalMs = 4000): number {
  const [viewers, setViewers] = useState(base);

  useEffect(() => {
    setViewers(base);
    const t = setInterval(() => {
      setViewers((v) => driftViewers(v || base));
    }, intervalMs);
    return () => clearInterval(t);
  }, [base, intervalMs]);

  return viewers;
}
