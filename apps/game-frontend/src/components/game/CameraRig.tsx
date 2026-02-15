/** Third-person camera: OrbitControls that tracks the player position. */
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { playerPositionRef } from './Player';

const CAMERA_OFFSET = new Vector3(0, 5, 10);
const TARGET_LERP = 0.1;

export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const targetPos = useRef(new Vector3(...playerPositionRef.current));

  useFrame(() => {
    if (!controlsRef.current) return;

    const [px, py, pz] = playerPositionRef.current;
    targetPos.current.lerp(new Vector3(px, py + 1, pz), TARGET_LERP);

    controlsRef.current.target.copy(targetPos.current);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={true}
      minDistance={5}
      maxDistance={20}
      maxPolarAngle={Math.PI / 2.2}
      minPolarAngle={0.3}
      position0={CAMERA_OFFSET}
    />
  );
}
