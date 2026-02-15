/** GTA-style onboarding: bottom text box + step-by-step tutorial with navigation buttons. */
'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';

const STEPS = [
  {
    text: 'Welcome to BossRoom! Use WASD to walk around your virtual office.',
    hint: 'Try moving around',
  },
  {
    text: 'Walk up to an agent to discover what they can do.',
    hint: 'Approach the nearest glowing character',
  },
  {
    text: 'Press E or click on an agent to start a conversation.',
    hint: 'Interact with an agent',
  },
  {
    text: 'Type a task or click a suggestion to delegate real work.',
    hint: 'Send your first message',
  },
  {
    text: 'Explore the office to find more agents! Each one has unique skills.',
    hint: "You're all set!",
  },
];

export function OnboardingOverlay() {
  const step = useGameStore((s) => s.onboardingStep);
  const complete = useGameStore((s) => s.onboardingComplete);
  const advance = useGameStore((s) => s.advanceOnboarding);
  const finish = useGameStore((s) => s.completeOnboarding);
  const setStep = useGameStore((s) => s.setOnboardingStep);
  const nearestAgent = useGameStore((s) => s.nearestAgent);
  const chatPanelOpen = useGameStore((s) => s.chatPanelOpen);
  const chatMessages = useGameStore((s) => s.chatMessages);

  // Auto-advance based on player actions (in addition to manual navigation)
  useEffect(() => {
    if (complete) return;
    // Step 1 -> 2: when player is near an agent
    if (step === 1 && nearestAgent) advance();
  }, [step, complete, nearestAgent, advance]);

  useEffect(() => {
    if (complete) return;
    // Step 2 -> 3: when chat panel opens
    if (step === 2 && chatPanelOpen) advance();
  }, [step, complete, chatPanelOpen, advance]);

  useEffect(() => {
    if (complete) return;
    // Step 3 -> 4: when a message is sent
    const hasMessages = Object.values(chatMessages).some((m) => m.length > 0);
    if (step === 3 && hasMessages) advance();
  }, [step, complete, chatMessages, advance]);

  useEffect(() => {
    if (complete || step !== 4) return;
    // Step 4 -> done: auto-complete after 8 seconds
    const t = setTimeout(() => finish(), 8000);
    return () => clearTimeout(t);
  }, [step, complete, finish]);

  if (complete || step >= STEPS.length) return null;

  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div
        className="bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl
          px-8 py-4 max-w-lg text-center animate-[fadeIn_0.4s_ease-out]"
      >
        <p className="text-white text-sm font-medium">{current.text}</p>
        <p className="text-white/40 text-xs mt-1.5">{current.hint}</p>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i <= step ? 'bg-indigo-400' : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-center gap-3 mt-3 pointer-events-auto">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20
                text-white/60 hover:text-white text-xs transition-colors"
            >
              ← Back
            </button>
          )}
          {isLastStep ? (
            <button
              onClick={finish}
              className="px-4 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500
                text-white text-xs font-medium transition-colors"
            >
              Got it!
            </button>
          ) : (
            <button
              onClick={advance}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20
                text-white/60 hover:text-white text-xs transition-colors"
            >
              Next →
            </button>
          )}
        </div>

        {/* Skip button */}
        <button
          onClick={finish}
          className="pointer-events-auto mt-2 text-[10px] text-white/30 hover:text-white/60 transition-colors"
        >
          Skip tutorial
        </button>
      </div>
    </div>
  );
}
