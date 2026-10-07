import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
}

describe('Header', () => {
  it('shows the brand and main navigation', () => {
    renderHeader();
    expect(screen.getByText('3D Model Viewer')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Main navigation' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Gallery' }).length).toBeGreaterThan(0);
  });

  it('keeps the mobile menu closed initially', () => {
    renderHeader();
    expect(
      screen.queryByRole('navigation', { name: 'Mobile navigation' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /toggle navigation menu/i }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens and closes the mobile menu from the toggle button', () => {
    renderHeader();
    const toggle = screen.getByRole('button', { name: /toggle navigation menu/i });

    fireEvent.click(toggle);
    const mobileNav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(mobileNav).toBeInTheDocument();
    expect(within(mobileNav).getByText('Login')).toBeInTheDocument();
    expect(within(mobileNav).getByText('Register')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);
    expect(
      screen.queryByRole('navigation', { name: 'Mobile navigation' }),
    ).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Footer', () => {
  it('renders navigation links and credits', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Gallery' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByText(/final-year diploma project/i)).toBeInTheDocument();
  });
});
