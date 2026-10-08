import { useFilterStore } from '@/stores/useFilterStore';

type SortKey = `${'name' | 'date' | 'size'}-${'asc' | 'desc'}`;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'size-desc', label: 'Largest first' },
  { value: 'size-asc', label: 'Smallest first' },
];

export function SortControls() {
  const sortBy = useFilterStore((s) => s.sortBy);
  const sortOrder = useFilterStore((s) => s.sortOrder);
  const setSortBy = useFilterStore((s) => s.setSortBy);
  const setSortOrder = useFilterStore((s) => s.setSortOrder);

  const value: SortKey = `${sortBy}-${sortOrder}`;

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="gallery-sort"
        className="text-xs font-semibold uppercase tracking-wider text-ink-faint"
      >
        Sort
      </label>
      <select
        id="gallery-sort"
        value={value}
        onChange={(e) => {
          const [nextSortBy, nextSortOrder] = e.target.value.split('-') as [
            'name' | 'date' | 'size',
            'asc' | 'desc',
          ];
          setSortBy(nextSortBy);
          setSortOrder(nextSortOrder);
        }}
        className="rounded-md border border-control bg-surface px-3 py-1.5 text-sm text-ink transition-colors duration-fast focus-ring"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
