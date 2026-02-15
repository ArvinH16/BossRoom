import { env } from './env.js';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { clientMessageSchema, type ClientMessage } from '@bossroom/shared-types';
import { handleComposioAuthRoutes } from './http/composio-auth.js';
import { log } from './logger.js';
import { db } from './db/client.js';
import { createPlayerModule } from './domains/players/module.js';
import { createUserModule } from './domains/users/module.js';
import { createAgentRepository } from './domains/agents/repository.js';
import { createConversationModule } from './domains/conversations/module.js';
import { createAgentModule } from './domains/agents/module.js';
import { createSkillModule } from './domains/skills/module.js';
import { createScratchpadService } from './domains/scratchpad/service.js';
import { handlePlayerJoin } from './handlers/playerJoin.js';
import { handlePlayerMove } from './handlers/playerMove.js';
import { handlePlayerSettings } from './handlers/playerSettings.js';
import { handleAgentInteract, handleAgentMessage, handleAgentStopInteract } from './handlers/agentHandlers.js';

// --- Composition Root ---
const playerModule = createPlayerModule();
const userModule = createUserModule({ db });
const agentRepo = createAgentRepository();
const conversationModule = createConversationModule({ db, agentRepo });
const skillModule = createSkillModule(db);
const scratchpadService = createScratchpadService();
const agentModule = createAgentModule({
  agentRepo,
  conversationService: conversationModule.service,
  playerService: playerModule.service,
  skillService: skillModule.skillService,
  scratchpadService,
});

const players = playerModule.service;
const agents = agentModule.service;
const userRepo = userModule.repository;

// --- Initialize skills (seed receptionist defaults) ---
skillModule.skillService.initialize().then(() => {
  log.info('[startup] Skill service initialized');
}).catch((err) => {
  log.error('[startup] Skill service init failed:', err);
});

// --- HTTP + WebSocket Server ---
const PORT = env.PORT;
const ALLOWED_ORIGIN = env.ALLOWED_ORIGIN || '*';
const PING_INTERVAL_MS = 30_000; // 30s keepalive for Cloud Run
const alive = new WeakSet<WebSocket>();

const server = http.createServer(async (req, res) => {
  // CORS headers for cross-origin requests from Vercel
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (handleComposioAuthRoutes(req, res)) return;

  if (req.method === 'GET' && req.url === '/api/deepgram/token') {
    const deepgramKey = env.DEEPGRAM_API_KEY;
    if (!deepgramKey) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Deepgram not configured' }));
      return;
    }
    // Return the API key directly as the access_token (hackathon shortcut)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ access_token: deepgramKey }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('BossRoom Game Server');
});

const wss = new WebSocketServer({ server });

// Keepalive: ping every 30s to prevent Cloud Run idle timeout (default 5min)
const pingTimer = setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.has(ws)) {
      ws.terminate();
      continue;
    }
    alive.delete(ws);
    ws.ping();
  }
}, PING_INTERVAL_MS);

wss.on('close', () => clearInterval(pingTimer));

wss.on('connection', (ws: WebSocket) => {
  log.debug('[ws] new connection');
  alive.add(ws);
  ws.on('pong', () => alive.add(ws));

  ws.on('message', async (data: Buffer) => {
    try {
      const raw = JSON.parse(data.toString());
      const parsed = clientMessageSchema.safeParse(raw);
      if (!parsed.success) {
        log.warn('[ws] invalid client message:', parsed.error.issues);
        return;
      }
      if (parsed.data.type !== 'player:move') log.debug(`[ws] recv ${parsed.data.type}`);
      await handleMessage(ws, parsed.data);
    } catch (err) {
      log.error('[ws] unparseable message:', err);
    }
  });

  ws.on('close', () => {
    const uid = players.removeByWs(ws);
    if (uid) {
      players.broadcast({ type: 'player:left', payload: { playerId: uid } });
      agents.handleDisconnect(uid);
      log.info(`[ws] closed ${uid}`);
    } else {
      log.debug('[ws] closed (unauthenticated)');
    }
  });

  ws.on('error', (err) => {
    const uid = players.getUidByWs(ws);
    log.error(`[ws] error ${uid ?? 'unknown'}:`, err);
  });
});

async function handleMessage(ws: WebSocket, msg: ClientMessage) {
  switch (msg.type) {
    case 'player:join':
      return handlePlayerJoin(ws, msg.payload, { players, agents, userRepo });
    case 'player:move':
      return handlePlayerMove(ws, msg.payload, players);
    case 'player:updateSettings':
      return handlePlayerSettings(ws, msg.payload, { players, userRepo });
    case 'agent:interact':
      return handleAgentInteract(ws, msg.payload, { players, agents });
    case 'agent:message':
      log.info('[DEBUG-FIX] agent:message received:', JSON.stringify(msg.payload));
      return handleAgentMessage(ws, msg.payload, { players, agents });
    case 'agent:stopInteract':
      return handleAgentStopInteract(ws, msg.payload, { players, agents });
    case 'voice:talking': {
      const uid = players.getUidByWs(ws);
      if (!uid) return;
      players.broadcast(
        { type: 'voice:playerTalking', payload: { playerId: uid, isTalking: msg.payload.isTalking } },
        uid,
      );
      return;
    }
    case 'workspace:userNote': {
      const uid = players.getUidByWs(ws);
      if (!uid) return;
      const player = players.getPlayer(uid);
      const entry = scratchpadService.write(msg.payload.workspaceId, {
        authorType: 'user',
        authorId: uid,
        authorName: player?.username ?? 'Unknown',
        authorColor: '#818CF8',
        content: msg.payload.content,
      });
      players.send(ws, {
        type: 'workspace:scratchpadEntry',
        payload: {
          workspaceId: msg.payload.workspaceId,
          entry: {
            id: entry.id,
            authorType: entry.authorType,
            authorName: entry.authorName,
            authorColor: entry.authorColor,
            content: entry.content,
            timestamp: entry.timestamp,
          },
        },
      });
      // Trigger scratchpad watcher for user notes too
      agents.onScratchpadWrite(
        msg.payload.workspaceId,
        player?.username ?? 'Unknown',
        msg.payload.content,
        uid,
        ws,
        (m) => players.send(ws, m),
      );
      return;
    }
    case 'conversations:reset': {
      const uid = players.getUidByWs(ws);
      if (!uid) return;
      await conversationModule.service.resetConversations(uid, msg.payload.agentIds);
      log.info(`[conversations] reset ${msg.payload.agentIds.length} conversations for ${uid}`);
      return;
    }
  }
}

server.listen(PORT, () => {
  log.info(`BossRoom game server on ws://localhost:${PORT}`);
});
