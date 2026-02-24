import React, { useEffect, useState } from 'react';
import { getPipelines, getBrands, runPipeline, isAsyncRunStart, streamRun, uploadAsset } from '../api';
import { useToast } from './Toast';
import Spinner from './Spinner';

interface Pipeline {
  id: string;
  name: string;
  description: string;
  version: string;
  inputs: Array<{ name: string; type: string; description?: string; required?: boolean; default?: unknown }>;
  steps?: Array<{ id: string; skill: string; description?: string; action?: string }>;
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


const SKILL_ICONS: Record<string, string> = {
  'asset-ingester': '📥', ingester: '📥', ingest: '📥',
  'content-analyzer': '🧠', analyzer: '🧠', analyze: '🧠',
  'content-repurpose': '📤', repurpose: '📤', generate: '📤',
  formatter: '✍️', writer: '✍️', publisher: '🚀',
  default: '⚙️',
};

function getSkillIcon(skill: string): string {
  for (const [key, icon] of Object.entries(SKILL_ICONS)) {
    if (skill.toLowerCase().includes(key)) return icon;
  }
  return SKILL_ICONS.default;
}

function PipelineSteps({ steps, streamSteps, running, result }: {
  steps: Array<{ id: string; skill: string; description?: string; action?: string }>;
  streamSteps: any[];
  running: boolean;
  result: any;
}) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const completedIds = new Set(streamSteps.filter(s => s.type === 'step_complete').map(s => s.data?.step || s.data?.name));
  const activeStep = streamSteps.length > 0 ? streamSteps[streamSteps.length - 1] : null;
  const activeId = activeStep && activeStep.type !== 'step_complete' ? (activeStep.data?.step || activeStep.data?.name) : null;

  // Get step output from result
  const getStepOutput = (stepId: string) => {
    if (!result) return null;
    const runSteps = result.steps || [];
    const match = runSteps.find((s: any) => s.stepId === stepId || s.id === stepId);
    return match?.output || match?.result || null;
  };

  // Render step output content
  const renderOutput = (output: any) => {
    if (!output) return <div style={{ color: '#64748b', fontSize: 13, padding: 12 }}>No output data</div>;
    
    // Check for images
    const images = output.images || [];
    const hasImages = Array.isArray(images) && images.length > 0;
    
    return (
      <div style={{ padding: '12px 0' }}>
        {hasImages && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>🖼️ Generated Images</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {images.filter((img: any) => img.url).map((img: any, i: number) => (
                <a key={i} href={img.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                  <img src={img.url} alt={img.revisedPrompt || ''} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid #2a2a4a' }} loading="lazy" />
                </a>
              ))}
            </div>
          </div>
        )}
        {output.summary && (
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {typeof output.summary === 'string' ? output.summary : JSON.stringify(output.summary, null, 2)}
          </div>
        )}
        {output.deliverables && Array.isArray(output.deliverables) && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>📦 {output.deliverables.length} deliverables</div>
            {output.deliverables.slice(0, 3).map((d: any, i: number) => (
              <div key={i} style={{ background: '#0f0f1a', borderRadius: 8, padding: '10px 14px', marginBottom: 6, borderLeft: '3px solid #6366f1' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  {d.platform && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#6366f122', color: '#6366f1', fontWeight: 600 }}>{d.platform}</span>}
                  {d.format && <span style={{ fontSize: 11, color: '#64748b' }}>{d.format}</span>}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'pre-wrap' }}>{(d.content || '').slice(0, 200)}{(d.content || '').length > 200 ? '...' : ''}</div>
              </div>
            ))}
            {output.deliverables.length > 3 && <div style={{ fontSize: 12, color: '#64748b' }}>+ {output.deliverables.length - 3} more...</div>}
          </div>
        )}
        {output.publish_queue && Array.isArray(output.publish_queue) && (
          <div style={{ fontSize: 13, color: '#22c55e' }}>📤 {output.publish_queue.length} posts queued for publishing</div>
        )}
        {output.calendar && (
          <div style={{ fontSize: 13, color: '#6366f1' }}>📅 Calendar created with scheduled posts</div>
        )}
        {!hasImages && !output.summary && !output.deliverables && !output.publish_queue && (
          <pre style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', background: '#0f0f1a', padding: 12, borderRadius: 8 }}>
            {JSON.stringify(output, null, 2).slice(0, 2000)}
          </pre>
        )}
      </div>
    );
  };

