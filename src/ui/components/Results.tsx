import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getRuns, getRun, deleteRun, normalizeRunPayload, isRunInProgress, cancelRun } from '../api';
import { useToast } from './Toast';
import Spinner from './Spinner';
import ContentPreview from './ContentPreview';

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '𝕏', linkedin: '💼', instagram: '📸', facebook: '👥',
  threads: '🧵', tiktok: '🎵', blog: '📝', email: '✉️',
};

function extractDeliverablesFromObj(obj: any, deliverables: any[]) {
  if (!obj || typeof obj !== 'object') return;
  // Direct deliverables array
  if (Array.isArray(obj.deliverables)) {
    for (const d of obj.deliverables) {
      if (d?.platform && d?.content && !deliverables.some(x => x.content === d.content && x.platform === d.platform)) {
        deliverables.push(d);
      }
    }
  }
  // Platform-keyed format: { platforms: { twitter: { content: "..." } } }
  if (obj.platforms && typeof obj.platforms === 'object') {
    for (const [platform, val] of Object.entries(obj.platforms)) {
      const v = val as any;
      if (v?.content && !deliverables.some(x => x.content === v.content && x.platform === platform)) {
        deliverables.push({ platform, content: v.content, format: v.format, hashtags: v.hashtags, hook: v.hook, mediaPrompt: v.mediaPrompt, notes: v.notes });
      }
    }
  }
  // Single content string with platform
  if (obj.platform && obj.content && typeof obj.content === 'string') {
    if (!deliverables.some(x => x.content === obj.content && x.platform === obj.platform)) {
      deliverables.push({ platform: obj.platform, content: obj.content, format: obj.format, hashtags: obj.hashtags, hook: obj.hook, mediaPrompt: obj.mediaPrompt, notes: obj.notes });
    }
  }
}

function parseRunOutputs(run: any) {
  const deliverables: any[] = [];
  let article: any = undefined;
  let calendar: any[] = [];

  // Extract from steps[].output
  const steps = run?.steps || [];
  for (const step of steps) {
    const out = step?.output || step?.result || {};
    extractDeliverablesFromObj(out, deliverables);
    if (out.article && !article) article = out.article;
    if (Array.isArray(out.calendar)) calendar.push(...out.calendar);
  }

  // Also check top-level output
  if (run?.output) {
    extractDeliverablesFromObj(run.output, deliverables);
    if (run.output.article && !article) article = run.output.article;
    if (Array.isArray(run.output.calendar)) calendar.push(...run.output.calendar);
  }

  // Also check top-level outputs array (already normalized)
  const outputs = run?.outputs || [];
  for (const o of outputs) {
    extractDeliverablesFromObj(o, deliverables);
  }

  return { deliverables, article, calendar };
}

