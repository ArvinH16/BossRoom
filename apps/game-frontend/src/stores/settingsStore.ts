import { create } from 'zustand';
import { randomAvatarId } from '@bossroom/shared-types';
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
  avatarId: randomAvatarId(),
  settingsPanelOpen: false,

  setAvatarIdLocal: (id) => set({ avatarId: id }),

  selectAvatar: (id) => {
    set({ avatarId: id });
    gameSocket.send({ type: 'player:updateSettings', payload: { avatarId: id } });
  },

  toggleSettingsPanel: () => set((s) => ({ settingsPanelOpen: !s.settingsPanelOpen })),

  closeSettingsPanel: () => set({ settingsPanelOpen: false }),
}));
