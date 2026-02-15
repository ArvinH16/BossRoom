/** Heads-up display: logo, connection status, agent roster. */
'use client';

import { useGameStore } from '@/stores/gameStore';
import { statusColors } from '@/data/agents';

export function HUD() {
  const connected = useGameStore((s) => s.connected);
  const agents = useGameStore((s) => s.agents);

  return (
    <div className="fixed top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none z-40">
      {/* Left: Logo + connection */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-white tracking-tight">
          Boss<span className="text-indigo-400">Room</span>
        </h1>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-400' : 'bg-red-400 animate-pulse'
            }`}
          />
          <span className="text-[10px] text-white/40">
            {connected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Right: Agent roster */}
      <div className="flex flex-col gap-1">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5"
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusColors[agent.status] }}
            />
            <span className="text-xs text-white font-medium">
              {agent.name}
            </span>
            <span className="text-[10px] text-white/40">{agent.zone}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
