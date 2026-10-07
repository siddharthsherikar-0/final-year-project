import { create } from 'zustand';
import type { ModelCategory, ModelFormat } from '@/types';

interface FilterState {
  searchQuery: string;
  selectedCategories: ModelCategory[];
  selectedFormats: ModelFormat[];
  sortBy: 'name' | 'date' | 'size';
  sortOrder: 'asc' | 'desc';
  setSearchQuery: (query: string) => void;
  toggleCategory: (category: ModelCategory) => void;
  toggleFormat: (format: ModelFormat) => void;
  setSortBy: (sortBy: 'name' | 'date' | 'size') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  reset: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  searchQuery: '',
  selectedCategories: [],
  selectedFormats: [],
  sortBy: 'name',
  sortOrder: 'asc',

  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleCategory: (category) =>
    set((s) => ({
      selectedCategories: s.selectedCategories.includes(category)
        ? s.selectedCategories.filter((c) => c !== category)
        : [...s.selectedCategories, category],
    })),
  toggleFormat: (format) =>
    set((s) => ({
      selectedFormats: s.selectedFormats.includes(format)
        ? s.selectedFormats.filter((f) => f !== format)
        : [...s.selectedFormats, format],
    })),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (order) => set({ sortOrder: order }),
  reset: () =>
    set({
      searchQuery: '',
      selectedCategories: [],
      selectedFormats: [],
      sortBy: 'name',
      sortOrder: 'asc',
    }),
}));
