import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorldStore } from '@/stores/worldStore';
import { INTERACTION } from '@/data/gameConfig';
import type { AgentData } from '@/data/agents';
import type { Vector3 } from 'three';

export function useNearestAgent(
  agents: AgentData[],
  bodyRef: React.RefObject<{ group: { translation(): Vector3 } | null } | null>,
) {
  const prevNearest = useRef<string | null>(null);

  useFrame(() => {
    const body = bodyRef.current?.group;
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
      useWorldStore.getState().setNearestAgent(closest);
    }
  });
}
