import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { gameSocket } from './websocket';
import type { ServerMessage } from '@bossroom/shared-types';
import { agents as defaultAgents } from '@/data/agents';
import type { AgentData } from '@/data/agents';

export function initWebSocket(username: string, token: string, tokenRefresher: () => Promise<string>) {
  if (gameSocket.connected) return;

  gameSocket.onMessage((msg: ServerMessage) => {
    switch (msg.type) {
      case 'world:state': {
        const worldStore = useWorldStore.getState();
        worldStore.setConnected(true);

        // Map agents from world state, merging with default frontend data
        const agentStates = msg.payload.agents;
        const mapped: AgentData[] = defaultAgents.map((def) => {
          const serverAgent = agentStates[def.id];
          return serverAgent
            ? { ...def, status: serverAgent.status }
            : def;
        });
        worldStore.setAgents(mapped);
        break;
      }

      case 'agent:statusChanged':
        useWorldStore.getState().updateAgentStatus(
          msg.payload.agentId,
          msg.payload.status,
        );
        break;

      case 'agent:conversationHistory': {
        const { agentId, messages: history } = msg.payload;
        // Set full history, replacing any existing messages
        useChatStore.setState((state) => ({
          chatMessages: {
            ...state.chatMessages,
            [agentId]: history.map((m) => ({
              role: m.role === 'assistant' ? 'agent' as const : 'user' as const,
              content: m.content,
            })),
          },
          streamingText: { ...state.streamingText, [agentId]: '' },
        }));
        break;
      }

      case 'agent:chatMessage': {
        const { agentId, role, content } = msg.payload;
        const chatStore = useChatStore.getState();
        const streamText = chatStore.streamingText[agentId] ?? '';
        if (role === 'assistant' && streamText && content === streamText) {
          chatStore.finalizeStream(agentId);
        } else {
          chatStore.addMessage(agentId, {
            role: role === 'assistant' ? 'agent' : 'user',
            content,
          });
        }
        break;
      }

      case 'agent:chatStream':
        useChatStore.getState().appendStream(msg.payload.agentId, msg.payload.delta);
        break;

      case 'agent:toolExecution':
        useChatStore.getState().addToolExecution(
          msg.payload.agentId,
          msg.payload.toolName,
          msg.payload.status,
        );
        break;

      case 'player:left':
        if (msg.payload.playerId === '__self__') {
          useWorldStore.getState().setConnected(false);
        }
        break;
    }
  });

  gameSocket.setTokenRefresher(tokenRefresher);
  gameSocket.connect(username, token);
}
