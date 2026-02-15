import { randomUUID } from 'node:crypto';

interface ScratchpadEntry {
  id: string;
  workspaceId: string;
  authorType: 'agent' | 'user';
  authorId: string;
  authorName: string;
  authorColor: string;
  content: string;
  timestamp: number;
}

const MAX_ENTRIES = 100;

export function createScratchpadService() {
  const pads = new Map<string, ScratchpadEntry[]>();

  return {
    read(workspaceId: string): ScratchpadEntry[] {
      return pads.get(workspaceId) ?? [];
    },

    write(workspaceId: string, entry: Omit<ScratchpadEntry, 'id' | 'timestamp' | 'workspaceId'>): ScratchpadEntry {
      const full: ScratchpadEntry = {
        ...entry,
        id: randomUUID(),
        workspaceId,
        timestamp: Date.now(),
      };
      const entries = pads.get(workspaceId) ?? [];
      entries.push(full);
      if (entries.length > MAX_ENTRIES) entries.shift();
      pads.set(workspaceId, entries);
      return full;
    },

    clear(workspaceId: string): void {
      pads.delete(workspaceId);
    },
  };
}

export type ScratchpadService = ReturnType<typeof createScratchpadService>;
