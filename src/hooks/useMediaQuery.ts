import { useEffect, useState } from 'react';

/**
 * Tracks a CSS media query in React state.
 *
 * The editor needs to know whether it is on a desktop layout at RENDER time -
 * not just at paint time - so it can decide which panels exist in the DOM. It
 * also means a window resize after mount is handled, because the listener
 * re-runs on every change.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);
    sync();
    list.addEventListener('change', sync);
    return () => list.removeEventListener('change', sync);
  }, [query]);

  return matches;
}

/** True at the `lg` breakpoint and above, where panels sit beside the viewport. */
export function useIsEditorDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}