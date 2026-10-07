import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

const bombFlag = { shouldThrow: true, mounts: 0 };

function Bomb() {
  useEffect(() => {
    bombFlag.mounts += 1;
  }, []);
  if (bombFlag.shouldThrow) throw new Error('boom');
  return <div data-testid="bomb-ok">BOMB_OK</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    bombFlag.shouldThrow = true;
    bombFlag.mounts = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    bombFlag.shouldThrow = false;
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('bomb-ok')).toBeInTheDocument();
  });

  it('renders the default fallback with a retry action', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.queryByTestId('bomb-ok')).toBeNull();

    bombFlag.shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByTestId('bomb-ok')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(bombFlag.mounts).toBe(1);
  });

  it('re-catches when a retried child crashes again', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(bombFlag.mounts).toBe(0);

    bombFlag.shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByTestId('bomb-ok')).toBeInTheDocument();
    expect(bombFlag.mounts).toBe(1);
  });

  it('prefers a custom function fallback', () => {
    render(
      <ErrorBoundary
        fallback={({ error, retry }) => (
          <div>
            <p>Custom: {error?.message}</p>
            <button type="button" onClick={retry}>
              Custom retry
            </button>
          </div>
        )}
      >
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom: boom')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).toBeNull();

    bombFlag.shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Custom retry' }));
    expect(screen.getByTestId('bomb-ok')).toBeInTheDocument();
  });

  it('uses a static fallback when one is provided', () => {
    render(
      <ErrorBoundary fallback={<p>STATIC_FALLBACK</p>}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('STATIC_FALLBACK')).toBeInTheDocument();
  });
});
