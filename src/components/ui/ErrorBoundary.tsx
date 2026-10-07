import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-red-800">
                Something went wrong
              </p>
              <p className="mt-1 text-xs text-red-600">
                {this.state.error?.message ?? 'Unknown error'}
              </p>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
