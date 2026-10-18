import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Radio,
  Tv,
  LayoutGrid,
  History,
  Bookmark,
  Flame,
  Layers,
  Search,
  X,
  ChevronRight,
  Music,
  Plus,
  Trash2,
  Edit3,
  Settings2,
} from 'lucide-react';
import { UserProfile } from '../types/stream';
import { storageService } from '../services/storageService';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  multiviewCount: number;
  activeProfile: UserProfile;
  onOpenProfileModal: () => void;
  onFilterCategory?: (category: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onSearch?: (query: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  multiviewCount,
  activeProfile,
  onOpenProfileModal,
  onFilterCategory,
  isOpen,
  onToggle,
  onSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Quick jump state
  const [quickJumps, setQuickJumps] = useState<
    Array<{ id: string; label: string; keywords: string[]; targetView: string }>
  >([]);
  const [showQuickJumpEditor, setShowQuickJumpEditor] = useState(false);
  const [qjEditId, setQjEditId] = useState<string | null>(null);
  const [qjLabel, setQjLabel] = useState('');
  const [qjKeywords, setQjKeywords] = useState('');
  const [qjTarget, setQjTarget] = useState(currentView);
  const [isAdding, setIsAdding] = useState(false);
  const profileId = activeProfile.id;

  const VIEW_LABELS: Record<string, string> = {
    home: 'Explore',
    sports: 'Live Sports',
    channels: '24/7 Channels',
    iptv: 'IPTV Playlists',
    music: 'Music',
    multiview: 'Multiview',
    history: 'Watch History',
    watchlist: 'Watchlist',
    smutt: 'Nett Smutt',
  };

  const navItems = [
    { id: 'home', label: 'Explore', icon: Compass },
    { id: 'sports', label: 'Live Sports', icon: Radio },
    { id: 'channels', label: '24/7 Channels', icon: Tv },
    { id: 'iptv', label: 'IPTV Playlists', icon: Layers },
    { id: 'music', label: 'Music', icon: Music },
    { id: 'history', label: 'Watch History', icon: History },
    { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
    { id: 'multiview', label: 'Multiview Grid', icon: LayoutGrid, count: multiviewCount },
    { id: 'smutt', label: 'Nett Smutt', icon: Flame },
  ];

  const sportsShortcuts = [
    { label: 'Basketball', category: 'Basketball' },
    { label: 'Football / Soccer', category: 'Football / Soccer' },
    { label: 'Motorsport / F1', category: 'Motorsport / F1' },
    { label: 'Combat / MMA', category: 'Combat / MMA' },
    { label: 'Tennis', category: 'Tennis' },
    { label: 'Golf', category: 'Golf' },
  ];

  // Load quick jumps on mount and when profile changes
  useEffect(() => {
    setQuickJumps(storageService.getQuickJumps(profileId));
  }, [profileId]);

  const handleNavigateAndSearch = (keywords: string[], targetView: string) => {
    if (targetView && targetView !== currentView) {
      onNavigate(targetView);
    }
    if (onSearch) {
      // Split comma-separated keywords and search each
      const allQueries = keywords.flatMap((kw) =>
        kw.split(',').map((k) => k.trim()).filter(Boolean)
      );
      if (allQueries.length === 1) {
        onSearch(allQueries[0]);
      } else {
        // For multi-keyword, search the combined query
        onSearch(allQueries.join(', '));
      }
    }
    if (window.innerWidth < 1024) onToggle();
  };

  const startAdd = () => {
    setQjEditId(null);
    setQjLabel('');
    setQjKeywords('');
    setQjTarget(currentView);
    setIsAdding(true);
  };

  const startEdit = (jump: { id: string; label: string; keywords: string[]; targetView: string }) => {
    setQjEditId(jump.id);
    setQjLabel(jump.label);
    setQjKeywords(jump.keywords.join(', '));
    setQjTarget(jump.targetView);
    setIsAdding(true);
  };

  const saveJump = () => {
    const label = qjLabel.trim();
    const kws = qjKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (!label || kws.length === 0) return;
    if (qjEditId) {
      storageService.editQuickJump(profileId, qjEditId, label, kws, qjTarget);
    } else {
      storageService.addQuickJump(profileId, label, kws, qjTarget);
    }
    setQuickJumps(storageService.getQuickJumps(profileId));
    setIsAdding(false);
    setShowQuickJumpEditor(false);
  };

  const deleteJump = (id: string) => {
    storageService.removeQuickJump(profileId, id);
    setQuickJumps(storageService.getQuickJumps(profileId));
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setShowQuickJumpEditor(false);
  };

  return (
    <>
      {/* Sidebar Overlay (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static left-0 z-40 flex flex-col glass-panel border-r border-blue-500/20 transition-all duration-300 ${
          isOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:border-0 lg:overflow-hidden'
        }`}
        style={{ top: 'var(--header-height, 65px)', bottom: 0 }}
      >
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 lg:h-[calc(100vh-var(--header-height,65px))]">
          {/* Search Bar */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              {isSearchOpen ? (
                <div className="flex items-center bg-slate-900 border border-blue-500/40 rounded-lg px-3 py-2 gap-2">
                  <Search className="w-4 h-4 text-blue-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search all streams..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => {
                      if (!searchQuery) setIsSearchOpen(false);
                    }}
                    autoFocus
                    className="bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none flex-1"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="w-full flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:border-blue-500/50 hover:text-slate-200 transition-colors"
                >
                  <Search className="w-4 h-4 shrink-0" />
                  <span>Search streams...</span>
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Nav */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1" style={{ minHeight: 0 }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    if (window.innerWidth < 1024) onToggle();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-300 border border-blue-500/40 neon-border-blue'
                      : 'text-slate-200 hover:text-white hover:bg-blue-500/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-300' : 'text-slate-300'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white font-bold">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Profile Card — moved up under navigation */}
            <div className="pt-3 mt-3 border-t border-slate-800/80">
              <button
                onClick={() => {
                  onOpenProfileModal();
                  if (window.innerWidth < 1024) onToggle();
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all text-left group"
              >
                <img
                  src={activeProfile.avatar}
                  alt={activeProfile.name}
                  className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/10 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-100 group-hover:text-blue-300 truncate transition-colors">
                    {activeProfile.name}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">Preferences &amp; History</p>
                </div>
              </button>
            </div>

            {/* Categories */}
            <div className="pt-3 mt-3 border-t border-slate-800/80">
              <p className="px-3 text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-2">
                Quick Jump
              </p>
              <div className="space-y-0.5">
                {sportsShortcuts.map((sp) => (
                  <button
                    key={sp.category}
                    onClick={() => {
                      if (onFilterCategory) onFilterCategory(sp.category);
                      onNavigate('sports');
                      if (window.innerWidth < 1024) onToggle();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-blue-500/10 rounded-lg transition-colors group font-medium"
                  >
                    <span className="group-hover:translate-x-0.5 transition-transform">{sp.label}</span>
                    <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Quick Jumps */}
            <div className="pt-2 mt-2 border-t border-slate-800/60">
              <div className="flex items-center justify-between px-3 mb-1.5">
                <p className="text-[11px] font-mono uppercase tracking-wider text-blue-400">
                  Saved Jumps
                </p>
                <button
                  onClick={startAdd}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
                  title="Add quick jump"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </div>
              <div className="space-y-0.5 px-1">
                {quickJumps.length === 0 ? (
                  <p className="px-3 py-1.5 text-[11px] text-slate-600 italic">
                    No saved jumps yet — tap Add to create one
                  </p>
                ) : (
                  quickJumps.map((jump) => (
                    <div key={jump.id} className="group flex items-center gap-1">
                      <button
                        onClick={() => handleNavigateAndSearch(jump.keywords, jump.targetView)}
                        className="flex-1 flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-300 hover:text-white hover:bg-blue-500/10 rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-blue-400 shrink-0" />
                        <span className="truncate font-medium">{jump.label}</span>
                      </button>
                      <button
                        onClick={() => startEdit(jump)}
                        className="p-1 text-slate-600 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Edit"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteJump(jump.id)}
                        className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Jump Editor Modal */}
            {isAdding && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-[#12151e] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                    <p className="text-sm font-bold text-white">
                      {qjEditId ? 'Edit Quick Jump' : 'Add Quick Jump'}
                    </p>
                    <button onClick={cancelAdd} className="text-slate-500 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 block">
                        Label
                      </label>
                      <input
                        type="text"
                        value={qjLabel}
                        onChange={(e) => setQjLabel(e.target.value)}
                        placeholder="e.g. My Artists"
                        autoFocus
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 block">
                        Keywords (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={qjKeywords}
                        onChange={(e) => setQjKeywords(e.target.value)}
                        placeholder="e.g. Drake, Taylor Swift, The Weeknd"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60"
                      />
                      <p className="text-[10px] text-slate-600 mt-1">
                        Multiple keywords will all be searched when tapped
                      </p>
                    </div>
                    <div>
                      <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 block">
                        Target View
                      </label>
                      <select
                        value={qjTarget}
                        onChange={(e) => setQjTarget(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/60 appearance-none"
                      >
                        {Object.entries(VIEW_LABELS).map(([id, label]) => (
                          <option key={id} value={id}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button
                      onClick={cancelAdd}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveJump}
                      disabled={!qjLabel.trim() || !qjKeywords.trim()}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};