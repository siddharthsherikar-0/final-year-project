import { describe, it, expect } from 'vitest';
import { render, screen, getAllByRole } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Hero } from '@/components/landing/Hero';
import { LatestUploads } from '@/components/landing/LatestUploads';
import type { ModelMetadata } from '@/types';

const makeModel = (id: string, createdAt: string): ModelMetadata => ({
  id,
  name: `Model ${id}`,
  description: `Description ${id}`,
  category: 'other',
  format: 'glb',
  fileUrl: `/models/${id}.glb`,
  thumbnailUrl: `/models/${id}.png`,
  fileSize: 1024,
  hasTextures: false,
  hasAnimations: false,
  tags: ['test'],
  createdAt,
  updatedAt: createdAt,
});

describe('Hero', () => {
  it('renders the headline and sub copy', () => {
    render(
      <MemoryRouter>
        <Hero stats={{ total: 6, categories: 3, formats: 2 }} isLoading={false} />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: /explore 3d models/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/webgl viewer/i)).toBeInTheDocument();
  });

  it('links Browse models to the gallery anchor and Upload to /upload', () => {
    render(
      <MemoryRouter>
        <Hero stats={{ total: 0, categories: 0, formats: 0 }} isLoading={false} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /browse models/i })).toHaveAttribute(
      'href',
      '#gallery',
    );
    expect(screen.getByRole('link', { name: /upload a model/i })).toHaveAttribute(
      'href',
      '/upload',
    );
  });

  it('shows real library stats once loaded', () => {
    render(
      <MemoryRouter>
        <Hero stats={{ total: 6, categories: 3, formats: 2 }} isLoading={false} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Models')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Formats')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows skeletons instead of numbers while loading', () => {
    const { container } = render(
      <MemoryRouter>
        <Hero stats={{ total: 0, categories: 0, formats: 0 }} isLoading={true} />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBe(3);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    // CTAs stay available while loading
    expect(screen.getByRole('link', { name: /browse models/i })).toBeInTheDocument();
  });
});

describe('LatestUploads', () => {
  it('renders the newest models first, capped at 4', () => {
    const models = [
      makeModel('old', '2024-01-01T00:00:00Z'),
      makeModel('new', '2024-06-01T00:00:00Z'),
      makeModel('mid', '2024-03-01T00:00:00Z'),
      makeModel('a', '2024-02-01T00:00:00Z'),
      makeModel('b', '2024-04-01T00:00:00Z'),
      makeModel('c', '2024-05-01T00:00:00Z'),
    ];
    render(
      <MemoryRouter>
        <LatestUploads models={models} isLoading={false} />
      </MemoryRouter>,
    );
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings).toHaveLength(4);
    expect(headings[0]).toHaveTextContent('Model new');
    expect(headings[1]).toHaveTextContent('Model c');
    expect(headings[2]).toHaveTextContent('Model b');
    expect(headings[3]).toHaveTextContent('Model mid');
  });

  it('shows skeleton placeholders while loading', () => {
    const { container } = render(
      <MemoryRouter>
        <LatestUploads models={[]} isLoading={true} />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows an upload call-to-action when there are no models', () => {
    render(
      <MemoryRouter>
        <LatestUploads models={[]} isLoading={false} />
      </MemoryRouter>,
    );
    expect(screen.getByText('No models yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /upload a model/i })).toHaveAttribute(
      'href',
      '/upload',
    );
  });

  it('links each featured card to its detail page', () => {
    const models = [
      makeModel('one', '2024-01-01T00:00:00Z'),
      makeModel('two', '2024-02-01T00:00:00Z'),
    ];
    render(
      <MemoryRouter>
        <LatestUploads models={models} isLoading={false} />
      </MemoryRouter>,
    );
    const links = getAllByRole(
      screen.getByRole('region', { name: /latest uploads/i }),
      'link',
    );
    const modelLinks = links.filter((l) =>
      l.getAttribute('href')?.startsWith('/model/'),
    );
    expect(modelLinks).toHaveLength(2);
  });
});
