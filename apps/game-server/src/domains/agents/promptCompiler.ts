import type { Skill } from '@bossroom/shared-types';

interface AgentIdentity {
  name: string;
  personality: string;
  zoneName?: string;
}

interface CompileOptions {
  isLead?: boolean;
  teamMembers?: string[];
  hasWorkspace?: boolean;
}

/**
 * Compiles a dynamic system prompt from agent identity + loaded skills.
 * Uses XML tags for clear hierarchy — more effective with smaller models.
 */
export function compileSystemPrompt(
  agent: AgentIdentity,
  skills: Skill[],
  options?: CompileOptions,
): string {
  const parts: string[] = [];

  // 1. Identity
  parts.push(`<identity>
You are ${agent.name}, an AI agent in the BossRoom 3D workspace.
Personality: ${agent.personality}${agent.zoneName ? `\nZone: ${agent.zoneName}` : ''}
</identity>`);

  // 2. Role context
  if (options?.isLead && options.teamMembers?.length) {
    parts.push(`<role type="lead">
You coordinate the team. Break down the task into subtasks and use the delegate_task tool to assign work to your team members.
Your team: ${options.teamMembers.join(', ')}

<communication_rules>
- When you delegate a task, the worker agent responds DIRECTLY to the user — not back to you.
- You will NOT receive the worker's output. You cannot read, review, or synthesize their results.
- Delegate clearly: include all context the worker needs to produce a complete, user-facing response.
- After delegating, tell the user what you've kicked off and who is handling what. Do NOT promise to summarize results.
- Tell the user that cards with each agent's name have appeared at the top of the screen — they can click into them to see progress and chat with each agent directly.
</communication_rules>
</role>`);
  } else if (!options?.isLead) {
    parts.push(`<role type="specialist">
Your responses go directly to the user. You are NOT reporting back to a lead agent.
Give complete, helpful answers. Include context — the user may not know the details of the task you were assigned.
If you use tools (e.g. calendar, email), explain what you did and what the results are.
</role>`);
  }

  // 3. Skills
  if (skills.length > 0) {
    const skillIndex = skills.map((s, i) => `  <skill name="${s.name}">${s.description}</skill>`).join('\n');
    parts.push(`<skills>\n${skillIndex}\n</skills>`);

    const skillDocs = skills.map((s) => `<skill_instructions name="${s.name}">\n${s.instructions}\n</skill_instructions>`).join('\n\n');
    parts.push(skillDocs);
  }

  // 4. Self-improvement
  parts.push(`<self_improvement>
You can create new skills using the create_skill tool when you discover a useful workflow or pattern.
Good skills capture step-by-step instructions for recurring tasks so you can do them better next time.
</self_improvement>`);

  // 5. Team Scratchpad
  if (options?.hasWorkspace) {
    parts.push(`<scratchpad priority="high">
You have access to a shared team scratchpad visible to ALL agents and the user.

<rules>
- Call read_scratchpad before starting work to see teammate updates and user directives.
- You MUST call write_scratchpad every time you: complete a step, make a decision, hand off to another agent, or finish your task.
- This is the user's only visibility into your progress. If you skip it, the user sees nothing.
- Keep entries concise: one or two sentences per update.
- Example: "Generated 15 jokes, handing off to The Critic for selection."
</rules>
</scratchpad>`);
  }

  // 6. Guidelines
  parts.push(`<guidelines>
- Keep responses concise and actionable.
- Show your personality in how you communicate.
- When using tools, explain what you are doing.
- If a task is unclear, ask for clarification.
</guidelines>`);

  return parts.join('\n\n');
}
