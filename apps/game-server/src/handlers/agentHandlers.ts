import { WebSocket } from 'ws';
import * as playerState from '../state/playerState.js';
import { AgentManager } from '../agents/AgentManager.js';
import type { ServerMessage } from '@bossroom/shared-types';

export async function handleAgentInteract(
  ws: WebSocket,
  payload: { agentId: string },
  agentManager: AgentManager,
) {
  const uid = playerState.getUidByWs(ws);
  if (!uid) return;
  const user = playerState.getPlayer(uid);
  await agentManager.startInteraction(uid, payload.agentId, ws, user?.username ?? null);
}

export function handleAgentMessage(
  ws: WebSocket,
  payload: { agentId: string; conversationId: string; content: string },
  agentManager: AgentManager,
) {
  const uid = playerState.getUidByWs(ws);
  if (!uid) return;
  agentManager.handleMessage(
    uid,
    payload.agentId,
    payload.conversationId,
    payload.content,
    ws,
    (statusMsg: ServerMessage) => playerState.broadcast(statusMsg),
  );
}

export function handleAgentStopInteract(
  ws: WebSocket,
  payload: { agentId: string },
  agentManager: AgentManager,
) {
  const uid = playerState.getUidByWs(ws);
  if (!uid) return;
  agentManager.stopInteraction(uid, payload.agentId);
  playerState.broadcast({
    type: 'agent:statusChanged',
    payload: { agentId: payload.agentId, status: 'idle' },
  });
}
