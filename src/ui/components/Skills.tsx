import React, { useEffect, useState } from 'react';
import { getSkills } from '../api';

const LEVEL_COLORS: Record<string, string> = {
  L1: '#22c55e',
  L2: '#eab308',
  L3: '#ef4444',
};

export default function Skills() {
  const [skills, setSkills] = useState<any[]>([]);

  useEffect(() => {
    getSkills().then(s => setSkills(Array.isArray(s) ? s : [])).catch(() => {});
  }, []);

  return (
    <div className="page">
      <h1>Skills</h1>
      <p className="subtitle">Available skill modules for pipeline steps.</p>

      <div className="skills-grid">
        {skills.length === 0 ? (
          <div className="card">
            <p className="empty-state">No skills registered.</p>
          </div>
        ) : (
          skills.map((s: any) => (
            <div key={s.name} className="card skill-card">
              <div className="skill-header">
                <h3>{s.name}</h3>
                <span
                  className="badge"
                  style={{ backgroundColor: LEVEL_COLORS[s.level] ?? '#6366f1' }}
                >
                  {s.level}
                </span>
              </div>
              <p className="skill-desc">{s.description}</p>
              <div className="skill-meta">
                <span>v{s.version}</span>
                <span>{s.costUnits} CU</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
