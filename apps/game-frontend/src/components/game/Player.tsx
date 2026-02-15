/**
 * Player character: WASD movement + CharacterModel + third-person camera.
 * Rendered the same way as agents — no physics capsule, just direct position.
 */
'use client';

import { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CharacterModel } from './CharacterModel';
import { useGameStore } from '@/stores/gameStore';
import { PLAYER, INTERACTION } from '@/data/gameConfig';
import * as THREE from 'three';

const MOVE_SPEED = PLAYER.maxSpeed;
const SPRINT_MULT = 1.8;
const CAMERA_DISTANCE = 10;
const CAMERA_HEIGHT = 7;
const CAMERA_LERP = 0.08;
const ROTATION_LERP = 0.12;
const SPAWN: [number, number, number] = [0, 0, 6];

export function Player() {
  const groupRef = useRef<THREE.Group>(null);
  const prevNearest = useRef<string | null>(null);
  const posRef = useRef(new THREE.Vector3(...SPAWN));
  const facingAngle = useRef(Math.PI); // face toward agents (negative Z)
  const keys = useRef<Record<string, boolean>>({});

  const [animation, setAnimation] = useState('idle');

  const agents = useGameStore((s) => s.agents);
  const setNearestAgent = useGameStore((s) => s.setNearestAgent);
  const nearestAgent = useGameStore((s) => s.nearestAgent);
  const openChat = useGameStore((s) => s.openChat);
  const chatPanelOpen = useGameStore((s) => s.chatPanelOpen);

  const { camera } = useThree();

  // Keyboard tracking
  useEffect(() => {
    function down(e: KeyboardEvent) {
      keys.current[e.code] = true;
    }
    function up(e: KeyboardEvent) {
      keys.current[e.code] = false;
    }
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // E key to interact
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'KeyE' && nearestAgent && !chatPanelOpen) {
        openChat(nearestAgent);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nearestAgent, chatPanelOpen, openChat]);

  // Initialize camera behind player facing agents
  useEffect(() => {
    camera.position.set(SPAWN[0], CAMERA_HEIGHT, SPAWN[2] + CAMERA_DISTANCE);
    camera.lookAt(SPAWN[0], 0, SPAWN[2]);
  }, [camera]);

  useFrame((_, delta) => {
    const k = keys.current;
    const forward = (k['KeyW'] || k['ArrowUp']) ? 1 : 0;
    const backward = (k['KeyS'] || k['ArrowDown']) ? 1 : 0;
    const left = (k['KeyA'] || k['ArrowLeft']) ? 1 : 0;
    const right = (k['KeyD'] || k['ArrowRight']) ? 1 : 0;
    const sprint = k['ShiftLeft'] || k['ShiftRight'];

    const dx = right - left;
    const dz = backward - forward; // forward = -Z
    const isMoving = dx !== 0 || dz !== 0;

    if (isMoving) {
      // Normalize diagonal movement
      const len = Math.sqrt(dx * dx + dz * dz);
      const speed = MOVE_SPEED * (sprint ? SPRINT_MULT : 1) * delta;
      posRef.current.x += (dx / len) * speed;
      posRef.current.z += (dz / len) * speed;

      // Calculate facing angle from movement direction
      const targetAngle = Math.atan2(dx, dz);
      // Smoothly interpolate rotation
      let angleDiff = targetAngle - facingAngle.current;
      // Wrap to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      facingAngle.current += angleDiff * ROTATION_LERP;
    }

    // Update animation
    const nextAnim = isMoving ? (sprint ? 'sprint' : 'walk') : 'idle';
    if (nextAnim !== animation) setAnimation(nextAnim);

    // Apply position and rotation to the group
    if (groupRef.current) {
      groupRef.current.position.copy(posRef.current);
      groupRef.current.rotation.y = facingAngle.current;
    }

    // Third-person camera follows player
    const targetCamPos = new THREE.Vector3(
      posRef.current.x,
      posRef.current.y + CAMERA_HEIGHT,
      posRef.current.z + CAMERA_DISTANCE,
    );
    camera.position.lerp(targetCamPos, CAMERA_LERP);
    const lookTarget = new THREE.Vector3(
      posRef.current.x,
      posRef.current.y + 1,
      posRef.current.z,
    );
    camera.lookAt(lookTarget);

    // Proximity detection
    let closest: string | null = null;
    let closestDist = Infinity;
    for (const agent of agents) {
      const adx = posRef.current.x - agent.position[0];
      const adz = posRef.current.z - agent.position[2];
      const dist = Math.sqrt(adx * adx + adz * adz);
      if (dist < INTERACTION.proximityRadius && dist < closestDist) {
        closest = agent.id;
        closestDist = dist;
      }
    }
    if (closest !== prevNearest.current) {
      prevNearest.current = closest;
      setNearestAgent(closest);
    }
  });

  return (
    <group ref={groupRef} position={SPAWN}>
      <CharacterModel
        url={PLAYER.modelUrl}
        animation={animation}
      />
    </group>
  );
}
