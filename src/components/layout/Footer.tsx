import { Link } from 'react-router-dom';
import { APP_NAME } from '@/config/constants';
import { useAuthStore } from '@/stores/useAuthStore';

export function Footer() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  const linkClass =
    'block text-sm text-ink-muted transition-colors hover:text-ink';

  return (
    <footer className="border-t border-line bg-bg">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <p className="font-display text-base font-semibold text-ink">
              {APP_NAME}
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">
              Browse, inspect and showcase GLB/GLTF models in an interactive
              3D studio — right in your browser.
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Explore
            </p>
            <div className="space-y-2.5">
              <Link to="/" className={linkClass}>
                Gallery
              </Link>
              <Link to="/favorites" className={linkClass}>
                Favorites
              </Link>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Account
            </p>
            <div className="space-y-2.5">
              {isAuthenticated ? (
                <>
                  <Link to="/upload" className={linkClass}>
                    Upload a model
                  </Link>
                  <button onClick={logout} className={`${linkClass} text-left`}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className={linkClass}>
                    Login
                  </Link>
                  <Link to="/register" className={linkClass}>
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-faint">
            © 2026 {APP_NAME}. Final-year diploma project.
          </p>
          <p className="text-xs text-ink-faint">
            React · TypeScript · Three.js · Express · Prisma
          </p>
        </div>
      </div>
    </footer>
  );
}
