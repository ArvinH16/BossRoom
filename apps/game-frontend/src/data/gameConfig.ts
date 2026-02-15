/** Game-wide constants for the 3D office world. */

export const FURNITURE_SCALE = 2.2;

export const PLAYER = {
  modelUrl: '/models/characters/player.glb',
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

export const SPATIAL_AUDIO = {
  /** Distance at which volume starts to decrease. */
  refDistance: 2,
  /** Distance at which volume reaches zero + chat auto-closes. */
  maxDistance: 6,
  /** Rolloff factor for linear distance model (1 = full linear fade). */
  rolloffFactor: 1,
} as const;

export const WORLD = {
  floorSize: 50,
  wallHeight: 3,
  background: '#87ceeb',
} as const;

export const LIGHTING = {
  ambient: { intensity: 0.6, color: '#ffffff' },
  directional: { intensity: 1.2, position: [10, 15, 10] as const },
  point: { intensity: 0.3, color: '#8b5cf6', position: [0, 5, 0] as const },
  fog: { color: '#c8dff5', near: 25, far: 80 },
} as const;

export const AGENT_WANDER = {
  radius: 1.8,
  walkSpeed: 1.2,
  arrivalThreshold: 0.15,
  idleTimeMin: 3,
  idleTimeMax: 8,
  /** Workstation exclusion zone (relative to agent home position). */
  exclusion: {
    xHalf: 0.9,
    zMin: -3.4,
    zMax: -0.3,
  },
  exclusionRetries: 10,
  /** When the player is within this distance, agent returns home. */
  playerSenseRadius: 4,
} as const;

export const POST_PROCESSING = {
  bloom: { threshold: 0.8, smoothing: 0.9, intensity: 0.4 },
  vignette: { offset: 0.3, darkness: 0.4 },
} as const;
