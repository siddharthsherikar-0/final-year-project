import { create } from 'zustand';

const STORAGE_KEY = 'recentlyViewed';
export const MAX_RECENT = 6;

function readIds(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const entry of parsed) {
      if (typeof entry !== 'string' || entry.length === 0) continue;
      if (seen.has(entry)) continue;
      seen.add(entry);
      ids.push(entry);
    }
    return ids.slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage may be unavailable (private mode, quota) — history is best-effort.
  }
}

interface RecentState {
  ids: string[];
  recordView: (id: string) => void;
  clear: () => void;
}

export const useRecentStore = create<RecentState>((set, get) => ({
  ids: readIds(),

  recordView: (id) => {
    if (!id) return;
    const next = [id, ...get().ids.filter((existing) => existing !== id)].slice(
      0,
      MAX_RECENT,
    );
    if (
      next.length === get().ids.length &&
      next.every((value, index) => value === get().ids[index])
    ) {
      return;
    }
    set({ ids: next });
    writeIds(next);
  },

  clear: () => {
    set({ ids: [] });
    writeIds([]);
  },
}));
