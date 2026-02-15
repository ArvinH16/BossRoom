/** Procedural office environment: floor, grid, zone plates, furniture workstations, walls. */
'use client';

import { Grid, useGLTF } from '@react-three/drei';
import { agents, zoneColors } from '@/data/agents';
import { WORLD } from '@/data/gameConfig';
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

import { FURNITURE_SCALE } from '@/data/gameConfig';

function Decor() {
  const bookcase = useGLTF('/models/furniture/bookcaseOpen.glb');
  const plant = useGLTF('/models/furniture/pottedPlant.glb');
  const lamp = useGLTF('/models/furniture/lampSquareFloor.glb');
  const sofa = useGLTF('/models/furniture/loungeSofa.glb');
  const coffeeTable = useGLTF('/models/furniture/tableCoffee.glb');

  return (
    <group>
      {/* Bookcase near Taskmaster zone */}
      <primitive
        object={bookcase.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[8.5, 0, -8]}
        rotation={[0, -Math.PI / 2, 0]}
        castShadow
      />
      {/* Plants scattered */}
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
      {/* Floor lamp */}
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
    </group>
  );
}

export function Office() {
  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[WORLD.floorSize, 0.2, WORLD.floorSize]} />
        <meshStandardMaterial color="#1a1a2e" flatShading />
      </mesh>

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

      {/* Workstations near each agent */}
      {agents.map((agent) => (
        <Workstation key={agent.id} position={agent.position} />
      ))}

      {/* Decorative furniture */}
      <Decor />

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
