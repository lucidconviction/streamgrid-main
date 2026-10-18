import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, X, Volume2, VolumeX,
  Maximize2, ChevronDown, Monitor, Radio, Shuffle,
  Move, Minus, GripVertical,
} from 'lucide-react';
import { loadYouTubeAPI, fetchRadioTracks, getPlaylists, type MusicPlaylist } from '../services/musicService';

interface MusicTrack {
  title: string;
  url?: string;
  duration: number;
  thumbnail?: string;
  video_id?: string;
  artist?: string;
}

interface FloatingMusicPlayerProps {
  artistName: string;
  artistThumbnail: string;
  tracks: MusicTrack[];
  startIndex?: number;
  channelId?: string;
  defaultPlayMode?: 'audio' | 'video';
  onClose: () => void;
}

export const FloatingMusicPlayer: React.FC<FloatingMusicPlayerProps> = ({
  artistName,
  artistThumbnail,
  tracks,
  startIndex = 0,
  channelId,
  defaultPlayMode,
  onClose,
}) => {
  const safeStart = Math.min(Math.max(0, startIndex), Math.max(0, tracks.length - 1));
  const [currentTrackIndex, setCurrentTrackIndex] = useState(safeStart);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(tracks[safeStart]?.duration || 0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [playMode, setPlayMode] = useState<'audio' | 'video'>(defaultPlayMode || 'audio');
  const [radioMode, setRadioMode] = useState(false);
  const [currentArtistName, setCurrentArtistName] = useState('');
  const [currentChannelId, setCurrentChannelId] = useState('');
  const [videoVisible, setVideoVisible] = useState(false);

  // ── Window position & size (centered by default) ───────────────────────────
  const WIN_W = 560;
  const WIN_H = 340;
  const STORAGE_KEY = 'rdnutz_music_player_geom';
  const winRef = useRef({ x: 0, y: 0, w: WIN_W, h: WIN_H });
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const resizeDir = useRef('');
  const rafId = useRef<number>(0);
  const lockedRef = useRef(false);

  const applyWindow = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const { x, y, w, h } = winRef.current;
    c.style.left = `${x}px`;
    c.style.top = `${y}px`;
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
  }, []);

  const centerWindow = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    winRef.current = {
      x: Math.max(8, (vw - WIN_W) / 2),
      y: Math.max(8, (vh - WIN_H) / 2),
      w: WIN_W,
      h: WIN_H,
    };
    applyWindow();
  }, [applyWindow]);

  const saveWindow = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(winRef.current)); } catch {}
  }, []);

  const loadWindow = useCallback((): { x: number; y: number; w: number; h: number } | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const g = JSON.parse(raw);
      if (g && typeof g.x === 'number' && typeof g.y === 'number') return g;
    } catch {}
    return null;
  }, []);

  // ── Imperative host (appended to <body>) ───────────────────────────────────
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const apiRef = useRef<any>(null);
  const readyRef = useRef(false);
  const creatingRef = useRef(false);
  const pendingVideoRef = useRef<string | null>(null);
  const tracksRef = useRef(tracks);
  const indexRef = useRef(safeStart);
  const volumeRef = useRef(volume);
  const queueEndRef = useRef<() => void>(() => {});
  const radioExtendedRef = useRef(false);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const resizeHandlesRef = useRef<HTMLDivElement | null>(null);
  const sizeSliderRef = useRef<HTMLInputElement | null>(null);

  const syncSlider = useCallback(() => {
    if (sizeSliderRef.current) sizeSliderRef.current.value = String(winRef.current.w);
  }, []);

  tracksRef.current = tracks;
  volumeRef.current = volume;
  indexRef.current = currentTrackIndex;

  const currentTrack = tracks[currentTrackIndex];

  // ── Create the body-level host container (survives React renders) ──────────
  useEffect(() => {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.zIndex = '70';
    container.style.margin = '0';
    container.style.overflow = 'hidden';
    container.style.borderRadius = '14px';
    container.style.boxShadow = '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)';
    container.style.background = '#0a0f1c';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.fontFamily = 'inherit';

    // Header bar (drag handle)
    const header = document.createElement('div');
    header.className = 'music-player-header';
    header.style.cssText = `
      display:flex; align-items:center; gap:6px;
      padding:8px 12px; cursor:move; user-select:none;
      background:linear-gradient(180deg,#1a2235 0%,#121826 100%);
      border-bottom:1px solid rgba(255,255,255,0.08);
      border-radius:14px 14px 0 0;
    `;
    // Drag grip icon
    const grip = document.createElement('span');
    grip.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>';
    header.appendChild(grip);
    // Title
    const title = document.createElement('span');
    title.className = 'music-player-title';
    title.style.cssText = 'flex:1;text-align:center;font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:0.08em;text-transform:uppercase;pointer-events:none;';
    title.textContent = 'Now Playing  🔓';
    header.appendChild(title);
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'music-player-close';
    closeBtn.style.cssText = `
      width:24px;height:24px;border-radius:6px;border:none;cursor:pointer;
      background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);
      display:flex;align-items:center;justify-content:center;
      transition:background 0.15s,color 0.15s;
    `;
    closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.onmouseenter = () => { closeBtn.style.background = 'rgba(239,68,68,0.3)'; closeBtn.style.color = '#f87171'; };
    closeBtn.onmouseleave = () => { closeBtn.style.background = 'rgba(255,255,255,0.06)'; closeBtn.style.color = 'rgba(255,255,255,0.5)'; };
    closeBtn.onclick = onClose;
    header.appendChild(closeBtn);
    // Minimize button (collapse to mini player)
    const minBtn = document.createElement('button');
    minBtn.className = 'music-player-min';
    minBtn.style.cssText = closeBtn.style.cssText;
    minBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    minBtn.onmouseenter = () => { minBtn.style.background = 'rgba(255,255,255,0.12)'; };
    minBtn.onmouseleave = () => { minBtn.style.background = 'rgba(255,255,255,0.06)'; };
    minBtn.onclick = () => setVideoVisible(false);
    header.appendChild(minBtn);

    // Lock button (saves/restores position & size)
    const lockBtn = document.createElement('button');
    lockBtn.className = 'music-player-lock';
    const lockIconUnlocked = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
    const lockIconLocked = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
    lockBtn.innerHTML = lockIconUnlocked;
    lockBtn.title = 'Lock position & size';
    lockBtn.style.cssText = closeBtn.style.cssText;
    lockBtn.onmouseenter = () => { lockBtn.style.background = 'rgba(59,130,246,0.25)'; lockBtn.style.color = '#60a5fa'; };
    lockBtn.onmouseleave = () => { if (!lockedRef.current) { lockBtn.style.background = 'rgba(255,255,255,0.06)'; lockBtn.style.color = 'rgba(255,255,255,0.5)'; } else { lockBtn.style.background = 'rgba(59,130,246,0.2)'; lockBtn.style.color = '#60a5fa'; } };
    lockBtn.onclick = () => {
      lockedRef.current = !lockedRef.current;
      if (lockedRef.current) {
        saveWindow();
        lockBtn.innerHTML = lockIconLocked;
        lockBtn.title = 'Unlock — will auto-center next time';
        title.textContent = 'Now Playing  🔒 Saved';
      } else {
        lockBtn.innerHTML = lockIconUnlocked;
        lockBtn.title = 'Lock position & size';
        title.textContent = 'Now Playing  🔓';
      }
    };
    header.appendChild(lockBtn);

    // Size slider (quick resizing: 320px – 900px)
    const sizeContainer = document.createElement('div');
    sizeContainer.className = 'music-player-size-control';
    sizeContainer.style.cssText = `
      display:flex; align-items:center; gap:4px; margin-left:4px;
      padding:2px 6px; border-radius:6px; background:rgba(255,255,255,0.05);
    `;
    const sizeLabel = document.createElement('span');
    sizeLabel.style.cssText = 'font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);font-family:monospace;text-transform:uppercase;';
    sizeLabel.textContent = 'Size';
    const sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.min = '320';
    sizeSlider.max = '900';
    sizeSlider.value = String(winRef.current.w);
    sizeSlider.style.cssText = `
      width:60px; height:3px; cursor:pointer; accent-color:#3b82f6;
      background:rgba(255,255,255,0.15); border-radius:2px;
    `;
    sizeSlider.oninput = (e) => {
      const newW = parseInt((e.target as HTMLInputElement).value, 10);
      const ratio = 340 / 560; // preserve ~16:10 aspect ratio
      const newH = Math.round(newW * ratio);
      const maxW = window.innerWidth;
      const maxH = window.innerHeight;
      const clampedW = Math.min(newW, maxW - 16);
      const clampedH = Math.min(newH, maxH - 16);
      // Keep centered on resize from slider
      const cx = winRef.current.x + winRef.current.w / 2;
      const cy = winRef.current.y + winRef.current.h / 2;
      const nx = Math.max(8, Math.min(maxW - clampedW - 8, cx - clampedW / 2));
      const ny = Math.max(8, Math.min(maxH - clampedH - 8, cy - clampedH / 2));
      winRef.current = { x: nx, y: ny, w: clampedW, h: clampedH };
      applyWindow();
      if (lockedRef.current) saveWindow();
    };
    sizeContainer.appendChild(sizeLabel);
    sizeContainer.appendChild(sizeSlider);
    sizeContainer.addEventListener('pointerdown', (e) => e.stopPropagation());
    header.appendChild(sizeContainer);
    sizeSliderRef.current = sizeSlider;

    // Video host
    const host = document.createElement('div');
    host.className = 'music-player-host';
    host.style.cssText = 'flex:1;min-height:0;border-radius:0 0 14px 14px;overflow:hidden;background:#000;';
    host.style.width = '100%';
    host.style.height = '100%';

    container.appendChild(header);
    container.appendChild(host);
    document.body.appendChild(container);

    // Start hidden (shown only in video mode)
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';

    containerRef.current = container;
    hostRef.current = host;
    headerRef.current = header;
    resizeHandlesRef.current = null;

    // ── Drag logic ──
    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.music-player-close,.music-player-min')) return;
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY, ox: winRef.current.x, oy: winRef.current.y };
      container.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (isDragging.current) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        winRef.current.x = Math.max(0, Math.min(window.innerWidth - winRef.current.w, dragStart.current.ox + dx));
        winRef.current.y = Math.max(0, Math.min(window.innerHeight - winRef.current.h, dragStart.current.oy + dy));
        if (rafId.current) cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(applyWindow);
      }
    };
    const onPointerUp = () => {
      if (isDragging.current) isDragging.current = false;
      if (lockedRef.current) saveWindow();
      syncSlider();
    };

    header.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    centerWindow();
    // Restore previously saved geometry if any
    const saved = loadWindow();
    if (saved) {
      winRef.current = saved;
      applyWindow();
    }
    syncSlider();

    return () => {
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
      readyRef.current = false;
      creatingRef.current = false;
      if (rafId.current) cancelAnimationFrame(rafId.current);
      header.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.remove();
      containerRef.current = null;
      hostRef.current = null;
      headerRef.current = null;
      resizeHandlesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resize handles ───────────────────────────────────────────────────────────
  useEffect(() => {
    const c = containerRef.current;
    const h = resizeHandlesRef.current;
    if (!c) return;

    const dirs: Array<{ dir: string; cursor: string }> = [
      { dir: 'n', cursor: 'n-resize' }, { dir: 's', cursor: 's-resize' },
      { dir: 'e', cursor: 'e-resize' }, { dir: 'w', cursor: 'w-resize' },
      { dir: 'ne', cursor: 'ne-resize' }, { dir: 'nw', cursor: 'nw-resize' },
      { dir: 'se', cursor: 'se-resize' }, { dir: 'sw', cursor: 'sw-resize' },
    ];

    dirs.forEach(({ dir, cursor }) => {
      const handle = document.createElement('div');
      handle.className = `music-resize-${dir}`;
      const isEdge = dir.length === 1;
      const isCorner = dir.length === 2;
      if (isCorner) {
        handle.style.cssText = `position:absolute;width:18px;height:18px;z-index:10;${
          dir.includes('n') ? 'top:-4px' : 'bottom:-4px'
        }${dir.includes('w') ? 'left:-4px' : 'right:-4px'};cursor:${cursor};`;
      } else if (dir === 'n' || dir === 's') {
        handle.style.cssText = `position:absolute;left:20px;right:20px;height:8px;z-index:10;cursor:${cursor};${dir === 'n' ? 'top:-4px' : 'bottom:-4px'};`;
      } else {
        handle.style.cssText = `position:absolute;top:20px;bottom:20px;width:8px;z-index:10;cursor:${cursor};${dir === 'e' ? 'right:-4px' : 'left:-4px'};`;
      }
      handle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        isResizing.current = true;
        resizeDir.current = dir;
        const start = { x: e.clientX, y: e.clientY, ox: winRef.current.x, oy: winRef.current.y, ow: winRef.current.w, oh: winRef.current.h };
        c.setPointerCapture(e.pointerId);
        const onMove = (ev: PointerEvent) => {
          const dx = ev.clientX - start.x;
          const dy = ev.clientY - start.y;
          let nx = start.ox, ny = start.oy, nw = start.ow, nh = start.oh;
          if (dir.includes('e')) nw = Math.max(280, start.ow + dx);
          if (dir.includes('w')) { nw = Math.max(280, start.ow - dx); nx = start.ox + start.ow - nw; }
          if (dir.includes('s')) nh = Math.max(180, start.oh + dy);
          if (dir.includes('n')) { nh = Math.max(180, start.oh - dy); ny = start.oy + start.oh - nh; }
          nx = Math.max(0, Math.min(window.innerWidth - nw, nx));
          ny = Math.max(0, Math.min(window.innerHeight - nh, ny));
          winRef.current = { x: nx, y: ny, w: nw, h: nh };
          if (rafId.current) cancelAnimationFrame(rafId.current);
          rafId.current = requestAnimationFrame(applyWindow);
        };
        const onUp = () => { isResizing.current = false; resizeDir.current = ''; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); if (lockedRef.current) saveWindow(); syncSlider(); };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
      c.appendChild(handle);
    });
    resizeHandlesRef.current = c;
    return () => {
      if (resizeHandlesRef.current) {
        // Remove only the resize handles we added (children that are divs with music-resize-* class)
        Array.from(c.children).forEach(child => {
          if (child !== headerRef.current && child !== hostRef.current && (child as HTMLElement).className.startsWith('music-resize-')) {
            child.remove();
          }
        });
        resizeHandlesRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Show/hide video window based on mode ────────────────────────────────────
  useEffect(() => {
    const show = isPlaying && playMode === 'video' && !!currentTrack?.video_id;
    if (show !== videoVisible) setVideoVisible(show);
    const c = containerRef.current;
    if (!c) return;
    if (show) {
      c.style.opacity = '1';
      c.style.pointerEvents = 'auto';
      // Restore saved position if locked & saved; otherwise center
      if (lockedRef.current) {
        const saved = loadWindow();
        if (saved) { winRef.current = saved; applyWindow(); }
        else centerWindow();
      } else {
        centerWindow();
      }
    } else {
      c.style.opacity = '0';
      c.style.pointerEvents = 'none';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playMode, currentTrack]);

  // ── Create the YT player once, lazily, on first mount with a track ──────────
  useEffect(() => {
    const first = tracksRef.current[indexRef.current];
    if (!first?.video_id) return;
    if (playerRef.current || creatingRef.current) return;
    creatingRef.current = true;
    loadYouTubeAPI().then(YT => {
      creatingRef.current = false;
      if (!hostRef.current || playerRef.current) return;
      apiRef.current = YT;
      const wc = winRef.current;
      playerRef.current = new YT.Player(hostRef.current, {
        width: String(wc.w),
        height: String(wc.h - 40), // account for header
        videoId: first.video_id,
        playerVars: { autoplay: 1, rel: 0, playsinline: 1, iv_load_policy: 3, controls: 1 },
        events: {
          onReady: () => {
            readyRef.current = true;
            try { playerRef.current?.setVolume?.(volumeRef.current); } catch { /* ignore */ }
            const pending = pendingVideoRef.current;
            if (pending) {
              pendingVideoRef.current = null;
              try { playerRef.current?.loadVideoById?.(pending, 0); playerRef.current?.playVideo?.(); } catch { /* ignore */ }
            }
          },
          onStateChange: (e: any) => {
            const S = apiRef.current?.PlayerState;
            if (!S) return;
            if (e.data === S.PLAYING) setIsPlaying(true);
            else if (e.data === S.PAUSED) setIsPlaying(false);
            else if (e.data === S.ENDED) queueEndRef.current();
          },
        },
      });
    });
  }, []);

  // ── Poll playback time/duration ─────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p || !readyRef.current) return;
      try {
        const ct = p.getCurrentTime?.() || 0;
        const d = p.getDuration?.() || 0;
        setCurrentTime(ct);
        if (d) setDuration(d);
      } catch { /* ignore */ }
    }, 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setCurrentArtistName(artistName);
    setCurrentChannelId(channelId || '');
    radioExtendedRef.current = false;
  }, [artistName, channelId]);
  useEffect(() => {
    const p = playerRef.current;
    if (p && readyRef.current) {
      try { p.setVolume?.(volume); } catch { /* ignore */ }
    }
  }, [volume]);

  // ── Track selection ─────────────────────────────────────────────────────────
  const selectTrack = useCallback((i: number) => {
    const q = tracksRef.current;
    if (!q.length) return;
    const idx = ((i % q.length) + q.length) % q.length;
    setCurrentTrackIndex(idx);
    indexRef.current = idx;
    const t = q[idx];
    if (!t?.video_id) return;
    setIsPlaying(true);
    setDuration(t.duration || 0);
    setCurrentTime(0);
    const p = playerRef.current;
    if (p && readyRef.current) {
      try { p.loadVideoById(t.video_id, 0); p.playVideo(); } catch { /* ignore */ }
    } else if (p && !readyRef.current) {
      pendingVideoRef.current = t.video_id;
    } else if (!p && !creatingRef.current) {
      creatingRef.current = true;
      loadYouTubeAPI().then(YT => {
        creatingRef.current = false;
        if (!hostRef.current || playerRef.current) return;
        apiRef.current = YT;
        const wc = winRef.current;
        playerRef.current = new YT.Player(hostRef.current, {
          width: String(wc.w), height: String(wc.h - 40),
          videoId: t.video_id,
          playerVars: { autoplay: 1, rel: 0, playsinline: 1, iv_load_policy: 3, controls: 1 },
          events: {
            onReady: () => {
              readyRef.current = true;
              try { playerRef.current?.setVolume?.(volumeRef.current); } catch { /* ignore */ }
            },
            onStateChange: (e: any) => {
              const S = apiRef.current?.PlayerState;
              if (!S) return;
              if (e.data === S.PLAYING) setIsPlaying(true);
              else if (e.data === S.PAUSED) setIsPlaying(false);
              else if (e.data === S.ENDED) queueEndRef.current();
            },
          },
        });
      });
    }
  }, []);

  const prevTrack = () => { const q = tracksRef.current; if (!q.length) return; const idx = indexRef.current; selectTrack(((idx - 1) % q.length) + q.length); };
  const nextTrack = () => { const q = tracksRef.current; if (!q.length) return; selectTrack(indexRef.current + 1); };

  // ── Radio/auto-mix: extend queue when it runs out ────────────────────────────
  const extendQueue = useCallback(async () => {
    if (!radioMode || radioExtendedRef.current) return;
    radioExtendedRef.current = true;
    if (!currentChannelId) return;
    try {
      const radioTracks = await fetchRadioTracks(currentChannelId, 30);
      if (radioTracks.length > 0) {
        tracksRef.current = [...tracksRef.current, ...radioTracks];
      }
    } catch {}
    radioExtendedRef.current = false;
  }, [radioMode, currentChannelId]);

  const queueEndHandler = useCallback(async () => {
    const q = tracksRef.current;
    if (q.length === 0) return;
    const idx = indexRef.current;
    if (idx < q.length - 1) {
      selectTrack(idx + 1);
      return;
    }
    if (!radioMode) {
      selectTrack(0);
      return;
    }
    await extendQueue();
    const newLength = tracksRef.current.length;
    if (idx + 1 < newLength) {
      selectTrack(idx + 1);
    } else {
      selectTrack(0);
    }
  }, [radioMode, extendQueue, selectTrack]);
  useEffect(() => { queueEndRef.current = queueEndHandler; }, [queueEndHandler]);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    try {
      if (isPlaying) p.pauseVideo();
      else p.playVideo();
    } catch { /* ignore */ }
  }, [isPlaying]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = ratio * duration;
    setCurrentTime(t);
    const p = playerRef.current;
    if (p && readyRef.current) {
      try { p.seekTo?.(t, true); } catch { /* ignore */ }
    }
  };

  const toggleMode = () => setPlayMode(m => m === 'audio' ? 'video' : 'audio');
  const toggleRadio = () => setRadioMode(r => !r);

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <>
      {/* Mini Player — Spotify style floating bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 w-full sm:w-80 sm:bottom-6 sm:right-6 bg-[#1a2235] rounded-t-lg sm:rounded-lg shadow-2xl overflow-hidden border border-[#243049] sm:border-t-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <img
            src={artistThumbnail || currentTrack.thumbnail || '/hero.png'}
            alt={artistName}
            className="w-10 h-10 rounded object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{currentTrack.title}</p>
            <p className="text-xs text-[#8b97ad] truncate font-mono">{artistName}</p>
          </div>
          {currentTrack.video_id && (
            <button
              onClick={toggleMode}
              className={`p-1.5 rounded transition-colors shrink-0 ${
                playMode === 'video' ? 'text-[#3b82f6]' : 'text-[#8b97ad] hover:text-white'
              }`}
              title={playMode === 'audio' ? 'Show video' : 'Audio only'}
            >
              <Monitor className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#243049] rounded text-[#8b97ad] hover:text-white transition-colors shrink-0"
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
                className="h-1 bg-[#243049] rounded-full cursor-pointer group relative"
              >
                <div
                  className="h-full bg-white group-hover:bg-[#3b82f6] rounded-full transition-colors"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#8b97ad] mt-0.5 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setVolume(v => v > 0 ? 0 : 80)}
              className="p-1.5 text-[#8b97ad] hover:text-white transition-colors"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={toggleRadio}
                className={`p-2 rounded-full transition-colors ${radioMode ? 'text-[#3b82f6] bg-blue-950/60' : 'text-[#8b97ad] hover:text-white hover:bg-[#243049]'}`}
                title={radioMode ? 'Radio mode: ON — auto-extends queue with similar artists' : 'Radio mode: OFF'}
              >
                <Radio className="w-4 h-4" />
              </button>
              <button onClick={prevTrack} className="p-2 hover:bg-[#243049] rounded-full text-[#8b97ad] hover:text-white transition-colors">
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={togglePlay}
                className="w-9 h-9 rounded-full bg-[#3b82f6] hover:bg-[#2563eb] flex items-center justify-center transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4 text-black fill-current" /> : <Play className="w-4 h-4 text-black fill-current ml-0.5" />}
              </button>
              <button onClick={nextTrack} className="p-2 hover:bg-[#243049] rounded-full text-[#8b97ad] hover:text-white transition-colors">
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setIsExpanded(true)}
              className="p-1.5 text-[#8b97ad] hover:text-white transition-colors"
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
              className="w-full h-0.5 bg-[#243049] rounded-full appearance-none cursor-pointer accent-[#3b82f6]"
            />
          </div>
        </div>
      </div>

      {/* Expanded Player Modal — Spotify style */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-[#0a0f1c] flex flex-col" onClick={(e) => { if (e.target === e.currentTarget) setIsExpanded(false); }}>
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-5">
            <button onClick={() => setIsExpanded(false)} className="text-white hover:scale-110 transition-transform">
              <ChevronDown className="w-7 h-7" />
            </button>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#8b97ad]">Now Playing</p>
            <div className="w-7" />
          </div>

          <div className="flex-1 flex overflow-hidden px-8 pb-8">
            {/* Left: Album art + controls */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <img
                src={currentTrack.thumbnail || artistThumbnail || '/hero.png'}
                alt={artistName}
                className="w-72 h-72 rounded-lg shadow-2xl object-cover mb-8"
              />
              <div className="w-full max-w-md">
                <h2 className="text-2xl font-black text-white">{currentTrack.title}</h2>
                <p className="text-[#8b97ad] text-base mt-1">{currentTrack.artist || artistName}</p>

                {/* Progress */}
                <div className="mt-6">
                  <div
                    onClick={handleSeek}
                    className="h-1 bg-[#243049] rounded-full cursor-pointer group relative mb-1"
                  >
                    <div
                      className="h-full bg-white group-hover:bg-[#3b82f6] rounded-full transition-colors"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-[#8b97ad] font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-6 mt-4">
                  <button onClick={prevTrack} className="text-white transition-transform hover:scale-110"><SkipBack className="w-6 h-6" /></button>
                  <button
                    onClick={togglePlay}
                    className="w-14 h-14 rounded-full bg-white hover:scale-105 flex items-center justify-center transition-transform"
                  >
                    {isPlaying ? <Pause className="w-6 h-6 text-black fill-current" /> : <Play className="w-6 h-6 text-black fill-current ml-1" />}
                  </button>
                  <button onClick={nextTrack} className="text-white transition-transform hover:scale-110"><SkipForward className="w-6 h-6" /></button>
                </div>
              </div>
            </div>

            {/* Right: Track list */}
            <div className="w-96 bg-[#121826] rounded-lg ml-8 overflow-y-auto">
              <div className="px-6 py-4 border-b border-[#1a2235]">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#8b97ad]">{tracks.length} Tracks</p>
              </div>
              {tracks.map((track, i) => (
                <button
                  key={track.video_id || i}
                  onClick={() => selectTrack(i)}
                  className={`w-full flex items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-[#1a2235] ${i === currentTrackIndex ? 'bg-[#1a2235]' : ''}`}
                >
                  <span className={`w-6 text-center text-sm font-mono ${i === currentTrackIndex ? 'text-[#3b82f6]' : 'text-[#8b97ad]'}`}>
                    {i === currentTrackIndex && isPlaying ? (
                      <span className="flex items-center justify-center gap-0.5">
                        {[...Array(3)].map((_, j) => (
                          <span key={j} className="w-0.5 bg-[#3b82f6] animate-pulse" style={{ height: `${8 + j * 3}px`, animationDelay: `${j * 0.15}s` }} />
                        ))}
                      </span>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${i === currentTrackIndex ? 'text-[#3b82f6]' : 'text-white'}`}>{track.title}</p>
                    <p className="text-xs text-[#8b97ad] truncate">{track.artist || artistName}</p>
                  </div>
                  <span className="text-xs text-[#8b97ad] font-mono">{formatTime(track.duration)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
