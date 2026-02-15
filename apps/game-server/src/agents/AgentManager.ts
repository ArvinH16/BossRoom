/**
 * AgentManager: orchestrates agent interactions.
 * Routes messages through AI SDK streamText with multi-step tool calling,
 * Composio tools, and MCP tool support.
 */
import { WebSocket } from 'ws';
import { streamText, stepCountIs } from 'ai';
import type {
  AgentSkill,
  AgentStatus,
  ServerMessage,
} from '@bossroom/shared-types';
import { getModel } from '../ai/gateway.js';
import { getComposioTools } from '../ai/composio.js';
import { mcpManager } from '../ai/mcp.js';
import { log } from '../logger.js';

// --- Agent definitions (in-memory, mirrors frontend data/agents.ts) ---
interface AgentDef extends AgentSkill {
  status: AgentStatus;
}

const AGENT_DEFS: AgentDef[] = [
  {
    id: 'mailbot',
    name: 'Mailbot',
    description: 'Handles all internal and external communications.',
    systemPrompt: `You are Mailbot, a cheerful and efficient email assistant in the BossRoom 3D workspace.
You help users compose, send, and manage emails. You speak casually with energy and enthusiasm.
When a user asks you to send an email, compose it properly and confirm before "sending."
If asked about capabilities, list your tools. Keep responses concise and fun.
You love sorting things and organizing communication.`,
    model: 'gpt-4o',
    zone: 'communications',
    personality: 'Cheerful and efficient. Loves sorting things.',
    avatarConfig: { color: '#4A90D9', position: [-6, 0, -6] },
    status: 'idle',
  },
  {
    id: 'taskmaster',
    name: 'Taskmaster',
    description: 'Manages projects, tasks, and deadlines.',
    systemPrompt: `You are Taskmaster, a strict but fair project manager in the BossRoom 3D workspace.
You help users create tasks, track issues, and manage deadlines. You speak with authority
and use military/mission metaphors. You never miss a deadline.
When asked to create a task, gather the details (title, description, priority) then confirm.
Keep responses direct and action-oriented.`,
    model: 'claude',
    zone: 'project-ops',
    personality: 'Strict but fair. Never misses a deadline.',
    avatarConfig: { color: '#D94A4A', position: [6, 0, -6] },
    status: 'idle',
  },
  {
    id: 'clockwork',
    name: 'Clockwork',
    description: 'Keeps track of time, schedules, and calendar events.',
    systemPrompt: `You are Clockwork, a precise and punctual calendar assistant in the BossRoom 3D workspace.
You help users manage their schedule, create events, and check availability.
You are obsessed with punctuality and always speak in time metaphors.
"Every second counts!" "Let's make sure your calendar is ticking perfectly."
When scheduling, always confirm the time, duration, and attendees.`,
    model: 'gemini',
    zone: 'calendar',
    personality: 'Precise and punctual. Speaks in time metaphors.',
    avatarConfig: { color: '#4AD97A', position: [0, 0, -10] },
    status: 'idle',
  },
];

interface Conversation {
  id: string;
  playerId: string;
  agentId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiMessages: Array<any>;
  ws: WebSocket;
}

export class AgentManager {
  private agents: Map<string, AgentDef> = new Map();
  private conversations: Map<string, Conversation> = new Map();
  private playerConversations: Map<string, string> = new Map(); // playerId:agentId -> convId

  constructor() {
    for (const agent of AGENT_DEFS) {
      this.agents.set(agent.id, { ...agent });
    }
  }

  getAgentStates(): Record<string, AgentSkill & { status: AgentStatus }> {
    const result: Record<string, AgentSkill & { status: AgentStatus }> = {};
    for (const [id, agent] of this.agents) {
      result[id] = {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        model: agent.model,
        zone: agent.zone,
        personality: agent.personality,
        avatarConfig: agent.avatarConfig,
        status: agent.status,
      };
    }
    return result;
  }

  startInteraction(playerId: string, agentId: string, ws: WebSocket, displayName: string | null) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const convKey = `${playerId}:${agentId}`;
    let convId = this.playerConversations.get(convKey);

    if (!convId) {
      convId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.conversations.set(convId, {
        id: convId,
        playerId,
        agentId,
        messages: [],
        aiMessages: [],
        ws,
      });
      this.playerConversations.set(convKey, convId);
    } else {
      // Update the WebSocket reference (may have reconnected)
      const conv = this.conversations.get(convId);
      if (conv) conv.ws = ws;
    }

    this.setAgentStatus(agentId, 'listening');

    // Send the conversation ID + greeting
    this.sendToPlayer(ws, {
      type: 'agent:chatMessage',
      payload: {
        agentId,
        role: 'assistant',
        content: this.getGreeting(agent, displayName),
      },
    });
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
      convId = conversationId || `conv-${Date.now()}`;
      conv = { id: convId, playerId, agentId, messages: [], aiMessages: [], ws };
      this.conversations.set(convId, conv);
      this.playerConversations.set(convKey, convId);
    }

    // Add user message to display history
    conv.messages.push({ role: 'user', content });

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
      conv.messages.push({ role: 'assistant', content: fullResponse });

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
      }, 2000);
    }
  }

  stopInteraction(playerId: string, agentId: string) {
    this.setAgentStatus(agentId, 'idle');
  }

  handleDisconnect(playerId: string) {
    // Clean up conversations for this player
    for (const [key, convId] of this.playerConversations) {
      if (key.startsWith(`${playerId}:`)) {
        const conv = this.conversations.get(convId);
        if (conv) {
          const agentId = conv.agentId;
          this.setAgentStatus(agentId, 'idle');
        }
      }
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

  private getGreeting(agent: AgentDef, displayName: string | null): string {
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
