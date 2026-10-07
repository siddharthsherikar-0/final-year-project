import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchBar } from '@/components/search/SearchBar';
import { FilterPanel } from '@/components/search/FilterPanel';

describe('SearchBar', () => {
  it('renders search input', () => {
    render(
      <MemoryRouter>
        <SearchBar />
      </MemoryRouter>,
    );
    expect(screen.getByPlaceholderText(/search models/i)).toBeInTheDocument();
  });
});

describe('FilterPanel', () => {
  it('renders category filters', () => {
    render(
      <MemoryRouter>
        <FilterPanel />
      </MemoryRouter>,
    );
    expect(screen.getByText('Architecture')).toBeInTheDocument();
    expect(screen.getByText('Characters')).toBeInTheDocument();
  });

  it('renders format filters', () => {
    render(
      <MemoryRouter>
        <FilterPanel />
      </MemoryRouter>,
    );
    expect(screen.getByText('GLB')).toBeInTheDocument();
    expect(screen.getByText('GLTF')).toBeInTheDocument();
  });
});
