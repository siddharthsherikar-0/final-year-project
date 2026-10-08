import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Layout } from '@/components/layout/Layout';
import { MyModelsPage } from '@/pages/MyModelsPage';
import { UploadPage } from '@/pages/UploadPage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { useAuthStore } from '@/stores/useAuthStore';
import { useModelStore } from '@/stores/useModelStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';
import { useMyModelsStore } from '@/stores/useMyModelsStore';
import { modelRepository } from '@/data/modelRepository';

vi.mock('@/data/modelRepository', () => ({
  modelRepository: {
    getAll: vi.fn(),
    getById: vi.fn(),
    filter: vi.fn(),
    getMine: vi.fn(),
  },
}));

vi.mock('@/components/viewer/ModelViewer', () => ({
  ModelViewer: ({ modelUrl, modelName }: { modelUrl: string; modelName?: string }) => (
    <div data-testid="model-viewer" data-url={modelUrl}>
      {modelName}
    </div>
  ),
}));

const fetchMock = vi.fn();

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function meCalls(): unknown[][] {
  return fetchMock.mock.calls.filter((c) => String(c[0]).includes('/auth/me'));
}

function loginMarker() {
  return <div>LOGIN_ROUTE</div>;
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchMock.mockResolvedValue(jsonResponse([]));
  vi.stubGlobal('fetch', fetchMock);
  useAuthStore.setState({
    isAuthenticated: true,
    token: 'legacy-token',
    user: null,
    error: null,
    isLoading: false,
    isHydratingUser: false,
  });
  useModelStore.setState({ models: [], isLoading: false, error: null });
  useFavoriteStore.setState({
    favoriteIds: new Set<string>(),
    isLoading: false,
    error: null,
  });
  useMyModelsStore.setState({ models: [], isLoading: false, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({
    isAuthenticated: false,
    token: null,
    user: null,
    error: null,
    isLoading: false,
    isHydratingUser: false,
  });
});

describe('auth synchronization across protected surfaces (token-only session)', () => {
  it('Header stays on the shared token session and picks up the hydrated user', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('navigation', { name: 'Main navigation' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Dashboard' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
    expect(meCalls()).toHaveLength(0);

    useAuthStore.setState({
      user: { id: 'u9', email: 'legacy@studio.dev', name: 'Legacy Session' },
    });
    rerender(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('Legacy Session').length).toBeGreaterThan(0);
    expect(meCalls()).toHaveLength(0);
  });

  it('My Models works on the token session without user metadata or /me', async () => {
    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/my-models']}>
        <Routes>
          <Route path="/my-models" element={<MyModelsPage />} />
          <Route path="/login" element={loginMarker()} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('empty-my-models')).toBeInTheDocument();
    expect(screen.getByTestId('my-models-count')).toHaveTextContent('0 models');
    expect(screen.queryByText('LOGIN_ROUTE')).toBeNull();
    expect(meCalls()).toHaveLength(0);
  });

  it('Upload works on the token session without user metadata or /me', () => {
    render(
      <MemoryRouter initialEntries={['/upload']}>
        <Routes>
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/login" element={loginMarker()} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument();
    expect(screen.queryByText('LOGIN_ROUTE')).toBeNull();
    expect(meCalls()).toHaveLength(0);
  });

  it('Favorites works on the token session without user metadata or /me', async () => {
    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/favorites']}>
        <Routes>
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/login" element={loginMarker()} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'My Favorites' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You haven't favorited any models yet."),
    ).toBeInTheDocument();
    expect(screen.queryByText('LOGIN_ROUTE')).toBeNull();
    expect(meCalls()).toHaveLength(0);
  });

  it('Layout hydrates the shared session once so the Header shows the same user', async () => {
    const hydrated = { id: 'u9', email: 'legacy@studio.dev', name: 'Legacy Session' };
    fetchMock.mockImplementation((url: unknown) =>
      String(url).includes('/auth/me')
        ? Promise.resolve(jsonResponse(hydrated))
        : Promise.resolve(jsonResponse([])),
    );

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<div>HOME_ROUTE</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Legacy Session')).toBeInTheDocument();
    expect(screen.getByText('HOME_ROUTE')).toBeInTheDocument();
    expect(meCalls()).toHaveLength(1);
    expect(useAuthStore.getState().user).toEqual(hydrated);
    expect(localStorage.getItem('user')).toBe(JSON.stringify(hydrated));
  });
});
