import React, { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { useHeroStreams } from '../hooks/useHeroStreams';

// ── HeroVideo — full-bleed video hero background ────────────────────────────
// Validated live video stream behind typography. Fills the hero edge-to-edge
// (object-fit: cover, no letterboxing). Animated gradient fallback if no
// stream validates. Lazy-loads out of viewport, pauses when tab is hidden.

export type HeroVariant = 'live' | 'premium247' | 'iptv';

interface HeroVideoProps {
  /** Candidate stream URLs in priority order (first validated wins). */
  candidates: { url: string; title?: string }[];
  /** Page variant — controls badge color, CTA color, fallback glow. */
  variant: HeroVariant;
  /** Badge label, e.g. "LIVE NOW" */
  badge: string;
  /** Optional emoji/icon before badge text. */
  badgeIcon?: string;
  /** Hero title (large). */
  title: string;
  /** Subtitle line under title. */
  subtitle: string;
  /** CTA label. */
  ctaLabel: string;
  /** CTA click handler. */
  onCta: () => void;
  /** Optional secondary CTA. */
  secondaryCtaLabel?: string;
  onSecondaryCta?: () => void;
  /** Extra content rendered below CTA (e.g. quick-switch strip). */
  children?: React.ReactNode;
}

// ── Per-variant design tokens (from hero-video-spec.md) ─────────────────────
const VARIANT = {
  live: {
    badgeBg: 'rgba(239,68,68,0.2)',
    badgeBorder: 'rgba(239,68,68,0.3)',
    badgeText: '#fca5a5',
    badgeShadow: '0 0 20px rgba(239,68,68,0.25)',
    ctaBg: '#ef4444',
    ctaHover: '#dc2626',
    ctaShadow: '0 8px 30px rgba(239,68,68,0.4)',
    // Fallback gradient: dark slate + red radial glow
    fallbackBg: 'linear-gradient(160deg, #0f172a 0%, #1e293b 55%, #0f172a 100%)',
    glowBg: 'radial-gradient(ellipse 80% 60% at 50% 110%, rgba(239,68,68,0.15) 0%, transparent 70%)',
    pageBg: '#090a0f',
  },
  premium247: {
    badgeBg: 'rgba(59,130,246,0.2)',
    badgeBorder: 'rgba(59,130,246,0.3)',
    badgeText: '#93c5fd',
    badgeShadow: '0 0 20px rgba(59,130,246,0.25)',
    ctaBg: '#3b82f6',
    ctaHover: '#2563eb',
    ctaShadow: '0 8px 30px rgba(59,130,246,0.4)',
    fallbackBg: 'linear-gradient(160deg, #0f172a 0%, #1e3a5f 55%, #0f172a 100%)',
    glowBg: 'radial-gradient(ellipse 80% 60% at 50% 110%, rgba(59,130,246,0.15) 0%, transparent 70%)',
    pageBg: '#090a0f',
  },
  iptv: {
    badgeBg: 'rgba(34,197,94,0.2)',
    badgeBorder: 'rgba(34,197,94,0.3)',
    badgeText: '#86efac',
    badgeShadow: '0 0 20px rgba(34,197,94,0.25)',
    ctaBg: '#22c55e',
    ctaHover: '#16a34a',
    ctaShadow: '0 8px 30px rgba(34,197,94,0.4)',
    fallbackBg: 'linear-gradient(160deg, #0d1117 0%, #161b22 55%, #0d1117 100%)',
    glowBg: 'radial-gradient(ellipse 80% 60% at 50% 110%, rgba(34,197,94,0.1) 0%, transparent 70%)',
    pageBg: '#090a0f',
  },
} as const;

// Slow ambient zoom on the video (spec animation)
const HERO_VIDEO_CSS = `
@keyframes heroSlowZoom {
  from { transform: scale(1); }
  to { transform: scale(1.08); }
}
@keyframes heroPing {
  75%, 100% { transform: scale(2); opacity: 0; }
}
@keyframes heroPulseGlow {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}
.hero-slow-zoom {
  animation: heroSlowZoom 20s ease-in-out infinite alternate;
}
.hero-live-dot-ping {
  animation: heroPing 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}
.hero-fallback-glow {
  animation: heroPulseGlow 4s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .hero-slow-zoom, .hero-live-dot-ping, .hero-fallback-glow {
    animation: none;
  }
}
`;

export const HeroVideo: React.FC<HeroVideoProps> = ({
  candidates,
  variant,
  badge,
  badgeIcon,
  title,
  subtitle,
  ctaLabel,
  onCta,
  secondaryCtaLabel,
  onSecondaryCta,
  children,
}) => {
  const v = VARIANT[variant];
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // In-view gating: only start playback when the hero is >=10% visible
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setInView(entry.intersectionRatio >= 0.1);
        }
      },
      { threshold: [0, 0.1, 0.5] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Pause when tab hidden, resume when visible
  const [tabVisible, setTabVisible] = useState(!document.hidden);
  useEffect(() => {
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const { validatedUrl, isHls, isValidating } = useHeroStreams(inView ? candidates : []);

  // Attach the validated stream to the <video> element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Destroy previous HLS
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (!validatedUrl) return;

    if (!tabVisible || !inView) return;

    let cancelled = false;

    const tryPlay = () => {
      video.muted = true;
      video.play().catch(() => {/* blocked autoplay — muted, so rare */});
    };

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.loadSource(validatedUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!cancelled) tryPlay();
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal && hlsRef.current === hls) {
          hls.destroy();
          hlsRef.current = null;
        }
      });
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = validatedUrl;
      video.addEventListener('loadedmetadata', () => { if (!cancelled) tryPlay(); }, { once: true });
    } else {
      video.src = validatedUrl;
      video.addEventListener('loadeddata', () => { if (!cancelled) tryPlay(); }, { once: true });
    }

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute('src');
      video.load();
    };
  }, [validatedUrl, isHls, inView, tabVisible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  const hasVideo = Boolean(validatedUrl);

  return (
    <section
      ref={sectionRef}
      aria-label={`${badge} hero — ${title}`}
      className="relative w-full overflow-hidden select-none"
      style={{ height: 'clamp(360px, 75vh, 860px)', background: v.pageBg }}
    >
      <style>{HERO_VIDEO_CSS}</style>

      {/* ── Background layer: validated video OR animated gradient fallback ── */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {hasVideo && (
          <div className={`absolute inset-0 ${hasVideo ? 'hero-slow-zoom' : ''}`}>
            <video
              ref={videoRef}
              aria-hidden="true"
              muted
              playsInline
              autoPlay
              loop
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          </div>
        )}

        {!hasVideo && (
          /* Animated gradient fallback — never a broken/black video */
          <div className="absolute inset-0" style={{ background: v.fallbackBg }}>
            <div
              className="absolute inset-0 hero-fallback-glow"
              style={{ background: v.glowBg }}
              aria-hidden="true"
            />
            {/* Subtle diagonal texture to avoid a flat look */}
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background:
                  'radial-gradient(ellipse 60% 50% at 15% 20%, rgba(148,163,184,0.08) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 15%, rgba(148,163,184,0.06) 0%, transparent 60%)',
              }}
              aria-hidden="true"
            />
          </div>
        )}
      </div>

      {/* ── Gradient overlays (2 layers per spec) ── */}
      <div className="absolute inset-0 z-[1]" aria-hidden="true">
        {/* Layer 1: text readability — bottom fades to black */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
        {/* Layer 2: smooth transition into page content */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#090a0f] to-transparent" />
      </div>

      {/* ── Typography layer — bottom-aligned, full-bleed with side gutters ── */}
      <div className="relative z-10 h-full flex flex-col justify-end px-4 sm:px-8 lg:px-20 pb-8 sm:pb-12 lg:pb-20 max-w-6xl">
        {/* Badge */}
        <div className="mb-4 sm:mb-6">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-widest border"
            style={{
              background: v.badgeBg,
              borderColor: v.badgeBorder,
              color: v.badgeText,
              boxShadow: v.badgeShadow,
            }}
          >
            {variant === 'live' ? (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="hero-live-dot-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
            ) : (
              <span className="leading-none">{badgeIcon || '●'}</span>
            )}
            {badge}
          </span>
        </div>

        {/* Title */}
        <h1
          className="text-3xl sm:text-5xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1] mb-3 sm:mb-4"
          style={{ textWrap: 'balance' }}
        >
          {title}
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-xl lg:text-2xl text-slate-300 font-light mb-6 sm:mb-8 max-w-2xl">
          {subtitle}
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onCta}
            className="min-h-[44px] px-6 py-3 rounded-xl font-bold text-white text-sm sm:text-base transition-all hover:scale-[1.03] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              background: v.ctaBg,
              boxShadow: `0 4px 20px ${v.ctaShadow.split(' ').slice(3).join(' ')}0`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = v.ctaHover;
              e.currentTarget.style.boxShadow = v.ctaShadow;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = v.ctaBg;
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            }}
          >
            {ctaLabel}
          </button>
          {secondaryCtaLabel && onSecondaryCta && (
            <button
              onClick={onSecondaryCta}
              className="min-h-[44px] px-6 py-3 rounded-xl font-semibold text-slate-100 text-sm sm:text-base bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/60 transition-all hover:scale-[1.02] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {secondaryCtaLabel}
            </button>
          )}
        </div>

        {/* Optional extra content (e.g. quick-switch strip) */}
        {children}
      </div>
    </section>
  );
};
