import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useModelStore } from '@/stores/useModelStore';
import { ModelViewer } from '@/components/viewer/ModelViewer';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';

export function ViewerPage() {
  const { id } = useParams<{ id: string }>();
  const { models, fetchModels, selectModel } = useModelStore();

  useEffect(() => {
    if (models.length === 0) {
      void fetchModels();
    }
  }, [models.length, fetchModels]);

  const model = models.find((m) => m.id === id);

  useEffect(() => {
    if (model) {
      selectModel(model);
    }
  }, [model, selectModel]);

  if (!model) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <Spinner size="lg" />
        <p className="text-gray-500">Loading model...</p>
        <Link to="/">
          <Button variant="secondary">Back to Gallery</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <Link
          to={`/model/${id}`}
          className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Model
        </Link>
        <h1 className="text-sm font-semibold text-gray-900">{model.name}</h1>
        <span className="w-20" />
      </div>
      <div className="flex-1">
        <ModelViewer modelUrl={model.fileUrl} modelName={model.name} />
      </div>
    </div>
  );
}
