import React, { useEffect, useState } from 'react';
import { getUsage, getCurrentUsage } from '../api';

export default function Usage() {
  const [usage, setUsage] = useState<any>(null);
  const [current, setCurrent] = useState<any>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    getUsage(days).then(setUsage).catch(() => {});
    getCurrentUsage().then(setCurrent).catch(() => {});
  }, [days]);

  const maxTokens = usage?.byModel
    ? Math.max(1, ...Object.values(usage.byModel).map((v: any) => v.tokens))
    : 1;

  const maxCost = usage?.byPipeline
    ? Math.max(1, ...Object.values(usage.byPipeline).map((v: any) => v.costUnits))
    : 1;

  return (
    <div className="page">
      <h1>Usage & Metering</h1>

      <div className="toolbar">
        <select value={days} onChange={e => setDays(Number(e.target.value))}>
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
                <div className="bar-value">{data.tokens.toLocaleString()} tokens</div>
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
              <tr><th>Brand</th><th>Runs</th><th>Cost Units</th></tr>
            </thead>
            <tbody>
              {Object.entries(usage.byBrand).map(([brand, data]: [string, any]) => (
                <tr key={brand}>
                  <td>{brand}</td>
                  <td>{data.runs}</td>
                  <td>{data.costUnits.toFixed(1)}</td>
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
          <pre>{JSON.stringify(current, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
