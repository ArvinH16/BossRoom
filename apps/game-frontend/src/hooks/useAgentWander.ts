/** Per-agent wander hook: idle/walking state machine near home position. */
'use client';

import { useRef, useCallback, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils } from 'three';
import type { Group } from 'three';
import { AGENT_WANDER } from '@/data/gameConfig';
import { useAgentBehaviorStore } from '@/stores/agentBehaviorStore';

type WanderPhase = 'idle' | 'walking';

interface WanderState {
  phase: WanderPhase;
  timer: number;
  targetX: number;
  targetZ: number;
  targetRotY: number;
  frameCount: number;
}

export function useAgentWander(
  agentId: string,
  home: [number, number, number],
  isBusy: boolean,
) {
  const groupRef = useRef<Group>(null);
  const state = useRef<WanderState>({
    phase: 'idle',
    timer: randomIdleTime(),
    targetX: home[0],
    targetZ: home[2],
    targetRotY: 0,
    frameCount: 0,
  });
  const [animation, setAnimation] = useState<'idle' | 'walk'>('idle');
  const animRef = useRef<'idle' | 'walk'>('idle');
  const setPosition = useAgentBehaviorStore((s) => s.setPosition);

  const updateAnimation = useCallback(
    (next: 'idle' | 'walk') => {
      if (animRef.current !== next) {
        animRef.current = next;
        setAnimation(next);
      }
    },
    [],
  );

  const pickNewTarget = useCallback(() => {
    const { exclusion, exclusionRetries } = AGENT_WANDER;
    for (let i = 0; i < exclusionRetries; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * AGENT_WANDER.radius;
      const cx = home[0] + Math.cos(angle) * dist;
      const cz = home[2] + Math.sin(angle) * dist;

      const relX = cx - home[0];
      const relZ = cz - home[2];
      if (
        Math.abs(relX) < exclusion.xHalf &&
        relZ > exclusion.zMin &&
        relZ < exclusion.zMax
      ) {
        continue; // inside workstation — reject
      }

      state.current.targetX = cx;
      state.current.targetZ = cz;
      return;
    }
    // All retries landed in the exclusion zone — stay at home
    state.current.targetX = home[0];
    state.current.targetZ = home[2];
  }, [home]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const s = state.current;

    // If agent is in conversation, return to home
    if (isBusy) {
      const hx = home[0];
      const hz = home[2];
      const dx = hx - group.position.x;
      const dz = hz - group.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > AGENT_WANDER.arrivalThreshold) {
        const step = Math.min(AGENT_WANDER.walkSpeed * delta, dist);
        group.position.x += (dx / dist) * step;
        group.position.z += (dz / dist) * step;

        const targetRot = Math.atan2(dx, dz);
        group.rotation.y = MathUtils.lerp(group.rotation.y, targetRot, 0.1);
        updateAnimation('walk');
      } else {
        group.position.x = hx;
        group.position.z = hz;
        updateAnimation('idle');
      }

      s.phase = 'idle';
      s.timer = randomIdleTime();
      syncPosition(s, group, setPosition, agentId, home);
      return;
    }

    if (s.phase === 'idle') {
      s.timer -= delta;
      updateAnimation('idle');

      if (s.timer <= 0) {
        pickNewTarget();
        const dx = s.targetX - group.position.x;
        const dz = s.targetZ - group.position.z;
        s.targetRotY = Math.atan2(dx, dz);
        s.phase = 'walking';
      }
    } else {
      // walking
      const dx = s.targetX - group.position.x;
      const dz = s.targetZ - group.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < AGENT_WANDER.arrivalThreshold) {
        group.position.x = s.targetX;
        group.position.z = s.targetZ;
        s.phase = 'idle';
        s.timer = randomIdleTime();
        updateAnimation('idle');
      } else {
        const step = Math.min(AGENT_WANDER.walkSpeed * delta, dist);
        group.position.x += (dx / dist) * step;
        group.position.z += (dz / dist) * step;
        group.rotation.y = MathUtils.lerp(group.rotation.y, s.targetRotY, 0.1);
        updateAnimation('walk');
      }
    }

    syncPosition(s, group, setPosition, agentId, home);
  });

  return { animation, groupRef };
}

function randomIdleTime(): number {
  return MathUtils.lerp(
    AGENT_WANDER.idleTimeMin,
    AGENT_WANDER.idleTimeMax,
    Math.random(),
  );
}

function syncPosition(
  s: WanderState,
  group: Group,
  setPosition: (id: string, pos: [number, number, number]) => void,
  agentId: string,
  home: [number, number, number],
) {
  s.frameCount++;
  if (s.frameCount % 6 === 0) {
    setPosition(agentId, [
      group.position.x,
      home[1],
      group.position.z,
    ]);
  }
}
