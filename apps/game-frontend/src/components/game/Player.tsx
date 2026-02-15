/**
 * Player character: WASD movement + CharacterModel + third-person camera.
 * Rendered the same way as agents — no physics capsule, just direct position.
 */
'use client';

import { useRef, useEffect } from 'react';
import Ecctrl, { EcctrlAnimation } from 'ecctrl';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useNearestAgent } from '@/hooks/useNearestAgent';
import { PLAYER, CAMERA } from '@/data/gameConfig';
import type { Vector3 } from 'three';

const MOVE_SPEED = PLAYER.maxSpeed;
const SPRINT_MULT = 1.8;
const CAMERA_DISTANCE = 10;
const CAMERA_HEIGHT = 7;
const CAMERA_LERP = 0.08;
const ROTATION_LERP = 0.12;
const SPAWN: [number, number, number] = [0, 0, 6];

export function Player() {
  const ecctrlRef = useRef<{ group: { translation(): Vector3 } | null }>(null);
  const agents = useWorldStore((s) => s.agents);
  const nearestAgent = useWorldStore((s) => s.nearestAgent);
  const openChat = useChatStore((s) => s.openChat);
  const chatPanelOpen = useChatStore((s) => s.chatPanelOpen);

  useNearestAgent(agents, ecctrlRef);

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

  return (
    <Ecctrl
      ref={ecctrlRef}
      animated
      position={SPAWN}
      maxVelLimit={MOVE_SPEED}
      sprintMult={SPRINT_MULT}
      camInitDir={{ x: 0, y: 0, z: 1 }}
      camMaxDis={CAMERA.maxDistance}
      camMinDis={CAMERA.minDistance}
      camInitDis={CAMERA.initialDistance}
      camMoveSpeed={CAMERA.moveSpeed}
      camZoomSpeed={CAMERA.zoomSpeed}
      turnSpeed={2.0}
      turnVelMultiplier={1.0}
      jumpVel={4.5}
      autoBalance={false}
      autoBalanceSpringK={1.5}
      autoBalanceSpringOnY={0.5}
    >
      <EcctrlAnimation
        characterURL={PLAYER.modelUrl}
        animationSet={{
          idle: 'Idle',
          walk: 'Walk',
          run: 'Run',
          jump: 'Jump_Start',
          jumpIdle: 'Jump_Idle',
          jumpLand: 'Jump_Land',
          fall: 'Jump_Idle',
        }}
      />
    </Ecctrl>
  );
}
