import type { Plugin } from 'vite';
import https from 'https';
import http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import net from 'net';
import { WebSocketServer, WebSocket } from 'ws';
import { randomBytes } from 'crypto';

export function bintvProxyPlugin(): Plugin {
  return {
    name: 'bintv-proxy',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = new URL(req.url || '', 'http://localhost');
        
        if (url.pathname === '/api/bintv-proxy') {
          const idParam = url.searchParams.get('id');
          
          if (!idParam) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing id parameter' }));
            return;
          }

          let decodedUrl: string;
          try {
            let padded = idParam.replace(/-/g, '+').replace(/_/g, '/');
            while (padded.length % 4) padded += '=';
            decodedUrl = Buffer.from(padded, 'base64').toString('utf-8');
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid id parameter' }));
            return;
          }

          // Use native fetch() — more compatible with Cloudflare than Node https module
          try {
            const response = await fetch(decodedUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'identity',
                'Referer': 'https://bintv-sources.pages.dev/',
                'Sec-Fetch-Dest': 'iframe',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
              },
              redirect: 'follow',
            });

            if (!response.ok) {
              res.writeHead(response.status, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`Access Denied (${response.status})`);
              return;
            }

            const html = await response.text();
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(html);
          } catch (e: any) {
            console.error('Bintv proxy fetch error:', e.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to fetch stream: ' + e.message }));
          }
          return;
        }
        
        next();
      });
    },
  };
}

// ── Watch Party Signaling Server ──────────────────────────────────────────────

interface Room {
  code: string;
  hostId: string;
  peers: Map<string, WebSocket>;
  queue: QueueEntry[];
  currentStream: any | null;
  createdAt: number;
  lastActivity: number;
}

