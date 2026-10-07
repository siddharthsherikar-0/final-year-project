import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('fires onClick and respects disabled state', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button onClick={onClick}>Act</Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Act
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies the requested variant styles', () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-elevated');
  });
});

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>GLB</Badge>);
    expect(screen.getByText('GLB')).toBeInTheDocument();
  });

  it('applies variant styles', () => {
    const { container } = render(<Badge variant="success">active</Badge>);
    expect(container.querySelector('span')).toHaveClass('text-success');
  });
});

describe('Input', () => {
  it('associates its label with the input', () => {
    render(<Input label="Email" type="email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('exposes errors via role and aria attributes', () => {
    render(<Input label="Password" error="Password is required" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Password is required');
  });
});

describe('Skeleton', () => {
  it('renders an animated placeholder', () => {
    const { container } = render(<Skeleton className="h-10 w-40" />);
    expect(container.firstElementChild).toHaveClass('animate-pulse');
  });
});

describe('EmptyState', () => {
  it('renders title, description and action', () => {
    render(
      <EmptyState
        title="Nothing here"
        description="Try a different search."
        action={<button>Browse</button>}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Nothing here' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Try a different search.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse' })).toBeInTheDocument();
  });
});
