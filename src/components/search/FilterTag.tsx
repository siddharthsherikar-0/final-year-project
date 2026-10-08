import { useFilterStore } from '@/stores/useFilterStore';
import {
  CHIP_BASE_CLASS,
  CHIP_SELECTED_CLASS,
} from '@/components/ui/Chip';

export function FilterTag() {
  const selectedCategories = useFilterStore((s) => s.selectedCategories);
  const selectedFormats = useFilterStore((s) => s.selectedFormats);
  const toggleCategory = useFilterStore((s) => s.toggleCategory);
  const toggleFormat = useFilterStore((s) => s.toggleFormat);

  const tags: { label: string; onRemove: () => void }[] = [
    ...selectedCategories.map((c) => ({
      label: c.charAt(0).toUpperCase() + c.slice(1),
      onRemove: () => toggleCategory(c),
    })),
    ...selectedFormats.map((f) => ({
      label: f.toUpperCase(),
      onRemove: () => toggleFormat(f),
    })),
  ];

  if (tags.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Active filters"
    >
      {tags.map((tag) => (
        <span
          key={tag.label}
          className={`${CHIP_BASE_CLASS} ${CHIP_SELECTED_CLASS} pr-1`}
        >
          {tag.label}
          <button
            type="button"
            onClick={tag.onRemove}
            aria-label={`Remove ${tag.label} filter`}
            className="-mr-0.5 rounded-full px-1.5 py-0.5 text-xs leading-none text-accent transition-colors hover:bg-accent/20 hover:text-accent-hover focus-ring"
          >
            &times;
          </button>
        </span>
      ))}
    </div>
  );
}
