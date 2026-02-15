import { env } from './env.js';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  clientMessageSchema,
  type ClientMessage,
  type ServerMessage,
  type PlayerState,
  type WorldState,
} from '@bossroom/shared-types';
import { AgentManager } from './agents/AgentManager.js';
import { handleComposioAuthRoutes } from './http/composio-auth.js';
import { log } from './logger.js';
import { verifyToken } from './auth/firebase-admin.js';
import { db } from './db/client.js';
import { users } from './db/schema.js';

const PORT = env.PORT;

// --- In-memory state ---
const players = new Map<string, PlayerState>();
const connections = new Map<string, WebSocket>();
const wsToUid = new Map<WebSocket, string>();

const agentManager = new AgentManager();

const server = http.createServer((req, res) => {
  // Try Composio auth routes first
  if (handleComposioAuthRoutes(req, res)) return;

  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
  });
  res.end('BossRoom Game Server');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', async (data: Buffer) => {
    try {
      const raw = JSON.parse(data.toString());
      const parsed = clientMessageSchema.safeParse(raw);
      if (!parsed.success) {
        log.warn('Invalid WS message:', parsed.error.issues);
        return;
      }
      await handleMessage(ws, parsed.data);
    } catch (err) {
      log.error('Bad message:', err);
    }
  });

  ws.on('close', () => {
    const uid = wsToUid.get(ws);
    if (uid) {
      players.delete(uid);
      connections.delete(uid);
      wsToUid.delete(ws);
      broadcast({ type: 'player:left', payload: { playerId: uid } });
      agentManager.handleDisconnect(uid);
      log.info(`[leave] ${uid}`);
    }
  });
});

async function handleMessage(ws: WebSocket, msg: ClientMessage) {
  switch (msg.type) {
    case 'player:join': {
      // 1. Verify token
      let verifiedUser;
      try {
        verifiedUser = await verifyToken(msg.payload.token);
      } catch (err) {
        log.warn('[auth] rejected:', err);
        send(ws, { type: 'auth:error', payload: { message: 'Invalid or expired token' } });
        ws.close();
        return;
      }

      const uid = verifiedUser.uid;
      log.info(`[join] ${uid} (${verifiedUser.email})`);

      // 2. Upsert user in DB
      try {
        await db.insert(users).values({
          id: uid,
          email: verifiedUser.email,
          displayName: verifiedUser.displayName,
          photoURL: verifiedUser.photoURL,
          lastLoginAt: new Date(),
        }).onConflictDoUpdate({
          target: users.id,
          set: {
            displayName: verifiedUser.displayName,
            photoURL: verifiedUser.photoURL,
            lastLoginAt: new Date(),
          },
        });
      } catch (err) {
        log.error('[db] user upsert failed:', err);
        send(ws, { type: 'auth:error', payload: { message: 'Server error' } });
        ws.close();
        return;
      }

      // 3. Register connection with real UID
      connections.set(uid, ws);
      wsToUid.set(ws, uid);

      const player: PlayerState = {
        id: uid,
        username: verifiedUser.displayName ?? verifiedUser.email,
        email: verifiedUser.email,
        photoURL: verifiedUser.photoURL,
        position: [0, 2, 5],
        rotation: 0,
        animation: 'idle',
      };
      players.set(uid, player);

      const worldState: WorldState = {
        players: Object.fromEntries(players),
        agents: agentManager.getAgentStates(),
      };
      send(ws, { type: 'world:state', payload: worldState });
      broadcast({ type: 'player:joined', payload: player }, uid);
      break;
    }

    case 'player:move': {
      const uid = wsToUid.get(ws);
      if (!uid) return;
      const p = players.get(uid);
      if (p) {
        p.position = msg.payload.position;
        p.rotation = msg.payload.rotation;
        p.animation = msg.payload.animation;
        broadcast(
          { type: 'player:moved', payload: { playerId: uid, ...msg.payload } },
          uid,
        );
      }
      break;
    }

    case 'agent:interact': {
      const uid = wsToUid.get(ws);
      if (!uid) return;
      const user = players.get(uid);
      agentManager.startInteraction(uid, msg.payload.agentId, ws, user?.username ?? null);
      break;
    }

    case 'agent:message': {
      const uid = wsToUid.get(ws);
      if (!uid) return;
      agentManager.handleMessage(
        uid,
        msg.payload.agentId,
        msg.payload.conversationId,
        msg.payload.content,
        ws,
        (statusMsg: ServerMessage) => broadcast(statusMsg),
      );
      break;
    }

    case 'agent:stopInteract': {
      const uid = wsToUid.get(ws);
      if (!uid) return;
      agentManager.stopInteraction(uid, msg.payload.agentId);
      broadcast({
        type: 'agent:statusChanged',
        payload: { agentId: msg.payload.agentId, status: 'idle' },
      });
      break;
    }
  }
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(msg: ServerMessage, excludeId?: string) {
  for (const [id, ws] of connections) {
    if (id !== excludeId) send(ws, msg);
  }
}

server.listen(PORT, () => {
  log.info(`BossRoom game server on ws://localhost:${PORT}`);
});
