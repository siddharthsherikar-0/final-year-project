import { Link } from 'react-router-dom';
import type { ModelMetadata } from '@/types';
import { ModelCard } from '@/components/gallery/ModelCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { primaryCtaClass } from './Hero';

interface LatestUploadsProps {
  models: ModelMetadata[];
  isLoading: boolean;
}

const MAX_FEATURED = 4;

export function LatestUploads({ models, isLoading }: LatestUploadsProps) {
  const latest = [...models]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_FEATURED);

  return (
    <section
      className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8"
      aria-label="Latest uploads"
    >
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-title font-semibold text-ink">
            Latest uploads
          </h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            The newest models added to the gallery.
          </p>
        </div>
        <a
          href="#gallery"
          className="shrink-0 text-sm font-medium text-accent-soft transition-colors hover:text-ink"
        >
          View all
        </a>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-card border border-line bg-surface p-4"
            >
              <Skeleton className="h-40 w-full rounded" />
              <Skeleton className="mt-4 h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : latest.length === 0 ? (
        <EmptyState
          title="No models yet"
          description="Upload a GLB or GLTF file to get started."
          action={
            <Link to="/upload" className={primaryCtaClass}>
              Upload a model
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {latest.map((model) => (
            <ModelCard key={model.id} model={model} />
          ))}
        </div>
      )}
    </section>
  );
}
