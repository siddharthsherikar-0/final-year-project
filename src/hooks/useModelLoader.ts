import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Group } from 'three';

// Serve the Draco decoder locally instead of drei's default Google CDN,
// so compressed models decode without any external network dependency.
useGLTF.setDecoderPath('/draco/');

export function useModelLoader(modelUrl: string) {
  const { scene, animations } = useGLTF(modelUrl, true);

  const clonedScene = useMemo(() => {
    const clone = cloneSkeleton(scene);
    return clone as Group;
  }, [scene]);

  return { scene: clonedScene, animations };
}
