import { WebSocket } from 'ws';
import { streamText, stepCountIs } from 'ai';
import type { ServerMessage } from '@bossroom/shared-types';
import { TIMEOUTS } from '@bossroom/shared-utils';
import { getModel } from '../../ai/gateway.js';
import { getComposioTools } from '../../ai/composio.js';
import { mcpManager } from '../../ai/mcp.js';
import { log } from '../../logger.js';
import type { AgentRepository } from './repository.js';
import type { ConversationService } from '../conversations/service.js';
import type { PlayerService } from '../players/service.js';

interface AgentServiceDeps {
  agentRepo: AgentRepository;
  conversationService: ConversationService;
  playerService: PlayerService;
}

export function createAgentService(deps: AgentServiceDeps) {
  const { agentRepo, conversationService, playerService } = deps;

  return {
    getAgentStates() {
      return agentRepo.getAll();
    },

    async handleInteraction(playerId: string, agentId: string, ws: WebSocket, displayName: string | null) {
      const agent = agentRepo.get(agentId);
      if (!agent) return;

      const result = await conversationService.startOrRestore(playerId, agentId, ws, displayName);

      if (result.isNew) {
        playerService.send(ws, {
          type: 'agent:chatMessage',
          payload: { agentId, role: 'assistant', content: result.greeting },
        });
      } else {
        playerService.send(ws, {
          type: 'agent:conversationHistory',
          payload: {
            agentId,
            messages: result.historyMessages as Array<{ role: 'user' | 'assistant'; content: string }>,
          },
        });
      }

      agentRepo.setStatus(agentId, 'listening');
    },

    async handleMessage(
      playerId: string,
      agentId: string,
      conversationId: string,
      content: string,
      ws: WebSocket,
      broadcastFn: (msg: ServerMessage) => void,
    ) {
      const agent = agentRepo.get(agentId);
      if (!agent) return;

      // Find or create conversation
      let conv = conversationService.getConversationForPlayer(playerId, agentId);

      if (!conv) {
        conv = conversationService.createInMemory(playerId, agentId, conversationId, ws);
      }

      // Add user message to display history
      conversationService.addUserMessage(conv.id, content);

      // Status → thinking
      agentRepo.setStatus(agentId, 'thinking');
      broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'thinking' } });

      try {
        const model = getModel(agent.model);
        const composioTools = await getComposioTools(playerId);
        const mcpTools = await mcpManager.getAllTools();
        const tools = { ...composioTools, ...mcpTools };
        const hasTools = Object.keys(tools).length > 0;

        // Build AI SDK messages
        const aiMessages = [
          ...conv.aiMessages,
          { role: 'user' as const, content },
        ];

        const result = streamText({
          model,
          system: agent.systemPrompt,
          messages: aiMessages,
          ...(hasTools ? { tools, stopWhen: stepCountIs(5) } : {}),
          onChunk: ({ chunk }) => {
            if (chunk.type === 'tool-call') {
              playerService.send(ws, {
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
              playerService.send(ws, {
                type: 'agent:toolExecution',
                payload: {
                  agentId,
                  toolName: tc.toolName,
                  status: failed ? 'failed' : 'completed',
                  result: failed ? String((tr as { error: unknown }).error) : undefined,
                },
              });
            }
            // Flag: next text delta needs a paragraph break to separate steps
            if (fullResponse.length > 0) {
              needsStepSeparator = true;
            }
          },
        });

        // Status → working
        agentRepo.setStatus(agentId, 'working');
        broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'working' } });

        // Stream text deltas to frontend
        let fullResponse = '';
        let needsStepSeparator = false;
        for await (const delta of result.textStream) {
          if (needsStepSeparator) {
            fullResponse += '\n\n';
            playerService.send(ws, {
              type: 'agent:chatStream',
              payload: { agentId, delta: '\n\n' },
            });
            needsStepSeparator = false;
          }
          fullResponse += delta;
          playerService.send(ws, {
            type: 'agent:chatStream',
            payload: { agentId, delta },
          });
        }

        // Store AI SDK response messages for multi-turn tool context
        const response = await result.response;
        conversationService.addAssistantMessage(conv.id, fullResponse);
        conversationService.updateAiMessages(conv.id, [
          ...conv.aiMessages,
          { role: 'user' as const, content },
          ...response.messages,
        ]);

        // Persist to DB (best-effort)
        try {
          await conversationService.persistToDb(conv.id);
        } catch (err) {
          log.error(`[agent] DB save failed for conversation ${conv.id}:`, err);
        }

        // Send complete message (signals end of stream to frontend)
        playerService.send(ws, {
          type: 'agent:chatMessage',
          payload: { agentId, role: 'assistant', content: fullResponse },
        });

        // Reset status
        agentRepo.setStatus(agentId, 'idle');
        broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'idle' } });

      } catch (err) {
        log.error(`Agent ${agentId} error:`, err);

        agentRepo.setStatus(agentId, 'error');
        broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'error' } });

        playerService.send(ws, {
          type: 'agent:chatMessage',
          payload: {
            agentId,
            role: 'assistant',
            content: "Oops, I hit a snag! My circuits got a bit tangled. Could you try again?",
          },
        });

        // Reset to idle after a short delay
        setTimeout(() => {
          agentRepo.setStatus(agentId, 'idle');
          broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'idle' } });
        }, TIMEOUTS.AGENT_ERROR_RECOVERY_MS);
      }
    },

    stopInteraction(playerId: string, agentId: string) {
      agentRepo.setStatus(agentId, 'idle');
    },

    handleDisconnect(playerId: string) {
      const agentIds = conversationService.cleanupPlayer(playerId);
      for (const agentId of agentIds) {
        agentRepo.setStatus(agentId, 'idle');
      }
    },
  };
}

export type AgentService = ReturnType<typeof createAgentService>;
