'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial } from 'three';
import type { Group } from 'three';

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
      groupRef.current.position.y = Math.sin(Date.now() * 0.002) * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Head */}
      <mesh position={[0, 1.15, 0]} castShadow material={material}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.5, 0]} castShadow material={material}>
        <boxGeometry args={[0.6, 0.8, 0.4]} />
      </mesh>
      {/* Left arm */}
      <mesh position={[-0.375, 0.5, 0]} castShadow material={material}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
      </mesh>
      {/* Right arm */}
      <mesh position={[0.375, 0.5, 0]} castShadow material={material}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
      </mesh>
      {/* Left leg */}
      <mesh position={[-0.12, -0.2, 0]} castShadow material={material}>
        <boxGeometry args={[0.18, 0.6, 0.18]} />
      </mesh>
      {/* Right leg */}
      <mesh position={[0.12, -0.2, 0]} castShadow material={material}>
        <boxGeometry args={[0.18, 0.6, 0.18]} />
      </mesh>
    </group>
  );
}
