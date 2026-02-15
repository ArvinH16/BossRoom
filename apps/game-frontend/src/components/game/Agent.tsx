/** NPC agent: voxel character + floating name label + status orb + sparkles + click-to-chat. */
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text, Sparkles } from '@react-three/drei';
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
  const isActive = agent.status !== 'idle';

  useFrame(() => {
    if (groupRef.current) {
      // Faster sway when working, normal when idle
      const speed =
        agent.status === 'working'
          ? ANIMATION.swaySpeed * 3
          : agent.status === 'thinking'
            ? ANIMATION.swaySpeed * 1.5
            : ANIMATION.swaySpeed;
      groupRef.current.rotation.y = Math.sin(Date.now() * speed) * ANIMATION.swayAmplitude;
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
        <VoxelCharacter color={agent.color} idle={agent.status === 'idle'} />
      </group>

      {/* Floating name label */}
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

      {/* Status label when active */}
      {isActive && (
        <Billboard position={[0, 2.6, 0]}>
          <Text
            fontSize={0.15}
            color={statusColors[agent.status]}
            anchorX="center"
            anchorY="middle"
          >
            {agent.status === 'thinking'
              ? 'Thinking...'
              : agent.status === 'working'
                ? 'Working...'
                : agent.status === 'listening'
                  ? 'Listening'
                  : agent.status === 'error'
                    ? 'Error!'
                    : ''}
          </Text>
        </Billboard>
      )}

      {/* Status orb */}
      <mesh position={[0, 2.35, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial
          color={statusColors[agent.status]}
          emissive={statusColors[agent.status]}
          emissiveIntensity={isActive ? 2.5 : 1.5}
        />
      </mesh>

      {/* Sparkle effects for thinking/working */}
      {(agent.status === 'thinking' || agent.status === 'working') && (
        <Sparkles
          count={agent.status === 'working' ? 30 : 12}
          scale={2}
          size={agent.status === 'working' ? 4 : 2}
          speed={agent.status === 'working' ? 2 : 0.5}
          color={agent.color}
          position={[0, 1, 0]}
        />
      )}

      {/* Error effect */}
      {agent.status === 'error' && (
        <Sparkles
          count={20}
          scale={1.5}
          size={3}
          speed={3}
          color="#ff4444"
          position={[0, 1, 0]}
        />
      )}
    </group>
  );
}
