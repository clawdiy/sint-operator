import React, { useEffect, useState } from 'react';
import { getHealth, getRuns, getUsage } from '../api';

type Page = 'dashboard' | 'pipelines' | 'brands' | 'results' | 'assets' | 'usage' | 'skills';

interface Props {
  onNavigate: (page: Page) => void;
}

export default function Dashboard({ onNavigate }: Props) {
  const [health, setHealth] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      getHealth().catch(() => null),
      getRuns().catch(() => []),
      getUsage(7).catch(() => null),
    ]).then(([h, r, u]) => {
      setHealth(h);
      setRuns(Array.isArray(r) ? r.slice(0, 5) : []);
      setUsage(u);
    }).catch(() => setError('Failed to connect to API'));
  }, []);

  return (
    <div className="page">
      <h1>Dashboard</h1>

      {error && <div className="alert error">{error}</div>}

      {/* Status Cards */}
      <div className="card-grid">
        <div className="card stat-card">
          <div className="stat-icon">🟢</div>
          <div className="stat-body">
            <div className="stat-value">{health?.status ?? '—'}</div>
            <div className="stat-label">Status</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon">🧩</div>
          <div className="stat-body">
            <div className="stat-value">{health?.skills ?? '—'}</div>
            <div className="stat-label">Skills</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon">🏢</div>
          <div className="stat-body">
            <div className="stat-value">{health?.brands ?? '—'}</div>
            <div className="stat-label">Brands</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-body">
            <div className="stat-value">{health?.pipelines ?? '—'}</div>
            <div className="stat-label">Pipelines</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <h2>Quick Actions</h2>
      <div className="card-grid actions-grid">
        <button className="card action-card" onClick={() => onNavigate('pipelines')}>
          <span className="action-icon">🔄</span>
          <span className="action-label">Repurpose Content</span>
          <span className="action-desc">Transform content for multiple platforms</span>
        </button>
        <button className="card action-card" onClick={() => onNavigate('pipelines')}>
          <span className="action-icon">📝</span>
          <span className="action-label">Generate Blog</span>
          <span className="action-desc">SEO-optimized blog with schema markup</span>
        </button>
        <button className="card action-card" onClick={() => onNavigate('pipelines')}>
          <span className="action-icon">📅</span>
          <span className="action-label">Social Calendar</span>
          <span className="action-desc">Multi-day content calendar</span>
        </button>
      </div>

      {/* Recent Runs */}
      <h2>Recent Runs</h2>
      <div className="card">
        {runs.length === 0 ? (
          <p className="empty-state">No runs yet. Start a pipeline to see results here.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Pipeline</th>
                <th>Brand</th>
                <th>Status</th>
                <th>Tokens</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.id}>
                  <td>{run.pipelineId}</td>
                  <td>{run.brandId}</td>
                  <td><span className={`badge badge-${run.status}`}>{run.status}</span></td>
                  <td>{run.metering?.totalTokens?.toLocaleString() ?? '—'}</td>
                  <td>{new Date(run.startedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Usage Summary */}
      {usage && (
        <>
          <h2>7-Day Usage</h2>
          <div className="card-grid">
            <div className="card stat-card">
              <div className="stat-body">
                <div className="stat-value">{usage.totalRuns}</div>
                <div className="stat-label">Total Runs</div>
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-body">
                <div className="stat-value">{(usage.totalTokens ?? 0).toLocaleString()}</div>
                <div className="stat-label">Tokens Used</div>
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-body">
                <div className="stat-value">{(usage.totalCostUnits ?? 0).toFixed(1)}</div>
                <div className="stat-label">Cost Units</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