  return (
    <div className="pipeline-flow">
      {steps.map((step, i) => {
        const isDone = result || completedIds.has(step.id) || completedIds.has(step.skill);
        const isActive = running && !isDone && (activeId === step.id || activeId === step.skill || (i === 0 && running && streamSteps.length === 0));
        const statusClass = isDone ? 'step-done' : isActive ? 'step-active' : 'step-pending';
        const isExpanded = expandedStep === step.id;
        const stepOutput = getStepOutput(step.id);
        const hasOutput = isDone && (result || stepOutput);

        return (
          <React.Fragment key={step.id}>
            {i > 0 && <div className="step-connector">→</div>}
            <div 
              className={`pipeline-step ${statusClass}`}
              style={{ cursor: hasOutput ? 'pointer' : 'default' }}
              onClick={() => hasOutput && setExpandedStep(isExpanded ? null : step.id)}
            >
              <div className="pipeline-step-icon">{getSkillIcon(step.skill)}</div>
              <div className="pipeline-step-name">{step.skill.replace(/-/g, ' ')}</div>
              {step.action && <div className="pipeline-step-desc">{step.action.slice(0, 60)}...</div>}
              {hasOutput && (
                <div className="pipeline-step-link" style={{ color: '#22c55e', cursor: 'pointer', fontWeight: 600 }}>
                  {isExpanded ? '▼ Hide output' : '▶ View output'}
                </div>
              )}
              {isActive && <div style={{ color: '#eab308', fontSize: 12, marginTop: 4 }}>⏳ Running...</div>}
            </div>
            {isExpanded && stepOutput && (
              <div style={{ 
                width: '100%', background: '#1a1a2e', borderRadius: 8, padding: '8px 16px',
                marginTop: -8, marginBottom: 8, border: '1px solid #2a2a4a', maxHeight: 400, overflow: 'auto'
              }}>
                {renderOutput(stepOutput)}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function FileDropZone({ onText }: { onText: (text: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadAsset(file);
      if (res?.text) {
        onText(res.text);
      } else if (res?.id) {
        onText(`[Uploaded: ${file.name}]`);
      }
    } catch {
      // fallback: read as text
      const text = await file.text();
      onText(text);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`file-drop-zone ${dragging ? 'dragging' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
      onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.md,.pdf,.doc,.docx';
        input.onchange = () => { if (input.files?.[0]) handleFile(input.files[0]); };
        input.click();
      }}
    >
      {uploading ? '⏳ Uploading...' : '📎 Or upload a file (drag & drop or click)'}
    </div>
  );
}


function getPipelineIcon(id: string): string {
  for (const [key, icon] of Object.entries(PIPELINE_ICONS)) {
    if (id.toLowerCase().includes(key)) return icon;
  }
  return '⚡';
}


const QUICK_PIPELINES = new Set(['content-repurpose', 'seo-blog', 'social-calendar']);

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
  const [streamSteps, setStreamSteps] = useState<any[]>([]);

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

      const started = await runPipeline(selected.id, brandId, parsedInputs);
      if (isAsyncRunStart(started)) {
        setRunStatus('running');
        setStreamSteps([]);
        await new Promise<void>((resolve, reject) => {
          streamRun(started.runId, {
            onStep: (step) => {
              setStreamSteps(prev => [...prev, step]);
              setRunStatus(step.data?.name || 'running');
            },
            onComplete: (data) => { setResult(data); resolve(); },
            onError: (err) => reject(new Error(err)),
          });
        });
        addToast('success', `Pipeline "${selected.name}" completed!`);
      } else {
        setResult(started);
        addToast('success', `Pipeline "${selected.name}" completed!`);
      }
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
      <div className="pipeline-cards pipeline-grid">
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

      {/* Runner Form — Modal Overlay */}
      {selected && (
        <div className="pipeline-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setSelected(null); setResult(null); } }}>
          <div className="pipeline-modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h3 style={{ margin: 0 }}>{getPipelineIcon(selected.id)} {selected.name}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>{selected.description}</p>
              </div>
              <button className="btn small" onClick={() => { setSelected(null); setResult(null); }}>✕ Close</button>
            </div>

          {selected.steps && selected.steps.length > 0 && (
            <PipelineSteps steps={selected.steps} streamSteps={streamSteps} running={running} result={result} />
          )}

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
                  <>
                    <textarea
                      placeholder={inp.description || inp.name}
                      value={inputs[inp.name] ?? ''}
                      onChange={e => setInputs({ ...inputs, [inp.name]: e.target.value })}
                      style={{ minHeight: '96px' }}
                    />
                    <FileDropZone onText={(text) => setInputs({ ...inputs, [inp.name]: text })} />
                  </>
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
                {streamSteps.length > 0 && (
                  <div className="sse-steps" style={{ marginTop: '12px' }}>
                    {streamSteps.map((s, i) => (
                      <div key={i} className={"sse-step " + (s.type === 'step_complete' ? 'done' : 'active')}>
                        <span>{s.type === 'step_complete' ? '✅' : '⏳'}</span>
                        <span>{s.data?.name || s.data?.step || ('Step ' + (i + 1))}</span>
                      </div>
                    ))}
                  </div>
                )}
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
        </div>
      )}
    </div>
  );
}
