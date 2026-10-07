import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Group } from 'three';

export function useModelLoader(modelUrl: string) {
  const { scene, animations } = useGLTF(modelUrl, true);

  const clonedScene = useMemo(() => {
    const clone = cloneSkeleton(scene);
    return clone as Group;
  }, [scene]);

  return { scene: clonedScene, animations };
}
