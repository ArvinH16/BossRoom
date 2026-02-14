export type AgentModel = 'claude' | 'gpt-4o' | 'gemini';

/** Maps our internal model names to Cloudflare AI Gateway provider/model format */
export const GATEWAY_MODEL_MAP: Record<AgentModel, string> = {
  'claude': 'anthropic/claude-sonnet-4-5',
  'gpt-4o': 'openai/gpt-4o',
  'gemini': 'google/gemini-2.5-pro',
} as const;

export type AgentZone = 'communications' | 'project-ops' | 'calendar' | 'research' | 'creative' | 'command';
export type AgentStatus = 'idle' | 'listening' | 'thinking' | 'working' | 'error';

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: AgentModel;
  composioTools: string[];
  zone: AgentZone;
  personality: string;
  avatarConfig: {
    color: string;
    position: [number, number, number];
  };
}
