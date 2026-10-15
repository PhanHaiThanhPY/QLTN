import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AppErrorFallback } from './AppErrorFallback';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Defaults to the full-page app fallback. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Root render-error boundary; the router keeps its own errorElement for route errors. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) return this.props.fallback ?? <AppErrorFallback />;
    return this.props.children;
  }
}
