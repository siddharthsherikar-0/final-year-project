import { Link } from 'react-router-dom';
import { APP_NAME } from '@/config/constants';
import { useAuthStore } from '@/stores/useAuthStore';

export function Header() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">{APP_NAME}</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            to="/"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Gallery
          </Link>
          {isAuthenticated ? (
            <>
              <Link
                to="/upload"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Upload
              </Link>
              <Link
                to="/favorites"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Favorites
              </Link>
              <span className="text-sm text-gray-500">{user?.name}</span>
              <button
                onClick={logout}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
