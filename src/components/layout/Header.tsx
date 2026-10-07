import { Link } from 'react-router-dom';
import { APP_NAME } from '@/config/constants';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">{APP_NAME}</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            to="/"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Gallery
          </Link>
        </nav>
      </div>
    </header>
  );
}
