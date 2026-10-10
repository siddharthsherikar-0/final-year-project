import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { ViewerPage } from '@/pages/ViewerPage';
import { useModelStore } from '@/stores/useModelStore';
import { useViewerStore } from '@/stores/useViewerStore';
import type { ModelMetadata } from '@/types';

// The Studio renders exactly one viewer. R3F/Canvas is exercised by the Phase I
// regression suite, so this stub stands in for the 3D layer while keeping the
// REAL inspection panel mounted - that is what this file is actually asserting.
let viewerRenders = 0;
vi.mock('@/components/viewer/ModelViewer', async () => {
  const { ViewerPanel } = await import('@/components/viewer/ViewerPanel');
  const { useViewerStore } = await import('@/stores/useViewerStore');

  return {
    ModelViewer: ({
      modelUrl,
      modelName,
      layout,
      asset,
    }: {
      modelUrl: string;
      modelName?: string;
layout?: 'embedded' | 'studio' | 'editor';
      asset?: { format?: string; fileSize?: number; hasTextures?: boolean } | null;
    }) => {
      viewerRenders += 1;
      const panelOpen = useViewerStore((s) => s.panelOpen);
      const setPanelOpen = useViewerStore((s) => s.setPanelOpen);
      return (
        <div data-testid="model-viewer-stub" data-layout={layout} data-url={modelUrl}>
          {modelName}
          {(layout === 'studio' || layout === 'editor') && (
            <ViewerPanel
              variant="studio"
              open={panelOpen}
              onClose={() => setPanelOpen(false)}
              modelName={modelName}
              asset={asset}
            />
          )}
        </div>
      );
    },
  };
});

/** Publishes a loaded scene the way ModelMesh does after a successful load. */
function publishInspection() {
  useViewerStore.getState().setSceneInspection({
    meshCount: 4,
    skinnedMeshCount: 1,
    materialCount: 3,
    triangleCount: 2412,
    dimensions: [2.42, 1.84, 3.17],
    largestAxis: 'z',
    objectNames: ['Hull'],
    namedObjectCount: 1,
    materials: [],
    animationNames: [],
    hasMorphTargets: false,
    textureCount: 2,
  });
}

