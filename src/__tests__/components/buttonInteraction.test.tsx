import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

describe('Button interaction system', () => {
  it('keeps its API: default type is button, variants keep their labels', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button', { name: 'Primary' });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('exposes an explicit submit type when requested', () => {
    render(<Button type="submit">Upload</Button>);
    expect(screen.getByRole('button', { name: 'Upload' })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  it('uses the consolidated focus strategy and an active state', () => {
    render(<Button>Focus</Button>);
    const button = screen.getByRole('button', { name: 'Focus' });
    const classes = button.className;
    expect(classes).toContain('focus-ring');
    expect(classes).toContain('active:translate-y-px');
    // A targeted transition list, never the all-property `transition`.
    expect(classes).toContain('transition-[background-color');
    expect(classes).not.toMatch(/(^|\s)transition(\s|$)/);
    expect(classes).toContain('motion-reduce:transition-none');
  });

  it('meets a 44px minimum tap target', () => {
    render(<Button>Target</Button>);
    expect(screen.getByRole('button', { name: 'Target' }).className).toContain(
      'min-h-[44px]',
    );
  });

  it('still disables correctly and does not fire onClick', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button.className).toContain('disabled:opacity-50');
  });

  it('fires onClick when enabled', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Enabled</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Enabled' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ButtonLink', () => {
  it('renders exactly one interactive element (a link, never a button)', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/upload">Upload</ButtonLink>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Upload' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/upload');
    expect(screen.queryByRole('button')).toBeNull();
    expect(link.querySelector('button')).toBeNull();
  });

  it('contains no nested interactive element anywhere in its subtree', () => {
    const { container } = render(
      <MemoryRouter>
        <ButtonLink to="/favorites">
          <span>Favorites</span>
        </ButtonLink>
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('a button, a a')).toHaveLength(0);
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });

  it('supports the same variant vocabulary as Button', () => {
    const { rerender } = render(
      <MemoryRouter>
        <ButtonLink to="/">Primary</ButtonLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link').className).toContain('bg-accent');
    rerender(
      <MemoryRouter>
        <ButtonLink to="/" variant="secondary">
          Secondary
        </ButtonLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link').className).toContain('border-control');
    rerender(
      <MemoryRouter>
        <ButtonLink to="/" variant="ghost">
          Ghost
        </ButtonLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link').className).toContain('text-ink-muted');
  });

  it('applies the same focus strategy, active state and target size as Button', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/">Consistent</ButtonLink>
      </MemoryRouter>,
    );
    const classes = screen.getByRole('link').className;
    expect(classes).toContain('focus-ring');
    expect(classes).toContain('active:translate-y-px');
    expect(classes).toContain('min-h-[44px]');
  });

  it('accepts className and forwards it', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/" className="mt-4 self-start">
          Composed
        </ButtonLink>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link');
    expect(link.className).toContain('mt-4');
    expect(link.className).toContain('self-start');
  });

  it('navigates when activated', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ButtonLink to="/target">Go</ButtonLink>} />
          <Route path="/target" element={<p data-testid="landed">Landed</p>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Go' }));
    expect(screen.getByTestId('landed')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/target');
  });
});