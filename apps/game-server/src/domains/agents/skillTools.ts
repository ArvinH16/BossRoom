import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import type { SkillService } from '../skills/service.js';
import type { ServerMessage, SkillSummary, DynamicAgent } from '@bossroom/shared-types';
import { log } from '../../logger.js';
import { randomUUID } from 'node:crypto';
import type { ScratchpadService } from '../scratchpad/service.js';

/**
 * Compute a unique zone position for a dynamic agent based on its global index.
 * Grid: 5 columns (x = -20..20), 5 rows (z = -6..-46), scattered so consecutive
 * agents land in distant cells instead of filling left-to-right.
 */
const ZONE_COLUMNS = [-20, -10, 0, 10, 20];
const ZONE_ROW_START_Z = -6;
const ZONE_ROW_SPACING = -10;
const SCATTER_CAPACITY = ZONE_COLUMNS.length * 5; // 25 scattered slots
const SCATTER_MULT = 11; // coprime to 25 → bijective mapping

function getZonePosition(index: number): [number, number, number] {
  // Scatter first 25 agents across the grid; overflow continues sequentially
  const slot = index < SCATTER_CAPACITY
    ? (index * SCATTER_MULT + 3) % SCATTER_CAPACITY
    : index;
  const col = slot % ZONE_COLUMNS.length;
  const row = Math.floor(slot / ZONE_COLUMNS.length);
  return [ZONE_COLUMNS[col], 0, ZONE_ROW_START_Z + row * ZONE_ROW_SPACING];
}

// ----- Zod schemas (defined separately for reuse) -----

const createSkillParams = z.object({
  name: z.string().max(50).describe('Short skill name'),
  description: z.string().max(200).describe('One-line description of what this skill does'),
  instructions: z.string().max(2000).describe('Step-by-step instructions for executing this skill'),
});

const listSkillsParams = z.object({});

const setupWorkspaceParams = z.object({
  taskSummary: z.string().describe('Brief summary of what the user needs'),
  agents: z.array(z.object({
    name: z.string().max(30).describe('Creative agent name (e.g., "Strategist", "Scribe")'),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).describe('Hex color for the agent (e.g., "#E74C3C")'),
    zoneName: z.string().max(30).describe('Name of the agent workspace zone (e.g., "Strategy Room")'),
    personality: z.string().max(200).describe('Agent personality description'),
    role: z.enum(['lead', 'worker']).describe('Team role: lead coordinates others'),
    skills: z.array(z.object({
      name: z.string().max(50),
      description: z.string().max(200),
      instructions: z.string().max(2000),
    })).min(1).max(4).describe('Skills for this agent'),
    initialTask: z.string().optional().describe('Initial task for the lead agent to begin working on'),
  })).min(1),
});

const delegateTaskParams = z.object({
  targetAgentName: z.string().describe('Name of the team member to delegate to'),
  taskDescription: z.string().describe('Clear description of what they should do'),
});

const readScratchpadParams = z.object({});

const writeScratchpadParams = z.object({
  content: z.string().max(500).describe('Brief update about what you found, decided, or completed'),
});

const showEmbedParams = z.object({
  url: z.string().url().describe('The publicly accessible embed URL for the document, board, or artifact'),
  title: z.string().max(100).describe('Short title for the embed tab'),
  type: z.enum(['document', 'board', 'spreadsheet', 'presentation', 'other']).describe('Type of embedded content'),
});

// ----- Types for tool factory deps -----

interface SkillToolsDeps {
  skillService: SkillService;
  agentId: string;
  broadcastFn: (msg: ServerMessage) => void;
}

interface SetupWorkspaceDeps {
  skillService: SkillService;
  playerId: string;
  broadcastFn: (msg: ServerMessage) => void;
  onWorkspaceBuilt: (agents: DynamicAgent[], taskSummary: string) => void;
  getDynamicAgentCount: () => number;
}

interface DelegateTaskDeps {
  agentId: string;
  onDelegate: (targetName: string, task: string) => Promise<string>;
  broadcastFn: (msg: ServerMessage) => void;
}

