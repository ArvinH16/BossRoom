/** Loads a Kenney Mini Character GLB and plays an animation clip. */
'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useGraph } from '@react-three/fiber';
import { SkeletonUtils } from 'three-stdlib';
import { Color } from 'three';
import type { Group } from 'three';

interface CharacterModelProps {
  url: string;
  animation?: string;
  color?: string;
  scale?: number;
}

export function CharacterModel({
  url,
  animation = 'idle',
  color,
  scale = 2.2,
}: CharacterModelProps) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(url);
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { materials } = useGraph(clone);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const action = actions[animation];
    if (!action) return;
    action.reset().fadeIn(0.2).play();
    return () => {
      action.fadeOut(0.2);
    };
  }, [actions, animation]);

  useEffect(() => {
    if (!color) return;
    const mat = materials['colormap'];
    if (mat && 'color' in mat) {
      (mat as unknown as { color: Color }).color.set(color);
    }
  }, [color, materials]);

  return (
    <group ref={group} scale={scale} dispose={null}>
      <primitive object={clone} />
    </group>
  );
}
