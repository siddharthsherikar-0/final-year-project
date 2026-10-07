import { useState } from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME } from '@/config/constants';
import { useAuthStore } from '@/stores/useAuthStore';

export function Header() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-ink transition-opacity hover:opacity-80"
        >
          <svg
            className="h-6 w-6"
            viewBox="0 0 32 32"
            aria-hidden="true"
            fill="none"
          >
            <path
              d="M16 5l9 5.2v10.4L16 25.8l-9-5.2V10.2L16 5z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
            <path
              d="M16 5v10.6M16 15.6l9 5M16 15.6l-9 5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
              className="text-accent-soft"
            />
          </svg>
          <span className="font-display text-base font-semibold tracking-tight">
            {APP_NAME}
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 sm:flex"
          aria-label="Main navigation"
        >
          <Link
            to="/"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            Gallery
          </Link>
          {isAuthenticated ? (
            <>
              <Link
                to="/upload"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                Upload
              </Link>
              <Link
                to="/favorites"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                Favorites
              </Link>
              <span className="max-w-[10rem] truncate px-2 text-sm text-ink-faint">
                {user?.name}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-surface hover:opacity-80"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="ml-1 rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Register
              </Link>
            </>
          )}
        </nav>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label="Toggle navigation menu"
          className="rounded-md p-2 text-ink transition-colors hover:bg-surface sm:hidden"
        >
          {menuOpen ? (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      <nav
        id="mobile-menu"
        hidden={!menuOpen}
        aria-label="Mobile navigation"
        className="space-y-1 border-t border-line bg-surface px-4 py-3 shadow-lift sm:hidden"
      >
        <Link
          to="/"
          onClick={() => setMenuOpen(false)}
          className="block rounded-md px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          Gallery
        </Link>
        {isAuthenticated ? (
          <>
            <Link
              to="/upload"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              Upload
            </Link>
            <Link
              to="/favorites"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              Favorites
            </Link>
            <div className="border-t border-line px-3 pb-1 pt-3 text-xs text-ink-faint">
              Signed in as {user?.name}
            </div>
            <button
              onClick={handleLogout}
              className="block w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-danger transition-colors hover:bg-elevated"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              Login
            </Link>
            <Link
              to="/register"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md bg-accent px-3 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Register
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
