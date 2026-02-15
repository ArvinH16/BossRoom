import { create } from 'zustand';
import { RANDOM_AVATAR_ID, randomAvatarId } from '@bossroom/shared-types';
import { gameSocket } from '@/lib/websocket';

interface SettingsState {
  /** The user's preference — may be 'random' */
  avatarPreference: string;
  /** The resolved avatar actually being rendered this session */
  avatarId: string;
  settingsPanelOpen: boolean;

  /** Called when server sends the player's saved setting + resolved avatar */
  setAvatarFromServer: (preference: string, resolvedAvatarId: string) => void;
  selectAvatar: (id: string) => void;
  toggleSettingsPanel: () => void;
  closeSettingsPanel: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  avatarPreference: RANDOM_AVATAR_ID,
  avatarId: randomAvatarId(),
  settingsPanelOpen: false,

  setAvatarFromServer: (preference, resolvedAvatarId) => set({
    avatarPreference: preference,
    avatarId: resolvedAvatarId,
  }),

  selectAvatar: (id) => {
    const resolved = id === RANDOM_AVATAR_ID ? randomAvatarId() : id;
    set({ avatarPreference: id, avatarId: resolved });
    gameSocket.send({ type: 'player:updateSettings', payload: { avatarId: id } });
  },

  toggleSettingsPanel: () => set((s) => ({ settingsPanelOpen: !s.settingsPanelOpen })),

  closeSettingsPanel: () => set({ settingsPanelOpen: false }),
}));
