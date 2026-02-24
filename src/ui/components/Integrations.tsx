import React, { useEffect, useState } from 'react';
import { getOAuthStatus, disconnectOAuth } from '../api';

interface ProviderStatus {
  connected: boolean;
  email?: string;
  expiresAt?: string;
}

const PROVIDERS = [
  { id: 'google', name: 'Google Workspace', icon: '🔵', description: 'Drive, Docs, Sheets' },
  { id: 'facebook', name: 'Meta / Facebook', icon: '📘', description: 'Facebook & Instagram publishing' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼', description: 'LinkedIn publishing' },
  { id: 'twitter', name: 'Twitter / X', icon: '🐦', description: 'Twitter publishing' },
  { id: 'shopify', name: 'Shopify', icon: '🛒', description: 'Product image metadata' },
];

const ENV_INTEGRATIONS = [
  { name: 'OpenAI', key: 'OPENAI_API_KEY', description: 'GPT models, DALL-E image gen' },
  { name: 'Anthropic', key: 'ANTHROPIC_API_KEY', description: 'Claude models' },
  { name: 'Stability AI', key: 'STABILITY_API_KEY', description: 'Stable Diffusion image gen' },
  { name: 'Runway', key: 'RUNWAY_API_KEY', description: 'AI video generation' },
  { name: 'Banana.dev', key: 'BANANA_API_KEY', description: 'GPU-accelerated gen tasks' },
  { name: 'Telegram Bot', key: 'TELEGRAM_BOT_TOKEN', description: 'Chat bot interface' },
  { name: 'OpenClaw', key: 'OPENCLAW_WEBHOOK_SECRET', description: 'Agent orchestration' },
];

const cardStyle: React.CSSProperties = {
  background: '#1e1e2e', borderRadius: 12, padding: 20, marginBottom: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const btnConnect: React.CSSProperties = {
  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 20px', cursor: 'pointer', fontWeight: 600,
};
const btnDisconnect: React.CSSProperties = {
  ...btnConnect, background: '#ef4444',
};
const badge: (connected: boolean) => React.CSSProperties = (connected) => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
  background: connected ? '#22c55e22' : '#64748b22',
  color: connected ? '#22c55e' : '#94a3b8',
});

export default function Integrations() {
  const [status, setStatus] = useState<Record<string, ProviderStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOAuthStatus().then(setStatus).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleConnect = (provider: string) => {
    window.open(`/api/oauth/${provider}/authorize`, '_blank');
  };

  const handleDisconnect = async (provider: string) => {
    await disconnectOAuth(provider);
    setStatus(prev => ({ ...prev, [provider]: { connected: false } }));
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🔌 Integrations</h2>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>Connect external services to unlock full pipeline capabilities.</p>

      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>OAuth Connections</h3>
      {PROVIDERS.map(p => {
        const s = status[p.id];
        return (
          <div key={p.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>{p.icon}</span>
              <div>
                <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{p.name}</div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>{p.description}</div>
                {s?.email && <div style={{ fontSize: 12, color: '#6366f1', marginTop: 2 }}>{s.email}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={badge(!!s?.connected)}>{s?.connected ? 'Connected' : 'Not connected'}</span>
              {s?.connected
                ? <button style={btnDisconnect} onClick={() => handleDisconnect(p.id)}>Disconnect</button>
                : <button style={btnConnect} onClick={() => handleConnect(p.id)}>Connect</button>
              }
            </div>
          </div>
        );
      })}

      <h3 style={{ fontSize: 18, fontWeight: 600, margin: '32px 0 12px', color: '#e2e8f0' }}>API Key Integrations</h3>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>These are configured via environment variables on your server.</p>
      {ENV_INTEGRATIONS.map(i => (
        <div key={i.key} style={{ ...cardStyle, opacity: 0.85 }}>
          <div>
            <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{i.name}</div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>{i.description}</div>
          </div>
          <code style={{ fontSize: 12, color: '#6366f1', background: '#6366f115', padding: '4px 8px', borderRadius: 6 }}>{i.key}</code>
        </div>
      ))}
    </div>
  );
}
