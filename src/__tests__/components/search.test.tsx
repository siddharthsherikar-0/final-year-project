import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchBar } from '@/components/search/SearchBar';
import { FilterPanel } from '@/components/search/FilterPanel';
import { useModelStore } from '@/stores/useModelStore';
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

beforeEach(() => {
  useModelStore.setState({
    models: [],
    selectedModel: null,
    isLoading: false,
    error: null,
    settledId: null,
  });
});

describe('SearchBar', () => {
  it('renders search input', () => {
    render(
      <MemoryRouter>
        <SearchBar />
      </MemoryRouter>,
    );
    expect(screen.getByPlaceholderText(/search models/i)).toBeInTheDocument();
  });
});

describe('FilterPanel', () => {
  it('renders category filters', () => {
    render(
      <MemoryRouter>
        <FilterPanel />
      </MemoryRouter>,
    );
    expect(screen.getByText('Architecture')).toBeInTheDocument();
    expect(screen.getByText('Characters')).toBeInTheDocument();
  });

  it('renders format filters', () => {
    render(
      <MemoryRouter>
        <FilterPanel />
      </MemoryRouter>,
    );
    expect(screen.getByText('GLB')).toBeInTheDocument();
    expect(screen.getByText('GLTF')).toBeInTheDocument();
  });

  it('shows live category counts from the model store', () => {
    useModelStore.setState({
      models: [
        makeModel('m1', { category: 'architecture' }),
        makeModel('m2', { category: 'architecture' }),
        makeModel('m3', { category: 'sci-fi' }),
      ],
    });
    render(
      <MemoryRouter>
        <FilterPanel />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Architecture' })).toHaveTextContent(
      '2',
    );
    expect(screen.getByRole('button', { name: 'Sci-Fi' })).toHaveTextContent(
      '1',
    );
  });

  it('hides counts while the store is empty', () => {
    render(
      <MemoryRouter>
        <FilterPanel />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('button', { name: 'Architecture' }),
    ).not.toHaveTextContent(/^\d+$/);
  });
});
