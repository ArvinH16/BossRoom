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

export const agentThoughts: Record<string, string[]> = {
  mailbot: [
    'So many unread emails...',
    'Inbox zero is a myth.',
    'Reply all? Never again.',
    'Sorting... always sorting.',
    'Is this spam or genius?',
    'CC vs BCC... a dilemma.',
    'Attachment limit reached!',
    'Who actually reads newsletters?',
    'Email sent! ...wait, recall!',
    'Subject line game: strong.',
  ],
  taskmaster: [
    'Deadlines wait for no one.',
    'This sprint needs more sprint.',
    'Scope creep detected.',
    'On time. On budget. Pick one.',
    'Who moved my milestone?',
    'Blockers everywhere...',
    'Priority: URGENT (again).',
    'Stand-up in 5... or was it 10?',
    'The Gantt chart never lies.',
    'Status report: it depends.',
  ],
  clockwork: [
    'Tick tock, tick tock...',
    'Time flies when you plan.',
    '15 minutes early is on time.',
    'Calendar Tetris champion.',
    'Double-booked again...',
    'Lunch is at precisely 12:00.',
    'That meeting could be an email.',
    'Time zones are chaos.',
    'Scheduling in my sleep...',
    'Every second counts!',
  ],
};
