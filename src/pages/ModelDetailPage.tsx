import { useParams, Link } from 'react-router-dom';
import { useModelStore } from '@/stores/useModelStore';
import { ModelViewer } from '@/components/viewer/ModelViewer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatFileSize, formatDate } from '@/utils/format';

export function ModelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { models, fetchModels } = useModelStore();

  if (models.length === 0) {
    void fetchModels();
    return null;
  }

  const model = models.find((m) => m.id === id);

  if (!model) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-gray-500">Model not found</p>
        <Link to="/" className="mt-4 inline-block">
          <Button variant="secondary">Back to Gallery</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center gap-4">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Gallery
        </Link>
        <span className="text-sm text-gray-400">|</span>
        <Link
          to={`/viewer/${model.id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Open Full Viewer
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="h-[400px] overflow-hidden rounded-lg border border-gray-200 bg-gray-50 lg:h-[500px]">
          <ModelViewer modelUrl={model.fileUrl} modelName={model.name} />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">{model.name}</h1>
          <p className="mt-2 text-gray-600">{model.description}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>{model.format.toUpperCase()}</Badge>
            <Badge variant="success">{model.category}</Badge>
            {model.tags.map((tag) => (
              <Badge key={tag} variant="warning">
                {tag}
              </Badge>
            ))}
          </div>

          <dl className="mt-6 space-y-3">
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-sm text-gray-500">File Size</dt>
              <dd className="text-sm font-medium text-gray-900">
                {formatFileSize(model.fileSize)}
              </dd>
            </div>
            {model.vertexCount && (
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <dt className="text-sm text-gray-500">Vertices</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {model.vertexCount.toLocaleString()}
                </dd>
              </div>
            )}
            {model.triangleCount && (
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <dt className="text-sm text-gray-500">Triangles</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {model.triangleCount.toLocaleString()}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-sm text-gray-500">Author</dt>
              <dd className="text-sm font-medium text-gray-900">
                {model.author ?? 'Unknown'}
              </dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-sm text-gray-500">License</dt>
              <dd className="text-sm font-medium text-gray-900">
                {model.license ?? 'Unknown'}
              </dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-sm text-gray-500">Added</dt>
              <dd className="text-sm font-medium text-gray-900">
                {formatDate(model.createdAt)}
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <Link to={`/viewer/${model.id}`}>
              <Button>Open Full Viewer</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
