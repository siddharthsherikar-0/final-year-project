import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Texture, type Group, type Material } from 'three';
import { useModelLoader } from '@/hooks/useModelLoader';
import { useViewerStore } from '@/stores/useViewerStore';

interface ModelMeshProps {
  modelUrl: string;
}

function disposeObject(obj: Group): void {
  obj.traverse((child) => {
    if (child instanceof Mesh) {
      child.geometry?.dispose();

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((mat: Material | undefined) => {
        if (!mat) return;
        Object.values(mat).forEach((value) => {
          if (value instanceof Texture) {
            value.dispose();
          }
        });
        mat.dispose();
      });
    }
  });
}

export function ModelMesh({ modelUrl }: ModelMeshProps) {
  const { scene } = useModelLoader(modelUrl);
  const groupRef = useRef<Group>(null);
  const isWireframe = useViewerStore((s) => s.isWireframe);
  const autoRotate = useViewerStore((s) => s.autoRotate);

  useEffect(() => {
    scene.traverse((child) => {
      if ('material' in child && child.material) {
        const mat = child.material as { wireframe?: boolean };
        mat.wireframe = isWireframe;
      }
    });
  }, [scene, isWireframe]);

  useEffect(() => {
    return () => {
      disposeObject(scene);
    };
  }, [scene]);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}
