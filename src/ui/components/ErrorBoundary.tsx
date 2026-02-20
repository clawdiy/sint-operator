import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-icon">⚠️</div>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message || 'An unexpected error occurred. Please try again.'}</p>
          <button
            className="btn primary"
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              window.location.hash = 'dashboard';
              window.location.reload();
            }}
          >
            ↻ Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
