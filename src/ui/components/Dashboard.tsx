import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  getHealth,
  getRuns,
  getUsage,
  getBrands,
  getPipelines,
  runPipeline,
  repurposeContent,
  generateBlog,
  generateCalendar,
  cancelRun,
  getDeadLetterQueue,
  retryDeadLetterItem,
  normalizeRunPayload,
  isAsyncRunStart,
  isRunInProgress,
  streamRun,
  getApprovals,
} from '../api';
import { useToast } from './Toast';
import Spinner from './Spinner';

type Page = 'dashboard' | 'pipelines' | 'brands' | 'results' | 'assets' | 'usage' | 'skills' | 'settings' | 'approvals' | 'integrations';

interface Props {
  onNavigate: (page: Page) => void;
}

const PLATFORMS = [
  { id: 'twitter', label: 'Twitter', icon: '𝕏' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'facebook', label: 'Facebook', icon: '👥' },
  { id: 'threads', label: 'Threads', icon: '🧵' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
];

function sortRunsByStartedAt(runs: any[]): any[] {
  return [...runs].sort((a, b) => Date.parse(b.startedAt ?? '') - Date.parse(a.startedAt ?? ''));
}

const PIPELINE_QUICK_ACTIONS = [
  { id: 'content-repurpose', name: 'Content Repurpose', icon: '🔄', desc: 'Transform content for multiple platforms' },
  { id: 'ad-variations', name: 'Ad Variations', icon: '📢', desc: 'Generate ad copy variations' },
  { id: 'brand-identity', name: 'Brand Identity', icon: '🎨', desc: 'Create brand guidelines & assets' },
  { id: 'seo-blog', name: 'SEO Blog', icon: '📝', desc: 'SEO-optimized blog posts' },
  { id: 'social-calendar', name: 'Social Calendar', icon: '📅', desc: 'Multi-day content calendar' },
  { id: 'infographic', name: 'Infographic', icon: '📊', desc: 'Data-driven infographics' },
  { id: 'visual-metadata', name: 'Visual Metadata', icon: '🖼️', desc: 'OG images & metadata' },
];

const PIPELINE_NAMES: Record<string, string> = {
  'content-repurpose': 'Content Repurposer',
  'seo-blog': 'SEO Blog Writer',
  'social-calendar': 'Content Calendar',
  'brand-identity': 'Brand Identity',
  'ad-variations': 'Ad Variations',
  'visual-metadata': 'Visual Metadata',
  'infographic': 'Infographic Creator',
};

function friendlyPipeline(id: string): string {
  return PIPELINE_NAMES[id] || id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* ── Pipeline Modal ── */
function PipelineModal({ pipeline, brands, onClose, onRun }: {
  pipeline: typeof PIPELINE_QUICK_ACTIONS[0];
  brands: any[];
  onClose: () => void;
  onRun: (pipelineId: string, brandId: string, inputs: Record<string, unknown>) => Promise<void>;
}) {
  const [brandId, setBrandId] = useState(brands[0]?.id || '');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [platforms, setPlatforms] = useState<string[]>(['twitter', 'linkedin']);

  const PIPELINE_FIELDS: Record<string, Array<{ key: string; label: string; type: string; placeholder: string }>> = {
    'content-repurpose': [
      { key: 'content', label: 'Content', type: 'textarea', placeholder: 'Paste content to repurpose...' },
    ],
    'ad-variations': [
      { key: 'product', label: 'Product/Service', type: 'text', placeholder: 'e.g. SaaS analytics platform' },
      { key: 'headline', label: 'Original Headline', type: 'text', placeholder: 'e.g. Track Everything That Matters' },
      { key: 'cta', label: 'Call to Action', type: 'text', placeholder: 'e.g. Start Free Trial' },
    ],
    'brand-identity': [
      { key: 'companyName', label: 'Company Name', type: 'text', placeholder: 'e.g. Acme Corp' },
      { key: 'industry', label: 'Industry', type: 'text', placeholder: 'e.g. B2B SaaS' },
      { key: 'values', label: 'Core Values', type: 'text', placeholder: 'e.g. innovation, trust, simplicity' },
    ],
    'seo-blog': [
      { key: 'topic', label: 'Topic', type: 'text', placeholder: 'e.g. How AI transforms content marketing' },
      { key: 'keywords', label: 'Keywords (comma-separated)', type: 'text', placeholder: 'AI marketing, automation, ROI' },
    ],
    'social-calendar': [
      { key: 'days', label: 'Days', type: 'number', placeholder: '7' },
      { key: 'themes', label: 'Themes (comma-separated)', type: 'text', placeholder: 'product launch, engagement' },
    ],
    'infographic': [
      { key: 'topic', label: 'Topic', type: 'text', placeholder: 'e.g. State of AI Marketing 2025' },
      { key: 'dataPoints', label: 'Key Data Points', type: 'textarea', placeholder: 'One data point per line...' },
    ],
    'visual-metadata': [
      { key: 'title', label: 'Page Title', type: 'text', placeholder: 'e.g. Ultimate Guide to Content Marketing' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief description for OG tags...' },
    ],
  };

  const fields = PIPELINE_FIELDS[pipeline.id] || [];

  const handleSubmit = async () => {
    if (!brandId) return;
    setLoading(true);
    try {
      const parsed: Record<string, unknown> = { ...inputs };
      if (pipeline.id === 'content-repurpose') {
        parsed.platforms = platforms;
      }
      await onRun(pipeline.id, brandId, parsed);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="connect-modal" onClick={onClose}>
      <div className="connect-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>{pipeline.icon} {pipeline.name}</h3>
          <button className="btn small" onClick={onClose}>✕</button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>{pipeline.desc}</p>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13 }}>Brand</label>
          <select value={brandId} onChange={e => setBrandId(e.target.value)}>
            {brands.length === 0 && <option value="">No brands configured</option>}
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        {pipeline.id === 'content-repurpose' && (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>Platforms</label>
            <div className="platform-checks">
              {PLATFORMS.map(p => (
                <label key={p.id} className={`platform-check ${platforms.includes(p.id) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={platforms.includes(p.id)} onChange={() =>
                    setPlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])
                  } />
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {fields.map(f => (
          <div className="form-group" key={f.key} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea
                placeholder={f.placeholder}
                value={inputs[f.key] || ''}
                onChange={e => setInputs({ ...inputs, [f.key]: e.target.value })}
                style={{ minHeight: 80 }}
              />
            ) : (
              <input
                type={f.type}
                placeholder={f.placeholder}
                value={inputs[f.key] || ''}
                onChange={e => setInputs({ ...inputs, [f.key]: e.target.value })}
              />
            )}
          </div>
        ))}

        <button
          className={`btn primary ${loading ? 'btn-loading' : ''}`}
          onClick={handleSubmit}
          disabled={loading || !brandId}
          style={{ width: '100%', marginTop: 8 }}
        >
          {loading ? 'Starting...' : `▶ Run ${pipeline.name}`}
        </button>
      </div>
    </div>
  );
}

export default function Dashboard({ onNavigate }: Props) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [refreshingRuns, setRefreshingRuns] = useState(false);
  const [cancelingRunId, setCancelingRunId] = useState('');
  const [streamSteps, setStreamSteps] = useState<any[]>([]);
  const [deadLetterItems, setDeadLetterItems] = useState<any[]>([]);
  const [deadLetterLoading, setDeadLetterLoading] = useState(false);
  const [retryingDeadLetterId, setRetryingDeadLetterId] = useState('');
  const [activeModal, setActiveModal] = useState<typeof PIPELINE_QUICK_ACTIONS[0] | null>(null);

  const loadData = useCallback(() => {
    Promise.all([
      getHealth().catch(() => null),
      getRuns().catch(() => []),
      getUsage(1).catch(() => null),
      getBrands().catch(() => []),
      getDeadLetterQueue({ limit: 8 }).catch(() => ({ items: [] })),
      getApprovals('pending_review').catch(() => []),
    ]).then(([h, r, u, b, dlResult, approvals]) => {
      setHealth(h);
      const normalizedRuns = Array.isArray(r) ? sortRunsByStartedAt(r.map(normalizeRunPayload)) : [];
      setRuns(normalizedRuns);
      setUsage(u);
      const brandArr = Array.isArray(b) ? b : [];
      setBrands(brandArr);
      const dlPayload = dlResult as { items?: any[] } | undefined;
      setDeadLetterItems(Array.isArray(dlPayload?.items) ? dlPayload?.items ?? [] : []);
      setPendingApprovals(Array.isArray(approvals) ? approvals.length : 0);
      setLoading(false);
    });
  }, []);

  const hasBrands = brands.length > 0;
  const inProgressRuns = useMemo(() => runs.filter(run => isRunInProgress(run.status)), [runs]);
  const recentRuns = useMemo(() => runs.slice(0, 10), [runs]);

  const totalRuns = runs.length;
  const successfulRuns = runs.filter(r => r.status === 'completed').length;
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;
  const totalDeliverables = runs.reduce((sum, r) => {
    const outputs = r.outputs || r.result?.outputs || [];
    return sum + (Array.isArray(outputs) ? outputs.length : 0);
  }, 0);

  const refreshRunsAndUsage = useCallback(async () => {
    setRefreshingRuns(true);
    try {
      const [nextRuns, nextUsage] = await Promise.all([
        getRuns().catch(() => []),
        getUsage(1).catch(() => null),
      ]);
      const normalizedRuns = Array.isArray(nextRuns) ? sortRunsByStartedAt(nextRuns.map(normalizeRunPayload)) : [];
      setRuns(normalizedRuns);
      setUsage(nextUsage);
    } finally {
      setRefreshingRuns(false);
    }
  }, []);

  const refreshDeadLetter = useCallback(async () => {
    setDeadLetterLoading(true);
    try {
      const result = await getDeadLetterQueue({ limit: 8 });
      setDeadLetterItems(Array.isArray(result?.items) ? result.items : []);
    } catch (error: any) {
      addToast('error', error?.message || 'Failed to load dead-letter queue');
    } finally {
      setDeadLetterLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (inProgressRuns.length === 0) return;
    const timer = setInterval(() => { void refreshRunsAndUsage(); }, 3000);
    return () => clearInterval(timer);
  }, [inProgressRuns.length, refreshRunsAndUsage]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRunPipeline = async (pipelineId: string, brandId: string, inputs: Record<string, unknown>) => {
    try {
      // Use specific quick-action endpoints for known pipelines
      let started: any;
      if (pipelineId === 'content-repurpose') {
        started = await repurposeContent(brandId, inputs.content as string, inputs.platforms as string[]);
      } else if (pipelineId === 'seo-blog') {
        const kw = typeof inputs.keywords === 'string' ? (inputs.keywords as string).split(',').map(s => s.trim()).filter(Boolean) : [];
        started = await generateBlog(brandId, inputs.topic as string, kw);
      } else if (pipelineId === 'social-calendar') {
        const themes = typeof inputs.themes === 'string' ? (inputs.themes as string).split(',').map(s => s.trim()).filter(Boolean) : [];
        started = await generateCalendar(brandId, Number(inputs.days) || 7, themes);
      } else {
        started = await runPipeline(pipelineId, brandId, inputs);
      }

      if (isAsyncRunStart(started)) {
        addToast('info', `${friendlyPipeline(pipelineId)} queued (${started.runId.slice(-6)}). Tracking via SSE.`);
        setStreamSteps([]);
        streamRun(started.runId, {
          onStep: (step) => setStreamSteps(prev => [...prev, step]),
          onComplete: () => { addToast('success', `✅ ${friendlyPipeline(pipelineId)} completed!`); loadData(); onNavigate('results'); },
          onError: (err) => addToast('error', err),
        });
      } else {
        addToast('success', `${friendlyPipeline(pipelineId)} started.`);
      }
      loadData();
    } catch (err: any) {
      addToast('error', err.message || `Failed to start ${pipelineId}`);
    }
  };

  const handleCancelRun = async (runId: string) => {
    setCancelingRunId(runId);
    try {
      const updated = await cancelRun(runId);
      setRuns(prev => prev.map(run => run.id === updated.id ? updated : run));
      addToast('success', `Run ${runId.slice(-6)} cancelled`);
      void refreshRunsAndUsage();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to cancel run');
    } finally {
      setCancelingRunId('');
    }
  };

  const handleRetryDeadLetter = async (id: string) => {
    setRetryingDeadLetterId(id);
    try {
      await retryDeadLetterItem(id);
      addToast('success', 'Dead-letter item re-queued for retry');
      await refreshDeadLetter();
    } catch (err: any) {
      addToast('error', err?.message || 'Failed to retry queue item');
    } finally {
      setRetryingDeadLetterId('');
    }
  };

  const getPipelineIcon = (id: string) => {
    const icons: Record<string, string> = { repurpose: '🔄', blog: '📝', calendar: '📅', social: '📱', seo: '🔍', email: '✉️', ad: '📢', brand: '🎨', infographic: '📊', visual: '🖼️' };
    for (const [key, icon] of Object.entries(icons)) {
      if (id.toLowerCase().includes(key)) return icon;
    }
    return '⚡';
  };

  if (loading) return <Spinner text="Loading dashboard..." />;

  return (
    <div className="page">
      {/* Hero */}
      <div className="hero">
        <div className="hero-badge">✨ SINT Marketing Operator</div>
        <h1>Upload one asset → <span className="accent">dozens of deliverables</span></h1>
        <p className="hero-sub">AI-powered content repurposing, SEO blogs, and social calendars — all from a single input.</p>
      </div>

      {/* Stats Cards */}
      <div className="card-grid">
        <div className="card stat-card">
          <div className="stat-icon">{health?.status === 'ok' ? '🟢' : '🔴'}</div>
          <div>
            <div className="stat-value">{health?.status === 'ok' ? 'Online' : 'Offline'}</div>
            <div className="stat-label">Health</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon">🚀</div>
          <div>
            <div className="stat-value">{totalRuns}</div>
            <div className="stat-label">Total Runs</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon">✅</div>
          <div>
            <div className="stat-value">{successRate}%</div>
            <div className="stat-label">Success Rate</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon">📦</div>
          <div>
            <div className="stat-value">{totalDeliverables}</div>
            <div className="stat-label">Deliverables</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon">💸</div>
          <div>
            <div className="stat-value">{(usage?.totalCostUnits ?? 0).toFixed(1)}</div>
            <div className="stat-label">Credits Used</div>
          </div>
        </div>
        <div className="card stat-card" onClick={() => onNavigate('approvals')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon">📋</div>
          <div>
            <div className="stat-value">
              {pendingApprovals}
              {pendingApprovals > 0 && (
                <span style={{ display: 'inline-block', background: 'var(--danger)', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 11, lineHeight: '20px', textAlign: 'center', marginLeft: 6, verticalAlign: 'middle' }}>
                  {pendingApprovals}
                </span>
              )}
            </div>
            <div className="stat-label">Pending Approvals</div>
          </div>
        </div>
      </div>

      {!hasBrands && (
        <div className="card onboarding-card">
          <h3>Create your first brand profile</h3>
          <p>Pipelines use brand voice/tone to generate consistent output. Add one brand profile first, then run any pipeline.</p>
          <button className="btn primary" onClick={() => onNavigate('brands')}>→ Go To Brands</button>
        </div>
      )}

      {/* Quick Actions Grid */}
      <h2>Quick Actions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        {PIPELINE_QUICK_ACTIONS.map(p => (
          <button
            key={p.id}
            className="card"
            onClick={() => setActiveModal(p)}
            disabled={!hasBrands}
            style={{
              cursor: hasBrands ? 'pointer' : 'not-allowed',
              padding: '20px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              border: '1px solid var(--border)',
              transition: 'border-color 0.15s, transform 0.15s',
              textAlign: 'center',
              opacity: hasBrands ? 1 : 0.5,
            }}
            onMouseEnter={e => { if (hasBrands) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
          >
            <div style={{ fontSize: 32 }}>{p.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.desc}</div>
          </button>
        ))}
      </div>

      {/* Pipeline Modal */}
      {activeModal && (
        <PipelineModal
          pipeline={activeModal}
          brands={brands}
          onClose={() => setActiveModal(null)}
          onRun={handleRunPipeline}
        />
      )}

      {/* Live Activity */}
      {inProgressRuns.length > 0 && (
        <div className="card live-activity-card">
          <div className="live-activity-header">
            <h3 style={{ margin: 0 }}>Live Pipeline Activity</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn small" onClick={() => void refreshRunsAndUsage()} disabled={refreshingRuns}>
                {refreshingRuns ? 'Refreshing…' : 'Refresh'}
              </button>
              <button className="btn small" onClick={() => onNavigate('results')}>Open Results</button>
            </div>
          </div>
          <div className="runs-list">
            {inProgressRuns.slice(0, 5).map(run => (
              <div key={run.id} className="run-item" onClick={() => onNavigate('results')}>
                <div className="run-item-left">
                  <div className="run-item-icon">{getPipelineIcon(run.pipelineId)}</div>
                  <div className="run-item-info">
                    <span className="run-item-name">{friendlyPipeline(run.pipelineId)}</span>
                    <span className="run-item-meta">{run.brandId} • {new Date(run.startedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
                <div className="run-item-right">
                  <span className={`badge badge-${run.status}`}><span className="badge-dot" />{run.status}</span>
                  {isRunInProgress(run.status) && (
                    <button className="btn danger small" onClick={e => { e.stopPropagation(); void handleCancelRun(run.id); }} disabled={cancelingRunId === run.id}>
                      {cancelingRunId === run.id ? 'Canceling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dead Letter Queue */}
      <div className="card dead-letter-card">
        <div className="live-activity-header">
          <h3 style={{ margin: 0 }}>Dead-letter Queue</h3>
          <button className="btn small" onClick={() => void refreshDeadLetter()} disabled={deadLetterLoading}>
            {deadLetterLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {deadLetterItems.length === 0 ? (
          <div className="dead-letter-empty">No failed publish jobs. Queue health is clean.</div>
        ) : (
          <div className="dead-letter-list">
            {deadLetterItems.map(item => (
              <div key={item.id} className="dead-letter-item">
                <div className="dead-letter-main">
                  <div className="dead-letter-title">{item.request?.platform ?? 'platform'} • {item.brandId}</div>
                  <div className="dead-letter-meta">attempts: {item.attemptCount} • {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'unknown time'}</div>
                  <div className="dead-letter-error">{item.lastError || item.result?.error || 'Unknown publish error'}</div>
                </div>
                <button className="btn warning small" onClick={() => void handleRetryDeadLetter(item.id)} disabled={retryingDeadLetterId === item.id}>
                  {retryingDeadLetterId === item.id ? 'Retrying…' : 'Retry'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SSE Steps */}
      {streamSteps.length > 0 && (
        <div className="card sse-steps-card">
          <h3 style={{ margin: '0 0 12px' }}>🔄 Live Progress</h3>
          <div className="sse-steps">
            {streamSteps.map((s, i) => (
              <div key={i} className={"sse-step " + (s.type === 'step_complete' ? 'done' : 'active')}>
                <span>{s.type === 'step_complete' ? '✅' : '⏳'}</span>
                <span>{s.data?.name || s.data?.step || ('Step ' + (i + 1))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Runs */}
      <h2>Recent Runs</h2>
      <div className="card">
        {runs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🚀</div>
            <div className="empty-title">No runs yet</div>
            <div className="empty-desc">Try generating your first content using the quick actions above!</div>
          </div>
        ) : (
          <div className="runs-list">
            {recentRuns.map(run => {
              const startTime = new Date(run.startedAt);
              const endTime = run.completedAt ? new Date(run.completedAt) : null;
              const durationMs = endTime ? endTime.getTime() - startTime.getTime() : null;
              const durationStr = durationMs ? `${Math.round(durationMs / 1000)}s` : '—';

              return (
                <div key={run.id} className="run-item" onClick={() => onNavigate('results')}>
                  <div className="run-item-left">
                    <div className="run-item-icon">{getPipelineIcon(run.pipelineId)}</div>
                    <div className="run-item-info">
                      <span className="run-item-name">{friendlyPipeline(run.pipelineId)}</span>
                      <span className="run-item-meta">{run.brandId} • {startTime.toLocaleString()} • {durationStr}</span>
                    </div>
                  </div>
                  <div className="run-item-right">
                    <span className={`badge badge-${run.status}`}><span className="badge-dot" />{run.status}</span>
                    {run.metering?.totalTokens > 0 && (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {run.metering.totalTokens.toLocaleString()} calls
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Usage Stats */}
      {usage && (
        <div className="usage-bar-section">
          <div className="usage-bar-title">📊 Today's Usage</div>
          <div className="usage-bar-grid">
            <div className="usage-stat">
              <div className="usage-stat-header">
                <span>AI Calls</span>
                <span className="usage-stat-value">{(usage.totalTokens ?? 0).toLocaleString()}</span>
              </div>
              <div className="usage-progress">
                <div className="usage-progress-fill" style={{ width: `${Math.min(100, ((usage.totalTokens ?? 0) / 500000) * 100)}%` }} />
              </div>
            </div>
            <div className="usage-stat">
              <div className="usage-stat-header">
                <span>Credits Used</span>
                <span className="usage-stat-value">{(usage.totalCostUnits ?? 0).toFixed(1)}</span>
              </div>
              <div className="usage-progress">
                <div className="usage-progress-fill" style={{ width: `${Math.min(100, ((usage.totalCostUnits ?? 0) / 100) * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
