import { useFavoriteStore } from '@/stores/useFavoriteStore';
import { useAuthStore } from '@/stores/useAuthStore';

interface FavoriteButtonProps {
  modelId: string;
  className?: string;
}

export function FavoriteButton({ modelId, className = '' }: FavoriteButtonProps) {
  const isFavorited = useFavoriteStore((s) => s.favoriteIds.has(modelId));
  const toggleFavorite = useFavoriteStore((s) => s.toggleFavorite);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) return null;

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggleFavorite(modelId);
      }}
      // An elevated control surface keeps the icon readable over any thumbnail
      // (light or dark). Gold means "favorited", never an error state.
      className={`inline-flex items-center justify-center rounded-full border bg-elevated/90 p-2 shadow-card backdrop-blur transition-[color,background-color,border-color,transform] duration-fast active:scale-95 focus-ring motion-reduce:transition-none ${
        isFavorited
          ? 'border-accent/60 text-accent hover:bg-accent-subtle'
          : 'border-control/70 text-ink-muted hover:border-accent/50 hover:text-accent'
      } ${className}`}
      aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <svg
        className="h-5 w-5"
        fill={isFavorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  );
}
