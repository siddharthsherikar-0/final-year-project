import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { DashboardPage } from '@/pages/DashboardPage';
import { useAuthStore } from '@/stores/useAuthStore';
import { useModelStore } from '@/stores/useModelStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';
import { useMyModelsStore } from '@/stores/useMyModelsStore';
import { modelRepository } from '@/data/modelRepository';
import { makeModel } from '../helpers/modelFixtures';

vi.mock('@/data/modelRepository', () => ({
  modelRepository: {
    getAll: vi.fn(),
    getById: vi.fn(),
    filter: vi.fn(),
    getMine: vi.fn(),
  },
}));

const fetchMock = vi.fn();

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/login" element={<div>LOGIN_ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchMock.mockResolvedValue(jsonResponse([]));
  vi.stubGlobal('fetch', fetchMock);
  useAuthStore.setState({
    isAuthenticated: true,
    token: 'test-token',
    user: { id: 'u1', email: 'ada@studio.dev', name: 'Ada Lovelace' },
    error: null,
    isLoading: false,
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
  });
});

describe('DashboardPage', () => {
  it('redirects unauthenticated visitors to the login page', () => {
    useAuthStore.setState({ isAuthenticated: false, token: null, user: null });
    renderDashboard();

    expect(screen.getByText('LOGIN_ROUTE')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-profile')).toBeNull();
  });

  it('redirects legacy token-only sessions to login instead of rendering blank', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      token: 'legacy-token',
      user: null,
    });
    renderDashboard();

    expect(screen.getByText('LOGIN_ROUTE')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-profile')).toBeNull();
    expect(screen.queryByTestId('dashboard-skeleton')).toBeNull();
    expect(screen.queryByTestId('dashboard-error')).toBeNull();
  });

  it('shows the authenticated identity and real counts from the data layer', async () => {
    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeModel('m1', { name: 'Dragon', createdAt: '2024-03-01T00:00:00Z' }),
      makeModel('m2', { name: 'Castle', createdAt: '2024-03-02T00:00:00Z' }),
    ]);
    const gallery = [
      makeModel('m1'),
      makeModel('m2'),
      makeModel('m3'),
      makeModel('m4'),
    ];
    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(
      gallery,
    );
    fetchMock.mockResolvedValue(jsonResponse([gallery[2]]));

    renderDashboard();

    expect(await screen.findByTestId('dashboard-name')).toHaveTextContent(
      'Ada Lovelace',
    );
    expect(screen.getByTestId('dashboard-email')).toHaveTextContent(
      'ada@studio.dev',
    );
    expect(screen.getByTestId('dashboard-avatar')).toHaveTextContent('AL');
    expect(screen.getByTestId('stat-uploads-value')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-favorites-value')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-gallery-value')).toHaveTextContent('4');
    expect(modelRepository.getMine).toHaveBeenCalledWith('test-token');
  });

  it('renders recent uploads and favorites as real model cards', async () => {
    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeModel('m2', { name: 'Castle', createdAt: '2024-03-02T00:00:00Z' }),
      makeModel('m1', { name: 'Dragon', createdAt: '2024-03-01T00:00:00Z' }),
    ]);
    const gallery = [
      makeModel('m1', { name: 'Dragon' }),
      makeModel('m2', { name: 'Castle' }),
      makeModel('m3', { name: 'Robot' }),
    ];
    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(
      gallery,
    );
    fetchMock.mockResolvedValue(jsonResponse([gallery[0]]));

    renderDashboard();

    const recent = await screen.findByTestId('recent-grid');
    const recentLinks = within(recent).getAllByRole('link');
    expect(recentLinks).toHaveLength(2);
    expect(recentLinks[0]).toHaveAttribute('href', '/model/m2');
    expect(recentLinks[1]).toHaveAttribute('href', '/model/m1');

    const favorites = await screen.findByTestId('favorites-grid');
    const favLinks = within(favorites).getAllByRole('link');
    expect(favLinks).toHaveLength(1);
    expect(favLinks[0]).toHaveAttribute('href', '/model/m1');
  });

  it('limits both sections to four cards', async () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      makeModel(`m${i}`, { createdAt: `2024-03-0${i}T00:00:00Z` }),
    );
    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockResolvedValue(
      many,
    );
    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(
      many,
    );
    fetchMock.mockResolvedValue(jsonResponse(many.slice(0, 6)));

    renderDashboard();

    const recent = await screen.findByTestId('recent-grid');
    expect(within(recent).getAllByRole('link')).toHaveLength(4);
    const favorites = await screen.findByTestId('favorites-grid');
    expect(within(favorites).getAllByRole('link')).toHaveLength(4);
  });

  it('shows useful empty states for a user with no uploads or favorites', async () => {
    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByTestId('empty-uploads')).toBeInTheDocument();
    expect(screen.getByTestId('empty-favorites')).toBeInTheDocument();
    expect(screen.getByTestId('stat-uploads-value')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-favorites-value')).toHaveTextContent('0');
    expect(
      within(screen.getByTestId('empty-uploads')).getByRole('link', {
        name: /upload model/i,
      }),
    ).toHaveAttribute('href', '/upload');
  });

  it('links every quick action to its destination', async () => {
    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByTestId('quick-upload')).toHaveAttribute(
      'href',
      '/upload',
    );
    expect(screen.getByTestId('quick-gallery')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('quick-favorites')).toHaveAttribute(
      'href',
      '/favorites',
    );
    expect(
      within(screen.getByTestId('section-recent-uploads')).getByRole('link', {
        name: /view all/i,
      }),
    ).toHaveAttribute('href', '/my-models');
    expect(
      within(screen.getByTestId('section-favorites')).getByRole('link', {
        name: /view all/i,
      }),
    ).toHaveAttribute('href', '/favorites');
  });

  it('renders a skeleton while data is loading', () => {
    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );

    renderDashboard();

    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-profile')).toBeNull();
  });

  it('shows an error with retry that recovers the dashboard', async () => {
    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('mine offline'),
    );
    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-error')).toHaveTextContent(
      'mine offline',
    );

    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeModel('m1', { name: 'Recovered' }),
    ]);
    fireEvent.click(screen.getByTestId('dashboard-retry'));

    await waitFor(() =>
      expect(screen.queryByTestId('dashboard-error')).toBeNull(),
    );
    const recent = await screen.findByTestId('recent-grid');
    expect(within(recent).getByText('Recovered')).toBeInTheDocument();
  });

  it('has no WebGL canvas on the dashboard', async () => {
    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeModel('m1'),
    ]);
    (modelRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeModel('m1'),
    ]);
    fetchMock.mockResolvedValue(jsonResponse([]));

    const { container } = renderDashboard();
    await screen.findByTestId('recent-grid');

    expect(container.querySelectorAll('canvas')).toHaveLength(0);
  });
});
