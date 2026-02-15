import type { WebSocket } from 'ws';
import { RANDOM_AVATAR_ID, randomAvatarId } from '@bossroom/shared-types';
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

  const preference = payload.avatarId || RANDOM_AVATAR_ID;
  const resolved = preference === RANDOM_AVATAR_ID ? randomAvatarId() : preference;

  // Persist the raw preference (e.g. 'random') so it survives reconnects
  await userRepo.updateSettings(uid, { avatarId: preference });
  players.updateAvatarId(uid, resolved);
  players.broadcast(
    { type: 'player:avatarChanged', payload: { playerId: uid, avatarId: resolved } },
    uid,
  );

  log.info(`[settings] ${uid} avatar → ${resolved} (pref: ${preference})`);
}
