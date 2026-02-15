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
  
  const clone = useMemo(() => {
    try {
      const cloned = SkeletonUtils.clone(scene);
      // Ensure all geometries have proper attributes
      cloned.traverse((node: any) => {
        if (node.isMesh && node.geometry) {
          const geom = node.geometry;
          
          // Compute bounding volumes
          if (!geom.boundingBox) geom.computeBoundingBox();
          if (!geom.boundingSphere) geom.computeBoundingSphere();
          
          // Validate morph targets
          if (geom.morphAttributes && geom.morphAttributes.position) {
            const baseCount = geom.attributes.position?.count || 0;
            geom.morphAttributes.position = geom.morphAttributes.position.filter(
              (attr: any) => attr.count === baseCount
            );
          }
          
          // Ensure vertex normals exist
          if (!geom.attributes.normal) {
            geom.computeVertexNormals();
          }
        }
      });
      return cloned;
    } catch (error) {
      console.error('Failed to clone character model:', error);
      return scene;
    }
  }, [scene]);
  
  const { materials } = useGraph(clone);
  const { actions } = useAnimations(animations, group);
  
  // Debug: Log available animations once
  useEffect(() => {
    if (animations.length > 0) {
      const animNames = animations.map(a => a.name).join(', ');
      console.log(`[CharacterModel] Available animations for ${url}:`, animNames);
    }
  }, [animations, url]);

  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;
    
    const action = actions[animation];
    if (!action) {
      // Fallback to first available animation if requested one doesn't exist
      const firstAction = Object.values(actions)[0];
      if (firstAction) {
        try {
          firstAction.reset().fadeIn(0.2).play();
        } catch (err) {
          console.warn(`Failed to play fallback animation:`, err);
        }
        return () => {
          try {
            firstAction.fadeOut(0.2);
          } catch (err) {
            // Ignore cleanup errors
          }
        };
      }
      return;
    }
    
    try {
      // Stop all other actions first to prevent conflicts
      Object.values(actions).forEach(a => {
        if (a && a !== action && a.isRunning()) {
          try {
            a.fadeOut(0.1).stop();
          } catch (err) {
            // Ignore stop errors
          }
        }
      });
      
      action.reset().fadeIn(0.2).play();
    } catch (err) {
      console.warn(`Failed to play animation "${animation}":`, err);
    }
    
    return () => {
      try {
        if (action.isRunning()) {
          action.fadeOut(0.1).stop();
        }
      } catch (err) {
        // Ignore cleanup errors
      }
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
