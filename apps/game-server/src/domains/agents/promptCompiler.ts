import type { Skill } from '@bossroom/shared-types';

interface AgentIdentity {
  name: string;
  personality: string;
  zoneName?: string;
}

interface CompileOptions {
  isLead?: boolean;
  teamMembers?: string[];
}

/**
 * Compiles a dynamic system prompt from agent identity + loaded skills.
 * Inspired by OpenClaw's "prompt compilation" pattern — the system prompt
 * is assembled from modular skill documents, not hardcoded.
 */
export function compileSystemPrompt(
  agent: AgentIdentity,
  skills: Skill[],
  options?: CompileOptions,
): string {
  const sections: string[] = [];

  // 1. Identity
  sections.push(
    `You are ${agent.name}, an AI agent in the BossRoom 3D workspace.`,
    `Personality: ${agent.personality}`,
  );
  if (agent.zoneName) {
    sections.push(`You work in the ${agent.zoneName}.`);
  }

  // 2. Role context
  if (options?.isLead && options.teamMembers?.length) {
    sections.push('');
    sections.push('## Your Role: Team Lead');
    sections.push(
      'You coordinate the team. Break down the task into subtasks and use the delegate_task tool to assign work to your team members.',
      `Your team: ${options.teamMembers.join(', ')}`,
      '',
      '**Important: Communication flow**',
      '- When you delegate a task, the worker agent responds DIRECTLY to the user — not back to you.',
      '- You will NOT receive the worker\'s output. You cannot read, review, or synthesize their results.',
      '- Delegate clearly: include all context the worker needs to produce a complete, user-facing response.',
      '- After delegating, tell the user what you\'ve kicked off and who is handling what. Do NOT promise to summarize results.',
      '- Guide the user to check each agent\'s conversation in the UI — buttons appear for each subagent so they can see the work in progress.',
    );
  } else if (!options?.isLead) {
    sections.push('');
    sections.push('## Your Role: Specialist');
    sections.push(
      '**Important: Your responses go directly to the user.**',
      'You are NOT reporting back to a lead agent. The user sees everything you write.',
      'Give complete, helpful answers. Include context — the user may not know the details of the task you were assigned.',
      'If you use tools (e.g. calendar, email), explain what you did and what the results are.',
    );
  }

  // 3. Skill index (progressive disclosure)
  if (skills.length > 0) {
    sections.push('');
    sections.push('## Your Skills');
    skills.forEach((s, i) => {
      sections.push(`${i + 1}. **${s.name}**: ${s.description}`);
    });
  }

  // 4. Full skill instructions
  if (skills.length > 0) {
    sections.push('');
    sections.push('## Skill Instructions');
    for (const skill of skills) {
      sections.push(`### ${skill.name}`);
      sections.push(skill.instructions);
      sections.push('');
    }
  }

  // 5. Self-improvement
  sections.push('');
  sections.push('## Self-Improvement');
  sections.push(
    'You can create new skills using the create_skill tool when you discover a useful workflow or pattern.',
    'Good skills capture step-by-step instructions for recurring tasks so you can do them better next time.',
  );

  // 6. General guidelines
  sections.push('');
  sections.push('## Guidelines');
  sections.push(
    '- Keep responses concise and actionable.',
    '- Show your personality in how you communicate.',
    '- When using tools, explain what you are doing.',
    '- If a task is unclear, ask for clarification.',
  );

  return sections.join('\n');
}
