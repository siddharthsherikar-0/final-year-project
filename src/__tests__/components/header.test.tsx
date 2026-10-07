import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useAuthStore } from '@/stores/useAuthStore';

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

describe('Header authenticated navigation', () => {
  afterEach(() => {
    useAuthStore.setState({
      isAuthenticated: false,
      token: null,
      user: null,
      error: null,
      isLoading: false,
    });
  });

  it('offers Dashboard, Upload and Favorites to signed-in users', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      token: 'test-token',
      user: { id: 'u1', email: 'ada@studio.dev', name: 'Ada Lovelace' },
    });

    renderHeader();

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(within(nav).getByRole('link', { name: 'Upload' })).toHaveAttribute(
      'href',
      '/upload',
    );
    expect(within(nav).getByRole('link', { name: 'Favorites' })).toHaveAttribute(
      'href',
      '/favorites',
    );
    expect(within(nav).getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('includes Dashboard in the mobile menu', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      token: 'test-token',
      user: { id: 'u1', email: 'ada@studio.dev', name: 'Ada Lovelace' },
    });

    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /toggle navigation menu/i }));

    const mobile = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(within(mobile).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('keeps dashboard hidden while signed out', () => {
    renderHeader();

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).queryByRole('link', { name: 'Dashboard' })).toBeNull();
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
