/**
 * Player character: WASD movement + CharacterModel + third-person camera.
 */
'use client';

import { Suspense, useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody } from '@react-three/rapier';
import type { Group } from 'three';
import { CharacterModel } from './CharacterModel';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAgentBehaviorStore } from '@/stores/agentBehaviorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useBroadcastPosition } from '@/hooks/useBroadcastPosition';
import { INTERACTION } from '@/data/gameConfig';
import { getAvatarModelUrl } from '@/data/avatars';

const MOVE_SPEED = 5;
const SPAWN: [number, number, number] = [0, 2, 6];
const ROTATION_LERP = 0.15;

/** Shared ref so CameraRig can track the player position. */
export const playerPositionRef = { current: SPAWN as [number, number, number] };

export function Player() {
  const rigidBodyRef = useRef<any>(null);
  const modelGroupRef = useRef<Group>(null);
  const facingAngle = useRef(Math.PI); // default facing camera (away from camera)
  const keys = useRef<Record<string, boolean>>({});
  const [animation, setAnimation] = useState('idle');

  const agents = useWorldStore((s) => s.agents);
  const setNearestAgent = useWorldStore((s) => s.setNearestAgent);
  const nearestAgent = useWorldStore((s) => s.nearestAgent);
  const openChat = useChatStore((s) => s.openChat);
  const chatPanelOpen = useChatStore((s) => s.chatPanelOpen);
  const setPlayerPosition = useAgentBehaviorStore((s) => s.setPlayerPosition);
  const avatarId = useSettingsStore((s) => s.avatarId);

  useBroadcastPosition(rigidBodyRef, animation, facingAngle);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'KeyE' && nearestAgent && !chatPanelOpen) {
        openChat(nearestAgent);
      }
      if (e.code === 'KeyR' && !chatPanelOpen) {
        // Open receptionist with a fresh task
        useChatStore.getState().newTask();
        useWorkspaceStore.getState().reset();
        openChat('receptionist');
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

    let moveX = right - left;
    let moveZ = backward - forward;
    const isMoving = moveX !== 0 || moveZ !== 0;

    if (isMoving) {
      // Normalize diagonal movement so strafing isn't faster
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= len;
      moveZ /= len;

      rb.setLinvel({ x: moveX * MOVE_SPEED, y: 0, z: moveZ * MOVE_SPEED }, true);
      setAnimation('walk');

      // Face movement direction
      const targetAngle = Math.atan2(moveX, moveZ);
      // Smooth rotation with angle wrapping
      let delta = targetAngle - facingAngle.current;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      facingAngle.current += delta * ROTATION_LERP;
    } else {
      rb.setLinvel({ x: 0, y: rb.linvel().y, z: 0 }, true);
      setAnimation('idle');
    }

    // Apply visual rotation to model group
    if (modelGroupRef.current) {
      modelGroupRef.current.rotation.y = facingAngle.current;
    }

    // Expose position for CameraRig
    playerPositionRef.current = [pos.x, pos.y, pos.z];

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
      <group ref={modelGroupRef} position={[0, -0.8, 0]} rotation={[0, Math.PI, 0]}>
        <Suspense fallback={null}>
          <CharacterModel url={getAvatarModelUrl(avatarId)} animation={animation} />
        </Suspense>
      </group>
    </RigidBody>
  );
}
