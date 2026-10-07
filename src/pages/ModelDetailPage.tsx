import { useParams, Link } from 'react-router-dom';
import { useModelStore } from '@/stores/useModelStore';
import { ModelViewer } from '@/components/viewer/ModelViewer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FavoriteButton } from '@/components/gallery/FavoriteButton';
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
        <p className="text-ink-muted">Model not found</p>
        <Link to="/" className="mt-4 inline-block">
          <Button variant="secondary">Back to Gallery</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center gap-4">
        <Link to="/" className="text-sm text-accent-soft hover:underline">
          &larr; Back to Gallery
        </Link>
        <span className="text-sm text-ink-faint">|</span>
        <Link
          to={`/viewer/${model.id}`}
          className="text-sm text-accent-soft hover:underline"
        >
          Open Full Viewer
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="h-[400px] overflow-hidden rounded-card border border-line bg-surface lg:h-[500px]">
          <ModelViewer modelUrl={model.fileUrl} modelName={model.name} />
        </div>

        <div>
          <div className="flex items-start gap-2">
          <h1 className="text-2xl font-bold text-ink">{model.name}</h1>
          <FavoriteButton modelId={model.id} className="mt-1" />
        </div>
          <p className="mt-2 text-ink-muted">{model.description}</p>

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
            <div className="flex justify-between border-b border-line pb-2">
              <dt className="text-sm text-ink-muted">File Size</dt>
              <dd className="text-sm font-medium text-ink">
                {formatFileSize(model.fileSize)}
              </dd>
            </div>
            {model.vertexCount && (
              <div className="flex justify-between border-b border-line pb-2">
                <dt className="text-sm text-ink-muted">Vertices</dt>
                <dd className="text-sm font-medium text-ink">
                  {model.vertexCount.toLocaleString()}
                </dd>
              </div>
            )}
            {model.triangleCount && (
              <div className="flex justify-between border-b border-line pb-2">
                <dt className="text-sm text-ink-muted">Triangles</dt>
                <dd className="text-sm font-medium text-ink">
                  {model.triangleCount.toLocaleString()}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-b border-line pb-2">
              <dt className="text-sm text-ink-muted">Author</dt>
              <dd className="text-sm font-medium text-ink">
                {model.author ?? 'Unknown'}
              </dd>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <dt className="text-sm text-ink-muted">License</dt>
              <dd className="text-sm font-medium text-ink">
                {model.license ?? 'Unknown'}
              </dd>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <dt className="text-sm text-ink-muted">Added</dt>
              <dd className="text-sm font-medium text-ink">
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
