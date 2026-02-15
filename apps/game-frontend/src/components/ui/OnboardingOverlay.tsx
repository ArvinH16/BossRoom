/** GTA-style onboarding: bottom text box + step-by-step tutorial teaching core mechanics. */
'use client';

import { useOnboardingStore } from '@/stores/onboardingStore';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useOnboardingSteps } from '@/hooks/useOnboardingSteps';

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
    hint: 'You\'re all set!',
  },
];

export function OnboardingOverlay() {
  const step = useOnboardingStore((s) => s.onboardingStep);
  const complete = useOnboardingStore((s) => s.onboardingComplete);
  const advance = useOnboardingStore((s) => s.advanceOnboarding);
  const finish = useOnboardingStore((s) => s.completeOnboarding);
  const nearestAgent = useWorldStore((s) => s.nearestAgent);
  const chatPanelOpen = useChatStore((s) => s.chatPanelOpen);
  const chatMessages = useChatStore((s) => s.chatMessages);

  useOnboardingSteps({
    step: complete ? -1 : step,
    nearestAgent,
    chatPanelOpen,
    chatMessages,
    advance,
    complete: finish,
  });

  if (complete || step >= STEPS.length) return null;

  const current = STEPS[step];

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
