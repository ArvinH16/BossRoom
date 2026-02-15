'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { gameSocket } from '@/lib/websocket';
import type { RapierRigidBody } from '@react-three/rapier';

const SEND_INTERVAL_MS = 100; // 10Hz

export function useBroadcastPosition(
  rigidBodyRef: React.RefObject<RapierRigidBody | null>,
  animation: string,
) {
  const lastSendTime = useRef(0);

  useFrame(() => {
    const now = performance.now();
    if (now - lastSendTime.current < SEND_INTERVAL_MS) return;

    const rb = rigidBodyRef.current;
    if (!rb) return;

    const pos = rb.translation();
    const position: [number, number, number] = [pos.x, pos.y, pos.z];

    // Derive rotation from quaternion Y
    const quat = rb.rotation();
    const rotation = Math.atan2(2 * (quat.w * quat.y), 1 - 2 * (quat.y * quat.y));

    gameSocket.send({
      type: 'player:move',
      payload: { position, rotation, animation },
    });

    lastSendTime.current = now;
  });
}
