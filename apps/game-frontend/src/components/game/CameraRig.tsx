/**
 * Third-person camera: Roblox-style follow cam.
 * - Stays behind the player at a fixed distance
 * - Right-click drag (or left drag) rotates the view around the player
 * - Scroll to zoom in/out
 * - Smooth lerp on position and look-at target
 */
'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, MathUtils } from 'three';
import { playerPositionRef, punchCameraRef } from './Player';

const DEFAULT_DISTANCE = 10;
const MIN_DISTANCE = 5;
const MAX_DISTANCE = 25;
const MIN_POLAR = 0.3;               // prevent looking straight down
const MAX_POLAR = Math.PI / 2.2;     // prevent going below ground
const FOLLOW_LERP = 0.08;
const LOOK_LERP = 0.12;
const ROTATE_SPEED = 0.005;
const ZOOM_SPEED = 1.5;

/** Cinematic punch camera constants */
const PUNCH_SIDE_DISTANCE = 6;     // how far the camera sits from the midpoint
const PUNCH_HEIGHT_OFFSET = 2.5;   // extra height for the cinematic view
const PUNCH_BLEND_IN = 0.1;        // lerp speed toward cinematic view
const PUNCH_BLEND_OUT = 0.04;      // lerp speed returning to normal (slower)

export function CameraRig() {
  const { camera, gl } = useThree();

  const yaw = useRef(0);              // horizontal angle (0 = behind player looking -Z)
  const polar = useRef(1.1);          // vertical angle from top (higher = more behind)
  const distance = useRef(DEFAULT_DISTANCE);
  const isDragging = useRef(false);
  const smoothTarget = useRef(new Vector3());
  const smoothPos = useRef(new Vector3());
  const initialized = useRef(false);
  const punchBlend = useRef(0);

  // Mouse/pointer handlers on the canvas
  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerDown = () => { isDragging.current = true; };
    const onPointerUp = () => { isDragging.current = false; };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      yaw.current -= e.movementX * ROTATE_SPEED;
      polar.current = MathUtils.clamp(
        polar.current - e.movementY * ROTATE_SPEED,
        MIN_POLAR,
        MAX_POLAR,
      );
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      distance.current = MathUtils.clamp(
        distance.current + (e.deltaY > 0 ? ZOOM_SPEED : -ZOOM_SPEED),
        MIN_DISTANCE,
        MAX_DISTANCE,
      );
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [gl]);

  useFrame(() => {
    const [px, py, pz] = playerPositionRef.current;
    const targetPoint = new Vector3(px, py + 1.5, pz);

    // Spherical offset from player
    const d = distance.current;
    const p = polar.current;
    const y = yaw.current;
    const offsetX = d * Math.sin(p) * Math.sin(y);
    const offsetY = d * Math.cos(p);
    const offsetZ = d * Math.sin(p) * Math.cos(y);
    const desiredPos = new Vector3(
      px + offsetX,
      py + offsetY,
      pz + offsetZ,
    );

    // Snap on first frame, lerp after
    if (!initialized.current) {
      smoothTarget.current.copy(targetPoint);
      smoothPos.current.copy(desiredPos);
      camera.position.copy(desiredPos);
      camera.lookAt(targetPoint);
      initialized.current = true;
      return;
    }

    // --- Cinematic punch camera blend ---
    const blendTarget = punchCameraRef.active ? 1 : 0;
    const blendSpeed = punchCameraRef.active ? PUNCH_BLEND_IN : PUNCH_BLEND_OUT;
    punchBlend.current = MathUtils.lerp(punchBlend.current, blendTarget, blendSpeed);

    if (punchBlend.current > 0.005) {
      const ap = punchCameraRef.agentPos;

      // Midpoint between player and agent
      const midX = (px + ap[0]) / 2;
      const midZ = (pz + ap[2]) / 2;

      // Direction from player to agent
      const dx = ap[0] - px;
      const dz = ap[2] - pz;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;

      // Perpendicular direction (side view camera)
      const perpX = -dz / len;
      const perpZ = dx / len;

      const cinematicPos = new Vector3(
        midX + perpX * PUNCH_SIDE_DISTANCE,
        py + PUNCH_HEIGHT_OFFSET,
        midZ + perpZ * PUNCH_SIDE_DISTANCE,
      );
      const cinematicTarget = new Vector3(midX, py + 1, midZ);

      // Blend positions
      const b = punchBlend.current;
      desiredPos.lerp(cinematicPos, b);
      targetPoint.lerp(cinematicTarget, b);
    }

    smoothTarget.current.lerp(targetPoint, LOOK_LERP);
    smoothPos.current.lerp(desiredPos, FOLLOW_LERP);

    camera.position.copy(smoothPos.current);
    camera.lookAt(smoothTarget.current);
  });

  return null;
}
