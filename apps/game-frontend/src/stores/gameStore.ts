/** Global game state: agents, interaction proximity, chat messages, WebSocket connection. */
import { create } from 'zustand';
import { agents as defaultAgents, type AgentData } from '@/data/agents';
import { gameSocket } from '@/lib/websocket';
import type { ServerMessage, AgentStatus } from '@bossroom/shared-types';

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
}

let nextExecId = 0;

interface ToolExecution {
  id: number;
  agentId: string;
  toolName: string;
  status: 'started' | 'completed' | 'failed';
  result?: string;
}

interface GameState {
  // Connection
  connected: boolean;
  playerId: string | null;

  // World
  agents: AgentData[];
  nearestAgent: string | null;

  // Chat
  activeAgent: string | null;
  chatPanelOpen: boolean;
  chatMessages: Record<string, ChatMessage[]>;
  streamingText: Record<string, string>;
  conversationIds: Record<string, string>;

  // Tool execution
  toolExecutions: ToolExecution[];

  // Onboarding
  onboardingStep: number;
  onboardingComplete: boolean;

  // Actions
  setConnected: (connected: boolean) => void;
  setNearestAgent: (id: string | null) => void;
  openChat: (agentId: string) => void;
  closeChat: () => void;
  sendMessage: (agentId: string, content: string) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
  appendStream: (agentId: string, delta: string) => void;
  finalizeStream: (agentId: string, content: string) => void;
  addToolExecution: (exec: ToolExecution) => void;
  dismissToolExecution: (id: number) => void;
  advanceOnboarding: () => void;
  completeOnboarding: () => void;

  // WebSocket init
  initWebSocket: (username: string) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  connected: false,
  playerId: null,
  agents: defaultAgents,
  nearestAgent: null,
  activeAgent: null,
  chatPanelOpen: false,
  chatMessages: {},
  streamingText: {},
  conversationIds: {},
  toolExecutions: [],
  onboardingStep: 0,
  onboardingComplete:
    typeof window !== 'undefined'
      ? localStorage.getItem('bossroom-onboarding') === 'done'
      : false,

  setConnected: (connected) => set({ connected }),
  setNearestAgent: (id) => set({ nearestAgent: id }),

  openChat: (agentId) => {
    set({ activeAgent: agentId, chatPanelOpen: true });
    gameSocket.send({
      type: 'agent:interact',
      payload: { agentId },
    });
  },

  closeChat: () => {
    const { activeAgent } = get();
    if (activeAgent) {
      gameSocket.send({
        type: 'agent:stopInteract',
        payload: { agentId: activeAgent },
      });
    }
    set({ activeAgent: null, chatPanelOpen: false });
  },

  sendMessage: (agentId, content) => {
    const state = get();
    const convId =
      state.conversationIds[agentId] ?? `conv-${Date.now()}`;

    // Add user message locally
    const prev = state.chatMessages[agentId] ?? [];
    set({
      chatMessages: {
        ...state.chatMessages,
        [agentId]: [...prev, { role: 'user', content }],
      },
      streamingText: { ...state.streamingText, [agentId]: '' },
      conversationIds: {
        ...state.conversationIds,
        [agentId]: convId,
      },
    });

    // Send to server
    gameSocket.send({
      type: 'agent:message',
      payload: { agentId, conversationId: convId, content },
    });
  },

  updateAgentStatus: (agentId, status) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, status } : a,
      ),
    })),

  appendStream: (agentId, delta) =>
    set((state) => ({
      streamingText: {
        ...state.streamingText,
        [agentId]: (state.streamingText[agentId] ?? '') + delta,
      },
    })),

  finalizeStream: (agentId, content) =>
    set((state) => {
      const prev = state.chatMessages[agentId] ?? [];
      return {
        chatMessages: {
          ...state.chatMessages,
          [agentId]: [...prev, { role: 'agent', content }],
        },
        streamingText: { ...state.streamingText, [agentId]: '' },
      };
    }),

  addToolExecution: (exec) =>
    set((state) => ({
      toolExecutions: [...state.toolExecutions, exec],
    })),

  dismissToolExecution: (id) =>
    set((state) => ({
      toolExecutions: state.toolExecutions.filter((t) => t.id !== id),
    })),

  advanceOnboarding: () =>
    set((state) => ({ onboardingStep: state.onboardingStep + 1 })),

  completeOnboarding: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bossroom-onboarding', 'done');
    }
    set({ onboardingComplete: true });
  },

  initWebSocket: (username) => {
    if (get().connected || gameSocket.connected) return;

    gameSocket.onMessage((msg: ServerMessage) => {
      const s = get();

      switch (msg.type) {
        case 'world:state':
          set({ connected: true });
          break;

        case 'agent:statusChanged':
          s.updateAgentStatus(
            msg.payload.agentId,
            msg.payload.status,
          );
          break;

        case 'agent:chatMessage': {
          const { agentId, role, content } = msg.payload;
          const streamText = s.streamingText[agentId] ?? '';
          if (role === 'assistant' && streamText && content === streamText) {
            s.finalizeStream(agentId, content);
          } else {
            set((state) => {
              const prev = state.chatMessages[agentId] ?? [];
              return {
                chatMessages: {
                  ...state.chatMessages,
                  [agentId]: [
                    ...prev,
                    { role: role === 'assistant' ? 'agent' : 'user', content },
                  ],
                },
              };
            });
          }
          break;
        }

        case 'agent:chatStream':
          s.appendStream(msg.payload.agentId, msg.payload.delta);
          break;

        case 'agent:toolExecution': {
          const execId = nextExecId++;
          const exec: ToolExecution = {
            id: execId,
            agentId: msg.payload.agentId,
            toolName: msg.payload.toolName,
            status: msg.payload.status,
            result: msg.payload.result,
          };
          s.addToolExecution(exec);
          setTimeout(() => {
            get().dismissToolExecution(execId);
          }, 4000);
          break;
        }

        case 'player:left':
          if (msg.payload.playerId === '__self__') {
            set({ connected: false });
          }
          break;
      }
    });

    gameSocket.connect(username);
  },
}));
