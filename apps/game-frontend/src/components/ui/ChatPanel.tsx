/** Slide-in right panel for chatting with an agent: messages, streaming, suggested prompts, input. */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useScratchpadStore } from '@/stores/scratchpadStore';
import { Markdown } from '@/components/ui/Markdown';
import { ThinkingIndicator } from '@/components/ui/ThinkingIndicator';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { AgentStatusBadge } from '@/components/ui/AgentStatusBadge';
import { useVoiceStore } from '@/stores/voiceStore';
import { useEmbedStore } from '@/stores/embedStore';
import { toDynamicAgentData } from '@/data/agents';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore, type PurchaseMode } from '@/stores/settingsStore';

function TaskTabs() {
  const archivedTasks = useChatStore((s) => s.archivedTasks);
  const activeTaskId = useChatStore((s) => s.activeTaskId);
  const taskCounter = useChatStore((s) => s.taskCounter);
  const switchTask = useChatStore((s) => s.switchTask);
  const newTask = useChatStore((s) => s.newTask);
  const closeTask = useChatStore((s) => s.closeTask);
  const closeCurrentTask = useChatStore((s) => s.closeCurrentTask);
  const currentTaskAgentIds = useChatStore((s) => s.currentTaskAgentIds);
  const removeAgents = useWorkspaceStore((s) => s.removeAgents);

  // "current" is a special key for the live task tab
  const [confirmingClose, setConfirmingClose] = useState<string | null>(null);

  function handleNewTask() {
    newTask();
  }

  function handleCloseTask(e: React.MouseEvent, taskId: string) {
    e.stopPropagation();
    if (confirmingClose === taskId) {
      if (taskId === 'current') {
        // Close the live task
        if (currentTaskAgentIds.length > 0) {
          removeAgents(currentTaskAgentIds);
          useWorldStore.getState().removeAgents(currentTaskAgentIds);
          useEmbedStore.getState().removeEmbedsByAgentIds(currentTaskAgentIds);
        }
        closeCurrentTask();
        useScratchpadStore.getState().clearWorkspace();
      } else {
        // Close an archived task
        const task = archivedTasks.find((t) => t.id === taskId);
        if (task && task.agentIds.length > 0) {
          removeAgents(task.agentIds);
          useWorldStore.getState().removeAgents(task.agentIds);
          useEmbedStore.getState().removeEmbedsByAgentIds(task.agentIds);
        }
        closeTask(taskId);
        useScratchpadStore.getState().clearWorkspace();
      }
      setConfirmingClose(null);
    } else {
      setConfirmingClose(taskId);
      // Auto-dismiss confirmation after 3s
      setTimeout(() => setConfirmingClose((cur) => cur === taskId ? null : cur), 3000);
    }
  }

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10 overflow-x-auto scrollbar-none">
      {archivedTasks.map((task) => (
        <button
          key={task.id}
          onClick={() => switchTask(task.id)}
          className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors shrink-0
            ${activeTaskId === task.id
              ? 'bg-white/15 text-white'
              : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
            }`}
        >
          <span>{task.label}</span>
          <span
            onClick={(e) => handleCloseTask(e, task.id)}
            className={`ml-0.5 leading-none transition-colors rounded-sm px-0.5
              ${confirmingClose === task.id
                ? 'text-red-400 bg-red-400/20'
                : 'text-white/30 hover:text-white/60 opacity-0 group-hover:opacity-100'
              }`}
            title={confirmingClose === task.id ? 'Click again to delete' : 'Close task'}
          >
            &times;
          </span>
        </button>
      ))}

      {/* Current live task tab */}
      <button
        onClick={() => switchTask(null)}
        className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors shrink-0
          ${activeTaskId === null
            ? 'bg-white/15 text-white'
            : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
          }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        Task {taskCounter}
        <span
          onClick={(e) => handleCloseTask(e, 'current')}
          className={`ml-0.5 leading-none transition-colors rounded-sm px-0.5
            ${confirmingClose === 'current'
              ? 'text-red-400 bg-red-400/20'
              : 'text-white/30 hover:text-white/60 opacity-0 group-hover:opacity-100'
            }`}
          title={confirmingClose === 'current' ? 'Click again to delete' : 'Close task'}
        >
          &times;
        </span>
      </button>

      {/* New task button */}
      <button
        onClick={handleNewTask}
        className="flex items-center px-2 py-1 rounded-md text-xs text-white/40 hover:text-white/70
          hover:bg-white/10 transition-colors shrink-0"
        title="New task"
      >
        +
      </button>
    </div>
  );
}

/** Purchase mode toggle bar shown when chatting with the Shopkeeper. */
function ShopModeBar() {
  const purchaseMode = useSettingsStore((s) => s.purchaseMode);
  const purchaseBudget = useSettingsStore((s) => s.purchaseBudget);
  const setPurchaseMode = useSettingsStore((s) => s.setPurchaseMode);
  const setPurchaseBudget = useSettingsStore((s) => s.setPurchaseBudget);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(purchaseBudget));

  function handleModeSwitch(mode: PurchaseMode) {
    setPurchaseMode(mode);
  }

  function commitBudget() {
    const val = parseInt(budgetInput, 10);
    if (!isNaN(val) && val >= 0) setPurchaseBudget(val);
    else setBudgetInput(String(purchaseBudget));
    setEditingBudget(false);
  }

  return (
    <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2 text-xs">
      <span className="text-white/50 mr-1">🛒</span>
      <button
        onClick={() => handleModeSwitch('approval')}
        className={`px-2 py-0.5 rounded-md transition-colors ${
          purchaseMode === 'approval'
            ? 'bg-purple-600/60 text-white'
            : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
        }`}
      >
        Approval {purchaseMode === 'approval' && '✓'}
      </button>
      <button
        onClick={() => handleModeSwitch('autonomous')}
        className={`px-2 py-0.5 rounded-md transition-colors ${
          purchaseMode === 'autonomous'
            ? 'bg-purple-600/60 text-white'
            : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
        }`}
      >
        Auto {purchaseMode === 'autonomous' && '✓'}
      </button>
      <span className="text-white/20 mx-1">|</span>
      <span className="text-white/50">Budget:</span>
      {editingBudget ? (
        <input
          autoFocus
          type="number"
          value={budgetInput}
          onChange={(e) => setBudgetInput(e.target.value)}
          onBlur={commitBudget}
          onKeyDown={(e) => { if (e.key === 'Enter') commitBudget(); }}
          className="w-16 px-1 py-0.5 rounded bg-white/10 text-white text-xs border border-white/20 focus:outline-none focus:border-purple-400"
        />
      ) : (
        <button
          onClick={() => { setBudgetInput(String(purchaseBudget)); setEditingBudget(true); }}
          className="text-white/70 hover:text-white transition-colors"
        >
          ${purchaseBudget}
        </button>
      )}
    </div>
  );
}

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
  const archivedTasks = useChatStore((s) => s.archivedTasks);
  const activeTaskId = useChatStore((s) => s.activeTaskId);
  const purchaseMode = useSettingsStore((s) => s.purchaseMode);
  const purchaseBudget = useSettingsStore((s) => s.purchaseBudget);

  const authUser = useAuthStore((s) => s.user);
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
  const worldAgent = agents.find((a) => a.id === activeAgent);
  const dynAgent = dynamicAgents.find((a) => a.agentId === activeAgent);
  const agent = worldAgent ?? (dynAgent ? toDynamicAgentData(dynAgent) : null);

  // Determine which messages to show
  const isReceptionist = activeAgent === 'receptionist';
  const isViewingArchive = isReceptionist && activeTaskId !== null;
  const archivedTask = isViewingArchive
    ? archivedTasks.find((t) => t.id === activeTaskId)
    : null;

  const messages = isViewingArchive
    ? (archivedTask?.messages ?? [])
    : activeAgent ? (chatMessages[activeAgent] ?? []) : [];
  const currentStream = isViewingArchive
    ? ''
    : activeAgent ? (streamingText[activeAgent] ?? '') : '';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, currentStream]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && chatPanelOpen) {
        useChatStore.setState({ chatPanelOpen: false });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chatPanelOpen]);

  const isShopkeeper = activeAgent === 'shopkeeper';

  function handleSend() {
    if (!input.trim() || !activeAgent || isViewingArchive) return;
    if (isShopkeeper) {
      sendMessage(activeAgent, input.trim(), 'text', { purchaseMode, purchaseBudget });
    } else {
      sendMessage(activeAgent, input.trim());
    }
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

          {/* Task tabs (receptionist only) */}
          {isReceptionist && (
            <TaskTabs />
          )}

          {/* Shopping mode bar (shopkeeper only) */}
          {isShopkeeper && <ShopModeBar />}

          {/* Agent info */}
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-white/60 text-xs">{agent.description}</p>
            <p className="text-white/40 text-xs italic mt-1">
              &ldquo;{agent.personality}&rdquo;
            </p>
          </div>

          {/* Archive banner */}
          {isViewingArchive && archivedTask && (
            <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
              <p className="text-amber-400/80 text-xs">
                Viewing {archivedTask.label} (read-only)
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 min-w-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
            {(() => {
              const hasUserMessage = messages.some((m) => m.role === 'user');
              const isBusy = agent.status === 'working' || agent.status === 'thinking';
              return !hasUserMessage && !currentStream && !isViewingArchive ? (
                <div className="flex flex-col h-full">
                  {isBusy && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-3 py-8">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]" />
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
                      </div>
                      <p className="text-white/40 text-xs">
                        {agent.name} is working on it...
                      </p>
                    </div>
                  )}
                  {/* Show any existing messages (e.g. welcome message from history) */}
                  {messages.filter((m) => m.role !== 'tool').map((msg, i) => (
                    <div
                      key={i}
                      className="max-w-prose mr-auto px-3 py-2 rounded-lg text-sm bg-white/10 text-white/80 break-words"
                    >
                      <Markdown content={msg.role === 'agent' ? msg.content : ''} />
                    </div>
                  ))}
                  {/* Spacer pushes prompts to bottom */}
                  <div className="flex-1" />
                  {/* Suggested prompts pinned to bottom */}
                  {!isBusy && agent.suggestedPrompts.length > 0 && (
                    <div className="space-y-2 pb-1">
                      {agent.suggestedPrompts.map((template) => {
                        const prompt = template
                          .replace(/\{name\}/g, authUser?.displayName ?? 'me')
                          .replace(/\{email\}/g, authUser?.email ?? 'me');
                        return (
                          <button
                            key={template}
                            onClick={() => {
                              if (activeAgent) sendMessage(activeAgent, prompt);
                            }}
                            className="block w-full text-left px-3 py-2 rounded-lg cursor-pointer
                              bg-white/5 hover:bg-white/10 border border-white/10
                              text-white/70 text-xs transition-colors"
                          >
                            {prompt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null;
            })()}
            {messages.some((m) => m.role === 'user') && messages.map((msg, i) =>
              msg.role === 'tool' ? (
                <ToolChip key={i} toolName={msg.toolName} status={msg.status} />
              ) : msg.role === 'products' ? (
                <div key={i} className="text-white/40 text-xs text-center py-1">
                  Products shown in canvas
                </div>
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
            {agent.status === 'thinking' && !currentStream && !isViewingArchive && (
              <div className="max-w-prose mr-auto px-3 py-2 rounded-lg text-sm bg-white/10 text-white/40">
                <ThinkingIndicator />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/10">
            {isViewingArchive ? (
              <p className="text-white/30 text-xs text-center py-2">
                Switch to the current task to send messages
              </p>
            ) : (
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
            )}
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
