import { useFilterStore } from '@/stores/useFilterStore';
import type { ModelCategory, ModelFormat } from '@/types';

const CATEGORIES: { value: ModelCategory; label: string }[] = [
  { value: 'architecture', label: 'Architecture' },
  { value: 'characters', label: 'Characters' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'nature', label: 'Nature' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'other', label: 'Other' },
];

const FORMATS: { value: ModelFormat; label: string }[] = [
  { value: 'glb', label: 'GLB' },
  { value: 'gltf', label: 'GLTF' },
];

export function FilterPanel() {
  const selectedCategories = useFilterStore((s) => s.selectedCategories);
  const selectedFormats = useFilterStore((s) => s.selectedFormats);
  const toggleCategory = useFilterStore((s) => s.toggleCategory);
  const toggleFormat = useFilterStore((s) => s.toggleFormat);
  const reset = useFilterStore((s) => s.reset);

  const hasActiveFilters =
    selectedCategories.length > 0 || selectedFormats.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Category
        </h3>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => toggleCategory(cat.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedCategories.includes(cat.value)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Format
        </h3>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((fmt) => (
            <button
              key={fmt.value}
              onClick={() => toggleFormat(fmt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedFormats.includes(fmt.value)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {fmt.label}
            </button>
          ))}
        </div>
      </div>

      {hasActiveFilters && (
        <button
          onClick={reset}
          className="text-xs text-red-600 hover:text-red-700 hover:underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
