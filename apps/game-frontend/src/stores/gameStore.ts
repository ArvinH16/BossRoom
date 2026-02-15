import { create } from 'zustand';
import { agents as defaultAgents, type AgentData } from '@/data/agents';

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
}

interface GameState {
  agents: AgentData[];
  nearestAgent: string | null;
  activeAgent: string | null;
  chatPanelOpen: boolean;
  chatMessages: Record<string, ChatMessage[]>;
  setNearestAgent: (id: string | null) => void;
  openChat: (agentId: string) => void;
  closeChat: () => void;
  sendMessage: (agentId: string, content: string) => void;
}

export const useGameStore = create<GameState>((set) => ({
  agents: defaultAgents,
  nearestAgent: null,
  activeAgent: null,
  chatPanelOpen: false,
  chatMessages: {},
  setNearestAgent: (id) => set({ nearestAgent: id }),
  openChat: (agentId) =>
    set({ activeAgent: agentId, chatPanelOpen: true }),
  closeChat: () =>
    set({ activeAgent: null, chatPanelOpen: false }),
  sendMessage: (agentId, content) =>
    set((state) => {
      const prev = state.chatMessages[agentId] ?? [];
      return {
        chatMessages: {
          ...state.chatMessages,
          [agentId]: [
            ...prev,
            { role: 'user' as const, content },
            {
              role: 'agent' as const,
              content:
                "I'm not connected to my brain yet! But I will be soon.",
            },
          ],
        },
      };
    }),
}));
