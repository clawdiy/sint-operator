import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [masked, setMasked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    fetch('/api/settings/api-key')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.masked) setMasked(data.masked); })
      .catch(() => {});
  }, []);

  const save = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save');
      const data = await res.json();
      setMasked(data.masked);
      setApiKey('');
      addToast('success', 'API key saved successfully');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <h1>⚙️ Settings</h1>
      <div className="card" style={{ maxWidth: 500, marginTop: 24, padding: 24 }}>
        <h3>OpenAI API Key</h3>
        {masked && (
          <p style={{ color: '#6c6', marginBottom: 12 }}>
            ✅ Current key: <code>{masked}</code>
          </p>
        )}
        <input
          type="password"
          placeholder="sk-..."
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          style={{ width: '100%', padding: 8, marginBottom: 12, boxSizing: 'border-box' }}
        />
        <button onClick={save} disabled={saving || !apiKey.trim()}>
          {saving ? 'Saving...' : 'Save API Key'}
        </button>
      </div>
    </div>
  );
}
