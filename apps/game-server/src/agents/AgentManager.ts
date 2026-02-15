/**
 * AgentManager: orchestrates agent interactions.
 * Routes messages through AI SDK streamText with multi-step tool calling,
 * Composio tools, and MCP tool support.
 */
import { WebSocket } from 'ws';
import { streamText, stepCountIs, type ModelMessage } from 'ai';
import type {
  AgentStatus,
  ServerMessage,
} from '@bossroom/shared-types';
import { AGENT_DEFS, type AgentDef, generateConversationId, TIMEOUTS } from '@bossroom/shared-utils';
import { getModel } from '../ai/gateway.js';
import { getComposioTools } from '../ai/composio.js';
import { mcpManager } from '../ai/mcp.js';
import { log } from '../logger.js';
import { db } from '../db/client.js';
import { conversations as conversationsTable } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

// --- Local type that extends AgentDef with runtime status ---
type AgentWithStatus = AgentDef & { status: AgentStatus };

interface Conversation {
  id: string;
  playerId: string;
  agentId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
  aiMessages: ModelMessage[];
  ws: WebSocket;
}

export class AgentManager {
  private agents: Map<string, AgentWithStatus> = new Map();
  private conversations: Map<string, Conversation> = new Map();
  private playerConversations: Map<string, string> = new Map(); // playerId:agentId -> convId

  constructor() {
    for (const agent of AGENT_DEFS) {
      this.agents.set(agent.id, { ...agent, status: 'idle' });
    }
  }

  getAgentStates(): Record<string, AgentWithStatus> {
    const result: Record<string, AgentWithStatus> = {};
    for (const [id, agent] of this.agents) {
      result[id] = agent;
    }
    return result;
  }

  async startInteraction(playerId: string, agentId: string, ws: WebSocket, displayName: string | null) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const convKey = `${playerId}:${agentId}`;
    let convId = this.playerConversations.get(convKey);
    let conv = convId ? this.conversations.get(convId) : undefined;

    if (!conv) {
      try {
        // Try loading from DB
        const [existing] = await db.select().from(conversationsTable)
          .where(and(
            eq(conversationsTable.userId, playerId),
            eq(conversationsTable.agentId, agentId),
          ))
          .limit(1);

        if (existing) {
          // Restore from DB
          convId = existing.id;
          conv = {
            id: existing.id,
            playerId,
            agentId,
            messages: (existing.messages ?? []) as Conversation['messages'],
            aiMessages: (existing.aiMessages ?? []) as ModelMessage[],
            ws,
          };
          this.conversations.set(convId, conv);
          this.playerConversations.set(convKey, convId);

          // Send history to frontend
          this.sendToPlayer(ws, {
            type: 'agent:conversationHistory',
            payload: {
              agentId,
              messages: conv.messages.map(m => ({ role: m.role, content: m.content })),
            },
          });
        } else {
          // Brand new conversation
          convId = generateConversationId();
          const greeting = this.getGreeting(agent, displayName);
          conv = {
            id: convId,
            playerId,
            agentId,
            messages: [{ role: 'assistant', content: greeting, timestamp: new Date().toISOString() }],
            aiMessages: [{ role: 'assistant' as const, content: greeting }],
            ws,
          };
          this.conversations.set(convId, conv);
          this.playerConversations.set(convKey, convId);

          // Persist new conversation
          await db.insert(conversationsTable).values({
            id: convId,
            userId: playerId,
            agentId,
            messages: conv.messages,
            aiMessages: conv.aiMessages,
          });

          // Send greeting to frontend
          this.sendToPlayer(ws, {
            type: 'agent:chatMessage',
            payload: { agentId, role: 'assistant', content: greeting },
          });
        }
      } catch (err) {
        // DB unreachable — fall back to in-memory only
        log.error(`[agent] DB error loading conversation for ${agentId}:`, err);
        convId = generateConversationId();
        const greeting = this.getGreeting(agent, displayName);
        conv = {
          id: convId,
          playerId,
          agentId,
          messages: [{ role: 'assistant', content: greeting, timestamp: new Date().toISOString() }],
          aiMessages: [{ role: 'assistant' as const, content: greeting }],
          ws,
        };
        this.conversations.set(convId, conv);
        this.playerConversations.set(convKey, convId);

        this.sendToPlayer(ws, {
          type: 'agent:chatMessage',
          payload: { agentId, role: 'assistant', content: greeting },
        });
      }
    } else {
      // Already in memory — just update WS ref
      conv.ws = ws;

      // Send history to frontend
      this.sendToPlayer(ws, {
        type: 'agent:conversationHistory',
        payload: {
          agentId,
          messages: conv.messages.map(m => ({ role: m.role, content: m.content })),
        },
      });
    }

