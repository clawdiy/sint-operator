import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';

interface ApiKeyState {
  masked: string | null;
  loading: boolean;
  saving: boolean;
  value: string;
}

export default function Settings() {
  const { addToast } = useToast();
  const [openai, setOpenai] = useState<ApiKeyState>({ masked: null, loading: true, saving: false, value: '' });
  const [anthropic, setAnthropic] = useState<ApiKeyState>({ masked: null, loading: true, saving: false, value: '' });

  useEffect(() => {
    // Load current key status
    fetch('/api/settings/api-key')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.masked) setOpenai(prev => ({ ...prev, masked: data.masked, loading: false }));
        else setOpenai(prev => ({ ...prev, loading: false }));
      })
      .catch(() => setOpenai(prev => ({ ...prev, loading: false })));

    fetch('/api/settings/anthropic-key')
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
    const endpoint = provider === 'openai' ? '/api/settings/api-key' : '/api/settings/anthropic-key';
    const keyValue = state.value.trim();

    if (!keyValue) return;
    setState(prev => ({ ...prev, saving: true }));
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      <p className="subtitle">Manage API keys and configuration. Keys are encrypted and stored on your server.</p>

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

      <h2>System Info</h2>
      <div className="card" style={{ padding: 24 }}>
        <table className="table">
          <tbody>
            <tr><td style={{ color: 'var(--text-muted)', width: 140 }}>Version</td><td>v0.5.0</td></tr>
            <tr><td style={{ color: 'var(--text-muted)' }}>Skills</td><td>15</td></tr>
            <tr><td style={{ color: 'var(--text-muted)' }}>Pipelines</td><td>7</td></tr>
            <tr><td style={{ color: 'var(--text-muted)' }}>Auth</td><td>{process.env.AUTH_ENABLED === 'true' ? 'Enabled' : 'Open (no auth)'}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
