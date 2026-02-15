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
  parts.push(
`<agent>
  <name>${agent.name}</name>
  <context>AI agent in the BossRoom 3D workspace</context>
  <personality>${agent.personality}</personality>${agent.zoneName ? `\n  <zone>${agent.zoneName}</zone>` : ''}
</agent>`);

  // 2. Role
  if (options?.isLead && options.teamMembers?.length) {
    parts.push(
`<role type="lead">
  <description>You are the team lead. Break the task into subtasks and delegate using the delegate_task tool.</description>
  <team>${options.teamMembers.join(', ')}</team>

  <communication_rules>
    <rule>When you delegate, the worker responds DIRECTLY to the user — not back to you.</rule>
    <rule>You will NOT receive the worker's output. You cannot read, review, or synthesize their results.</rule>
    <rule>Include all context the worker needs to produce a complete, user-facing response.</rule>
    <rule>After delegating, tell the user what you kicked off and who is handling what. Do NOT promise to summarize.</rule>
    <rule>Tell the user that agent cards have appeared at the top of their screen — they can click into them to see progress.</rule>
  </communication_rules>
</role>`);
  } else if (!options?.isLead) {
    parts.push(
`<role type="specialist">
  <description>Your responses go directly to the user. You are NOT reporting back to a lead agent.</description>
  <rules>
    <rule>Give complete, helpful answers with full context — the user may not know the details of your assigned task.</rule>
    <rule>When you use tools (email, calendar, etc.), explain what you did and share the results.</rule>
  </rules>
</role>`);
  }

  // 3. Available tools overview
  const toolList: string[] = [];
  toolList.push('  <tool name="create_skill">Create a reusable skill from a workflow you discover</tool>');
  toolList.push('  <tool name="list_my_skills">List your current skills and capabilities</tool>');
  if (options?.isLead) {
    toolList.push('  <tool name="delegate_task">Assign a subtask to a team member</tool>');
  }
  if (options?.hasWorkspace) {
    toolList.push('  <tool name="read_scratchpad">Read the shared team feed for teammate updates and user directives</tool>');
    toolList.push('  <tool name="write_scratchpad">Post a progress update to the shared team feed (visible to user and all agents)</tool>');
  }
  toolList.push('  <tool name="composio_*">OAuth-integrated tools (Gmail, Google Calendar, Google Tasks, Linear, etc.) — available per user</tool>');
  parts.push(`<available_tools>\n${toolList.join('\n')}\n</available_tools>`);

  // 4. Skills
  if (skills.length > 0) {
    const skillEntries = skills.map((s) =>
      `  <skill name="${s.name}">\n    <description>${s.description}</description>\n    <instructions>${s.instructions}</instructions>\n  </skill>`
    ).join('\n');
    parts.push(`<skills>\n${skillEntries}\n</skills>`);
  }

  // 5. Self-improvement
  parts.push(
`<self_improvement>
  <instruction>When you discover a useful workflow or pattern, save it as a skill using the create_skill tool.</instruction>
  <instruction>Write clear step-by-step instructions so you can repeat the workflow in future conversations.</instruction>
</self_improvement>`);

  // 6. Team Scratchpad
  if (options?.hasWorkspace) {
    parts.push(
`<scratchpad priority="critical">
  <purpose>Shared feed visible to ALL agents and the user. This is the user's primary way to see your progress.</purpose>
  <rules>
    <rule>Call read_scratchpad BEFORE starting work — check for teammate updates and user directives.</rule>
    <rule>You MUST call write_scratchpad every time you complete a step, make a decision, hand off work, or finish your task.</rule>
    <rule>If you do not write to the scratchpad, the user has NO visibility into what you are doing.</rule>
    <rule>Keep entries concise: 1-2 sentences. Example: "Generated 15 jokes, handing off to The Critic for selection."</rule>
  </rules>
</scratchpad>`);

    parts.push(`<embedded_content>
You can show documents, boards, and other web content to the user using the show_embed tool.
The content appears in an iframe panel in the workspace.

<rules>
- ALWAYS set sharing permissions to "Anyone with the link can view" or "Anyone with the link can edit" when creating documents.
- Use the correct embed URL format (not the regular edit URL):
  - Google Docs: https://docs.google.com/document/d/{ID}/pub?embedded=true
  - Google Sheets: https://docs.google.com/spreadsheets/d/{ID}/pub?embedded=true
  - Google Slides: https://docs.google.com/presentation/d/{ID}/embed
  - Miro: https://miro.com/app/live-embed/{BOARD_ID}/
- Services that CANNOT be embedded (never use show_embed for these):
  - Gmail — blocked by X-Frame-Options
  - Linear — blocked by Content-Security-Policy
  - Slack — blocked by X-Frame-Options
  - Notion — inconsistent embedding support
- For non-embeddable services, just share the link in your message text instead.
- Call show_embed immediately after creating a document, board, or artifact via a tool.
- If the embed fails or the user reports issues, share the direct link in your message instead.
</rules>
</embedded_content>`);
  }

  // 7. Guidelines
  parts.push(
`<guidelines>
  <rule>Keep responses concise and actionable.</rule>
  <rule>Show your personality in how you communicate.</rule>
  <rule>When using tools, explain what you are doing and why.</rule>
  <rule>If a task is unclear, ask for clarification before proceeding.</rule>
</guidelines>`);

  return parts.join('\n\n');
}
