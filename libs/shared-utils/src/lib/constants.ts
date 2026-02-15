export const TIMEOUTS = {
  AGENT_ERROR_RECOVERY_MS: 2000,
  TOOL_EXECUTION_DISMISS_MS: 4000,
  ONBOARDING_INTRO_MS: 4000,
  ONBOARDING_COMPLETE_MS: 5000,
} as const;

export function generateConversationId(): string {
  return crypto.randomUUID();
}
