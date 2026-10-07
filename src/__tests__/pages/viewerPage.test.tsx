import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ViewerPage } from '@/pages/ViewerPage';
import { useModelStore } from '@/stores/useModelStore';
import { modelRepository } from '@/data/modelRepository';
import type { ModelMetadata } from '@/types';

vi.mock('@/data/modelRepository', () => ({
  modelRepository: {
    getAll: vi.fn(),
    getById: vi.fn(),
    filter: vi.fn(),
  },
}));

vi.mock('@/components/viewer/ModelViewer', () => ({
  ModelViewer: ({ modelUrl, modelName }: { modelUrl: string; modelName?: string }) => (
    <div data-testid="model-viewer" data-url={modelUrl}>
      {modelName}
    </div>
  ),
}));

const makeModel = (
  id: string,
  overrides: Partial<ModelMetadata> = {},
): ModelMetadata => ({
  id,
  name: `Model ${id}`,
  description: `Description ${id}`,
  category: 'other',
  format: 'glb',
  fileUrl: `/models/${id}.glb`,
  thumbnailUrl: '',
  fileSize: 1024,
  hasTextures: false,
  hasAnimations: false,
  tags: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

function renderViewer(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/viewer/${id}`]}>
      <Routes>
        <Route path="/viewer/:id" element={<ViewerPage />} />
        <Route path="/" element={<div>HOME_ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  useModelStore.setState({
    models: [],
    selectedModel: null,
    isLoading: false,
    error: null,
  });
});

describe('ViewerPage phases', () => {
  it('shows a loading phase while the catalog fetches', () => {
    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );

    renderViewer('m1');

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    expect(screen.getByTestId('viewer-page-message')).toHaveTextContent(
      'Loading model...',
    );
    expect(screen.queryByTestId('model-viewer')).toBeNull();
    expect(
      screen.getByRole('link', { name: /back to gallery/i }),
    ).toHaveAttribute('href', '/');
  });

  it('renders the studio once the model is resolved', async () => {
    const model = makeModel('m1', { name: 'Studio Duck' });
    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([
      model,
    ]);

    renderViewer('m1');

    expect(await screen.findByTestId('model-viewer')).toHaveAttribute(
      'data-url',
      '/models/m1.glb',
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Studio Duck',
    );
    expect(
      screen.getByRole('link', { name: /back to model/i }),
    ).toHaveAttribute('href', '/model/m1');
    expect(useModelStore.getState().selectedModel?.id).toBe('m1');
  });

  it('shows a deterministic not-found phase for unknown ids', async () => {
    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeModel('other'),
    ]);

    renderViewer('missing-id');

    expect(
      await screen.findByText(/model not found/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('model-viewer')).toBeNull();
    expect(
      screen.getByRole('link', { name: /back to gallery/i }),
    ).toHaveAttribute('href', '/');
  });

  it('shows an error phase and recovers via retry', async () => {
    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('catalog offline'),
    );

    renderViewer('m1');

    expect(await screen.findByText(/couldn't load this model/i)).toBeInTheDocument();

    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      makeModel('m1', { name: 'Recovered' }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByTestId('model-viewer')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Recovered',
    );
  });

  it('reuses an already-populated store without refetching', async () => {
    useModelStore.setState({ models: [makeModel('m1', { name: 'Cached' })] });

    renderViewer('m1');

    await waitFor(() =>
      expect(screen.getByTestId('model-viewer')).toBeInTheDocument(),
    );
    expect(modelRepository.getAll).not.toHaveBeenCalled();
  });
});
