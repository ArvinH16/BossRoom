/** Game-wide constants for the 3D voxel office world. */

export const PLAYER = {
  color: '#FFD700',
  capsuleHalfHeight: 0.5,
  capsuleRadius: 0.3,
  maxSpeed: 3,
} as const;

export const CAMERA = {
  fov: 50,
  initDis: -8,
  minDis: -5,
  maxDis: -12,
} as const;

export const INTERACTION = {
  /** Max distance (XZ plane) to trigger "Press E" prompt. */
  proximityRadius: 3,
} as const;

export const WORLD = {
  floorSize: 50,
  wallHeight: 3,
  background: '#0a0a1a',
} as const;

export const ANIMATION = {
  /** Idle bob frequency (radians per ms). */
  bobSpeed: 0.002,
  /** Idle bob amplitude (units). */
  bobAmplitude: 0.05,
  /** Agent idle sway frequency. */
  swaySpeed: 0.001,
  /** Agent idle sway amplitude (radians). */
  swayAmplitude: 0.1,
} as const;

export const LIGHTING = {
  ambient: { intensity: 0.3, color: '#6366f1' },
  directional: { intensity: 0.8, position: [10, 15, 10] as const },
  point: { intensity: 0.4, color: '#8b5cf6', position: [0, 5, 0] as const },
  fog: { color: '#0a0a1a', near: 10, far: 50 },
} as const;

export const POST_PROCESSING = {
  bloom: { threshold: 0.6, smoothing: 0.9, intensity: 0.8 },
  vignette: { offset: 0.1, darkness: 0.8 },
} as const;
