import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModelCard } from '@/components/gallery/ModelCard';
import { ModelGrid } from '@/components/gallery/ModelGrid';
import { GallerySkeleton } from '@/components/gallery/GallerySkeleton';
import type { ModelMetadata } from '@/types';

const mockModel: ModelMetadata = {
  id: 'test-1',
  name: 'Test Model',
  description: 'A test model',
  category: 'other',
  format: 'glb',
  fileUrl: '/models/test.glb',
  thumbnailUrl: '/models/test-thumb.png',
  fileSize: 1024,
  hasTextures: false,
  hasAnimations: false,
  tags: ['test'],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('ModelCard', () => {
  it('renders model name', () => {
    render(
      <MemoryRouter>
        <ModelCard model={mockModel} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Test Model')).toBeInTheDocument();
  });

  it('renders model description', () => {
    render(
      <MemoryRouter>
        <ModelCard model={mockModel} />
      </MemoryRouter>,
    );
    expect(screen.getByText('A test model')).toBeInTheDocument();
  });

  it('links to model detail page', () => {
    render(
      <MemoryRouter>
        <ModelCard model={mockModel} />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/model/test-1');
  });
});

describe('ModelGrid', () => {
  it('renders empty state when no models', () => {
    render(<ModelGrid models={[]} />);
    expect(screen.getByText(/no models found/i)).toBeInTheDocument();
  });

  it('renders model cards', () => {
    render(
      <MemoryRouter>
        <ModelGrid models={[mockModel]} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Test Model')).toBeInTheDocument();
  });
});

describe('GallerySkeleton', () => {
  it('renders skeleton placeholders', () => {
    const { container } = render(<GallerySkeleton />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});
