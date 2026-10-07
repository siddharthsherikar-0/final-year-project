import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/useAuthStore';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    mockFetch.mockReset();
  });

  it('starts unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('logs in successfully', async () => {
    const mockUser = { id: '1', email: 'test@test.com', name: 'Test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'jwt-token', user: mockUser }),
    });

    const success = await useAuthStore.getState().login('test@test.com', 'password');
    expect(success).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(localStorage.getItem('token')).toBe('jwt-token');
  });

  it('fails login with wrong credentials', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    });

    const success = await useAuthStore.getState().login('test@test.com', 'wrong');
    expect(success).toBe(false);
    expect(useAuthStore.getState().error).toBe('Invalid credentials');
  });

  it('registers successfully', async () => {
    const mockUser = { id: '1', email: 'test@test.com', name: 'Test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'jwt-token', user: mockUser }),
    });

    const success = await useAuthStore.getState().register('test@test.com', 'Test', 'password');
    expect(success).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('logs out', async () => {
    const mockUser = { id: '1', email: 'test@test.com', name: 'Test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'jwt-token', user: mockUser }),
    });

    await useAuthStore.getState().login('test@test.com', 'password');
    useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('restores the user together with the token on a fresh load', async () => {
    localStorage.setItem('token', 'jwt-token');
    localStorage.setItem(
      'user',
      JSON.stringify({ id: '1', email: 'test@test.com', name: 'Test' }),
    );

    vi.resetModules();
    const { useAuthStore: fresh } = await import('@/stores/useAuthStore');

    expect(fresh.getState().isAuthenticated).toBe(true);
    expect(fresh.getState().token).toBe('jwt-token');
    expect(fresh.getState().user).toEqual({
      id: '1',
      email: 'test@test.com',
      name: 'Test',
    });
  });

  it('ignores a corrupted stored user', async () => {
    localStorage.setItem('token', 'jwt-token');
    localStorage.setItem('user', 'not-json');

    vi.resetModules();
    const { useAuthStore: fresh } = await import('@/stores/useAuthStore');

    expect(fresh.getState().isAuthenticated).toBe(true);
    expect(fresh.getState().user).toBeNull();
  });
});
