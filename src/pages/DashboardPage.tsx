import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useModelStore } from '@/stores/useModelStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';
import { useMyModelsStore } from '@/stores/useMyModelsStore';
import { ModelCard } from '@/components/gallery/ModelCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { PageHeader, SectionHeader, StatStrip } from '@/components/studio/PageHeader';
import { railGridClass } from '@/components/ui/cardLayout';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? '';
  if (!first) return '?';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

interface QuickLinkProps {
  to: string;
  testId: string;
  label: string;
  icon: ReactNode;
}

/**
 * Quick actions are inline links, not cards. Three bordered tiles used to sit
 * between the account header and the actual models; as links they stay useful
 * without competing with the artwork.
 */
function QuickLink({ to, testId, label, icon }: QuickLinkProps) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="inline-flex min-h-[40px] items-center gap-2 rounded-md px-1 text-sm font-medium text-ink-muted transition-colors duration-fast hover:text-ink focus-ring"
    >
      <span aria-hidden="true" className="text-ink-faint">
        {icon}
      </span>
      {label}
    </Link>
  );
}

const ICON_UPLOAD = (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 16v2.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V16"
    />
  </svg>
);

const ICON_GALLERY = (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 5.5A1.5 1.5 0 015.5 4h4A1.5 1.5 0 0111 5.5v4A1.5 1.5 0 019.5 11h-4A1.5 1.5 0 014 9.5v-4zM13 5.5A1.5 1.5 0 0114.5 4h4A1.5 1.5 0 0120 5.5v4A1.5 1.5 0 0118.5 11h-4A1.5 1.5 0 0113 9.5v-4zM4 14.5A1.5 1.5 0 015.5 13h4a1.5 1.5 0 011.5 1.5v4A1.5 1.5 0 019.5 20h-4A1.5 1.5 0 014 18.5v-4zM13 14.5a1.5 1.5 0 011.5-1.5h4a1.5 1.5 0 011.5 1.5v4a1.5 1.5 0 01-1.5 1.5h-4a1.5 1.5 0 01-1.5-1.5v-4z"
    />
  </svg>
);

const ICON_HEART = (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 20s-7-4.35-7-9.5A4.5 4.5 0 0112 7a4.5 4.5 0 017 3.5c0 5.15-7 9.5-7 9.5z"
    />
  </svg>
);

export function DashboardPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const restoreUser = useAuthStore((s) => s.restoreUser);
  const navigate = useNavigate();

  const {
    models: myModels,
    isLoading: myLoading,
    error: myError,
    fetchMyModels,
  } = useMyModelsStore();
  const {
    models: galleryModels,
    isLoading: galleryLoading,
    error: galleryError,
    fetchModels,
  } = useModelStore();
  const { favoriteIds, isLoading: favLoading, error: favError, fetchFavorites } =
    useFavoriteStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated && !user) {
      void restoreUser();
    }
  }, [isAuthenticated, user, restoreUser]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchMyModels();
    void fetchModels();
    void fetchFavorites();
  }, [isAuthenticated, fetchMyModels, fetchModels, fetchFavorites]);

  if (!isAuthenticated) {
    return null;
  }

  if (!user) {
    return <DashboardSkeleton />;
  }

  const isLoading = myLoading || galleryLoading || favLoading;
  const loadError = myError || galleryError || favError;

  const retry = () => {
    void fetchMyModels();
    void fetchModels();
    void fetchFavorites();
  };

  const recentUploads = [...myModels]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  const favoriteModels = galleryModels
    .filter((m) => favoriteIds.has(m.id))
    .slice(0, 4);

  const summary = [
    `${myModels.length} ${myModels.length === 1 ? 'published model' : 'published models'}`,
    `${favoriteIds.size} saved`,
    `${galleryModels.length} available`,
  ].join(' · ');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      {loadError && (
        <div
          role="alert"
          data-testid="dashboard-error"
          className="mb-6 flex flex-col gap-3 rounded-md border border-danger/40 bg-danger/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-danger">{loadError}</p>
          <Button
            type="button"
            variant="secondary"
            data-testid="dashboard-retry"
            onClick={retry}
          >
            Try again
          </Button>
        </div>
      )}

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-12">
          {/* Context header - identity is context, not the hero. */}
          <header data-testid="dashboard-profile">
            <PageHeader
              eyebrow="Studio"
              title="My Studio"
              description={summary}
              action={
                <ButtonLink to="/upload" data-testid="dashboard-upload">
                  <ICON_UPLOAD_INLINE />
                  Upload model
                </ButtonLink>
              }
            />

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  data-testid="dashboard-avatar"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-elevated font-display text-xs font-semibold text-ink"
                >
                  {initialsOf(user.name)}
                </span>
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-medium text-ink"
                    data-testid="dashboard-name"
                  >
                    {user.name}
                  </p>
                  <p
                    className="truncate font-mono text-xs text-ink-faint"
                    data-testid="dashboard-email"
                  >
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="sm:ml-auto">
                <StatStrip
                  items={[
                    { testId: 'stat-uploads', label: 'Published', value: myModels.length },
                    { testId: 'stat-favorites', label: 'Saved', value: favoriteIds.size },
                    { testId: 'stat-gallery', label: 'Gallery', value: galleryModels.length },
                  ]}
                />
              </div>
            </div>
          </header>

          {/* Models first: the user's own assets lead the page. */}
          <section aria-label="Your models">
            <SectionHeader
              testId="section-recent-uploads"
              title="Your models"
              description="Assets you have published to the gallery."
              href="/my-models"
              linkLabel="Manage all"
            />
            {recentUploads.length === 0 ? (
              <div data-testid="empty-uploads">
                <EmptyState
                  title="No models yet"
                  description="Publish your first 3D model and it will appear here with a studio preview."
                  action={<ButtonLink to="/upload">Upload model</ButtonLink>}
                />
              </div>
            ) : (
              <div
                data-testid="recent-grid"
                className={railGridClass(recentUploads.length)}
              >
                {recentUploads.map((model) => (
                  <ModelCard key={model.id} model={model} />
                ))}
              </div>
            )}
          </section>

          {/* Recently saved - visual rail, secondary to the user's own models. */}
          <section aria-label="Recently saved">
            <SectionHeader
              testId="section-favorites"
              title="Recently saved"
              description="Models you have bookmarked from the gallery."
              href="/favorites"
              linkLabel="Open favorites"
            />
            {favoriteModels.length === 0 ? (
              <div data-testid="empty-favorites">
                <EmptyState
                  title="Nothing saved yet"
                  description="Save models from the gallery and they will collect here."
                  action={
                    <ButtonLink to="/" variant="secondary">
                      Browse gallery
                    </ButtonLink>
                  }
                />
              </div>
            ) : (
              <div
                data-testid="favorites-grid"
                className={railGridClass(favoriteModels.length)}
              >
                {favoriteModels.map((model) => (
                  <ModelCard key={model.id} model={model} />
                ))}
              </div>
            )}
          </section>

          <section aria-label="Quick actions">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-6">
              <QuickLink
                to="/upload"
                testId="quick-upload"
                label="Upload a model"
                icon={ICON_UPLOAD}
              />
              <QuickLink
                to="/"
                testId="quick-gallery"
                label="Browse gallery"
                icon={ICON_GALLERY}
              />
              <QuickLink
                to="/favorites"
                testId="quick-favorites"
                label="Open favorites"
                icon={ICON_HEART}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ICON_UPLOAD_INLINE() {
  return (
    <svg
      aria-hidden="true"
      className="mr-2 h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 5v14m0-14l-4 4m4-4l4 4M5 19h14"
      />
    </svg>
  );
}

