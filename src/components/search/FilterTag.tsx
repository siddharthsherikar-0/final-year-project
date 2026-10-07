import { useFilterStore } from '@/stores/useFilterStore';

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
          className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent-soft"
        >
          {tag.label}
          <button
            type="button"
            onClick={tag.onRemove}
            aria-label={`Remove ${tag.label} filter`}
            className="ml-0.5 rounded-full px-0.5 leading-none text-accent-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            &times;
          </button>
        </span>
      ))}
    </div>
  );
}
