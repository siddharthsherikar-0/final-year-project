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
          <span className="text-xs text-ink-faint">
            {formatFileSize(model.fileSize)}
          </span>
        </div>
      </div>
    </Link>
  );
}
