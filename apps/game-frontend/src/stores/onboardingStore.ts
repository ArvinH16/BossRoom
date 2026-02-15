import { create } from 'zustand';

interface OnboardingState {
  onboardingStep: number;
  onboardingComplete: boolean;
  advanceOnboarding: () => void;
  completeOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  onboardingStep: 0,
  onboardingComplete:
    typeof window !== 'undefined'
      ? localStorage.getItem('bossroom-onboarding') === 'done'
      : false,

  advanceOnboarding: () =>
    set((state) => ({ onboardingStep: state.onboardingStep + 1 })),

  completeOnboarding: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bossroom-onboarding', 'done');
    }
    set({ onboardingComplete: true });
  },
}));
