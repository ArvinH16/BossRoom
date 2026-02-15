import { create } from 'zustand';
import { RANDOM_AVATAR_ID, randomAvatarId } from '@bossroom/shared-types';
import { gameSocket } from '@/lib/websocket';

interface SettingsState {
  /** The user's preference — may be 'random' */
  avatarPreference: string;
  /** The resolved avatar actually being rendered this session */
  avatarId: string;
  /** TTS voice preset */
  voiceId: string;

  /** Called when server sends the player's saved setting + resolved avatar */
  setAvatarFromServer: (preference: string, resolvedAvatarId: string) => void;
  selectAvatar: (id: string) => void;
  /** Hydrate voice from server on join */
  setVoiceFromServer: (voiceId: string) => void;
  selectVoice: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  avatarPreference: RANDOM_AVATAR_ID,
  avatarId: randomAvatarId(),
  voiceId: 'Loretta',

  setAvatarFromServer: (preference, resolvedAvatarId) => set({
    avatarPreference: preference,
    avatarId: resolvedAvatarId,
  }),

  selectAvatar: (id) => {
    const resolved = id === RANDOM_AVATAR_ID ? randomAvatarId() : id;
    set({ avatarPreference: id, avatarId: resolved });
    gameSocket.send({ type: 'player:updateSettings', payload: { avatarId: id } });
  },

  setVoiceFromServer: (voiceId) => set({ voiceId }),

  selectVoice: (id) => {
    set({ voiceId: id });
    gameSocket.send({ type: 'player:updateSettings', payload: { voiceId: id } });
  },
}));
