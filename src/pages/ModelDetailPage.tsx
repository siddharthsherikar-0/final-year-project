import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useModelStore } from '@/stores/useModelStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFilterStore } from '@/stores/useFilterStore';
import { useRecentStore } from '@/stores/useRecentStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { FavoriteButton } from '@/components/gallery/FavoriteButton';
import { ModelCard } from '@/components/gallery/ModelCard';
import { loadModelViewer } from '@/components/viewer/lazyModelViewer';
const ModelViewer = lazy(loadModelViewer);
import { categoryLabel } from '@/config/categories';
import { formatFileSize, formatDate } from '@/utils/format';
import { primaryCtaClass, secondaryCtaClass } from '@/components/landing/Hero';

type Phase = 'loading' | 'ready' | 'error';

function SpecRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function DetailLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
    >
      <span className="sr-only">Loading model...</span>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-5 h-9 w-72 max-w-full" />
      <Skeleton className="mt-4 h-4 w-96 max-w-full" />
      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-[300px] w-full lg:col-span-3 lg:h-[520px]" />
        <div className="space-y-3 lg:col-span-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      </div>
    </div>
  );
}

export function ModelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { models, error, isLoading, fetchModels } = useModelStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const settledId = useModelStore((s) => s.settledId);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;
    if (useModelStore.getState().models.some((m) => m.id === id)) return;
    if (useModelStore.getState().settledId === id) {
      // Already fetched once — refresh in the background for fresh uploads.
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
  }, [fetchModels, id]);

  const model = models.find((m) => m.id === id);
  const settled = Boolean(id) && settledId === id;

  const phase: Phase = model
    ? 'ready'
    : !settled || isLoading
      ? 'loading'
      : error
        ? 'error'
        : 'ready';

  useEffect(
    () => () => {
      if (shareTimer.current) clearTimeout(shareTimer.current);
    },
    [],
  );

  const handleRetry = () => {
    void fetchModels();
  };

  useEffect(() => {
    if (model) useRecentStore.getState().recordView(model.id);
  }, [model]);

  const selectedCategories = useFilterStore((s) => s.selectedCategories);
  const galleryTo =
    selectedCategories.length > 0
      ? `/?category=${selectedCategories.join(',')}#gallery`
      : '/';

  const related = useMemo(() => {
    if (!model) return [];
    const others = models.filter((m) => m.id !== model.id);
    const sameCategory = others.filter((m) => m.category === model.category);
    const rest = others.filter((m) => m.category !== model.category);
    return [...sameCategory, ...rest].slice(0, 3);
  }, [models, model]);

  const handleShare = async () => {
    if (!model) return;
    const url = window.location.href;
    const showStatus = (message: string) => {
      setShareStatus(message);
      if (shareTimer.current) clearTimeout(shareTimer.current);
      shareTimer.current = setTimeout(() => setShareStatus(null), 4000);
    };

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: model.name,
          text: model.description,
          url,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Otherwise fall through to the clipboard fallback.
      }
    }

    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(url);
      showStatus('Link copied to clipboard');
    } catch {
      showStatus('Sharing is not available here - copy the page URL instead');
    }
  };

  if (phase === 'loading') {
    return <DetailLoading />;
  }

  if (phase === 'error') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          title="Couldn't load this model"
          description={error ?? 'Something went wrong while loading this model.'}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={handleRetry}>Try again</Button>
              <Link to="/" className={secondaryCtaClass}>
                Back to Gallery
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          title="Model not found"
          description="This model may have been removed, or the link you followed is not valid."
          action={
            <Link to="/" className={secondaryCtaClass}>
              Back to Gallery
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-accent/20 blur-[110px]" />
          <div className="studio-grid absolute inset-0 opacity-40" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
            <Link to={galleryTo} className="text-accent-soft hover:underline">
              Gallery
            </Link>
            <span aria-hidden="true" className="text-ink-faint">
              /
            </span>
            <Link
              to={`/?category=${model.category}#gallery`}
              className="text-accent-soft hover:underline"
            >
              {categoryLabel(model.category)}
            </Link>
            <span aria-hidden="true" className="text-ink-faint">
              /
            </span>
            <span className="text-ink-faint" aria-current="page">
              {model.name}
            </span>
          </nav>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link
              to={`/?category=${model.category}#gallery`}
              aria-label={`Browse ${categoryLabel(model.category)} models`}
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <Badge variant="success">{categoryLabel(model.category)}</Badge>
            </Link>
            <Badge>{model.format.toUpperCase()}</Badge>
            {model.tags.map((tag) => (
              <Badge key={tag} variant="warning">
                {tag}
              </Badge>
            ))}
          </div>

          <h1 className="mt-4 break-words font-display text-title font-bold text-ink">
            {model.name}
          </h1>

          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            <span>
              by <span className="text-ink">{model.author ?? 'Unknown'}</span>
            </span>
            <span aria-hidden="true" className="text-ink-faint">
              ·
            </span>
            <span>{model.license ?? 'License unspecified'}</span>
            <span aria-hidden="true" className="text-ink-faint">
              ·
            </span>
            <span>Added {formatDate(model.createdAt)}</span>
          </p>

          {model.description && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
              {model.description}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to={`/viewer/${model.id}`} className={primaryCtaClass}>
              Open in Studio
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>

            <a href={model.fileUrl} download className={secondaryCtaClass}>
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download model
            </a>

            <button
              type="button"
              onClick={() => void handleShare()}
              className={secondaryCtaClass}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Share
            </button>

            {isAuthenticated && (
              <span className="inline-flex items-center gap-2 rounded-md border border-line bg-elevated py-1 pl-3 pr-1 text-sm font-medium text-ink">
                <FavoriteButton modelId={model.id} className="p-1" />
                Favorite
              </span>
            )}
          </div>

          <p
            role="status"
            aria-live="polite"
            className="mt-3 text-sm text-accent-soft"
          >
            {shareStatus ?? ''}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="min-w-0 lg:col-span-3">
            <div className="relative h-[300px] overflow-hidden rounded-panel border border-line bg-surface shadow-card sm:h-[380px] lg:h-[520px]">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <Skeleton className="h-4 w-32" />
                  </div>
                }
              >
                <ModelViewer modelUrl={model.fileUrl} modelName={model.name} />
              </Suspense>
              <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-line bg-bg/70 px-3 py-1 text-xs font-medium uppercase tracking-wider text-ink-muted backdrop-blur">
                Interactive preview
              </div>
              <p className="pointer-events-none absolute right-4 top-4 z-10 hidden rounded-full border border-line bg-bg/70 px-3 py-1 text-xs text-ink-muted backdrop-blur sm:block">
                Drag to orbit &middot; Scroll to zoom
              </p>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-2">
            <div className="rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
              <h2 className="font-display text-lg font-semibold text-ink">
                Specifications
              </h2>
              <dl className="mt-2 divide-y divide-line">
                <SpecRow label="Format">{model.format.toUpperCase()}</SpecRow>
                <SpecRow label="Category">{categoryLabel(model.category)}</SpecRow>
                <SpecRow label="File size">{formatFileSize(model.fileSize)}</SpecRow>
                {model.vertexCount !== undefined && (
                  <SpecRow label="Vertices">
                    {model.vertexCount.toLocaleString('en-US')}
                  </SpecRow>
                )}
                {model.triangleCount !== undefined && (
                  <SpecRow label="Triangles">
                    {model.triangleCount.toLocaleString('en-US')}
                  </SpecRow>
                )}
                <SpecRow label="Textures">
                  {model.hasTextures ? 'Included' : 'None'}
                </SpecRow>
                <SpecRow label="Animations">
                  {model.hasAnimations ? 'Yes' : 'No'}
                </SpecRow>
                <SpecRow label="Author">{model.author ?? 'Unknown'}</SpecRow>
                <SpecRow label="License">{model.license ?? 'Unknown'}</SpecRow>
                <SpecRow label="Added">{formatDate(model.createdAt)}</SpecRow>
                {model.tags.length > 0 && (
                  <SpecRow label="Tags">
                    <span className="flex flex-wrap justify-end gap-1.5">
                      {model.tags.map((tag) => (
                        <Badge key={tag} variant="warning">
                          {tag}
                        </Badge>
                      ))}
                    </span>
                  </SpecRow>
                )}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">
                Related models
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                More from {categoryLabel(model.category)} and other categories
              </p>
            </div>
            <Link
              to={`/?category=${model.category}#gallery`}
              className="text-sm font-medium text-accent-soft hover:underline"
            >
              View all {categoryLabel(model.category)}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((m) => (
              <ModelCard key={m.id} model={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
