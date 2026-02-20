import React, { useEffect, useState } from 'react';
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

export default function Skills() {
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<any[]>([]);

  useEffect(() => {
    getSkills()
      .then(s => { setSkills(Array.isArray(s) ? s : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <Spinner text="Loading skills..." />;

  return (
    <div className="page">
      <h1>Skills</h1>
      <p className="subtitle">Available AI skill modules powering your pipeline steps.</p>

      <div className="skills-grid">
        {skills.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">🧩</div>
              <div className="empty-title">No skills registered</div>
              <div className="empty-desc">Skills are loaded from the skills/ directory on server startup.</div>
            </div>
          </div>
        ) : (
          skills.map((s: any) => (
            <div key={s.name} className="card skill-card">
              <div className="skill-header">
                <h3 style={{ margin: 0 }}>{s.name}</h3>
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
                <span>{s.costUnits} CU</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