    this.setAgentStatus(agentId, 'listening');
  }

  async handleMessage(
    playerId: string,
    agentId: string,
    conversationId: string,
    content: string,
    ws: WebSocket,
    broadcastFn: (msg: ServerMessage) => void,
  ) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    // Find or create conversation
    const convKey = `${playerId}:${agentId}`;
    let convId = this.playerConversations.get(convKey);
    let conv = convId ? this.conversations.get(convId) : undefined;

    if (!conv) {
      convId = conversationId || generateConversationId();
      conv = { id: convId, playerId, agentId, messages: [], aiMessages: [], ws };
      this.conversations.set(convId, conv);
      this.playerConversations.set(convKey, convId);
    }

    // Add user message to display history
    conv.messages.push({ role: 'user', content, timestamp: new Date().toISOString() });

    // Status → thinking
    this.setAgentStatus(agentId, 'thinking');
    broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'thinking' } });

    try {
      const model = getModel(agent.model);
      const composioTools = await getComposioTools(playerId);
      const mcpTools = await mcpManager.getAllTools();
      const tools = { ...composioTools, ...mcpTools };
      const hasTools = Object.keys(tools).length > 0;

      // Build AI SDK messages: use aiMessages for multi-turn tool context,
      // append latest user message
      const aiMessages = [
        ...conv.aiMessages,
        { role: 'user' as const, content },
      ];

      // streamText is synchronous — returns result object immediately
      const result = streamText({
        model,
        system: agent.systemPrompt,
        messages: aiMessages,
        ...(hasTools ? { tools, stopWhen: stepCountIs(5) } : {}),
        onChunk: ({ chunk }) => {
          if (chunk.type === 'tool-call') {
            this.sendToPlayer(ws, {
              type: 'agent:toolExecution',
              payload: { agentId, toolName: chunk.toolName, status: 'started' },
            });
          }
        },
        onStepFinish: ({ toolCalls, toolResults }) => {
          for (let i = 0; i < toolCalls.length; i++) {
            const tc = toolCalls[i];
            const tr = toolResults[i];
            const failed = tr && typeof tr === 'object' && 'error' in tr;
            this.sendToPlayer(ws, {
              type: 'agent:toolExecution',
              payload: {
                agentId,
                toolName: tc.toolName,
                status: failed ? 'failed' : 'completed',
                result: failed ? String((tr as { error: unknown }).error) : undefined,
              },
            });
          }
        },
      });

      // Status → working
      this.setAgentStatus(agentId, 'working');
      broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'working' } });

      // Stream text deltas to frontend
      let fullResponse = '';
      for await (const delta of result.textStream) {
        fullResponse += delta;
        this.sendToPlayer(ws, {
          type: 'agent:chatStream',
          payload: { agentId, delta },
        });
      }

      // Store AI SDK response messages for multi-turn tool context
      const response = await result.response;
      conv.aiMessages.push(
        { role: 'user' as const, content },
        ...response.messages,
      );

      // Store display-friendly response
      conv.messages.push({ role: 'assistant', content: fullResponse, timestamp: new Date().toISOString() });

      // Persist to DB (best-effort — in-memory is still the live copy)
      try {
        await db.update(conversationsTable).set({
          messages: conv.messages,
          aiMessages: conv.aiMessages,
          updatedAt: new Date(),
        }).where(eq(conversationsTable.id, conv.id));
      } catch (err) {
        log.error(`[agent] DB save failed for conversation ${conv.id}:`, err);
      }

      // Send complete message (signals end of stream to frontend)
      this.sendToPlayer(ws, {
        type: 'agent:chatMessage',
        payload: { agentId, role: 'assistant', content: fullResponse },
      });

      // Reset status
      this.setAgentStatus(agentId, 'idle');
      broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'idle' } });

    } catch (err) {
      log.error(`Agent ${agentId} error:`, err);

      this.setAgentStatus(agentId, 'error');
      broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'error' } });

      this.sendToPlayer(ws, {
        type: 'agent:chatMessage',
        payload: {
          agentId,
          role: 'assistant',
          content: "Oops, I hit a snag! My circuits got a bit tangled. Could you try again?",
        },
      });

      // Reset to idle after a short delay
      setTimeout(() => {
        this.setAgentStatus(agentId, 'idle');
        broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'idle' } });
      }, TIMEOUTS.AGENT_ERROR_RECOVERY_MS);
    }
  }

  stopInteraction(playerId: string, agentId: string) {
    this.setAgentStatus(agentId, 'idle');
  }

  handleDisconnect(playerId: string) {
    // Collect keys to delete (can't delete while iterating a Map)
    const keysToDelete: string[] = [];
    for (const [key, convId] of this.playerConversations) {
      if (key.startsWith(`${playerId}:`)) {
        const conv = this.conversations.get(convId);
        if (conv) {
          this.setAgentStatus(conv.agentId, 'idle');
        }
        keysToDelete.push(key);
      }
    }
    // Now safe to delete
    for (const key of keysToDelete) {
      const convId = this.playerConversations.get(key)!;
      this.conversations.delete(convId);
      this.playerConversations.delete(key);
    }
  }

  private setAgentStatus(agentId: string, status: AgentStatus) {
    const agent = this.agents.get(agentId);
    if (agent) agent.status = status;
  }

  private sendToPlayer(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private getGreeting(agent: AgentWithStatus, displayName: string | null): string {
    const name = displayName ?? 'there';
    switch (agent.id) {
      case 'mailbot':
        return `Hey ${name}! I'm Mailbot, your communications sidekick. Need to send an email, check your inbox, or draft something? I'm on it!`;
      case 'taskmaster':
        return `Attention, ${name}! Taskmaster reporting for duty. Give me your mission briefing — tasks to create, issues to track, deadlines to crush.`;
      case 'clockwork':
        return `Tick tock, ${name}! Clockwork here, at your service. Every second counts — let's make sure your schedule is perfectly synchronized!`;
      default:
        return `Hi ${name}! I'm ${agent.name}. How can I help you today?`;
    }
  }
}
