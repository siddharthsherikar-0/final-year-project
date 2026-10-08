import { BrowserRouter, Link, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Button } from '@/components/ui/Button';
import { HomePage } from '@/pages/HomePage';
import { ViewerPage } from '@/pages/ViewerPage';
import { ModelDetailPage } from '@/pages/ModelDetailPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { UploadPage } from '@/pages/UploadPage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { MyModelsPage } from '@/pages/MyModelsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<Layout />}>
          <Route
            index element={<HomePage />}
          />
          <Route
            path="viewer/:id"
            element={
              <ErrorBoundary
                fallback={({ retry }) => (
                  <RouteErrorFallback
                    message="The 3D viewer failed to load."
                    onRetry={retry}
                  />
                )}
              >
                <ViewerPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="model/:id"
            element={
              <ErrorBoundary
                fallback={({ retry }) => (
                  <RouteErrorFallback
                    message="The model page failed to load."
                    onRetry={retry}
                  />
                )}
              >
                <ModelDetailPage />
              </ErrorBoundary>
            }
          />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="my-models" element={<MyModelsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function RouteErrorFallback({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-danger">{message}</p>
      <p className="mt-1 text-xs text-ink-muted">
        Your work is safe — you can return to the gallery or try reloading the
        page.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-md border border-line bg-elevated px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Return to Gallery
        </Link>
      </div>
    </div>
  );
}
