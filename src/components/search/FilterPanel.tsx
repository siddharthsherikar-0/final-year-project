import { useFilterStore } from '@/stores/useFilterStore';
import { useModelStore } from '@/stores/useModelStore';
import { CATEGORIES, FORMATS } from '@/config/categories';

const chipBase =
  'rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

const chipSelected = 'border-accent bg-accent text-white hover:bg-accent-hover';
const chipIdle =
  'border-line bg-elevated text-ink-muted hover:border-ink-faint hover:text-ink';

export function FilterPanel() {
  const selectedCategories = useFilterStore((s) => s.selectedCategories);
  const selectedFormats = useFilterStore((s) => s.selectedFormats);
  const toggleCategory = useFilterStore((s) => s.toggleCategory);
  const toggleFormat = useFilterStore((s) => s.toggleFormat);
  const reset = useFilterStore((s) => s.reset);
  const models = useModelStore((s) => s.models);

  const hasActiveFilters =
    selectedCategories.length > 0 || selectedFormats.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Category
        </h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Category filters">
          {CATEGORIES.map((cat) => {
            const selected = selectedCategories.includes(cat.value);
            const count = models.filter((m) => m.category === cat.value).length;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => toggleCategory(cat.value)}
                aria-pressed={selected}
                className={`${chipBase} ${selected ? chipSelected : chipIdle}`}
              >
                <span>{cat.label}</span>
                {models.length > 0 && (
                  <span aria-hidden="true" className="ml-1 tabular-nums opacity-70">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Format
        </h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Format filters">
          {FORMATS.map((fmt) => {
            const selected = selectedFormats.includes(fmt.value);
            return (
              <button
                key={fmt.value}
                type="button"
                onClick={() => toggleFormat(fmt.value)}
                aria-pressed={selected}
                className={`${chipBase} ${selected ? chipSelected : chipIdle}`}
              >
                {fmt.label}
              </button>
            );
          })}
        </div>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={reset}
          className="text-xs font-medium text-danger transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
