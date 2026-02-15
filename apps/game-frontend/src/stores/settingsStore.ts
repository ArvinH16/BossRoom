import { create } from 'zustand';
import { DEFAULT_AVATAR_ID } from '@bossroom/shared-types';
import { gameSocket } from '@/lib/websocket';

interface SettingsState {
  avatarId: string;
  settingsPanelOpen: boolean;

  setAvatarIdLocal: (id: string) => void;
  selectAvatar: (id: string) => void;
  toggleSettingsPanel: () => void;
  closeSettingsPanel: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  avatarId: DEFAULT_AVATAR_ID,
  settingsPanelOpen: false,

  setAvatarIdLocal: (id) => set({ avatarId: id }),

  selectAvatar: (id) => {
    set({ avatarId: id });
    gameSocket.send({ type: 'player:updateSettings', payload: { avatarId: id } });
  },

  toggleSettingsPanel: () => set((s) => ({ settingsPanelOpen: !s.settingsPanelOpen })),

  closeSettingsPanel: () => set({ settingsPanelOpen: false }),
}));
