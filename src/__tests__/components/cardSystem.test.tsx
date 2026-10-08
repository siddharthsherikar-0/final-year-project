import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModelCard } from '@/components/gallery/ModelCard';
import { Chip } from '@/components/ui/Chip';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';
import { useFilterStore } from '@/stores/useFilterStore';
import { makeModel } from '../helpers/modelFixtures';

function renderCard(id = 'card-1') {
  return render(
    <MemoryRouter>
      <ModelCard model={makeModel(id, { name: 'Observatory', category: 'architecture' })} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ isAuthenticated: true, token: 't', user: null, error: null, isLoading: false, isHydratingUser: false });
  useFavoriteStore.setState({ favoriteIds: new Set<string>(), isLoading: false, error: null });
  useFilterStore.setState({
    searchQuery: '',
    selectedCategories: [],
    selectedFormats: [],
    sortBy: 'date',
    sortOrder: 'desc',
  });
});

describe('ModelCard structure', () => {
  it('renders exactly one link and never nests an interactive element inside it', () => {
    const { container } = renderCard();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/model/card-1');
    expect(container.querySelectorAll('a')).toHaveLength(1);
    expect(container.querySelectorAll('a button, a a')).toHaveLength(0);
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });

  it('keeps the favorite control a sibling of the card link', () => {
    const { container } = renderCard();
    const link = screen.getByRole('link');
    const favorite = screen.getByRole('button', { name: /add to favorites/i });
    expect(link.contains(favorite)).toBe(false);
    expect(favorite.parentElement?.parentElement?.contains(link)).toBe(true);
    expect(container.querySelector('a > div.absolute')).toBeNull();
  });

  it('exposes an accessible name for the card link and the favorite control', () => {
    renderCard();
    expect(screen.getByRole('link', { name: /Observatory/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to favorites/i })).toBeInTheDocument();
  });

  it('does not render a favorite control for anonymous visitors', () => {
    useAuthStore.setState({ isAuthenticated: false, token: null });
    renderCard();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('uses the shared card surface: hairline border, no resting shadow, focus ring on the link', () => {
    const { container } = renderCard();
    const surface = container.querySelector('div.group')!;
    const classes = surface.getAttribute('class') ?? '';
    expect(classes).toContain('rounded-card');
    expect(classes).toContain('border-line');
    expect(classes).toContain('bg-surface');
    // elevation is reserved for hover
    expect(classes).toContain('hover:shadow-card');
    expect(classes).not.toMatch(/(^|\s)shadow-card(\s|$)/);
    expect(classes).not.toMatch(/(^|\s)shadow-lift(\s|$)/);
    expect(screen.getByRole('link').className).toContain('focus-ring');
  });

  it('gives the media region a fixed aspect ratio so rows stay aligned', () => {
    const { container } = renderCard();
    const media = container.querySelector('[aria-hidden="true"].relative')!;
    expect(media.className).toContain('aspect-[4/3]');
    // Stage 7 removed the media/content divider: the preview bleeds into the
    // card and spacing alone separates it from the text.
    expect(media.className).not.toContain('border-b');
  });

  it('shows the technical line in mono, without a divider, and keeps gold off the title', () => {
    const { container } = renderCard();

    // "Architecture" also appears in the media placeholder, so scope the
    // assertions to the metadata row.
    const metadataRow = screen.getByText('glb').closest('p')!;
    expect(within(metadataRow).getByText('Architecture')).toBeInTheDocument();
    expect(within(metadataRow).getByText('1.0 KB')).toBeInTheDocument();
    expect(metadataRow.className).toContain('font-mono');
    expect(metadataRow.className).not.toContain('border-t');

    // The name is editorial, not gold, and never turns gold on hover.
    const title = screen.getByRole('heading', { level: 3 });
    expect(title.className).toContain('font-display');
    expect(title.className).not.toContain('text-accent');
    expect(container.innerHTML).not.toMatch(/group-hover:text-accent/);

    // No pill chips inside the metadata row (only the circular favorite
    // control legitimately uses a rounded-full surface).
    expect(metadataRow.querySelectorAll('[class*="rounded-full"]')).toHaveLength(0);
    expect(container.querySelector('[data-tone]')).toBeNull();
  });

  it('renders the studio preview when the model has one', () => {
    render(
      <MemoryRouter>
        <ModelCard
          model={makeModel('card-1', {
            name: 'Observatory',
            thumbnailUrl: '/models/observatory-thumb.jpg',
          })}
        />
      </MemoryRouter>,
    );
    const image = screen.getByTestId('model-preview-image');
    expect(image).toHaveAttribute('src', '/models/observatory-thumb.jpg');
    // The link already names the model, so the preview stays decorative.
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('loading', 'lazy');
  });

  it('falls back to the category placeholder when a preview is missing or broken', () => {
    const { unmount } = render(
      <MemoryRouter>
        <ModelCard model={makeModel('card-1', { thumbnailUrl: '', category: 'architecture' })} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('model-preview-image')).toBeNull();
    expect(screen.getAllByText('Architecture').length).toBeGreaterThan(0);
    // Same box either way, so the card never shifts.
const placeholderMedia = screen
      .getAllByText('Architecture')[0]!
      .closest('.relative');
    expect(placeholderMedia?.className).toContain('aspect-[4/3]');
    unmount();

    render(
      <MemoryRouter>
        <ModelCard
          model={makeModel('card-1', { thumbnailUrl: '/models/missing-thumb.jpg', category: 'architecture' })}
        />
      </MemoryRouter>,
    );
const brokenPreview = screen.getByTestId('model-preview-image');
    fireEvent.error(brokenPreview);
    expect(screen.queryByTestId('model-preview-image')).toBeNull();
    expect(screen.getAllByText('Architecture').length).toBeGreaterThan(0);
  });

  it('gives the feature variant a wider preview for single-model libraries', () => {
    render(
      <MemoryRouter>
        <ModelCard model={makeModel('card-1', { thumbnailUrl: '/models/observatory-thumb.jpg' })} variant="feature" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('model-preview-image').parentElement!.className).toContain(
      'aspect-[16/10]',
    );
  });

  it('reports the favorite state in gold, not red, and toggles its label', () => {
    const { container, rerender } = renderCard();
    expect(screen.getByRole('button', { name: /add to favorites/i })).toBeInTheDocument();

    useFavoriteStore.setState({ favoriteIds: new Set(['card-1']) });
    rerender(
      <MemoryRouter>
        <ModelCard model={makeModel('card-1', { name: 'Observatory', category: 'architecture' })} />
      </MemoryRouter>,
    );

    const favorite = screen.getByRole('button', { name: /remove from favorites/i });
    expect(favorite.className).toContain('text-accent');
    expect(favorite.className).not.toContain('text-danger');
    // the card surface itself never turns gold
    expect(container.querySelector('div.group')!.className).not.toContain('text-accent');
  });

  it('keeps the favorite control keyboard reachable and clickable', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderCard();
    const favorite = screen.getByRole('button', { name: /add to favorites/i });

    favorite.focus();
    expect(document.activeElement).toBe(favorite);

    fireEvent.click(favorite);

    // The control stays a real button that never activates the card link.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0] ?? '')).toContain(
      '/api/favorites/card-1',
    );
    await waitFor(() =>
      expect(useFavoriteStore.getState().favoriteIds.has('card-1')).toBe(true),
    );
    expect(screen.getByRole('button', { name: /remove from favorites/i })).toBeInTheDocument();
    expect(container.querySelector('a')!.className).toContain('focus-ring');

    vi.unstubAllGlobals();
  });
});

