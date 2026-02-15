'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { gameSocket } from '@/lib/websocket';
import type { RapierRigidBody } from '@react-three/rapier';

const SEND_INTERVAL_MS = 50; // 20Hz

export function useBroadcastPosition(
  rigidBodyRef: React.RefObject<RapierRigidBody | null>,
  animation: string,
  facingAngleRef?: React.RefObject<number>,
) {
  const lastSendTime = useRef(0);

  useFrame(() => {
    // Disabled: player:move broadcast removed to reduce noise
    void rigidBodyRef;
    void animation;
    void facingAngleRef;
    void lastSendTime;
  });
}
