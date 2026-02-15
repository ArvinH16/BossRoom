/** Procedural office environment: floor, grid, zone plates, furniture workstations, walls, decorations. */
'use client';

import { Grid, useGLTF, Text } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { agents, zoneColors } from '@/data/agents';
import { WORLD, FURNITURE_SCALE } from '@/data/gameConfig';
import { Workstation } from './Workstation';

const halfFloor = WORLD.floorSize / 2;

const walls: {
  pos: [number, number, number];
  size: [number, number, number];
}[] = [
  {
    pos: [0, WORLD.wallHeight / 2, -halfFloor],
    size: [WORLD.floorSize, WORLD.wallHeight, 0.3],
  },
  {
    pos: [0, WORLD.wallHeight / 2, halfFloor],
    size: [WORLD.floorSize, WORLD.wallHeight, 0.3],
  },
  {
    pos: [-halfFloor, WORLD.wallHeight / 2, 0],
    size: [0.3, WORLD.wallHeight, WORLD.floorSize],
  },
  {
    pos: [halfFloor, WORLD.wallHeight / 2, 0],
    size: [0.3, WORLD.wallHeight, WORLD.floorSize],
  },
];

const zoneDisplayNames: Record<string, string> = {
  communications: 'COMMS',
  'project-ops': 'PROJECT OPS',
  calendar: 'CALENDAR',
};

/** Neon floor strip that glows with bloom post-processing. */
function NeonStrip({
  position,
  length,
  color,
  vertical = false,
}: {
  position: [number, number, number];
  length: number;
  color: string;
  vertical?: boolean;
}) {
  return (
    <mesh
      position={position}
      rotation={vertical ? [0, Math.PI / 2, 0] : [0, 0, 0]}
    >
      <boxGeometry args={[length, 0.04, 0.06]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2}
      />
    </mesh>
  );
}

/** Whiteboard with dark frame and white surface. */
function Whiteboard({
  position,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 1.6, 0]}>
        <boxGeometry args={[2.2, 1.4, 0.06]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0, 1.6, 0.04]}>
        <boxGeometry args={[2, 1.2, 0.02]} />
        <meshStandardMaterial color="#f0f0f0" />
      </mesh>
    </group>
  );
}

function Decor() {
  const bookcase = useGLTF('/models/furniture/bookcaseOpen.glb');
  const plant = useGLTF('/models/furniture/pottedPlant.glb');
  const lamp = useGLTF('/models/furniture/lampSquareFloor.glb');
  const sofa = useGLTF('/models/furniture/loungeSofa.glb');
  const coffeeTable = useGLTF('/models/furniture/tableCoffee.glb');
  const trashcan = useGLTF('/models/furniture/trashcan.glb');
  const laptop = useGLTF('/models/furniture/laptop.glb');
  const deskCorner = useGLTF('/models/furniture/deskCorner.glb');

  return (
    <group>
      {/* ── Existing furniture ── */}

      {/* Bookcase near Taskmaster zone */}
      <primitive
        object={bookcase.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[8.5, 0, -8]}
        rotation={[0, -Math.PI / 2, 0]}
        castShadow
      />
      {/* Plants near center */}
      <primitive
        object={plant.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[-3, 0, -3]}
        castShadow
      />
      <primitive
        object={plant.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[3, 0, -3]}
        castShadow
      />
      {/* Floor lamp near Comms */}
      <primitive
        object={lamp.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[-8, 0, -8]}
        castShadow
      />
      {/* Lounge area near spawn */}
      <primitive
        object={sofa.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[0, 0, 2]}
        rotation={[0, Math.PI, 0]}
        castShadow
      />
      <primitive
        object={coffeeTable.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[0, 0, 1]}
        castShadow
      />

      {/* ── New furniture ── */}

      {/* Trashcans near each workstation */}
      <primitive
        object={trashcan.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[-4.5, 0, -7.2]}
        castShadow
      />
      <primitive
        object={trashcan.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[7.5, 0, -7.2]}
        castShadow
      />
      <primitive
        object={trashcan.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[1.5, 0, -11.2]}
        castShadow
      />

      {/* Laptop on coffee table */}
      <primitive
        object={laptop.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[0.3, 0.78, 1]}
        rotation={[0, Math.PI / 6, 0]}
        castShadow
      />

      {/* Corner desk — reception area near spawn */}
      <primitive
        object={deskCorner.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[-5, 0, 4]}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
      />

      {/* Additional plants around the office */}
      <primitive
        object={plant.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[-10, 0, 4]}
        castShadow
      />
      <primitive
        object={plant.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[10, 0, 4]}
        castShadow
      />
      <primitive
        object={plant.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[-10, 0, -13]}
        castShadow
      />
      <primitive
        object={plant.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[10, 0, -13]}
        castShadow
      />
      <primitive
        object={plant.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[0, 0, -14]}
        castShadow
      />

      {/* Additional floor lamps */}
      <primitive
        object={lamp.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[9, 0, 4]}
        castShadow
      />
      <primitive
        object={lamp.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[-4, 0, -13]}
        castShadow
      />
      <primitive
        object={lamp.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[4, 0, -13]}
        castShadow
      />

      {/* Additional bookcases */}
      <primitive
        object={bookcase.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[-8.5, 0, -8]}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
      />
      <primitive
        object={bookcase.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[-4, 0, -14.5]}
        castShadow
      />
      <primitive
        object={bookcase.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[4, 0, -14.5]}
        rotation={[0, Math.PI, 0]}
        castShadow
      />

      {/* Second sofa — L-shaped lounge */}
      <primitive
        object={sofa.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[2.5, 0, 3.5]}
        rotation={[0, -Math.PI / 2, 0]}
        castShadow
      />
    </group>
  );
}