function makeModel(overrides: Partial<ModelMetadata> = {}): ModelMetadata {
  return {
    id: 'studio-1',
    name: 'Observatory',
    description: 'A studio test asset.',
    category: 'architecture',
    format: 'glb',
    fileUrl: '/models/observatory.glb',
    thumbnailUrl: '/models/observatory-thumb.jpg',
    fileSize: 491110,
    vertexCount: 2400,
    triangleCount: 2400,
    hasTextures: true,
    hasAnimations: false,
    tags: [],
    author: 'Sid',
    license: 'CC0',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderStudio(id = 'studio-1') {
  return render(
    <MemoryRouter initialEntries={[`/viewer/${id}`]}>
      <Routes>
        <Route path="/viewer/:id" element={<ViewerPage />} />
        <Route path="/model/:id" element={<div>Model detail page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  viewerRenders = 0;
  useViewerStore.getState().resetStudioState();
  useModelStore.setState({
    models: [makeModel()],
    selectedModel: null,
    isLoading: false,
    error: null,
    settledId: 'studio-1',
  });
});

afterEach(() => {
  useViewerStore.getState().resetStudioState();
});

describe('ViewerPage studio composition', () => {
it('mounts exactly one viewer, in editor layout', async () => {
    renderStudio();
    await screen.findByTestId('model-viewer-stub');
    expect(viewerRenders).toBe(1);
    expect(screen.getAllByTestId('model-viewer-stub')).toHaveLength(1);
    // Stage 9B: the studio page now renders the editor workspace.
    expect(screen.getByTestId('model-viewer-stub')).toHaveAttribute(
      'data-layout',
      'editor',
    );
    expect(document.querySelectorAll('canvas')).toHaveLength(0);
  });

  it('renders a compact toolbar with name and technical metadata', async () => {
    renderStudio();
    await screen.findByTestId('model-viewer-stub');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Observatory');
    const header = screen.getByRole('banner');
    // Technical facts in mono; studio indicator is text, not a badge.
    expect(header.textContent).toMatch(/glb/i);
    expect(header.textContent).toMatch(/479\.6 KB/);
    expect(header.textContent).toMatch(/Studio/);
    expect(header.querySelectorAll('header')).toHaveLength(0);
  });

  it('links back to the model detail page', async () => {
    renderStudio();
    await screen.findByTestId('model-viewer-stub');
    expect(screen.getByRole('link', { name: /back to model/i })).toHaveAttribute(
      'href',
      '/model/studio-1',
    );
  });

  it('opens the inspection panel from the toolbar and reflects aria-expanded', async () => {
    renderStudio();
    await screen.findByTestId('model-viewer-stub');

    const toggle = screen.getByRole('button', { name: /inspection/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('complementary', { name: /studio panel/i })).toBeNull();

fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('complementary', { name: /studio panel/i })).toBeInTheDocument();
  });

  it('resolves the toolbar aria-controls to the rendered panel', async () => {
    renderStudio();
    await screen.findByTestId('model-viewer-stub');

    const toggle = screen.getByRole('button', { name: /inspection/i });
    const controls = toggle.getAttribute('aria-controls');
    expect(controls).toBeTruthy();

    fireEvent.click(toggle);
    const panel = screen.getByRole('complementary', { name: /studio panel/i });
    expect(panel.id).toBe(controls);
    expect(document.getElementById(controls!)).toBe(panel);
  });

  it('shows scene, asset, environment and view sections', async () => {
    renderStudio();
    await screen.findByTestId('model-viewer-stub');
    // Inspection is published once the model is loaded, i.e. after mount.
    publishInspection();
    fireEvent.click(screen.getByRole('button', { name: /inspection/i }));

    const panel = screen.getByRole('complementary', { name: /studio panel/i });
    expect(panel).toHaveAttribute('data-variant', 'studio');

    for (const heading of ['Scene', 'Asset', 'Environment', 'View']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }

    // Scene values come from the loaded scene.
    expect(screen.getByTestId('stat-Meshes')).toHaveTextContent('4');
    expect(screen.getByTestId('stat-Materials')).toHaveTextContent('3');
    expect(screen.getByTestId('stat-Triangles')).toHaveTextContent('2,412');
    expect(screen.getByTestId('stat-Dimensions')).toHaveTextContent('2.42 × 1.84 × 3.17');

    // Asset values come from the API record.
    expect(screen.getByTestId('stat-Format')).toHaveTextContent('GLB');
    expect(screen.getByTestId('stat-File size')).toHaveTextContent('479.6 KB');
  });

  it('renders an em dash for values that are unavailable', async () => {
    useViewerStore.getState().setSceneInspection(null);
    renderStudio();
    await screen.findByTestId('model-viewer-stub');
    fireEvent.click(screen.getByRole('button', { name: /inspection/i }));

    expect(screen.getByTestId('stat-Meshes')).toHaveTextContent('—');
    expect(screen.getByTestId('stat-Dimensions')).toHaveTextContent('—');
    expect(screen.getByTestId('stat-Draw calls')).toHaveTextContent('—');
    // Asset facts still come through even without scene inspection.
    expect(screen.getByTestId('stat-Format')).toHaveTextContent('GLB');
  });

  it('keeps environment presets and view toggles working from the panel', async () => {
    renderStudio();
    await screen.findByTestId('model-viewer-stub');
    fireEvent.click(screen.getByRole('button', { name: /inspection/i }));

    fireEvent.click(screen.getByRole('radio', { name: 'Midnight' }));
    expect(useViewerStore.getState().environment).toBe('midnight');

    const wireframe = screen.getByRole('button', { name: 'Wireframe' });
    expect(wireframe).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(wireframe);
    expect(useViewerStore.getState().isWireframe).toBe(true);
    expect(wireframe).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Auto rotate' }));
    expect(useViewerStore.getState().autoRotate).toBe(true);
  });

  it('exposes an animation section only when clips exist', async () => {
    renderStudio();
    await screen.findByTestId('model-viewer-stub');
    fireEvent.click(screen.getByRole('button', { name: /inspection/i }));
    expect(screen.queryByRole('heading', { name: 'Animation' })).toBeNull();

    useViewerStore.getState().setAnimationClips(['Walk', 'Run']);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Animation' })).toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Animation clip')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play animation/i })).toBeInTheDocument();
  });

  it('closes the panel from its close button', async () => {
    renderStudio();
    await screen.findByTestId('model-viewer-stub');
    fireEvent.click(screen.getByRole('button', { name: /inspection/i }));
    expect(screen.getByRole('complementary', { name: /studio panel/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close panel/i }));
    expect(screen.queryByRole('complementary', { name: /studio panel/i })).toBeNull();
  });

  it('keeps the loading, error and not-found states intact', async () => {
    useModelStore.setState({ models: [], isLoading: true, settledId: null });
    const { unmount } = renderStudio();
    expect(await screen.findByTestId('viewer-page-message')).toHaveTextContent(
      /loading model/i,
    );
    unmount();

    useModelStore.setState({
      models: [],
      isLoading: false,
      error: 'boom',
      settledId: 'studio-1',
    });
    renderStudio();
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load this model/i);
  });

  it('shows a clean not-found state for an unknown model', async () => {
    useModelStore.setState({
      models: [makeModel()],
      isLoading: false,
      settledId: 'missing-model',
    });
    renderStudio('missing-model');
    expect(await screen.findByText(/model not found/i)).toBeInTheDocument();
    expect(viewerRenders).toBe(0);
  });

  it('resets studio state when the model changes', async () => {
    render(
      <MemoryRouter initialEntries={['/viewer/studio-1']}>
        <Link to="/viewer/studio-2" data-testid="switch-model">
          Switch model
        </Link>
        <Routes>
          <Route path="/viewer/:id" element={<ViewerPage />} />
          <Route path="/model/:id" element={<div>Model detail page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByTestId('model-viewer-stub');

    // Dirty the studio the way a user would.
    useViewerStore.getState().setEnvironment('sunset');
    useViewerStore.getState().toggleWireframe();
    useViewerStore.getState().toggleAxes();
    useViewerStore.getState().togglePanel();
    expect(useViewerStore.getState().environment).toBe('sunset');

    useModelStore.setState({
      models: [makeModel(), makeModel({ id: 'studio-2', name: 'Crane' })],
    });
    fireEvent.click(screen.getByTestId('switch-model'));

    await waitFor(() => expect(useViewerStore.getState().environment).toBe('studio'));
    expect(useViewerStore.getState().isWireframe).toBe(false);
    expect(useViewerStore.getState().showAxes).toBe(false);
    expect(useViewerStore.getState().panelOpen).toBe(false);
    expect(useViewerStore.getState().studioModelId).toBe('studio-2');
  });

  it('keeps studio state when the same model is revisited', async () => {
    renderStudio();
    await screen.findByTestId('model-viewer-stub');

    useViewerStore.getState().setEnvironment('midnight');
    useViewerStore.getState().togglePanel();
    expect(useViewerStore.getState().environment).toBe('midnight');

    // Re-entering the same model must not silently move the camera.
    useViewerStore.getState().ensureStudioFor('studio-1');
    expect(useViewerStore.getState().environment).toBe('midnight');
    expect(useViewerStore.getState().panelOpen).toBe(true);
  });
});

