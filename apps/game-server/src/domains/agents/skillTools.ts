import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import type { SkillService } from '../skills/service.js';
import type { ServerMessage, SkillSummary, DynamicAgent } from '@bossroom/shared-types';
import { log } from '../../logger.js';
import { randomUUID } from 'crypto';

/**
 * Compute a unique zone position for a dynamic agent based on its global index.
 * Grid: 5 columns (x = -20, -10, 0, 10, 20), rows start at z = -6 stepping -10.
 */
const ZONE_COLUMNS = [-20, -10, 0, 10, 20];
const ZONE_ROW_START_Z = -6;
const ZONE_ROW_SPACING = -10;

function getZonePosition(index: number): [number, number, number] {
  const col = index % ZONE_COLUMNS.length;
  const row = Math.floor(index / ZONE_COLUMNS.length);
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
  })).min(1).max(3),
});

const delegateTaskParams = z.object({
  targetAgentName: z.string().describe('Name of the team member to delegate to'),
  taskDescription: z.string().describe('Clear description of what they should do'),
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
      'Create a custom team of AI agents for the user task. Choose 1-3 agents with creative names, distinct personalities, relevant skills, and designate one as lead.',
    inputSchema: setupWorkspaceParams,
    execute: async (args: z.infer<typeof setupWorkspaceParams>) => {
      const agentDefs = args.agents;

      // 1. Generate unique IDs and assign positions (offset by existing agents)
      const baseIndex = getDynamicAgentCount();
      const dynamicAgents: DynamicAgent[] = agentDefs.map((def, i) => ({
        agentId: `agent-${randomUUID().slice(0, 8)}`,
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
