import { WebSocket } from 'ws';
import type { PlayerState, ServerMessage } from '@bossroom/shared-types';
import { log } from '../logger.js';

const players = new Map<string, PlayerState>();
const connections = new Map<string, WebSocket>();
const wsToUid = new Map<WebSocket, string>();

export function addPlayer(uid: string, state: PlayerState, ws: WebSocket): void {
  players.set(uid, state);
  connections.set(uid, ws);
  wsToUid.set(ws, uid);
}

export function removeByWs(ws: WebSocket): string | undefined {
  const uid = wsToUid.get(ws);
  if (uid) {
    players.delete(uid);
    connections.delete(uid);
    wsToUid.delete(ws);
  }
  return uid;
}

export function getUidByWs(ws: WebSocket): string | undefined {
  return wsToUid.get(ws);
}

export function getPlayer(uid: string): PlayerState | undefined {
  return players.get(uid);
}

export function getConnection(uid: string): WebSocket | undefined {
  return connections.get(uid);
}

export function updatePosition(uid: string, pos: [number, number, number], rotation: number, animation: string): void {
  const p = players.get(uid);
  if (p) {
    p.position = pos;
    p.rotation = rotation;
    p.animation = animation;
  }
}

export function getWorldPlayers(): Record<string, PlayerState> {
  return Object.fromEntries(players);
}

export function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    log.debug(`[ws] send ${msg.type}`);
    ws.send(JSON.stringify(msg));
  }
}

export function broadcast(msg: ServerMessage, excludeUid?: string): void {
  for (const [uid, conn] of connections) {
    if (uid !== excludeUid) send(conn, msg);
  }
}
