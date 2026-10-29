import React, { useState, useMemo, useEffect, useRef } from "react";
import { VideoPlayer } from "./VideoPlayer";
import {
  Play, Pause, Volume2, VolumeX, Signal, Clock,
  ChevronLeft, ChevronRight, Radio, Search, Filter,
} from "lucide-react";
import type { StreamItem } from "../types/stream";

interface TVGridProps {
  streams: StreamItem[];
  onPlayStream: (stream: StreamItem) => void;
}

function statusColor(s: StreamItem): string {
  if (s.status === "live") return "bg-red-500";
  if (s.status === "upcoming") return "bg-amber-500";
  if (s.status === "24/7") return "bg-blue-500";
  return "bg-slate-600";
}

function buildChannelList(streams: StreamItem[]): Array<{ category: string; stream: StreamItem }> {
  const result: Array<{ category: string; stream: StreamItem }> = [];
  const usedIds = new Set<string>();
  for (const s of streams) {
    if (s.provider === "smutt") continue;
    if (usedIds.has(s.id)) continue;
    usedIds.add(s.id);
    result.push({ category: s.category || "Other", stream: s });
  }
  const priority: Record<string, number> = { live: 0, upcoming: 1, "24/7": 2, offline: 3 };
  result.sort((a, b) => {
    const pa = priority[a.stream.status ?? "offline"] ?? 3;
    const pb = priority[b.stream.status ?? "offline"] ?? 3;
    if (pa !== pb) return pa - pb;
    return a.category.localeCompare(b.category);
  });
  return result;
}