interface QueueEntry {
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

interface PeerInfo {
  id: string;
  name: string;
  avatarColor: string;
  joinedAt: number;
  isHost: boolean;
}

const ROOMS = new Map<string, Room>();
const PEER_ROOM: Map<string, string> = new Map();

function generateRoomCode(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

function generatePeerId(): string {
  return randomBytes(8).toString('hex');
}

function randomColor(): string {
  const colors = ['bg-red-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-purple-600', 'bg-pink-600', 'bg-cyan-600', 'bg-orange-600'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function cleanupRoom(roomCode: string) {
  const room = ROOMS.get(roomCode);
  if (!room) return;
  room.peers.forEach((ws) => {
    try { ws.close(); } catch {}
  });
  room.peers.clear();
  ROOMS.delete(roomCode);
  console.log(`[wp] Room ${roomCode} cleaned up`);
}

function getRoomPeers(roomCode: string): PeerInfo[] {
  const room = ROOMS.get(roomCode);
  if (!room) return [];
  return Array.from(room.peers.keys()).map((id) => {
    const peer = room.peers.get(id)!;
    // Store metadata on WebSocket
    return {
      id,
      name: (peer as any).__name || 'Guest',
      avatarColor: (peer as any).__color || randomColor(),
      joinedAt: (peer as any).__joinedAt || Date.now(),
      isHost: id === room.hostId,
    };
  });
}

export function watchPartyPlugin(): Plugin {
  return {
    name: 'watch-party-signaling',
    configureServer(server) {
      // Use Vite's HTTP server directly with a custom path
      // that Vite's built-in HMR handler doesn't intercept
      const wss = new WebSocketServer({ noServer: true });

      const handleUpgrade = (req: IncomingMessage, socket: net.Socket, head: Buffer) => {
        const url = new URL(req.url || '', 'http://localhost');
        if (url.pathname === '/ws') {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      };

      // Hook into Vite's HTTP server upgrade event
      const httpServer = server.httpServer;
      if (httpServer) {
        httpServer.on('upgrade', handleUpgrade);
      }

      wss.on('connection', (ws, req) => {
        const peerId = generatePeerId();
        (ws as any).__id = peerId;
        (ws as any).__name = `User_${peerId.slice(0, 4)}`;
        (ws as any).__color = randomColor();
        (ws as any).__joinedAt = Date.now();

        console.log(`[wp] Peer connected: ${peerId}`);

        ws.on('message', (data: Buffer) => {
          let msg: any;
          try {
            msg = JSON.parse(data.toString());
          } catch {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
            return;
          }

          handleRoomMessage(ws, peerId, msg);
        });

        ws.on('close', () => {
          console.log(`[wp] Peer disconnected: ${peerId}`);
          const roomCode = PEER_ROOM.get(peerId);
          if (roomCode) {
            removePeerFromRoom(roomCode, peerId, ws);
          }
          PEER_ROOM.delete(peerId);
        });

        ws.on('error', (err: Error) => {
          console.error('[wp] WebSocket error:', err.message);
        });

        ws.send(JSON.stringify({ type: 'connected', peerId }));
      });

      (server as any).__wpWss = wss;
    },
  };
}

function handleRoomMessage(ws: WebSocket, peerId: string, msg: any) {
  switch (msg.type) {
    case 'create': {
      // Check if already in a room
      const existingRoom = PEER_ROOM.get(peerId);
      if (existingRoom) {
        ws.send(JSON.stringify({ type: 'error', message: 'Already in a room' }));
        return;
      }

      const roomCode = generateRoomCode();
      const room: Room = {
        code: roomCode,
        hostId: peerId,
        peers: new Map(),
        queue: [],
        currentStream: null,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
      room.peers.set(peerId, ws);
      PEER_ROOM.set(peerId, roomCode);
      (ws as any).__name = msg.name || `User_${peerId.slice(0, 4)}`;
      (ws as any).__joinedAt = Date.now();

      console.log(`[wp] Created room ${roomCode}`);

      ws.send(JSON.stringify({
        type: 'room_created',
        roomCode,
        peerId,
        isHost: true,
        peers: getRoomPeers(roomCode),
        queue: room.queue,
        currentStream: room.currentStream || null,
      }));
      break;
    }

    case 'join': {
      const room = ROOMS.get(msg.roomCode);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        return;
      }
      if (room.peers.size >= 8) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
        return;
      }

      const existingRoom = PEER_ROOM.get(peerId);
      if (existingRoom) {
        removePeerFromRoom(existingRoom, peerId, ws);
      }

      room.peers.set(peerId, ws);
      PEER_ROOM.set(peerId, room.code);
      (ws as any).__name = msg.name || `User_${peerId.slice(0, 4)}`;
      (ws as any).__joinedAt = Date.now();
      room.lastActivity = Date.now();

      // Notify existing peers
      broadcastToRoom(room.code, {
        type: 'peer_joined',
        peerId,
        peer: {
          id: peerId,
          name: (ws as any).__name,
          avatarColor: (ws as any).__color,
          joinedAt: (ws as any).__joinedAt,
          isHost: peerId === room.hostId,
        },
      });

      ws.send(JSON.stringify({
        type: 'room_joined',
        roomCode: room.code,
        peerId,
        isHost: peerId === room.hostId,
        peers: getRoomPeers(room.code),
        queue: room.queue,
        currentStream: room.currentStream || null,
      }));
      break;
    }

    case 'leave': {
      const roomCode = PEER_ROOM.get(peerId);
      if (roomCode) {
        removePeerFromRoom(roomCode, peerId, ws);
      }
      break;
    }

    case 'queue_add': {
      const roomCode = PEER_ROOM.get(peerId);
      if (!roomCode) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not in a room' }));
        return;
      }
      const room = ROOMS.get(roomCode);
      if (!room) return;

      // Only host can prevent queue additions (we allow all for now)
      const entry: QueueEntry = {
        id: randomBytes(4).toString('hex'),
        streamId: msg.streamId,
        title: msg.title,
        category: msg.category,
        poster: msg.poster || '',
        embedUrl: msg.embedUrl,
        provider: msg.provider,
        addedBy: peerId,
        addedByName: (ws as any).__name,
        addedAt: Date.now(),
      };
      room.queue.push(entry);
      room.lastActivity = Date.now();

      broadcastToRoom(roomCode, {
        type: 'queue_updated',
        entry,
        queue: room.queue,
      });
      break;
    }

    case 'queue_remove': {
      const roomCode = PEER_ROOM.get(peerId);
      if (!roomCode) return;
      const room = ROOMS.get(roomCode);
      if (!room) return;

      room.queue = room.queue.filter((e) => e.id !== msg.entryId);
      room.lastActivity = Date.now();

      broadcastToRoom(roomCode, {
        type: 'queue_updated',
        queue: room.queue,
      });
      break;
    }

    case 'queue_reorder': {
      const roomCode = PEER_ROOM.get(peerId);
      if (!roomCode) return;
      const room = ROOMS.get(roomCode);
      if (!room || peerId !== room.hostId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Only host can reorder' }));
        return;
      }

      room.queue = msg.queue;
      room.lastActivity = Date.now();

      broadcastToRoom(roomCode, {
        type: 'queue_updated',
        queue: room.queue,
      });
      break;
    }

    case 'play_next': {
      const roomCode = PEER_ROOM.get(peerId);
      if (!roomCode) return;
      const room = ROOMS.get(roomCode);
      if (!room) return;

      room.currentStream = msg.currentStream;
      room.lastActivity = Date.now();

      broadcastToRoom(roomCode, {
        type: 'play_next',
        currentStream: msg.currentStream,
        queue: room.queue,
      });
      break;
    }

    case 'sync_play': {
      const roomCode = PEER_ROOM.get(peerId);
      if (!roomCode) return;
      broadcastToRoom(roomCode, {
        type: 'sync_play',
        time: msg.time,
        by: peerId,
      });
      break;
    }

    case 'sync_pause': {
      const roomCode = PEER_ROOM.get(peerId);
      if (!roomCode) return;
      broadcastToRoom(roomCode, {
        type: 'sync_pause',
        time: msg.time,
        by: peerId,
      });
      break;
    }

    case 'sync_seek': {
      const roomCode = PEER_ROOM.get(peerId);
      if (!roomCode) return;
      broadcastToRoom(roomCode, {
        type: 'sync_seek',
        time: msg.time,
        by: peerId,
      });
      break;
    }

    case 'kick': {
      const roomCode = PEER_ROOM.get(peerId);
      if (!roomCode) return;
      const room = ROOMS.get(roomCode);
      if (!room || peerId !== room.hostId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Only host can kick' }));
        return;
      }

      const targetWs = Array.from(room.peers.values()).find(
        (w) => (w as any).__id === msg.peerId
      );
      if (targetWs) {
        targetWs.send(JSON.stringify({ type: 'kicked', roomCode }));
        targetWs.close();
        room.peers.delete(msg.peerId);
        PEER_ROOM.delete(msg.peerId);
      }

      room.lastActivity = Date.now();
      broadcastToRoom(roomCode, {
        type: 'peer_left',
        peerId: msg.peerId,
        peers: getRoomPeers(roomCode),
      });
      break;
    }

    case 'host_transfer': {
      const roomCode = PEER_ROOM.get(peerId);
      if (!roomCode) return;
      const room = ROOMS.get(roomCode);
      if (!room || peerId !== room.hostId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Only host can transfer' }));
        return;
      }

      const targetWs = Array.from(room.peers.values()).find(
        (w) => (w as any).__id === msg.targetId
      );
      if (targetWs) {
        room.hostId = msg.targetId;
        room.lastActivity = Date.now();
        broadcastToRoom(roomCode, {
          type: 'host_transferred',
          newHostId: msg.targetId,
          peers: getRoomPeers(roomCode),
        });
      }
      break;
    }

    case 'webrtc_offer':
    case 'webrtc_answer':
    case 'webrtc_ice': {
      const roomCode = PEER_ROOM.get(peerId);
      if (!roomCode) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not in a room' }));
        return;
      }

      broadcastToRoom(roomCode, {
        type: msg.type,
        from: peerId,
        data: msg.data,
        targetId: msg.targetId || null,
      });
      break;
    }

    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
  }
}

function removePeerFromRoom(roomCode: string, peerId: string, ws?: WebSocket) {
  const room = ROOMS.get(roomCode);
  if (!room) return;

  room.peers.delete(peerId);
  PEER_ROOM.delete(peerId);
  room.lastActivity = Date.now();

  // If host left, transfer to next oldest peer
  if (peerId === room.hostId && room.peers.size > 0) {
    const newHostId = Array.from(room.peers.keys()).sort((a, b) => {
      const aWs = room.peers.get(a);
      const bWs = room.peers.get(b);
      return ((bWs as any).__joinedAt || 0) - ((aWs as any).__joinedAt || 0);
    })[0];
    room.hostId = newHostId;
    broadcastToRoom(roomCode, {
      type: 'host_transferred',
      newHostId,
      peers: getRoomPeers(roomCode),
    });
  } else if (room.peers.size === 0) {
    cleanupRoom(roomCode);
    return;
  }

  broadcastToRoom(roomCode, {
    type: 'peer_left',
    peerId,
    peers: getRoomPeers(roomCode),
  });
}

function broadcastToRoom(roomCode: string, message: any, excludeId?: string) {
  const room = ROOMS.get(roomCode);
  if (!room) return;

  const data = JSON.stringify(message);
  room.peers.forEach((peerWs, id) => {
    if (id !== excludeId && peerWs.readyState === WebSocket.OPEN) {
      try { peerWs.send(data); } catch {}
    }
  });
}

// Periodic cleanup of inactive rooms
setInterval(() => {
  const now = Date.now();
  ROOMS.forEach((room, code) => {
    if (now - room.lastActivity > 60 * 60 * 1000) {
      cleanupRoom(code);
    }
  });
}, 5 * 60 * 1000);
