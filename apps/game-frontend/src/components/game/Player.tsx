/** Player character: ecctrl controller + Kenney character with animation state machine. */
'use client';

import { useRef, useEffect } from 'react';
import Ecctrl, { EcctrlAnimation } from 'ecctrl';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useNearestAgent } from '@/hooks/useNearestAgent';
import { PLAYER, CAMERA } from '@/data/gameConfig';
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
  const agents = useWorldStore((s) => s.agents);
  const nearestAgent = useWorldStore((s) => s.nearestAgent);
  const openChat = useChatStore((s) => s.openChat);
  const chatPanelOpen = useChatStore((s) => s.chatPanelOpen);

  useNearestAgent(agents, ecctrlRef);

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
