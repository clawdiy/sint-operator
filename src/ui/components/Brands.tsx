import React, { useEffect, useState, useRef, KeyboardEvent } from 'react';
import { getBrands, getBrand, createBrand } from '../api';
import { useToast } from './Toast';
import Spinner from './Spinner';

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="tag-input-wrapper" onClick={() => inputRef.current?.focus()}>
      {tags.filter(Boolean).map((tag, i) => (
        <span key={i} className="tag-pill">
          {tag}
          <span className="tag-pill-remove" onClick={() => onChange(tags.filter((_, j) => j !== i))}>×</span>
        </span>
      ))}
      <input
        ref={inputRef}
        className="tag-input-field"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? placeholder : ''}
      />
    </div>
  );
}

const TONE_OPTIONS = [
  'professional', 'friendly', 'witty', 'authoritative', 'casual',
  'inspirational', 'educational', 'provocative', 'empathetic', 'bold',
];

const PLATFORM_OPTIONS = [
  { id: 'twitter', label: 'Twitter', icon: '𝕏' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'facebook', label: 'Facebook', icon: '👥' },
  { id: 'threads', label: 'Threads', icon: '🧵' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'blog', label: 'Blog', icon: '📝' },
  { id: 'email', label: 'Email', icon: '✉️' },
];

interface BrandForm {
  id: string;
  name: string;
  tone: string[];
  style: string;
  doNot: string[];
  vocabulary: string[];
  examples: string[];
  platforms: string[];
  keywords: string[];
  competitors: string[];
  handles: Record<string, string>;
}

const emptyForm: BrandForm = {
  id: '', name: '', tone: [], style: '', doNot: [], vocabulary: [],
  examples: [''], platforms: [], keywords: [], competitors: [],
  handles: {},
};

