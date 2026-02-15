import { WebSocket } from 'ws';
import { streamText, stepCountIs } from 'ai';
import type { ServerMessage, DynamicAgent } from '@bossroom/shared-types';
import { TIMEOUTS } from '@bossroom/shared-utils';
import { getModel } from '../../ai/gateway.js';
import { getComposioTools } from '../../ai/composio.js';
import { mcpManager } from '../../ai/mcp.js';
import { synthesizeSpeech } from '../../ai/tts.js';
import { log } from '../../logger.js';
import type { AgentRepository } from './repository.js';
import type { ConversationService } from '../conversations/service.js';
import type { PlayerService } from '../players/service.js';
import type { SkillService } from '../skills/service.js';
import { createSetupWorkspaceTool, createAgentSkillTools, createDelegateTaskTool } from './skillTools.js';

interface AgentServiceDeps {
  agentRepo: AgentRepository;
  conversationService: ConversationService;
  playerService: PlayerService;
  skillService: SkillService;
}

export function createAgentService(deps: AgentServiceDeps) {
  const { agentRepo, conversationService, playerService, skillService } = deps;

  /**
   * Handle delegation: lead agent sends a task to a worker agent.
   * Runs the worker's LLM with streaming and returns the response.
   */
  async function handleDelegation(
    fromAgentId: string,
    targetName: string,
    taskDescription: string,
    playerId: string,
    ws: WebSocket,
    broadcastFn: (msg: ServerMessage) => void,
  ): Promise<string> {
    const targetAgent = agentRepo.findDynamicByName(targetName);
    if (!targetAgent) {
      throw new Error(`Agent "${targetName}" not found in workspace`);
    }

    // Broadcast delegation event to frontend
    broadcastFn({
      type: 'agent:delegatedTask',
      payload: {
        fromAgentId,
        toAgentId: targetAgent.agentId,
        toAgentName: targetAgent.name,
        task: taskDescription,
      },
    });

    // Set target agent to thinking
    agentRepo.setStatus(targetAgent.agentId, 'thinking');
    broadcastFn({
      type: 'agent:statusChanged',
      payload: { agentId: targetAgent.agentId, status: 'thinking' },
    });

    try {
      const model = getModel(targetAgent.model);

      // Build tools for the worker agent
      const workerSkillTools = createAgentSkillTools({
        skillService,
        agentId: targetAgent.agentId,
        broadcastFn,
      });

      // Set to working
      agentRepo.setStatus(targetAgent.agentId, 'working');
      broadcastFn({
        type: 'agent:statusChanged',
        payload: { agentId: targetAgent.agentId, status: 'working' },
      });

      // Stream the worker's response to the frontend
      const result = streamText({
        model,
        system: targetAgent.systemPrompt,
        messages: [{ role: 'user' as const, content: taskDescription }],
        tools: workerSkillTools,
        stopWhen: stepCountIs(3),
      });

      let fullResponse = '';
      for await (const delta of result.textStream) {
        fullResponse += delta;
        playerService.send(ws, {
          type: 'agent:chatStream',
          payload: { agentId: targetAgent.agentId, delta },
        });
      }

      // Send complete message
      playerService.send(ws, {
        type: 'agent:chatMessage',
        payload: { agentId: targetAgent.agentId, role: 'assistant', content: fullResponse },
      });

      // Reset status
      agentRepo.setStatus(targetAgent.agentId, 'idle');
      broadcastFn({
        type: 'agent:statusChanged',
        payload: { agentId: targetAgent.agentId, status: 'idle' },
      });

      return fullResponse;
    } catch (err) {
      log.error(`[delegate] Worker ${targetAgent.name} error:`, err);
      agentRepo.setStatus(targetAgent.agentId, 'error');
      broadcastFn({
        type: 'agent:statusChanged',
        payload: { agentId: targetAgent.agentId, status: 'error' },
      });

      setTimeout(() => {
        agentRepo.setStatus(targetAgent.agentId, 'idle');
        broadcastFn({
          type: 'agent:statusChanged',
          payload: { agentId: targetAgent.agentId, status: 'idle' },
        });
      }, TIMEOUTS.AGENT_ERROR_RECOVERY_MS);

      throw err;
    }
  }

  /**
   * Handle workspace build: register dynamic agents and kick off lead agent.
   */
  function handleWorkspaceBuilt(
    dynamicAgents: DynamicAgent[],
    taskSummary: string,
    playerId: string,
    ws: WebSocket,
    broadcastFn: (msg: ServerMessage) => void,
  ) {
    const allTeamNames = dynamicAgents.map((a) => a.name);

    // Register each dynamic agent
    for (const agent of dynamicAgents) {
      const agentSkills = skillService.getSkillsForAgent(agent.agentId);
      agentRepo.registerDynamic(agent, agentSkills, allTeamNames);
    }

    // Auto-kickoff: after a delay (for build animation), send the lead's initial task
    const leadAgent = dynamicAgents.find((a) => a.role === 'lead');
    if (leadAgent?.initialTask) {
      setTimeout(async () => {
        try {
          log.info(`[workspace] Auto-kickoff: ${leadAgent.name} starting on task`);
          await handleDynamicAgentMessage(
            playerId,
            leadAgent.agentId,
            leadAgent.initialTask!,
            ws,
            broadcastFn,
          );
        } catch (err) {
          log.error(`[workspace] Auto-kickoff failed for ${leadAgent.name}:`, err);
        }
      }, 3000); // 3s delay for build animation
    }
  }

  /**
   * Handle a message sent to a dynamic agent.
   */
  async function handleDynamicAgentMessage(
    playerId: string,
    agentId: string,
    content: string,
    ws: WebSocket,
    broadcastFn: (msg: ServerMessage) => void,
  ) {
    const dynamicAgent = agentRepo.getDynamic(agentId);
    if (!dynamicAgent) {
      log.warn(`[agent] Dynamic agent ${agentId} not found`);
      return;
    }

    // Status -> thinking
    agentRepo.setStatus(agentId, 'thinking');
    broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'thinking' } });

    try {
      const model = getModel(dynamicAgent.model);

      // Build tools based on role
      const agentSkillToolSet = createAgentSkillTools({
        skillService,
        agentId,
        broadcastFn,
      });

      let tools = { ...agentSkillToolSet };

      // Lead agents get delegate_task tool
      if (dynamicAgent.role === 'lead') {
        const delegateTools = createDelegateTaskTool({
          agentId,
          onDelegate: (targetName, task) =>
            handleDelegation(agentId, targetName, task, playerId, ws, broadcastFn),
          broadcastFn,
        });
        tools = { ...tools, ...delegateTools };
      }

      const hasTools = Object.keys(tools).length > 0;

      const result = streamText({
        model,
        system: dynamicAgent.systemPrompt,
        messages: [{ role: 'user' as const, content }],
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
            const resultStr = tr != null
              ? (typeof tr === 'string' ? tr : JSON.stringify(tr))
              : undefined;
            playerService.send(ws, {
              type: 'agent:toolExecution',
              payload: {
                agentId,
                toolName: tc.toolName,
                status: failed ? 'failed' : 'completed',
                result: resultStr,
              },
            });
          }
          if (fullResponse.length > 0) {
            needsStepSeparator = true;
          }
        },
      });

      // Status -> working
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

      // Send complete message
      playerService.send(ws, {
        type: 'agent:chatMessage',
        payload: { agentId, role: 'assistant', content: fullResponse },
      });

      // Reset status
      agentRepo.setStatus(agentId, 'idle');
      broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'idle' } });

    } catch (err) {
      log.error(`Dynamic Agent ${agentId} error:`, err);

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

      setTimeout(() => {
        agentRepo.setStatus(agentId, 'idle');
        broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'idle' } });
      }, TIMEOUTS.AGENT_ERROR_RECOVERY_MS);
    }
  }

  return {
    getAgentStates() {
      return agentRepo.getAll();
    },

    async handleInteraction(playerId: string, agentId: string, ws: WebSocket, displayName: string | null) {
      // Check static agents first, then dynamic
      const agent = agentRepo.get(agentId);
      const dynamicAgent = agent ? undefined : agentRepo.getDynamic(agentId);

      if (!agent && !dynamicAgent) return;

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
      // Check if this is a dynamic agent
      const dynamicAgent = agentRepo.getDynamic(agentId);
      if (dynamicAgent) {
        return handleDynamicAgentMessage(playerId, agentId, content, ws, broadcastFn);
      }

      // --- Static agent (Receptionist) ---
      const agent = agentRepo.get(agentId);
      log.info(`[DEBUG-FIX] handleMessage called: agentId=${agentId}, playerId=${playerId}, content="${content.substring(0, 100)}"`);
      if (!agent) { log.error(`[DEBUG-FIX] Agent not found: ${agentId}`); return; }

      // Find or create conversation
      let conv = conversationService.getConversationForPlayer(playerId, agentId);

      if (!conv) {
        conv = conversationService.createInMemory(playerId, agentId, conversationId, ws);
      }

      // Add user message to display history
      conversationService.addUserMessage(conv.id, content);

      // Status -> thinking
      agentRepo.setStatus(agentId, 'thinking');
      broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'thinking' } });

      try {
        const model = getModel(agent.model);
        const composioTools = await getComposioTools(playerId);
        const mcpTools = await mcpManager.getAllTools();

        // Receptionist gets setup_workspace tool
        const setupTool = agentId === 'receptionist'
          ? createSetupWorkspaceTool({
              skillService,
              playerId,
              broadcastFn,
              onWorkspaceBuilt: (agents, taskSummary) =>
                handleWorkspaceBuilt(agents, taskSummary, playerId, ws, broadcastFn),
            })
          : {};

        const tools = { ...composioTools, ...mcpTools, ...setupTool };
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
              const resultStr = tr != null
                ? (typeof tr === 'string' ? tr : JSON.stringify(tr))
                : undefined;
              playerService.send(ws, {
                type: 'agent:toolExecution',
                payload: {
                  agentId,
                  toolName: tc.toolName,
                  status: failed ? 'failed' : 'completed',
                  result: resultStr,
                },
              });
            }
            // Flag: next text delta needs a paragraph break to separate steps
            if (fullResponse.length > 0) {
              needsStepSeparator = true;
            }
          },
        });

        // Status -> working
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
        log.info(`[DEBUG-FIX] LLM response complete, length=${fullResponse.length}, preview="${fullResponse.substring(0, 100)}"`);
        playerService.send(ws, {
          type: 'agent:chatMessage',
          payload: { agentId, role: 'assistant', content: fullResponse },
        });

        // TTS: synthesize and send audio (non-blocking, fail-soft)
        log.info(`[DEBUG-FIX] Starting TTS synthesis for agent ${agentId}`);
        synthesizeSpeech(fullResponse).then((tts) => {
          if (tts) {
            log.info(`[DEBUG-FIX] TTS success, audioBase64 length=${tts.audioBase64.length}, mimeType=${tts.mimeType}`);
            playerService.send(ws, {
              type: 'agent:ttsAudio',
              payload: { agentId, audioBase64: tts.audioBase64, mimeType: tts.mimeType },
            });
          } else {
            log.warn('[DEBUG-FIX] TTS returned null (no audio)');
          }
        }).catch((err) => {
          log.error(`[DEBUG-FIX] TTS failed for agent ${agentId}:`, err);
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
