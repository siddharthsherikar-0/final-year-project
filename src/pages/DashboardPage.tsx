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
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? '';
  if (!first) return '?';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

interface QuickActionProps {
  to: string;
  testId: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
}

function QuickAction({ to, testId, title, subtitle, icon }: QuickActionProps) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="group flex items-start gap-3 rounded-card border border-line bg-surface p-4 shadow-card transition duration-base hover:border-accent/40 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-soft/10 text-accent-soft transition-colors group-hover:bg-accent-soft/20"
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink transition-colors group-hover:text-accent-soft">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-ink-muted">{subtitle}</span>
      </span>
    </Link>
  );
}

interface StatCardProps {
  testId: string;
  label: string;
  value: number;
  hint: string;
}

function StatCard({ testId, label, value, hint }: StatCardProps) {
  return (
    <div
      data-testid={testId}
      className="rounded-card border border-line bg-surface p-5 shadow-card"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p
        className="mt-2 font-display text-3xl font-bold text-ink"
        data-testid={`${testId}-value`}
      >
        {value.toLocaleString('en-US')}
      </p>
      <p className="mt-1 text-xs text-ink-muted">{hint}</p>
    </div>
  );
}

interface SectionHeadingProps {
  testId: string;
  title: string;
  href: string;
  linkLabel: string;
}

function SectionHeading({ testId, title, href, linkLabel }: SectionHeadingProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3" data-testid={testId}>
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      <Link
        to={href}
        className="text-sm font-medium text-accent-soft transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-md"
      >
        {linkLabel}
        <span aria-hidden="true"> →</span>
      </Link>
    </div>
  );
}

const ICON_UPLOAD = (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    viewBox="0 0 24 24"
    aria-hidden="true"
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
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    viewBox="0 0 24 24"
    aria-hidden="true"
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
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    viewBox="0 0 24 24"
    aria-hidden="true"
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
    if (!isAuthenticated) return;
    void fetchMyModels();
    void fetchModels();
    void fetchFavorites();
  }, [isAuthenticated, fetchMyModels, fetchModels, fetchFavorites]);

  if (!isAuthenticated || !user) {
    return null;
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
        <div className="space-y-8">
          <section
            aria-label="Profile"
            data-testid="dashboard-profile"
            className="rounded-panel border border-line bg-surface p-6 shadow-card"
          >
            <div className="flex items-center gap-4">
              <div
                aria-hidden="true"
                data-testid="dashboard-avatar"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft/15 font-display text-xl font-bold text-accent-soft"
              >
                {initialsOf(user.name)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                  Studio Dashboard
                </p>
                <h1
                  className="mt-0.5 truncate font-display text-2xl font-bold text-ink"
                  data-testid="dashboard-name"
                >
                  {user.name}
                </h1>
                <p
                  className="truncate text-sm text-ink-muted"
                  data-testid="dashboard-email"
                >
                  {user.email}
                </p>
              </div>
            </div>
          </section>

          <section aria-label="Account statistics">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                testId="stat-uploads"
                label="Uploaded models"
                value={myModels.length}
                hint="Models you have published"
              />
              <StatCard
                testId="stat-favorites"
                label="Favorites"
                value={favoriteIds.size}
                hint="Models you have saved"
              />
              <StatCard
                testId="stat-gallery"
                label="Gallery models"
                value={galleryModels.length}
                hint="Available to browse"
              />
            </div>
          </section>

          <section aria-label="Quick actions">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <QuickAction
                to="/upload"
                testId="quick-upload"
                title="Upload Model"
                subtitle="Publish a GLB or GLTF file"
                icon={ICON_UPLOAD}
              />
              <QuickAction
                to="/"
                testId="quick-gallery"
                title="Browse Gallery"
                subtitle="Explore every published model"
                icon={ICON_GALLERY}
              />
              <QuickAction
                to="/favorites"
                testId="quick-favorites"
                title="Open Favorites"
                subtitle="Revisit your saved models"
                icon={ICON_HEART}
              />
            </div>
          </section>

          <section aria-label="Recent uploads">
            <SectionHeading
              testId="section-recent-uploads"
              title="Recent uploads"
              href="/my-models"
              linkLabel="View all"
            />
            {recentUploads.length === 0 ? (
              <div data-testid="empty-uploads">
                <EmptyState
                  title="No uploads yet"
                  description="Publish your first 3D model and it will appear here."
                  action={
                    <Link to="/upload">
                      <Button type="button">Upload Model</Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              <div
                data-testid="recent-grid"
                className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
              >
                {recentUploads.map((model) => (
                  <ModelCard key={model.id} model={model} />
                ))}
              </div>
            )}
          </section>

          <section aria-label="Favorite models">
            <SectionHeading
              testId="section-favorites"
              title="Favorite models"
              href="/favorites"
              linkLabel="View all"
            />
            {favoriteModels.length === 0 ? (
              <div data-testid="empty-favorites">
                <EmptyState
                  title="No favorites yet"
                  description="Save models from the gallery and they will show up here."
                  action={
                    <Link to="/">
                      <Button type="button" variant="secondary">
                        Browse Gallery
                      </Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              <div
                data-testid="favorites-grid"
                className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
              >
                {favoriteModels.map((model) => (
                  <ModelCard key={model.id} model={model} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
