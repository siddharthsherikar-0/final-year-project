import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { useModelStore } from '@/stores/useModelStore';
import { useFilterStore } from '@/stores/useFilterStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { modelRepository } from '@/data/modelRepository';
import type { ModelMetadata } from '@/types';

vi.mock('@/data/modelRepository', () => ({
  modelRepository: {
    getAll: vi.fn(),
    getById: vi.fn(),
    filter: vi.fn(),
  },
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
  makeModel('m1', {
    name: 'Alpha House',
    category: 'architecture',
    createdAt: '2024-01-01T00:00:00Z',
    fileSize: 100,
  }),
  makeModel('m2', {
    name: 'Beta Villa',
    category: 'architecture',
    createdAt: '2024-02-01T00:00:00Z',
    fileSize: 200,
  }),
  makeModel('m3', {
    name: 'Gamma Mech',
    category: 'sci-fi',
    createdAt: '2024-03-01T00:00:00Z',
    fileSize: 300,
  }),
];

function renderHome(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function galleryElement() {
  return document.getElementById('gallery')!;
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
  window.localStorage.clear();
});

describe('HomePage category discovery', () => {
  it('renders category navigation links with deep-link URLs', async () => {
    renderHome();
    await screen.findByText('Model Gallery');
    const link = screen.getByRole('link', { name: 'Architecture, 2 models' });
    expect(link).toHaveAttribute('href', '/?category=architecture#gallery');
  });

  it('shows per-category model counts', async () => {
    renderHome();
    await screen.findByText('Model Gallery');
    expect(
      screen.getByRole('link', { name: 'Architecture, 2 models' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Sci-Fi, 1 model' }),
    ).toBeInTheDocument();
  });

  it('clicking a category link filters the gallery', async () => {
    renderHome();
    await screen.findByText('Model Gallery');
    fireEvent.click(screen.getByRole('link', { name: 'Architecture, 2 models' }));
    await waitFor(() =>
      expect(useFilterStore.getState().selectedCategories).toEqual([
        'architecture',
      ]),
    );
    const gallery = galleryElement();
    expect(within(gallery).getByText('Alpha House')).toBeInTheDocument();
    expect(within(gallery).getByText('Beta Villa')).toBeInTheDocument();
    expect(within(gallery).queryByText('Gamma Mech')).not.toBeInTheDocument();
  });

  it('applies a category from a deep link', async () => {
    renderHome(['/?category=sci-fi']);
    await screen.findByText('Model Gallery');
    await waitFor(() =>
      expect(useFilterStore.getState().selectedCategories).toEqual(['sci-fi']),
    );
    const gallery = galleryElement();
    expect(within(gallery).getByText('Gamma Mech')).toBeInTheDocument();
    expect(within(gallery).queryByText('Alpha House')).not.toBeInTheDocument();
  });

  it('supports multi-category deep links', async () => {
    renderHome(['/?category=architecture,sci-fi']);
    await screen.findByText('Model Gallery');
    await waitFor(() =>
      expect(useFilterStore.getState().selectedCategories).toEqual([
        'architecture',
        'sci-fi',
      ]),
    );
    const gallery = galleryElement();
    expect(within(gallery).getByText('Alpha House')).toBeInTheDocument();
    expect(within(gallery).getByText('Gamma Mech')).toBeInTheDocument();
  });

  it('combines search, category, and sort', async () => {
    renderHome();
    await screen.findByText('Model Gallery');
    useFilterStore.setState({ selectedCategories: ['architecture'] });
    useFilterStore.setState({ sortBy: 'date', sortOrder: 'desc' });
    fireEvent.change(screen.getByPlaceholderText(/search models/i), {
      target: { value: 'villa' },
    });
    await waitFor(() =>
      expect(useFilterStore.getState().searchQuery).toBe('villa'),
    );
    const gallery = galleryElement();
    expect(within(gallery).getByText('Beta Villa')).toBeInTheDocument();
    expect(within(gallery).queryByText('Alpha House')).not.toBeInTheDocument();
    expect(screen.getByTestId('gallery-count')).toHaveTextContent(
      'Showing 1 of 3 models',
    );
  });

  it('sorts by date descending within a category', async () => {
    renderHome();
    await screen.findByText('Model Gallery');
    useFilterStore.setState({
      selectedCategories: ['architecture'],
      sortBy: 'date',
      sortOrder: 'desc',
    });
    await waitFor(() => {
      const text = galleryElement().textContent ?? '';
      expect(text.indexOf('Beta Villa')).toBeGreaterThan(-1);
      expect(text.indexOf('Beta Villa')).toBeLessThan(
        text.indexOf('Alpha House'),
      );
    });
  });

  it('lets unauthenticated users browse discovery sections', async () => {
    renderHome();
    await screen.findByText('Model Gallery');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(
      screen.getByRole('link', { name: 'Architecture, 2 models' }),
    ).toBeInTheDocument();
    expect(within(galleryElement()).getByText('Alpha House')).toBeInTheDocument();
  });
});
