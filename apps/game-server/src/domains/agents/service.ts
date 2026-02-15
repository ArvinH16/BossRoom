import { WebSocket } from 'ws';
import { streamText, generateText, stepCountIs } from 'ai';
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
import type { ScratchpadService } from '../scratchpad/service.js';
import { createSetupWorkspaceTool, createAgentSkillTools, createDelegateTaskTool, createScratchpadTools, createEmbedTools } from './skillTools.js';

interface AgentServiceDeps {
  agentRepo: AgentRepository;
  conversationService: ConversationService;
  playerService: PlayerService;
  skillService: SkillService;
  scratchpadService: ScratchpadService;
}

export function createAgentService(deps: AgentServiceDeps) {
  const { agentRepo, conversationService, playerService, skillService, scratchpadService } = deps;

  /**
   * Scratchpad watcher: when an agent (or user) writes to the scratchpad,
   * a cheap classifier decides which idle agent should continue working.
   * Fire-and-forget — never blocks the caller.
   */
  async function routeScratchpadEntry(
    workspaceId: string,
    authorName: string,
    content: string,
    playerId: string,
    ws: WebSocket,
    broadcastFn: (msg: ServerMessage) => void,
  ) {
    try {
      // Find idle agents in this workspace (excluding the author)
      const allDynamic = agentRepo.getAllDynamic();
      const idleAgents = allDynamic.filter(
        (a) => a.workspaceId === workspaceId && a.status === 'idle' && a.name !== authorName,
      );

      if (idleAgents.length === 0) return;

      // Get recent scratchpad for context
      const entries = scratchpadService.read(workspaceId);
      const recentEntries = entries.slice(-10).map((e) => `[${e.authorName}] ${e.content}`).join('\n');

      const agentList = idleAgents
        .map((a) => `- ${a.name} (${a.role}): ${a.personality}`)
        .join('\n');

      const model = getModel('gemini');
      const result = await generateText({
        model,
        prompt: `You are a workspace coordinator. An entry was just posted to the team scratchpad.

LATEST ENTRY:
[${authorName}] ${content}

RECENT SCRATCHPAD:
${recentEntries}

IDLE AGENTS AVAILABLE:
${agentList}

Based on the latest entry, should any idle agent continue working? Only wake an agent if:
- The entry contains output or results that another agent needs to act on
- The entry is a handoff (e.g. "done with X, passing to Y")
- The entry is a user directive asking for action

Do NOT wake an agent if:
- The entry is just a status update with no actionable content
- The work described is not relevant to any idle agent
- All necessary work appears to be complete

Respond with EXACTLY one line in this format:
WAKE AgentName: brief instruction of what they should do based on the scratchpad
or:
NONE

No other text.`,
      });

      const response = result.text.trim();

      if (response === 'NONE' || !response.startsWith('WAKE ')) return;

      // Parse: "WAKE AgentName: instruction"
      const match = response.match(/^WAKE\s+(.+?):\s+(.+)$/);
      if (!match) return;

      const [, targetName, instruction] = match;
      const targetAgent = idleAgents.find(
        (a) => a.name.toLowerCase() === targetName.trim().toLowerCase(),
      );
      if (!targetAgent) {
        log.warn(`[scratchpad-watcher] Classifier suggested "${targetName}" but agent not found or not idle`);
        return;
      }

      log.info(`[scratchpad-watcher] Waking ${targetAgent.name}: ${instruction.slice(0, 80)}...`);

      // Inject the latest scratchpad context + instruction into the agent
      const injectedMessage = `[Coordinator] Based on team progress, here's your task:\n\n${instruction}\n\nRecent team updates:\n${recentEntries}`;

      await handleDynamicAgentMessage(playerId, targetAgent.agentId, injectedMessage, ws, broadcastFn);
    } catch (err) {
      log.error('[scratchpad-watcher] Routing failed:', err);
    }
  }

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
      const workerComposioTools = await getComposioTools(playerId);
      const workerMcpTools = await mcpManager.getAllTools();
      const workerTools = { ...workerComposioTools, ...workerMcpTools, ...workerSkillTools };

      const workerScratchpadTools = createScratchpadTools({
        scratchpadService,
        workspaceId: targetAgent.workspaceId,
        agentId: targetAgent.agentId,
        agentName: targetAgent.name,
        agentColor: targetAgent.color,
        broadcastFn: (msg) => playerService.send(ws, msg),
        onEntryWritten: (author, text) => {
          routeScratchpadEntry(targetAgent.workspaceId, author, text, playerId, ws, broadcastFn);
        },
      });
      const workerEmbedTools = createEmbedTools({
        workspaceId: targetAgent.workspaceId,
        agentId: targetAgent.agentId,
        agentName: targetAgent.name,
        broadcastFn: (msg) => playerService.send(ws, msg),
      });
      const workerToolsFinal = { ...workerTools, ...workerScratchpadTools, ...workerEmbedTools };

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
        tools: workerToolsFinal,
        stopWhen: stepCountIs(25),
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

      const composioTools = await getComposioTools(playerId);
      const mcpTools = await mcpManager.getAllTools();

      let tools = { ...composioTools, ...mcpTools, ...agentSkillToolSet };

      const scratchpadTools = createScratchpadTools({
        scratchpadService,
        workspaceId: dynamicAgent.workspaceId,
        agentId,
        agentName: dynamicAgent.name,
        agentColor: dynamicAgent.color,
        broadcastFn: (msg) => playerService.send(ws, msg),
        onEntryWritten: (author, text) => {
          routeScratchpadEntry(dynamicAgent.workspaceId, author, text, playerId, ws, broadcastFn);
        },
      });
      tools = { ...tools, ...scratchpadTools };

      const embedTools = createEmbedTools({
        workspaceId: dynamicAgent.workspaceId,
        agentId,
        agentName: dynamicAgent.name,
        broadcastFn: (msg) => playerService.send(ws, msg),
      });
      tools = { ...tools, ...embedTools };

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
        ...(hasTools ? { tools, stopWhen: stepCountIs(25) } : {}),
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

      // Dynamic agents: don't create a conversation or send a greeting.
      // Their chat is populated by delegation streams (agent:chatStream / agent:chatMessage).
      // Interacting just opens the panel on the frontend — no server-side conversation needed.
      if (dynamicAgent) {
        // Only set to listening if the agent isn't busy (delegation may be in progress)
        const currentStatus = agentRepo.getStatus(agentId);
        if (currentStatus === 'idle') {
          agentRepo.setStatus(agentId, 'listening');
        }
        return;
      }

      // Static agents: restore or create conversation
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
      inputMode: 'voice' | 'text',
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
      if (!agent) return;

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
              getDynamicAgentCount: () => agentRepo.getAllDynamic().length,
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
          ...(hasTools ? { tools, stopWhen: stepCountIs(25) } : {}),
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
        playerService.send(ws, {
          type: 'agent:chatMessage',
          payload: { agentId, role: 'assistant', content: fullResponse },
        });

        // TTS: synthesize and send audio (non-blocking, fail-soft) — voice input only
        if (inputMode === 'voice') {
          synthesizeSpeech(fullResponse).then((tts) => {
            if (tts) {
              playerService.send(ws, {
                type: 'agent:ttsAudio',
                payload: { agentId, audioBase64: tts.audioBase64, mimeType: tts.mimeType },
              });
            }
          }).catch((err) => {
            log.error(`[TTS] failed for agent ${agentId}:`, err);
          });
        }

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
      // Don't reset to idle if the agent is actively working (e.g. delegation in progress)
      const currentStatus = agentRepo.getStatus(agentId);
      if (currentStatus === 'working' || currentStatus === 'thinking') return;
      agentRepo.setStatus(agentId, 'idle');
    },

    handleDisconnect(playerId: string) {
      const agentIds = conversationService.cleanupPlayer(playerId);
      for (const agentId of agentIds) {
        agentRepo.setStatus(agentId, 'idle');
      }
    },

    /** Trigger scratchpad watcher from external callers (e.g. user notes). */
    onScratchpadWrite(
      workspaceId: string,
      authorName: string,
      content: string,
      playerId: string,
      ws: WebSocket,
      broadcastFn: (msg: ServerMessage) => void,
    ) {
      routeScratchpadEntry(workspaceId, authorName, content, playerId, ws, broadcastFn);
    },
  };
}

export type AgentService = ReturnType<typeof createAgentService>;
