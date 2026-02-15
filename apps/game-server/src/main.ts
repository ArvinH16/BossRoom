import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  ClientMessage,
  ServerMessage,
  PlayerState,
  WorldState,
} from '@bossroom/shared-types';
import { AgentManager } from './agents/AgentManager.js';

const PORT = parseInt(process.env['PORT'] || '8080', 10);

// --- In-memory state ---
const players = new Map<string, PlayerState>();
const connections = new Map<string, WebSocket>();
let nextPlayerId = 1;

const agentManager = new AgentManager();

const server = http.createServer((_req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
  });
  res.end('BossRoom Game Server');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  const playerId = `player-${nextPlayerId++}`;
  connections.set(playerId, ws);
  console.log(`[join] ${playerId}`);

  ws.on('message', (data: Buffer) => {
    try {
      const msg: ClientMessage = JSON.parse(data.toString());
      handleMessage(playerId, msg, ws);
    } catch (err) {
      console.error('Bad message:', err);
    }
  });

  ws.on('close', () => {
    players.delete(playerId);
    connections.delete(playerId);
    broadcast({ type: 'player:left', payload: { playerId } }, playerId);
    agentManager.handleDisconnect(playerId);
    console.log(`[leave] ${playerId}`);
  });
});

function handleMessage(playerId: string, msg: ClientMessage, ws: WebSocket) {
  switch (msg.type) {
    case 'player:join': {
      const player: PlayerState = {
        id: playerId,
        username: msg.payload.username,
        position: [0, 2, 5],
        rotation: 0,
        animation: 'idle',
      };
      players.set(playerId, player);

      const worldState: WorldState = {
        players: Object.fromEntries(players),
        agents: agentManager.getAgentStates(),
      };
      send(ws, { type: 'world:state', payload: worldState });
      broadcast({ type: 'player:joined', payload: player }, playerId);
      break;
    }

    case 'player:move': {
      const p = players.get(playerId);
      if (p) {
        p.position = msg.payload.position;
        p.rotation = msg.payload.rotation;
        p.animation = msg.payload.animation;
        broadcast(
          {
            type: 'player:moved',
            payload: { playerId, ...msg.payload },
          },
          playerId,
        );
      }
      break;
    }

    case 'agent:interact': {
      agentManager.startInteraction(playerId, msg.payload.agentId, ws);
      break;
    }

    case 'agent:message': {
      agentManager.handleMessage(
        playerId,
        msg.payload.agentId,
        msg.payload.conversationId,
        msg.payload.content,
        ws,
        (statusMsg: ServerMessage) => broadcast(statusMsg),
      );
      break;
    }

    case 'agent:stopInteract': {
      agentManager.stopInteraction(playerId, msg.payload.agentId);
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
  console.log(`BossRoom game server on ws://localhost:${PORT}`);
});
