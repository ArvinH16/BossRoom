'use client';

import { useState, useRef, useEffect } from 'react';
import { useScratchpadStore } from '@/stores/scratchpadStore';
import { gameSocket } from '@/lib/websocket';

export function ScratchpadFeed() {
  const entries = useScratchpadStore((s) => s.entries);
  const activeWorkspaceId = useScratchpadStore((s) => s.activeWorkspaceId);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  if (!activeWorkspaceId) return null;

  const handleSubmit = () => {
    if (!input.trim()) return;
    gameSocket.send({
      type: 'workspace:userNote',
      payload: { workspaceId: activeWorkspaceId, content: input.trim() },
    });
    setInput('');
  };

  return (
    <div className="fixed left-4 bottom-24 w-80 z-40 pointer-events-none">
      <div className="pointer-events-auto flex flex-col bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden max-h-80">
        {/* Header */}
        <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-medium text-white/70">Team Feed</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-52 scrollbar-none">
          {entries.map((entry) => (
            <div key={entry.id} className="animate-[fadeIn_0.3s_ease-out]">
              <div className="flex items-start gap-1.5">
                <div
                  className="w-2 h-2 rounded-full shrink-0 mt-1"
                  style={{ backgroundColor: entry.authorColor }}
                />
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-white">
                    {entry.authorType === 'user' ? 'You' : entry.authorName}
                  </span>
                  <span className="text-[11px] text-white/60 ml-1.5">{entry.content}</span>
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-2 py-2 border-t border-white/10">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Broadcast to team..."
              className="flex-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white text-[11px] placeholder:text-white/30 focus:outline-none focus:border-white/30"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-[10px] font-medium"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
