import type { AgentStatus } from '@bossroom/shared-types';
import { AGENT_DEFS, type AgentDef } from '@bossroom/shared-utils';

type AgentWithStatus = AgentDef & { status: AgentStatus };

export function createAgentRepository() {
  const agents = new Map<string, AgentWithStatus>();

  // Initialize from AGENT_DEFS
  for (const agent of AGENT_DEFS) {
    agents.set(agent.id, { ...agent, status: 'idle' });
  }

  return {
    getAll(): Record<string, AgentWithStatus> {
      const result: Record<string, AgentWithStatus> = {};
      for (const [id, agent] of agents) {
        result[id] = agent;
      }
      return result;
    },

    get(id: string): AgentWithStatus | undefined {
      return agents.get(id);
    },

    setStatus(id: string, status: AgentStatus): void {
      const agent = agents.get(id);
      if (agent) agent.status = status;
    },
  };
}

export type AgentRepository = ReturnType<typeof createAgentRepository>;
