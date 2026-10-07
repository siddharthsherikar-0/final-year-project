import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ModelDetailPage } from '@/pages/ModelDetailPage';
import { useModelStore } from '@/stores/useModelStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';
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

function renderDetail(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/model/${id}`]}>
      <Routes>
        <Route path="/model/:id" element={<ModelDetailPage />} />
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

afterEach(() => {
  Object.defineProperty(navigator, 'share', {
    value: undefined,
    configurable: true,
  });
});

describe('ModelDetailPage showcase', () => {
  it('renders the hero, CTAs, specs, and preview from real metadata', () => {
    const model = makeModel('m1', {
      name: 'Cyber Rig',
      description: 'A rigged character.',
      category: 'characters',
      format: 'glb',
      fileSize: 1024,
      vertexCount: 1234567,
      triangleCount: 234567,
      hasTextures: true,
      hasAnimations: true,
      tags: ['rigged'],
      author: 'Alice',
      license: 'CC-BY',
    });
    useModelStore.setState({ models: [model] });

    renderDetail('m1');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Cyber Rig',
    );
    expect(screen.getAllByText('Characters').length).toBeGreaterThan(0);
    expect(screen.getAllByText('GLB').length).toBeGreaterThan(0);
    expect(screen.getByText('A rigged character.')).toBeInTheDocument();

    const studioLink = screen.getByRole('link', { name: /open in studio/i });
    expect(studioLink).toHaveAttribute('href', '/viewer/m1');

    const downloadLink = screen.getByRole('link', { name: /download model/i });
    expect(downloadLink).toHaveAttribute('href', '/models/m1.glb');
    expect(downloadLink).toHaveAttribute('download');

    expect(
      screen.getByRole('button', { name: /^share$/i }),
    ).toBeInTheDocument();

    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
    expect(screen.getByText('234,567')).toBeInTheDocument();
    expect(screen.getAllByText('Alice').length).toBe(2);
    expect(screen.getAllByText('CC-BY').length).toBe(2);
    expect(screen.getByText('Included')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();

    expect(screen.getByTestId('model-viewer')).toHaveTextContent('Cyber Rig');
    expect(screen.getByRole('heading', { name: /specifications/i })).toBeInTheDocument();
    expect(modelRepository.getAll).not.toHaveBeenCalled();
  });

  it('omits vertices and triangles when the metadata is absent', () => {
    useModelStore.setState({ models: [makeModel('m1')] });

    renderDetail('m1');

    expect(screen.queryByText('Vertices')).not.toBeInTheDocument();
    expect(screen.queryByText('Triangles')).not.toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('shows same-category related models first and never the current model', () => {
    const current = makeModel('m1', { category: 'characters', name: 'Current' });
    const sameA = makeModel('m2', { category: 'characters', name: 'Same A' });
    const sameB = makeModel('m3', { category: 'characters', name: 'Same B' });
    const other = makeModel('m4', { category: 'vehicles', name: 'Other One' });
    const extra = makeModel('m5', { category: 'nature', name: 'Extra' });
    useModelStore.setState({ models: [current, sameA, sameB, other, extra] });

    renderDetail('m1');

    expect(screen.getByRole('heading', { name: /related models/i })).toBeInTheDocument();
    expect(screen.getByText('Same A')).toBeInTheDocument();
    expect(screen.getByText('Same B')).toBeInTheDocument();
    expect(screen.getByText('Other One')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Current' }),
    ).toBeInTheDocument();
    const cardTitles = screen
      .queryAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(cardTitles).toEqual(['Same A', 'Same B', 'Other One']);
    expect(screen.queryByText('Extra')).not.toBeInTheDocument();
  });

  it('hides the related section when the model is alone in the store', () => {
    useModelStore.setState({ models: [makeModel('m1')] });

    renderDetail('m1');

    expect(screen.queryByRole('heading', { name: /related models/i })).toBeNull();
  });

  it('shows a favorite control when authenticated and none when logged out', () => {
    useModelStore.setState({ models: [makeModel('m1')] });
    const { unmount } = renderDetail('m1');
    expect(screen.queryByRole('button', { name: 'Add to favorites' })).toBeNull();
    unmount();

    useAuthStore.setState({
      isAuthenticated: true,
      token: 'token',
      user: null,
    });
    renderDetail('m1');
    expect(
      screen.getByRole('button', { name: 'Add to favorites' }),
    ).toBeInTheDocument();
  });
});

describe('ModelDetailPage states', () => {
  it('loads from the repository when the store is empty and then renders', async () => {
    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeModel('m1', { name: 'Loaded' }),
    ]);

    renderDetail('m1');
    expect(screen.getByRole('status')).toBeInTheDocument();

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Loaded',
    );
    expect(modelRepository.getAll).toHaveBeenCalledTimes(1);
  });

  it('shows a deterministic not-found state for unknown ids', () => {
    useModelStore.setState({ models: [makeModel('other')] });

    renderDetail('missing-id');

    expect(screen.getByRole('heading', { name: /model not found/i })).toBeInTheDocument();
    const back = screen.getByRole('link', { name: /back to gallery/i });
    expect(back).toHaveAttribute('href', '/');
  });

  it('shows an error state and recovers via retry', async () => {
    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('network down'),
    );

    renderDetail('m1');
    expect(await screen.findByRole('heading', { name: /couldn't load/i })).toBeInTheDocument();
    expect(screen.getByText('network down')).toBeInTheDocument();

    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      makeModel('m1', { name: 'Recovered' }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Recovered',
    );
  });
});

describe('ModelDetailPage share', () => {
  beforeEach(() => {
    useModelStore.setState({ models: [makeModel('m1')] });
  });

  it('uses the Web Share API when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderDetail('m1');
    fireEvent.click(screen.getByRole('button', { name: /^share$/i }));

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ url: window.location.href }),
      ),
    );
    expect(writeText).not.toHaveBeenCalled();
  });

  it('does not fall back to the clipboard when the user aborts sharing', async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderDetail('m1');
    fireEvent.click(screen.getByRole('button', { name: /^share$/i }));

    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('falls back to copying the link when Web Share API is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderDetail('m1');
    fireEvent.click(screen.getByRole('button', { name: /^share$/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(window.location.href),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Link copied to clipboard',
    );
  });
});
