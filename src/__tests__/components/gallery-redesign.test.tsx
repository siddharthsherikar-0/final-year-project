import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModelGallery } from '@/components/gallery/ModelGallery';
import { ModelCard } from '@/components/gallery/ModelCard';
import { ModelMedia } from '@/components/gallery/ModelMedia';
import { SortControls } from '@/components/search/SortControls';
import { FilterPanel } from '@/components/search/FilterPanel';
import { useFilterStore } from '@/stores/useFilterStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';
import type { ModelMetadata } from '@/types';

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

afterEach(() => {
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
  useFavoriteStore.setState({
    favoriteIds: new Set<string>(),
    isLoading: false,
    error: null,
  });
});

describe('SortControls', () => {
  it('offers all sort options', () => {
    render(
      <MemoryRouter>
        <SortControls />
      </MemoryRouter>,
    );
    const select = screen.getByLabelText(/sort/i);
    expect(within(select).getAllByRole('option')).toHaveLength(6);
  });

  it('writes the selected sort into the filter store', () => {
    render(
      <MemoryRouter>
        <SortControls />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText(/sort/i), {
      target: { value: 'date-desc' },
    });
    const state = useFilterStore.getState();
    expect(state.sortBy).toBe('date');
    expect(state.sortOrder).toBe('desc');
  });
});

describe('ModelGallery sorting', () => {
  const models = [
    makeModel('alpha', {
      name: 'Alpha',
      fileSize: 3000,
      createdAt: '2024-01-01T00:00:00Z',
    }),
    makeModel('zeta', {
      name: 'Zeta',
      fileSize: 100,
      createdAt: '2024-06-01T00:00:00Z',
    }),
    makeModel('mid', {
      name: 'Mid',
      fileSize: 2000,
      createdAt: '2024-03-01T00:00:00Z',
    }),
  ];

  const renderedNames = () =>
    screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent?.trim());

  it('sorts by name ascending by default', () => {
    render(
      <MemoryRouter>
        <ModelGallery models={models} isLoading={false} />
      </MemoryRouter>,
    );
    expect(renderedNames()).toEqual(['Alpha', 'Mid', 'Zeta']);
  });

  it('sorts newest first when date-desc is selected', () => {
    useFilterStore.setState({ sortBy: 'date', sortOrder: 'desc' });
    render(
      <MemoryRouter>
        <ModelGallery models={models} isLoading={false} />
      </MemoryRouter>,
    );
    expect(renderedNames()).toEqual(['Zeta', 'Mid', 'Alpha']);
  });

  it('sorts largest first when size-desc is selected', () => {
    useFilterStore.setState({ sortBy: 'size', sortOrder: 'desc' });
    render(
      <MemoryRouter>
        <ModelGallery models={models} isLoading={false} />
      </MemoryRouter>,
    );
    expect(renderedNames()).toEqual(['Alpha', 'Mid', 'Zeta']);
  });

  it('sorts name descending when name-desc is selected', () => {
    useFilterStore.setState({ sortBy: 'name', sortOrder: 'desc' });
    render(
      <MemoryRouter>
        <ModelGallery models={models} isLoading={false} />
      </MemoryRouter>,
    );
    expect(renderedNames()).toEqual(['Zeta', 'Mid', 'Alpha']);
  });
});

describe('ModelMedia', () => {
  it('falls back to the category tile when no thumbnail exists', () => {
    const { container } = render(
      <ModelMedia category="characters" format="glb" />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Characters')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders the thumbnail when available', () => {
    const { container } = render(
      <ModelMedia
        thumbnailUrl="/uploads/thumb.png"
        category="nature"
        format="gltf"
      />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', '/uploads/thumb.png');
  });

  it('switches to the fallback when the thumbnail fails to load', () => {
    const { container } = render(
      <ModelMedia
        thumbnailUrl="/models/missing-thumb.png"
        category="vehicles"
        format="glb"
      />,
    );
    expect(container.querySelector('img')).not.toBeNull();
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Vehicles')).toBeInTheDocument();
  });
});

describe('FilterPanel chips', () => {
  it('exposes pressed state and toggles it', () => {
    render(
      <MemoryRouter>
        <FilterPanel />
      </MemoryRouter>,
    );
    const chip = screen.getByRole('button', { name: 'Architecture' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(useFilterStore.getState().selectedCategories).toContain(
      'architecture',
    );
  });
});

describe('ModelCard favorites', () => {
  it('shows the favorite control when signed in', () => {
    useAuthStore.setState({ isAuthenticated: true, token: 't' });
    useFavoriteStore.setState({ favoriteIds: new Set(['test-1']) });
    render(
      <MemoryRouter>
        <ModelCard model={makeModel('test-1', { name: 'Fav Model' })} />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('button', { name: /remove from favorites/i }),
    ).toBeInTheDocument();
  });

  it('keeps the card unauthenticated-friendly (no favorite control)', () => {
    render(
      <MemoryRouter>
        <ModelCard model={makeModel('test-2', { name: 'Plain Model' })} />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole('button', { name: /favorites/i }),
    ).not.toBeInTheDocument();
  });
});
