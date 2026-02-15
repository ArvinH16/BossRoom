/** Procedural office environment: floor, grid, zone plates, desks, walls. */
'use client';

import { RigidBody } from '@react-three/rapier';
import { Grid } from '@react-three/drei';
import { agents, zoneColors } from '@/data/agents';
import { WORLD } from '@/data/gameConfig';

function Desk({ position }: { position: [number, number, number] }) {
  const [x, , z] = position;
  return (
    <group position={[x, 0, z - 1.5]}>
      {/* Tabletop */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.08, 0.7]} />
        <meshStandardMaterial color="#2a2a3e" flatShading />
      </mesh>
      {/* Legs */}
      {(
        [
          [-0.6, 0.375, -0.25],
          [0.6, 0.375, -0.25],
          [-0.6, 0.375, 0.25],
          [0.6, 0.375, 0.25],
        ] as [number, number, number][]
      ).map((pos, i) => (
        <mesh key={i} position={pos} castShadow>
          <boxGeometry args={[0.06, 0.75, 0.06]} />
          <meshStandardMaterial color="#1a1a2e" flatShading />
        </mesh>
      ))}
      {/* Monitor */}
      <mesh position={[0, 1.1, -0.15]} castShadow>
        <boxGeometry args={[0.6, 0.4, 0.04]} />
        <meshStandardMaterial
          color="#111122"
          emissive="#2233aa"
          emissiveIntensity={0.3}
          flatShading
        />
      </mesh>
      {/* Monitor stand */}
      <mesh position={[0, 0.9, -0.15]}>
        <boxGeometry args={[0.06, 0.2, 0.06]} />
        <meshStandardMaterial color="#1a1a2e" flatShading />
      </mesh>
      {/* Chair */}
      <group position={[0, 0, 0.8]}>
        <mesh position={[0, 0.35, 0]}>
          <boxGeometry args={[0.5, 0.06, 0.5]} />
          <meshStandardMaterial color="#333355" flatShading />
        </mesh>
        <mesh position={[0, 0.6, -0.22]}>
          <boxGeometry args={[0.5, 0.5, 0.06]} />
          <meshStandardMaterial color="#333355" flatShading />
        </mesh>
      </group>
    </group>
  );
}

const halfFloor = WORLD.floorSize / 2;

const walls: { pos: [number, number, number]; size: [number, number, number] }[] = [
  { pos: [0, WORLD.wallHeight / 2, -halfFloor], size: [WORLD.floorSize, WORLD.wallHeight, 0.3] },
  { pos: [0, WORLD.wallHeight / 2, halfFloor], size: [WORLD.floorSize, WORLD.wallHeight, 0.3] },
  { pos: [-halfFloor, WORLD.wallHeight / 2, 0], size: [0.3, WORLD.wallHeight, WORLD.floorSize] },
  { pos: [halfFloor, WORLD.wallHeight / 2, 0], size: [0.3, WORLD.wallHeight, WORLD.floorSize] },
];

export function Office() {
  return (
    <group>
      {/* Floor */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, -0.1, 0]} receiveShadow>
          <boxGeometry args={[WORLD.floorSize, 0.2, WORLD.floorSize]} />
          <meshStandardMaterial color="#1a1a2e" flatShading />
        </mesh>
      </RigidBody>

      {/* Grid overlay */}
      <Grid
        position={[0, 0.01, 0]}
        args={[WORLD.floorSize, WORLD.floorSize]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#2a2a4e"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#3a3a6e"
        fadeDistance={30}
        fadeStrength={1}
        infiniteGrid
      />

      {/* Zone plates under each agent */}
      {agents.map((agent) => (
        <mesh
          key={agent.id}
          position={[agent.position[0], 0.02, agent.position[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[3, 32]} />
          <meshStandardMaterial
            color={zoneColors[agent.zone] ?? '#ffffff'}
            transparent
            opacity={0.08}
            emissive={zoneColors[agent.zone] ?? '#ffffff'}
            emissiveIntensity={0.2}
          />
        </mesh>
      ))}

      {/* Desks near each agent */}
      {agents.map((agent) => (
        <Desk key={agent.id} position={agent.position} />
      ))}

      {/* Perimeter walls */}
      {walls.map((wall, i) => (
        <RigidBody key={i} type="fixed" colliders="cuboid">
          <mesh position={wall.pos}>
            <boxGeometry args={wall.size} />
            <meshStandardMaterial
              color="#1a1a2e"
              transparent
              opacity={0.3}
              flatShading
            />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}
