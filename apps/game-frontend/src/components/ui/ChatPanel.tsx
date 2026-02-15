/** Slide-in right panel for chatting with an agent: messages, streaming, suggested prompts, input. */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { Markdown } from '@/components/ui/Markdown';
import { ThinkingIndicator } from '@/components/ui/ThinkingIndicator';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { AgentStatusBadge } from '@/components/ui/AgentStatusBadge';
import { useVoiceStore } from '@/stores/voiceStore';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatPanelOpen = useChatStore((s) => s.chatPanelOpen);
  const activeAgent = useChatStore((s) => s.activeAgent);
  const agents = useWorldStore((s) => s.agents);
  const chatMessages = useChatStore((s) => s.chatMessages);
  const streamingText = useChatStore((s) => s.streamingText);
  const closeChat = useChatStore((s) => s.closeChat);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isTTSPlaying = useVoiceStore((s) => s.isTTSPlaying);
  const stopTTS = useVoiceStore((s) => s.stopTTS);

  const agent = agents.find((a) => a.id === activeAgent);
  const messages = activeAgent ? (chatMessages[activeAgent] ?? []) : [];
  const currentStream = activeAgent ? (streamingText[activeAgent] ?? '') : '';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, currentStream]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && chatPanelOpen) {
        closeChat();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chatPanelOpen, closeChat]);

  function handleSend() {
    if (!input.trim() || !activeAgent) return;
    sendMessage(activeAgent, input.trim());
    setInput('');
  }

  return (
    <div
      className={`fixed top-0 right-0 h-full w-96 z-50
        bg-gray-950/95 backdrop-blur-md border-l border-white/10
        flex flex-col transition-transform duration-300 ease-out
        ${chatPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      {agent && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <AgentAvatar name={agent.name} color={agent.color} />
              <div>
                <h2 className="text-white font-semibold text-sm">
                  {agent.name}
                </h2>
                <p className="text-white/50 text-xs">{agent.zone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AgentStatusBadge status={agent.status} />
              {isTTSPlaying && (
                <button
                  onClick={stopTTS}
                  className="text-white/50 hover:text-red-400 p-1 transition-colors"
                  title="Stop speaking"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <rect x="3" y="3" width="10" height="10" rx="1" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => closeChat()}
                className="text-white/50 hover:text-white text-xl leading-none p-1"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Agent info */}
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-white/60 text-xs">{agent.description}</p>
            <p className="text-white/40 text-xs italic mt-1">
              &ldquo;{agent.personality}&rdquo;
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 min-w-0">
            {messages.length === 0 && !currentStream && (
              <div className="space-y-2">
                <p className="text-white/30 text-xs text-center mb-4">
                  Start a conversation
                </p>
                {agent.suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      if (activeAgent) sendMessage(activeAgent, prompt);
                    }}
                    className="block w-full text-left px-3 py-2 rounded-lg
                      bg-white/5 hover:bg-white/10 border border-white/10
                      text-white/70 text-xs transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
            {messages.map((msg, i) =>
              msg.role === 'tool' ? (
                <ToolChip key={i} toolName={msg.toolName} status={msg.status} />
              ) : (
                <div
                  key={i}
                  className={`max-w-prose px-3 py-2 rounded-lg text-sm break-words ${
                    msg.role === 'user'
                      ? 'ml-auto bg-indigo-600/60 text-white whitespace-pre-wrap'
                      : 'mr-auto bg-white/10 text-white/80'
                  }`}
                >
                  {msg.role === 'agent' ? (
                    <Markdown content={msg.content} />
                  ) : (
                    msg.content
                  )}
                </div>
              ),
            )}

            {/* Streaming text */}
            {currentStream && (
              <div className="max-w-prose mr-auto px-3 py-2 rounded-lg text-sm bg-white/10 text-white/80 break-words">
                <Markdown content={currentStream} />
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-white/60 animate-pulse" />
              </div>
            )}

            {/* Thinking indicator */}
            {agent.status === 'thinking' && !currentStream && (
              <div className="max-w-prose mr-auto px-3 py-2 rounded-lg text-sm bg-white/10 text-white/40">
                <ThinkingIndicator />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    handleSend();
                  }
                }}
                placeholder={`Message ${agent.name}...`}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10
                  text-white text-sm placeholder:text-white/30
                  focus:outline-none focus:border-white/30"
              />
              <button
                onClick={handleSend}
                disabled={agent.status === 'thinking' || agent.status === 'working'}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                  text-white text-sm font-medium transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatToolName(raw: string): string {
  const parts = raw.split('_');
  const meaningful = parts.length > 1 ? parts.slice(1) : parts;
  return meaningful
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function ToolChip({ toolName, status }: { toolName: string; status: 'started' | 'completed' | 'failed' }) {
  const label = status === 'started'
    ? `Running ${formatToolName(toolName)}...`
    : status === 'completed'
      ? `${formatToolName(toolName)}`
      : `Failed: ${formatToolName(toolName)}`;

  return (
    <p className={`text-[11px] leading-relaxed ${
      status === 'failed' ? 'text-red-400/70' : 'text-white/50'
    }`}>
      {label}
    </p>
  );
}
