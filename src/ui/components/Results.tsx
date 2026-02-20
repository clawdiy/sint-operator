import React, { useEffect, useState } from 'react';
import { getRuns, getRun } from '../api';

export default function Results() {
  const [runs, setRuns] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [copiedId, setCopiedId] = useState('');

  useEffect(() => {
    getRuns().then(r => setRuns(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const viewRun = async (id: string) => {
    try {
      const run = await getRun(id);
      setSelected(run);
    } catch { }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  return (
    <div className="page">
      <h1>Results</h1>

      <div className="two-col">
        {/* Run List */}
        <div className="card">
          <h3>Pipeline Runs</h3>
          {runs.length === 0 ? (
            <p className="empty-state">No runs yet.</p>
          ) : (
            <ul className="pipeline-list">
              {runs.map(r => (
                <li
                  key={r.id}
                  className={`pipeline-item ${selected?.id === r.id ? 'active' : ''}`}
                  onClick={() => viewRun(r.id)}
                >
                  <strong>{r.pipelineId}</strong>
                  <span className="pipeline-desc">
                    <span className={`badge badge-${r.status}`}>{r.status}</span>
                    {' '}{new Date(r.startedAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Run Detail */}
        <div className="card">
          {selected ? (
            <>
              <h3>Run: {selected.id?.slice(0, 8)}</h3>
              <div className="meta-row">
                <span>Pipeline: <strong>{selected.pipelineId}</strong></span>
                <span>Brand: <strong>{selected.brandId}</strong></span>
                <span>Status: <span className={`badge badge-${selected.status}`}>{selected.status}</span></span>
              </div>

              {/* Outputs */}
              {selected.outputs && selected.outputs.length > 0 && (
                <>
                  <h4>Generated Outputs</h4>
                  {selected.outputs.map((out: any, i: number) => (
                    <div key={i} className="output-card">
                      <div className="output-header">
                        <span className="badge">{out.platform}</span>
                        <span className="badge">{out.format}</span>
                        <button
                          className="btn small"
                          onClick={() => copyToClipboard(out.content, `out-${i}`)}
                        >
                          {copiedId === `out-${i}` ? '✅ Copied!' : '📋 Copy'}
                        </button>
                      </div>
                      <pre className="output-content">{out.content}</pre>
                    </div>
                  ))}
                </>
              )}

              {/* Steps */}
              {selected.steps && (
                <>
                  <h4>Steps</h4>
                  <table className="table">
                    <thead>
                      <tr><th>Step</th><th>Status</th><th>Model</th><th>Tokens</th><th>Duration</th></tr>
                    </thead>
                    <tbody>
                      {selected.steps.map((s: any) => (
                        <tr key={s.stepId}>
                          <td>{s.stepId}</td>
                          <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                          <td>{s.modelUsed ?? '—'}</td>
                          <td>{s.tokensUsed?.toLocaleString() ?? '—'}</td>
                          <td>{s.durationMs ? `${(s.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Full JSON */}
              <div className="result-box">
                <div className="result-header">
                  <h4>Raw JSON</h4>
                  <button className="btn small" onClick={() => copyToClipboard(JSON.stringify(selected, null, 2), 'raw')}>
                    {copiedId === 'raw' ? '✅ Copied!' : '📋 Copy'}
                  </button>
                </div>
                <pre>{JSON.stringify(selected, null, 2)}</pre>
              </div>
            </>
          ) : (
            <p className="empty-state">Select a run to view outputs.</p>
          )}
        </div>
      </div>
    </div>
  );
}
