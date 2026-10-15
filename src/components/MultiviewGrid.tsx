import React, { useState } from 'react';
import {
  LayoutGrid,
  Volume2,
  VolumeX,
  Maximize2,
  Trash2,
  Plus,
  RefreshCw,
  Search,
  X,
  Check,
  Save,
  ArrowRightLeft,
  Tv,
  Layers,
  Radio,
  Minimize2,
} from 'lucide-react';
import { StreamItem, MultiviewSlot, MultiviewLayout, MultiviewPreset } from '../types/stream';
import { VideoPlayer } from './VideoPlayer';

interface MultiviewGridProps {
  slots: MultiviewSlot[];
  layout: MultiviewLayout;
  onLayoutChange: (layout: MultiviewLayout) => void;
  onUpdateSlotStream: (slotId: number, stream: StreamItem | null) => void;
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
  const [soloSlotId, setSoloSlotId] = useState<number | null>(0); // Slot 0 has audio by default
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [swapSourceSlot, setSwapSourceSlot] = useState<number | null>(null);
  const [fullscreenSlotId, setFullscreenSlotId] = useState<number | null>(null);
  const [isGridFullscreen, setIsGridFullscreen] = useState(false);

  // Escape to exit grid fullscreen
  React.useEffect(() => {
    if (!isGridFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsGridFullscreen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isGridFullscreen]);

  // Determine active slots count based on layout
  const maxSlots = layout === 'single' ? 1 : layout === 'dual' ? 2 : layout === 'triple' ? 3 : 4;
  const activeSlots = slots.slice(0, maxSlots);

  // Toggle Solo Audio for a slot
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

  // Filter streams for picker
  const filteredPickerStreams = allStreams.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      s.category.toLowerCase().includes(pickerSearch.toLowerCase());
    const matchesCat = pickerCategory === 'All' || s.category === pickerCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="w-full max-w-[1720px] mx-auto px-2 sm:px-6 py-4 flex flex-col gap-4">
      {/* Multiview Workspace Command Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0f121a] p-3.5 rounded-xl border border-slate-800/80">
        {/* Layout Selectors */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
          <button
            onClick={() => onLayoutChange('single')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              layout === 'single' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            1 Focus
          </button>
          <button
            onClick={() => onLayoutChange('dual')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              layout === 'dual' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            2 Dual
          </button>
          <button
            onClick={() => onLayoutChange('triple')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              layout === 'triple' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            3 Triple
          </button>
          <button
            onClick={() => onLayoutChange('quad')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              layout === 'quad' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            4 Quad 2x2
          </button>
        </div>

        {/* Audio Solo Status & Global Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 px-3 py-1.5 bg-slate-900/80 rounded-lg border border-slate-800">
            <Volume2 className="w-3.5 h-3.5 text-blue-400" />
            <span>
              Audio Source:{' '}
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

          {/* Preset Buttons */}
          <div className="relative">
            <button
              onClick={() => setSavePresetOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-800 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save Preset</span>
            </button>
          </div>

          {/* Preset Quick Loader */}
          {presets.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto max-w-xs no-scrollbar">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onApplyPreset(p)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-[11px] font-medium text-slate-300 hover:text-white border border-slate-800 whitespace-nowrap transition-colors"
                  title={`Load "${p.name}"`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Fullscreen Grid Toggle */}
          <button
            onClick={() => setIsGridFullscreen(!isGridFullscreen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isGridFullscreen
                ? 'bg-blue-950/80 border-blue-700 text-blue-300'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title={isGridFullscreen ? 'Exit Fullscreen Grid' : 'Enter Fullscreen Grid (all screens)'}
          >
            {isGridFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-blue-400" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isGridFullscreen ? 'Exit Fullscreen' : 'Fullscreen Grid'}</span>
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

      {/* Grid Layout Canvas */}
      <div
        className={`w-full min-h-[600px] md:min-h-[720px] rounded-2xl bg-black border border-slate-800/80 p-2 sm:p-3 gap-2.5 relative transition-all duration-300 ${
          isGridFullscreen
            ? 'fixed inset-4 z-50 rounded-none min-h-[calc(100vh-80px)]'
            : layout === 'single'
            ? 'grid grid-cols-1'
            : layout === 'dual'
            ? 'grid grid-cols-1 md:grid-cols-2'
            : layout === 'triple'
            ? 'grid grid-cols-1 md:grid-cols-3'
            : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2'
        }`}
      >
        {activeSlots.map((slot) => {
          const isAudioActive = soloSlotId === slot.slotId;
          const isSwapSelected = swapSourceSlot === slot.slotId;
          const isSlotFullscreen = fullscreenSlotId === slot.slotId;

          // Resolve URL
          const embedUrl =
            slot.resolvedEmbedUrl ||
            slot.stream?.directEmbedUrl ||
            (slot.stream?.sources?.[0]
              ? `https://embed.st/embed/${slot.stream.sources[0].source}/${slot.stream.sources[0].id}/1`
              : 'https://bintv-sources.pages.dev/?id=aHR0cHM6Ly9laGdlbWJ4ZS5jZmQvYmludHYvc3BkOGdwb2gtNjU4Ng');

          return (
            <div
              key={slot.slotId}
              className={`relative flex flex-col rounded-xl overflow-hidden bg-[#0c0e14] border transition-all duration-200 group ${
                isSwapSelected
                  ? 'border-amber-400 ring-2 ring-amber-400/30'
                  : isAudioActive
                  ? 'border-blue-500/80 shadow-lg shadow-blue-950/20'
                  : 'border-slate-800 hover:border-slate-700'
            } ${isSlotFullscreen ? 'fixed inset-4 z-50 bg-black' : isGridFullscreen ? 'h-full' : 'h-[320px] sm:h-[380px] md:h-full'}`}>
              {/* Slot Header Control Bar */}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 text-xs z-20">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono font-bold text-slate-400 text-[11px] px-1.5 py-0.5 bg-black/60 rounded">
                    S{slot.slotId + 1}
                  </span>
                  <span className="font-semibold text-slate-200 truncate">
                    {slot.stream ? slot.stream.title : 'Empty Screen Slot'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {slot.stream && (
                    <>
                      {/* Audio Solo Toggle */}
                      <button
                        onClick={() => handleToggleSoloAudio(slot.slotId)}
                        className={`p-1.5 rounded-md transition-colors ${
                          isAudioActive
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                        title={isAudioActive ? 'Screen Audio is LIVE' : 'Solo Audio for this Screen'}
                      >
                        {isAudioActive ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                      </button>

                      {/* Swap Button */}
                      <button
                        onClick={() => handleStartSwap(slot.slotId)}
                        className={`p-1.5 rounded-md transition-colors ${
                          isSwapSelected
                            ? 'bg-amber-500 text-black'
                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                        title="Swap screen position"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </button>

                      {/* Fullscreen Slot */}
                      <button
                        onClick={() =>
                          setFullscreenSlotId(isSlotFullscreen ? null : slot.slotId)
                        }
                        className="p-1.5 rounded-md bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        title="Toggle full screen for this slot"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Change stream */}
                      <button
                        onClick={() => setPickerModalSlotId(slot.slotId)}
                        className="p-1.5 rounded-md bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        title="Switch Stream"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>

                      {/* Clear slot */}
                      <button
                        onClick={() => onClearSlot(slot.slotId)}
                        className="p-1.5 rounded-md bg-slate-800 text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-colors"
                        title="Remove stream from screen"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Video Player Canvas or Empty Slot State */}
              <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
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
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3 group-hover:scale-105 transition-transform">
                      <Plus className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-300 mb-1">
                      Screen {slot.slotId + 1} Ready
                    </p>
                    <p className="text-xs text-slate-500 max-w-xs mb-4">
                      Select any live sports match or 24/7 TV channel to stream here.
                    </p>
                    <button
                      onClick={() => setPickerModalSlotId(slot.slotId)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
                    >
                      + Choose Stream
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stream Selection Modal for Multiview Slot */}
      {pickerModalSlotId !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#12151e] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
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

            {/* Filter & Search Bar */}
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

              {/* Category Quick Chips */}
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

            {/* Streams List */}
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
