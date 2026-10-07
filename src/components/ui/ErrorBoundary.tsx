import { Component, Fragment, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

type FallbackFn = (state: { error: Error | null; retry: () => void }) => ReactNode;

interface Props {
  children: ReactNode;
  fallback?: ReactNode | FallbackFn;
}

interface State {
  hasError: boolean;
  error: Error | null;
  resetCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, resetCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState((previous) => ({
      hasError: false,
      error: null,
      resetCount: previous.resetCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;

      if (typeof fallback === 'function') {
        return fallback({ error: this.state.error, retry: this.handleRetry });
      }

      if (fallback) return fallback;

      return (
        <div className="flex h-full min-h-[200px] items-center justify-center rounded-card border border-danger/30 bg-danger/10 p-4">
          <div className="text-center">
            <p className="text-sm font-medium text-danger">Something went wrong</p>
            <p className="mt-1 text-xs text-ink-muted">
              {this.state.error?.message ?? 'Unknown error'}
            </p>
            <Button variant="secondary" className="mt-3 text-xs" onClick={this.handleRetry}>
              Try again
            </Button>
          </div>
        </div>
      );
    }

    return <Fragment key={this.state.resetCount}>{this.props.children}</Fragment>;
  }
}
