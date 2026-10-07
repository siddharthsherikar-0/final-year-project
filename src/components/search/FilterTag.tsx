import { useFilterStore } from '@/stores/useFilterStore';

export function FilterTag() {
  const selectedCategories = useFilterStore((s) => s.selectedCategories);
  const selectedFormats = useFilterStore((s) => s.selectedFormats);
  const toggleCategory = useFilterStore((s) => s.toggleCategory);
  const toggleFormat = useFilterStore((s) => s.toggleFormat);

  const tags: { label: string; onRemove: () => void }[] = [
    ...selectedCategories.map((c) => ({
      label: c,
      onRemove: () => toggleCategory(c),
    })),
    ...selectedFormats.map((f) => ({
      label: f.toUpperCase(),
      onRemove: () => toggleFormat(f),
    })),
  ];

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag.label}
          className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
        >
          {tag.label}
          <button
            onClick={tag.onRemove}
            className="ml-0.5 text-blue-600 hover:text-blue-800"
          >
            &times;
          </button>
        </span>
      ))}
    </div>
  );
}
