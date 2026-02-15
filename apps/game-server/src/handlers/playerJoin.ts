import { WebSocket } from 'ws';
import { verifyToken } from '../auth/firebase-admin.js';
import { log } from '../logger.js';
import type { PlayerState, WorldState } from '@bossroom/shared-types';
import type { PlayerService } from '../domains/players/service.js';
import type { AgentService } from '../domains/agents/service.js';
import type { UserRepository } from '../domains/users/repository.js';

interface PlayerJoinDeps {
  players: PlayerService;
  agents: AgentService;
  userRepo: UserRepository;
}

export async function handlePlayerJoin(
  ws: WebSocket,
  payload: { username: string; token: string },
  deps: PlayerJoinDeps,
) {
  const { players, agents, userRepo } = deps;

  // 1. Verify token
  let verifiedUser;
  try {
    verifiedUser = await verifyToken(payload.token);
  } catch (err) {
    log.warn('[auth] rejected:', err);
    players.send(ws, { type: 'auth:error', payload: { message: 'Invalid or expired token' } });
    ws.close();
    return;
  }

  const uid = verifiedUser.uid;
  log.info(`[join] ${uid} (${verifiedUser.email})`);

  // 2. Upsert user in DB
  try {
    await userRepo.upsert({
      id: uid,
      email: verifiedUser.email,
      displayName: verifiedUser.displayName,
      photoURL: verifiedUser.photoURL,
    });
  } catch (err) {
    log.error('[db] user upsert failed:', err);
    players.send(ws, { type: 'auth:error', payload: { message: 'Server error' } });
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
  players.addPlayer(uid, player, ws);

  const worldState: WorldState = {
    players: players.getWorldPlayers(),
    agents: agents.getAgentStates(),
  };
  players.send(ws, { type: 'world:state', payload: worldState });
  players.broadcast({ type: 'player:joined', payload: player }, uid);
}
