import { Link, useLocation } from 'react-router-dom';
import type { ModelCategory, ModelMetadata } from '@/types';
import { CATEGORIES } from '@/config/categories';

interface CategoryNavProps {
  models: ModelMetadata[];
}

const chipBase =
  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

const chipActive = 'border-accent bg-accent text-white';
const chipIdle =
  'border-line bg-elevated text-ink-muted hover:border-ink-faint hover:text-ink';

function categoryCount(models: ModelMetadata[], value: ModelCategory): number {
  return models.filter((m) => m.category === value).length;
}

export function CategoryNav({ models }: CategoryNavProps) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const active = params.get('category');
  const hasModels = models.length > 0;
  const linkTo = (value: ModelCategory | null) => ({
    pathname: '/',
    search: value ? `?category=${value}` : '',
    hash: '#gallery',
  });

  return (
    <nav aria-label="Browse by category" className="mb-6 flex flex-wrap gap-2">
      <Link
        to={linkTo(null)}
        aria-current={active ? undefined : 'true'}
        className={`${chipBase} ${active ? chipIdle : chipActive}`}
      >
        All
      </Link>
      {CATEGORIES.map((cat) => {
        const isActive = active === cat.value;
        const count = categoryCount(models, cat.value);
        const countText = !hasModels
          ? null
          : count === 0
            ? 'no models yet'
            : `${count} ${count === 1 ? 'model' : 'models'}`;
        return (
          <Link
            key={cat.value}
            to={linkTo(cat.value)}
            aria-current={isActive ? 'true' : undefined}
            aria-label={countText ? `${cat.label}, ${countText}` : cat.label}
            className={`${chipBase} ${isActive ? chipActive : chipIdle}`}
          >
            {cat.label}
            {countText && (
              <span aria-hidden="true" className="ml-1.5 tabular-nums opacity-70">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
