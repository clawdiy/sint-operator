import React, { useState, useEffect } from 'react';
import { API_BASE, getSocialStatus, connectSocial } from '../api';
import { useToast } from './Toast';

interface ApiKeyState {
  masked: string | null;
  loading: boolean;
  saving: boolean;
  value: string;
}

interface SocialStatus {
  twitter: { configured: boolean; handle?: string };
  linkedin: { configured: boolean; personUrn?: string };
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sint_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function SystemInfo() {
  const [info, setInfo] = React.useState<any>(null);
  React.useEffect(() => {
    fetch(`${API_BASE}/health`).then(r => r.json()).then(setInfo).catch(() => {});
  }, []);
  return (
    <>
      <h2>System Info</h2>
      <div className="card" style={{ padding: 24 }}>
        <table className="table">
          <tbody>
            <tr><td style={{ color: 'var(--text-muted)', width: 140 }}>Version</td><td>{info?.version ? 'v' + info.version : '...'}</td></tr>
            <tr><td style={{ color: 'var(--text-muted)' }}>Skills</td><td>{info?.skills ?? '...'}</td></tr>
            <tr><td style={{ color: 'var(--text-muted)' }}>Pipelines</td><td>{info?.pipelines ?? '...'}</td></tr>
            <tr><td style={{ color: 'var(--text-muted)' }}>Brands</td><td>{info?.brands ?? '...'}</td></tr>
            <tr><td style={{ color: 'var(--text-muted)' }}>Status</td><td style={{ color: info?.status === 'ok' ? 'var(--success)' : 'var(--text-muted)' }}>{info?.status === 'ok' ? '● Healthy' : '...'}</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function ConnectModal({ platform, onClose, onSaved }: { platform: 'twitter' | 'linkedin'; onClose: () => void; onSaved: () => void }) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const configs = {
    twitter: {
      title: '𝕏 Connect Twitter',
      steps: [
        'Go to developer.twitter.com and sign in',
        'Create a new app with Read+Write permissions',
        'Navigate to "Keys and Tokens" tab',
        'Copy your API Key, API Secret, Access Token, and Access Secret',
      ],
      fields: [
        { key: 'apiKey', label: 'API Key', placeholder: 'Enter API Key' },
        { key: 'apiSecret', label: 'API Secret', placeholder: 'Enter API Secret' },
        { key: 'accessToken', label: 'Access Token', placeholder: 'Enter Access Token' },
        { key: 'accessSecret', label: 'Access Secret', placeholder: 'Enter Access Secret' },
        { key: 'handle', label: 'Handle (optional)', placeholder: '@yourhandle' },
      ],
    },
    linkedin: {
      title: '💼 Connect LinkedIn',
      steps: [
        'Go to linkedin.com/developers and create an app',
        'Request "Share on LinkedIn" and "Sign In with LinkedIn" products',
        'Generate an access token with w_member_social scope',
        'Find your Person URN (urn:li:person:XXXXX)',
      ],
      fields: [
        { key: 'accessToken', label: 'Access Token', placeholder: 'Enter Access Token' },
        { key: 'personUrn', label: 'Person URN', placeholder: 'urn:li:person:...' },
      ],
    },
  };

  const config = configs[platform];

  const handleSave = async () => {
    const requiredKeys = config.fields.filter(f => !f.label.includes('optional')).map(f => f.key);
    const missing = requiredKeys.filter(k => !fields[k]?.trim());
    if (missing.length > 0) {
      addToast('error', `Please fill in all required fields`);
      return;
    }
    setSaving(true);
    try {
      await connectSocial(platform, fields);
      addToast('success', `${platform} connected successfully!`);
      onSaved();
      onClose();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="connect-modal" onClick={onClose}>
      <div className="connect-modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>{config.title}</h3>
          <button className="btn small" onClick={onClose}>✕</button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Setup Steps:</h4>
          <ol style={{ paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {config.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>

        {config.fields.map(f => (
          <div className="form-group" key={f.key} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>{f.label}</label>
            <input
              type="password"
              placeholder={f.placeholder}
              value={fields[f.key] || ''}
              onChange={e => setFields({ ...fields, [f.key]: e.target.value })}
            />
          </div>
        ))}

        <button
          className={`btn primary ${saving ? 'btn-loading' : ''}`}
          onClick={handleSave}
          disabled={saving}
          style={{ width: '100%', marginTop: 8 }}
        >
          {saving ? 'Saving...' : 'Save Credentials'}
        </button>
      </div>
    </div>
  );
}

function ConnectedAccounts() {
  const [status, setStatus] = useState<SocialStatus | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<'twitter' | 'linkedin' | null>(null);

  const loadStatus = () => {
    getSocialStatus().then(setStatus).catch(() => {});
  };

  useEffect(() => { loadStatus(); }, []);

  const platforms = [
    { id: 'twitter' as const, name: 'Twitter / X', icon: '𝕏', color: '#1DA1F2', configured: status?.twitter?.configured, detail: status?.twitter?.handle },
    { id: 'linkedin' as const, name: 'LinkedIn', icon: '💼', color: '#0A66C2', configured: status?.linkedin?.configured, detail: status?.linkedin?.personUrn },
    { id: null, name: 'Instagram', icon: '📸', color: '#E4405F', configured: false, detail: null },
    { id: null, name: 'Facebook', icon: '👥', color: '#1877F2', configured: false, detail: null },
  ];

  return (
    <>
      <h2>Connected Accounts</h2>
      <div className="social-accounts">
        {platforms.map((p, i) => (
          <div key={i} className="social-card" style={{ borderTopColor: p.color }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{p.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  {p.configured && p.detail && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.detail}</div>
                  )}
                </div>
              </div>
              {p.configured ? (
                <span className="badge badge-success"><span className="badge-dot" />Connected</span>
              ) : p.id ? (
                <button className="btn small" onClick={() => setConnectingPlatform(p.id)}>Connect</button>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Coming soon</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {connectingPlatform && (
        <ConnectModal
          platform={connectingPlatform}
          onClose={() => setConnectingPlatform(null)}
          onSaved={loadStatus}
        />
      )}
    </>
  );
}

export default function Settings() {
  const { addToast } = useToast();
  const [openai, setOpenai] = useState<ApiKeyState>({ masked: null, loading: true, saving: false, value: '' });
  const [anthropic, setAnthropic] = useState<ApiKeyState>({ masked: null, loading: true, saving: false, value: '' });

  useEffect(() => {
    fetch(`${API_BASE}/api/settings/api-key`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.masked) setOpenai(prev => ({ ...prev, masked: data.masked, loading: false }));
        else setOpenai(prev => ({ ...prev, loading: false }));
      })
      .catch(() => setOpenai(prev => ({ ...prev, loading: false })));

    fetch(`${API_BASE}/api/settings/anthropic-key`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.masked) setAnthropic(prev => ({ ...prev, masked: data.masked, loading: false }));
        else setAnthropic(prev => ({ ...prev, loading: false }));
      })
      .catch(() => setAnthropic(prev => ({ ...prev, loading: false })));
  }, []);

  const saveKey = async (provider: 'openai' | 'anthropic') => {
    const state = provider === 'openai' ? openai : anthropic;
    const setState = provider === 'openai' ? setOpenai : setAnthropic;
    const endpoint = provider === 'openai'
      ? `${API_BASE}/api/settings/api-key`
      : `${API_BASE}/api/settings/anthropic-key`;
    const keyValue = state.value.trim();

    if (!keyValue) return;
    setState(prev => ({ ...prev, saving: true }));
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ apiKey: keyValue }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save');
      const data = await res.json();
      setState(prev => ({ ...prev, masked: data.masked || keyValue.slice(0, 6) + '...', value: '', saving: false }));
      addToast('success', `${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key saved`);
    } catch (err: any) {
      setState(prev => ({ ...prev, saving: false }));
      addToast('error', err.message || 'Failed to save');
    }
  };

  const renderKeyCard = (
    title: string,
    description: string,
    placeholder: string,
    helpUrl: string,
    helpText: string,
    provider: 'openai' | 'anthropic',
    state: ApiKeyState,
    setState: React.Dispatch<React.SetStateAction<ApiKeyState>>
  ) => (
    <div className="card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{description}</p>
        </div>
        {state.masked && (
          <span className="badge badge-success">
            <span className="badge-dot" />
            Connected
          </span>
        )}
      </div>

      {state.masked && (
        <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', marginBottom: 14, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
          {state.masked}
        </div>
      )}

      <div className="form-group" style={{ marginBottom: 12 }}>
        <input
          type="password"
          placeholder={placeholder}
          value={state.value}
          onChange={e => setState(prev => ({ ...prev, value: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') saveKey(provider); }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          className={`btn primary ${state.saving ? 'btn-loading' : ''}`}
          onClick={() => saveKey(provider)}
          disabled={state.saving || !state.value.trim()}
        >
          {state.saving ? 'Saving...' : state.masked ? 'Update Key' : 'Save Key'}
        </button>
        <a href={helpUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--accent)' }}>
          {helpText} ↗
        </a>
      </div>
    </div>
  );

  return (
    <div className="page">
      <h1>Settings</h1>
      <p className="subtitle">Manage API keys, social accounts, and configuration.</p>

      <h2>API Keys</h2>
      <div className="card" style={{ padding: '14px 18px', marginBottom: 20, border: '1px solid rgba(59, 130, 246, 0.2)', background: 'rgba(59, 130, 246, 0.05)' }}>
        <p style={{ fontSize: 13, color: 'var(--info)', margin: 0 }}>
          💡 <strong>BYOK (Bring Your Own Key)</strong> — You pay your AI provider directly. No markup, no middleman. Your content never trains third-party models.
        </p>
      </div>

      {renderKeyCard(
        'OpenAI',
        'Used for GPT-4o and routine tasks (formatting, short-form content).',
        'sk-...',
        'https://platform.openai.com/api-keys',
        'Get API key',
        'openai',
        openai,
        setOpenai
      )}

      {renderKeyCard(
        'Anthropic (Claude)',
        'Used for complex tasks — long-form writing, strategy, deep analysis.',
        'sk-ant-...',
        'https://console.anthropic.com',
        'Get API key',
        'anthropic',
        anthropic,
        setAnthropic
      )}

      <ConnectedAccounts />

      <SystemInfo />
    </div>
  );
}