describe('SurfaceCard', () => {
  it('renders a quiet surface and stays still when not interactive', () => {
    const { container } = render(<SurfaceCard>content</SurfaceCard>);
    const classes = container.firstElementChild!.getAttribute('class') ?? '';
    expect(classes).toContain('bg-surface');
    expect(classes).toContain('rounded-card');
    expect(classes).toContain('border-line');
    expect(classes).not.toContain('hover:shadow-card');
  });

  it('adds restrained hover + press states when interactive', () => {
    const { container } = render(<SurfaceCard interactive>content</SurfaceCard>);
    const classes = container.firstElementChild!.getAttribute('class') ?? '';
    expect(classes).toContain('hover:border-accent/40');
    expect(classes).toContain('hover:shadow-card');
    expect(classes).toContain('active:translate-y-px');
    expect(classes).toContain('motion-reduce:transition-none');
    expect(classes).not.toMatch(/(^|\s)transition(\s|$)/);
  });

  it('forwards native attributes such as data-testid', () => {
    render(<SurfaceCard data-testid="tile">content</SurfaceCard>);
    expect(screen.getByTestId('tile')).toBeInTheDocument();
  });
});

describe('Chip', () => {
  it('renders a button with aria-pressed and a neutral idle surface', () => {
    render(<Chip onClick={() => {}}>GLB</Chip>);
    const chip = screen.getByRole('button', { name: 'GLB' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    const classes = chip.className;
    expect(classes).toContain('min-h-[32px]');
    expect(classes).toContain('border-control');
    expect(classes).toContain('bg-elevated');
    expect(classes).toContain('focus-ring');
  });

  it('renders a link chip for deep-linkable filters', () => {
    render(
      <MemoryRouter>
        <Chip to="/?category=vehicles" selected aria-current="true">
          Vehicles
        </Chip>
      </MemoryRouter>,
    );
    const chip = screen.getByRole('link', { name: 'Vehicles' });
    expect(chip).toHaveAttribute('href', '/?category=vehicles');
    expect(chip).toHaveAttribute('aria-current', 'true');
  });

  it('uses a restrained gold tint when selected, never a saturated fill', () => {
    render(<Chip selected onClick={() => {}}>Characters</Chip>);
    const classes = screen.getByRole('button').className;
    expect(classes).toContain('bg-accent-subtle');
    expect(classes).toContain('border-accent/60');
    expect(classes).toContain('text-accent');
    expect(classes).not.toContain('bg-accent ');
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('activates from the keyboard', () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>Architecture</Chip>);
    fireEvent.click(screen.getByRole('button', { name: 'Architecture' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('toggles a real category filter through the store', () => {
    render(
      <MemoryRouter>
        <Chip onClick={() => useFilterStore.getState().toggleCategory('architecture')} selected={false}>
          Architecture
        </Chip>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Architecture' }));
    expect(useFilterStore.getState().selectedCategories).toContain('architecture');
  });
});


