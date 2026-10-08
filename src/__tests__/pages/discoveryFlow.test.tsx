import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { ModelDetailPage } from '@/pages/ModelDetailPage';
import { ViewerPage } from '@/pages/ViewerPage';
import { useModelStore } from '@/stores/useModelStore';
import { useFilterStore } from '@/stores/useFilterStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRecentStore } from '@/stores/useRecentStore';
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
  ModelViewer: ({ modelName }: { modelUrl: string; modelName?: string }) => (
    <div data-testid="model-viewer">{modelName}</div>
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

const MODELS = [
  makeModel('m1', { name: 'Alpha House', category: 'architecture' }),
  makeModel('m2', { name: 'Beta Villa', category: 'architecture' }),
  makeModel('m3', { name: 'Gamma Mech', category: 'sci-fi' }),
];

function renderApp(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/model/:id" element={<ModelDetailPage />} />
        <Route path="/viewer/:id" element={<ViewerPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(modelRepository.getAll).mockResolvedValue(MODELS);
  useModelStore.setState({
    models: MODELS,
    selectedModel: null,
    isLoading: false,
    error: null,
    settledId: null,
  });
  useFilterStore.setState({
    searchQuery: '',
    selectedCategories: [],
    selectedFormats: [],
    sortBy: 'name',
    sortOrder: 'asc',
  });
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
  useRecentStore.setState({ ids: [] });
  window.localStorage.clear();
});

describe('Discovery flow', () => {
  it('walks gallery to detail to viewer and back, recording history', async () => {
    renderApp();
    await screen.findByText('Model Gallery');
    const gallery = document.getElementById('gallery')!;
    fireEvent.click(within(gallery).getByText('Alpha House').closest('a')!);
    expect(await screen.findByText('Open in Studio')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Open in Studio'));
    expect(await screen.findByText('Back to Model')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back to Model'));
    expect(await screen.findByText('Open in Studio')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Gallery' }));
    expect(await screen.findByText('Model Gallery')).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem('recentlyViewed')!),
    ).toEqual(['m1']);
  });

  it('keeps the category filter when returning from a model', async () => {
    renderApp(['/?category=architecture']);
    await screen.findByText('Model Gallery');
    await waitFor(() =>
      expect(useFilterStore.getState().selectedCategories).toEqual([
        'architecture',
      ]),
    );
    const gallery = document.getElementById('gallery')!;
    fireEvent.click(within(gallery).getByText('Alpha House').closest('a')!);
    await screen.findByText('Open in Studio');
    fireEvent.click(screen.getByRole('link', { name: 'Gallery' }));
    await screen.findByText('Model Gallery');
    expect(useFilterStore.getState().selectedCategories).toEqual([
      'architecture',
    ]);
    expect(within(gallery).queryByText('Gamma Mech')).not.toBeInTheDocument();
  });

  it('refetches when the store is stale', async () => {
    useModelStore.setState({
      models: [],
      selectedModel: null,
      isLoading: false,
      error: null,
      settledId: null,
    });
    renderApp(['/model/m1']);
    expect(await screen.findByText('Open in Studio')).toBeInTheDocument();
    expect(useModelStore.getState().models.length).toBe(3);
  });
});
