import React from 'react';

export default function NotFound({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🔍</div>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Page Not Found</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>The page you're looking for doesn't exist or has been moved.</p>
      <button className="btn primary" onClick={() => onNavigate('dashboard')}>
        ← Go to Dashboard
      </button>
    </div>
  );
}
