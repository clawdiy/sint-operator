import React, { useEffect, useState, useMemo } from 'react';
import { getSkills } from '../api';
import Spinner from './Spinner';

const LEVEL_COLORS: Record<string, string> = {
  L1: 'var(--success)',
  L2: 'var(--warning)',
  L3: 'var(--error)',
};

const LEVEL_LABELS: Record<string, string> = {
  L1: 'Basic',
  L2: 'Advanced',
  L3: 'Premium',
};


const SKILL_ICONS: Record<string, string> = {
  'asset-ingester': '📥',
  'content-analyzer': '🧠',
  'content-repurpose': '🔄',
  'seo-blog': '📝',
  'social-calendar': '📅',
  'platform-formatter': '✍️',
  'video-clipper': '🎬',
  'linkedin-writer': '💼',
  'output-packager': '📦',
  'brand-researcher': '🔍',
  'serp-scraper': '🌐',
  'seo-optimizer': '📊',
  'notifier': '🔔',
  'newsletter': '📰',
  'competitor-analyzer': '🏆',
};

function getSkillIcon(name: string): string {
  return SKILL_ICONS[name] || '⚙️';
}

export default function Skills() {
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getSkills()
      .then(s => { setSkills(Array.isArray(s) ? s : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(s => s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q));
  }, [skills, search]);

  if (loading) return <Spinner text="Loading skills..." />;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <h1 style={{ marginBottom: 0 }}>Skills</h1>
        <span className="badge">{skills.length} skill{skills.length !== 1 ? 's' : ''}</span>
      </div>
      <p className="subtitle">Available AI skill modules powering your pipeline steps.</p>

      {skills.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Search skills by name or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '10px 14px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontFamily: 'var(--font)',
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
      )}

      <div className="skills-grid">
        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">🧩</div>
              <div className="empty-title">{skills.length === 0 ? 'No skills registered' : 'No matching skills'}</div>
              <div className="empty-desc">{skills.length === 0 ? 'Skills are loaded from the skills/ directory on server startup.' : 'Try a different search term.'}</div>
            </div>
          </div>
        ) : (
          filtered.map((s: any) => (
            <div key={s.name} className="card skill-card">
              <div className="skill-header">
                <h3 style={{ margin: 0 }}>{getSkillIcon(s.name)} {s.name.replace(/-/g, ' ')}</h3>
                <span
                  className="badge"
                  style={{ background: `${LEVEL_COLORS[s.level] ?? 'var(--accent)'}20`, color: LEVEL_COLORS[s.level] ?? 'var(--accent)' }}
                >
                  {LEVEL_LABELS[s.level] || s.level}
                </span>
              </div>
              <p className="skill-desc">{s.description}</p>
              <div className="skill-meta">
                <span>v{s.version}</span>
                <span>•</span>
                <span>{s.costUnits} credits</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
