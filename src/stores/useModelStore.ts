import { create } from 'zustand';
import type { ModelMetadata } from '@/types';
import { modelRepository } from '@/data/modelRepository';

interface ModelState {
  models: ModelMetadata[];
  selectedModel: ModelMetadata | null;
  isLoading: boolean;
  error: string | null;
  fetchModels: () => Promise<void>;
  selectModel: (model: ModelMetadata | null) => void;
  clearError: () => void;
}

export const useModelStore = create<ModelState>((set) => ({
  models: [],
  selectedModel: null,
  isLoading: false,
  error: null,

  fetchModels: async () => {
    set({ isLoading: true, error: null });
    try {
      const models = await modelRepository.getAll();
      set({ models, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch models',
        isLoading: false,
      });
    }
  },

  selectModel: (model) => {
    set({ selectedModel: model });
  },

  clearError: () => {
    set({ error: null });
  },
}));
