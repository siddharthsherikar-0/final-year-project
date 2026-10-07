import { create } from 'zustand';
import type { ModelMetadata } from '@/types';
import { modelRepository } from '@/data/modelRepository';
import { useAuthStore } from './useAuthStore';

interface MyModelsState {
  models: ModelMetadata[];
  isLoading: boolean;
  error: string | null;
  fetchMyModels: () => Promise<void>;
  clearError: () => void;
}

export const useMyModelsStore = create<MyModelsState>((set) => ({
  models: [],
  isLoading: false,
  error: null,

  fetchMyModels: async () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ models: [], isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const models = await modelRepository.getMine(token);
      set({ models, isLoading: false });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : 'Failed to fetch your models',
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
