import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Users, Plus, Trash2, Play, SkipForward, Crown } from 'lucide-react';
import { StreamItem } from '../types/stream';
import { watchPartyService, type RoomInfo, type QueueEntry, type PeerInfo, type WatchPartyEvent } from '../services/watchPartyService';

interface WatchPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStream?: StreamItem | null;
  onAddToQueue: (stream: StreamItem) => void;
}

type ModalTab = 'create' | 'join';

export const WatchPartyModal: React.FC<WatchPartyModalProps> = ({
  isOpen,
  onClose,
  currentStream,
  onAddToQueue,
}) => {
  const [tab, setTab] = useState<ModalTab>('create');
  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [activeRoom, setActiveRoom] = useState<RoomInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!name) {
      const stored = localStorage.getItem('wp_name');
      if (stored) setName(stored);
      else setName(`User_${Math.random().toString(36).slice(2, 6)}`);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEvent = (event: WatchPartyEvent) => {
      switch (event.type) {
        case 'room_created':
        case 'room_joined':
          setActiveRoom(event.room);
          setError('');
          break;
        case 'peer_joined':
          console.log('[wp] peer joined', event.peer.name);
          break;
        case 'peer_left':
          break;
        case 'error':
          setError(event.message);
          break;
        case 'kicked':
          setActiveRoom(null);
          setError(event.reason || 'You have been removed from the party');
          break;
      }
    };

    watchPartyService.connect({ onEvent: handleEvent });
    return () => watchPartyService.disconnect();
  }, [isOpen]);

  const handleCreate = () => {
    setError('');
    localStorage.setItem('wp_name', name);
    watchPartyService.send(name);
    watchPartyService.createRoom(name);
  };

  const handleJoin = () => {
    setError('');
    localStorage.setItem('wp_name', name);
    watchPartyService.send(name);
    watchPartyService.joinRoom(roomCode.toUpperCase(), name);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeRoom?.roomCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    watchPartyService.leaveRoom();
    setActiveRoom(null);
    onClose();
  };

  const handleAddToQueue = () => {
    if (currentStream && activeRoom) {
      watchPartyService.addToQueue(currentStream);
      onAddToQueue(currentStream);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#0f121a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Watch Party
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {activeRoom ? (
            /* ── Active Room ── */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Party is live — {activeRoom.peers.length} watching
              </div>

              {/* Room Code */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono">ROOM CODE:</span>
                <span className="text-xl font-black font-mono text-white tracking-widest">
                  {activeRoom.roomCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Copy code"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Peers */}
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Participants</p>
                <div className="flex flex-wrap gap-2">
                  {activeRoom.peers.map((p: PeerInfo) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs ${
                        activeRoom.peerId === p.id ? 'border-blue-500/50' : ''
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full ${p.avatarColor} text-white flex items-center justify-center text-[10px] font-bold`}>
                        {p.name[0].toUpperCase()}
                      </span>
                      <span className="text-slate-200 font-medium truncate max-w-[80px]">{p.name}</span>
                      {p.isHost && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                      {activeRoom.peerId !== p.id && p.id !== activeRoom.hostId && (
                        <button
                          onClick={() => watchPartyService.kickPeer(p.id)}
                          className="ml-1 text-slate-500 hover:text-blue-400 transition-colors"
                          title="Kick"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Current stream */}
              {activeRoom.currentStream && (
                <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/60">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Now Playing</p>
                  <p className="text-sm font-semibold text-white line-clamp-1">{activeRoom.currentStream.title}</p>
                  <p className="text-[11px] text-slate-400">{activeRoom.currentStream.category}</p>
                </div>
              )}

              {/* Add current stream to queue */}
              {currentStream && (
                <button
                  onClick={handleAddToQueue}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors border border-slate-700"
                >
                  <Plus className="w-4 h-4" />
                  Add to Queue
                </button>
              )}

              {/* Leave */}
              <button
                onClick={handleLeave}
                className="w-full px-4 py-2.5 rounded-xl bg-blue-950/50 hover:bg-blue-950 text-blue-300 text-sm font-medium transition-colors border border-blue-800/50"
              >
                Leave Party
              </button>
            </div>
          ) : (
            /* ── Create / Join Tabs ── */
            <div>
              {/* Tabs */}
              <div className="flex gap-1 bg-slate-900/80 p-1 rounded-xl mb-5">
                {(['create', 'join'] as ModalTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setError(''); }}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      tab === t
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t === 'create' ? 'Create Party' : 'Join Party'}
                  </button>
                ))}
              </div>

              {/* Name input */}
              <div className="mb-4">
                <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">Your Name</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name..."
                  maxLength={20}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              {tab === 'create' ? (
                <button
                  onClick={handleCreate}
                  disabled={!name.trim()}
                  className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-semibold transition-colors"
                >
                  Create Watch Party
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">Room Code</label>
                    <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))}
                      placeholder="ABC123"
                      maxLength={6}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono tracking-widest uppercase placeholder-slate-600 focus:outline-none focus:border-blue-500 text-center"
                    />
                  </div>
                  <button
                    onClick={handleJoin}
                    disabled={!roomCode.length || !name.trim()}
                    className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-semibold transition-colors"
                  >
                    Join Party
                  </button>
                </div>
              )}

              {error && (
                <p className="mt-3 text-xs text-blue-400 text-center">{error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
