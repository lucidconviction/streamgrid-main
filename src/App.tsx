import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StreamItem,
  UserProfile,
  WatchHistoryEntry,
  MultiviewSlot,
  MultiviewLayout,
  MultiviewPreset,
} from './types/stream';
import { streamService, purgeExpiredScreenshots } from './services/streamService';
import { storageService } from './services/storageService';
import type { MusicTrack } from './services/musicService';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { HeroBanner } from './components/HeroBanner';
import { StreamCarousel } from './components/StreamCarousel';
import { PlayerView } from './components/PlayerView';
import { MultiviewGrid } from './components/MultiviewGrid';
import { WatchHistoryView } from './components/WatchHistoryView';
import { WatchlistView } from './components/WatchlistView';
import { ChannelDirectory } from './components/ChannelDirectory';
import { IptvDirectory } from './components/IptvDirectory';
import { SmuttDirectory } from './components/SmuttDirectory';

import { MusicDirectory } from './components/MusicDirectory';
import { ProfileModal } from './components/ProfileModal';
import { FloatingPipPlayer } from './components/FloatingPipPlayer';
import { FloatingMusicPlayer } from './components/FloatingMusicPlayer';
import { Toast, ToastMessage } from './components/Toast';
import { notificationService } from './services/notificationService';
import { RefreshCw, Radio, Tv, LayoutGrid, AlertCircle, Layers } from 'lucide-react';

