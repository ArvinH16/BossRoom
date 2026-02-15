/** Per-agent personality-driven idle thoughts + timing constants. */

export const THOUGHT_BUBBLE = {
  /** Seconds between thought appearances */
  intervalMin: 8,
  intervalMax: 18,
  /** Seconds the thought stays visible */
  displayDuration: 3.5,
  /** Seconds for fade-in/out */
  fadeDuration: 0.4,
} as const;

export const agentThoughts: Record<string, string[]> = {};

/** Default thoughts for dynamic agents — empty to disable thought bubbles. */
export const defaultThoughts: string[] = [];
