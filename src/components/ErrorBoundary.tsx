import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Global error boundary — catches render-time crashes anywhere in the tree and
 * shows a recoverable fallback instead of a white screen (important for an
 * unattended counter terminal). Async/event errors aren't caught by React
 * boundaries; those are handled via the API-error → toast path.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for debugging; a remote logger could hook in here later.
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <AlertTriangle className="size-10 text-destructive" />
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              The terminal hit an unexpected error. Reloading usually fixes it; any queued
              offline sales are kept.
            </p>
          </div>
          {import.meta.env.DEV && (
            <pre className="max-w-md overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <Button onClick={this.handleReload}>Reload app</Button>
        </div>
      );
    }

    return this.props.children;
  }
}
