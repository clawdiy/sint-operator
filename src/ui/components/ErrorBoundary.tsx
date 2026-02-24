import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: '24px', margin: 0 }}>Something went wrong</h1>
          <p style={{ color: '#888', margin: 0 }}>{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '16px' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
