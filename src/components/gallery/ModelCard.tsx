import { Link } from 'react-router-dom';
import type { ModelMetadata } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { formatFileSize } from '@/utils/format';

interface ModelCardProps {
  model: ModelMetadata;
}

export function ModelCard({ model }: ModelCardProps) {
  return (
    <Link
      to={`/model/${model.id}`}
      className="group block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
    >
      <div className="mb-3 flex h-40 items-center justify-center rounded bg-gradient-to-br from-gray-50 to-gray-100">
        <span className="text-4xl">🦆</span>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">
        {model.name}
      </h3>
      <p className="mt-1 line-clamp-2 text-xs text-gray-500">
        {model.description}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge>{model.format.toUpperCase()}</Badge>
        <Badge variant="success">{model.category}</Badge>
        <span className="text-xs text-gray-400">
          {formatFileSize(model.fileSize)}
        </span>
      </div>
    </Link>
  );
}
