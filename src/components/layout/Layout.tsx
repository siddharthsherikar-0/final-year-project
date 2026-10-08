import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';

export function Layout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const restoreUser = useAuthStore((s) => s.restoreUser);
  const fetchFavorites = useFavoriteStore((s) => s.fetchFavorites);
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      void fetchFavorites();
    }
  }, [isAuthenticated, fetchFavorites]);

  useEffect(() => {
    if (isAuthenticated && !user) {
      void restoreUser();
    }
  }, [isAuthenticated, user, restoreUser]);

  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView();
  }, [location.hash, location.pathname]);

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
