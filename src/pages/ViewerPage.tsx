import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useModelStore } from '@/stores/useModelStore';
import { useRecentStore } from '@/stores/useRecentStore';
import { ModelViewer } from '@/components/viewer/ModelViewer';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';

type Phase = 'loading' | 'ready' | 'error' | 'not-found';

function phaseFor(id: string | undefined): Phase {
  const { models, error } = useModelStore.getState();
  if (models.length === 0 && error) return 'error';
  if (!models.some((model) => model.id === id)) {
    return models.length === 0 ? 'loading' : 'not-found';
  }
  return 'ready';
}

export function ViewerPage() {
  const { id } = useParams<{ id: string }>();
  const { models, fetchModels, selectModel } = useModelStore();
  const [phase, setPhase] = useState<Phase>(() =>
    useModelStore.getState().models.some((m) => m.id === id) ? 'ready' : 'loading',
  );

  useEffect(() => {
    if (useModelStore.getState().models.some((m) => m.id === id)) {
      setPhase('ready');
      return;
    }
    let active = true;
    setPhase('loading');
    void fetchModels().then(() => {
      if (active) setPhase(phaseFor(id));
    });
    return () => {
      active = false;
    };
  }, [id, fetchModels]);

  const model = phase === 'ready' ? models.find((m) => m.id === id) : undefined;

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
            <Link to="/">
              <Button variant="secondary">Back to Gallery</Button>
            </Link>
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
                  setPhase('loading');
                  void fetchModels().then(() => setPhase(phaseFor(id)));
                }}
              >
                Try again
              </Button>
              <Link to="/">
                <Button variant="secondary">Back to Gallery</Button>
              </Link>
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
        <Link to="/">
          <Button variant="secondary">Back to Gallery</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2">
        <Link
          to={`/model/${id}`}
          className="inline-flex items-center gap-1 rounded-md bg-elevated px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
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
        <ModelViewer modelUrl={model.fileUrl} modelName={model.name} />
      </div>
    </div>
  );
}
