/** Player character: ecctrl controller + Kenney character with animation state machine. */
'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import Ecctrl, { EcctrlAnimation } from 'ecctrl';
import { useGameStore } from '@/stores/gameStore';
import { PLAYER, CAMERA, INTERACTION } from '@/data/gameConfig';
import type { Vector3 } from 'three';

const animationSet = {
  idle: 'idle',
  walk: 'walk',
  run: 'sprint',
  jump: 'jump',
  jumpIdle: 'fall',
  jumpLand: 'idle',
  fall: 'fall',
  action1: 'emote-yes',
  action2: 'interact-right',
  action3: 'pick-up',
  action4: 'emote-no',
};

export function Player() {
  const ecctrlRef = useRef<{ group: { translation(): Vector3 } | null }>(null);
  const prevNearest = useRef<string | null>(null);
  const agents = useGameStore((s) => s.agents);
  const setNearestAgent = useGameStore((s) => s.setNearestAgent);
  const nearestAgent = useGameStore((s) => s.nearestAgent);
  const openChat = useGameStore((s) => s.openChat);
  const chatPanelOpen = useGameStore((s) => s.chatPanelOpen);

  useFrame(() => {
    const body = ecctrlRef.current?.group;
    if (!body) return;

    const pos = body.translation();
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

    if (closest !== prevNearest.current) {
      prevNearest.current = closest;
      setNearestAgent(closest);
    }
  });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'KeyE' && nearestAgent && !chatPanelOpen) {
        openChat(nearestAgent);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nearestAgent, chatPanelOpen, openChat]);

  return (
    <Ecctrl
      ref={ecctrlRef as never}
      camInitDis={CAMERA.initDis}
      camMinDis={CAMERA.minDis}
      camMaxDis={CAMERA.maxDis}
      maxVelLimit={PLAYER.maxSpeed}
      capsuleHalfHeight={PLAYER.capsuleHalfHeight}
      capsuleRadius={PLAYER.capsuleRadius}
      animated
    >
      <EcctrlAnimation
        characterURL={PLAYER.modelUrl}
        animationSet={animationSet}
      >
        <group scale={2.2} />
      </EcctrlAnimation>
    </Ecctrl>
  );
}
