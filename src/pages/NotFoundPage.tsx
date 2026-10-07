import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="text-gray-500">Page not found</p>
      <Link to="/">
        <Button variant="primary">Go Home</Button>
      </Link>
    </div>
  );
}