export function Office() {
  return (
    <group>
      {/* Floor with collision */}
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

      {/* Zone rugs — subtle colored rectangles under each zone */}
      {agents.map((agent) => (
        <mesh
          key={`rug-${agent.id}`}
          position={[agent.position[0], 0.012, agent.position[2] - 0.5]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[7, 6]} />
          <meshStandardMaterial
            color={zoneColors[agent.zone] ?? '#ffffff'}
            transparent
            opacity={0.05}
          />
        </mesh>
      ))}

      {/* Zone name labels */}
      {agents.map((agent) => (
        <Text
          key={`label-${agent.id}`}
          position={[agent.position[0], 3.5, agent.position[2]]}
          fontSize={0.35}
          color={zoneColors[agent.zone] ?? '#ffffff'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="#000000"
          letterSpacing={0.1}
        >
          {zoneDisplayNames[agent.zone] ?? agent.zone.toUpperCase()}
        </Text>
      ))}

      {/* Workstations near each agent */}
      {agents.map((agent) => (
        <Workstation key={agent.id} position={agent.position} />
      ))}

      {/* Decorative furniture */}
      <Decor />

      {/* Whiteboards */}
      <Whiteboard position={[0, 0, -2.5]} />
      <Whiteboard position={[-10, 0, -6]} rotation={[0, Math.PI / 2, 0]} />

      {/* ── Neon accent strips (glow with bloom) ── */}

      {/* Office area border */}
      <NeonStrip position={[0, 0.03, 6]} length={24} color="#6366f1" />
      <NeonStrip position={[0, 0.03, -16]} length={24} color="#6366f1" />
      <NeonStrip
        position={[-12, 0.03, -5]}
        length={22}
        color="#6366f1"
        vertical
      />
      <NeonStrip
        position={[12, 0.03, -5]}
        length={22}
        color="#6366f1"
        vertical
      />

      {/* Zone divider accent */}
      <NeonStrip position={[0, 0.03, -2]} length={24} color="#3730a3" />

      {/* Perimeter walls */}
      {walls.map((wall, i) => (
        <mesh key={i} position={wall.pos}>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial
            color="#1a1a2e"
            transparent
            opacity={0.3}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

useGLTF.preload('/models/furniture/bookcaseOpen.glb');
useGLTF.preload('/models/furniture/pottedPlant.glb');
useGLTF.preload('/models/furniture/lampSquareFloor.glb');
useGLTF.preload('/models/furniture/loungeSofa.glb');
useGLTF.preload('/models/furniture/tableCoffee.glb');
useGLTF.preload('/models/furniture/trashcan.glb');
useGLTF.preload('/models/furniture/laptop.glb');
useGLTF.preload('/models/furniture/deskCorner.glb');
