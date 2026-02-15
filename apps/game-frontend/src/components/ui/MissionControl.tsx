/** Mission Control: top overlay showing agent activity during autonomous work. */
'use client';

import { useState } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { statusColors, statusLabels } from '@/data/agents';
import type { AgentStatus } from '@bossroom/shared-types';

const MAX_VISIBLE = 3;

function AgentCard({
  name,
  color,
  status,
  lastText,
  onClick,
}: {
  name: string;
  color: string;
  status: AgentStatus;
  lastText: string;
  onClick: () => void;
}) {
  const isActive = status !== 'idle';

  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg p-3 min-w-[200px] max-w-[260px]
                 border border-white/10 hover:border-white/20 transition-colors cursor-pointer text-left"
    >
      <div className="flex items-center gap-2">
        <div className="relative shrink-0">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          {isActive && (
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          )}
        </div>
        <span className="text-sm font-medium text-white truncate">{name}</span>
        {isActive && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full ml-auto"
            style={{
              backgroundColor: `${statusColors[status]}20`,
              color: statusColors[status],
            }}
          >
            {statusLabels[status]}
          </span>
        )}
      </div>

      {/* Last streaming text (truncated preview) */}
      <p className="text-[11px] text-white/50 line-clamp-2 leading-tight min-h-[2em]">
        {lastText || (isActive ? 'Starting up...' : 'Click to chat →')}
      </p>

      {/* Status bar */}
      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            backgroundColor: statusColors[status],
            width:
              status === 'working'
                ? '80%'
                : status === 'thinking'
                  ? '40%'
                  : status === 'idle'
                    ? '100%'
                    : '10%',
            opacity: isActive ? 1 : 0.3,
          }}
        />
      </div>
    </button>
  );
}

export function MissionControl() {
  const phase = useWorkspaceStore((s) => s.phase);
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
  const taskSummary = useWorkspaceStore((s) => s.taskSummary);
  const worldAgents = useWorldStore((s) => s.agents);
  const streamingText = useChatStore((s) => s.streamingText);
  const openChat = useChatStore((s) => s.openChat);

  // Only show when workspace is building or ready and there are dynamic agents
  if (phase === 'reception' || dynamicAgents.length === 0) return null;

  // Always show the overlay once workspace is built so users can click into agents

  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(dynamicAgents.length / MAX_VISIBLE);
  const visibleAgents = dynamicAgents.slice(page * MAX_VISIBLE, (page + 1) * MAX_VISIBLE);
  const needsCarousel = dynamicAgents.length > MAX_VISIBLE;

  return (
    <div className="fixed top-4 left-4 right-4 z-40 pointer-events-none">
      <div className="max-w-4xl mx-auto pointer-events-auto">
        {/* Task summary header */}
        {taskSummary && (
          <div className="text-center mb-2">
            <span className="text-xs text-white/40 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
              {phase === 'building' ? 'Building workspace...' : taskSummary}
            </span>
          </div>
        )}

        {/* Agent cards with carousel */}
        <div className="flex items-center justify-center gap-2">
          {needsCarousel && (
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="shrink-0 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm border border-white/10
                         text-white/60 hover:text-white hover:border-white/30 disabled:opacity-20 disabled:cursor-default
                         flex items-center justify-center transition-colors text-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}

          <div className="flex gap-3 justify-center">
            {visibleAgents.map((da) => {
              const worldAgent = worldAgents.find((a) => a.id === da.agentId);
              const status: AgentStatus = worldAgent?.status ?? 'idle';
              const lastText = streamingText[da.agentId] ?? '';
              // Truncate to last ~80 chars
              const preview =
                lastText.length > 80
                  ? '...' + lastText.slice(-80)
                  : lastText;

              return (
                <AgentCard
                  key={da.agentId}
                  name={da.name}
                  color={da.color}
                  status={status}
                  lastText={preview}
                  onClick={() => openChat(da.agentId)}
                />
              );
            })}
          </div>

          {needsCarousel && (
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="shrink-0 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm border border-white/10
                         text-white/60 hover:text-white hover:border-white/30 disabled:opacity-20 disabled:cursor-default
                         flex items-center justify-center transition-colors text-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          )}
        </div>

        {/* Page dots */}
        {needsCarousel && (
          <div className="flex justify-center gap-1.5 mt-2">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === page ? 'bg-white/60' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
