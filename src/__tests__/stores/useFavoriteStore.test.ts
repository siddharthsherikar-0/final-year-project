import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFavoriteStore } from '@/stores/useFavoriteStore';
import { useAuthStore } from '@/stores/useAuthStore';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useFavoriteStore', () => {
  beforeEach(() => {
    localStorage.clear();
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
    mockFetch.mockReset();
  });

  it('starts with empty favorites', () => {
    const state = useFavoriteStore.getState();
    expect(state.favoriteIds.size).toBe(0);
  });

  it('fetches favorites', async () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    const mockModels = [{ id: 'model-1' }, { id: 'model-2' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockModels,
    });

    await useFavoriteStore.getState().fetchFavorites();
    expect(useFavoriteStore.getState().favoriteIds.has('model-1')).toBe(true);
    expect(useFavoriteStore.getState().favoriteIds.has('model-2')).toBe(true);
  });

  it('adds a favorite', async () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'fav-1' }),
    });

    await useFavoriteStore.getState().addFavorite('model-1');
    expect(useFavoriteStore.getState().favoriteIds.has('model-1')).toBe(true);
  });

  it('removes a favorite', async () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useFavoriteStore.setState({
      favoriteIds: new Set(['model-1']),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await useFavoriteStore.getState().removeFavorite('model-1');
    expect(useFavoriteStore.getState().favoriteIds.has('model-1')).toBe(false);
  });

  it('toggles favorite on', async () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'fav-1' }),
    });

    await useFavoriteStore.getState().toggleFavorite('model-1');
    expect(useFavoriteStore.getState().favoriteIds.has('model-1')).toBe(true);
  });

  it('toggles favorite off', async () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useFavoriteStore.setState({
      favoriteIds: new Set(['model-1']),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await useFavoriteStore.getState().toggleFavorite('model-1');
    expect(useFavoriteStore.getState().favoriteIds.has('model-1')).toBe(false);
  });

  it('checks if model is favorited', () => {
    useFavoriteStore.setState({
      favoriteIds: new Set(['model-1']),
    });
    expect(useFavoriteStore.getState().isFavorited('model-1')).toBe(true);
    expect(useFavoriteStore.getState().isFavorited('model-2')).toBe(false);
  });
});
