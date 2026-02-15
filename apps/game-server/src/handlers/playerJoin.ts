import { WebSocket } from 'ws';
import { verifyToken } from '../auth/firebase-admin.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { log } from '../logger.js';
import * as playerState from '../state/playerState.js';
import type { PlayerState, WorldState } from '@bossroom/shared-types';
import { AgentManager } from '../agents/AgentManager.js';

export async function handlePlayerJoin(
  ws: WebSocket,
  payload: { username: string; token: string },
  agentManager: AgentManager,
) {
  // 1. Verify token
  let verifiedUser;
  try {
    verifiedUser = await verifyToken(payload.token);
  } catch (err) {
    log.warn('[auth] rejected:', err);
    playerState.send(ws, { type: 'auth:error', payload: { message: 'Invalid or expired token' } });
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
    playerState.send(ws, { type: 'auth:error', payload: { message: 'Server error' } });
    ws.close();
    return;
  }

  // 3. Register connection
  const player: PlayerState = {
    id: uid,
    username: verifiedUser.displayName ?? verifiedUser.email,
    email: verifiedUser.email,
    photoURL: verifiedUser.photoURL,
    position: [0, 2, 5],
    rotation: 0,
    animation: 'idle',
  };
  playerState.addPlayer(uid, player, ws);

  const worldState: WorldState = {
    players: playerState.getWorldPlayers(),
    agents: agentManager.getAgentStates(),
  };
  playerState.send(ws, { type: 'world:state', payload: worldState });
  playerState.broadcast({ type: 'player:joined', payload: player }, uid);
}
