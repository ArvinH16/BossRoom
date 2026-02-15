/** Canvas root: R3F canvas and HTML overlay wiring. */
'use client';

import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { ChatPanel } from '../ui/ChatPanel';
import { EmbedPanel } from '../ui/EmbedPanel';
import { InteractionPrompt } from './InteractionPrompt';
import { PushToTalkOverlay } from '../ui/PushToTalkOverlay';
import { TTSAudioPlayer } from '../ui/TTSAudioPlayer';
import { HUD } from '../ui/HUD';
import { OnboardingOverlay } from '../ui/OnboardingOverlay';
import { PunchHint } from './PunchHint';
import { MissionControl } from '../ui/MissionControl';
import { ScratchpadFeed } from '../ui/ScratchpadFeed';
import { BackgroundMusic } from '../ui/BackgroundMusic';
import { useAuthStore } from '@/stores/authStore';
import { useMusicStore } from '@/stores/musicStore';
import { initWebSocket } from '@/lib/messageHandler';
import { CAMERA, WORLD } from '@/data/gameConfig';

interface GameProps {
  user: { uid: string; displayName: string | null; email: string };
}

function MusicToggle() {
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const togglePlay = useMusicStore((s) => s.togglePlay);

  return (
    <div className="fixed bottom-4 left-4 z-40 pointer-events-auto">
      <button
        onClick={togglePlay}
        className={`bg-black/50 backdrop-blur-sm rounded-full p-2 hover:bg-black/70 transition-all cursor-pointer ${
          isPlaying ? 'opacity-100' : 'opacity-40'
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="white"
          className="w-5 h-5"
        >
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </button>
    </div>
  );
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
      <EmbedPanel />
      <InteractionPrompt />
      <PunchHint />
      <PushToTalkOverlay />
      <TTSAudioPlayer />
      <OnboardingOverlay />
      <MissionControl />
      <ScratchpadFeed />
      <BackgroundMusic />
      <MusicToggle />
    </div>
  );
}
