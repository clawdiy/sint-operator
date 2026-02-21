import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  getHealth,
  getRuns,
  getUsage,
  getBrands,
  repurposeContent,
  generateBlog,
  generateCalendar,
  cancelRun,
  normalizeRunPayload,
  isAsyncRunStart,
  isRunInProgress,
  streamRun,
} from '../api';
import { useToast } from './Toast';
import Spinner from './Spinner';

type Page = 'dashboard' | 'pipelines' | 'brands' | 'results' | 'assets' | 'usage' | 'skills';

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

export default function Dashboard({ onNavigate }: Props) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);

  // Quick action states
  const [repurposeText, setRepurposeText] = useState('');
  const [repurposePlatforms, setRepurposePlatforms] = useState<string[]>(['twitter', 'linkedin']);
  const [repurposeBrand, setRepurposeBrand] = useState('');
  const [repurposeLoading, setRepurposeLoading] = useState(false);

  const [blogTopic, setBlogTopic] = useState('');
  const [blogKeywords, setBlogKeywords] = useState('');
  const [blogBrand, setBlogBrand] = useState('');
  const [blogLoading, setBlogLoading] = useState(false);

  const [calDays, setCalDays] = useState(7);
  const [calThemes, setCalThemes] = useState('');
  const [calBrand, setCalBrand] = useState('');
  const [calLoading, setCalLoading] = useState(false);
  const [refreshingRuns, setRefreshingRuns] = useState(false);
  const [cancelingRunId, setCancelingRunId] = useState('');
  const [streamSteps, setStreamSteps] = useState<any[]>([]);

  const loadData = useCallback(() => {
    Promise.all([
      getHealth().catch((e: any) => { addToast('error', e.message || 'Failed to load health'); return null; }),
      getRuns().catch((e: any) => { addToast('error', e.message || 'Failed to load runs'); return []; }),
      getUsage(1).catch(() => null),
      getBrands().catch((e: any) => { addToast('error', e.message || 'Failed to load brands'); return []; }),
    ]).then(([h, r, u, b]) => {
      setHealth(h);
      const normalizedRuns = Array.isArray(r) ? sortRunsByStartedAt(r.map(normalizeRunPayload)) : [];
      setRuns(normalizedRuns);
      setUsage(u);
      const brandArr = Array.isArray(b) ? b : [];
      setBrands(brandArr);
      if (brandArr.length > 0) {
        const first = brandArr[0].id;
        setRepurposeBrand(prev => prev || first);
        setBlogBrand(prev => prev || first);
        setCalBrand(prev => prev || first);
      }
      setLoading(false);
    });
  }, []);

  const hasBrands = brands.length > 0;
  const inProgressRuns = useMemo(() => runs.filter(run => isRunInProgress(run.status)), [runs]);
  const recentRuns = useMemo(() => runs.slice(0, 8), [runs]);

  const refreshRunsAndUsage = useCallback(async () => {
    setRefreshingRuns(true);
    try {
      const [nextRuns, nextUsage] = await Promise.all([
        getRuns().catch((e: any) => { addToast('error', e.message || 'Failed to load runs'); return []; }),
        getUsage(1).catch(() => null),
      ]);
      const normalizedRuns = Array.isArray(nextRuns) ? sortRunsByStartedAt(nextRuns.map(normalizeRunPayload)) : [];
      setRuns(normalizedRuns);
      setUsage(nextUsage);
    } finally {
      setRefreshingRuns(false);
    }
  }, []);

  useEffect(() => {
    if (inProgressRuns.length === 0) return;
    const timer = setInterval(() => {
      void refreshRunsAndUsage();
    }, 3000);
    return () => clearInterval(timer);
  }, [inProgressRuns.length, refreshRunsAndUsage]);

  useEffect(() => { loadData(); }, [loadData]);

  const togglePlatform = (id: string) => {
    setRepurposePlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleRepurpose = async () => {
    if (!repurposeText.trim() || repurposePlatforms.length === 0 || !repurposeBrand) {
      addToast('error', 'Please fill in content, select platforms, and choose a brand');
      return;
    }
    setRepurposeLoading(true);
    try {
      const started = await repurposeContent(repurposeBrand, repurposeText, repurposePlatforms);
      if (isAsyncRunStart(started)) {
        addToast('info', `Repurpose queued (${started.runId.slice(-6)}). Tracking via SSE.`);
        setStreamSteps([]);
        streamRun(started.runId, {
          onStep: (step) => setStreamSteps(prev => [...prev, step]),
          onComplete: () => { addToast('success', '✅ Repurpose completed! Check Results to view.'); loadData(); onNavigate('results'); },
          onError: (err) => addToast('error', err),
        });
      } else {
        addToast('success', 'Content repurposing started.');
      }
      setRepurposeText('');
      loadData();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to start repurposing');
    } finally {
      setRepurposeLoading(false);
    }
  };

  const handleBlog = async () => {
    if (!blogTopic.trim() || !blogBrand) {
      addToast('error', 'Please enter a topic and select a brand');
      return;
    }
    setBlogLoading(true);
    try {
      const kw = blogKeywords.split(',').map(s => s.trim()).filter(Boolean);
      const started = await generateBlog(blogBrand, blogTopic, kw);
      if (isAsyncRunStart(started)) {
        addToast('info', `Blog queued (${started.runId.slice(-6)}). Tracking via SSE.`);
        setStreamSteps([]);
        streamRun(started.runId, {
          onStep: (step) => setStreamSteps(prev => [...prev, step]),
          onComplete: () => { addToast('success', '✅ Blog generated! Check Results to view.'); loadData(); onNavigate('results'); },
          onError: (err) => addToast('error', err),
        });
      } else {
        addToast('success', 'Blog generation started.');
      }
      setBlogTopic('');
      setBlogKeywords('');
      loadData();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to start blog generation');
    } finally {
      setBlogLoading(false);
    }
  };

  const handleCalendar = async () => {
    if (!calBrand) {
      addToast('error', 'Please select a brand');
      return;
    }
    setCalLoading(true);
    try {
      const themes = calThemes.split(',').map(s => s.trim()).filter(Boolean);
      const started = await generateCalendar(calBrand, calDays, themes);
      if (isAsyncRunStart(started)) {
        addToast('info', `Calendar queued (${started.runId.slice(-6)}). Tracking via SSE.`);
        setStreamSteps([]);
        streamRun(started.runId, {
          onStep: (step) => setStreamSteps(prev => [...prev, step]),
          onComplete: () => { addToast('success', '✅ Calendar generated! Check Results to view.'); loadData(); onNavigate('results'); },
          onError: (err) => addToast('error', err),
        });
      } else {
        addToast('success', 'Calendar generation started.');
      }
      setCalThemes('');
      loadData();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to start calendar generation');
    } finally {
      setCalLoading(false);
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

  const pipelineIcons: Record<string, string> = {
    'repurpose': '🔄', 'blog': '📝', 'calendar': '📅', 'social': '📱',
    'seo': '🔍', 'email': '✉️', 'ad': '📢',
  };

  const getPipelineIcon = (id: string) => {
    for (const [key, icon] of Object.entries(pipelineIcons)) {
      if (id.toLowerCase().includes(key)) return icon;
    }
    return '⚡';
  };

  const BrandSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="brand-selector">
      <select value={value} onChange={e => onChange(e.target.value)} disabled={!hasBrands}>
        {brands.length === 0 && <option value="">No brands configured</option>}
        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </div>
  );

  if (loading) return <Spinner text="Loading dashboard..." />;

  return (
    <div className="page">
      {/* Hero */}
      <div className="hero">
        <div className="hero-badge">✨ SINT Marketing Operator</div>
        <h1>Upload one asset → <span className="accent">dozens of deliverables</span></h1>
        <p className="hero-sub">AI-powered content repurposing, SEO blogs, and social calendars — all from a single input.</p>
      </div>

      <div className="card-grid">
        <div className="card stat-card">
          <div className="stat-icon">{health?.status === 'ok' ? '🟢' : '🔴'}</div>
          <div>
            <div className="stat-value">{health?.status === 'ok' ? 'Online' : 'Offline'}</div>
            <div className="stat-label">Health</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon">⚡</div>
          <div>
            <div className="stat-value">{inProgressRuns.length}</div>
            <div className="stat-label">Active</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon">🧠</div>
          <div>
            <div className="stat-value">{(usage?.totalTokens ?? 0).toLocaleString()}</div>
            <div className="stat-label">AI Calls</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon">💸</div>
          <div>
            <div className="stat-value">{(usage?.totalCostUnits ?? 0).toFixed(1)}</div>
            <div className="stat-label">Credits Used Today</div>
          </div>
        </div>
      </div>

      {!hasBrands && (
        <div className="card onboarding-card">
          <h3>Create your first brand profile</h3>
          <p>
            Pipelines use brand voice/tone to generate consistent output. Add one brand profile first, then run repurpose/blog/calendar flows.
          </p>
          <button className="btn primary" onClick={() => onNavigate('brands')}>
            → Go To Brands
          </button>
        </div>
      )}

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
                    <span className="run-item-meta">
                      {run.brandId} • {new Date(run.startedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <div className="run-item-right">
                  <span className={`badge badge-${run.status}`}>
                    <span className="badge-dot" />
                    {run.status}
                  </span>
                  {isRunInProgress(run.status) && (
                    <button
                      className="btn danger small"
                      onClick={e => {
                        e.stopPropagation();
                        void handleCancelRun(run.id);
                      }}
                      disabled={cancelingRunId === run.id}
                    >
                      {cancelingRunId === run.id ? 'Canceling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions">
        {/* Repurpose Card */}
        <div className="quick-card">
          <div className="quick-card-header">
            <div className="quick-card-icon">🔄</div>
            <div>
              <div className="quick-card-title">Repurpose Content</div>
              <div className="quick-card-desc">Transform for multiple platforms</div>
            </div>
          </div>
          <BrandSelect value={repurposeBrand} onChange={setRepurposeBrand} />
          <div className="form-group">
            <label>Content</label>
            <textarea
              placeholder="Paste your content here — blog post, tweet, article..."
              value={repurposeText}
              onChange={e => setRepurposeText(e.target.value)}
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !repurposeLoading) handleRepurpose(); }}
              style={{ minHeight: '80px' }}
            />
          </div>
          <div className="form-group">
            <label>Platforms</label>
            <div className="platform-checks">
              {PLATFORMS.map(p => (
                <label
                  key={p.id}
                  className={`platform-check ${repurposePlatforms.includes(p.id) ? 'selected' : ''}`}
                >
                  <input type="checkbox" checked={repurposePlatforms.includes(p.id)} onChange={() => togglePlatform(p.id)} />
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>
          <button className={`btn primary ${repurposeLoading ? 'btn-loading' : ''}`} onClick={handleRepurpose} disabled={repurposeLoading || !hasBrands} style={{ width: '100%' }}>
            {!hasBrands ? 'Create Brand First' : repurposeLoading ? 'Running...' : '▶ Repurpose ⌘↵'}
          </button>
          {repurposeLoading && <div className="progress-bar"><div className="progress-bar-fill" /></div>}
        </div>

        {/* Blog Card */}
        <div className="quick-card">
          <div className="quick-card-header">
            <div className="quick-card-icon">📝</div>
            <div>
              <div className="quick-card-title">SEO Blog</div>
              <div className="quick-card-desc">Optimized blog with schema markup</div>
            </div>
          </div>
          <BrandSelect value={blogBrand} onChange={setBlogBrand} />
          <div className="form-group">
            <label>Topic</label>
            <input
              placeholder="e.g. How AI transforms content marketing"
              value={blogTopic}
              onChange={e => setBlogTopic(e.target.value)}
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !blogLoading) handleBlog(); }}
            />
          </div>
          <div className="form-group">
            <label>Keywords <small>comma-separated</small></label>
            <input
              placeholder="AI marketing, content automation, ROI"
              value={blogKeywords}
              onChange={e => setBlogKeywords(e.target.value)}
            />
          </div>
          <button className={`btn primary ${blogLoading ? 'btn-loading' : ''}`} onClick={handleBlog} disabled={blogLoading || !hasBrands} style={{ width: '100%' }}>
            {!hasBrands ? 'Create Brand First' : blogLoading ? 'Generating...' : '▶ Generate Blog'}
          </button>
          {blogLoading && <div className="progress-bar"><div className="progress-bar-fill" /></div>}
        </div>

        {/* Calendar Card */}
        <div className="quick-card">
          <div className="quick-card-header">
            <div className="quick-card-icon">📅</div>
            <div>
              <div className="quick-card-title">Content Calendar</div>
              <div className="quick-card-desc">Multi-day social media plan</div>
            </div>
          </div>
          <BrandSelect value={calBrand} onChange={setCalBrand} />
          <div className="form-group">
            <label>Days</label>
            <div className="range-wrapper">
              <input
                type="range"
                min={1}
                max={30}
                value={calDays}
                onChange={e => setCalDays(Number(e.target.value))}
              />
              <span className="range-value">{calDays}</span>
            </div>
          </div>
          <div className="form-group">
            <label>Themes <small>comma-separated</small></label>
            <input
              placeholder="product launch, thought leadership, engagement"
              value={calThemes}
              onChange={e => setCalThemes(e.target.value)}
            />
          </div>
          <button className={`btn primary ${calLoading ? 'btn-loading' : ''}`} onClick={handleCalendar} disabled={calLoading || !hasBrands} style={{ width: '100%' }}>
            {!hasBrands ? 'Create Brand First' : calLoading ? 'Planning...' : '▶ Generate Calendar'}
          </button>
          {calLoading && <div className="progress-bar"><div className="progress-bar-fill" /></div>}
        </div>
      </div>

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
            {recentRuns.map(run => (
              <div key={run.id} className="run-item" onClick={() => onNavigate('results')}>
                <div className="run-item-left">
                  <div className="run-item-icon">{getPipelineIcon(run.pipelineId)}</div>
                  <div className="run-item-info">
                    <span className="run-item-name">{friendlyPipeline(run.pipelineId)}</span>
                    <span className="run-item-meta">{run.brandId} • {new Date(run.startedAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="run-item-right">
                  <span className={`badge badge-${run.status}`}>
                    <span className="badge-dot" />
                    {run.status}
                  </span>
                  {run.metering?.totalTokens > 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {run.metering.totalTokens.toLocaleString()} calls
                    </span>
                  )}
                </div>
              </div>
            ))}
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
