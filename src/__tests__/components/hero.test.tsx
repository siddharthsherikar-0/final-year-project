import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Hero } from '@/components/landing/Hero';
import type { ModelMetadata } from '@/types';

const makeModel = (
  id: string,
  overrides: Partial<ModelMetadata> = {},
): ModelMetadata => ({
  id,
  name: `Model ${id}`,
  description: `Description ${id}`,
  category: 'other',
  format: 'glb',
  fileUrl: `/models/${id}.glb`,
  thumbnailUrl: `/models/${id}-thumb.jpg`,
  fileSize: 1024,
  hasTextures: false,
  hasAnimations: false,
  tags: ['test'],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

function renderHero(featured: ModelMetadata[] = [], isLoading = false) {
  return render(
    <MemoryRouter>
      <Hero
        stats={{ total: 6, categories: 3, formats: 2 }}
        isLoading={isLoading}
        featured={featured}
      />
    </MemoryRouter>,
  );
}

describe('Hero', () => {
  it('states the product value proposition, not a generic SaaS pitch', () => {
    renderHero();
    expect(
      screen.getByRole('heading', { level: 1, name: /studio for 3d assets/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/rendered from the actual glb file/i)).toBeInTheDocument();
    expect(screen.getByText(/webgl viewer/i)).toBeInTheDocument();
  });

  it('links Browse to the gallery anchor and Upload to /upload', () => {
    renderHero();
    expect(
      screen.getByRole('link', { name: /browse the gallery/i }),
    ).toHaveAttribute('href', '#gallery');
    expect(screen.getByRole('link', { name: /upload a model/i })).toHaveAttribute(
      'href',
      '/upload',
    );
  });

  it('shows real library stats once loaded, in technical type', () => {
    const { container } = renderHero();
    expect(screen.getByText('Models')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Formats')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
// Numbers are technical facts, so they wear the mono face.
    const stats = container.querySelector('dl')!;
    expect(stats.querySelectorAll('.font-mono')).toHaveLength(3);
  });

  it('shows skeletons instead of numbers while loading', () => {
    const { container } = renderHero([], true);
    // Three stat skeletons, plus placeholders for the featured asset tiles.
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /browse the gallery/i }),
    ).toBeInTheDocument();
  });

  it('anchors on real model previews instead of abstract decoration', () => {
    renderHero([
      makeModel('a', { name: 'Observatory' }),
      makeModel('b', { name: 'Crane' }),
    ]);
    const links = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/model/'));
    expect(links).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: 'Observatory — open model' }),
    ).toBeInTheDocument();
  });

  it('invites the first upload when the gallery is empty', () => {
    renderHero([]);
    expect(
      screen.getByText(/no models published yet/i),
    ).toBeInTheDocument();
  });

  it('keeps decorative gradients out of the backdrop', () => {
    const { container } = renderHero([makeModel('a')]);
    const section = container.querySelector('section')!;
    expect(section.className).not.toMatch(/blur-\[/);
    expect(section.innerHTML).not.toMatch(/bg-accent\/\d+ blur/);
  });
});

