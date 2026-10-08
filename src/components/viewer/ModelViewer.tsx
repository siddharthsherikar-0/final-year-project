import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Box3, type WebGLRenderer } from 'three';
import { ModelScene } from './ModelScene';
import { ViewerOverlay } from './ViewerOverlay';
import { ViewerDock } from './ViewerDock';
import { ViewerPanel } from './ViewerPanel';
import { ViewerShortcuts } from './ViewerShortcuts';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useViewerStore, type CameraPose } from '@/stores/useViewerStore';
import { viewerRuntime } from './viewerRuntime';
import {
  captureScreenshot,
  downloadDataUrl,
  framePose,
  modelSlug,
  nextZoomPose,
  shortcutAction,
  zoomLevel,
} from './viewerUtils';

const MIN_DISTANCE = 0.05;
const MAX_DISTANCE = 1000;

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __studio?: object }).__studio = {
    runtime: viewerRuntime,
    store: useViewerStore,
  };
}

interface ModelViewerProps {
  modelUrl: string;
  modelName?: string;
  className?: string;
}

interface CreatedState {
  gl: WebGLRenderer;
}

export function ModelViewer({ modelUrl, modelName, className = '' }: ModelViewerProps) {
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [dpr, setDpr] = useState<number | [number, number] | undefined>(undefined);

  const containerRef = useRef<HTMLDivElement>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glRef = useRef<WebGLRenderer | null>(null);

  const viewStats = useViewerStore((s) => s.viewStats);
  const cameraPosition = useViewerStore((s) => s.cameraPosition);
  const controlsTarget = useViewerStore((s) => s.controlsTarget);

  const ready = readyUrl === modelUrl;
  const dprProps = useMemo<number | [number, number]>(
    () => dpr ?? [1, 2],
    [dpr],
  );
  const zoom = Math.round(
    zoomLevel(cameraPosition, controlsTarget, MIN_DISTANCE, MAX_DISTANCE) * 100,
  );
  const statsText = viewStats
    ? `${viewStats.triangles.toLocaleString('en-US')} tris · ${viewStats.calls} calls · zoom ${zoom}%`
    : `zoom ${zoom}%`;

  const fullscreenAvailable =
    typeof document !== 'undefined' &&
    typeof document.documentElement.requestFullscreen === 'function';

  const flashStatus = useCallback((message: string) => {
    setStatus(message);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), 2500);
  }, []);

  useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    },
    [],
  );

  // Force-release the WebGL context when the canvas unmounts so repeated
  // Detail <-> Viewer navigation cannot accumulate contexts (browsers cap
  // the live context count and start force-losing the active canvas).
  useEffect(
    () => () => {
      const gl = glRef.current;
      glRef.current = null;
      gl?.extensions?.get('WEBGL_lose_context')?.loseContext();
    },
    [],
  );

  const handleCreated = useCallback((state: CreatedState) => {
    const canvas = state.gl.domElement;
    glRef.current = state.gl;
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      setContextLost(true);
    });
    canvas.addEventListener('webglcontextrestored', () => setContextLost(false));
  }, []);

  const handleReady = useCallback(() => setReadyUrl(modelUrl), [modelUrl]);

  const handleReset = useCallback(() => {
    useViewerStore.getState().resetCamera();
    flashStatus('Camera reset');
  }, [flashStatus]);

  const handleFrame = useCallback(() => {
    const root = viewerRuntime.modelRoot;
    const camera = viewerRuntime.camera;
    if (!root || !camera) {
      flashStatus('Model not ready yet');
      return;
    }
    root.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(root);
    const pose = framePose(box, camera.fov ?? 45, camera.aspect || 1);
    if (pose) {
      useViewerStore.getState().setCameraPose(pose);
      flashStatus('Framed model');
    } else {
      flashStatus('Model bounds unavailable');
    }
  }, [flashStatus]);

  const handleZoom = useCallback((factor: number) => {
    const state = useViewerStore.getState();
    const camera = viewerRuntime.camera;
    const controls = viewerRuntime.controls;
    const pose: CameraPose =
      camera && controls
        ? {
            position: [camera.position.x, camera.position.y, camera.position.z],
            target: [controls.target.x, controls.target.y, controls.target.z],
          }
        : { position: state.cameraPosition, target: state.controlsTarget };
    state.setCameraPose(nextZoomPose(pose, factor, MIN_DISTANCE, MAX_DISTANCE));
  }, []);

  const handleScreenshot = useCallback(() => {
    const dataUrl = captureScreenshot(viewerRuntime);
    if (!dataUrl) {
      flashStatus('Screenshot unavailable');
      return;
    }
    downloadDataUrl(dataUrl, modelSlug(modelName ?? 'model', 'png'));
    flashStatus('Screenshot saved');
  }, [modelName, flashStatus]);

  const toggleFullscreen = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    if (typeof element.requestFullscreen !== 'function') {
      flashStatus('Fullscreen not supported');
      return;
    }
    element
      .requestFullscreen()
      .catch(() => flashStatus('Fullscreen unavailable'));
  }, [flashStatus]);

  const handlePerfDecline = useCallback(() => setDpr(1), []);
  const handlePerfIncline = useCallback(
    () => setDpr((current) => (current === 1 ? ([1, 2] as [number, number]) : current)),
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        if (showPanel) {
          setShowPanel(false);
          return;
        }
        return;
      }

      const action = shortcutAction(event);
      if (!action) return;
      event.preventDefault();

      switch (action) {
        case 'reset':
          handleReset();
          break;
        case 'frame':
          handleFrame();
          break;
        case 'zoomIn':
          handleZoom(0.8);
          break;
        case 'zoomOut':
          handleZoom(1.25);
          break;
        case 'autoRotate':
          useViewerStore.getState().toggleAutoRotate();
          break;
        case 'orbit':
          useViewerStore.getState().toggleOrbit();
          break;
        case 'grid':
          useViewerStore.getState().toggleGrid();
          break;
        case 'axes':
          useViewerStore.getState().toggleAxes();
          break;
        case 'wireframe':
          useViewerStore.getState().toggleWireframe();
          break;
        case 'background':
          useViewerStore.getState().cycleEnvironment();
          flashStatus('Background switched');
          break;
        case 'screenshot':
          handleScreenshot();
          break;
        case 'fullscreen':
          toggleFullscreen();
          break;
        case 'help':
          setShowShortcuts((current) => !current);
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    showShortcuts,
    showPanel,
    handleReset,
    handleFrame,
    handleZoom,
    handleScreenshot,
    toggleFullscreen,
    flashStatus,
  ]);

  return (
    <ErrorBoundary
      fallback={({ error, retry }) => (
        <div className="flex h-full min-h-[200px] items-center justify-center rounded-card border border-danger/30 bg-danger/10 p-4">
          <div className="text-center">
            <p className="text-sm font-medium text-danger">Viewer crashed</p>
            <p className="mt-1 text-xs text-ink-muted">
              {error?.message ?? 'Unknown error'}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={retry}
                className="rounded-md border border-control bg-elevated px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-interactive focus-ring"
              >
                Restart viewer
              </button>
              <a
                href="/"
                className="rounded-md border border-control bg-elevated px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-interactive focus-ring"
              >
                Back to Gallery
              </a>
            </div>
          </div>
        </div>
      )}
    >
      <div
        ref={containerRef}
        className={`relative h-full w-full overflow-hidden ${className}`}
        data-testid="model-viewer"
      >
        <Canvas
          frameloop="always"
          camera={{ position: [0, 1, 5], fov: 45 }}
          dpr={dprProps}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={handleCreated}
          onError={(err) => {
            setRendererError(
              err instanceof Error ? err.message : 'Failed to initialize renderer',
            );
          }}
        >
          <ModelScene
            modelUrl={modelUrl}
            onReady={handleReady}
            onPerfDecline={handlePerfDecline}
            onPerfIncline={handlePerfIncline}
          />
        </Canvas>

        <ViewerOverlay
          ready={ready}
          error={rendererError}
          contextLost={contextLost}
          modelName={modelName}
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-col items-center gap-2 px-3">
          {status ? (
            <p
              role="status"
              className="rounded-md border border-line bg-surface/90 px-2.5 py-1 text-[11px] font-medium text-ink shadow-card backdrop-blur"
              data-testid="viewer-status"
            >
              {status}
            </p>
          ) : (
            <p
              className="rounded-md border border-line bg-surface/85 px-2.5 py-1 text-[11px] text-ink-muted backdrop-blur"
              data-testid="viewer-status"
            >
              {statsText}
            </p>
          )}

          <ViewerDock
            onReset={handleReset}
            onFrame={handleFrame}
            onZoomIn={() => handleZoom(0.8)}
            onZoomOut={() => handleZoom(1.25)}
            onScreenshot={handleScreenshot}
            onFullscreen={toggleFullscreen}
            onToggleHelp={() => setShowShortcuts((current) => !current)}
            onTogglePanel={() => setShowPanel((current) => !current)}
            fullscreenAvailable={fullscreenAvailable}
            helpOpen={showShortcuts}
            panelOpen={showPanel}
          />
        </div>

        <ViewerPanel
          open={showPanel}
          onClose={() => setShowPanel(false)}
          modelName={modelName}
          dpr={typeof dpr === 'number' ? dpr : undefined}
        />

        <ViewerShortcuts open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      </div>
    </ErrorBoundary>
  );
}
