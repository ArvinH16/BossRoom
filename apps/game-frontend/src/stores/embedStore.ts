'use client';

import { create } from 'zustand';

interface EmbedTab {
  id: string;
  url: string;
  title: string;
  type: 'document' | 'board' | 'spreadsheet' | 'presentation' | 'other';
  agentId: string;
  agentName: string;
}

interface EmbedState {
  embeds: EmbedTab[];
  activeEmbedId: string | null;
  panelOpen: boolean;
  addEmbed: (embed: EmbedTab) => void;
  removeEmbed: (id: string) => void;
  setActiveEmbed: (id: string) => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  removeEmbedsByAgentIds: (agentIds: string[]) => void;
  clearAll: () => void;
}

export const useEmbedStore = create<EmbedState>((set, get) => ({
  embeds: [],
  activeEmbedId: null,
  panelOpen: false,

  addEmbed: (embed) => {
    const state = get();
    // Deduplicate by URL: if same URL exists, just focus that tab
    const existing = state.embeds.find((e) => e.url === embed.url);
    if (existing) {
      set({ activeEmbedId: existing.id });
      return;
    }
    // Don't auto-open sidebar — the 3D screen shows the embed first.
    // User expands to sidebar manually.
    set({
      embeds: [...state.embeds, embed],
      activeEmbedId: embed.id,
    });
  },

  removeEmbed: (id) => {
    const state = get();
    const filtered = state.embeds.filter((e) => e.id !== id);
    const wasActive = state.activeEmbedId === id;
    set({
      embeds: filtered,
      activeEmbedId: wasActive
        ? (filtered[filtered.length - 1]?.id ?? null)
        : state.activeEmbedId,
      panelOpen: filtered.length > 0 ? state.panelOpen : false,
    });
  },

  setActiveEmbed: (id) => set({ activeEmbedId: id }),

  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),

  openPanel: () => set({ panelOpen: true }),

  closePanel: () => set({ panelOpen: false }),

  removeEmbedsByAgentIds: (agentIds) => {
    const idsSet = new Set(agentIds);
    set((state) => {
      const filtered = state.embeds.filter((e) => !idsSet.has(e.agentId));
      return {
        embeds: filtered,
        activeEmbedId: filtered.find((e) => e.id === state.activeEmbedId)
          ? state.activeEmbedId
          : (filtered[filtered.length - 1]?.id ?? null),
        panelOpen: filtered.length > 0 ? state.panelOpen : false,
      };
    });
  },

  clearAll: () => set({ embeds: [], activeEmbedId: null, panelOpen: false }),
}));
