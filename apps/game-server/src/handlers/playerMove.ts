import { WebSocket } from 'ws';
import * as playerState from '../state/playerState.js';
import { log } from '../logger.js';

export function handlePlayerMove(
  ws: WebSocket,
  payload: { position: [number, number, number]; rotation: number; animation: string },
) {
  const uid = playerState.getUidByWs(ws);
  if (!uid) return;

  // Validate position and rotation
  const { position, rotation, animation } = payload;
  if (
    !position.every((v) => Number.isFinite(v) && v >= -100 && v <= 100) ||
    !Number.isFinite(rotation) ||
    rotation < -2 * Math.PI ||
    rotation > 2 * Math.PI
  ) {
    log.warn('Invalid player:move data', payload);
    return;
  }

  playerState.updatePosition(uid, position, rotation, animation);
  playerState.broadcast(
    { type: 'player:moved', payload: { playerId: uid, ...payload } },
    uid,
  );
}