interface ScratchpadToolsDeps {
  scratchpadService: ScratchpadService;
  workspaceId: string;
  agentId: string;
  agentName: string;
  agentColor: string;
  broadcastFn: (msg: ServerMessage) => void;
}

interface EmbedToolsDeps {
  workspaceId: string;
  agentId: string;
  agentName: string;
  broadcastFn: (msg: ServerMessage) => void;
}

// ----- Tool factories -----

/**
 * Tools available to every worker agent: create_skill + list_my_skills
 */
export function createAgentSkillTools(deps: SkillToolsDeps): ToolSet {
  const { skillService, agentId, broadcastFn } = deps;

  const createSkill = tool({
    description: 'Create a new reusable skill that you can use in future conversations',
    inputSchema: createSkillParams,
    execute: async (args: z.infer<typeof createSkillParams>) => {
      const result = await skillService.createSkill(agentId, args.name, args.description, args.instructions);
      if (result.error) {
        return `Failed to create skill: ${result.error}`;
      }

      const summary: SkillSummary = {
        id: result.skill.id,
        agentId: result.skill.agentId,
        name: result.skill.name,
        description: result.skill.description,
        creatorType: result.skill.creatorType,
      };

      broadcastFn({
        type: 'agent:skillCreated',
        payload: { agentId, skill: summary },
      });

      return `Skill "${args.name}" created successfully! I now have this capability for future use.`;
    },
  });

  const listMySkills = tool({
    description: 'List all your current skills and capabilities',
    inputSchema: listSkillsParams,
    execute: async (_args: z.infer<typeof listSkillsParams>) => {
      const skills = skillService.getSkillsForAgent(agentId);
      if (skills.length === 0) return 'No skills registered yet.';

      return skills
        .map((s) => `- **${s.name}** (${s.creatorType}): ${s.description}`)
        .join('\n');
    },
  });

  return { create_skill: createSkill, list_my_skills: listMySkills } as ToolSet;
}

/**
 * The setup_workspace tool — only available to the Receptionist.
 * Creates dynamic agents, skills, and triggers the build sequence.
 */
export function createSetupWorkspaceTool(deps: SetupWorkspaceDeps): ToolSet {
  const { skillService, broadcastFn, onWorkspaceBuilt, getDynamicAgentCount } = deps;

  const setupWorkspace = tool({
    description:
      'Create a custom team of AI agents for the user task. Build a full team of 6-15 specialized agents with creative names, distinct personalities, relevant skills, and designate one as lead. More agents = more parallel work and a more impressive workspace.',
    inputSchema: setupWorkspaceParams,
    execute: async (args: z.infer<typeof setupWorkspaceParams>) => {
      const workspaceId = 'ws-' + randomUUID().slice(0, 8);
      const agentDefs = args.agents;

      // 1. Generate unique IDs and assign positions (offset by existing agents)
      const baseIndex = getDynamicAgentCount();
      const dynamicAgents: DynamicAgent[] = agentDefs.map((def, i) => ({
        agentId: `agent-${randomUUID().slice(0, 8)}`,
        workspaceId,
        name: def.name,
        color: def.color,
        zoneName: def.zoneName,
        personality: def.personality,
        role: def.role,
        skills: [] as SkillSummary[],
        position: getZonePosition(baseIndex + i),
        initialTask: def.initialTask,
      }));

      // 2. Create skills in DB
      const agentSkillInputs = dynamicAgents.map((agent, i) => ({
        agentId: agent.agentId,
        skills: agentDefs[i].skills,
      }));

      const skillsByAgent = await skillService.createBulkForWorkspace(agentSkillInputs);

      // 3. Attach skill summaries to dynamic agents
      for (const agent of dynamicAgents) {
        const agentSkills = skillsByAgent.get(agent.agentId) ?? [];
        agent.skills = agentSkills.map((s) => ({
          id: s.id,
          agentId: s.agentId,
          name: s.name,
          description: s.description,
          creatorType: s.creatorType,
        }));
      }

      // 4. Broadcast workspace:build to frontend
      broadcastFn({
        type: 'workspace:build',
        payload: { agents: dynamicAgents, taskSummary: args.taskSummary },
      });

      // 5. Notify server to register dynamic agents and kick off work
      onWorkspaceBuilt(dynamicAgents, args.taskSummary);

      const teamDesc = dynamicAgents
        .map((a) => `${a.name} (${a.role}, ${a.zoneName})`)
        .join(', ');

      return `Workspace created! Team: ${teamDesc}. The build sequence is starting and your lead agent will begin working shortly.`;
    },
  });

  return { setup_workspace: setupWorkspace } as ToolSet;
}

