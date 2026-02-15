import type { AgentStatus, AgentZone } from '@bossroom/shared-types';
import { AGENT_DEFS } from '@bossroom/shared-utils';

export interface AgentData {
  id: string;
  name: string;
  description: string;
  personality: string;
  color: string;
  position: [number, number, number];
  zone: AgentZone;
  modelUrl: string;
  suggestedPrompts: string[];
  status: AgentStatus;
}

export const statusColors: Record<AgentStatus, string> = {
  idle: '#4AD97A',
  listening: '#4A90D9',
  thinking: '#D9D94A',
  working: '#FF8C00',
  error: '#D94A4A',
};

export const statusLabels: Record<AgentStatus, string> = {
  idle: '',
  listening: 'Listening',
  thinking: 'Thinking...',
  working: 'Working...',
  error: 'Error!',
};

export const zoneColors: Record<string, string> = {
  communications: '#4A90D9',
  'project-ops': '#D94A4A',
  calendar: '#4AD97A',
};

export const agents: AgentData[] = AGENT_DEFS.map((def) => ({
  id: def.id,
  name: def.name,
  description: def.description,
  personality: def.personality,
  color: def.color,
  position: def.avatarConfig.position,
  zone: def.zone,
  modelUrl: def.modelUrl,
  suggestedPrompts: def.suggestedPrompts,
  status: 'idle' as AgentStatus,
}));
