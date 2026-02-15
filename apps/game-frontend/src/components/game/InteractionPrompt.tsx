/** "Press E to talk to [Agent]" overlay shown when player is near an NPC. */
'use client';

import { useGameStore } from '@/stores/gameStore';

export function InteractionPrompt() {
  const nearestAgent = useGameStore((s) => s.nearestAgent);
  const agents = useGameStore((s) => s.agents);
  const chatPanelOpen = useGameStore((s) => s.chatPanelOpen);

  if (!nearestAgent || chatPanelOpen) return null;

  const agent = agents.find((a) => a.id === nearestAgent);
  if (!agent) return null;

  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50
        px-6 py-3 rounded-xl bg-black/70 backdrop-blur-sm border border-white/10
        text-white text-sm font-medium pointer-events-none
        animate-[fadeIn_0.2s_ease-out]"
    >
      Press{' '}
      <kbd className="px-2 py-0.5 mx-1 rounded bg-white/15 border border-white/20 text-xs font-mono">
        E
      </kbd>{' '}
      to talk to{' '}
      <span style={{ color: agent.color }}>{agent.name}</span>
    </div>
  );
}
