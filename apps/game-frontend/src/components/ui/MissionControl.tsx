/** Mission Control: compact agent badges at top of screen during workspace activity. */
'use client';

import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { statusColors } from '@/data/agents';
import type { AgentStatus } from '@bossroom/shared-types';

function AgentBadge({
  name,
  color,
  status,
  role,
  onClick,
}: {
  name: string;
  color: string;
  status: AgentStatus;
  role: 'lead' | 'worker';
  onClick: () => void;
}) {
  const isActive = status === 'working' || status === 'thinking';
  const statusColor = statusColors[status];

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1
                 border border-white/10 hover:border-white/25 transition-all cursor-pointer"
    >
      {/* Status indicator — checkmark when done, dot otherwise */}
      {status === 'done' ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#14B8A6" className="w-3 h-3 shrink-0">
          <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
        </svg>
      ) : (
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: statusColor }}
        />
      )}
      {/* Agent name */}
      <span className="text-xs text-white/80 whitespace-nowrap">
        {name}
      </span>
      {/* Lead badge */}
      {role === 'lead' && (
        <span
          className="text-[9px] font-medium px-1 py-px rounded-sm"
          style={{ backgroundColor: `${color}30`, color }}
        >
          lead
        </span>
      )}
    </button>
  );
}

export function MissionControl() {
  const phase = useWorkspaceStore((s) => s.phase);
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
  const taskSummary = useWorkspaceStore((s) => s.taskSummary);
  const worldAgents = useWorldStore((s) => s.agents);
  const openChat = useChatStore((s) => s.openChat);

  // Only show when workspace is building or ready and there are dynamic agents
  if (phase === 'reception' || dynamicAgents.length === 0) return null;

  return (
    <div className="fixed top-3 left-3 right-3 z-40 pointer-events-none">
      <div className="max-w-5xl mx-auto pointer-events-auto">
        {/* Task summary */}
        {taskSummary && (
          <div className="text-center mb-2">
            <span className="text-[11px] text-white/40 bg-black/40 backdrop-blur-sm rounded-full px-3 py-0.5">
              {phase === 'building' ? 'Building workspace...' : taskSummary}
            </span>
          </div>
        )}

        {/* Agent badges — wrapping flex layout */}
        <div className="flex flex-wrap justify-center gap-1.5">
          {dynamicAgents.map((da) => {
            const worldAgent = worldAgents.find((a) => a.id === da.agentId);
            const status: AgentStatus = worldAgent?.status ?? 'idle';

            return (
              <AgentBadge
                key={da.agentId}
                name={da.name}
                color={da.color}
                status={status}
                role={da.role}
                onClick={() => openChat(da.agentId)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
