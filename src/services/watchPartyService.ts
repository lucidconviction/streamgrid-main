/**
 * Watch Party client service
 * Handles WebSocket signaling, WebRTC peer-to-peer sync, and queue management
 */

export interface RoomInfo {
  roomCode: string;
  peerId: string;
  isHost: boolean;
  hostId: string;
  peers: PeerInfo[];
  queue: QueueEntry[];
  currentStream: StreamItem | null;
}

export interface PeerInfo {
  id: string;
  name: string;
  avatarColor: string;
  joinedAt: number;
  isHost: boolean;
}

export interface QueueEntry {
  id: string;
  streamId: string;
  title: string;
  category: string;
  poster: string;
  embedUrl: string;
  provider: string;
  addedBy: string;
  addedByName: string;
  addedAt: number;
}

export interface StreamItem {
  id: string;
  title: string;
  category: string;
  poster?: string;
  directEmbedUrl?: string;
  provider: string;
  embedUrl?: string;
}

export type WatchPartyEvent =
  | { type: 'connected'; peerId: string }
  | { type: 'room_created'; room: RoomInfo }
  | { type: 'room_joined'; room: RoomInfo }
  | { type: 'peer_joined'; peer: PeerInfo }
  | { type: 'peer_left'; peerId: string; peers: PeerInfo[] }
  | { type: 'host_transferred'; newHostId: string }
  | { type: 'kicked'; reason: string }
  | { type: 'queue_updated'; entry?: QueueEntry; queue: QueueEntry[] }
  | { type: 'play_next'; currentStream: StreamItem; queue: QueueEntry[] }
  | { type: 'sync_play'; time: number; by: string }
  | { type: 'sync_pause'; time: number; by: string }
  | { type: 'sync_seek'; time: number; by: string }
  | { type: 'error'; message: string }
  | { type: 'webrtc_offer'; from: string; data: any }
  | { type: 'webrtc_answer'; from: string; data: any }
  | { type: 'webrtc_ice'; from: string; data: RTCIceCandidate };

export interface WatchPartyCallbacks {
  onEvent: (event: WatchPartyEvent) => void;
}

const SIGNALING_URL =
  typeof window !== 'undefined'
    ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
    : 'ws://localhost:3001/ws';

export class WatchPartyService {
  private ws: WebSocket | null = null;
  private peerId: string | null = null;
  private callbacks: WatchPartyCallbacks | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private rtcPeers: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private dataChannel: RTCDataChannel | null = null;

  connect(callbacks: WatchPartyCallbacks) {
    this.callbacks = callbacks;

    if (this.ws) return;

    this.ws = new WebSocket(SIGNALING_URL);

    this.ws.onopen = () => {
      console.log('[wp] Connected to signaling server');
    };

    this.ws.onmessage = (event) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      this.dispatchMsg(msg);
    };

