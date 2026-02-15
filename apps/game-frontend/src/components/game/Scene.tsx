'use client';

import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Office } from './Office';
import { Agent } from './Agent';
import { Player } from './Player';
import { useGameStore } from '@/stores/gameStore';

export function Scene() {
  const agents = useGameStore((s) => s.agents);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} color="#6366f1" />
      <directionalLight
        position={[10, 15, 10]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <pointLight position={[0, 5, 0]} intensity={0.4} color="#8b5cf6" />

      {/* Fog */}
      <fog attach="fog" args={['#0a0a1a', 10, 50]} />

      {/* Environment */}
      <Office />

      {/* Agents */}
      {agents.map((agent) => (
        <Agent key={agent.id} agent={agent} />
      ))}

      {/* Player */}
      <Player />

      {/* Post-processing */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.6}
          luminanceSmoothing={0.9}
          intensity={0.8}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.8} />
      </EffectComposer>
    </>
  );
}
