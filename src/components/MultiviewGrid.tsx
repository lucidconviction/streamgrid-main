import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Trash2,
  Plus,
  Search,
  X,
  Save,
  ArrowRightLeft,
  Bookmark,
  ChevronDown,
  Check,
  LayoutGrid,
} from 'lucide-react';
import { StreamItem, MultiviewSlot, MultiviewLayout, MultiviewPreset } from '../types/stream';
import { VideoPlayer } from './VideoPlayer';

const LAYOUT_OPTIONS: { id: MultiviewLayout; label: string }[] = [
  { id: 'single', label: '1 Focus' },
  { id: 'dual', label: '2 Dual' },
  { id: 'triple', label: '3 Triple' },
  { id: 'quad', label: '4 Quad' },
  { id: 'big-center', label: '5 Big Center' },
  { id: 'focus-5', label: '5 Focus' },
  { id: 'six-wide', label: '6 Wide' },
  { id: 'six-tall', label: '6 Tall' },
];

interface MultiviewGridProps {
  slots: MultiviewSlot[];
  layout: MultiviewLayout;
  onLayoutChange: (layout: MultiviewLayout) => void;
  onUpdateSlotStream: (slotId: number, stream: StreamItem | null) => void;
  onUpdateSlotBookmark: (slotId: number, bookmark: string) => void;
  onSwapSlots: (slotA: number, slotB: number) => void;
  onClearSlot: (slotId: number) => void;
  onClearAllSlots: () => void;
  allStreams: StreamItem[];
  presets: MultiviewPreset[];
  onSavePreset: (name: string, layout: MultiviewLayout, streamIds: string[]) => void;
  onApplyPreset: (preset: MultiviewPreset) => void;
  onDeletePreset: (presetId: string) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

export const MultiviewGrid: React.FC<MultiviewGridProps> = ({
  slots,
  layout,
  onLayoutChange,
  onUpdateSlotStream,
  onUpdateSlotBookmark,
  onSwapSlots,
  onClearSlot,
  onClearAllSlots,
  allStreams,
  presets,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  onShowToast,
}) => {
  const [pickerModalSlotId, setPickerModalSlotId] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState('All');
  const [soloSlotId, setSoloSlotId] = useState<number | null>(0);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [swapSourceSlot, setSwapSourceSlot] = useState<number | null>(null);
  const [isGridFullscreen, setIsGridFullscreen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<number | null>(null);
  const [bookmarkInput, setBookmarkInput] = useState('');
  const [fullscreenSlotId, setFullscreenSlotId] = useState<number | null>(null);
  const [layoutDropdownOpen, setLayoutDropdownOpen] = useState(false);
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const layoutDropdownRef = useRef<HTMLDivElement>(null);
  const presetDropdownRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = React.useRef<HTMLDivElement>(null);

  // True browser fullscreen handling
  const enterBrowserFullscreen = useCallback(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    el.requestFullscreen?.().catch(() => {});
  }, []);

  const exitBrowserFullscreen = useCallback(() => {
    document.exitFullscreen?.().catch(() => {});
  }, []);

  // Keep React state synced with actual browser fullscreen state (handles ESC key)
  useEffect(() => {
    const handleChange = () => {
      const isInFullscreen = !!document.fullscreenElement;
      setIsGridFullscreen(isInFullscreen);
      // If browser exits fullscreen (e.g. ESC), also exit any slot fullscreen
      if (!isInFullscreen && fullscreenSlotId !== null) {
        setFullscreenSlotId(null);
      }
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, [fullscreenSlotId]);

  useEffect(() => {
    if (!isGridFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitBrowserFullscreen();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isGridFullscreen, exitBrowserFullscreen]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (layoutDropdownRef.current && !layoutDropdownRef.current.contains(e.target as Node)) {
        setLayoutDropdownOpen(false);
      }
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target as Node)) {
        setPresetDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Determine active slots count based on layout
  const getMaxSlotsForLayout = (l: MultiviewLayout): number => {
    if (l === 'single') return 1;
    if (l === 'dual') return 2;
    if (l === 'triple') return 3;
    if (l === 'quad') return 4;
    return 6; // six, six-wide, six-tall, focus-5, big-center all use 6
  };

  const maxSlots = getMaxSlotsForLayout(layout);
  const activeSlots = slots.slice(0, maxSlots);

  // Refs so the single global listener always reads current state — no re-subscribe storms
  const isGridFullscreenRef = React.useRef(isGridFullscreen);
  const pickerModalSlotIdRef = React.useRef(pickerModalSlotId);
  const savePresetOpenRef = React.useRef(savePresetOpen);

  React.useEffect(() => { isGridFullscreenRef.current = isGridFullscreen; }, [isGridFullscreen]);
  React.useEffect(() => { pickerModalSlotIdRef.current = pickerModalSlotId; }, [pickerModalSlotId]);
  React.useEffect(() => { savePresetOpenRef.current = savePresetOpen; }, [savePresetOpen]);

  // Single global keyboard shortcut listener — stable, never re-subscribes
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block when a modal/picker or save-preset dialog is open
      if (pickerModalSlotIdRef.current !== null || savePresetOpenRef.current) return;
      // Block while typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        const entering = !isGridFullscreenRef.current;
        if (entering) {
          setIsGridFullscreen(true);
          setTimeout(enterBrowserFullscreen, 50);
        } else {
          setIsGridFullscreen(false);
          exitBrowserFullscreen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enterBrowserFullscreen, exitBrowserFullscreen, onShowToast]); // stable deps only

  const handleToggleSoloAudio = (slotId: number) => {
    if (soloSlotId === slotId) {
      setSoloSlotId(null);
      onShowToast(`All slots muted`, 'info');
    } else {
      setSoloSlotId(slotId);
      const title = slots.find((s) => s.slotId === slotId)?.stream?.title || `Screen ${slotId + 1}`;
      onShowToast(`Audio switched to Screen ${slotId + 1} (${title})`, 'success');
    }
  };

  const handleSavePresetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    const streamIds = activeSlots
      .map((s) => s.stream?.id)
      .filter((id): id is string => Boolean(id));
    if (streamIds.length === 0) {
      onShowToast('Assign at least one stream to save a preset', 'warning');
      return;
    }
    onSavePreset(newPresetName.trim(), layout, streamIds);
    setNewPresetName('');
    setSavePresetOpen(false);
    onShowToast(`Preset "${newPresetName}" saved!`, 'success');
  };

  const handlePickStream = (stream: StreamItem) => {
    if (pickerModalSlotId !== null) {
      onUpdateSlotStream(pickerModalSlotId, stream);
      onShowToast(`Assigned "${stream.title}" to Screen ${pickerModalSlotId + 1}`, 'success');
      setPickerModalSlotId(null);
      setPickerSearch('');
    }
  };

  const handleStartSwap = (slotId: number) => {
    if (swapSourceSlot === null) {
      setSwapSourceSlot(slotId);
      onShowToast(`Click another screen to swap with Screen ${slotId + 1}`, 'info');
    } else if (swapSourceSlot === slotId) {
      setSwapSourceSlot(null);
    } else {
      onSwapSlots(swapSourceSlot, slotId);
      onShowToast(`Swapped Screen ${swapSourceSlot + 1} with Screen ${slotId + 1}`, 'success');
      setSwapSourceSlot(null);
    }
  };

  const handleBookmark = (slotId: number) => {
    const slot = slots.find((s) => s.slotId === slotId);
    if (!slot) return;
    if (editingBookmark === slotId) {
      if (bookmarkInput.trim()) {
        onUpdateSlotBookmark(slotId, bookmarkInput.trim());
      }
      setEditingBookmark(null);
      setBookmarkInput('');
      return;
    }
    setEditingBookmark(slotId);
    setBookmarkInput(slot?.bookmark || '');
  };

  const getSlotLabel = (slot: MultiviewSlot): string => {
    return slot.bookmark || `Screen ${slot.slotId + 1}`;
  };

  const filteredPickerStreams = allStreams.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      s.category.toLowerCase().includes(pickerSearch.toLowerCase());
    const matchesCat = pickerCategory === 'All' || s.category === pickerCategory;
    return matchesSearch && matchesCat;
  });

