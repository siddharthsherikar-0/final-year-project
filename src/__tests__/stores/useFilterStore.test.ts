import { describe, it, expect, beforeEach } from 'vitest';
import { useFilterStore } from '@/stores/useFilterStore';

describe('useFilterStore', () => {
  beforeEach(() => {
    useFilterStore.getState().reset();
  });

  it('starts with empty state', () => {
    const state = useFilterStore.getState();
    expect(state.searchQuery).toBe('');
    expect(state.selectedCategories).toEqual([]);
    expect(state.selectedFormats).toEqual([]);
  });

  it('sets search query', () => {
    useFilterStore.getState().setSearchQuery('duck');
    expect(useFilterStore.getState().searchQuery).toBe('duck');
  });

  it('toggles category on and off', () => {
    const store = useFilterStore.getState();
    store.toggleCategory('characters');
    expect(useFilterStore.getState().selectedCategories).toContain('characters');

    useFilterStore.getState().toggleCategory('characters');
    expect(useFilterStore.getState().selectedCategories).not.toContain('characters');
  });

  it('toggles format on and off', () => {
    const store = useFilterStore.getState();
    store.toggleFormat('glb');
    expect(useFilterStore.getState().selectedFormats).toContain('glb');

    useFilterStore.getState().toggleFormat('glb');
    expect(useFilterStore.getState().selectedFormats).not.toContain('glb');
  });

  it('resets all filters', () => {
    const store = useFilterStore.getState();
    store.setSearchQuery('test');
    store.toggleCategory('characters');
    store.toggleFormat('glb');

    useFilterStore.getState().reset();

    const state = useFilterStore.getState();
    expect(state.searchQuery).toBe('');
    expect(state.selectedCategories).toEqual([]);
    expect(state.selectedFormats).toEqual([]);
  });
});