    this.ws.onclose = () => {
      console.log('[wp] Disconnected from signaling server');
      this.ws = null;
      this.reconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[wp] WebSocket error:', err);
    };
  }

  private dispatchMsg(msg: any) {
    if (!this.callbacks) return;

    switch (msg.type) {
      case 'connected':
        this.peerId = msg.peerId;
        this.callbacks.onEvent({ type: 'connected', peerId: msg.peerId });
        break;
      case 'room_created':
        this.callbacks.onEvent({ type: 'room_created', room: msg.room });
        break;
      case 'room_joined':
        this.callbacks.onEvent({ type: 'room_joined', room: msg.room });
        break;
      case 'peer_joined':
        this.callbacks.onEvent({ type: 'peer_joined', peer: msg.peer });
        this.setupWebRTC(msg.peer.id);
        break;
      case 'peer_left':
        this.callbacks.onEvent({ type: 'peer_left', peerId: msg.peerId, peers: msg.peers });
        this.closeWebRTC(msg.peerId);
        break;
      case 'host_transferred':
        this.callbacks.onEvent({ type: 'host_transferred', newHostId: msg.newHostId });
        break;
      case 'kicked':
        this.callbacks.onEvent({ type: 'kicked', reason: msg.reason });
        break;
      case 'queue_updated':
        this.callbacks.onEvent({ type: 'queue_updated', entry: msg.entry, queue: msg.queue });
        break;
      case 'play_next':
        this.callbacks.onEvent({ type: 'play_next', currentStream: msg.currentStream, queue: msg.queue });
        break;
      case 'sync_play':
        this.callbacks.onEvent({ type: 'sync_play', time: msg.time, by: msg.by });
        break;
      case 'sync_pause':
        this.callbacks.onEvent({ type: 'sync_pause', time: msg.time, by: msg.by });
        break;
      case 'sync_seek':
        this.callbacks.onEvent({ type: 'sync_seek', time: msg.time, by: msg.by });
        break;
      case 'error':
        this.callbacks.onEvent({ type: 'error', message: msg.message });
        break;
      case 'webrtc_offer':
        this.handleWebRTCMessage('offer', msg.from, msg.data);
        break;
      case 'webrtc_answer':
        this.handleWebRTCMessage('answer', msg.from, msg.data);
        break;
      case 'webrtc_ice':
        this.handleICECandidate(msg.from, msg.data);
        break;
    }
  }

  private reconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.peerId) {
        this.connect(this.callbacks!);
      }
    }, 3000);
  }

  private createRTCPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      this.dataChannels.set(peerId, channel);
      channel.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'play') {
            this.callbacks?.onEvent({ type: 'sync_play', time: msg.time, by: 'local' });
          } else if (msg.type === 'pause') {
            this.callbacks?.onEvent({ type: 'sync_pause', time: msg.time, by: 'local' });
          } else if (msg.type === 'seek') {
            this.callbacks?.onEvent({ type: 'sync_seek', time: msg.time, by: 'local' });
          }
        } catch {}
      };
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'webrtc_ice',
          data: event.candidate,
          targetId: peerId,
        }));
      }
    };

    pc.addEventListener('close', () => {
      this.rtcPeers.delete(peerId);
      this.dataChannels.delete(peerId);
    });

    this.rtcPeers.set(peerId, pc);
    return pc;
  }

  async createDataChannel(targetPeerId: string) {
    const pc = this.rtcPeers.get(targetPeerId);
    if (!pc) return null;

    const channel = pc.createDataChannel('sync');
    this.dataChannels.set(targetPeerId, channel);

    channel.onopen = () => {
      console.log(`[wp] Data channel open with ${targetPeerId}`);
    };

    channel.onclose = () => {
      this.dataChannels.delete(targetPeerId);
    };

    return channel;
  }

  private async setupWebRTC(peerId: string) {
    // Try to establish direct connection
    if (!this.dataChannels.has(peerId)) {
      const wasHost = await this.createPeerConnectionAndOffer(peerId);
      if (!wasHost) {
        // Wait for answer
        console.log(`[wp] Waiting for peer ${peerId} to create offer`);
      }
    }
  }

  private async createPeerConnectionAndOffer(targetId: string): Promise<boolean> {
    const pc = this.createRTCPeerConnection(targetId);
    const channel = pc.createDataChannel('sync');
    this.dataChannels.set(targetId, channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'webrtc_offer',
        data: offer,
        targetId,
      }));
    }

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'webrtc_ice',
          data: event.candidate,
          targetId,
        }));
      }
    };

    return true;
  }

  private handleWebRTCMessage(kind: 'offer' | 'answer', from: string, data: any) {
    let pc = this.rtcPeers.get(from);
    if (!pc) {
      pc = this.createRTCPeerConnection(from);
    }

    const desc = new RTCSessionDescription(data);
    pc.setRemoteDescription(desc).catch((e) => console.error('[wp] RTC error:', e));

    if (kind === 'offer') {
      pc.createAnswer().then(async (answer) => {
        await pc.setLocalDescription(answer);
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'webrtc_answer',
            data: answer,
            targetId: from,
          }));
        }
      }).catch((e) => console.error('[wp] Create answer error:', e));
    }
  }

  private handleICECandidate(from: string, candidate: RTCIceCandidate) {
    const pc = this.rtcPeers.get(from);
    if (pc) {
      pc.addIceCandidate(candidate).catch((e) => console.error('[wp] ICE error:', e));
    }
  }

  private closeWebRTC(peerId?: string) {
    if (peerId) {
      const pc = this.rtcPeers.get(peerId);
      if (pc) { pc.close(); this.rtcPeers.delete(peerId); }
      this.dataChannels.delete(peerId);
    } else {
      this.rtcPeers.forEach((pc) => pc.close());
      this.rtcPeers.clear();
      this.dataChannels.clear();
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  send(name: string) {
    (this.ws as any).__name = name;
  }

  createRoom(name: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'create', name }));
    }
  }

  joinRoom(roomCode: string, name: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'join', roomCode, name }));
    }
  }

  leaveRoom() {
    this.closeWebRTC();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'leave' }));
    }
  }

  addToQueue(stream: StreamItem) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'queue_add',
        streamId: stream.id,
        title: stream.title,
        category: stream.category,
        poster: stream.poster || '',
        embedUrl: stream.directEmbedUrl || stream.embedUrl || '',
        provider: stream.provider,
      }));
    }
  }

  removeFromQueue(entryId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'queue_remove', entryId }));
    }
  }

  reorderQueue(queue: QueueEntry[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'queue_reorder', queue }));
    }
  }

  playNext(currentStream: StreamItem) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'play_next',
        currentStream,
      }));
    }
  }

  syncPlay(time: number) {
    // Broadcast via both WebSocket and WebRTC data channels
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'sync_play', time }));
    }
    this.broadcastSync('play', time);
  }

  syncPause(time: number) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'sync_pause', time }));
    }
    this.broadcastSync('pause', time);
  }

  syncSeek(time: number) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'sync_seek', time }));
    }
    this.broadcastSync('seek', time);
  }

  kickPeer(peerId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'kick', peerId }));
    }
  }

  transferHost(newHostId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'host_transfer', targetId: newHostId }));
    }
  }

  private broadcastSync(action: 'play' | 'pause' | 'seek', time: number) {
    this.dataChannels.forEach((channel, peerId) => {
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify({ type: action, time }));
      }
    });
  }

  disconnect() {
    this.leaveRoom();
    this.closeWebRTC();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.peerId = null;
    this.callbacks = null;
  }
}

export const watchPartyService = new WatchPartyService();
