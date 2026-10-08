import { useEffect } from 'react';
import { useModelStore } from '@/stores/useModelStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { ModelCard } from '@/components/gallery/ModelCard';
import { Spinner } from '@/components/ui/Spinner';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/studio/PageHeader';
import { CARD_GRID_CLASS } from '@/components/ui/cardLayout';

export function FavoritesPage() {
  const { models, isLoading, fetchModels } = useModelStore();
  const { favoriteIds, fetchFavorites, isLoading: favLoading } = useFavoriteStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchFavorites();
    }
  }, [isAuthenticated, fetchFavorites]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          title="Sign in to see your saved assets"
          description="Your favorites are tied to your account, so you can pick up browsing on any device."
          action={<ButtonLink to="/login">Log in</ButtonLink>}
        />
      </div>
    );
  }

  const favoriteModels = models.filter((m) => favoriteIds.has(m.id));
  const busy = isLoading || favLoading;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="Library"
        title="My Favorites"
        description={
          busy
            ? 'Loading your saved assets.'
            : favoriteModels.length === 0
              ? 'Assets you save from the gallery collect here.'
              : `${favoriteModels.length} saved ${favoriteModels.length === 1 ? 'asset' : 'assets'}, ready to open in the studio.`
        }
      />

      <div className="mt-8">
        {busy ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : favoriteModels.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            description="Open any model and save it to build your own shelf of assets."
            action={
              <ButtonLink to="/" variant="secondary">
                Browse the gallery
              </ButtonLink>
            }
          />
        ) : (
          <div className={CARD_GRID_CLASS}>
            {favoriteModels.map((model) => (
              <ModelCard key={model.id} model={model} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}