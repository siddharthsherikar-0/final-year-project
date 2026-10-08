import { create } from 'zustand';
import type { ModelMetadata } from '@/types';
import { modelRepository } from '@/data/modelRepository';

interface ModelState {
  models: ModelMetadata[];
  selectedModel: ModelMetadata | null;
  isLoading: boolean;
  error: string | null;
  // Last model id whose catalog fetch has settled; lets pages distinguish
  // "still loading" from "settled and missing" without setState-in-effect.
  settledId: string | null;
  fetchModels: () => Promise<void>;
  selectModel: (model: ModelMetadata | null) => void;
  markSettled: (id: string) => void;
  clearError: () => void;
}

let fetchInFlight: Promise<void> | null = null;

export const useModelStore = create<ModelState>((set) => ({
  models: [],
  selectedModel: null,
  isLoading: false,
  error: null,
  settledId: null,

  fetchModels: async () => {
    // Deduplicate concurrent calls (e.g. multiple pages mounting at once);
    // sequential calls still refetch so data stays fresh.
    if (fetchInFlight) return fetchInFlight;
    const run = (async () => {
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
    })();
    fetchInFlight = run;
    try {
      await run;
    } finally {
      if (fetchInFlight === run) fetchInFlight = null;
    }
  },

  selectModel: (model) => {
    set({ selectedModel: model });
  },

  markSettled: (id) => {
    set({ settledId: id });
  },

  clearError: () => {
    set({ error: null });
  },
}));
