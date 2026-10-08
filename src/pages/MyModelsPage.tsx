import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMyModelsStore } from '@/stores/useMyModelsStore';
import { ModelCard } from '@/components/gallery/ModelCard';
import { GallerySkeleton } from '@/components/gallery/GallerySkeleton';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader, SectionHeader } from '@/components/studio/PageHeader';
import { CARD_GRID_CLASS } from '@/components/ui/cardLayout';
import { formatFileSize } from '@/utils/format';

/**
 * Low-data composition.
 *
 * One uploaded model used to sit in a four-column grid with a page of empty
 * space around it, which read as an unfinished page rather than a small
 * library. Short libraries now use a wider two-column presentation so the
 * single asset gets real room; longer libraries fall back to the grid.
 */
const SPARSE_FEATURED_CLASS = 'grid grid-cols-1 gap-6 lg:grid-cols-2';

export function MyModelsPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();
  const { models, isLoading, error, fetchMyModels } = useMyModelsStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchMyModels();
    }
  }, [isAuthenticated, fetchMyModels]);

  if (!isAuthenticated) {
    return null;
  }

  const count = models.length;
  const summary =
    count === 0
      ? 'Assets you publish appear here with a studio preview.'
      : count === 1
        ? '1 published model in your studio library.'
        : `${count} published models in your studio library.`;

  // Everything the library holds, newest first.
  const ordered = [...models].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const totalSize = models.reduce((sum, model) => sum + model.fileSize, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        testId="my-models-header"
        eyebrow="Library"
        title="My Models"
        description={summary}
        action={
          <ButtonLink to="/upload" data-testid="my-models-upload">
            Upload model
          </ButtonLink>
        }
        meta={
          !isLoading && !error ? (
            <p
              className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint"
              data-testid="my-models-count"
            >
              {count} {count === 1 ? 'model' : 'models'}
              {count > 0 && (
                <span className="text-ink-faint/70">
                  {' · '}
                  {formatFileSize(totalSize)} total
                </span>
              )}
            </p>
          ) : null
        }
      />

      <div className="mt-8">
        {error ? (
          <div
            role="alert"
            data-testid="my-models-error"
            className="flex flex-col gap-3 rounded-md border border-danger/40 bg-danger/10 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-danger">{error}</p>
            <Button
              type="button"
              variant="secondary"
              data-testid="my-models-retry"
              onClick={() => void fetchMyModels()}
            >
              Try again
            </Button>
          </div>
        ) : isLoading ? (
          <div
            role="status"
            aria-label="Loading your models"
            data-testid="my-models-skeleton"
          >
            <GallerySkeleton />
          </div>
        ) : count === 0 ? (
          <div data-testid="empty-my-models">
            <EmptyState
              title="You haven't uploaded any models yet"
              description="Upload a GLB or GLTF file to start building your studio library."
              action={<ButtonLink to="/upload">Upload model</ButtonLink>}
            />
          </div>
        ) : (
          <section aria-label="Published models">
            <SectionHeader
              title={count === 1 ? 'Published model' : 'Published models'}
              description="Each asset is rendered once into a studio preview so you can recognise it instantly."
            />
            <div
              data-testid="my-models-grid"
              className={count <= 2 ? SPARSE_FEATURED_CLASS : CARD_GRID_CLASS}
              data-variant={count <= 2 ? 'feature' : 'grid'}
            >
              {ordered.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  variant={count <= 2 ? 'feature' : 'default'}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}