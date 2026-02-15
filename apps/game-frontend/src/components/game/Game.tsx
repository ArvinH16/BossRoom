/** Canvas root: R3F canvas, physics, keyboard controls, and HTML overlay wiring. */
'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Scene } from './Scene';
import { ChatPanel } from '../ui/ChatPanel';
import { InteractionPrompt } from './InteractionPrompt';
import { CAMERA, WORLD } from '@/data/gameConfig';

const keyboardMap = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'leftward', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'rightward', keys: ['KeyD', 'ArrowRight'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'run', keys: ['ShiftLeft'] },
];

export function Game() {
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
      <ChatPanel />
      <InteractionPrompt />
    </div>
  );
}