/**
 * The delegate_task tool — only available to lead agents.
 * Routes a task to another dynamic agent and returns their response.
 */
export function createDelegateTaskTool(deps: DelegateTaskDeps): ToolSet {
  const { agentId, onDelegate } = deps;

  const delegateTask = tool({
    description: 'Assign a subtask to one of your team members. They will work on it and report back.',
    inputSchema: delegateTaskParams,
    execute: async (args: z.infer<typeof delegateTaskParams>) => {
      log.info(`[delegate] ${agentId} → ${args.targetAgentName}: ${args.taskDescription.slice(0, 80)}...`);

      try {
        const response = await onDelegate(args.targetAgentName, args.taskDescription);
        return `${args.targetAgentName} completed the task. Their response:\n\n${response}`;
      } catch (err) {
        log.error(`[delegate] Failed to delegate to ${args.targetAgentName}:`, err);
        return `Failed to delegate to ${args.targetAgentName}: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
    },
  });

  return { delegate_task: delegateTask } as ToolSet;
}

/**
 * The scratchpad tools — available to all dynamic agents in a workspace.
 * Enables shared team communication and context tracking.
 */
export function createScratchpadTools(deps: ScratchpadToolsDeps): ToolSet {
  const { scratchpadService, workspaceId, agentId, agentName, agentColor, broadcastFn } = deps;

  const readScratchpad = tool({
    description: 'Read the shared team scratchpad to see updates from teammates and the user',
    inputSchema: readScratchpadParams,
    execute: async () => {
      const entries = scratchpadService.read(workspaceId);
      if (entries.length === 0) return 'Scratchpad is empty — no updates yet.';
      return entries
        .map((e) => `[${e.authorName}] ${e.content}`)
        .join('\n');
    },
  });

  const writeScratchpad = tool({
    description: 'Post an update to the shared team scratchpad for teammates and the user to see',
    inputSchema: writeScratchpadParams,
    execute: async (args) => {
      const entry = scratchpadService.write(workspaceId, {
        authorType: 'agent',
        authorId: agentId,
        authorName: agentName,
        authorColor: agentColor,
        content: args.content,
      });
      broadcastFn({
        type: 'workspace:scratchpadEntry',
        payload: {
          workspaceId,
          entry: {
            id: entry.id,
            authorType: entry.authorType,
            authorName: entry.authorName,
            authorColor: entry.authorColor,
            content: entry.content,
            timestamp: entry.timestamp,
          },
        },
      });
      return `Posted to scratchpad: "${args.content}"`;
    },
  });

  return { read_scratchpad: readScratchpad, write_scratchpad: writeScratchpad } as ToolSet;
}

/**
 * The show_embed tool — available to all dynamic agents in a workspace.
 * Shows embedded documents/boards to the user in an iframe panel.
 */
export function createEmbedTools(deps: EmbedToolsDeps): ToolSet {
  const { workspaceId, agentId, agentName, broadcastFn } = deps;

  const showEmbed = tool({
    description: 'Show an embedded document, board, or artifact to the user in a panel. Only use for services that support iframe embedding (Google Docs, Google Sheets, Miro, etc). Do NOT use for Gmail, Linear, or other services that block iframes.',
    inputSchema: showEmbedParams,
    execute: async (args) => {
      const embedId = 'embed-' + randomUUID().slice(0, 8);
      broadcastFn({
        type: 'workspace:embedPanel',
        payload: {
          workspaceId,
          embed: {
            id: embedId,
            url: args.url,
            title: args.title,
            type: args.type,
            agentId,
            agentName,
          },
        },
      });
      return `Showing embed "${args.title}" to the user in the workspace panel.`;
    },
  });

  return { show_embed: showEmbed } as ToolSet;
}