export default function Results() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [copiedId, setCopiedId] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const refreshRuns = useCallback(async () => {
    setRefreshing(true);
    try {
      const incoming = await getRuns({ limit: 250 });
      const normalizedRuns = Array.isArray(incoming)
        ? incoming.map(normalizeRunPayload).sort((a, b) => Date.parse(b.startedAt ?? '') - Date.parse(a.startedAt ?? ''))
        : [];
      setRuns(normalizedRuns);
      setSelected(prev => {
        if (prev?.id) {
          const matched = normalizedRuns.find(run => run.id === prev.id);
          if (matched) return matched;
        }
        return normalizedRuns[0] ?? null;
      });
    } finally {
      setRefreshing(false);
    }
  }, []);

  const filteredRuns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return runs.filter(run => {
      if (statusFilter !== 'all' && run.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = `${run.pipelineId ?? ''} ${run.brandId ?? ''} ${run.id ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [runs, statusFilter, searchQuery]);

  useEffect(() => {
    void refreshRuns()
      .catch(() => addToast('error', 'Failed to load runs'))
      .finally(() => setLoading(false));
  }, [addToast, refreshRuns]);

  const viewRun = async (id: string) => {
    try {
      const run = normalizeRunPayload(await getRun(id));
      setSelected(run);
      setShowRawJson(false);
    } catch {
      addToast('error', 'Failed to load run details');
    }
  };

  useEffect(() => {
    if (!runs.some(run => isRunInProgress(run.status))) return;
    const timer = setInterval(() => { refreshRuns().catch(() => {}); }, 2000);
    return () => clearInterval(timer);
  }, [runs, refreshRuns]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    addToast('success', 'Copied to clipboard!');
    setTimeout(() => setCopiedId(''), 2000);
  };

  const handleCancelSelectedRun = async () => {
    if (!selected?.id || !isRunInProgress(selected.status)) return;
    setCanceling(true);
    try {
      const updated = await cancelRun(selected.id);
      setSelected(updated);
      setRuns(prev => prev.map(run => run.id === updated.id ? updated : run));
      addToast('success', 'Run cancelled');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to cancel run');
    } finally {
      setCanceling(false);
    }
  };

  const exportMarkdown = () => {
    if (!selected) return;
    const { deliverables, article, calendar } = parseRunOutputs(selected);
    let md = `# Pipeline Run: ${selected.pipelineId}\n\n`;
    md += `**Brand:** ${selected.brandId}\n`;
    md += `**Date:** ${new Date(selected.startedAt).toLocaleString()}\n\n---\n\n`;
    if (article) {
      md += `## ${article.title}\n\n`;
      if (article.metaDescription) md += `> ${article.metaDescription}\n\n`;
      if (article.content) md += article.content + '\n\n---\n\n';
    }
    deliverables.forEach((d: any) => {
      md += `## ${d.platform} ${d.format ? `(${d.format})` : ''}\n\n${d.content}\n\n---\n\n`;
    });
    if (calendar.length > 0) {
      md += `## Content Calendar\n\n`;
      calendar.forEach((day: any) => {
        md += `### Day ${day.day}${day.date ? ` — ${day.date}` : ''}\n\n`;
        day.posts?.forEach((p: any) => { md += `- **${p.platform}**${p.time ? ` (${p.time})` : ''}: ${p.content}\n`; });
        md += '\n';
      });
    }
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${selected.pipelineId}-${selected.id?.slice(0, 8)}.md`;
    a.click(); URL.revokeObjectURL(url);
    addToast('success', 'Exported as Markdown');
  };

  const exportJSON = () => {
    if (!selected) return;
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${selected.pipelineId}-${selected.id?.slice(0, 8)}.json`;
    a.click(); URL.revokeObjectURL(url);
    addToast('success', 'Exported as JSON');
  };

  const handleEditDeliverable = (index: number, newContent: string) => {
    if (!selected) return;
    const updated = { ...selected };
    if (updated.outputs && updated.outputs[index]) {
      updated.outputs[index] = { ...updated.outputs[index], content: newContent };
    }
    setSelected(updated);
    addToast('success', 'Content updated (local only)');
  };

  if (loading) return <Spinner text="Loading results..." />;

  const parsed = selected ? parseRunOutputs(selected) : { deliverables: [], article: undefined, calendar: [] };
  const hasPreviewContent = parsed.deliverables.length > 0 || parsed.article || parsed.calendar.length > 0;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this run?')) return;
    try {
      await deleteRun(id);
      setRuns(prev => prev.filter(r => r.id !== id));
      if (selectedRun?.id === id) { setSelectedRun(null); setRunDetail(null); }
    } catch {}
  };


  return (
    <div className="page">
      <h1>Results</h1>
      <p className="subtitle">View and export generated content from pipeline runs.</p>

      <div className="two-col">
        {/* Run List */}
        <div className="card">
          <div className="live-activity-header">
            <h3 style={{ margin: 0 }}>Pipeline Runs</h3>
            <button className="btn small" onClick={() => void refreshRuns()} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <div className="toolbar" style={{ marginBottom: '12px' }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input placeholder="Search by pipeline, brand, or run id..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          {runs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-title">No runs yet</div>
              <div className="empty-desc">Run a pipeline from the Dashboard to see results here.</div>
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔎</div>
              <div className="empty-title">No runs match filters</div>
              <div className="empty-desc">Try changing status filter or search text.</div>
            </div>
          ) : (
            <ul className="pipeline-list">
              {filteredRuns.map(r => (
                <li key={r.id} className={`pipeline-item ${selected?.id === r.id ? 'active' : ''}`} onClick={() => viewRun(r.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                      <strong>{r.pipelineId}</strong>
                      <span className="pipeline-desc">
                        <span className={`badge badge-${r.status}`}><span className="badge-dot" />{r.status}</span>
                        {' '}{new Date(r.startedAt).toLocaleString()}
                      </span>
                    </div>
                    <button className="btn-icon" onClick={(e) => handleDelete(r.id, e)} title="Delete run" style={{ opacity: 0.4, fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px 8px' }}>🗑️</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Run Detail */}
        <div className="card">
          {selected ? (
            <>
              <div className="live-activity-header" style={{ marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>{selected.pipelineId || 'Run'} — {new Date(selected.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, {new Date(selected.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</h3>
                {isRunInProgress(selected.status) && (
                  <button className="btn danger small" onClick={handleCancelSelectedRun} disabled={canceling}>
                    {canceling ? 'Canceling…' : 'Cancel Run'}
                  </button>
                )}
              </div>
              <div className="meta-row">
                <span>Pipeline: <strong>{selected.pipelineId}</strong></span>
                <span>Brand: <strong>{selected.brandId}</strong></span>
                <span>Status: <span className={`badge badge-${selected.status}`}><span className="badge-dot" />{selected.status}</span></span>
              </div>

              {selected.status === 'failed' && selected.error && (
                <div className="alert error" style={{ marginBottom: '16px' }}>{selected.error}</div>
              )}

              {/* Export Bar */}
              {(hasPreviewContent || (selected.outputs && selected.outputs.length > 0)) && (
                <div className="export-bar">
                  <span className="export-bar-label">Export</span>
                  <button className="btn small" onClick={exportMarkdown}>📄 Markdown</button>
                  <button className="btn small" onClick={exportJSON}>📦 JSON</button>
                </div>
              )}

              {/* Running progress */}
              {isRunInProgress(selected.status) && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Pipeline {selected.status}...</div>
                  <div className="progress-bar"><div className="progress-bar-fill" /></div>
                </div>
              )}

              {/* Content Preview */}
              {hasPreviewContent && (
                <ContentPreview
                  deliverables={parsed.deliverables}
                  article={parsed.article}
                  calendar={parsed.calendar}
                  onEdit={handleEditDeliverable}
                />
              )}

              {/* Steps */}
              {selected.steps && selected.steps.length > 0 && (
                <>
                  <h4>Steps</h4>
                  <table className="table">
                    <thead><tr><th>Step</th><th>Status</th><th>Model</th><th>Tokens</th><th>Duration</th></tr></thead>
                    <tbody>
                      {selected.steps.map((s: any) => (
                        <tr key={s.stepId}>
                          <td>{s.stepId}</td>
                          <td><span className={`badge badge-${s.status}`}><span className="badge-dot" />{s.status}</span></td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{s.modelUsed ?? '—'}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{s.tokensUsed?.toLocaleString() ?? '—'}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{s.durationMs ? `${(s.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Collapsible Raw JSON */}
              <div className="raw-json-section" style={{ marginTop: '20px' }}>
                <button className="btn small" onClick={() => setShowRawJson(!showRawJson)} style={{ marginBottom: showRawJson ? '10px' : 0 }}>
                  {showRawJson ? '▼' : '▶'} Raw JSON
                </button>
                {showRawJson && (
                  <div className="result-box">
                    <div className="result-header">
                      <h4 style={{ margin: 0 }}>Raw JSON</h4>
                      <button className={`btn small copy-btn ${copiedId === 'raw' ? 'copied' : ''}`} onClick={() => copyToClipboard(JSON.stringify(selected, null, 2), 'raw')}>
                        {copiedId === 'raw' ? '✅ Copied!' : '📋 Copy'}
                      </button>
                    </div>
                    <pre>{JSON.stringify(selected, null, 2)}</pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">👈</div>
              <div className="empty-title">Select a run</div>
              <div className="empty-desc">Click on a pipeline run to view its generated outputs.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
