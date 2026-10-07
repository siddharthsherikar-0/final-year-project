import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Box3, Group, Vector3 } from 'three';

export function useSceneSetup() {
  const { scene } = useThree();

  useEffect(() => {
    return () => {
      scene.traverse((obj) => {
        if (obj instanceof Group) {
          obj.clear();
        }
      });
    };
  }, [scene]);
}

export function centerModel(group: Group): void {
  const box = new Box3();
  box.setFromObject(group);
  const center = new Vector3();
  box.getCenter(center);
  group.position.sub(center);
}
