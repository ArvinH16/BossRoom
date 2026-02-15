/** Canvas root: R3F canvas, physics, keyboard controls, and HTML overlay wiring. */
'use client';

import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Scene } from './Scene';
import { ChatPanel } from '../ui/ChatPanel';
import { InteractionPrompt } from './InteractionPrompt';
import { HUD } from '../ui/HUD';
import { ToolExecutionToasts } from '../ui/ToolExecutionToasts';
import { OnboardingOverlay } from '../ui/OnboardingOverlay';
import { useAuthStore } from '@/stores/authStore';
import { initWebSocket } from '@/lib/messageHandler';
import { CAMERA, WORLD } from '@/data/gameConfig';

const keyboardMap = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'leftward', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'rightward', keys: ['KeyD', 'ArrowRight'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'run', keys: ['ShiftLeft'] },
];

interface GameProps {
  user: { uid: string; displayName: string | null; email: string };
}

export function Game({ user }: GameProps) {
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const token = await useAuthStore.getState().getToken();
      if (!cancelled) {
        initWebSocket(
          user.displayName ?? user.email,
          token,
          useAuthStore.getState().getToken
        );
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="w-screen h-screen relative">
      <KeyboardControls map={keyboardMap}>
        <Canvas
          shadows
          camera={{ fov: CAMERA.fov }}
          style={{ background: WORLD.background }}
        >
          <Suspense fallback={null}>
            <Physics gravity={[0, -9.81, 0]}>
              <Scene />
            </Physics>
          </Suspense>
        </Canvas>
      </KeyboardControls>
      <HUD />
      <ChatPanel />
      <ToolExecutionToasts />
      <InteractionPrompt />
      <OnboardingOverlay />
    </div>
  );
}
