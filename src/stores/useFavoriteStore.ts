import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';

interface FavoriteState {
  favoriteIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  fetchFavorites: () => Promise<void>;
  addFavorite: (modelId: string) => Promise<void>;
  removeFavorite: (modelId: string) => Promise<void>;
  toggleFavorite: (modelId: string) => Promise<void>;
  isFavorited: (modelId: string) => boolean;
  clearError: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  favoriteIds: new Set<string>(),
  isLoading: false,
  error: null,

  fetchFavorites: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch favorites');
      const models = (await res.json()) as { id: string }[];
      set({ favoriteIds: new Set(models.map((m) => m.id)), isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch favorites',
        isLoading: false,
      });
    }
  },

  addFavorite: async (modelId) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    set({ error: null });
    try {
      const res = await fetch(`${API_BASE}/favorites/${modelId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to add favorite');
      set((s) => ({
        favoriteIds: new Set([...s.favoriteIds, modelId]),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to add favorite' });
    }
  },

  removeFavorite: async (modelId) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    set({ error: null });
    try {
      const res = await fetch(`${API_BASE}/favorites/${modelId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to remove favorite');
      set((s) => {
        const next = new Set(s.favoriteIds);
        next.delete(modelId);
        return { favoriteIds: next };
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to remove favorite' });
    }
  },

  toggleFavorite: async (modelId) => {
    const { isFavorited, addFavorite, removeFavorite } = get();
    if (isFavorited(modelId)) {
      await removeFavorite(modelId);
    } else {
      await addFavorite(modelId);
    }
  },

  isFavorited: (modelId) => {
    return get().favoriteIds.has(modelId);
  },

  clearError: () => set({ error: null }),
}));
