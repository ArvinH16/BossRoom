import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { gameSocket } from './websocket';
import type { ServerMessage } from '@bossroom/shared-types';
import { agents as defaultAgents } from '@/data/agents';
import type { AgentData } from '@/data/agents';

export function initWebSocket(username: string, token: string, tokenRefresher: () => Promise<string>, uid: string) {
  if (gameSocket.connected) return;

  gameSocket.onMessage((msg: ServerMessage) => {
    switch (msg.type) {
      case 'world:state': {
        const worldStore = useWorldStore.getState();
        worldStore.setConnected(true, uid);

        // Map agents from world state, merging with default frontend data
        const agentStates = msg.payload.agents;
        console.log('[WebSocket] Received world:state with agents:', agentStates);
        console.log('[WebSocket] Default agents:', defaultAgents);
        
        const mapped: AgentData[] = defaultAgents.map((def) => {
          const serverAgent = agentStates[def.id];
          return serverAgent
            ? { ...def, status: serverAgent.status }
            : def;
        });
        
        console.log('[WebSocket] Mapped agents:', mapped);
        worldStore.setAgents(mapped);
        console.log('[WebSocket] Agents after setAgents:', useWorldStore.getState().agents);

        // Extract remote players (filter out self)
        const players = msg.payload.players;
        const remotePlayers: Record<string, { id: string; username: string; position: [number, number, number]; rotation: number; animation: string }> = {};
        for (const [id, p] of Object.entries(players)) {
          if (id === uid) continue;
          remotePlayers[id] = {
            id: p.id,
            username: p.username,
            position: p.position,
            rotation: p.rotation,
            animation: p.animation,
          };
        }
        worldStore.setRemotePlayers(remotePlayers);
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
          msg.payload.result,
        );
        break;

      case 'player:joined': {
        const jp = msg.payload;
        useWorldStore.getState().addRemotePlayer({
          id: jp.id,
          username: jp.username,
          position: jp.position,
          rotation: jp.rotation,
          animation: jp.animation,
        });
        break;
      }

      case 'player:moved':
        useWorldStore.getState().updateRemotePlayer(
          msg.payload.playerId,
          msg.payload.position,
          msg.payload.rotation,
          msg.payload.animation,
        );
        break;

      case 'player:left':
        useWorldStore.getState().removeRemotePlayer(msg.payload.playerId);
        if (msg.payload.playerId === '__self__') {
          useWorldStore.getState().setConnected(false);
        }
        break;
    }
  });

  gameSocket.setTokenRefresher(tokenRefresher);
  gameSocket.connect(username, token);
}