export default function Brands() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<BrandForm>({ ...emptyForm });
  const [creating, setCreating] = useState(false);

  const load = () => {
    getBrands()
      .then(b => { setBrands(Array.isArray(b) ? b : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  const viewBrand = async (id: string) => {
    try {
      const b = await getBrand(id);
      setSelected(b);
      setShowCreate(false);
    } catch {
      addToast('error', 'Failed to load brand details');
    }
  };

  const toggleTone = (tone: string) => {
    setForm(prev => ({
      ...prev,
      tone: prev.tone.includes(tone) ? prev.tone.filter(t => t !== tone) : [...prev.tone, tone],
    }));
  };

  const togglePlatform = (platform: string) => {
    setForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform) ? prev.platforms.filter(p => p !== platform) : [...prev.platforms, platform],
    }));
  };

  const addExample = () => setForm(prev => ({ ...prev, examples: [...prev.examples, ''] }));
  const updateExample = (i: number, val: string) => setForm(prev => ({ ...prev, examples: prev.examples.map((e, j) => j === i ? val : e) }));
  const removeExample = (i: number) => setForm(prev => ({ ...prev, examples: prev.examples.filter((_, j) => j !== i) }));

  const handleCreate = async () => {
    if (!form.id || !form.name) {
      addToast('error', 'Brand ID and name are required');
      return;
    }
    setCreating(true);
    try {
      await createBrand({
        id: form.id,
        name: form.name,
        voice: {
          tone: form.tone,
          style: form.style,
          doNot: form.doNot.filter(Boolean),
          vocabulary: form.vocabulary.filter(Boolean),
          examples: form.examples.filter(Boolean),
        },
        platforms: form.platforms,
        keywords: form.keywords.filter(Boolean),
        competitors: form.competitors.filter(Boolean),
        handles: form.handles,
      });
      addToast('success', `Brand "${form.name}" created!`);
      setForm({ ...emptyForm, examples: [''] });
      setShowCreate(false);
      load();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to create brand');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <Spinner text="Loading brands..." />;

  return (
    <div className="page">
      <h1>Brands</h1>
      <p className="subtitle">Manage brand profiles that guide content generation tone and style.</p>

      <div className="toolbar">
        <button className="btn primary" onClick={() => { setShowCreate(true); setSelected(null); setForm({ ...emptyForm, examples: [''] }); }}>
          + New Brand
        </button>
      </div>

      {/* Brand Cards */}
      {!showCreate && !selected && (
        <div className="brand-cards">
          {brands.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">🏢</div>
                <div className="empty-title">No brands configured</div>
                <div className="empty-desc">Create a brand profile to get started, or add YAML files to config/brands/.</div>
              </div>
            </div>
          ) : (
            brands.map(b => (
              <div key={b.id} className="brand-card" onClick={() => viewBrand(b.id)}>
                <div className="brand-card-name">{b.name}</div>
                <div className="brand-card-tones">
                  {(b.voice?.tone || []).map((t: string) => (
                    <span key={t} className="tone-pill">{t}</span>
                  ))}
                </div>
                <div className="brand-card-platforms">
                  {(b.platforms || []).map((p: string) => {
                    const opt = PLATFORM_OPTIONS.find(o => o.id === p);
                    return <span key={p} className="platform-badge" title={p}>{opt?.icon || '📄'}</span>;
                  })}
                  {(!b.platforms || b.platforms.length === 0) && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>All platforms</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Brand Detail */}
      {selected && !showCreate && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>{selected.name}</h3>
            <button className="btn small" onClick={() => setSelected(null)}>← Back</button>
          </div>

          {selected.voice?.tone?.length > 0 && (
            <div className="brand-section">
              <div className="brand-section-title">Voice Tone</div>
              <div className="brand-card-tones">
                {selected.voice.tone.map((t: string) => <span key={t} className="tone-pill">{t}</span>)}
              </div>
            </div>
          )}

          {selected.voice?.style && (
            <div className="brand-section">
              <div className="brand-section-title">Style</div>
              <div className="brand-section-content">{selected.voice.style}</div>
            </div>
          )}

          {selected.voice?.doNot?.length > 0 && (
            <div className="brand-section">
              <div className="brand-section-title">Do Not</div>
              <div className="brand-card-tones">
                {selected.voice.doNot.map((d: string) => <span key={d} className="tag-pill">{d}</span>)}
              </div>
            </div>
          )}

          {selected.voice?.vocabulary?.length > 0 && (
            <div className="brand-section">
              <div className="brand-section-title">Preferred Vocabulary</div>
              <div className="brand-card-tones">
                {selected.voice.vocabulary.map((v: string) => <span key={v} className="tag-pill">{v}</span>)}
              </div>
            </div>
          )}

          {selected.keywords?.length > 0 && (
            <div className="brand-section">
              <div className="brand-section-title">Keywords</div>
              <div className="brand-card-tones">
                {selected.keywords.map((k: string) => <span key={k} className="tag-pill">{k}</span>)}
              </div>
            </div>
          )}

          {selected.competitors?.length > 0 && (
            <div className="brand-section">
              <div className="brand-section-title">Competitors</div>
              <div className="brand-card-tones">
                {selected.competitors.map((c: string) => <span key={c} className="tone-pill">{c}</span>)}
              </div>
            </div>
          )}

          {selected.voice?.examples?.length > 0 && (
            <div className="brand-section">
              <div className="brand-section-title">Example Content</div>
              {selected.voice.examples.filter(Boolean).map((ex: string, i: number) => (
                <div key={i} className="output-card" style={{ marginBottom: '8px' }}>
                  <pre className="output-content">{ex}</pre>
                </div>
              ))}
            </div>
          )}

          <div className="result-box">
            <div className="result-header">
              <h4 style={{ margin: 0 }}>Full Configuration</h4>
              <button className="btn small" onClick={() => { navigator.clipboard.writeText(JSON.stringify(selected, null, 2)); addToast('success', 'Copied!'); }}>📋 Copy</button>
            </div>
            <pre>{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0 }}>Create Brand</h3>
            <button className="btn small" onClick={() => setShowCreate(false)}>← Cancel</button>
          </div>

          <div className="form-group">
            <label>Brand ID <span className="required">*</span></label>
            <input value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} placeholder="my-brand (lowercase, no spaces)" />
          </div>

          <div className="form-group">
            <label>Brand Name <span className="required">*</span></label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="My Brand" />
          </div>

          <div className="form-group">
            <label>Voice Tone</label>
            <div className="platform-checks">
              {TONE_OPTIONS.map(tone => (
                <label key={tone} className={`platform-check ${form.tone.includes(tone) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={form.tone.includes(tone)} onChange={() => toggleTone(tone)} />
                  {tone}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Style Description</label>
            <textarea
              value={form.style}
              onChange={e => setForm({ ...form, style: e.target.value })}
              placeholder="Describe the brand's writing style... e.g. Concise, data-driven, uses analogies from technology"
              style={{ minHeight: '80px' }}
            />
          </div>

          <div className="form-group">
            <label>Do-Not List <small>Things the brand should never say or do</small></label>
            <TagInput tags={form.doNot} onChange={doNot => setForm({ ...form, doNot })} placeholder="Add items and press Enter..." />
          </div>

          <div className="form-group">
            <label>Preferred Vocabulary</label>
            <TagInput tags={form.vocabulary} onChange={vocabulary => setForm({ ...form, vocabulary })} placeholder="Add preferred terms..." />
          </div>

          <div className="form-group">
            <label>Example Content</label>
            {form.examples.map((ex, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <textarea
                  value={ex}
                  onChange={e => updateExample(i, e.target.value)}
                  placeholder="Paste an example post or content snippet..."
                  style={{ minHeight: '60px', flex: 1 }}
                />
                {form.examples.length > 1 && (
                  <button className="btn small danger" onClick={() => removeExample(i)} style={{ alignSelf: 'flex-start' }}>×</button>
                )}
              </div>
            ))}
            <button className="btn small" onClick={addExample}>+ Add Example</button>
          </div>

          <div className="form-group">
            <label>Platforms</label>
            <div className="platform-checks">
              {PLATFORM_OPTIONS.map(p => (
                <label key={p.id} className={`platform-check ${form.platforms.includes(p.id) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={form.platforms.includes(p.id)} onChange={() => togglePlatform(p.id)} />
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Keywords</label>
            <TagInput tags={form.keywords} onChange={keywords => setForm({ ...form, keywords })} placeholder="Add keywords..." />
          </div>

          <div className="form-group">
            <label>Competitors</label>
            <TagInput tags={form.competitors} onChange={competitors => setForm({ ...form, competitors })} placeholder="Add competitor names..." />
          </div>

          <div className="btn-group">
            <button className={`btn primary ${creating ? 'btn-loading' : ''}`} onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : '✓ Create Brand'}
            </button>
            <button className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
