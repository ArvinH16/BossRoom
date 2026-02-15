import { z } from 'zod';
import { agentSkillSchema, agentStatusSchema } from './agents.js';

const positionSchema = z.tuple([z.number(), z.number(), z.number()]);

// --- Client → Server ---
export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('player:join'), payload: z.object({ username: z.string(), token: z.string() }) }),
  z.object({ type: z.literal('player:move'), payload: z.object({ position: positionSchema, rotation: z.number(), animation: z.string() }) }),
  z.object({ type: z.literal('agent:interact'), payload: z.object({ agentId: z.string() }) }),
  z.object({ type: z.literal('agent:message'), payload: z.object({ agentId: z.string(), conversationId: z.string(), content: z.string() }) }),
  z.object({ type: z.literal('agent:stopInteract'), payload: z.object({ agentId: z.string() }) }),
  z.object({ type: z.literal('player:updateSettings'), payload: z.object({ avatarId: z.string() }) }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

// --- Player & World state (used in server messages) ---
export const playerStateSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  photoURL: z.string().nullable(),
  position: positionSchema,
  rotation: z.number(),
  animation: z.string(),
  avatarId: z.string(),
});
export type PlayerState = z.infer<typeof playerStateSchema>;

export const worldStateSchema = z.object({
  players: z.record(z.string(), playerStateSchema),
  agents: z.record(z.string(), agentSkillSchema.extend({ status: agentStatusSchema })),
});
export type WorldState = z.infer<typeof worldStateSchema>;

// --- Server → Client ---
export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('world:state'), payload: worldStateSchema }),
  z.object({ type: z.literal('player:joined'), payload: playerStateSchema }),
  z.object({ type: z.literal('player:left'), payload: z.object({ playerId: z.string() }) }),
  z.object({ type: z.literal('player:moved'), payload: z.object({ playerId: z.string(), position: positionSchema, rotation: z.number(), animation: z.string() }) }),
  z.object({ type: z.literal('agent:statusChanged'), payload: z.object({ agentId: z.string(), status: agentStatusSchema }) }),
  z.object({ type: z.literal('agent:chatMessage'), payload: z.object({ agentId: z.string(), role: z.enum(['assistant', 'user']), content: z.string() }) }),
  z.object({ type: z.literal('agent:chatStream'), payload: z.object({ agentId: z.string(), delta: z.string() }) }),
  z.object({ type: z.literal('agent:toolExecution'), payload: z.object({ agentId: z.string(), toolName: z.string(), status: z.enum(['started', 'completed', 'failed']), result: z.string().optional() }) }),
  z.object({ type: z.literal('auth:error'), payload: z.object({ message: z.string() }) }),
  z.object({ type: z.literal('agent:conversationHistory'), payload: z.object({ agentId: z.string(), messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })) }) }),
  z.object({ type: z.literal('agent:ttsAudio'), payload: z.object({ agentId: z.string(), audioBase64: z.string(), mimeType: z.string() }) }),
  z.object({ type: z.literal('player:avatarChanged'), payload: z.object({ playerId: z.string(), avatarId: z.string() }) }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
