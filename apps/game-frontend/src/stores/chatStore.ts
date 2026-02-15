import { create } from 'zustand';
import { gameSocket } from '@/lib/websocket';
import { generateConversationId } from '@bossroom/shared-utils';

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'agent'; content: string }
  | { role: 'tool'; toolName: string; status: 'started' | 'completed' | 'failed' };

interface ChatState {
  activeAgent: string | null;
  chatPanelOpen: boolean;
  chatMessages: Record<string, ChatMessage[]>;
  streamingText: Record<string, string>;
  conversationIds: Record<string, string>;

  openChat: (agentId: string) => void;
  closeChat: () => void;
  sendMessage: (agentId: string, content: string) => void;
  addMessage: (agentId: string, msg: ChatMessage) => void;
  addToolExecution: (agentId: string, toolName: string, status: 'started' | 'completed' | 'failed') => void;
  appendStream: (agentId: string, delta: string) => void;
  finalizeStream: (agentId: string) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeAgent: null,
  chatPanelOpen: false,
  chatMessages: {},
  streamingText: {},
  conversationIds: {},

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
      // Clear streaming text for active agent before closing
      set((state) => ({
        streamingText: { ...state.streamingText, [activeAgent]: '' },
      }));
      gameSocket.send({
        type: 'agent:stopInteract',
        payload: { agentId: activeAgent },
      });
    }
    set({ activeAgent: null, chatPanelOpen: false });
  },

  sendMessage: (agentId, content) => {
    const state = get();
    const convId = state.conversationIds[agentId] ?? generateConversationId();

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

    gameSocket.send({
      type: 'agent:message',
      payload: { agentId, conversationId: convId, content },
    });
  },

  addMessage: (agentId, msg) =>
    set((state) => {
      const prev = state.chatMessages[agentId] ?? [];
      return {
        chatMessages: {
          ...state.chatMessages,
          [agentId]: [...prev, msg],
        },
      };
    }),

  addToolExecution: (agentId, toolName, status) =>
    set((state) => {
      const prev = state.chatMessages[agentId] ?? [];
      if (status === 'started') {
        return {
          chatMessages: {
            ...state.chatMessages,
            [agentId]: [...prev, { role: 'tool' as const, toolName, status }],
          },
        };
      }
      // For completed/failed: update the last matching tool message in-place
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        const msg = updated[i];
        if (msg.role === 'tool' && msg.toolName === toolName && msg.status === 'started') {
          updated[i] = { ...msg, status };
          break;
        }
      }
      return {
        chatMessages: { ...state.chatMessages, [agentId]: updated },
      };
    }),

  appendStream: (agentId, delta) =>
    set((state) => ({
      streamingText: {
        ...state.streamingText,
        [agentId]: (state.streamingText[agentId] ?? '') + delta,
      },
    })),

  finalizeStream: (agentId) =>
    set((state) => {
      const content = state.streamingText[agentId] ?? '';
      const prev = state.chatMessages[agentId] ?? [];
      return {
        chatMessages: {
          ...state.chatMessages,
          [agentId]: [...prev, { role: 'agent' as const, content }],
        },
        streamingText: { ...state.streamingText, [agentId]: '' },
      };
    }),

  reset: () =>
    set({
      activeAgent: null,
      chatPanelOpen: false,
      chatMessages: {},
      streamingText: {},
      conversationIds: {},
    }),
}));
