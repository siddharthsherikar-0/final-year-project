import { Link } from 'react-router-dom';
import type { ModelMetadata } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { formatFileSize } from '@/utils/format';
import { FavoriteButton } from './FavoriteButton';
import { ModelMedia } from './ModelMedia';

interface ModelCardProps {
  model: ModelMetadata;
}

export function ModelCard({ model }: ModelCardProps) {
  return (
    <Link
      to={`/model/${model.id}`}
      className="group relative block overflow-hidden rounded-card border border-line bg-surface shadow-card transition duration-base hover:border-accent/40 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <div className="absolute right-2 top-2 z-10">
        <FavoriteButton modelId={model.id} />
      </div>
      <ModelMedia
        thumbnailUrl={model.thumbnailUrl}
        category={model.category}
        format={model.format}
        className="h-40 w-full"
      />
      <div className="p-4">
        <h3 className="truncate text-sm font-semibold text-ink transition-colors group-hover:text-accent-soft">
          {model.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">
          {model.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge>{model.format.toUpperCase()}</Badge>
          <Badge variant="success">{model.category}</Badge>
          {(model.favoriteCount ?? 0) > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-warning">
              <svg
                className="h-3 w-3"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.364 1.118l1.287 3.957c.3.922-.755 1.688-1.539 1.118l-3.366-2.446a1 1 0 00-1.176 0l-3.366 2.446c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.958z" />
              </svg>
              {model.favoriteCount}
              <span className="sr-only">favorites</span>
            </span>
          )}
          <span className="text-xs text-ink-faint">
            {formatFileSize(model.fileSize)}
          </span>
        </div>
      </div>
    </Link>
  );
}
