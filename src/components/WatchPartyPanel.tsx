import React, { useEffect, useState, useCallback } from 'react';
import {
  Crown, Users, SkipForward, Trash2, Plus, X,
  Play, Pause, RotateCcw, MoveUp, MoveDown,
} from 'lucide-react';
import { StreamItem } from '../types/stream';
import {
  watchPartyService,
  type RoomInfo,
  type QueueEntry,
  type WatchPartyEvent,
} from '../services/watchPartyService';

interface WatchPartyPanelProps {
  currentStream?: StreamItem | null;
  isOpen: boolean;
  onToggle: () => void;
}

export const WatchPartyPanel: React.FC<WatchPartyPanelProps> = ({
  currentStream,
  isOpen,
  onToggle,
}) => {
  const [activeRoom, setActiveRoom] = useState<RoomInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Sync internal state with service
  const syncState = useCallback((room: RoomInfo) => {
    setActiveRoom(room);
    if (room.currentStream?.id === currentStream?.id) {
      // Already showing the same stream, keep playing state
    }
  }, [currentStream]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEvent = (event: WatchPartyEvent) => {
      switch (event.type) {
        case 'room_created':
        case 'room_joined':
          syncState(event.room);
          break;
        case 'peer_joined':
          setActiveRoom((prev) => prev ? { ...prev, peers: [...prev.peers, event.peer] } : prev);
          break;
        case 'peer_left':
          setActiveRoom((prev) => prev ? {
            ...prev,
            peers: prev.peers.filter((p) => p.id !== event.peerId),
          } : prev);
          break;
        case 'host_transferred':
          setActiveRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              peers: prev.peers.map((p) => ({
                ...p,
                isHost: p.id === event.newHostId,
              })),
            };
          });
          break;
        case 'queue_updated':
          setActiveRoom((prev) => prev ? { ...prev, queue: event.queue } : prev);
          break;
        case 'play_next':
          setActiveRoom((prev) => prev ? { ...prev, currentStream: event.currentStream, queue: event.queue } : prev);
          break;
        case 'sync_play':
          setIsPlaying(true);
          break;
        case 'sync_pause':
          setIsPlaying(false);
          break;
        case 'sync_seek':
          setCurrentTime(event.time);
          break;
        case 'kicked':
          setActiveRoom(null);
          break;
      }
    };

    watchPartyService.connect({ onEvent: handleEvent });
    return () => watchPartyService.disconnect();
  }, [isOpen]);

  // Update currentStream reference
  useEffect(() => {
    if (!isOpen || !activeRoom?.currentStream || activeRoom.currentStream.id !== currentStream?.id) return;
    // Stream changed externally — update if this peer initiated it
  }, [currentStream, isOpen, activeRoom?.currentStream?.id]);

  const handleLeave = () => {
    watchPartyService.leaveRoom();
    setActiveRoom(null);
    onToggle();
  };

  const handleAddToQueue = () => {
    if (currentStream) {
      watchPartyService.addToQueue(currentStream);
    }
  };

  const handleRemoveFromQueue = (entryId: string) => {
    watchPartyService.removeFromQueue(entryId);
  };

  const handleSkip = () => {
    if (!activeRoom || !activeRoom.queue.length) return;
    const next = activeRoom.queue[0];
    watchPartyService.playNext({
      id: next.streamId,
      title: next.title,
      category: next.category,
      poster: next.poster,
      directEmbedUrl: next.embedUrl,
      provider: next.provider,
    });
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (!activeRoom) return;
    const q = [...activeRoom.queue];
    const [moved] = q.splice(fromIndex, 1);
    q.splice(toIndex, 0, moved);
    watchPartyService.reorderQueue(q);
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-[#0f121a] rounded-xl border border-slate-800/80 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">Watch Party</span>
          {activeRoom && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-950/60 border border-green-800/50">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-green-400">{activeRoom.peers.length}</span>
            </span>
          )}
        </div>
        {activeRoom && (
          <button
            onClick={handleLeave}
            className="p-1 rounded text-slate-500 hover:text-blue-400 transition-colors"
            title="Leave party"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!activeRoom ? (
        /* ── Not in party ── */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Users className="w-8 h-8 text-slate-700 mb-3" />
          <p className="text-sm font-semibold text-slate-300 mb-1">No active party</p>
          <p className="text-xs text-slate-500 mb-4">Create or join a watch party to sync playback with friends</p>
          <button
            onClick={onToggle}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Open Party Menu
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Room info */}
          <div className="px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/40">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Room: <span className="font-mono text-slate-300 font-bold">{activeRoom.roomCode}</span></span>
              {activeRoom.isHost && (
                <span className="flex items-center gap-1 text-[10px] text-amber-400">
                  <Crown className="w-3 h-3" /> Host
                </span>
              )}
            </div>
          </div>

          {/* Participants */}
          <div className="px-4 py-2.5 border-b border-slate-800/60">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Participants ({activeRoom.peers.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {activeRoom.peers.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
                    p.isHost ? 'bg-amber-950/50 border border-amber-800/40' : 'bg-slate-800 border border-slate-700'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full ${p.avatarColor} text-white flex items-center justify-center text-[9px] font-bold`}>
                    {p.name[0].toUpperCase()}
                  </span>
                  <span className="text-slate-200 truncate max-w-[70px]">{p.name}</span>
                  {p.isHost && <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                  {activeRoom.isHost && !p.isHost && (
                    <button
                      onClick={() => watchPartyService.kickPeer(p.id)}
                      className="ml-0.5 text-slate-600 hover:text-blue-400"
                      title="Kick"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Queue */}
          <div className="px-4 py-2.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Queue ({activeRoom.queue.length})</p>
              {activeRoom.isHost && activeRoom.queue.length > 0 && (
                <button
                  onClick={() => watchPartyService.reorderQueue([])}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
                >
                  <Trash2 className="w-2.5 h-2.5" /> Clear
                </button>
              )}
            </div>

            {activeRoom.queue.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-600 border border-dashed border-slate-800 rounded-lg">
                Queue is empty
              </div>
            ) : (
              <div className="space-y-1.5">
                {activeRoom.queue.map((entry: QueueEntry, idx: number) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 px-2.5 py-2 bg-slate-900/60 rounded-lg border border-slate-800/60 hover:border-slate-700 transition-colors group"
                  >
                    <span className="text-[10px] font-mono text-slate-600 w-4 shrink-0">{idx + 1}</span>

                    {/* Drag handles for host */}
                    {activeRoom.isHost && idx > 0 && (
                      <button
                        onClick={() => handleReorder(idx, idx - 1)}
                        className="text-slate-600 hover:text-slate-300 transition-colors shrink-0"
                      >
                        <MoveUp className="w-3 h-3" />
                      </button>
                    )}
                    {activeRoom.isHost && idx < activeRoom.queue.length - 1 && (
                      <button
                        onClick={() => handleReorder(idx, idx + 1)}
                        className="text-slate-600 hover:text-slate-300 transition-colors shrink-0"
                      >
                        <MoveDown className="w-3 h-3" />
                      </button>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{entry.title}</p>
                      <p className="text-[10px] text-slate-500">
                        by {entry.addedByName} · {entry.category}
                      </p>
                    </div>

                    <button
                      onClick={() => handleRemoveFromQueue(entry.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-blue-400 transition-all shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add current stream */}
            {currentStream && !activeRoom.queue.find((q) => q.streamId === currentStream.id) && (
              <button
                onClick={handleAddToQueue}
                className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white text-xs transition-colors border border-dashed border-slate-700"
              >
                <Plus className="w-3 h-3" />
                Add "{currentStream.title}" to Queue
              </button>
            )}

            {/* Skip button (host only) */}
            {activeRoom.queue.length > 0 && (
              <button
                onClick={handleSkip}
                disabled={!activeRoom.isHost}
                className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 disabled:opacity-40 text-slate-400 hover:text-white text-xs transition-colors border border-slate-700"
              >
                <SkipForward className="w-3 h-3" />
                {activeRoom.isHost ? 'Skip to Next' : 'Next up'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
