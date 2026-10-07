import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const sceneFlag = vi.hoisted(() => ({ ready: true, crash: false }));
const progressFlag = vi.hoisted(() => ({ progress: 0, active: false }));

vi.mock('@react-three/fiber', async () => {
  const React = await import('react');
  return {
    Canvas: ({
      children,
      onCreated,
    }: {
      children?: React.ReactNode;
      onCreated?: (state: { gl: { domElement: HTMLCanvasElement } }) => void;
    }) => {
      const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
      React.useEffect(() => {
        if (canvasRef.current) {
          onCreated?.({ gl: { domElement: canvasRef.current } });
        }
      }, [onCreated]);
      return React.createElement(
        'div',
        { 'data-testid': 'mock-canvas' },
        React.createElement('canvas', { ref: canvasRef, 'data-testid': 'gl-canvas' }),
        children,
      );
    },
  };
});

vi.mock('@react-three/drei', () => ({
  useProgress: () => progressFlag,
}));

vi.mock('@/components/viewer/ModelScene', async () => {
  const React = await import('react');
  return {
    ModelScene: ({
      modelUrl,
      onReady,
    }: {
      modelUrl: string;
      onReady?: () => void;
    }) => {
      if (sceneFlag.crash) throw new Error('scene exploded');
      React.useEffect(() => {
        if (sceneFlag.ready) onReady?.();
      }, [onReady]);
      return React.createElement('div', {
        'data-testid': 'scene',
        'data-url': modelUrl,
      });
    },
  };
});

import { ModelViewer } from '@/components/viewer/ModelViewer';
import { useViewerStore } from '@/stores/useViewerStore';

function resetViewerState() {
  sceneFlag.ready = true;
  sceneFlag.crash = false;
  progressFlag.progress = 0;
  progressFlag.active = false;
  useViewerStore.setState({
    cameraPosition: [0, 1, 5],
    controlsTarget: [0, 0, 0],
    lastFrame: null,
    isWireframe: false,
    autoRotate: false,
    showGrid: true,
    showAxes: false,
    orbitEnabled: true,
    environment: 'studio',
    animationClips: [],
    activeClip: 0,
    isPlaying: false,
    viewStats: null,
  });
}

function dockButton(name: RegExp | string) {
  return screen.getByRole('button', { name });
}