  // Layout CSS classes
  const getLayoutGridClass = (l: MultiviewLayout): string => {
    switch (l) {
      case 'single': return 'grid-cols-1';
      case 'dual': return 'grid grid-cols-1 md:grid-cols-2';
      case 'triple': return 'grid grid-cols-1 md:grid-cols-3';
      case 'quad': return 'grid grid-cols-1 md:grid-cols-2';
      case 'six': return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      case 'six-wide': return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3';
      case 'six-tall': return 'grid grid-cols-1 md:grid-cols-2';
      case 'focus-5': return 'grid grid-cols-1 md:grid-cols-3';
      case 'big-center': return 'grid grid-cols-1 lg:grid-cols-3';
      default: return 'grid grid-cols-1 md:grid-cols-2';
    }
  };

  // Big center uses special span classes
  const getSlotSpanClass = (l: MultiviewLayout, slotId: number): string => {
    if (l === 'big-center') {
      if (slotId === 0) return 'lg:col-span-1 lg:row-span-1';
      if (slotId === 1) return 'lg:col-span-1 lg:row-span-2 lg:col-start-2 lg:row-start-1';
      if (slotId === 2) return 'lg:col-span-1 lg:row-span-1';
      return '';
    }
    return '';
  };

  return (
    <div className="w-full mx-auto px-2 sm:px-6 py-4 flex flex-col gap-4">
      {/* Multiview Workspace Command Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0f121a] p-3.5 rounded-xl border border-slate-800/80">
        {/* Layout Dropdown */}
        <div className="relative" ref={layoutDropdownRef}>
          <button
            onClick={() => setLayoutDropdownOpen(!layoutDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>{LAYOUT_OPTIONS.find((o) => o.id === layout)?.label || layout}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${layoutDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {layoutDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-40 bg-[#12151e] border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="p-1.5">
                {LAYOUT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { onLayoutChange(opt.id); setLayoutDropdownOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      layout === opt.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {layout === opt.id && <Check className="w-3.5 h-3.5" />}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Audio Solo Status & Global Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 px-3 py-1.5 bg-slate-900/80 rounded-lg border border-slate-800">
            <Volume2 className="w-3.5 h-3.5 text-blue-400" />
            <span>
              Audio:{' '}
              {soloSlotId !== null ? (
                <strong className="text-white">Screen {soloSlotId + 1}</strong>
              ) : (
                <span className="text-slate-500">Muted</span>
              )}
            </span>
          </div>

          <button
            onClick={() => handleToggleSoloAudio(soloSlotId === null ? 0 : soloSlotId)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-800 transition-colors"
          >
            {soloSlotId !== null ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{soloSlotId !== null ? 'Mute All' : 'Unmute'}</span>
          </button>

          {/* Preset Dropdown */}
          <div className="relative" ref={presetDropdownRef}>
            <button
              onClick={() => setPresetDropdownOpen(!presetDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Presets</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${presetDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {presetDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-[#12151e] border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-1.5 max-h-60 overflow-y-auto">
                  {presets.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500 text-center">No saved presets</div>
                  ) : (
                    presets.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { onApplyPreset(p); setPresetDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors truncate"
                      >
                        {p.name}
                      </button>
                    ))
                  )}
                  <div className="border-t border-slate-700 mt-1 pt-1">
                    <button
                      onClick={() => { setSavePresetOpen(true); setPresetDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-blue-400 hover:bg-blue-950/50 transition-colors"
                    >
                      + Save Current Layout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fullscreen Grid Toggle — browser fullscreen */}
          <button
            onClick={() => {
              if (!isGridFullscreen) {
                setIsGridFullscreen(true);
                setTimeout(enterBrowserFullscreen, 50);
              } else {
                setIsGridFullscreen(false);
                exitBrowserFullscreen();
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isGridFullscreen
                ? 'bg-blue-950/80 border-blue-700 text-blue-300'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title="Enter browser fullscreen (ESC to exit)"
          >
            {isGridFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-blue-400" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isGridFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

          <button
            onClick={onClearAllSlots}
            className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-900 rounded-lg transition-colors"
            title="Reset All Screens"
            aria-label="Clear all screens"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Layout Canvas — true fullscreen container */}
      {fullscreenSlotId === null && (
        <div
          ref={gridContainerRef}
          className={`w-full bg-black rounded-2xl transition-all duration-300 ${
            isGridFullscreen
              ? 'fixed inset-0 z-50 rounded-none'
              : 'relative min-h-[500px] sm:min-h-[600px] lg:min-h-[720px] border border-slate-800/80 p-2 sm:p-3'
          }`}
        >
        <div
          className={`w-full gap-1.5 ${
            isGridFullscreen ? 'p-1' : ''
          } ${getLayoutGridClass(layout)}`}
          style={{ height: isGridFullscreen ? '100dvh' : undefined }}
        >
          {activeSlots.map((slot) => {
            const isAudioActive = soloSlotId === slot.slotId;
            const isSwapSelected = swapSourceSlot === slot.slotId;
            const slotLabel = getSlotLabel(slot);

            // Resolve URL
            const embedUrl =
              slot.resolvedEmbedUrl ||
              slot.stream?.directEmbedUrl ||
              (slot.stream?.sources?.[0]
                ? `https://embed.st/embed/${slot.stream.sources[0].source}/${slot.stream.sources[0].id}/1`
                : 'https://bintv-sources.pages.dev/?id=aHR0cHM6Ly9laGdlbWJ4ZS5jZmQvYmludHYvc3BkOGdwb2gtNjU4Ng');

            // Height based on layout and fullscreen
            const isFullscreen = isGridFullscreen;
            const heightClass = isFullscreen
              ? 'h-full'
              : layout === 'single'
              ? 'h-[300px] sm:h-[400px] lg:h-[500px]'
              : layout === 'six' || layout === 'six-wide' || layout === 'big-center' || layout === 'focus-5'
              ? 'h-[150px] sm:h-[200px] md:h-[260px]'
              : 'h-[200px] sm:h-[260px] lg:h-[340px]';

            return (
              <div
                key={slot.slotId}
                className={`relative flex flex-col rounded-lg overflow-hidden bg-[#0c0e14] border transition-all duration-200 ${
                  isSwapSelected
                    ? 'border-amber-400 ring-2 ring-amber-400/30'
                    : isAudioActive
                    ? 'border-blue-500/80 shadow-lg shadow-blue-950/20'
                    : 'border-slate-800/70 hover:border-slate-700'
                } ${getSlotSpanClass(layout, slot.slotId)} ${heightClass}`}
              >
                {/* Slot Header Control Bar — hidden in fullscreen for cleaner look */}
                {!isFullscreen && (
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 text-xs z-20">
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <span className="font-mono font-bold text-slate-500 text-[10px] px-1.5 py-0.5 bg-black/60 rounded shrink-0">
                      S{slot.slotId + 1}
                    </span>
                    {editingBookmark === slot.slotId ? (
                      <input
                        type="text"
                        value={bookmarkInput}
                        onChange={(e) => setBookmarkInput(e.target.value)}
                        onBlur={() => {
                          handleBookmark(slot.slotId);
                          setEditingBookmark(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleBookmark(slot.slotId);
                            setEditingBookmark(null);
                          }
                          if (e.key === 'Escape') setEditingBookmark(null);
                        }}
                        autoFocus
                        className="flex-1 min-w-0 bg-slate-800 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                        placeholder="Bookmark name..."
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditingBookmark(slot.slotId);
                          setBookmarkInput(slotLabel);
                        }}
                        className="font-semibold text-slate-200 hover:text-blue-400 truncate transition-colors flex items-center gap-1"
                        title="Click to edit bookmark"
                      >
                        <Bookmark className={`w-3 h-3 shrink-0 ${slotLabel !== `Screen ${slot.slotId + 1}` ? 'text-blue-400 fill-blue-400' : 'text-slate-500'}`} />
                        <span className="truncate">{slotLabel}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {slot.stream && (
                      <>
                        <button
                          onClick={() => handleStartSwap(slot.slotId)}
                          className={`min-h-11 min-w-11 p-1.5 rounded transition-colors touch-manipulation ${
                            isSwapSelected
                              ? 'bg-amber-500 text-black'
                              : 'text-slate-500 hover:text-white hover:bg-slate-800'
                          }`}
                          title="Swap screen"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPickerModalSlotId(slot.slotId)}
                          className="min-h-11 min-w-11 p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors touch-manipulation"
                          title="Switch Stream"
                        >
                          <Search className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onClearSlot(slot.slotId)}
                          className="min-h-11 min-w-11 p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors touch-manipulation"
                          title="Remove stream"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setFullscreenSlotId(slot.slotId)}
                          className="min-h-11 min-w-11 p-1.5 rounded text-slate-500 hover:text-blue-400 hover:bg-slate-800 transition-colors touch-manipulation"
                          title="Fullscreen this screen"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                )}

                {/* Video Player Canvas or Empty Slot State */}
                <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-0">
                  {slot.stream ? (
                    <VideoPlayer
                      url={embedUrl}
                      title={slot.stream.title}
                      streamType={slot.stream.streamType}
                      isMuted={!isAudioActive}
                      volume={slot.volume}
                      autoPlay={true}
                    />
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:bg-slate-900/40 transition-colors w-full h-full"
                      onClick={() => setPickerModalSlotId(slot.slotId)}
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-2 hover:scale-110 transition-transform">
                        <Plus className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-xs font-semibold text-slate-400">Screen {slot.slotId + 1}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">Tap to assign stream</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Floating shortcut legend — hidden in fullscreen */}
        {!isGridFullscreen && (
          <div className="absolute bottom-3 right-3 pointer-events-none z-10">
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-mono text-slate-400 whitespace-nowrap">
              F: Fullscreen · Esc: Exit
            </div>
          </div>
        )}
        {/* Per-slot fullscreen overlay */}
        {fullscreenSlotId !== null && (
          (() => {
            const fsSlot = slots.find((s) => s.slotId === fullscreenSlotId);
            if (!fsSlot) return null;
            const fsEmbedUrl =
              fsSlot.resolvedEmbedUrl ||
              fsSlot.stream?.directEmbedUrl ||
              (fsSlot.stream?.sources?.[0]
                ? `https://embed.st/embed/${fsSlot.stream.sources[0].source}/${fsSlot.stream.sources[0].id}/1`
                : 'https://bintv-sources.pages.dev/?id=aHR0cHM6Ly9laGdlbWJ4ZS5jZmQvYmludHYvc3BkOGdwb2gtNjU4Ng');
            return (
              <>
                <div className="fixed inset-0 z-50 bg-black flex flex-col">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 shrink-0">
                    <span className="text-sm font-semibold text-slate-200 truncate pr-4">
                      {fsSlot.stream?.title || `Screen ${fullscreenSlotId + 1}`}
                    </span>
                    <button
                      onClick={() => setFullscreenSlotId(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors shrink-0"
                      title="Exit fullscreen"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Exit</span>
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 bg-black">
                    <VideoPlayer
                      url={fsEmbedUrl}
                      title={fsSlot.stream?.title || ''}
                      streamType={fsSlot.stream?.streamType}
                      isMuted={false}
                      volume={fsSlot.volume ?? 1}
                      autoPlay={true}
                    />
                  </div>
                </div>
              </>
            );
          })()
        )}
        </div>
      )}

      {/* Stream Selection Modal */}
      {pickerModalSlotId !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#12151e] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  Assign Stream to Screen {pickerModalSlotId + 1}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Search across 500+ live matches and 24/7 channels
                </p>
              </div>
              <button
                onClick={() => setPickerModalSlotId(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by match name, team, sport or channel..."
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {['All', 'Live Sports', '24/7 Channels', 'Basketball', 'Football / Soccer', 'Tennis', 'Golf'].map(
                  (cat) => (
                    <button
                      key={cat}
                      onClick={() => setPickerCategory(cat)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                        pickerCategory === cat
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredPickerStreams.slice(0, 40).map((stream) => (
                <div
                  key={stream.id}
                  onClick={() => handlePickStream(stream)}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={stream.poster || '/src/assets/images/hero_championship_live_1792048678438.jpg'}
                      alt={stream.title}
                      className="w-16 aspect-video object-cover rounded-md bg-slate-800 shrink-0"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          '/src/assets/images/hero_championship_live_1792048678438.jpg';
                      }}
                    />
                    <div className="truncate">
                      <p className="text-sm font-semibold text-slate-100 group-hover:text-blue-400 truncate">
                        {stream.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span className="uppercase text-[11px] font-mono text-blue-400">
                          {stream.status}
                        </span>
                        <span>·</span>
                        <span>{stream.category}</span>
                      </div>
                    </div>
                  </div>

                  <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shrink-0 ml-3">
                    Select
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Save Preset Dialog */}
      {savePresetOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePresetSubmit}
            className="w-full max-w-md bg-[#12151e] border border-slate-700 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <h3 className="text-lg font-bold text-white mb-1">Save Multiview Layout Preset</h3>
            <p className="text-xs text-slate-400 mb-4">
              Save your current {layout} split-screen setup to quickly restore it anytime.
            </p>

            <label className="block text-xs font-medium text-slate-300 mb-1.5">Preset Name</label>
            <input
              type="text"
              placeholder="e.g. Sunday NFL Quad, Champions League Focus"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              autoFocus
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 mb-4"
            />

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSavePresetOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Save Setup
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};