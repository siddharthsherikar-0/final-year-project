import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useModelStore } from '@/stores/useModelStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { ModelCard } from '@/components/gallery/ModelCard';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';

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
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-gray-500">Please log in to view your favorites.</p>
        <Link to="/login" className="mt-4 inline-block">
          <Button variant="primary">Login</Button>
        </Link>
      </div>
    );
  }

  const favoriteModels = models.filter((m) => favoriteIds.has(m.id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">My Favorites</h1>

      {isLoading || favLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : favoriteModels.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">You haven't favorited any models yet.</p>
          <Link to="/" className="mt-4 inline-block">
            <Button variant="secondary">Browse Gallery</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {favoriteModels.map((model) => (
            <ModelCard key={model.id} model={model} />
          ))}
        </div>
      )}
    </div>
  );
}
