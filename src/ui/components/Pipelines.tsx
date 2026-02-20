import React, { useEffect, useState } from 'react';
import { getPipelines, getBrands, runPipelineAndWait } from '../api';
import { useToast } from './Toast';
import Spinner from './Spinner';

interface Pipeline {
  id: string;
  name: string;
  description: string;
  version: string;
  inputs: Array<{ name: string; type: string; description?: string; required?: boolean; default?: unknown }>;
}

const PIPELINE_ICONS: Record<string, string> = {
  repurpose: '🔄', blog: '📝', calendar: '📅', social: '📱',
  seo: '🔍', email: '✉️', ad: '📢', video: '🎬',
  thread: '🧵', newsletter: '📰',
};

const PLATFORM_OPTIONS = [
  { id: 'twitter', label: 'Twitter', icon: '𝕏' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'facebook', label: 'Facebook', icon: '👥' },
  { id: 'threads', label: 'Threads', icon: '🧵' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
];

function getPipelineIcon(id: string): string {
  for (const [key, icon] of Object.entries(PIPELINE_ICONS)) {
    if (id.toLowerCase().includes(key)) return icon;
  }
  return '⚡';
}

export default function Pipelines() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [selected, setSelected] = useState<Pipeline | null>(null);
  const [brandId, setBrandId] = useState('');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState('');
  const [result, setResult] = useState<any>(null);
  const [copiedResult, setCopiedResult] = useState(false);

  useEffect(() => {
    Promise.all([
      getPipelines().catch(() => []),
      getBrands().catch(() => []),
    ]).then(([p, b]) => {
      setPipelines(Array.isArray(p) ? p : []);
      const brandArr = Array.isArray(b) ? b : [];
      setBrands(brandArr);
      if (brandArr.length > 0) setBrandId(brandArr[0].id);
      setLoading(false);
    });
  }, []);

  const selectPipeline = (p: Pipeline) => {
    setSelected(p);
    setResult(null);
    setRunStatus('');
    const defaults: Record<string, string> = {};
    p.inputs.forEach(inp => {
      if (inp.default !== undefined && inp.default !== null) {
        defaults[inp.name] = Array.isArray(inp.default) ? inp.default.join(', ') : String(inp.default);
      }
    });
    setInputs(defaults);
  };

  const handleRun = async () => {
    if (!selected || !brandId) {
      addToast('error', 'Please select a pipeline and brand');
      return;
    }
    setRunning(true);
    setRunStatus('queued');
    setResult(null);
    try {
      const parsedInputs: Record<string, unknown> = {};
      const missingRequired: string[] = [];

      for (const [key, val] of Object.entries(inputs)) {
        const input = selected.inputs.find(i => i.name === key);
        if (!input) continue;

        if (input.required && !String(val ?? '').trim()) {
          missingRequired.push(input.name);
          continue;
        }

        if (input.type === 'number') {
          const parsed = Number(val);
          if (Number.isNaN(parsed)) {
            addToast('error', `Input "${input.name}" must be a valid number`);
            setRunning(false);
            setRunStatus('');
            return;
          }
          parsedInputs[key] = parsed;
        } else if (input.type === 'boolean') {
          parsedInputs[key] = val === 'true';
        } else if (input.type === 'array') {
          const values = val.split(',').map(s => s.trim()).filter(Boolean);
          if (input.required && values.length === 0) {
            missingRequired.push(input.name);
            continue;
          }
          parsedInputs[key] = values;
        } else {
          parsedInputs[key] = val;
        }
      }

      if (missingRequired.length > 0) {
        addToast('error', `Missing required inputs: ${missingRequired.join(', ')}`);
        setRunning(false);
        setRunStatus('');
        return;
      }

      for (const input of selected.inputs) {
        if (input.required && inputs[input.name] === undefined) {
          if (input.type === 'boolean') {
            parsedInputs[input.name] = false;
            continue;
          }
          missingRequired.push(input.name);
        }
      }
      if (missingRequired.length > 0) {
        addToast('error', `Missing required inputs: ${missingRequired.join(', ')}`);
        setRunning(false);
        setRunStatus('');
        return;
      }

      const res = await runPipelineAndWait(selected.id, brandId, parsedInputs, {
        onStatus: status => setRunStatus(status),
      });
      setResult(res);
      addToast('success', `Pipeline "${selected.name}" completed!`);
    } catch (err: any) {
      addToast('error', err.message || 'Pipeline execution failed');
    } finally {
      setRunning(false);
      setRunStatus('');
    }
  };

  const isArrayInput = (inp: Pipeline['inputs'][0]) => {
    return inp.type === 'array' || inp.name.toLowerCase().includes('platform');
  };

  const isPlatformInput = (inp: Pipeline['inputs'][0]) => {
    return inp.name.toLowerCase().includes('platform');
  };

  const isLongTextInput = (inp: Pipeline['inputs'][0]) => {
    const key = inp.name.toLowerCase();
    return inp.type === 'text' || key.includes('content') || key.includes('text') || key.includes('article') || key.includes('body');
  };

  if (loading) return <Spinner text="Loading pipelines..." />;

  return (
    <div className="page">
      <h1>Pipelines</h1>
      <p className="subtitle">Run AI-powered content generation pipelines with your brand voice.</p>

      {/* Pipeline Cards Grid */}
      <div className="pipeline-cards">
        {pipelines.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">⚡</div>
              <div className="empty-title">No pipelines configured</div>
              <div className="empty-desc">Add pipeline YAML files to config/pipelines/ to get started.</div>
            </div>
          </div>
        ) : (
          pipelines.map(p => (
            <div
              key={p.id}
              className={`pipeline-card ${selected?.id === p.id ? 'active' : ''}`}
              onClick={() => selectPipeline(p)}
            >
              <div className="pipeline-card-icon">{getPipelineIcon(p.id)}</div>
              <div className="pipeline-card-name">{p.name}</div>
              <div className="pipeline-card-desc">{p.description}</div>
              {p.version && (
                <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  v{p.version} • {p.inputs.length} input{p.inputs.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Runner Form */}
      {selected && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h3 style={{ margin: 0 }}>{getPipelineIcon(selected.id)} {selected.name}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>{selected.description}</p>
            </div>
            <button className="btn small" onClick={() => { setSelected(null); setResult(null); }}>✕ Close</button>
          </div>

          <div className="runner-form">
            <div className="form-group">
              <label>Brand <span className="required">*</span></label>
              <select value={brandId} onChange={e => setBrandId(e.target.value)}>
                {brands.length === 0 && <option value="">No brands available</option>}
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {selected.inputs.map(inp => (
              <div className="form-group" key={inp.name}>
                <label>
                  {inp.name}
                  {inp.required && <span className="required">*</span>}
                  {inp.description && <small>{inp.description}</small>}
                </label>
                {inp.type === 'boolean' ? (
                  <select
                    value={inputs[inp.name] ?? 'false'}
                    onChange={e => setInputs({ ...inputs, [inp.name]: e.target.value })}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : isPlatformInput(inp) ? (
                  <div className="platform-checks">
                    {PLATFORM_OPTIONS.map(p => {
                      const current = (inputs[inp.name] || '').split(',').map(s => s.trim()).filter(Boolean);
                      const isChecked = current.includes(p.id);
                      return (
                        <label key={p.id} className={`platform-check ${isChecked ? 'selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const next = isChecked ? current.filter(c => c !== p.id) : [...current, p.id];
                              setInputs({ ...inputs, [inp.name]: next.join(', ') });
                            }}
                          />
                          <span>{p.icon}</span>
                          <span>{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : inp.type === 'number' ? (
                  <input
                    type="number"
                    placeholder={inp.description || inp.name}
                    value={inputs[inp.name] ?? ''}
                    onChange={e => setInputs({ ...inputs, [inp.name]: e.target.value })}
                  />
                ) : isLongTextInput(inp) ? (
                  <textarea
                    placeholder={inp.description || inp.name}
                    value={inputs[inp.name] ?? ''}
                    onChange={e => setInputs({ ...inputs, [inp.name]: e.target.value })}
                    style={{ minHeight: '96px' }}
                  />
                ) : (
                  <input
                    type="text"
                    placeholder={inp.description || (isArrayInput(inp) ? 'Comma-separated values' : inp.name)}
                    value={inputs[inp.name] ?? ''}
                    onChange={e => setInputs({ ...inputs, [inp.name]: e.target.value })}
                  />
                )}
              </div>
            ))}

            <button
              className={`btn primary ${running ? 'btn-loading' : ''}`}
              onClick={handleRun}
              disabled={running}
              style={{ width: '100%', padding: '14px 20px', fontSize: '15px' }}
            >
              {running ? `Running (${runStatus || 'starting'})...` : '▶ Run Pipeline'}
            </button>

            {running && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Executing pipeline... current status: <strong>{runStatus || 'starting'}</strong>
                </div>
                <div className="progress-bar"><div className="progress-bar-fill" /></div>
              </div>
            )}
          </div>

          {result && (
            <div className="result-box" style={{ marginTop: '24px' }}>
              <div className="result-header">
                <h4 style={{ margin: 0 }}>✅ Result</h4>
                <button className={`btn small copy-btn ${copiedResult ? 'copied' : ''}`} onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                  setCopiedResult(true);
                  addToast('success', 'Result copied!');
                  setTimeout(() => setCopiedResult(false), 2000);
                }}>
                  {copiedResult ? '✅ Copied!' : '📋 Copy'}
                </button>
              </div>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
