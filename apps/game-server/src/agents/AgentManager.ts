/**
 * AgentManager: orchestrates agent interactions.
 * Routes messages to the AI Gateway (Claude/GPT-4o/Gemini),
 * streams responses back to the client, and handles tool execution via Composio.
 */
import { WebSocket } from 'ws';
import type OpenAI from 'openai';
import type {
  AgentSkill,
  AgentStatus,
  ServerMessage,
} from '@bossroom/shared-types';
import { createGatewayClient } from '../ai/gateway.js';
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
    composioTools: ['GMAIL_SEND_EMAIL', 'GMAIL_FETCH_EMAILS'],
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
    composioTools: ['LINEAR_CREATE_ISSUE', 'LINEAR_LIST_ISSUES'],
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
    composioTools: ['GOOGLECALENDAR_CREATE_EVENT', 'GOOGLECALENDAR_FIND_EVENTS'],
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
        composioTools: agent.composioTools,
        zone: agent.zone,
        personality: agent.personality,
        avatarConfig: agent.avatarConfig,
        status: agent.status,
      };
    }
    return result;
  }

  startInteraction(playerId: string, agentId: string, ws: WebSocket) {
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
        content: this.getGreeting(agent),
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
      conv = { id: convId, playerId, agentId, messages: [], ws };
      this.conversations.set(convId, conv);
      this.playerConversations.set(convKey, convId);
    }

    // Add user message
    conv.messages.push({ role: 'user', content });

    // Update status -> thinking
    this.setAgentStatus(agentId, 'thinking');
    broadcastFn({
      type: 'agent:statusChanged',
      payload: { agentId, status: 'thinking' },
    });

    try {
      // Build messages for the LLM
      const llmMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: agent.systemPrompt },
        ...conv.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      // Call AI Gateway with streaming
      const { client, model } = createGatewayClient(agent.model);

      const stream = await client.chat.completions.create({
        model,
        messages: llmMessages,
        stream: true,
        max_tokens: 1024,
      });

      // Update status -> working
      this.setAgentStatus(agentId, 'working');
      broadcastFn({
        type: 'agent:statusChanged',
        payload: { agentId, status: 'working' },
      });

      let fullResponse = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullResponse += delta;
          this.sendToPlayer(ws, {
            type: 'agent:chatStream',
            payload: { agentId, delta },
          });
        }
      }

      // Save assistant response to conversation history
      conv.messages.push({ role: 'assistant', content: fullResponse });

      // Send complete message (signals end of stream)
      this.sendToPlayer(ws, {
        type: 'agent:chatMessage',
        payload: { agentId, role: 'assistant', content: fullResponse },
      });

      // Reset status
      this.setAgentStatus(agentId, 'idle');
      broadcastFn({
        type: 'agent:statusChanged',
        payload: { agentId, status: 'idle' },
      });
    } catch (err) {
      log.error(`Agent ${agentId} error:`, err);

      this.setAgentStatus(agentId, 'error');
      broadcastFn({
        type: 'agent:statusChanged',
        payload: { agentId, status: 'error' },
      });

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
        broadcastFn({
          type: 'agent:statusChanged',
          payload: { agentId, status: 'idle' },
        });
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

  private getGreeting(agent: AgentDef): string {
    switch (agent.id) {
      case 'mailbot':
        return "Hey there! I'm Mailbot, your communications sidekick. Need to send an email, check your inbox, or draft something? I'm on it!";
      case 'taskmaster':
        return "Attention! Taskmaster reporting for duty. Give me your mission briefing — tasks to create, issues to track, deadlines to crush.";
      case 'clockwork':
        return "Tick tock! Clockwork here, at your service. Every second counts — let's make sure your schedule is perfectly synchronized!";
      default:
        return `Hi! I'm ${agent.name}. How can I help you today?`;
    }
  }
}
