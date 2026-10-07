import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ModelCategory, ModelFormat } from '@/types';
import { categoryLabel } from '@/config/categories';

interface ModelMediaProps {
  thumbnailUrl?: string;
  category: ModelCategory;
  format: ModelFormat;
  className?: string;
}

const CATEGORY_ICONS: Record<ModelCategory, ReactNode> = {
  architecture: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 21h18M5 21V8l7-4 7 4v13M9 10h.01M9 14h.01M9 18h.01M15 10h.01M15 14h.01M15 18h.01"
    />
  ),
  characters: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 4.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"
    />
  ),
  vehicles: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 13l1.8-4.6A2 2 0 017.7 7h8.6a2 2 0 011.9 1.4L20 13v5h-2.5v-2h-11v2H4v-5zM7 16h.01M17 16h.01"
    />
  ),
  nature: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 19C5 11.7 10.2 6 19 5c.4 8.3-4.6 14-12 14.5M5 19c3.6-3.6 6.6-6.4 11-8.6"
    />
  ),
  furniture: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 12V8a3 3 0 013-3h8a3 3 0 013 3v4M4 12h16a1 1 0 011 1v4H3v-4a1 1 0 011-1zM6 17v3M18 17v3"
    />
  ),
  'sci-fi': (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3c2.8 2 4.5 5.3 4.5 8.7L14.5 15h-5l-2-3.3C7.5 8.3 9.2 5 12 3zM9.5 15L7.5 18.5 9 20m5.5-5L16.5 18.5 15 20M12 10.5h.01"
    />
  ),
  other: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5"
    />
  ),
};

export function ModelMedia({
  thumbnailUrl,
  category,
  format,
  className = '',
}: ModelMediaProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [thumbnailUrl]);

  const showImage = Boolean(thumbnailUrl) && !imgFailed;

  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden bg-gradient-to-br from-elevated to-bg ${className}`}
    >
      {showImage ? (
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          <div className="studio-grid absolute inset-0 opacity-30" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <svg
              className="h-10 w-10 text-accent-soft/70"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              {CATEGORY_ICONS[category]}
            </svg>
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
              {categoryLabel(category)}
            </span>
          </div>
          <span className="absolute bottom-2 right-3 font-display text-lg font-bold text-ink/10">
            {format.toUpperCase()}
          </span>
        </>
      )}
    </div>
  );
}
