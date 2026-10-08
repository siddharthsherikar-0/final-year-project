import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
  makeModel('m1', { name: 'Alpha House' }),
  makeModel('m2', { name: 'Beta Villa' }),
];

function readHistory(): string[] {
  return JSON.parse(window.localStorage.getItem('recentlyViewed') ?? '[]');
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

describe('RecentlyViewed', () => {
  it('records a view when a model detail page loads', async () => {
    render(
      <MemoryRouter initialEntries={['/model/m1']}>
        <Routes>
          <Route path="/model/:id" element={<ModelDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Alpha House' });
    expect(readHistory()).toEqual(['m1']);
  });

  it('records a view when the viewer page loads', async () => {
    render(
      <MemoryRouter initialEntries={['/viewer/m2']}>
        <Routes>
          <Route path="/viewer/:id" element={<ViewerPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Beta Villa' });
    expect(readHistory()).toEqual(['m2']);
  });

  it('resolves history against the store and skips deleted models', async () => {
    useRecentStore.setState({ ids: ['ghost', 'm1'] });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Recently viewed')).toBeInTheDocument();
    const region = screen.getByRole('region', { name: 'Recently viewed' });
    expect(within(region).getByText('Alpha House')).toBeInTheDocument();
    expect(within(region).queryByText('ghost')).not.toBeInTheDocument();
  });

  it('renders nothing when every history entry is missing', async () => {
    useRecentStore.setState({ ids: ['ghost'] });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText('Discover 3D assets');
    expect(screen.queryByText('Recently viewed')).not.toBeInTheDocument();
  });

  it('records views for unauthenticated visitors', async () => {
    render(
      <MemoryRouter initialEntries={['/model/m1']}>
        <Routes>
          <Route path="/model/:id" element={<ModelDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Alpha House' });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(readHistory()).toEqual(['m1']);
  });
});

