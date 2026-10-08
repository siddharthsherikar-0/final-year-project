import { useLocation } from 'react-router-dom';
import type { ModelCategory, ModelMetadata } from '@/types';
import { CATEGORIES } from '@/config/categories';
import { Chip } from '@/components/ui/Chip';

interface CategoryNavProps {
  models: ModelMetadata[];
}

function categoryCount(models: ModelMetadata[], value: ModelCategory): number {
  return models.filter((m) => m.category === value).length;
}

function parseSelected(param: string | null): ModelCategory[] {
  if (!param) return [];
  const known = new Set<string>(CATEGORIES.map((c) => c.value));
  return param
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is ModelCategory => known.has(value));
}

/**
 * Primary discovery navigation for the gallery.
 *
 * This is now the single category control. It reads and writes the URL, so it
 * stays deep-linkable and back/forward safe, and each chip toggles its category
 * inside the comma-separated `category` parameter - which preserves the
 * multi-select behaviour the filter panel used to duplicate.
 */
export function CategoryNav({ models }: CategoryNavProps) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const selected = parseSelected(params.get('category'));
  const hasModels = models.length > 0;

  const linkTo = (next: ModelCategory[]) => ({
    pathname: '/',
    search: next.length > 0 ? `?category=${next.join(',')}` : '',
    hash: '#gallery',
  });

  const toggle = (value: ModelCategory) =>
    linkTo(
      selected.includes(value)
        ? selected.filter((entry) => entry !== value)
        : [...selected, value],
    );

  return (
    <nav aria-label="Browse by category" className="flex flex-wrap items-center gap-2">
      <Chip
        to={linkTo([])}
        selected={selected.length === 0}
        aria-current={selected.length === 0 ? 'true' : undefined}
      >
        All assets
      </Chip>

      {CATEGORIES.map((cat) => {
        const isActive = selected.includes(cat.value);
        const count = categoryCount(models, cat.value);
        const countText = !hasModels
          ? null
          : count === 0
            ? 'no models yet'
            : `${count} ${count === 1 ? 'model' : 'models'}`;

        return (
          <Chip
            key={cat.value}
            to={toggle(cat.value)}
            selected={isActive}
            aria-current={isActive ? 'true' : undefined}
            aria-label={countText ? `${cat.label}, ${countText}` : cat.label}
          >
            {cat.label}
            {countText && (
              <span aria-hidden="true" className="tabular-nums opacity-70">
                {count}
              </span>
            )}
          </Chip>
        );
      })}
    </nav>
  );
}