import { Environment, Grid, Lightformer, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { Suspense, useCallback, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';

import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ModelMesh } from './ModelMesh';
import { useViewerStore } from '@/stores/useViewerStore';
import { ENVIRONMENT_PRESETS } from './viewerUtils';
import { viewerRuntime, resetViewerRuntime } from './viewerRuntime';
import { setEditorControls } from '@/editor/editorRuntime';

/** Disables raycasting on a helper object so it never becomes a scene hit. */
const noRaycast = () => undefined;

function RuntimeBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    viewerRuntime.gl = gl;
    viewerRuntime.scene = scene;
    viewerRuntime.camera = camera as PerspectiveCamera;
    return () => resetViewerRuntime();
  }, [gl, scene, camera]);

  return null;
}

function SceneStatsReporter() {
  const gl = useThree((s) => s.gl);
  const lastReport = useRef(0);

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    if (now - lastReport.current < 0.5) return;
    lastReport.current = now;
    const { calls, triangles } = gl.info.render;
    const previous = useViewerStore.getState().viewStats;
    if (!previous || previous.calls !== calls || previous.triangles !== triangles) {
      useViewerStore.getState().setViewStats({ triangles, calls });
    }
  });

  return null;
}

function CameraController({
  controlsRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const camera = useThree((s) => s.camera);
  const cameraPosition = useViewerStore((s) => s.cameraPosition);
  const controlsTarget = useViewerStore((s) => s.controlsTarget);

  useEffect(() => {
    camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
    if (controlsRef.current) {
      controlsRef.current.target.set(
        controlsTarget[0],
        controlsTarget[1],
        controlsTarget[2],
      );
      controlsRef.current.update();
    }
  }, [camera, cameraPosition, controlsTarget, controlsRef]);

  return null;
}

interface ModelSceneProps {
  modelUrl: string;
  onReady?: () => void;
  onPerfDecline?: () => void;
  onPerfIncline?: () => void;
  /** Stage 9B: enables viewport picking in the editor layout. */
  selectable?: boolean;
}

export function ModelScene({
  modelUrl,
  onReady,
  onPerfDecline,
  onPerfIncline,
  selectable = false,
}: ModelSceneProps) {
  const showGrid = useViewerStore((s) => s.showGrid);
  const showAxes = useViewerStore((s) => s.showAxes);
  const autoRotate = useViewerStore((s) => s.autoRotate);
  const orbitEnabled = useViewerStore((s) => s.orbitEnabled);
  const environment = useViewerStore((s) => s.environment);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const envConfig = ENVIRONMENT_PRESETS[environment];

  const setControls = useCallback((controls: OrbitControlsImpl | null) => {
    controlsRef.current = controls;
    viewerRuntime.controls = controls;
    // Read-only placement reference for newly created objects.
    setEditorControls(selectable ? controls : null);
  }, [selectable]);

  return (
    <>
      <RuntimeBridge />
      <SceneStatsReporter />

      <color attach="background" args={[envConfig.background]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-10, -10, -5]} intensity={0.3} />

      <Environment key={environment} resolution={64} frames={1}>
        {envConfig.lightformers.map((spec, index) => (
          <Lightformer
            key={`${environment}-${index}`}
            form={spec.form}
            position={spec.position}
            scale={spec.scale}
            rotation={spec.rotation ?? [0, 0, 0]}
            color={spec.color}
            intensity={spec.intensity}
          />
        ))}
      </Environment>

      <Suspense fallback={null}>
        <ModelMesh modelUrl={modelUrl} onReady={onReady} selectable={selectable} />
      </Suspense>

      {/* In the editor the ground grid and axes must not be pickable: a click
          on them would otherwise count as a scene hit and block the
          "click empty space to deselect" behaviour. */}
      {showGrid && (
        <Grid
          args={[10, 10]}
          raycast={selectable ? noRaycast : undefined}
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

      {showAxes && (
        <axesHelper
          args={[1.5]}
          position={[0, 0.002, 0]}
          raycast={selectable ? noRaycast : undefined}
        />
      )}

      <OrbitControls
        ref={setControls}
        enabled={orbitEnabled}
        autoRotate={autoRotate}
        autoRotateSpeed={2}
        enableDamping
        dampingFactor={0.05}
        makeDefault
        minDistance={0.05}
        maxDistance={1000}
      />

      <CameraController controlsRef={controlsRef} />

      <PerformanceMonitor
        flipflops={2}
        onDecline={onPerfDecline}
        onIncline={onPerfIncline}
      />
    </>
  );
}



