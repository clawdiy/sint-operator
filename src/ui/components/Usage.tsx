import React, { useEffect, useState } from 'react';
import { getUsage, getCurrentUsage } from '../api';
import Spinner from './Spinner';

export default function Usage() {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<any>(null);
  const [current, setCurrent] = useState<any>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    Promise.all([
      getUsage(days).catch(() => null),
      getCurrentUsage().catch(() => null),
    ]).then(([u, c]) => {
      setUsage(u);
      setCurrent(c);
      setLoading(false);
    });
  }, [days]);

  const maxTokens = usage?.byModel
    ? Math.max(1, ...Object.values(usage.byModel).map((v: any) => v.tokens))
    : 1;

  const maxCost = usage?.byPipeline
    ? Math.max(1, ...Object.values(usage.byPipeline).map((v: any) => v.costUnits))
    : 1;

  if (loading) return <Spinner text="Loading usage data..." />;

  return (
    <div className="page">
      <h1>Usage & Metering</h1>
      <p className="subtitle">Track AI usage and pipeline activity.</p>

      <div className="toolbar">
        <select value={days} onChange={e => { setDays(Number(e.target.value)); setLoading(true); }}>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Summary Cards */}
      {usage && (
        <div className="card-grid">
          <div className="card stat-card">
            <div className="stat-icon">🏃</div>
            <div className="stat-body">
              <div className="stat-value">{usage.totalRuns}</div>
              <div className="stat-label">Total Runs</div>
            </div>
          </div>
          <div className="card stat-card">
            <div className="stat-icon">🪙</div>
            <div className="stat-body">
              <div className="stat-value">{(usage.totalTokens ?? 0).toLocaleString()}</div>
              <div className="stat-label">AI Calls</div>
            </div>
          </div>
          <div className="card stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-body">
              <div className="stat-value">{(usage.totalCostUnits ?? 0).toFixed(1)}</div>
              <div className="stat-label">Credits</div>
            </div>
          </div>
        </div>
      )}

      {/* Model Breakdown */}
      {usage?.byModel && Object.keys(usage.byModel).length > 0 && (
        <div className="card">
          <h3>Model Breakdown</h3>
          <div className="bar-chart">
            {Object.entries(usage.byModel).map(([model, data]: [string, any]) => (
              <div key={model} className="bar-row">
                <div className="bar-label">{model}</div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(data.tokens / maxTokens) * 100}%` }}
                  />
                </div>
                <div className="bar-value">{data.tokens.toLocaleString()} calls</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline Breakdown */}
      {usage?.byPipeline && Object.keys(usage.byPipeline).length > 0 && (
        <div className="card">
          <h3>Pipeline Breakdown</h3>
          <div className="bar-chart">
            {Object.entries(usage.byPipeline).map(([pipeline, data]: [string, any]) => (
              <div key={pipeline} className="bar-row">
                <div className="bar-label">{pipeline}</div>
                <div className="bar-track">
                  <div
                    className="bar-fill secondary"
                    style={{ width: `${(data.costUnits / maxCost) * 100}%` }}
                  />
                </div>
                <div className="bar-value">{data.runs} runs • {data.costUnits.toFixed(1)} CU</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Brand Breakdown */}
      {usage?.byBrand && Object.keys(usage.byBrand).length > 0 && (
        <div className="card">
          <h3>Brand Breakdown</h3>
          <table className="table">
            <thead>
              <tr><th>Brand</th><th>Runs</th><th>Credits</th></tr>
            </thead>
            <tbody>
              {Object.entries(usage.byBrand).map(([brand, data]: [string, any]) => (
                <tr key={brand}>
                  <td>{brand}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{data.runs}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{data.costUnits.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Current Limits */}
      {current && (
        <div className="card">
          <h3>Current Session</h3>
          {/* TODO: If all values are zero, the issue may be backend metering not recording usage */}
          <div className="card-grid" style={{ marginTop: '12px' }}>
            <div className="card stat-card">
              <div className="stat-icon">🏃</div>
              <div className="stat-body">
                <div className="stat-value">{current.runs ?? current.totalRuns ?? 0}</div>
                <div className="stat-label">Session Runs</div>
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon">🪙</div>
              <div className="stat-body">
                <div className="stat-value">{(current.tokens ?? current.totalTokens ?? 0).toLocaleString()}</div>
                <div className="stat-label">Tokens</div>
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-body">
                <div className="stat-value">{(current.costUnits ?? current.totalCostUnits ?? 0).toFixed?.(1) ?? 0}</div>
                <div className="stat-label">Credits</div>
              </div>
            </div>
          </div>
          {current.limit && (
            <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Limit: {typeof current.limit === 'object' ? `${current.limit.tokens?.toLocaleString() ?? '∞'} tokens / ${current.limit.runs ?? '∞'} runs` : String(current.limit)}
            </div>
          )}
        </div>
      )}

      {!usage && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📈</div>
            <div className="empty-title">No usage data yet</div>
            <div className="empty-desc">Run some pipelines and usage statistics will appear here.</div>
          </div>
        </div>
      )}
    </div>
  );
}
