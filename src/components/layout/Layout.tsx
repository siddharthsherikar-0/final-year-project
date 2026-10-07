import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';

export function Layout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchFavorites = useFavoriteStore((s) => s.fetchFavorites);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchFavorites();
    }
  }, [isAuthenticated, fetchFavorites]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
