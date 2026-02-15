/** Canvas root: R3F canvas and HTML overlay wiring. */
'use client';

import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { ChatPanel } from '../ui/ChatPanel';
import { InteractionPrompt } from './InteractionPrompt';
import { HUD } from '../ui/HUD';
import { OnboardingOverlay } from '../ui/OnboardingOverlay';
import { MissionControl } from '../ui/MissionControl';
import { useAuthStore } from '@/stores/authStore';
import { initWebSocket } from '@/lib/messageHandler';
import { CAMERA, WORLD } from '@/data/gameConfig';

interface GameProps {
  user: { uid: string; displayName: string | null; email: string };
}

export function Game({ user }: GameProps) {
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const token = await useAuthStore.getState().getToken();
        if (!cancelled) {
          initWebSocket(
            user.displayName ?? user.email,
            token,
            useAuthStore.getState().getToken,
            user.uid,
          );
        }
      } catch {
        // Auth token fetch can fail if not yet signed in — game still renders
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="w-screen h-screen relative">
      <Canvas
        shadows
        camera={{ fov: CAMERA.fov }}
        style={{ background: WORLD.background }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <HUD />
      <ChatPanel />
      <InteractionPrompt />
      <OnboardingOverlay />
      <MissionControl />
    </div>
  );
}
