import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMyModelsStore } from '@/stores/useMyModelsStore';
import { ModelCard } from '@/components/gallery/ModelCard';
import { GallerySkeleton } from '@/components/gallery/GallerySkeleton';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">My Models</h1>
          <p className="mt-1 text-sm text-ink-muted">
            3D models you have uploaded to the gallery.
          </p>
          {!isLoading && !error && (
            <p
              className="mt-2 text-xs text-ink-faint"
              data-testid="my-models-count"
            >
              {models.length} {models.length === 1 ? 'model' : 'models'}
            </p>
          )}
        </div>
        <Link
          to="/upload"
          data-testid="my-models-upload"
          className="self-start sm:self-auto"
        >
          <Button type="button">Upload Model</Button>
        </Link>
      </div>

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
      ) : models.length === 0 ? (
        <div data-testid="empty-my-models">
          <EmptyState
            title="You haven't uploaded any models yet"
            description="Upload a GLB or GLTF file to start building your studio library."
            action={
              <Link to="/upload">
                <Button type="button">Upload Model</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div
          data-testid="my-models-grid"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {models.map((model) => (
            <ModelCard key={model.id} model={model} />
          ))}
        </div>
      )}
    </div>
  );
}
