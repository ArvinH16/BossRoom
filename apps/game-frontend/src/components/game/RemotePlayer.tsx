'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { CharacterModel } from './CharacterModel';
import { PLAYER } from '@/data/gameConfig';
import type { RemotePlayer as RemotePlayerData } from '@/stores/worldStore';

interface RemotePlayerProps {
  player: RemotePlayerData;
}

export function RemotePlayer({ player }: RemotePlayerProps) {
  const groupRef = useRef<Group>(null);
  const targetPos = useRef(new Vector3(...player.position));
  const targetRot = useRef(player.rotation);

  // Update targets — use individual values to avoid array reference issues
  useEffect(() => {
    targetPos.current.set(player.position[0], player.position[1], player.position[2]);
    targetRot.current = player.rotation;
  }, [player.position[0], player.position[1], player.position[2], player.rotation]);

  useFrame(() => {
    if (!groupRef.current) return;
    // Lerp position
    groupRef.current.position.lerp(targetPos.current, 0.15);
    // Interpolate rotation with angle wrapping
    const currentY = groupRef.current.rotation.y;
    let delta = targetRot.current - currentY;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    groupRef.current.rotation.y += delta * 0.15;
  });

  return (
    <group ref={groupRef} position={player.position}>
      <CharacterModel url={PLAYER.modelUrl} animation={player.animation} />
      <Billboard position={[0, 2.2, 0]}>
        <Text
          fontSize={0.25}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {player.username}
        </Text>
      </Billboard>
    </group>
  );
}
