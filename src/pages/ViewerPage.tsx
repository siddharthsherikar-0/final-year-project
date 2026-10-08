import { lazy, Suspense, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useModelStore } from '@/stores/useModelStore';
import { useRecentStore } from '@/stores/useRecentStore';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { loadModelViewer } from '@/components/viewer/lazyModelViewer';

const ModelViewer = lazy(loadModelViewer);

type Phase = 'loading' | 'ready' | 'error' | 'not-found';

export function ViewerPage() {
  const { id } = useParams<{ id: string }>();
  const { models, error, isLoading, fetchModels, selectModel } = useModelStore();
  const settledId = useModelStore((s) => s.settledId);

  useEffect(() => {
    if (!id) return;
    if (useModelStore.getState().models.some((m) => m.id === id)) return;
    if (useModelStore.getState().settledId === id) {
      // This id was already fetched once — refresh in the background so a
      // freshly uploaded model still shows up (previous behavior did this
      // refetch on every visit as well).
      void fetchModels();
      return;
    }
    let active = true;
    void fetchModels().then(() => {
      if (active) useModelStore.getState().markSettled(id);
    });
    return () => {
      active = false;
    };
  }, [id, fetchModels]);

  const model = models.find((m) => m.id === id);
  const settled = Boolean(id) && settledId === id;

  const phase: Phase = model
    ? 'ready'
    : !settled || isLoading
      ? 'loading'
      : models.length === 0
        ? error
          ? 'error'
          : 'loading'
        : 'not-found';

  useEffect(() => {
    if (model) selectModel(model);
  }, [model, selectModel]);

  useEffect(() => {
    if (model) useRecentStore.getState().recordView(model.id);
  }, [model]);

  if (phase === 'loading' || phase === 'error') {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        {phase === 'loading' ? (
          <>
            <Spinner size="lg" />
            <p aria-live="polite" data-testid="viewer-page-message">
              <span className="text-ink-muted">Loading model...</span>
            </p>
            <ButtonLink to="/" variant="secondary">
              Back to Gallery
            </ButtonLink>
          </>
        ) : (
          <>
            <p role="alert" className="text-sm font-medium text-danger">
              Couldn&apos;t load this model
            </p>
            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={() => {
                  void fetchModels();
                }}
              >
                Try again
              </Button>
              <ButtonLink to="/" variant="secondary">
                Back to Gallery
              </ButtonLink>
            </div>
          </>
        )}
      </div>
    );
  }

  if (phase === 'not-found' || !model) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm font-medium text-ink">Model not found</p>
        <p className="text-xs text-ink-muted">
          It may have been removed, or the link is out of date.
        </p>
        <ButtonLink to="/" variant="secondary">
          Back to Gallery
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2">
        <Link
          to={`/model/${id}`}
          className="inline-flex items-center gap-1 rounded-md bg-elevated px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-interactive focus-ring-tight"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Model
        </Link>
        <h1 className="truncate px-3 text-sm font-semibold text-ink">{model.name}</h1>
        <span className="w-28 shrink-0" aria-hidden="true" />
      </div>
      <div className="min-h-0 flex-1">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <Spinner size="lg" />
            </div>
          }
        >
          <ModelViewer modelUrl={model.fileUrl} modelName={model.name} />
        </Suspense>
      </div>
    </div>
  );
}
