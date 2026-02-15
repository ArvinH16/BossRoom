/**
 * Player character: WASD movement + CharacterModel + third-person camera.
 */
'use client';

import { Suspense, useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CapsuleCollider, RigidBody } from '@react-three/rapier';
import { CharacterModel } from './CharacterModel';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useAgentBehaviorStore } from '@/stores/agentBehaviorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useBroadcastPosition } from '@/hooks/useBroadcastPosition';
import { INTERACTION } from '@/data/gameConfig';
import { getAvatarModelUrl } from '@/data/avatars';

const MOVE_SPEED = 5;
const SPAWN: [number, number, number] = [0, 2, 6];

export function Player() {
  const rigidBodyRef = useRef<any>(null);
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const [animation, setAnimation] = useState('idle');

  const agents = useWorldStore((s) => s.agents);
  const setNearestAgent = useWorldStore((s) => s.setNearestAgent);
  const nearestAgent = useWorldStore((s) => s.nearestAgent);
  const openChat = useChatStore((s) => s.openChat);
  const chatPanelOpen = useChatStore((s) => s.chatPanelOpen);
  const setPlayerPosition = useAgentBehaviorStore((s) => s.setPlayerPosition);
  const avatarId = useSettingsStore((s) => s.avatarId);

  useBroadcastPosition(rigidBodyRef, animation);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'KeyE' && nearestAgent && !chatPanelOpen) {
        openChat(nearestAgent);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [nearestAgent, chatPanelOpen, openChat]);

  useFrame(() => {
    if (!rigidBodyRef.current) return;

    const rb = rigidBodyRef.current;
    const pos = rb.translation();
    
    // Movement
    const forward = (keys.current['KeyW'] || keys.current['ArrowUp']) ? 1 : 0;
    const backward = (keys.current['KeyS'] || keys.current['ArrowDown']) ? 1 : 0;
    const left = (keys.current['KeyA'] || keys.current['ArrowLeft']) ? 1 : 0;
    const right = (keys.current['KeyD'] || keys.current['ArrowRight']) ? 1 : 0;

    const moveX = right - left;
    const moveZ = backward - forward;
    const isMoving = moveX !== 0 || moveZ !== 0;

    if (isMoving) {
      const impulse = { x: moveX * MOVE_SPEED, y: 0, z: moveZ * MOVE_SPEED };
      rb.setLinvel(impulse, true);
      setAnimation('walk');
    } else {
      rb.setLinvel({ x: 0, y: rb.linvel().y, z: 0 }, true);
      setAnimation('idle');
    }

    // Camera follow
    camera.position.set(pos.x, pos.y + 5, pos.z + 10);
    camera.lookAt(pos.x, pos.y + 1, pos.z);

    // Broadcast player position so agents can sense proximity
    setPlayerPosition([pos.x, pos.y, pos.z]);

    // Find nearest agent
    let closest: string | null = null;
    let closestDist = Infinity;
    for (const agent of agents) {
      const dx = pos.x - agent.position[0];
      const dz = pos.z - agent.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < INTERACTION.proximityRadius && dist < closestDist) {
        closest = agent.id;
        closestDist = dist;
      }
    }
    setNearestAgent(closest);
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={SPAWN}
      enabledRotations={[false, false, false]}
      lockRotations
      colliders={false}
      ccd
    >
      <CapsuleCollider args={[0.5, 0.3]} />
      <group position={[0, -0.8, 0]} rotation={[0, Math.PI, 0]}>
        <Suspense fallback={null}>
          <CharacterModel url={getAvatarModelUrl(avatarId)} animation={animation} />
        </Suspense>
      </group>
    </RigidBody>
  );
}
