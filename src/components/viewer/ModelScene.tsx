import { Environment, Grid, OrbitControls } from '@react-three/drei';
import { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ModelMesh } from './ModelMesh';
import { useViewerStore } from '@/stores/useViewerStore';

function CameraController({
  controlsRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const camera = useThree((s) => s.camera);
  const cameraPosition = useViewerStore((s) => s.cameraPosition);

  useEffect(() => {
    camera.position.set(...cameraPosition);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera, cameraPosition, controlsRef]);

  return null;
}

interface ModelSceneProps {
  modelUrl: string;
}

export function ModelScene({ modelUrl }: ModelSceneProps) {
  const showGrid = useViewerStore((s) => s.showGrid);
  const autoRotate = useViewerStore((s) => s.autoRotate);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-10, -10, -5]} intensity={0.3} />

      <Environment preset="city" />

      <ModelMesh modelUrl={modelUrl} />

      {showGrid && (
        <Grid
          args={[10, 10]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#6b7280"
          sectionSize={2}
          sectionThickness={1}
          sectionColor="#374151"
          fadeDistance={25}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
        />
      )}

      <OrbitControls
        ref={controlsRef}
        autoRotate={autoRotate}
        autoRotateSpeed={2}
        enableDamping
        dampingFactor={0.05}
        minDistance={1}
        maxDistance={20}
      />

      <CameraController controlsRef={controlsRef} />
    </>
  );
}
