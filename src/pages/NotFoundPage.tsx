import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="font-display text-4xl font-bold text-ink">404</h1>
      <p className="text-ink-muted">Page not found</p>
      <Link to="/">
        <Button variant="primary">Go Home</Button>
      </Link>
    </div>
  );
}
