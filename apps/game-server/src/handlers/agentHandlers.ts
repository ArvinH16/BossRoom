import { WebSocket } from 'ws';
import type { PlayerService } from '../domains/players/service.js';
import type { AgentService } from '../domains/agents/service.js';

interface AgentHandlerDeps {
  players: PlayerService;
  agents: AgentService;
}

export async function handleAgentInteract(
  ws: WebSocket,
  payload: { agentId: string },
  deps: AgentHandlerDeps,
) {
  const { players, agents } = deps;
  const uid = players.getUidByWs(ws);
  if (!uid) return;
  const user = players.getPlayer(uid);
  await agents.handleInteraction(uid, payload.agentId, ws, user?.username ?? null);
}

export function handleAgentMessage(
  ws: WebSocket,
  payload: { agentId: string; conversationId: string; content: string; inputMode?: 'voice' | 'text' },
  deps: AgentHandlerDeps,
) {
  const { players, agents } = deps;
  const uid = players.getUidByWs(ws);
  if (!uid) return;
  agents.handleMessage(
    uid,
    payload.agentId,
    payload.conversationId,
    payload.content,
    payload.inputMode ?? 'text',
    ws,
    (statusMsg) => players.broadcast(statusMsg),
  );
}

export function handleAgentStopInteract(
  ws: WebSocket,
  payload: { agentId: string },
  deps: AgentHandlerDeps,
) {
  const { players, agents } = deps;
  const uid = players.getUidByWs(ws);
  if (!uid) return;
  agents.stopInteraction(uid, payload.agentId);
  players.broadcast({
    type: 'agent:statusChanged',
    payload: { agentId: payload.agentId, status: 'idle' },
  });
}
