import { env } from './env.js';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { clientMessageSchema, type ClientMessage } from '@bossroom/shared-types';
import { AgentManager } from './agents/AgentManager.js';
import { handleComposioAuthRoutes } from './http/composio-auth.js';
import { log } from './logger.js';
import * as playerState from './state/playerState.js';
import { handlePlayerJoin } from './handlers/playerJoin.js';
import { handlePlayerMove } from './handlers/playerMove.js';
import { handleAgentInteract, handleAgentMessage, handleAgentStopInteract } from './handlers/agentHandlers.js';

const PORT = env.PORT;
const agentManager = new AgentManager();

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
    const uid = playerState.removeByWs(ws);
    if (uid) {
      playerState.broadcast({ type: 'player:left', payload: { playerId: uid } });
      agentManager.handleDisconnect(uid);
      log.info(`[ws] closed ${uid}`);
    } else {
      log.debug('[ws] closed (unauthenticated)');
    }
  });

  ws.on('error', (err) => {
    const uid = playerState.getUidByWs(ws);
    log.error(`[ws] error ${uid ?? 'unknown'}:`, err);
  });
});

async function handleMessage(ws: WebSocket, msg: ClientMessage) {
  switch (msg.type) {
    case 'player:join':
      return handlePlayerJoin(ws, msg.payload, agentManager);
    case 'player:move':
      return handlePlayerMove(ws, msg.payload);
    case 'agent:interact':
      return handleAgentInteract(ws, msg.payload, agentManager);
    case 'agent:message':
      return handleAgentMessage(ws, msg.payload, agentManager);
    case 'agent:stopInteract':
      return handleAgentStopInteract(ws, msg.payload, agentManager);
  }
}

server.listen(PORT, () => {
  log.info(`BossRoom game server on ws://localhost:${PORT}`);
});
