import { describe, it, expect, beforeEach, vi } from 'vitest';

async function freshStore() {
  vi.resetModules();
  return import('@/stores/useRecentStore');
}

describe('useRecentStore', () => {
  beforeEach(() => window.localStorage.clear());

  it('records views most-recent-first and dedupes repeats', async () => {
    const { useRecentStore } = await freshStore();
    const { recordView } = useRecentStore.getState();
    recordView('a');
    recordView('b');
    recordView('a');
    expect(useRecentStore.getState().ids).toEqual(['a', 'b']);
    expect(JSON.parse(window.localStorage.getItem('recentlyViewed')!)).toEqual([
      'a',
      'b',
    ]);
  });

  it('caps history at 6 entries', async () => {
    const { useRecentStore } = await freshStore();
    const { recordView } = useRecentStore.getState();
    ['1', '2', '3', '4', '5', '6', '7'].forEach(recordView);
    const { ids } = useRecentStore.getState();
    expect(ids).toHaveLength(6);
    expect(ids[0]).toBe('7');
    expect(ids[5]).toBe('2');
  });

  it('persists across reloads', async () => {
    const first = await freshStore();
    first.useRecentStore.getState().recordView('x');
    const second = await freshStore();
    expect(second.useRecentStore.getState().ids).toEqual(['x']);
  });

  it('treats corrupt storage as empty', async () => {
    window.localStorage.setItem('recentlyViewed', '{not json');
    const { useRecentStore } = await freshStore();
    expect(useRecentStore.getState().ids).toEqual([]);
  });
});
