import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MyModelsPage } from '@/pages/MyModelsPage';
import { useAuthStore } from '@/stores/useAuthStore';
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

function renderMyModels() {
  return render(
    <MemoryRouter initialEntries={['/my-models']}>
      <Routes>
        <Route path="/my-models" element={<MyModelsPage />} />
        <Route path="/login" element={<div>LOGIN_ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({
    isAuthenticated: true,
    token: 'test-token',
    user: { id: 'u1', email: 'ada@studio.dev', name: 'Ada Lovelace' },
    error: null,
    isLoading: false,
  });
  useMyModelsStore.setState({ models: [], isLoading: false, error: null });
});

afterEach(() => {
  useAuthStore.setState({
    isAuthenticated: false,
    token: null,
    user: null,
    error: null,
    isLoading: false,
  });
});

describe('MyModelsPage', () => {
  it('redirects unauthenticated visitors to the login page', () => {
    useAuthStore.setState({ isAuthenticated: false, token: null, user: null });
    renderMyModels();

    expect(screen.getByText('LOGIN_ROUTE')).toBeInTheDocument();
    expect(screen.queryByTestId('my-models-grid')).toBeNull();
  });

  it('renders the uploaded models as Studio Noir cards with a real count', async () => {
    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeModel('m1', { name: 'Dragon' }),
      makeModel('m2', { name: 'Castle' }),
    ]);

    renderMyModels();

    const grid = await screen.findByTestId('my-models-grid');
    const links = within(grid).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/model/m1');
    expect(within(grid).getByText('Dragon')).toBeInTheDocument();
    expect(screen.getByTestId('my-models-count')).toHaveTextContent('2 models');
    expect(screen.getByTestId('my-models-upload')).toHaveAttribute(
      'href',
      '/upload',
    );
    expect(modelRepository.getMine).toHaveBeenCalledWith('test-token');
  });

  it('shows a skeleton while loading', () => {
    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );

    renderMyModels();

    expect(screen.getByTestId('my-models-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('my-models-grid')).toBeNull();
  });

  it('shows an empty state with an upload call to action', async () => {
    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderMyModels();

    expect(await screen.findByTestId('empty-my-models')).toBeInTheDocument();
    expect(screen.getByTestId('my-models-count')).toHaveTextContent('0 models');
    expect(
      within(screen.getByTestId('empty-my-models')).getByRole('link', {
        name: /upload model/i,
      }),
    ).toHaveAttribute('href', '/upload');
  });

  it('shows an error with retry that recovers', async () => {
    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('mine offline'),
    );

    renderMyModels();

    expect(await screen.findByTestId('my-models-error')).toHaveTextContent(
      'mine offline',
    );

    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeModel('m1', { name: 'Recovered' }),
    ]);
    fireEvent.click(screen.getByTestId('my-models-retry'));

    await waitFor(() =>
      expect(screen.queryByTestId('my-models-error')).toBeNull(),
    );
    expect(await screen.findByTestId('my-models-grid')).toBeInTheDocument();
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('has no WebGL canvas on the page', async () => {
    (modelRepository.getMine as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeModel('m1'),
    ]);

    const { container } = renderMyModels();
    await screen.findByTestId('my-models-grid');

    expect(container.querySelectorAll('canvas')).toHaveLength(0);
  });
});
