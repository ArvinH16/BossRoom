import { create } from 'zustand';
import { gameSocket } from '@/lib/websocket';
import { generateConversationId } from '@bossroom/shared-utils';

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'agent'; content: string }
  | { role: 'tool'; toolName: string; status: 'started' | 'completed' | 'failed'; result?: string };

/** Archived receptionist task (read-only snapshot). */
export interface ArchivedTask {
  id: string;
  label: string;
  messages: ChatMessage[];
  agentIds: string[];
}

interface ChatState {
  activeAgent: string | null;
  chatPanelOpen: boolean;
  chatMessages: Record<string, ChatMessage[]>;
  streamingText: Record<string, string>;
  conversationIds: Record<string, string>;

  /** Receptionist task tabs */
  archivedTasks: ArchivedTask[];
  activeTaskId: string | null;        // null = current live conversation
  currentTaskId: string;              // ID of the live task
  currentTaskAgentIds: string[];      // dynamic agent IDs spawned by this task
  taskCounter: number;

  openChat: (agentId: string) => void;
  closeChat: () => void;
  sendMessage: (agentId: string, content: string) => void;
  addMessage: (agentId: string, msg: ChatMessage) => void;
  addToolExecution: (agentId: string, toolName: string, status: 'started' | 'completed' | 'failed', result?: string) => void;
  appendStream: (agentId: string, delta: string) => void;
  finalizeStream: (agentId: string) => void;

  /** Task management (receptionist only) */
  registerTaskAgents: (agentIds: string[]) => void;
  newTask: () => void;
  switchTask: (taskId: string | null) => void;
  closeTask: (taskId: string) => void;

  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeAgent: null,
  chatPanelOpen: false,
  chatMessages: {},
  streamingText: {},
  conversationIds: {},

  archivedTasks: [],
  activeTaskId: null,
  currentTaskId: 'task-1',
  currentTaskAgentIds: [],
  taskCounter: 1,

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

  addToolExecution: (agentId, toolName, status, result) =>
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
          updated[i] = { ...msg, status, result };
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

  /** Called when workspace:build fires — associates agent IDs with the current task. */
  registerTaskAgents: (agentIds) => {
    set((state) => ({
      currentTaskAgentIds: [...state.currentTaskAgentIds, ...agentIds],
    }));
  },

  newTask: () => {
    const state = get();
    const currentMessages = state.chatMessages['receptionist'] ?? [];

    // Archive current conversation if it has messages
    const archived = [...state.archivedTasks];
    if (currentMessages.length > 0) {
      archived.push({
        id: state.currentTaskId,
        label: `Task ${state.taskCounter}`,
        messages: currentMessages,
        agentIds: state.currentTaskAgentIds,
      });
    }

    const newCounter = state.taskCounter + 1;
    const newTaskId = `task-${newCounter}`;

    set({
      archivedTasks: archived,
      currentTaskId: newTaskId,
      taskCounter: newCounter,
      activeTaskId: null, // switch to the new live task
      currentTaskAgentIds: [],
      chatMessages: {
        ...state.chatMessages,
        receptionist: [],
      },
      streamingText: { ...state.streamingText, receptionist: '' },
      conversationIds: {
        ...state.conversationIds,
        receptionist: generateConversationId(),
      },
    });

    // Re-trigger interact so server creates a fresh conversation
    gameSocket.send({
      type: 'agent:interact',
      payload: { agentId: 'receptionist' },
    });
  },

  switchTask: (taskId) => {
    set({ activeTaskId: taskId });
  },

  closeTask: (taskId) => {
    const state = get();
    const task = state.archivedTasks.find((t) => t.id === taskId);
    set({
      archivedTasks: state.archivedTasks.filter((t) => t.id !== taskId),
      activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
    });
    // Return agent IDs so the caller can clean them up
    return task?.agentIds ?? [];
  },

  reset: () =>
    set({
      activeAgent: null,
      chatPanelOpen: false,
      chatMessages: {},
      streamingText: {},
      conversationIds: {},
      archivedTasks: [],
      activeTaskId: null,
      currentTaskId: 'task-1',
      currentTaskAgentIds: [],
      taskCounter: 1,
    }),
}));