export default function App() {
  // Navigation & View State
  const [currentView, setCurrentView] = useState<'home' | 'sports' | 'channels' | 'iptv' | 'smutt' | 'music' | 'multiview' | 'history' | 'watchlist' | 'player'>('home');
  const [activeStream, setActiveStream] = useState<StreamItem | null>(null);
  const [pipStream, setPipStream] = useState<StreamItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedSportCategory, setSelectedSportCategory] = useState<string>('All');

  // Streams Data
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [featuredStream, setFeaturedStream] = useState<StreamItem | null>(null);
  const [prevStream, setPrevStream] = useState<StreamItem | null>(null);
  const [nextStream, setNextStream] = useState<StreamItem | null>(null);
  const [smuttStreams, setSmuttStreams] = useState<StreamItem[]>([]);

  // IPTV streams — lazy loaded on demand (separate from main fetch)
  const [iptvStreams, setIptvStreams] = useState<StreamItem[]>([]);
  const [isLoadingIptv, setIsLoadingIptv] = useState(false);
  const iptvLoadedRef = useRef(false);

  // Profiles & User State
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserProfile>(storageService.getActiveProfile());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Profile-specific Watch History & Watchlist
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);
  const [presets, setPresets] = useState<MultiviewPreset[]>([]);

  // Multiview State
  const [multiviewLayout, setMultiviewLayout] = useState<MultiviewLayout>('quad');
  const [multiviewSlots, setMultiviewSlots] = useState<MultiviewSlot[]>([
    { slotId: 0, stream: null, isMuted: false, volume: 100 },
    { slotId: 1, stream: null, isMuted: true, volume: 100 },
    { slotId: 2, stream: null, isMuted: true, volume: 100 },
    { slotId: 3, stream: null, isMuted: true, volume: 100 },
    { slotId: 4, stream: null, isMuted: true, volume: 100 },
    { slotId: 5, stream: null, isMuted: true, volume: 100 },
  ]);

  // Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Music floating player state — persists across navigation
  const [musicFloatingArtist, setMusicFloatingArtist] = useState<{ name: string; thumbnail: string } | null>(null);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [musicIsLoadingTracks, setMusicIsLoadingTracks] = useState(false);

  const showToast = (
    text: string,
    type: 'success' | 'info' | 'warning' | 'live-alert' = 'info',
    extra?: Partial<ToastMessage>
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, text, type, ...extra }]);
    const duration = type === 'live-alert' ? 10000 : 4000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. Initial Load of Profiles & Preferences
  useEffect(() => {
    const loadedProfiles = storageService.getProfiles();
    setProfiles(loadedProfiles);
    const curr = storageService.getActiveProfile();
    setActiveProfile(curr);
    loadProfileData(curr.id);
    // Purge expired screenshot cache entries
    purgeExpiredScreenshots();
    const screenshotPurgeInterval = setInterval(purgeExpiredScreenshots, 10 * 60 * 1000); // every 10 min
    return () => clearInterval(screenshotPurgeInterval);
  }, []);

  // Load profile specific data
  const loadProfileData = (profileId: string) => {
    setWatchHistory(storageService.getHistory(profileId));
    setWatchlistIds(storageService.getWatchlist(profileId));
    setPresets(storageService.getPresets(profileId));
  };

  // 2. Fetch Streams from streamed.pk & bintvjson APIs
  const loadStreams = async (forceRefresh = false) => {
    if (forceRefresh) setIsRefreshing(true);
    else setIsLoadingStreams(true);

    try {
      const all = await streamService.fetchAllStreams(forceRefresh);
      setStreams(all);

      // Check watchlist stream transitions from offline/upcoming to live
      notificationService.detectWatchlistTransitions(watchlistIds, all, triggerLiveTransitionAlert);

      // Select high quality featured stream (Live match or prime channel)
      const popular = all.find((s) => s.popular && s.status === 'live') || all[0];
      setFeaturedStream(popular || null);

      // Automatically prepopulate multiview slots if currently empty
      setMultiviewSlots((prev) => {
        const hasAny = prev.some((s) => s.stream !== null);
        if (!hasAny && all.length >= 6) {
          const liveItems = all.filter((s) => s.status === 'live' || s.popular);
          return [
            { slotId: 0, stream: liveItems[0] || all[0], isMuted: false, volume: 100 },
            { slotId: 1, stream: liveItems[1] || all[1], isMuted: true, volume: 100 },
            { slotId: 2, stream: liveItems[2] || all[2], isMuted: true, volume: 100 },
            { slotId: 3, stream: liveItems[3] || all[3], isMuted: true, volume: 100 },
            { slotId: 4, stream: liveItems[4] || all[4], isMuted: true, volume: 100 },
            { slotId: 5, stream: liveItems[5] || all[5], isMuted: true, volume: 100 },
          ];
        }
        return prev;
      });

      // Update prev/next stream references when active stream changes
      if (activeStream) {
        const idx = all.findIndex((s) => s.id === activeStream.id);
        if (idx !== -1) {
          setPrevStream(idx > 0 ? all[idx - 1] : null);
          setNextStream(idx < all.length - 1 ? all[idx + 1] : null);
        }
      }
    } catch (err) {
      console.error('Failed to load streams', err);
      showToast('Error loading live streams. Using fallback cache.', 'warning');
    } finally {
      setIsLoadingStreams(false);
      setIsRefreshing(false);
    }
  };

  // Trigger alert when a stream in watchlist goes live
  const triggerLiveTransitionAlert = (stream: StreamItem) => {
    if (activeProfile.liveAlertsEnabled === false) return;

    // Play subtle synthesized audio chime
    if (activeProfile.soundAlertsEnabled !== false) {
      notificationService.playChime();
    }

    // Native browser notification
    notificationService.sendBrowserNotification(
      `🔴 NOW LIVE: ${stream.title}`,
      `A stream in your watchlist is now broadcasting live! Click to watch in cinema mode.`,
      stream.poster,
      () => handlePlayStream(stream)
    );

    // High visibility in-app toast alert
    showToast(
      `Your watchlist stream is now broadcasting live in high definition!`,
      'live-alert',
      {
        title: stream.title,
        streamId: stream.id,
        streamPoster: stream.poster,
        actionLabel: 'Watch Live Now',
        onAction: () => handlePlayStream(stream),
        secondaryActionLabel: '+ Multiview',
        onSecondaryAction: () => handleAddToMultiview(stream),
      }
    );
  };

  const handleSimulateLiveTransition = (stream: StreamItem) => {
    notificationService.simulateTransition(stream, 'offline', triggerLiveTransitionAlert);
  };

  // Track streams ref to avoid unnecessary re-renders
  const streamsRef = useRef<StreamItem[]>([]);
  const featuredRef = useRef<StreamItem | null>(null);
  const lastIdsRef = useRef<string>('');

  useEffect(() => {
    let mounted = true;
    let hasLoaded = false;

    const doLoad = async (force = false) => {
      if (!mounted) return;
      if (!hasLoaded) setIsLoadingStreams(true);

      const all = await streamService.fetchAllStreams(force);
      if (!mounted) return;

      // Only update state if data actually changed (stable IDs now)
      const count = all.length;
      const changed = count !== streamsRef.current.length || force;
      if (changed) {
        streamsRef.current = all;
        setStreams(all);
      }

      const popular = all.find((s) => s.popular && s.status === 'live') || all[0];
      if (popular?.id !== featuredRef.current?.id || force) {
        featuredRef.current = popular || null;
        setFeaturedStream(popular || null);
      }

      // Update prev/next if active stream is in the list
      if (activeStream) {
        const idx = all.findIndex((s) => s.id === activeStream.id);
        if (idx !== -1) {
          setPrevStream(idx > 0 ? all[idx - 1] : null);
          setNextStream(idx < all.length - 1 ? all[idx + 1] : null);
        }
      }

      // Check watchlist transitions
      notificationService.detectWatchlistTransitions(watchlistIds, all, triggerLiveTransitionAlert);

      hasLoaded = true;
      setIsLoadingStreams(false);
      setIsRefreshing(false);
    };

    doLoad();

    // Poll every 2 minutes for status changes (only updates when data differs)
    const pollInterval = setInterval(() => doLoad(false), 120000);
    return () => {
      mounted = false;
      clearInterval(pollInterval);
    };
  }, [watchlistIds, activeProfile.id]);

  // Lazy-load IPTV streams when navigating to the IPTV view
  useEffect(() => {
    if (currentView === 'iptv') {
      loadIptvStreams();
    }
  }, [currentView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Profile Switching
  const handleSelectProfile = (id: string) => {
    storageService.setActiveProfileId(id);
    const newProfile = profiles.find((p) => p.id === id) || profiles[0];
    setActiveProfile(newProfile);
    loadProfileData(newProfile.id);
  };

  const handleUpdateProfile = (updated: UserProfile) => {
    storageService.updateProfile(updated);
    setProfiles(storageService.getProfiles());
    if (updated.id === activeProfile.id) {
      setActiveProfile(updated);
    }
  };

  const handleCreateProfile = (data: Omit<UserProfile, 'id' | 'createdAt'>) => {
    const created = storageService.createProfile(data);
    setProfiles(storageService.getProfiles());
    setActiveProfile(created);
    loadProfileData(created.id);
  };

  const handleDeleteProfile = (id: string) => {
    storageService.deleteProfile(id);
    setProfiles(storageService.getProfiles());
    const next = storageService.getActiveProfile();
    setActiveProfile(next);
    loadProfileData(next.id);
  };

  // Play Stream Handler (also logs to Watch History)
  const handlePlayStream = (stream: StreamItem) => {
    setActiveStream(stream);
    setPipStream(null); // Dismiss PiP when entering full theater view
    setCurrentView('player');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Determine prev/next based on current view
    const allAvailable = currentView === 'smutt' ? smuttStreams : streams;
    const idx = allAvailable.findIndex((s) => s.id === stream.id);
    if (idx !== -1) {
      setPrevStream(idx > 0 ? allAvailable[idx - 1] : null);
      setNextStream(idx < allAvailable.length - 1 ? allAvailable[idx + 1] : null);
    }

    // Record into history
    const entry = storageService.addToHistory(activeProfile.id, {
      streamId: stream.id,
      title: stream.title,
      category: stream.category,
      poster: stream.poster,
      embedUrl: stream.directEmbedUrl || '',
      provider: stream.provider,
      progressPercent: Math.floor(Math.random() * 40) + 50,
      durationMinutes: Math.floor(Math.random() * 45) + 15,
    });
    setWatchHistory(storageService.getHistory(activeProfile.id));
  };

  // ── Lazy IPTV load — called when user navigates to IPTV view ─────────────────
  const loadIptvStreams = async () => {
    if (iptvLoadedRef.current || isLoadingIptv) return;
    iptvLoadedRef.current = true;
    setIsLoadingIptv(true);
    try {
      const data = await streamService.fetchIptvStreams();
      setIptvStreams(data);
    } catch (e) {
      console.warn('IPTV lazy load failed', e);
    } finally {
      setIsLoadingIptv(false);
    }
  };

  // Picture-in-Picture Toggle Handler
  const handleTogglePiP = () => {
    if (activeStream) {
      setPipStream(activeStream);
      setCurrentView('home');
      showToast(`Browsing in Picture-in-Picture: "${activeStream.title}"`, 'info');
    }
  };

  // Watchlist Toggle
  const handleToggleWatchlist = (stream: StreamItem) => {
    const added = storageService.toggleWatchlist(activeProfile.id, stream.id);
    setWatchlistIds(storageService.getWatchlist(activeProfile.id));
    showToast(
      added ? `Added "${stream.title}" to Watchlist` : `Removed "${stream.title}" from Watchlist`,
      'success'
    );
  };

  // Multiview Slot Management
  const handleAddToMultiview = (stream: StreamItem) => {
    // Check if already in multiview
    const alreadyIn = multiviewSlots.some((s) => s.stream?.id === stream.id);
    if (alreadyIn) {
      showToast(`"${stream.title}" is already in Multiview`, 'info');
      setCurrentView('multiview');
      return;
    }

    // Find first empty slot or replace slot with highest index
    setMultiviewSlots((prev) => {
      const emptyIdx = prev.findIndex((s) => s.stream === null);
      const targetIdx = emptyIdx !== -1 ? emptyIdx : 0;
      const updated = [...prev];
      updated[targetIdx] = {
        ...updated[targetIdx],
        stream,
        isMuted: targetIdx !== 0,
      };
      return updated;
    });

    showToast(`Added "${stream.title}" to Multiview`, 'success');
  };

  const handleUpdateSlotStream = (slotId: number, stream: StreamItem | null) => {
    setMultiviewSlots((prev) =>
      prev.map((s) => (s.slotId === slotId ? { ...s, stream } : s))
    );
  };

  const handleUpdateSlotBookmark = (slotId: number, bookmark: string) => {
    setMultiviewSlots((prev) =>
      prev.map((s) => (s.slotId === slotId ? { ...s, bookmark } : s))
    );
  };

  const handleSwapSlots = (slotA: number, slotB: number) => {
    setMultiviewSlots((prev) => {
      const itemA = prev.find((s) => s.slotId === slotA);
      const itemB = prev.find((s) => s.slotId === slotB);
      if (!itemA || !itemB) return prev;

      return prev.map((s) => {
        if (s.slotId === slotA) return { ...s, stream: itemB.stream };
        if (s.slotId === slotB) return { ...s, stream: itemA.stream };
        return s;
      });
    });
  };

  const handleClearSlot = (slotId: number) => {
    setMultiviewSlots((prev) =>
      prev.map((s) => (s.slotId === slotId ? { ...s, stream: null } : s))
    );
    showToast(`Cleared Screen ${slotId + 1}`, 'info');
  };

  const handleClearAllSlots = () => {
    setMultiviewSlots((prev) => prev.map((s) => ({ ...s, stream: null })));
    showToast('All multiview screens cleared', 'info');
  };

  // Multiview Presets
  const handleSavePreset = (name: string, layout: MultiviewLayout, streamIds: string[]) => {
    const saved = storageService.savePreset(activeProfile.id, {
      name,
      layout,
      streamIds,
    });
    setPresets(storageService.getPresets(activeProfile.id));
  };

  const handleApplyPreset = (preset: MultiviewPreset) => {
    setMultiviewLayout(preset.layout);
    const assignedSlots = [0, 1, 2, 3, 4, 5].map((slotId) => {
      const streamId = preset.streamIds[slotId];
      const match = streamId ? streams.find((s) => s.id === streamId) || null : null;
      return {
        slotId,
        stream: match,
        isMuted: slotId !== 0,
        volume: 100,
      };
    });
    setMultiviewSlots(assignedSlots);
    showToast(`Loaded preset "${preset.name}"`, 'success');
  };

  const handleDeletePreset = (presetId: string) => {
    storageService.deletePreset(activeProfile.id, presetId);
    setPresets(storageService.getPresets(activeProfile.id));
    showToast('Preset deleted', 'info');
  };

  // Watch History Actions
  const handleRemoveHistoryItem = (historyId: string) => {
    storageService.removeFromHistory(activeProfile.id, historyId);
    setWatchHistory(storageService.getHistory(activeProfile.id));
    showToast('Removed from watch history', 'info');
  };

  const handleClearAllHistory = () => {
    storageService.clearHistory(activeProfile.id);
    setWatchHistory([]);
    showToast('Watch history cleared', 'info');
  };

  const handlePlayHistoryItem = (entry: WatchHistoryEntry) => {
    const existing = streams.find((s) => s.id === entry.streamId);
    const itemToPlay: StreamItem = existing || {
      id: entry.streamId,
      title: entry.title,
      category: entry.category,
      poster: entry.poster,
      provider: (entry.provider as any) || 'streamed',
      directEmbedUrl: entry.embedUrl,
      status: 'live',
      popular: true,
    };
    handlePlayStream(itemToPlay);
  };

  // Filtered views
  const liveStreams = streams.filter((s) => s.status === 'live' || s.popular);
  const channels247 = streams.filter((s) => s.status === '24/7' || s.category.includes('24/7'));
  const basketballStreams = streams.filter((s) => s.category === 'Basketball');
  const footballStreams = streams.filter((s) => s.category === 'Football / Soccer');
  const motorsportStreams = streams.filter((s) => s.category.includes('Motorsport'));
  const combatStreams = streams.filter((s) => s.category.includes('Combat'));
  const golfStreams = streams.filter((s) => s.category === 'Golf');
  const entertainmentStreams = streams.filter(
    (s) => s.category === 'Entertainment & Movies' || s.category === 'News & Documentaries'
  );

  const activeMultiviewCount = multiviewSlots.filter((s) => s.stream !== null).length;
  const multiviewStreamIds = multiviewSlots
    .map((s) => s.stream?.id)
    .filter((id): id is string => Boolean(id));
  const watchlistStreams = streams.filter((s) => watchlistIds.includes(s.id));

  return (
    <div className={`min-h-screen bg-[#050810] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white ${sidebarOpen && 'sidebar-overlay-open'}`}>
      {/* Top Bar Header */}
      <Header
        onNavigate={(view) => {
          setCurrentView(view as any);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
        liveStreams={liveStreams}
        onPlayStream={handlePlayStream}
        currentPage={currentView}
      />

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex max-w-full">
        <Sidebar
          currentView={currentView}
          onNavigate={(view) => {
            setCurrentView(view as any);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          multiviewCount={activeMultiviewCount}
          activeProfile={activeProfile}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onFilterCategory={(cat) => setSelectedSportCategory(cat)}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Viewport Content */}
        <main className="flex-1 overflow-x-hidden min-h-[calc(100vh-var(--header-height,65px))] pb-16">
          {/* Active View Rendering */}
          {currentView === 'player' && activeStream ? (
            <PlayerView
              stream={activeStream}
              onClose={() => setCurrentView('home')}
              onPlayStream={handlePlayStream}
              onAddToMultiview={handleAddToMultiview}
              onToggleWatchlist={handleToggleWatchlist}
              isInWatchlist={watchlistIds.includes(activeStream.id)}
              isInMultiview={multiviewStreamIds.includes(activeStream.id)}
              relatedStreams={streams.filter((s) => s.id !== activeStream.id)}
              watchlistIds={watchlistIds}
              multiviewStreamIds={multiviewStreamIds}
              allStreams={streams}
              currentIndex={smuttStreams.length > 0
                ? smuttStreams.findIndex(s => s.id === activeStream.id)
                : streams.findIndex(s => s.id === activeStream.id)
              }
              onShowToast={showToast}
              onTogglePiP={handleTogglePiP}
              onVideoEnd={nextStream ? () => handlePlayStream(nextStream) : undefined}
            />
          ) : currentView === 'multiview' ? (
            <MultiviewGrid
              slots={multiviewSlots}
              layout={multiviewLayout}
              onLayoutChange={setMultiviewLayout}
              onUpdateSlotStream={handleUpdateSlotStream}
              onUpdateSlotBookmark={handleUpdateSlotBookmark}
              onSwapSlots={handleSwapSlots}
              onClearSlot={handleClearSlot}
              onClearAllSlots={handleClearAllSlots}
              allStreams={streams}
              presets={presets}
              onSavePreset={handleSavePreset}
              onApplyPreset={handleApplyPreset}
              onDeletePreset={handleDeletePreset}
              onShowToast={showToast}
            />
          ) : currentView === 'history' ? (
            <WatchHistoryView
              history={watchHistory}
              onPlayHistoryItem={handlePlayHistoryItem}
              onRemoveItem={handleRemoveHistoryItem}
              onClearAll={handleClearAllHistory}
              onNavigateHome={() => setCurrentView('home')}
            />
          ) : currentView === 'watchlist' ? (
            <WatchlistView
              watchlistStreams={watchlistStreams}
              onPlayStream={handlePlayStream}
              onAddToMultiview={handleAddToMultiview}
              onToggleWatchlist={handleToggleWatchlist}
              multiviewStreamIds={multiviewStreamIds}
              onNavigateHome={() => setCurrentView('home')}
              onSimulateLiveTransition={handleSimulateLiveTransition}
            />
          ) : currentView === 'sports' ? (
            <ChannelDirectory
              title="Live Sports Center"
              subtitle=""
              streams={streams.filter((s) => s.status !== '24/7' || s.category.includes('Sport'))}
              onPlayStream={handlePlayStream}
              onAddToMultiview={handleAddToMultiview}
              onToggleWatchlist={handleToggleWatchlist}
              watchlistIds={watchlistIds}
              multiviewStreamIds={multiviewStreamIds}
              initialCategory={selectedSportCategory}
              onRefresh={() => loadStreams(true)}
              isRefreshing={isRefreshing}
            />
          ) : currentView === 'channels' ? (
            <ChannelDirectory
              title="24/7 Cable & Premium TV Channels"
              subtitle="260+ nonstop cable networks including ESPN, HBO, Sky Sports, AMC, BBC, TNT, and news feeds."
              streams={channels247}
              onPlayStream={handlePlayStream}
              onAddToMultiview={handleAddToMultiview}
              onToggleWatchlist={handleToggleWatchlist}
              watchlistIds={watchlistIds}
              multiviewStreamIds={multiviewStreamIds}
              initialCategory="24/7 Channels"
              onRefresh={() => loadStreams(true)}
              isRefreshing={isRefreshing}
            />
          ) : currentView === 'smutt' ? (
            <SmuttDirectory
              onPlayStream={handlePlayStream}
              onAddToMultiview={handleAddToMultiview}
              onToggleWatchlist={handleToggleWatchlist}
              watchlistIds={watchlistIds}
              multiviewStreamIds={multiviewStreamIds}
              onSetStreams={setSmuttStreams}
            />
          ) : currentView === 'music' ? (
            <MusicDirectory
              onPlayStream={handlePlayStream}
              onAddToMultiview={handleAddToMultiview}
              onToggleWatchlist={handleToggleWatchlist}
              watchlistIds={watchlistIds}
              multiviewStreamIds={multiviewStreamIds}
              onSetFloatingArtist={setMusicFloatingArtist}
              onSetTracks={setMusicTracks}
              onSetLoadingTracks={setMusicIsLoadingTracks}
            />
          ) : currentView === 'iptv' ? (
            <IptvDirectory
              iptvStreams={iptvStreams}
              onPlayStream={handlePlayStream}
              onAddToMultiview={handleAddToMultiview}
              onToggleWatchlist={handleToggleWatchlist}
              watchlistIds={watchlistIds}
              multiviewStreamIds={multiviewStreamIds}
              onRefresh={() => loadStreams(true)}
              isRefreshing={isRefreshing}
            />
          ) : (
            /* Home / Explore View (Netflix & YouTube Hybrid) */
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-in fade-in duration-200">
                {/* Netflix Cinematic Hero Banner */}
              <HeroBanner
                featuredStream={featuredStream}
                onPlayStream={handlePlayStream}
                onAddToMultiview={handleAddToMultiview}
                onToggleWatchlist={handleToggleWatchlist}
                isInWatchlist={featuredStream ? watchlistIds.includes(featuredStream.id) : false}
                upcomingLiveEvents={liveStreams.slice(1, 6)}
                onSelectHeroStream={(stream) => setFeaturedStream(stream)}
              />

              {/* Multiview Quick Launcher Strip */}
              <div className="mb-8 p-5 rounded-xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-[#0f121a] border border-blue-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-lg bg-blue-600/25 border border-blue-500/50 flex items-center justify-center text-blue-300 shrink-0">
                    <LayoutGrid className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]">Multiview Screen Arena</h3>
                    <p className="text-sm text-slate-300 mt-0.5 font-medium">
                      Watch up to 4 live sports matches and TV channels simultaneously with individual audio soloing.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCurrentView('multiview')}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-600/40 whitespace-nowrap transition-transform hover:scale-105 active:scale-95"
                >
                  Open Multiview ({activeMultiviewCount} Screens Active)
                </button>
              </div>

              {/* Continue Watching / Recent History (if user has history) */}
              {watchHistory.length > 0 && (
                <div className="mb-10">
                  <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">
                      <span>Continue Watching ({activeProfile.name})</span>
                      <span className="text-sm font-mono text-slate-300 font-medium">
                        ({watchHistory.length})
                      </span>
                    </h2>
                    <button
                      onClick={() => setCurrentView('history')}
                      className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      View all history →
                    </button>
                  </div>

                  <div className="flex items-stretch gap-5 overflow-x-auto no-scrollbar py-2 px-1">
                    {watchHistory.slice(0, 6).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handlePlayHistoryItem(item)}
                        className="w-[240px] sm:w-[280px] md:w-[340px] shrink-0 bg-[#0f121a] border border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-blue-500/50 transition-all hover:-translate-y-1.5 group shadow-lg"
                      >
                        <div className="relative aspect-video w-full bg-slate-900">
                          <img
                            src={item.poster || '/src/assets/images/hero_championship_live_1792048678438.jpg'}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                '/src/assets/images/hero_championship_live_1792048678438.jpg';
                            }}
                          />
                          <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-800">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: `${item.progressPercent || 50}%` }}
                            />
                          </div>
                        </div>
                        <div className="p-4">
                          <p className="text-sm font-bold text-slate-100 truncate group-hover:text-blue-400 transition-colors">
                            {item.title}
                          </p>
                          <p className="text-xs text-slate-300 mt-0.5 font-medium">{item.category}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 1: Live Sports Matches */}
              <StreamCarousel
                title="Live Sports Broadcasts"
                subtitle="Live football, basketball, and world championships happening right now"
                streams={liveStreams}
                onPlayStream={handlePlayStream}
                onAddToMultiview={handleAddToMultiview}
                onToggleWatchlist={handleToggleWatchlist}
                watchlistIds={watchlistIds}
                multiviewStreamIds={multiviewStreamIds}
                onViewAll={() => setCurrentView('sports')}
              />

              {/* Row 2: 24/7 Cable & Entertainment Channels */}
              <StreamCarousel
                title="24/7 Premium Channels (ESPN, HBO, Sky, ABC)"
                subtitle="High-definition continuous network broadcasts and film cinema feeds"
                streams={channels247}
                onPlayStream={handlePlayStream}
                onAddToMultiview={handleAddToMultiview}
                onToggleWatchlist={handleToggleWatchlist}
                watchlistIds={watchlistIds}
                multiviewStreamIds={multiviewStreamIds}
                onViewAll={() => setCurrentView('channels')}
              />

              {/* Row 3: IPTV M3U Live Channels */}
              {iptvStreams.length > 0 ? (
                <StreamCarousel
                  title="IPTV Live M3U Channels (FAST, RDTV & Premium)"
                  subtitle="Samsung TV Plus, CloudFront HLS, US, UK, Canada & DAZN PPV feeds"
                  streams={iptvStreams}
                  onPlayStream={handlePlayStream}
                  onAddToMultiview={handleAddToMultiview}
                  onToggleWatchlist={handleToggleWatchlist}
                  watchlistIds={watchlistIds}
                  multiviewStreamIds={multiviewStreamIds}
                  onViewAll={() => setCurrentView('iptv')}
                />
              ) : (
                <div className="mb-8 rounded-xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-[#0f121a] border border-blue-800/30 p-6 text-center">
                  <Tv className="w-10 h-10 text-blue-400/60 mx-auto mb-3" />
                  <h2 className="text-xl font-bold text-white mb-1">17,000+ Live TV Channels</h2>
                  <p className="text-sm text-slate-400 mb-4">Samsung TV Plus, FAST, US/UK/Canada & premium feeds</p>
                  <button
                    onClick={loadIptvStreams}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-transform hover:scale-105 active:scale-95"
                  >
                    Load IPTV Channels
                  </button>
                </div>
              )}

              {/* Row 4: Basketball & NBA */}
              {basketballStreams.length > 0 && (
                <StreamCarousel
                  title="Basketball & NBA League Pass"
                  subtitle="Full court matchups and arena broadcasts"
                  streams={basketballStreams}
                  onPlayStream={handlePlayStream}
                  onAddToMultiview={handleAddToMultiview}
                  onToggleWatchlist={handleToggleWatchlist}
                  watchlistIds={watchlistIds}
                  multiviewStreamIds={multiviewStreamIds}
                />
              )}

              {/* Row 4: Football & Premier Soccer */}
              {footballStreams.length > 0 && (
                <StreamCarousel
                  title="Football & Premier League"
                  subtitle="Live European club matches and international tourneys"
                  streams={footballStreams}
                  onPlayStream={handlePlayStream}
                  onAddToMultiview={handleAddToMultiview}
                  onToggleWatchlist={handleToggleWatchlist}
                  watchlistIds={watchlistIds}
                  multiviewStreamIds={multiviewStreamIds}
                />
              )}

              {/* Row 5: Motorsport / F1 & Combat */}
              {(motorsportStreams.length > 0 || combatStreams.length > 0) && (
                <StreamCarousel
                  title="High Octane: Motorsport & Combat"
                  subtitle="Formula 1, NASCAR, UFC and boxing events"
                  streams={[...motorsportStreams, ...combatStreams]}
                  onPlayStream={handlePlayStream}
                  onAddToMultiview={handleAddToMultiview}
                  onToggleWatchlist={handleToggleWatchlist}
                  watchlistIds={watchlistIds}
                  multiviewStreamIds={multiviewStreamIds}
                />
              )}

              {/* Row 6: Golf & Tennis Classics */}
              {(golfStreams.length > 0 || entertainmentStreams.length > 0) && (
                <StreamCarousel
                  title="Entertainment, Movies & Golf Tour"
                  subtitle="Cinema releases, documentary streams, and PGA tour events"
                  streams={[...golfStreams, ...entertainmentStreams]}
                  onPlayStream={handlePlayStream}
                  onAddToMultiview={handleAddToMultiview}
                  onToggleWatchlist={handleToggleWatchlist}
                  watchlistIds={watchlistIds}
                  multiviewStreamIds={multiviewStreamIds}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Profile Management Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profiles={profiles}
        activeProfile={activeProfile}
        onSelectProfile={handleSelectProfile}
        onUpdateProfile={handleUpdateProfile}
        onCreateProfile={handleCreateProfile}
        onDeleteProfile={handleDeleteProfile}
        onShowToast={showToast}
      />

      {/* Floating Picture-in-Picture Mini-Player (when browsing other pages) */}
      {pipStream && currentView !== 'player' && (
        <FloatingPipPlayer
          stream={pipStream}
          embedUrl={pipStream.directEmbedUrl || ''}
          onExpandToFullPlayer={() => {
            setActiveStream(pipStream);
            setPipStream(null);
            setCurrentView('player');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onClose={() => setPipStream(null)}
        />
      )}

      {/* Floating Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Floating Music Player — persists across all views */}
      {musicFloatingArtist && musicTracks.length > 0 && (
        <FloatingMusicPlayer
          artistName={musicFloatingArtist.name}
          artistThumbnail={musicFloatingArtist.thumbnail}
          tracks={musicTracks}
          onClose={() => { setMusicFloatingArtist(null); setMusicTracks([]); }}
        />
      )}
    </div>
  );
}