describe('ModelViewer controls', () => {
  beforeEach(() => {
    resetViewerState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders every dock control with an accessible name', () => {
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);

    const toolbar = screen.getByRole('toolbar', { name: /viewer controls/i });
    expect(toolbar).toBeInTheDocument();

    for (const label of [
      'Reset camera',
      'Frame model',
      'Zoom in',
      'Zoom out',
      'Auto-rotate',
      'Grid',
      'Axes',
      'Wireframe',
      'Save screenshot',
      'Fullscreen not supported',
      'Keyboard shortcuts',
      'Studio panel',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /Orbit on/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Background:/i })).toBeInTheDocument();
  });

  it('toggles view options through the dock', () => {
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);

    fireEvent.click(dockButton('Grid'));
    expect(useViewerStore.getState().showGrid).toBe(false);
    expect(dockButton('Grid')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(dockButton('Grid'));
    expect(dockButton('Grid')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(dockButton('Axes'));
    expect(useViewerStore.getState().showAxes).toBe(true);

    fireEvent.click(dockButton('Wireframe'));
    expect(useViewerStore.getState().isWireframe).toBe(true);

    fireEvent.click(dockButton('Auto-rotate'));
    expect(useViewerStore.getState().autoRotate).toBe(true);

    fireEvent.click(dockButton(/Orbit on/i));
    expect(useViewerStore.getState().orbitEnabled).toBe(false);
  });

  it('cycles the background preset from the dock', () => {
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);
    expect(useViewerStore.getState().environment).toBe('studio');

    fireEvent.click(dockButton(/^Background:/i));
    expect(useViewerStore.getState().environment).toBe('midnight');
    fireEvent.click(dockButton(/^Background:/i));
    expect(useViewerStore.getState().environment).toBe('sunset');
  });

  it('zooms the stored pose in and out and resets it', () => {
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);

    const start = useViewerStore.getState().cameraPosition;
    const startDistance = Math.hypot(...start);
    fireEvent.click(dockButton('Zoom in'));
    const zoomedIn = useViewerStore.getState().cameraPosition;
    expect(Math.hypot(...zoomedIn)).toBeLessThan(startDistance);

    fireEvent.click(dockButton('Zoom out'));
    expect(
      Math.hypot(...useViewerStore.getState().cameraPosition),
    ).toBeGreaterThan(Math.hypot(...zoomedIn));

    fireEvent.click(dockButton('Reset camera'));
    expect(useViewerStore.getState().cameraPosition).toEqual([0, 1, 5]);
    expect(screen.getByTestId('viewer-status')).toHaveTextContent('Camera reset');
  });

  it('reports honest unavailable states before the scene registers', () => {
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);

    fireEvent.click(dockButton('Frame model'));
    expect(screen.getByTestId('viewer-status')).toHaveTextContent(
      'Model not ready yet',
    );

    fireEvent.click(dockButton('Save screenshot'));
    expect(screen.getByTestId('viewer-status')).toHaveTextContent(
      'Screenshot unavailable',
    );
  });

  it('shows the loading overlay until the scene reports ready', () => {
    sceneFlag.ready = false;
    const first = render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Preparing Duck…');
    first.unmount();

    sceneFlag.ready = true;
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);
    expect(screen.queryByText(/Preparing/)).toBeNull();
    expect(screen.getByTestId('scene')).toBeInTheDocument();
  });

  it('surfaces real load progress percentages', () => {
    sceneFlag.ready = false;
    progressFlag.progress = 42;
    progressFlag.active = true;
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);

    expect(screen.getByTestId('viewer-progress-label')).toHaveTextContent(
      'Loading Duck… 42%',
    );
  });

  it('opens and closes the shortcuts dialog with the keyboard', () => {
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);

    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-label',
      'Keyboard shortcuts',
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('drives dock toggles from keyboard shortcuts', () => {
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);

    fireEvent.keyDown(window, { key: 'g' });
    expect(useViewerStore.getState().showGrid).toBe(false);

    fireEvent.keyDown(window, { key: 'x' });
    expect(useViewerStore.getState().showAxes).toBe(true);

    fireEvent.keyDown(window, { key: 'w' });
    expect(useViewerStore.getState().isWireframe).toBe(true);

    fireEvent.keyDown(window, { key: 'b' });
    expect(useViewerStore.getState().environment).toBe('midnight');

    fireEvent.keyDown(window, { key: 'r' });
    expect(screen.getByTestId('viewer-status')).toHaveTextContent('Camera reset');
  });

  it('ignores shortcuts while typing and with modifiers held', () => {
    render(
      <div>
        <input aria-label="search" />
        <ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />
      </div>,
    );
    const input = screen.getByLabelText('search');

    fireEvent.keyDown(input, { key: 'g' });
    expect(useViewerStore.getState().showGrid).toBe(true);

    fireEvent.keyDown(window, { key: 'g', ctrlKey: true });
    expect(useViewerStore.getState().showGrid).toBe(true);
  });

  it('opens and closes the studio panel, with animation controls only when clips exist', () => {
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);

    expect(screen.queryByRole('complementary', { name: /studio panel/i })).toBeNull();

    fireEvent.click(dockButton('Studio panel'));
    const panel = screen.getByRole('complementary', { name: /studio panel/i });
    expect(panel).toHaveTextContent('Duck');
    expect(screen.queryByLabelText(/animation clip/i)).toBeNull();

    act(() => {
      useViewerStore.getState().setAnimationClips(['Walk']);
    });
    expect(screen.getByLabelText(/animation clip/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /play animation/i }));
    expect(useViewerStore.getState().isPlaying).toBe(true);
    expect(
      screen.getByRole('button', { name: /pause animation/i }),
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByRole('complementary', { name: /studio panel/i }),
    ).toBeNull();

    fireEvent.click(dockButton('Studio panel'));
    fireEvent.click(screen.getByRole('button', { name: /close panel/i }));
    expect(
      screen.queryByRole('complementary', { name: /studio panel/i }),
    ).toBeNull();
  });

  it('selects environment presets from the panel', () => {
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);
    fireEvent.click(dockButton('Studio panel'));

    fireEvent.click(screen.getByRole('radio', { name: 'Sunset' }));
    expect(useViewerStore.getState().environment).toBe('sunset');
    expect(screen.getByRole('radio', { name: 'Sunset' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('shows real view stats in the status line', () => {
    useViewerStore.getState().setViewStats({ triangles: 4212, calls: 7 });
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);

    expect(screen.getByTestId('viewer-status')).toHaveTextContent(
      '4,212 tris · 7 calls · zoom',
    );
  });

  it('disables fullscreen when the API is unavailable', () => {
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);
    const available =
      typeof document.documentElement.requestFullscreen === 'function';
    const button = screen.getByRole('button', {
      name: available ? 'Fullscreen' : 'Fullscreen not supported',
    });
    expect(button).toBeDisabled();
  });

  it('shows a recoverable overlay when the WebGL context is lost', () => {
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);
    const canvas = screen.getByTestId('gl-canvas');

    fireEvent(canvas, new Event('webglcontextlost'));
    expect(screen.getByRole('alert')).toHaveTextContent('Graphics context lost');

    fireEvent(canvas, new Event('webglcontextrestored'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('scene')).toBeInTheDocument();
  });

  it('wraps the scene in an error boundary that can restart the viewer', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    sceneFlag.crash = true;
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);
    expect(screen.getByText('Viewer crashed')).toBeInTheDocument();
    expect(screen.getByText('scene exploded')).toBeInTheDocument();

    sceneFlag.crash = false;
    fireEvent.click(screen.getByRole('button', { name: /restart viewer/i }));
    expect(screen.queryByText('Viewer crashed')).toBeNull();
    expect(screen.getByTestId('scene')).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
