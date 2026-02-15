/** NPC agent: voxel character + floating name label + status orb + click-to-chat. */
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import type { Group } from 'three';
import { VoxelCharacter } from './VoxelCharacter';
import { useGameStore } from '@/stores/gameStore';
import { statusColors, type AgentData } from '@/data/agents';
import { ANIMATION } from '@/data/gameConfig';

interface AgentProps {
  agent: AgentData;
}

export function Agent({ agent }: AgentProps) {
  const groupRef = useRef<Group>(null);
  const openChat = useGameStore((s) => s.openChat);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y =
        Math.sin(Date.now() * ANIMATION.swaySpeed) * ANIMATION.swayAmplitude;
    }
  });

  return (
    <group position={agent.position}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh>
          <boxGeometry args={[0.8, 1.8, 0.6]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>

      <group
        ref={groupRef}
        onClick={(e) => {
          e.stopPropagation();
          openChat(agent.id);
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        <VoxelCharacter color={agent.color} />
      </group>

      <Billboard position={[0, 2, 0]}>
        <Text
          fontSize={0.25}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {agent.name}
        </Text>
      </Billboard>

      <mesh position={[0, 2.35, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial
          color={statusColors[agent.status]}
          emissive={statusColors[agent.status]}
          emissiveIntensity={1.5}
        />
      </mesh>
    </group>
  );
}
