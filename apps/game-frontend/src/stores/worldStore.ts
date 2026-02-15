import { create } from 'zustand';
import { agents as defaultAgents, type AgentData } from '@/data/agents';
import type { AgentStatus } from '@bossroom/shared-types';

interface WorldState {
  connected: boolean;
  playerId: string | null;
  agents: AgentData[];
  nearestAgent: string | null;

  setNearestAgent: (id: string | null) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
  reset: () => void;

  // Internal (called by message handler)
  setConnected: (connected: boolean, playerId?: string) => void;
  setAgents: (agents: AgentData[]) => void;
}

export const useWorldStore = create<WorldState>((set) => ({
  connected: false,
  playerId: null,
  agents: defaultAgents,
  nearestAgent: null,

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
    }),

  setConnected: (connected, playerId) =>
    set(playerId ? { connected, playerId } : { connected }),

  setAgents: (agents) => set({ agents }),
}));
