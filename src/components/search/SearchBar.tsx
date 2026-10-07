import { useState, useEffect } from 'react';
import { useFilterStore } from '@/stores/useFilterStore';
import { useDebounce } from '@/hooks/useDebounce';
import { DEBOUNCE_DELAY_MS } from '@/config/constants';

export function SearchBar() {
  const [inputValue, setInputValue] = useState('');
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const debouncedValue = useDebounce(inputValue, DEBOUNCE_DELAY_MS);

  useEffect(() => {
    setSearchQuery(debouncedValue);
  }, [debouncedValue, setSearchQuery]);

  return (
    <div className="relative">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        aria-label="Search models"
        placeholder="Search models..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="w-full rounded-md border border-line bg-surface py-2 pl-10 pr-4 text-sm text-ink placeholder-ink-faint transition-colors duration-fast focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}
