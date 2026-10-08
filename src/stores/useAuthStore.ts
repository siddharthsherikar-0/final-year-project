import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydratingUser: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, name: string, password: string) => Promise<boolean>;
  logout: () => void;
  restoreUser: () => Promise<void>;
  clearError: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<User> | null;
    if (
      !parsed ||
      typeof parsed.id !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.name !== 'string'
    ) {
      return null;
    }
    return parsed as User;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: readStoredUser(),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  isHydratingUser: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error ?? 'Login failed', isLoading: false });
        return false;
      }
      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
      return true;
    } catch {
      set({ error: 'Network error', isLoading: false });
      return false;
    }
  },

  register: async (email, name, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error ?? 'Registration failed', isLoading: false });
        return false;
      }
      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
      return true;
    } catch {
      set({ error: 'Network error', isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydratingUser: false,
    });
  },

  restoreUser: async () => {
    const { token, user, isHydratingUser } = get();
    if (!token || user || isHydratingUser) return;
    set({ isHydratingUser: true });
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (get().token !== token) return;
      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
          isHydratingUser: false,
        });
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (get().token !== token || get().user) return;
      if (
        data &&
        typeof data === 'object' &&
        typeof (data as User).id === 'string' &&
        typeof (data as User).email === 'string' &&
        typeof (data as User).name === 'string'
      ) {
        const hydrated = data as User;
        localStorage.setItem('user', JSON.stringify(hydrated));
        set({ user: hydrated, isHydratingUser: false });
      }
    } catch {
      // Network failure keeps the existing token session intact.
    } finally {
      set({ isHydratingUser: false });
    }
  },

  clearError: () => set({ error: null }),
}));
