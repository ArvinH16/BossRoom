import type { AgentSkill, AgentStatus } from './agents.js';

// Client → Server
export type ClientMessage =
  | { type: 'player:join'; payload: { username: string; token: string } }
  | { type: 'player:move'; payload: { position: [number, number, number]; rotation: number; animation: string } }
  | { type: 'agent:interact'; payload: { agentId: string } }
  | { type: 'agent:message'; payload: { agentId: string; conversationId: string; content: string } }
  | { type: 'agent:stopInteract'; payload: { agentId: string } };

// Server → Client
export type ServerMessage =
  | { type: 'world:state'; payload: WorldState }
  | { type: 'player:joined'; payload: PlayerState }
  | { type: 'player:left'; payload: { playerId: string } }
  | { type: 'player:moved'; payload: { playerId: string; position: [number, number, number]; rotation: number; animation: string } }
  | { type: 'agent:statusChanged'; payload: { agentId: string; status: AgentStatus } }
  | { type: 'agent:chatMessage'; payload: { agentId: string; role: 'assistant' | 'user'; content: string } }
  | { type: 'agent:chatStream'; payload: { agentId: string; delta: string } }
  | { type: 'agent:toolExecution'; payload: { agentId: string; toolName: string; status: 'started' | 'completed' | 'failed'; result?: string } }
  | { type: 'auth:error'; payload: { message: string } };

export interface PlayerState {
  id: string;
  username: string;
  email: string;
  photoURL: string | null;
  position: [number, number, number];
  rotation: number;
  animation: string;
}

export interface WorldState {
  players: Record<string, PlayerState>;
  agents: Record<string, AgentSkill & { status: AgentStatus }>;
}
