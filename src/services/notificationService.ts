import { StreamItem } from '../types/stream';

// In-memory cache of stream statuses to detect transitions
let previousStreamStatuses: Map<string, 'live' | 'upcoming' | 'offline' | '24/7'> = new Map();
let isInitialRun = true;

// Web Audio API chime synthesizer for notifications
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Friendly 2-tone chime: 587.33 Hz (D5) -> 880 Hz (A5)
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.18, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (e) {
    // Audio context may be restricted by autoplay policy until user gesture
    console.debug('Notification audio chime not played:', e);
  }
}

export const notificationService = {
  // Browser Notification API
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  },

  getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  },

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch {
      return 'denied';
    }
  },

  sendBrowserNotification(
    title: string,
    body: string,
    icon?: string,
    onClick?: () => void
  ): boolean {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return false;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: icon || '/src/assets/images/hero_championship_live_1792048678438.jpg',
        badge: '/src/assets/images/hero_championship_live_1792048678438.jpg',
        tag: `stream-live-${Date.now()}`,
      });

      if (onClick) {
        notification.onclick = () => {
          window.focus();
          onClick();
          notification.close();
        };
      }

      return true;
    } catch (e) {
      console.warn('Browser notification failed to send:', e);
      return false;
    }
  },

  playChime() {
    playNotificationChime();
  },

  // Initialize or update stream status registry
  initStatusMap(streams: StreamItem[]) {
    streams.forEach((s) => {
      previousStreamStatuses.set(s.id, s.status || 'live');
    });
    isInitialRun = false;
  },

  // Compare previous statuses vs new statuses for streams in watchlist
  detectWatchlistTransitions(
    watchlistIds: string[],
    currentStreams: StreamItem[],
    onStreamWentLive: (stream: StreamItem) => void
  ) {
    if (isInitialRun) {
      this.initStatusMap(currentStreams);
      return;
    }

    const currentMap = new Map<string, StreamItem>();
    currentStreams.forEach((s) => currentMap.set(s.id, s));

    watchlistIds.forEach((id) => {
      const current = currentMap.get(id);
      const prevStatus = previousStreamStatuses.get(id);

      // If current stream is now 'live', and previously it was 'offline', 'upcoming', or undefined
      if (current && current.status === 'live' && prevStatus && prevStatus !== 'live' && prevStatus !== '24/7') {
        onStreamWentLive(current);
      }

      // Update registry
      if (current) {
        previousStreamStatuses.set(id, current.status || 'live');
      }
    });

    // Also update all other stream statuses
    currentStreams.forEach((s) => {
      previousStreamStatuses.set(s.id, s.status || 'live');
    });
  },

  // Manual status override for instant testing
  simulateTransition(
    stream: StreamItem,
    fromStatus: 'offline' | 'upcoming',
    onStreamWentLive: (stream: StreamItem) => void
  ) {
    previousStreamStatuses.set(stream.id, fromStatus);
    const updated: StreamItem = {
      ...stream,
      status: 'live',
    };
    onStreamWentLive(updated);
  },
};
