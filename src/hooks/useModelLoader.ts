import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import type { Group } from 'three';

export function useModelLoader(modelUrl: string) {
  const { scene } = useGLTF(modelUrl, true);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    return clone as Group;
  }, [scene]);

  return { scene: clonedScene };
}
