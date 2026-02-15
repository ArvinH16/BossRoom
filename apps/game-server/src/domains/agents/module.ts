import type { AgentRepository } from './repository.js';
import { createAgentService, type AgentService } from './service.js';
import type { ConversationService } from '../conversations/service.js';
import type { PlayerService } from '../players/service.js';

interface AgentModuleDeps {
  agentRepo: AgentRepository;
  conversationService: ConversationService;
  playerService: PlayerService;
}

export function createAgentModule(deps: AgentModuleDeps): { service: AgentService } {
  const service = createAgentService({
    agentRepo: deps.agentRepo,
    conversationService: deps.conversationService,
    playerService: deps.playerService,
  });
  return { service };
}
