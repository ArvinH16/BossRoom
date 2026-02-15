import { create } from 'zustand';
import { gameSocket } from '@/lib/websocket';
import { generateConversationId } from '@bossroom/shared-utils';
import { useVoiceStore } from '@/stores/voiceStore';

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'agent'; content: string }
  | { role: 'tool'; toolName: string; status: 'started' | 'completed' | 'failed'; result?: string };

/** Detect markdown links or raw URLs in agent text. */
const LINK_REGEX = /https?:\/\/[^\s)]+|\[.+?\]\(.+?\)/;

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
  lastWalkAwayAgent: string | null;

  /** Agent IDs whose latest turn contains a link the user hasn't seen yet. */
  agentsWithLinks: Set<string>;

  /** Receptionist task tabs */
  archivedTasks: ArchivedTask[];
  activeTaskId: string | null;        // null = current live conversation
  currentTaskId: string;              // ID of the live task
  currentTaskAgentIds: string[];      // dynamic agent IDs spawned by this task
  taskCounter: number;

  openChat: (agentId: string) => void;
  interactAgent: (agentId: string) => void;
  closeChat: (reason?: 'explicit' | 'walkAway') => void;
  sendMessage: (agentId: string, content: string, inputMode?: 'voice' | 'text') => void;
  addMessage: (agentId: string, msg: ChatMessage) => void;
  addToolExecution: (agentId: string, toolName: string, status: 'started' | 'completed' | 'failed', result?: string) => void;
  appendStream: (agentId: string, delta: string) => void;
  finalizeStream: (agentId: string) => void;

  /** Task management (receptionist only) */
  registerTaskAgents: (agentIds: string[]) => void;
  newTask: () => void;
  switchTask: (taskId: string | null) => void;
  closeTask: (taskId: string) => void;
  closeCurrentTask: () => void;

  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeAgent: null,
  chatPanelOpen: false,
  chatMessages: {},
  streamingText: {},
  conversationIds: {},
  lastWalkAwayAgent: null,
  agentsWithLinks: new Set<string>(),

  archivedTasks: [],
  activeTaskId: null,
  currentTaskId: 'task-1',
  currentTaskAgentIds: [],
  taskCounter: 1,

  openChat: (agentId) => {
    useVoiceStore.getState().stopTTS();
    const next = new Set(get().agentsWithLinks);
    next.delete(agentId);
    set({ activeAgent: agentId, chatPanelOpen: true, lastWalkAwayAgent: null, agentsWithLinks: next });
    gameSocket.send({
      type: 'agent:interact',
      payload: { agentId },
    });
  },

  interactAgent: (agentId) => {
    useVoiceStore.getState().stopTTS();
    set({ activeAgent: agentId, lastWalkAwayAgent: null });
    gameSocket.send({
      type: 'agent:interact',
      payload: { agentId },
    });
  },

  closeChat: (reason?: 'explicit' | 'walkAway') => {
    useVoiceStore.getState().stopTTS();
    const { activeAgent } = get();
    if (activeAgent) {
      set((state) => ({
        streamingText: { ...state.streamingText, [activeAgent]: '' },
      }));
      gameSocket.send({
        type: 'agent:stopInteract',
        payload: { agentId: activeAgent },
      });
    }
    set({
      activeAgent: null,
      chatPanelOpen: false,
      lastWalkAwayAgent: reason === 'walkAway' ? activeAgent : null,
    });
  },

  sendMessage: (agentId, content, inputMode?: 'voice' | 'text') => {
    useVoiceStore.getState().stopTTS();
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
      payload: { agentId, conversationId: convId, content, inputMode: inputMode ?? 'text' },
    });
  },

  addMessage: (agentId, msg) =>
    set((state) => {
      const prev = state.chatMessages[agentId] ?? [];
      const next: Partial<ChatState> = {
        chatMessages: {
          ...state.chatMessages,
          [agentId]: [...prev, msg],
        },
      };
      // Track links in agent messages (skip if user is already viewing this agent)
      if (msg.role === 'agent' && LINK_REGEX.test(msg.content) && state.activeAgent !== agentId) {
        const updated = new Set(state.agentsWithLinks);
        updated.add(agentId);
        next.agentsWithLinks = updated;
      }
      return next;
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
      const next: Partial<ChatState> = {
        chatMessages: {
          ...state.chatMessages,
          [agentId]: [...prev, { role: 'agent' as const, content }],
        },
        streamingText: { ...state.streamingText, [agentId]: '' },
      };
      if (LINK_REGEX.test(content) && state.activeAgent !== agentId) {
        const updated = new Set(state.agentsWithLinks);
        updated.add(agentId);
        next.agentsWithLinks = updated;
      }
      return next;
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
  },

  switchTask: (taskId) => {
    set({ activeTaskId: taskId });
  },

  closeTask: (taskId) => {
    const state = get();
    const task = state.archivedTasks.find((t) => t.id === taskId);
    // Tell server to delete these conversations from memory + DB
    const agentIdsToReset = ['receptionist', ...(task?.agentIds ?? [])];
    gameSocket.send({
      type: 'conversations:reset',
      payload: { agentIds: agentIdsToReset },
    });
    const remaining = state.archivedTasks.filter((t) => t.id !== taskId);
    const newCounter = remaining.length + 1;
    set({
      archivedTasks: remaining,
      activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
      taskCounter: newCounter,
      currentTaskId: `task-${newCounter}`,
    });
    return task?.agentIds ?? [];
  },

  /** Close the current live task — clears receptionist chat and agents. */
  closeCurrentTask: () => {
    const state = get();
    // Tell server to delete these conversations from memory + DB
    const agentIdsToReset = ['receptionist', ...state.currentTaskAgentIds];
    gameSocket.send({
      type: 'conversations:reset',
      payload: { agentIds: agentIdsToReset },
    });

    const newCounter = state.archivedTasks.length + 1;
    set({
      currentTaskId: `task-${newCounter}`,
      taskCounter: newCounter,
      currentTaskAgentIds: [],
      activeTaskId: null,
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
  },

  reset: () =>
    set({
      activeAgent: null,
      chatPanelOpen: false,
      chatMessages: {},
      streamingText: {},
      conversationIds: {},
      lastWalkAwayAgent: null,
      agentsWithLinks: new Set<string>(),
      archivedTasks: [],
      activeTaskId: null,
      currentTaskId: 'task-1',
      currentTaskAgentIds: [],
      taskCounter: 1,
    }),
}));
