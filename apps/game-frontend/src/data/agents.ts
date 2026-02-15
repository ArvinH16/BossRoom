export interface AgentData {
  id: string;
  name: string;
  description: string;
  personality: string;
  color: string;
  position: [number, number, number];
  zone: string;
  suggestedPrompts: string[];
  status: 'idle' | 'listening' | 'thinking' | 'working' | 'error';
}

export const statusColors: Record<AgentData['status'], string> = {
  idle: '#4AD97A',
  listening: '#4A90D9',
  thinking: '#D9D94A',
  working: '#FF8C00',
  error: '#D94A4A',
};

export const zoneColors: Record<string, string> = {
  communications: '#4A90D9',
  'project-ops': '#D94A4A',
  calendar: '#4AD97A',
};

export const agents: AgentData[] = [
  {
    id: 'mailbot',
    name: 'Mailbot',
    description: 'Handles all internal and external communications.',
    personality: 'Cheerful and efficient. Loves sorting things.',
    color: '#4A90D9',
    position: [-6, 0, -6],
    zone: 'communications',
    suggestedPrompts: [
      'Check my messages',
      'Send an update to the team',
      'Summarize recent emails',
    ],
    status: 'idle',
  },
  {
    id: 'taskmaster',
    name: 'Taskmaster',
    description: 'Manages projects, tasks, and deadlines.',
    personality: 'Strict but fair. Never misses a deadline.',
    color: '#D94A4A',
    position: [6, 0, -6],
    zone: 'project-ops',
    suggestedPrompts: [
      "What's on my plate today?",
      'Create a new task',
      'Show project status',
    ],
    status: 'idle',
  },
  {
    id: 'clockwork',
    name: 'Clockwork',
    description: 'Keeps track of time, schedules, and calendar events.',
    personality: 'Precise and punctual. Speaks in time metaphors.',
    color: '#4AD97A',
    position: [0, 0, -10],
    zone: 'calendar',
    suggestedPrompts: [
      "What's on my schedule?",
      'Book a meeting',
      'When is my next free slot?',
    ],
    status: 'idle',
  },
];
