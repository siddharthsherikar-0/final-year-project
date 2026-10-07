import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useModelStore } from '@/stores/useModelStore';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { formatFileSize } from '@/utils/format';

export function HomePage() {
  const { models, isLoading, error, fetchModels } = useModelStore();

  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Model Gallery</h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {models.map((model) => (
          <Link
            key={model.id}
            to={`/viewer/${model.id}`}
            className="group rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-3 flex h-40 items-center justify-center rounded bg-gray-100">
              <span className="text-4xl">🦆</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">
              {model.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs text-gray-500">
              {model.description}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Badge>{model.format.toUpperCase()}</Badge>
              <span className="text-xs text-gray-400">
                {formatFileSize(model.fileSize)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