export const TVGrid: React.FC<TVGridProps> = ({ streams, onPlayStream }) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  React.useEffect(() => {
    console.log('[TVGrid] rendered with', streams.length, 'streams');
  }, [streams.length]);
  const [muted, setMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const allChannels = useMemo(() => buildChannelList(streams), [streams]);
  const categories = useMemo(() => {
    const cats = new Set(allChannels.map(c => c.category));
    return ["all", ...Array.from(cats).sort()];
  }, [allChannels]);

  const filteredChannels = useMemo(() => {
    let list = allChannels;
    if (activeTab !== "all") list = list.filter(c => c.category === activeTab);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.stream.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allChannels, activeTab, searchQuery]);

  useEffect(() => {
    if (selectedIdx >= filteredChannels.length && filteredChannels.length > 0) {
      setSelectedIdx(filteredChannels.length - 1);
    }
    if (selectedIdx < 0) setSelectedIdx(0);
  }, [filteredChannels.length, selectedIdx]);

  const selectedItem = filteredChannels[selectedIdx];
  const selectedStream = selectedItem?.stream;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(0, i - 1)); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(filteredChannels.length - 1, i + 1)); }
      else if (e.key === "Enter" && selectedStream) { console.log('[TVGrid] onPlayStream called with:', selectedStream?.title, selectedStream?.directEmbedUrl?.substring(0, 100));
              onPlayStream(selectedStream); }
      else if (e.key === "g" || e.key === "G") { setShowSchedule(v => !v); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredChannels.length, selectedStream, onPlayStream]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const target = el.children[selectedIdx] as HTMLElement;
    if (target) {
      const elRect = el.getBoundingClientRect();
      const itemRect = target.getBoundingClientRect();
      if (itemRect.bottom > elRect.bottom - 50) target.scrollIntoView({ block: "center", behavior: "smooth" });
      else if (itemRect.top < elRect.top + 50) target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [selectedIdx]);

  const liveCount = allChannels.filter(c => c.stream.status === "live").length;

  return (
    <div className="flex flex-1 h-full min-h-0 bg-[#050810] text-white overflow-hidden select-none">
      {/* ── LEFT PANEL: Channel List ── */}
      <div className="flex flex-col border-r border-white/10" style={{ width: 300, minWidth: 300 }}>
        {/* Top bar: Logo + Filters toggle */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-[#0a0f1e]">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center flex-shrink-0">
            <Radio className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-black tracking-[0.2em] text-white flex-1 truncate">TV GUIDE</span>
          <span className="text-[9px] text-slate-500 hidden sm:block">{allChannels.length} ch</span>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`p-1.5 rounded transition-colors ${showFilters ? "bg-red-600/30 text-red-400" : "text-slate-400 hover:text-white hover:bg-white/10"}`}
            title="Show filters"
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search + Tabs (collapsible) */}
        {showFilters && (
          <div className="px-3 py-2 border-b border-white/10 bg-[#0a0f1e] space-y-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
              <input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSelectedIdx(0); }}
                placeholder="Search channels..."
                className="w-full bg-white/5 border border-white/10 rounded-md pl-7 pr-2.5 py-1.5 text-[11px] text-white placeholder-slate-500 outline-none focus:border-white/25"
              />
            </div>
            {/* Category Tabs - horizontal scrollable */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap transition-colors ${
                    activeTab === cat ? "bg-red-600 text-white" : "bg-white/10 text-slate-400 hover:text-white hover:bg-white/20"
                  }`}
                >
                  {cat === "all" ? "ALL" : cat.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Channel List — fills remaining space, scrolls */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {filteredChannels.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-500">No channels found</div>
          )}
          {filteredChannels.map((item, idx) => {
            const s = item.stream;
            const isSel = idx === selectedIdx;
            const liveBadge = s.status === "live" || s.status === "24/7";
            return (
              <button
                key={s.id}
                onClick={() => {
                console.log('[TVGrid] Channel clicked:', item.stream.title, 'idx:', idx, 'selectedIdx before:', selectedIdx);
                setSelectedIdx(idx);
              }}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 border-l-2 transition-all ${
                  isSel ? "bg-red-600/20 border-l-red-500" : "border-l-transparent hover:bg-white/5"
                }`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor(s)} ${s.status === "live" ? "animate-pulse" : ""}`} />
                <div className="w-10 h-6 rounded bg-white/5 flex-shrink-0 overflow-hidden">
                  {s.poster ? (
                    <img src={s.poster} alt="" className="w-full h-full object-cover opacity-70" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-600">
                      {(s.title || "?")[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-medium truncate ${isSel ? "text-white" : "text-slate-300"}`}>{s.title}</p>
                  <p className="text-[9px] text-slate-500 truncate">
                    {s.provider === "iptv" ? "IPTV" : s.provider}
                    {s.viewers && ` · ${Math.round(s.viewers).toLocaleString()}`}
                  </p>
                </div>
                {liveBadge && (
                  <span className={`text-[8px] font-black px-1 py-0.5 rounded flex-shrink-0 ${
                    s.status === "live" ? "bg-red-600 text-white" : "bg-blue-600 text-white"
                  }`}>
                    {s.status === "24/7" ? "24/7" : "LIVE"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-white/10 bg-[#0a0f1e] text-[9px] text-slate-600 flex items-center gap-2">
          <span>↑↓ browse</span>
          <span className="text-slate-700">|</span>
          <span>↵ play</span>
          <span className="text-slate-700">|</span>
          <span>G schedule</span>
        </div>
      </div>

      {/* ── RIGHT PANEL: Player ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 bg-[#0a0f1e]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedStream ? statusColor(selectedStream) : "bg-slate-700"} ${selectedStream?.status === "live" ? "animate-pulse" : ""}`} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{selectedStream?.title ?? "Select a channel"}</p>
              <p className="text-[10px] text-slate-500">
                {selectedStream ? `${selectedStream.category} · ${selectedStream.provider}` : ""}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-slate-600">{liveCount} live now</span>
            <button
              onClick={() => setShowSchedule(v => !v)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${showSchedule ? "bg-red-600 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20"}`}
            >
              ⏱ Schedule
            </button>
          </div>
        </div>

        {/* Video player — fills all remaining height */}
        <div className="flex-1 relative bg-black min-h-0 overflow-hidden">
          {selectedStream ? (
            <>
              <VideoPlayer
                url={selectedStream.directEmbedUrl || selectedStream.streams?.[0]?.embedUrl || ""}
                title={selectedStream.title}
                streamType={selectedStream.streamType}
                autoPlay={true}
                className="absolute inset-0 w-full h-full"
                key={selectedStream.id}
              />
              {/* Overlay controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-16">
                <div className="mb-2">
                  <p className="text-sm font-bold text-white drop-shadow">{selectedStream.title}</p>
                  {selectedStream.viewers && (
                    <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1">
                      <Signal className="w-3 h-3 text-red-500" />
                      {Math.round(selectedStream.viewers).toLocaleString()} watching
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsPlaying(p => !p)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setMuted(v => !v)} className="text-slate-300 hover:text-white transition-colors">
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => setSelectedIdx(i => Math.max(0, i - 1))} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setSelectedIdx(i => Math.min(filteredChannels.length - 1, i + 1))} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <Radio className="w-16 h-16 text-slate-700 mb-4" />
              <p className="text-slate-400 text-sm font-medium">Select a channel to watch</p>
              <p className="text-slate-600 text-xs mt-1">↑ ↓ browse · Enter to play</p>
            </div>
          )}
        </div>

        {/* Schedule panel (slides in from bottom, doesn't steal player height) */}
        {showSchedule && allChannels.length > 0 && (
          <div className="border-t border-white/10 bg-[#0a0f1e] px-4 py-2 max-h-32 overflow-y-auto">
            <div className="flex items-center gap-2 mb-1.5">
              <Clock className="w-3 h-3 text-slate-400" />
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Live Now</span>
              <span className="ml-auto text-[9px] text-slate-600">{allChannels.filter(c => c.stream.status === "live").length} live</span>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {allChannels.filter(c => c.stream.status === "live").slice(0, 8).map(c => {
                const idx = filteredChannels.findIndex(x => x.stream.id === c.stream.id);
                return (
                  <button key={c.stream.id} onClick={() => setSelectedIdx(idx >= 0 ? idx : 0)}
                    className={`flex-shrink-0 w-32 rounded-lg overflow-hidden border-2 transition-all ${
                      c.stream.id === selectedStream?.id ? "border-red-500" : "border-transparent hover:border-white/20"
                    }`}>
                    <div className="relative aspect-video">
                      <img src={c.stream.poster || ""} alt="" className="w-full h-full object-cover opacity-60" loading="lazy" />
                      <div className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded bg-red-600 text-[7px] font-black flex items-center gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> LIVE
                      </div>
                    </div>
                    <div className="px-1.5 py-1 bg-[#111827]">
                      <p className="text-[9px] font-medium text-white truncate">{c.stream.title}</p>
                      <p className="text-[8px] text-slate-500">{c.category}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
