'use client';

import { create } from 'zustand';
import type { DynamicAgent } from '@bossroom/shared-types';

export type WorkspacePhase = 'reception' | 'building' | 'ready';

interface WorkspaceState {
  phase: WorkspacePhase;
  dynamicAgents: DynamicAgent[];
  buildQueue: string[];              // agent IDs in build order
  currentlyBuilding: string | null;
  builtAgentIds: Set<string>;
  taskSummary: string;

  // Actions
  startBuild: (agents: DynamicAgent[], taskSummary: string) => void;
  markZoneBuilt: (agentId: string) => void;
  completeBuild: () => void;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  phase: 'reception',
  dynamicAgents: [],
  buildQueue: [],
  currentlyBuilding: null,
  builtAgentIds: new Set(),
  taskSummary: '',

  startBuild: (agents, taskSummary) => {
    const queue = agents.map((a) => a.agentId);
    set({
      phase: 'building',
      dynamicAgents: agents,
      buildQueue: queue,
      currentlyBuilding: queue[0] ?? null,
      builtAgentIds: new Set(),
      taskSummary,
    });
  },

  markZoneBuilt: (agentId) => {
    const state = get();
    const newBuilt = new Set(state.builtAgentIds);
    newBuilt.add(agentId);

    // Find next in queue
    const idx = state.buildQueue.indexOf(agentId);
    const nextId = idx >= 0 ? state.buildQueue[idx + 1] ?? null : null;

    set({
      builtAgentIds: newBuilt,
      currentlyBuilding: nextId,
    });
  },

  completeBuild: () => {
    set({
      phase: 'ready',
      currentlyBuilding: null,
    });
  },

  reset: () =>
    set({
      phase: 'reception',
      dynamicAgents: [],
      buildQueue: [],
      currentlyBuilding: null,
      builtAgentIds: new Set(),
      taskSummary: '',
    }),
}));
