import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useVoiceStore } from '@/stores/voiceStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { gameSocket } from './websocket';
import type { ServerMessage } from '@bossroom/shared-types';
import { RANDOM_AVATAR_ID } from '@bossroom/shared-types';
import { agents as defaultAgents, toDynamicAgentData } from '@/data/agents';
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
        const mapped: AgentData[] = defaultAgents.map((def) => {
          const serverAgent = agentStates[def.id];
          return serverAgent
            ? { ...def, status: serverAgent.status }
            : def;
        });
        worldStore.setAgents(mapped);

        // Extract remote players (filter out self)
        const players = msg.payload.players;
        const remotePlayers: Record<string, { id: string; username: string; position: [number, number, number]; rotation: number; animation: string; avatarId: string }> = {};
        for (const [id, p] of Object.entries(players)) {
          if (id === uid) continue;
          remotePlayers[id] = {
            id: p.id,
            username: p.username,
            position: p.position,
            rotation: p.rotation,
            animation: p.animation,
            avatarId: p.avatarId,
          };
        }
        worldStore.setRemotePlayers(remotePlayers);

        // Initialize local user's avatar from server
        const selfPlayer = players[uid];
        if (selfPlayer) {
          useSettingsStore.getState().setAvatarFromServer(
            selfPlayer.avatarPreference ?? selfPlayer.avatarId ?? RANDOM_AVATAR_ID,
            selfPlayer.avatarId,
          );
        }
        break;
      }

      case 'agent:statusChanged': {
        const { agentId, status } = msg.payload;
        // Update static agent status
        useWorldStore.getState().updateAgentStatus(agentId, status);
        // Also update dynamic agents in workspace store
        const wsStore = useWorkspaceStore.getState();
        const dynAgent = wsStore.dynamicAgents.find((a) => a.agentId === agentId);
        if (dynAgent) {
          // Update worldStore for dynamic agents too (add if missing)
          useWorldStore.getState().updateAgentStatus(agentId, status);
        }
        break;
      }

      case 'agent:conversationHistory': {
        const { agentId, messages: history } = msg.payload;

        // After newTask/closeCurrentTask, ignore the server restoring old history
        if (agentId === 'receptionist' && useChatStore.getState().ignoreNextHistory) {
          useChatStore.setState({ ignoreNextHistory: false });
          break;
        }

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

      case 'agent:ttsAudio':
        useVoiceStore.getState().enqueueTTS({
          agentId: msg.payload.agentId,
          audioBase64: msg.payload.audioBase64,
          mimeType: msg.payload.mimeType,
        });
        break;

      // --- Dynamic workspace events ---

      case 'workspace:build': {
        const { agents: dynamicAgents, taskSummary } = msg.payload;
        // Start the build sequence
        useWorkspaceStore.getState().startBuild(dynamicAgents, taskSummary);

        // Track which agents belong to the current task
        const newAgentIds = dynamicAgents.map((a) => a.agentId);
        useChatStore.getState().registerTaskAgents(newAgentIds);

        // Add dynamic agents to world store for status tracking
        const worldStore = useWorldStore.getState();
        const currentAgents = worldStore.agents;
        const newAgents = dynamicAgents.map((a) => toDynamicAgentData(a));
        worldStore.setAgents([...currentAgents, ...newAgents]);
        break;
      }

      case 'agent:delegatedTask': {
        const { fromAgentId, toAgentName, task } = msg.payload;
        // Show delegation in lead agent's chat as a special message
        useChatStore.getState().addMessage(fromAgentId, {
          role: 'agent',
          content: `*Delegating to ${toAgentName}:* ${task}`,
        });
        break;
      }

      case 'agent:skills':
        // Skills loaded for an agent — could be stored if needed
        break;

      case 'agent:skillCreated': {
        const { agentId, skill } = msg.payload;
        // Show skill creation in chat
        useChatStore.getState().addMessage(agentId, {
          role: 'agent',
          content: `*New skill created:* ${skill.name} — ${skill.description}`,
        });
        break;
      }

      // --- Player events ---

      case 'player:joined': {
        const jp = msg.payload;
        useWorldStore.getState().addRemotePlayer({
          id: jp.id,
          username: jp.username,
          position: jp.position,
          rotation: jp.rotation,
          animation: jp.animation,
          avatarId: jp.avatarId,
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

      case 'player:avatarChanged':
        useWorldStore.getState().updateRemotePlayerAvatar(
          msg.payload.playerId,
          msg.payload.avatarId,
        );
        break;
    }
  });

  gameSocket.setTokenRefresher(tokenRefresher);
  gameSocket.connect(username, token);
}
