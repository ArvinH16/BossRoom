/** Procedural box-based voxel character mesh, reusable for player and NPCs. */
'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial } from 'three';
import type { Group } from 'three';
import { ANIMATION } from '@/data/gameConfig';

interface VoxelCharacterProps {
  color: string;
  idle?: boolean;
}

export function VoxelCharacter({ color, idle = true }: VoxelCharacterProps) {
  const groupRef = useRef<Group>(null);
  const material = useMemo(
    () => new MeshStandardMaterial({ color, flatShading: true }),
    [color],
  );

  useFrame(() => {
    if (idle && groupRef.current) {
      groupRef.current.position.y =
        Math.sin(Date.now() * ANIMATION.bobSpeed) * ANIMATION.bobAmplitude;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 1.15, 0]} castShadow material={material}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow material={material}>
        <boxGeometry args={[0.6, 0.8, 0.4]} />
      </mesh>
      <mesh position={[-0.375, 0.5, 0]} castShadow material={material}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
      </mesh>
      <mesh position={[0.375, 0.5, 0]} castShadow material={material}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
      </mesh>
      <mesh position={[-0.12, -0.2, 0]} castShadow material={material}>
        <boxGeometry args={[0.18, 0.6, 0.18]} />
      </mesh>
      <mesh position={[0.12, -0.2, 0]} castShadow material={material}>
        <boxGeometry args={[0.18, 0.6, 0.18]} />
      </mesh>
    </group>
  );
}
