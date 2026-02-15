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
import { handlePlayerJoin } from './handlers/playerJoin.js';
import { handlePlayerMove } from './handlers/playerMove.js';
import { handleAgentInteract, handleAgentMessage, handleAgentStopInteract } from './handlers/agentHandlers.js';

// --- Composition Root ---
const playerModule = createPlayerModule();
const userModule = createUserModule({ db });
const agentRepo = createAgentRepository();
const conversationModule = createConversationModule({ db, agentRepo });
const agentModule = createAgentModule({
  agentRepo,
  conversationService: conversationModule.service,
  playerService: playerModule.service,
});

const players = playerModule.service;
const agents = agentModule.service;
const userRepo = userModule.repository;

// --- HTTP + WebSocket Server ---
const PORT = env.PORT;

const server = http.createServer((req, res) => {
  if (handleComposioAuthRoutes(req, res)) return;

  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
  });
  res.end('BossRoom Game Server');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  log.debug('[ws] new connection');

  ws.on('message', async (data: Buffer) => {
    try {
      const raw = JSON.parse(data.toString());
      const parsed = clientMessageSchema.safeParse(raw);
      if (!parsed.success) {
        log.warn('[ws] invalid client message:', parsed.error.issues);
        return;
      }
      log.debug(`[ws] recv ${parsed.data.type}`);
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
    case 'agent:interact':
      return handleAgentInteract(ws, msg.payload, { players, agents });
    case 'agent:message':
      return handleAgentMessage(ws, msg.payload, { players, agents });
    case 'agent:stopInteract':
      return handleAgentStopInteract(ws, msg.payload, { players, agents });
  }
}

server.listen(PORT, () => {
  log.info(`BossRoom game server on ws://localhost:${PORT}`);
});
