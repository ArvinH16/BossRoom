/** Scene composition: lighting, fog, office environment, agents, player, post-processing. */
'use client';

import { Suspense } from 'react';
import { Physics } from '@react-three/rapier';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Office } from './Office';
import { Agent } from './Agent';
import { Player } from './Player';
import { RemotePlayer } from './RemotePlayer';
import { useWorldStore } from '@/stores/worldStore';
import { LIGHTING, POST_PROCESSING } from '@/data/gameConfig';

export function Scene() {
  const agents = useWorldStore((s) => s.agents);
  const remotePlayers = useWorldStore((s) => s.remotePlayers);

  return (
    <>
      <ambientLight
        intensity={LIGHTING.ambient.intensity}
        color={LIGHTING.ambient.color}
      />
      <directionalLight
        position={LIGHTING.directional.position}
        intensity={LIGHTING.directional.intensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <pointLight
        position={LIGHTING.point.position}
        intensity={LIGHTING.point.intensity}
        color={LIGHTING.point.color}
      />

      <fog
        attach="fog"
        args={[LIGHTING.fog.color, LIGHTING.fog.near, LIGHTING.fog.far]}
      />

      <Physics gravity={[0, -30, 0]}>
        <Suspense fallback={null}>
          <Office />

          {agents.map((agent) => (
            <Agent key={agent.id} agent={agent} />
          ))}

          {Object.values(remotePlayers).map((player) => (
            <RemotePlayer key={player.id} player={player} />
          ))}

          <Player />
        </Suspense>
      </Physics>

      <EffectComposer>
        <Bloom
          luminanceThreshold={POST_PROCESSING.bloom.threshold}
          luminanceSmoothing={POST_PROCESSING.bloom.smoothing}
          intensity={POST_PROCESSING.bloom.intensity}
        />
        <Vignette
          eskil={false}
          offset={POST_PROCESSING.vignette.offset}
          darkness={POST_PROCESSING.vignette.darkness}
        />
      </EffectComposer>
    </>
  );
}
