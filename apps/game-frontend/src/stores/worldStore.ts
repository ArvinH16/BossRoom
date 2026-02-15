import { create } from 'zustand';
import { agents as defaultAgents, type AgentData } from '@/data/agents';
import type { AgentStatus } from '@bossroom/shared-types';

export interface RemotePlayer {
  id: string;
  username: string;
  position: [number, number, number];
  rotation: number;
  animation: string;
}

interface WorldState {
  connected: boolean;
  playerId: string | null;
  agents: AgentData[];
  nearestAgent: string | null;
  remotePlayers: Record<string, RemotePlayer>;

  setNearestAgent: (id: string | null) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
  reset: () => void;

  // Internal (called by message handler)
  setConnected: (connected: boolean, playerId?: string) => void;
  setAgents: (agents: AgentData[]) => void;
  setRemotePlayers: (players: Record<string, RemotePlayer>) => void;
  addRemotePlayer: (player: RemotePlayer) => void;
  updateRemotePlayer: (id: string, position: [number, number, number], rotation: number, animation: string) => void;
  removeRemotePlayer: (id: string) => void;
}

export const useWorldStore = create<WorldState>((set) => ({
  connected: false,
  playerId: null,
  agents: defaultAgents,
  nearestAgent: null,
  remotePlayers: {},

  setNearestAgent: (id) => set({ nearestAgent: id }),

  updateAgentStatus: (agentId, status) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, status } : a,
      ),
    })),

  reset: () =>
    set({
      connected: false,
      playerId: null,
      agents: defaultAgents,
      nearestAgent: null,
      remotePlayers: {},
    }),

  setConnected: (connected, playerId) =>
    set(playerId ? { connected, playerId } : { connected }),

  setAgents: (agents) => set({ agents }),

  setRemotePlayers: (players) => set({ remotePlayers: players }),

  addRemotePlayer: (player) =>
    set((state) => ({
      remotePlayers: { ...state.remotePlayers, [player.id]: player },
    })),

  updateRemotePlayer: (id, position, rotation, animation) =>
    set((state) => {
      const existing = state.remotePlayers[id];
      if (!existing) return state;
      return {
        remotePlayers: {
          ...state.remotePlayers,
          [id]: { ...existing, position, rotation, animation },
        },
      };
    }),

  removeRemotePlayer: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.remotePlayers;
      return { remotePlayers: rest };
    }),
}));
