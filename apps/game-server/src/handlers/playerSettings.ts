import type { WebSocket } from 'ws';
import { randomAvatarId } from '@bossroom/shared-types';
import { log } from '../logger.js';
import type { PlayerService } from '../domains/players/service.js';
import type { UserRepository } from '../domains/users/repository.js';

interface PlayerSettingsDeps {
  players: PlayerService;
  userRepo: UserRepository;
}

export async function handlePlayerSettings(
  ws: WebSocket,
  payload: { avatarId: string },
  deps: PlayerSettingsDeps,
) {
  const { players, userRepo } = deps;
  const uid = players.getUidByWs(ws);
  if (!uid) return;

  const avatarId = payload.avatarId || randomAvatarId();

  await userRepo.updateSettings(uid, { avatarId });
  players.updateAvatarId(uid, avatarId);
  players.broadcast(
    { type: 'player:avatarChanged', payload: { playerId: uid, avatarId } },
    uid,
  );

  log.info(`[settings] ${uid} avatar → ${avatarId}`);
}
