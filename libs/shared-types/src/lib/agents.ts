import { z } from 'zod';

export const agentModelSchema = z.enum(['claude', 'gpt-4o', 'gemini']);
export type AgentModel = z.infer<typeof agentModelSchema>;


export const agentZoneSchema = z.enum(['communications', 'project-ops', 'calendar', 'research', 'creative', 'command']);
export type AgentZone = z.infer<typeof agentZoneSchema>;

export const agentStatusSchema = z.enum(['idle', 'listening', 'thinking', 'working', 'error']);
export type AgentStatus = z.infer<typeof agentStatusSchema>;

export const agentSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  model: agentModelSchema,
  zone: agentZoneSchema,
  personality: z.string(),
  avatarConfig: z.object({
    color: z.string(),
    position: z.tuple([z.number(), z.number(), z.number()]),
  }),
});
export type AgentSkill = z.infer<typeof agentSkillSchema>;
