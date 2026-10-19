import { UserProfile, WatchHistoryEntry, MultiviewPreset } from '../types/stream';

const PROFILES_KEY = 'streamgrid_profiles';
const ACTIVE_PROFILE_KEY = 'streamgrid_active_profile_id';
const HISTORY_PREFIX = 'streamgrid_history_';
const WATCHLIST_PREFIX = 'streamgrid_watchlist_';
const SAVED_CHANNELS_PREFIX = 'streamgrid_saved_channels_';
const PRESETS_PREFIX = 'streamgrid_presets_';
const SEARCH_PREFIX = 'streamgrid_saved_searches_';
const QUICKJUMP_PREFIX = 'streamgrid_quickjumps_';
const STREAMREMINDER_PREFIX = 'streamgrid_streamreminders_';

export const DEFAULT_PROFILES: UserProfile[] = [
  {
    id: 'profile-alex',
    name: 'Alex Rivera',
    avatar: '/src/assets/images/avatar_alex_streamer_1792048676766.jpg',
    bio: 'Esports, Basketball & Premier League aficionado',
    favoriteCategories: ['Basketball', 'Football', 'Esports'],
    autoplay: true,
    defaultQuality: 'hd',
    theme: 'midnight',
    createdAt: Date.now() - 86400000 * 12,
  },
  {
    id: 'profile-sarah',
    name: 'Sarah Chen',
    avatar: '/src/assets/images/avatar_sarah_cinema_1792048677170.jpg',
    bio: 'Cinema classics, 24/7 HBO & documentary streams',
    favoriteCategories: ['24/7 Channels', 'Entertainment', 'Tennis'],
    autoplay: true,
    defaultQuality: 'hd',
    theme: 'oled',
    createdAt: Date.now() - 86400000 * 9,
  },
  {
    id: 'profile-marcus',
    name: 'Marcus Vance',
    avatar: '/src/assets/images/avatar_marcus_sports_1792048677879.jpg',
    bio: 'Quad-screen live sports fanatic (NFL, NBA, F1)',
    favoriteCategories: ['Football', 'Motorsport', 'Combat'],
    autoplay: true,
    defaultQuality: 'hd',
    theme: 'cyber',
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'profile-elena',
    name: 'Elena Rostova',
    avatar: '/src/assets/images/avatar_elena_tech_1792048678974.jpg',
    bio: 'Live broadcast news, tech feeds & international sports',
    favoriteCategories: ['News', 'Golf', '24/7 Channels'],
    autoplay: false,
    defaultQuality: 'auto',
    theme: 'midnight',
    createdAt: Date.now() - 86400000 * 2,
  },
];

export const AVATAR_OPTIONS = [
  '/src/assets/images/avatar_alex_streamer_1792048676766.jpg',
  '/src/assets/images/avatar_sarah_cinema_1792048677170.jpg',
  '/src/assets/images/avatar_marcus_sports_1792048677879.jpg',
  '/src/assets/images/avatar_elena_tech_1792048678974.jpg',
];

