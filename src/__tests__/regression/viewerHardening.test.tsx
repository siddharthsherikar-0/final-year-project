import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { WebGLRenderer } from 'three';
import { Scene, PerspectiveCamera } from 'three';

const sceneFlag = vi.hoisted(() => ({ ready: true, crash: false }));
const loseContextHolder = vi.hoisted(() => ({ fn: null as (() => void) | null }));
const viewerRouteFlag = vi.hoisted(() => ({ armed: false }));

vi.mock('@react-three/fiber', async () => {
  const React = await import('react');
  interface GlLike {
    domElement: HTMLCanvasElement;
    extensions?: { get: (name: string) => { loseContext?: () => void } | null };
  }
  return {
    Canvas: ({
      children,
      onCreated,
    }: {
      children?: React.ReactNode;
      onCreated?: (state: { gl: GlLike }) => void;
    }) => {
      const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
      React.useEffect(() => {
        if (canvasRef.current) {
          onCreated?.({
            gl: {
              domElement: canvasRef.current,
              extensions: {
                get: (name: string) =>
                  name === 'WEBGL_lose_context'
                    ? { loseContext: () => loseContextHolder.fn?.() }
                    : null,
              },
            },
          });
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
  useProgress: () => ({ progress: 0, active: false }),
  useGLTF: Object.assign(vi.fn(() => ({ scene: null, animations: [] })), {
    setDecoderPath: vi.fn(),
    clear: vi.fn(),
  }),
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

vi.mock('@/pages/ViewerPage', () => ({
  ViewerPage: () => {
    if (viewerRouteFlag.armed) {
      throw new Error('viewer route exploded');
    }
    return <div data-testid="viewer-route-ok">VIEWER_OK</div>;
  },
}));

vi.mock('@/data/modelRepository', () => ({
  modelRepository: {
    getAll: vi.fn(),
    getById: vi.fn(),
    filter: vi.fn(),
    getMine: vi.fn(),
  },
}));

import { ModelViewer } from '@/components/viewer/ModelViewer';
import { viewerRuntime, resetViewerRuntime } from '@/components/viewer/viewerRuntime';
import { useViewerStore } from '@/stores/useViewerStore';
import { UploadPreview } from '@/components/upload/UploadPreview';
import { HomePage } from '@/pages/HomePage';
import App from '@/App';
import { useGLTF } from '@react-three/drei';
import { modelRepository } from '@/data/modelRepository';
import { useAuthStore } from '@/stores/useAuthStore';
import { useModelStore } from '@/stores/useModelStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';
import { useMyModelsStore } from '@/stores/useMyModelsStore';
import { makeModel } from '../helpers/modelFixtures';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function resetViewerState() {
  sceneFlag.ready = true;
  sceneFlag.crash = false;
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

beforeEach(() => {
  vi.resetAllMocks();
  viewerRouteFlag.armed = false;
  loseContextHolder.fn = vi.fn();
  resetViewerState();
  vi.mocked(modelRepository.getAll).mockResolvedValue([]);
  vi.mocked(modelRepository.getMine).mockResolvedValue([]);
  useAuthStore.setState({
    isAuthenticated: true,
    token: 'test-token',
    user: { id: 'u1', email: 'ada@studio.dev', name: 'Ada Lovelace' },
    error: null,
    isLoading: false,
    isHydratingUser: false,
  });
  useModelStore.setState({
    models: [],
    selectedModel: null,
    isLoading: false,
    error: null,
    settledId: null,
  });
  useFavoriteStore.setState({
    favoriteIds: new Set<string>(),
    isLoading: false,
    error: null,
  });
  useMyModelsStore.setState({ models: [], isLoading: false, error: null });
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return Promise.resolve(jsonResponse(useAuthStore.getState().user));
      }
      return Promise.resolve(jsonResponse([]));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetViewerRuntime();
  viewerRuntime.modelRoot = null;
  window.history.pushState({}, '', '/');
});

describe('Phase I viewer hardening regressions', () => {
  it('mounts exactly one canvas in the viewer and none after unmount', () => {
    const { unmount } = render(
      <ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />,
    );

    expect(document.querySelectorAll('canvas')).toHaveLength(1);
    expect(screen.getAllByTestId('model-viewer')).toHaveLength(1);
    expect(
      screen.getAllByRole('toolbar', { name: /viewer controls/i }),
    ).toHaveLength(1);

    unmount();
    expect(document.querySelectorAll('canvas')).toHaveLength(0);
    expect(screen.queryByTestId('model-viewer')).toBeNull();
  });

  it('renders the gallery home with zero canvases', async () => {
    useModelStore.setState({ models: [makeModel('m1', { name: 'Duck' })] });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(document.querySelectorAll('canvas')).toHaveLength(0);
    expect(screen.queryByTestId('model-viewer')).toBeNull();
    await act(async () => {});
  });

  it('never duplicates the viewer across repeated mount cycles', () => {
    for (let cycle = 0; cycle < 3; cycle += 1) {
      const { unmount } = render(
        <ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />,
      );
      expect(document.querySelectorAll('canvas')).toHaveLength(1);
      expect(screen.getAllByTestId('model-viewer')).toHaveLength(1);
      expect(
        screen.getAllByRole('toolbar', { name: /viewer controls/i }),
      ).toHaveLength(1);
      unmount();
      expect(document.querySelectorAll('canvas')).toHaveLength(0);
    }
  });

  it('keeps window keyboard listeners balanced across mount cycles', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    for (let cycle = 0; cycle < 3; cycle += 1) {
      const { unmount } = render(
        <ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />,
      );
      unmount();
    }

    const added = addSpy.mock.calls.filter((call) => call[0] === 'keydown');
    const removed = removeSpy.mock.calls.filter(
      (call) => call[0] === 'keydown',
    );
    expect(added.length).toBeGreaterThanOrEqual(3);
    expect(removed).toHaveLength(added.length);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('captures and downloads a screenshot when the renderer is available', () => {
    render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);

    const toDataURL = vi.fn(() => 'data:image/png;base64,iVBORw0KGgo=');
    const renderScene = vi.fn();
    viewerRuntime.gl = {
      render: renderScene,
      domElement: { toDataURL },
    } as unknown as WebGLRenderer;
    viewerRuntime.scene = new Scene();
    viewerRuntime.camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    fireEvent.click(screen.getByRole('button', { name: 'Save screenshot' }));

    expect(renderScene).toHaveBeenCalledTimes(1);
    expect(toDataURL).toHaveBeenCalledWith('image/png');
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('viewer-status')).toHaveTextContent(
      'Screenshot saved',
    );

    anchorClick.mockRestore();
  });

  it('requests fullscreen when the browser API is available', () => {
    const elementRequest = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      value: elementRequest,
      configurable: true,
      writable: true,
    });

    try {
      render(<ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />);
      const button = screen.getByRole('button', { name: 'Fullscreen' });
      expect(button).not.toBeDisabled();

      fireEvent.click(button);
      expect(elementRequest).toHaveBeenCalledTimes(1);
    } finally {
      delete (
        HTMLElement.prototype as { requestFullscreen?: unknown }
      ).requestFullscreen;
    }
  });

  it('force-releases the WebGL context when the viewer unmounts', () => {
    const loseContext = loseContextHolder.fn as unknown as ReturnType<
      typeof vi.fn
    >;

    const { unmount } = render(
      <ModelViewer modelUrl="/models/duck.glb" modelName="Duck" />,
    );
    expect(loseContext).not.toHaveBeenCalled();

    unmount();
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('revokes the upload preview blob URL and never mounts a GLTF viewer for it', async () => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:preview-1'),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
    const file = new File(['glb-bytes'], 'ship.glb', {
      type: 'model/gltf-binary',
    });
    const gltf = useGLTF as unknown as { clear: (url: string) => void };

    const { unmount } = render(<UploadPreview file={file} />);
    expect(await screen.findByTestId('upload-preview')).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);

    // Stage 7: the preview renders one studio still image instead of a live
    // R3F canvas, so no GLTF cache entry is created and nothing leaks.
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalled());
    expect(gltf.clear).not.toHaveBeenCalled();
    expect(useGLTF).not.toHaveBeenCalled();

    unmount();
  });

  it('recovers a crashed viewer route through the route error boundary', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    viewerRouteFlag.armed = true;
    window.history.pushState({}, '', '/viewer/boom');

    render(<App />);

    expect(
      screen.getByText('The 3D viewer failed to load.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /return to gallery/i }),
    ).toHaveAttribute('href', '/');
    expect(screen.queryByText('viewer route exploded')).toBeNull();
    expect(screen.queryByTestId('viewer-route-ok')).toBeNull();

    viewerRouteFlag.armed = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByTestId('viewer-route-ok')).toBeInTheDocument();
    expect(
      screen.queryByText('The 3D viewer failed to load.'),
    ).toBeNull();

    consoleError.mockRestore();
  });

  it('keeps auth, upload, favorites, my-models, and dashboard routes intact', async () => {
    const cases: Array<[string, () => void]> = [
      [
        '/login',
        () =>
          expect(
            screen.getByRole('heading', { name: /login/i }),
          ).toBeInTheDocument(),
      ],
      [
        '/register',
        () =>
          expect(
            screen.getByRole('heading', { name: 'Register' }),
          ).toBeInTheDocument(),
      ],
      [
        '/upload',
        () =>
          expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument(),
      ],
      [
        '/favorites',
        () =>
          expect(
            screen.getByRole('heading', { name: 'My Favorites' }),
          ).toBeInTheDocument(),
      ],
      [
        '/my-models',
        () =>
          expect(screen.getByTestId('empty-my-models')).toBeInTheDocument(),
      ],
      [
        '/dashboard',
        () =>
          expect(screen.getByTestId('dashboard-name')).toHaveTextContent(
            'Ada Lovelace',
          ),
      ],
    ];

    for (const [path, assertRoute] of cases) {
      window.history.pushState({}, '', path);
      const { unmount } = render(<App />);
      await waitFor(assertRoute, { timeout: 3000 });
      unmount();
    }
  });
});

