import React, { useEffect, useState, useCallback } from 'react';
import { getHealth, getRuns, getUsage, getBrands, repurposeContent, generateBlog, generateCalendar } from '../api';
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

  const loadData = useCallback(() => {
    Promise.all([
      getHealth().catch(() => null),
      getRuns().catch(() => []),
      getUsage(1).catch(() => null),
      getBrands().catch(() => []),
    ]).then(([h, r, u, b]) => {
      setHealth(h);
      setRuns(Array.isArray(r) ? r.slice(0, 8) : []);
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
      await repurposeContent(repurposeBrand, repurposeText, repurposePlatforms);
      addToast('success', 'Content repurposing started! Check Results for output.');
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
      await generateBlog(blogBrand, blogTopic, kw);
      addToast('success', 'Blog generation started! Check Results for output.');
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
      await generateCalendar(calBrand, calDays, themes);
      addToast('success', 'Calendar generation started! Check Results for output.');
      setCalThemes('');
      loadData();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to start calendar generation');
    } finally {
      setCalLoading(false);
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
      <select value={value} onChange={e => onChange(e.target.value)}>
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
          <button className={`btn primary ${repurposeLoading ? 'btn-loading' : ''}`} onClick={handleRepurpose} disabled={repurposeLoading} style={{ width: '100%' }}>
            {repurposeLoading ? 'Running...' : '▶ Repurpose'}
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
          <button className={`btn primary ${blogLoading ? 'btn-loading' : ''}`} onClick={handleBlog} disabled={blogLoading} style={{ width: '100%' }}>
            {blogLoading ? 'Generating...' : '▶ Generate Blog'}
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
          <button className={`btn primary ${calLoading ? 'btn-loading' : ''}`} onClick={handleCalendar} disabled={calLoading} style={{ width: '100%' }}>
            {calLoading ? 'Planning...' : '▶ Generate Calendar'}
          </button>
          {calLoading && <div className="progress-bar"><div className="progress-bar-fill" /></div>}
        </div>
      </div>

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
            {runs.map(run => (
              <div key={run.id} className="run-item" onClick={() => onNavigate('results')}>
                <div className="run-item-left">
                  <div className="run-item-icon">{getPipelineIcon(run.pipelineId)}</div>
                  <div className="run-item-info">
                    <span className="run-item-name">{run.pipelineId}</span>
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
                      {run.metering.totalTokens.toLocaleString()} tok
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
                <span>Tokens Used</span>
                <span className="usage-stat-value">{(usage.totalTokens ?? 0).toLocaleString()}</span>
              </div>
              <div className="usage-progress">
                <div className="usage-progress-fill" style={{ width: `${Math.min(100, ((usage.totalTokens ?? 0) / 500000) * 100)}%` }} />
              </div>
            </div>
            <div className="usage-stat">
              <div className="usage-stat-header">
                <span>Cost Units</span>
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
