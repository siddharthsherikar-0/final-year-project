import { useFilterStore } from '@/stores/useFilterStore';
import { FORMATS } from '@/config/categories';
import { Chip } from '@/components/ui/Chip';

/**
 * Secondary refinement panel.
 *
 * Category filtering lives in CategoryNav (the deep-linkable discovery nav),
 * so this panel only refines what that control cannot: file format. Keeping a
 * second copy of the category chips here made the two systems look equivalent
 * and gave visitors no clue which one was primary.
 */
export function FilterPanel() {
  const selectedCategories = useFilterStore((s) => s.selectedCategories);
  const selectedFormats = useFilterStore((s) => s.selectedFormats);
  const toggleFormat = useFilterStore((s) => s.toggleFormat);
  const reset = useFilterStore((s) => s.reset);

  const hasActiveFilters =
    selectedCategories.length > 0 || selectedFormats.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          Format
        </span>
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Format filters"
        >
          {FORMATS.map((fmt) => {
            const selected = selectedFormats.includes(fmt.value);
            return (
              <Chip
                key={fmt.value}
                selected={selected}
                onClick={() => toggleFormat(fmt.value)}
                aria-pressed={selected}
              >
                {fmt.label}
              </Chip>
            );
          })}
        </div>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={reset}
          className="rounded-sm text-xs font-medium text-ink-muted underline decoration-line underline-offset-4 transition-colors duration-fast hover:text-ink focus-ring"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}