export const storageService = {
  // Profiles
  getProfiles(): UserProfile[] {
    try {
      const data = localStorage.getItem(PROFILES_KEY);
      if (!data) {
        localStorage.setItem(PROFILES_KEY, JSON.stringify(DEFAULT_PROFILES));
        return DEFAULT_PROFILES;
      }
      return JSON.parse(data);
    } catch {
      return DEFAULT_PROFILES;
    }
  },

  saveProfiles(profiles: UserProfile[]) {
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    } catch (e) {
      console.error('Failed to save profiles to localStorage', e);
    }
  },

  getActiveProfileId(): string {
    try {
      return localStorage.getItem(ACTIVE_PROFILE_KEY) || DEFAULT_PROFILES[0].id;
    } catch {
      return DEFAULT_PROFILES[0].id;
    }
  },

  setActiveProfileId(id: string) {
    try {
      localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    } catch (e) {
      console.error('Failed to set active profile id', e);
    }
  },

  getActiveProfile(): UserProfile {
    const profiles = this.getProfiles();
    const activeId = this.getActiveProfileId();
    return profiles.find((p) => p.id === activeId) || profiles[0] || DEFAULT_PROFILES[0];
  },

  updateProfile(updated: UserProfile) {
    const profiles = this.getProfiles();
    const index = profiles.findIndex((p) => p.id === updated.id);
    if (index >= 0) {
      profiles[index] = updated;
    } else {
      profiles.push(updated);
    }
    this.saveProfiles(profiles);
  },

  createProfile(profile: Omit<UserProfile, 'id' | 'createdAt'>): UserProfile {
    const newProfile: UserProfile = {
      ...profile,
      id: `profile-${Date.now()}`,
      createdAt: Date.now(),
    };
    const profiles = this.getProfiles();
    profiles.push(newProfile);
    this.saveProfiles(profiles);
    this.setActiveProfileId(newProfile.id);
    return newProfile;
  },

  deleteProfile(id: string) {
    let profiles = this.getProfiles();
    if (profiles.length <= 1) return; // Prevent deleting the last profile
    profiles = profiles.filter((p) => p.id !== id);
    this.saveProfiles(profiles);
    if (this.getActiveProfileId() === id) {
      this.setActiveProfileId(profiles[0].id);
    }
  },

  // Watch History per Profile
  getHistory(profileId: string): WatchHistoryEntry[] {
    try {
      const data = localStorage.getItem(`${HISTORY_PREFIX}${profileId}`);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  addToHistory(profileId: string, entry: Omit<WatchHistoryEntry, 'id' | 'watchedAt'>): WatchHistoryEntry {
    const history = this.getHistory(profileId);
    // Remove if already in history to move to top
    const filtered = history.filter((h) => h.streamId !== entry.streamId);
    const newEntry: WatchHistoryEntry = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      watchedAt: Date.now(),
    };
    const updated = [newEntry, ...filtered].slice(0, 100); // keep up to 100 items
    try {
      localStorage.setItem(`${HISTORY_PREFIX}${profileId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to add to history', e);
    }
    return newEntry;
  },

  removeFromHistory(profileId: string, historyId: string) {
    const history = this.getHistory(profileId).filter((h) => h.id !== historyId);
    try {
      localStorage.setItem(`${HISTORY_PREFIX}${profileId}`, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to remove from history', e);
    }
  },

  clearHistory(profileId: string) {
    try {
      localStorage.removeItem(`${HISTORY_PREFIX}${profileId}`);
    } catch (e) {
      console.error('Failed to clear history', e);
    }
  },

  // Watchlist per Profile
  getWatchlist(profileId: string): string[] {
    try {
      const data = localStorage.getItem(`${WATCHLIST_PREFIX}${profileId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  toggleWatchlist(profileId: string, streamId: string): boolean {
    const list = this.getWatchlist(profileId);
    const exists = list.includes(streamId);
    const updated = exists ? list.filter((id) => id !== streamId) : [...list, streamId];
    try {
      localStorage.setItem(`${WATCHLIST_PREFIX}${profileId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to update watchlist', e);
    }
    return !exists;
  },

  isInWatchlist(profileId: string, streamId: string): boolean {
    return this.getWatchlist(profileId).includes(streamId);
  },

  // Saved Channels per Profile (YouTube handles, e.g. "@ufc")
  getSavedChannels(profileId: string): string[] {
    try {
      const data = localStorage.getItem(`${SAVED_CHANNELS_PREFIX}${profileId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  toggleSavedChannel(profileId: string, handle: string): boolean {
    const list = this.getSavedChannels(profileId);
    const exists = list.includes(handle);
    const updated = exists ? list.filter((h) => h !== handle) : [...list, handle];
    try {
      localStorage.setItem(`${SAVED_CHANNELS_PREFIX}${profileId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to update saved channels', e);
    }
    return !exists;
  },

  isSavedChannel(profileId: string, handle: string): boolean {
    return this.getSavedChannels(profileId).includes(handle);
  },

  // Multiview Presets per Profile
  getPresets(profileId: string): MultiviewPreset[] {
    try {
      const data = localStorage.getItem(`${PRESETS_PREFIX}${profileId}`);
      if (data) return JSON.parse(data);
      // Default presets
      const defaults: MultiviewPreset[] = [
        {
          id: 'preset-quad-sports',
          name: 'Quad Sports Arena',
          layout: 'quad',
          streamIds: ['ppv-sky-sports-golf', 'admin-tennis-channel'],
          createdAt: Date.now(),
        },
        {
          id: 'preset-dual-clash',
          name: 'Dual Match Focus',
          layout: 'dual',
          streamIds: ['ppv-sky-sports-golf'],
          createdAt: Date.now(),
        },
      ];
      localStorage.setItem(`${PRESETS_PREFIX}${profileId}`, JSON.stringify(defaults));
      return defaults;
    } catch {
      return [];
    }
  },

  savePreset(profileId: string, preset: Omit<MultiviewPreset, 'id' | 'createdAt'>): MultiviewPreset {
    const presets = this.getPresets(profileId);
    const newPreset: MultiviewPreset = {
      ...preset,
      id: `preset-${Date.now()}`,
      createdAt: Date.now(),
    };
    const updated = [newPreset, ...presets];
    try {
      localStorage.setItem(`${PRESETS_PREFIX}${profileId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save preset', e);
    }
    return newPreset;
  },

  deletePreset(profileId: string, presetId: string) {
    const updated = this.getPresets(profileId).filter((p) => p.id !== presetId);
    try {
      localStorage.setItem(`${PRESETS_PREFIX}${profileId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to delete preset', e);
    }
  },

  // Saved Searches per Profile
  getSavedSearches(profileId: string): string[] {
    try {
      const data = localStorage.getItem(`${SEARCH_PREFIX}${profileId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addSavedSearch(profileId: string, query: string): string[] {
    const trimmed = query.trim();
    if (!trimmed) return this.getSavedSearches(profileId);
    const searches = this.getSavedSearches(profileId)
      .filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
    const updated = [trimmed, ...searches].slice(0, 20);
    try {
      localStorage.setItem(`${SEARCH_PREFIX}${profileId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save search', e);
    }
    return updated;
  },

  removeSavedSearch(profileId: string, query: string) {
    const updated = this.getSavedSearches(profileId).filter(
      (s) => s.toLowerCase() !== query.toLowerCase()
    );
    try {
      localStorage.setItem(`${SEARCH_PREFIX}${profileId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to remove saved search', e);
    }
  },

  clearSavedSearches(profileId: string) {
    try {
      localStorage.removeItem(`${SEARCH_PREFIX}${profileId}`);
    } catch (e) {
      console.error('Failed to clear saved searches', e);
    }
  },

  // Quick Jump Links per Profile
  getQuickJumps(profileId: string): Array<{ id: string; label: string; keywords: string[]; targetView: string }> {
    try {
      const data = localStorage.getItem(`${QUICKJUMP_PREFIX}${profileId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addQuickJump(profileId: string, label: string, keywords: string[], targetView: string) {
    const trimmed = label.trim();
    if (!trimmed || keywords.length === 0) return this.getQuickJumps(profileId);
    const jumps = this.getQuickJumps(profileId);
    const updated = [{ id: `qj-${Date.now()}`, label: trimmed, keywords, targetView }, ...jumps].slice(0, 20);
    try {
      localStorage.setItem(`${QUICKJUMP_PREFIX}${profileId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save quick jump', e);
    }
    return updated;
  },

  removeQuickJump(profileId: string, id: string) {
    const updated = this.getQuickJumps(profileId).filter((j) => j.id !== id);
    try {
      localStorage.setItem(`${QUICKJUMP_PREFIX}${profileId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to remove quick jump', e);
    }
  },

  clearQuickJumps(profileId: string) {
    try {
      localStorage.removeItem(`${QUICKJUMP_PREFIX}${profileId}`);
    } catch (e) {
      console.error('Failed to clear quick jumps', e);
    }
  },

  editQuickJump(profileId: string, id: string, label: string, keywords: string[], targetView: string) {
    const jumps = this.getQuickJumps(profileId);
    const updated = jumps.map((j) =>
      j.id === id ? { ...j, label: label.trim(), keywords, targetView } : j
    ).filter((j) => j.label);
    try {
      localStorage.setItem(`${QUICKJUMP_PREFIX}${profileId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to edit quick jump', e);
    }
    return updated;
  },

  // ── Stream Reminders (upcoming YouTube streams) ────────────────────────
  getStreamReminders(profileId: string): string[] {
    try {
      const data = localStorage.getItem(`${STREAMREMINDER_PREFIX}${profileId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  toggleStreamReminder(profileId: string, streamId: string): string[] {
    const current = this.getStreamReminders(profileId);
    const updated = current.includes(streamId)
      ? current.filter((id) => id !== streamId)
      : [streamId, ...current].slice(0, 50);
    try {
      localStorage.setItem(`${STREAMREMINDER_PREFIX}${profileId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save stream reminders', e);
    }
    return updated;
  }
};
