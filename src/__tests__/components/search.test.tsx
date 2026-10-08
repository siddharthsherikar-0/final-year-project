import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchBar } from '@/components/search/SearchBar';
import { FilterPanel } from '@/components/search/FilterPanel';
import { useModelStore } from '@/stores/useModelStore';
import { useFilterStore } from '@/stores/useFilterStore';

vi.mock('@/data/modelRepository', () => ({
  modelRepository: {
    getAll: vi.fn(),
    getById: vi.fn(),
filter: vi.fn(),
  },
}));

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
  // Stage 7 consolidated category filtering into CategoryNav (the deep-linkable
  // discovery navigation). The panel keeps only the refinement it owns, so the
  // two controls no longer look like equivalent systems.
  it('refines by format instead of duplicating the category controls', () => {
    render(
      <MemoryRouter>
        <FilterPanel />
      </MemoryRouter>,
    );

    expect(screen.getByText('GLB')).toBeInTheDocument();
    expect(screen.getByText('GLTF')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Format filters' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Category filters' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Architecture' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Characters' })).toBeNull();
  });

  it('toggles a real format filter through the store', () => {
    render(
      <MemoryRouter>
        <FilterPanel />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'GLTF' }));
    expect(useFilterStore.getState().selectedFormats).toContain('gltf');
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

it('offers no per-category counts, because those live in the discovery nav', () => {
    render(
      <MemoryRouter>
        <FilterPanel />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: /Architecture/ })).toBeNull();
  });
});





