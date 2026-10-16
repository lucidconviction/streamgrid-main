import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Radio,
  Tv,
  LayoutGrid,
  History,
  Bookmark,
  Flame,
  Play,
  Layers,
  Search,
  X,
  ChevronRight,
  Music,
} from 'lucide-react';
import { UserProfile } from '../types/stream';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  multiviewCount: number;
  activeProfile: UserProfile;
  onOpenProfileModal: () => void;
  onFilterCategory?: (category: string) => void;
  isOpen: boolean;
  onToggle: () => void;
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Explore', icon: Compass },
    { id: 'sports', label: 'Live Sports', icon: Radio },
    { id: 'channels', label: '24/7 Channels', icon: Tv },
    { id: 'iptv', label: 'IPTV Playlists', icon: Layers },
    { id: 'movies', label: 'Movies & TV', icon: Play },
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
        style={{ top: '65px', bottom: 0 }}
      >
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
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
          </div>
        </div>
      </aside>
    </>
  );
};