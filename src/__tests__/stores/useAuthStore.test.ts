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
      isHydratingUser: false,
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
    expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
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
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(localStorage.getItem('token')).toBe('jwt-token');
    expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
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

  it('ignores a stored user with an invalid shape', async () => {
    localStorage.setItem('token', 'jwt-token');
    localStorage.setItem('user', JSON.stringify({ foo: 'bar' }));

    vi.resetModules();
    const { useAuthStore: fresh } = await import('@/stores/useAuthStore');

    expect(fresh.getState().isAuthenticated).toBe(true);
    expect(fresh.getState().user).toBeNull();
  });
});

describe('useAuthStore.restoreUser (session hydration)', () => {
  const hydratedUser = { id: 'u9', email: 'legacy@studio.dev', name: 'Legacy Session' };

  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isHydratingUser: false,
      error: null,
    });
    mockFetch.mockReset();
  });

  function mockMeResponse(user: unknown, status = 200) {
    mockFetch.mockResolvedValueOnce({
      ok: status === 200,
      status,
      json: async () => user,
    });
  }

  it('hydrates a token-only session from /auth/me and persists the user', async () => {
    localStorage.setItem('token', 'jwt-token');
    useAuthStore.setState({
      token: 'jwt-token',
      isAuthenticated: true,
      user: null,
    });
    mockMeResponse(hydratedUser);

    await useAuthStore.getState().restoreUser();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/auth/me');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer jwt-token',
    );
    expect(useAuthStore.getState().user).toEqual(hydratedUser);
    expect(localStorage.getItem('user')).toBe(JSON.stringify(hydratedUser));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().isHydratingUser).toBe(false);
  });

  it('does not call /auth/me when a valid cached user already exists', async () => {
    localStorage.setItem('token', 'jwt-token');
    localStorage.setItem('user', JSON.stringify(hydratedUser));
    useAuthStore.setState({
      token: 'jwt-token',
      isAuthenticated: true,
      user: hydratedUser,
    });

    await useAuthStore.getState().restoreUser();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(hydratedUser);
  });

  it('hydrates from /auth/me when the cached user metadata is corrupt', async () => {
    localStorage.setItem('token', 'jwt-token');
    localStorage.setItem('user', 'not-json');

    vi.resetModules();
    const { useAuthStore: fresh } = await import('@/stores/useAuthStore');
    expect(fresh.getState().isAuthenticated).toBe(true);
    expect(fresh.getState().user).toBeNull();

    mockMeResponse(hydratedUser);
    await fresh.getState().restoreUser();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(fresh.getState().user).toEqual(hydratedUser);
    expect(localStorage.getItem('user')).toBe(JSON.stringify(hydratedUser));
    expect(fresh.getState().isAuthenticated).toBe(true);
  });

  it('clears the entire session when /auth/me returns 401', async () => {
    localStorage.setItem('token', 'expired-token');
    useAuthStore.setState({
      token: 'expired-token',
      isAuthenticated: true,
      user: null,
    });
    mockMeResponse({ error: 'Unauthorized' }, 401);

    await useAuthStore.getState().restoreUser();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isHydratingUser).toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('issues a single /auth/me request for concurrent restore calls', async () => {
    useAuthStore.setState({
      token: 'jwt-token',
      isAuthenticated: true,
      user: null,
    });
    mockMeResponse(hydratedUser);

    const first = useAuthStore.getState().restoreUser();
    const second = useAuthStore.getState().restoreUser();
    await Promise.all([first, second]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toEqual(hydratedUser);
  });

  it('does nothing when there is no token', async () => {
    await useAuthStore.getState().restoreUser();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isHydratingUser).toBe(false);
  });
});
