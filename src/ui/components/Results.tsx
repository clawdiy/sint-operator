import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  getRuns,
  getRun,
  normalizeRunPayload,
  isRunInProgress,
  cancelRun,
  publishContent,
  queuePublishContent,
  processPublishQueue,
  getPublishQueue,
  getPublishPlatformStatus,
} from '../api';
import { useToast } from './Toast';
import Spinner from './Spinner';

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280, threads: 500, instagram: 2200, linkedin: 3000,
  facebook: 63206, tiktok: 2200, blog: 50000,
};

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '𝕏', linkedin: '💼', instagram: '📸', facebook: '👥',
  threads: '🧵', tiktok: '🎵', blog: '📝', email: '✉️',
};

const DIRECT_PUBLISH_PLATFORMS = new Set(['twitter', 'linkedin', 'instagram']);
const PUBLISH_PLATFORM_ALIASES: Record<string, string> = { threads: 'twitter' };

export default function Results() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [publishingKey, setPublishingKey] = useState('');
  const [publishPlatforms, setPublishPlatforms] = useState<Record<string, boolean>>({});
  const [queueSummary, setQueueSummary] = useState<Record<string, number>>({});
  const [queueActionBusy, setQueueActionBusy] = useState(false);

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

  const refreshPublishStatus = useCallback(async () => {
    try {
      const status = await getPublishPlatformStatus();
      setPublishPlatforms(status.platforms ?? {});
    } catch {
      // Non-fatal for results viewing.
      setPublishPlatforms({});
    }
  }, []);

  const refreshQueueSummary = useCallback(async (brandId?: string) => {
    if (!brandId) {
      setQueueSummary({});
      return;
    }
    try {
      const data = await getPublishQueue({ brandId });
      setQueueSummary(data.summary ?? {});
    } catch {
      setQueueSummary({});
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
      .catch(() => {
        addToast('error', 'Failed to load runs');
      })
      .finally(() => setLoading(false));
  }, [addToast, refreshRuns]);

  useEffect(() => {
    void refreshPublishStatus();
  }, [refreshPublishStatus]);

  useEffect(() => {
    void refreshQueueSummary(selected?.brandId);
  }, [selected?.brandId, refreshQueueSummary]);

  const viewRun = async (id: string) => {
    try {
      const run = normalizeRunPayload(await getRun(id));
      setSelected(run);
      if (run.outputs && run.outputs.length > 0) {
        setActiveTab(run.outputs[0].platform || 'all');
      }
    } catch {
      addToast('error', 'Failed to load run details');
    }
  };

  useEffect(() => {
    if (!runs.some(run => isRunInProgress(run.status))) return;

    const timer = setInterval(async () => {
      try {
        await refreshRuns();
      } catch {
        // Ignore transient polling failures
      }
    }, 2000);

    return () => {
      clearInterval(timer);
    };
  }, [runs, refreshRuns]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    addToast('success', 'Copied to clipboard!');
    setTimeout(() => setCopiedId(''), 2000);
  };

  const extractHashtags = (content: string): string[] => {
    const matches = content.match(/#[\w]+/g);
    return matches ? [...new Set(matches)] : [];
  };

  const getPlatforms = (): string[] => {
    if (!selected?.outputs) return [];
    const platforms = selected.outputs.map((o: any) => o.platform).filter(Boolean);
    return [...new Set(platforms)] as string[];
  };

  const getFilteredOutputs = () => {
    if (!selected?.outputs) return [];
    if (!activeTab || activeTab === 'all') return selected.outputs;
    return selected.outputs.filter((o: any) => o.platform === activeTab);
  };

  const exportMarkdown = () => {
    if (!selected?.outputs) return;
    let md = `# Pipeline Run: ${selected.pipelineId}\n\n`;
    md += `**Brand:** ${selected.brandId}\n`;
    md += `**Date:** ${new Date(selected.startedAt).toLocaleString()}\n\n---\n\n`;
    selected.outputs.forEach((out: any, i: number) => {
      md += `## ${out.platform || 'Output'} (${out.format || 'text'})\n\n`;
      md += out.content + '\n\n---\n\n';
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selected.pipelineId}-${selected.id?.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Exported as Markdown');
  };

  const exportJSON = () => {
    if (!selected) return;
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selected.pipelineId}-${selected.id?.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Exported as JSON');
  };

  const handlePublishOutput = async (out: any, key: string) => {
    const sourcePlatform = String(out?.platform ?? '');
    const platform = PUBLISH_PLATFORM_ALIASES[sourcePlatform] ?? sourcePlatform;

    if (!DIRECT_PUBLISH_PLATFORMS.has(platform)) {
      addToast('error', `Publishing is not supported for ${sourcePlatform}`);
      return;
    }

    const content = String(out?.content ?? '').trim();
    if (!content) {
      addToast('error', 'Output is empty and cannot be published');
      return;
    }

    if (publishPlatforms[platform] === false) {
      addToast('error', `${platform} is not configured in server credentials`);
      return;
    }

    const media = Array.isArray(out?.media)
      ? out.media.filter((entry: unknown): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : undefined;
    if (platform === 'instagram' && (!media || media.length === 0)) {
      addToast('error', 'Instagram publishing requires at least one media URL');
      return;
    }

    setPublishingKey(key);
    try {
      const result = await publishContent({
        platform,
        content,
        hashtags: extractHashtags(content),
        media,
      });

      if (result.success) {
        addToast('success', result.postUrl ? `Published to ${platform}: ${result.postUrl}` : `Published to ${platform}`);
      } else {
        addToast('error', result.error || `Failed to publish to ${platform}`);
      }
    } catch (err: any) {
      addToast('error', err?.message || `Failed to publish to ${platform}`);
    } finally {
      setPublishingKey('');
      void refreshPublishStatus();
      void refreshQueueSummary(selected?.brandId);
    }
  };

  const handleQueueOutput = async (out: any, key: string, requiresApproval: boolean) => {
    if (!selected?.brandId) {
      addToast('error', 'Select a run with a brand before queuing publish');
      return;
    }

    const sourcePlatform = String(out?.platform ?? '');
    const platform = PUBLISH_PLATFORM_ALIASES[sourcePlatform] ?? sourcePlatform;
    if (!DIRECT_PUBLISH_PLATFORMS.has(platform)) {
      addToast('error', `Queue is not supported for ${sourcePlatform}`);
      return;
    }

    const content = String(out?.content ?? '').trim();
    if (!content) {
      addToast('error', 'Output is empty and cannot be queued');
      return;
    }

    if (publishPlatforms[platform] === false) {
      addToast('error', `${platform} is not configured in server credentials`);
      return;
    }

    const media = Array.isArray(out?.media)
      ? out.media.filter((entry: unknown): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : undefined;
    if (platform === 'instagram' && (!media || media.length === 0)) {
      addToast('error', 'Instagram queuing requires at least one media URL');
      return;
    }

    setPublishingKey(key);
    try {
      const item = await queuePublishContent({
        request: {
          platform,
          content,
          hashtags: extractHashtags(content),
          media,
        },
        brandId: selected.brandId,
        runId: selected.id,
        requiresApproval,
      });
      const msg = item.status === 'pending_approval'
        ? `Queued for approval (${platform})`
        : `Queued for publish (${platform})`;
      addToast('success', msg);
    } catch (err: any) {
      addToast('error', err?.message || `Failed to queue ${platform} publish`);
    } finally {
      setPublishingKey('');
      void refreshQueueSummary(selected?.brandId);
    }
  };

  const handleProcessQueue = async () => {
    setQueueActionBusy(true);
    try {
      const result = await processPublishQueue();
      if (result.processed > 0) {
        addToast('success', `Processed ${result.processed} queued publishes`);
      } else {
        addToast('info', 'No pending queue items to process');
      }
    } catch (err: any) {
      addToast('error', err?.message || 'Failed to process publish queue');
    } finally {
      setQueueActionBusy(false);
      void refreshQueueSummary(selected?.brandId);
    }
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

  if (loading) return <Spinner text="Loading results..." />;

  return (
    <div className="page">
      <h1>Results</h1>
      <p className="subtitle">View and export generated content from pipeline runs.</p>

      <div className="two-col">
        {/* Run List */}
        <div className="card">
          <div className="live-activity-header">
            <h3 style={{ margin: 0 }}>Pipeline Runs</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn small" onClick={() => void refreshRuns()} disabled={refreshing}>
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
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
            <input
              placeholder="Search by pipeline, brand, or run id..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
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
                <li
                  key={r.id}
                  className={`pipeline-item ${selected?.id === r.id ? 'active' : ''}`}
                  onClick={() => viewRun(r.id)}
                >
                  <strong>{r.pipelineId}</strong>
                  <span className="pipeline-desc">
                    <span className={`badge badge-${r.status}`}>
                      <span className="badge-dot" />
                      {r.status}
                    </span>
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
              <div className="live-activity-header" style={{ marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>Run: {selected.id?.slice(0, 8)}</h3>
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
                <div className="alert error" style={{ marginBottom: '16px' }}>
                  {selected.error}
                </div>
              )}

              {/* Export Bar */}
              {selected.outputs && selected.outputs.length > 0 && (
                <div className="export-bar">
                  <span className="export-bar-label">Export Results</span>
                  <span className="badge">Queued {queueSummary.pending ?? 0}</span>
                  <span className="badge">Needs approval {queueSummary.pending_approval ?? 0}</span>
                  <button className="btn small" onClick={() => void handleProcessQueue()} disabled={queueActionBusy}>
                    {queueActionBusy ? 'Processing queue…' : '▶ Process Queue'}
                  </button>
                  <button className="btn small" onClick={exportMarkdown}>📄 Markdown</button>
                  <button className="btn small" onClick={exportJSON}>📦 JSON</button>
                </div>
              )}

              {/* Running progress */}
              {isRunInProgress(selected.status) && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Pipeline {selected.status}...
                  </div>
                  <div className="progress-bar"><div className="progress-bar-fill" /></div>
                </div>
              )}

              {/* Platform Tabs */}
              {selected.outputs && selected.outputs.length > 0 && (
                <>
                  <div className="platform-tabs">
                    {getPlatforms().length > 1 && (
                      <button
                        className={`platform-tab ${activeTab === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveTab('all')}
                      >
                        All
                      </button>
                    )}
                    {getPlatforms().map(platform => (
                      <button
                        key={platform}
                        className={`platform-tab ${activeTab === platform ? 'active' : ''}`}
                        onClick={() => setActiveTab(platform)}
                      >
                        {PLATFORM_ICONS[platform] || '📄'} {platform}
                      </button>
                    ))}
                  </div>

                  {getFilteredOutputs().map((out: any, i: number) => {
                    const limit = PLATFORM_LIMITS[out.platform] || 0;
                    const charCount = (out.content || '').length;
                    const isOver = limit > 0 && charCount > limit;
                    const hashtags = extractHashtags(out.content || '');
                    const sourcePlatform = String(out.platform || '');
                    const publishPlatform = PUBLISH_PLATFORM_ALIASES[sourcePlatform] ?? sourcePlatform;
                    const canDirectPublish = DIRECT_PUBLISH_PLATFORMS.has(publishPlatform);
                    const isConfigured = publishPlatforms[publishPlatform];
                    const hasInstagramMedia = publishPlatform !== 'instagram' || (Array.isArray(out.media) && out.media.length > 0);
                    const publishDisabled =
                      queueActionBusy ||
                      publishingKey !== '' ||
                      !canDirectPublish ||
                      isConfigured === false ||
                      !hasInstagramMedia ||
                      String(out.content || '').trim().length === 0;
                    const queueDisabled = publishDisabled;
                    let publishTitle = `Publish to ${publishPlatform}`;
                    if (!canDirectPublish) publishTitle = `Publishing not available for ${sourcePlatform}`;
                    if (isConfigured === false) publishTitle = `${publishPlatform} is not configured`;
                    if (!hasInstagramMedia) publishTitle = 'Instagram publishing requires at least one media URL';

                    return (
                      <div key={i} className="platform-content-card">
                        <div className="platform-content-header">
                          <div className="platform-content-header-left">
                            <span className="badge">{PLATFORM_ICONS[out.platform] || '📄'} {out.platform}</span>
                            {out.format && <span className="badge">{out.format}</span>}
                          </div>
                          <div className="platform-content-header-right">
                            {limit > 0 && (
                              <span className={`char-count ${isOver ? 'over' : 'ok'}`}>
                                {charCount}/{limit}
                              </span>
                            )}
                            <button
                              className="btn small"
                              onClick={() => void handleQueueOutput(out, `queue-${i}`, true)}
                              disabled={queueDisabled}
                              title={publishTitle}
                            >
                              {publishingKey === `queue-${i}` ? 'Queuing…' : '🕒 Queue Approval'}
                            </button>
                            <button
                              className="btn small"
                              onClick={() => void handlePublishOutput(out, `publish-${i}`)}
                              disabled={publishDisabled}
                              title={publishTitle}
                            >
                              {publishingKey === `publish-${i}`
                                ? 'Publishing…'
                                : canDirectPublish
                                  ? `🚀 Publish ${publishPlatform}`
                                  : 'Publish N/A'}
                            </button>
                            <button
                              className={`btn small copy-btn ${copiedId === `out-${i}` ? 'copied' : ''}`}
                              onClick={() => copyToClipboard(out.content, `out-${i}`)}
                            >
                              {copiedId === `out-${i}` ? '✅ Copied!' : '📋 Copy'}
                            </button>
                          </div>
                        </div>
                        <div className="platform-content-body">{out.content}</div>
                        {hashtags.length > 0 && (
                          <div className="hashtags">
                            {hashtags.map(tag => (
                              <span key={tag} className="hashtag">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Steps */}
              {selected.steps && selected.steps.length > 0 && (
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

              {/* Raw JSON */}
              <div className="result-box" style={{ marginTop: '20px' }}>
                <div className="result-header">
                  <h4 style={{ margin: 0 }}>Raw JSON</h4>
                  <button className={`btn small copy-btn ${copiedId === 'raw' ? 'copied' : ''}`} onClick={() => copyToClipboard(JSON.stringify(selected, null, 2), 'raw')}>
                    {copiedId === 'raw' ? '✅ Copied!' : '📋 Copy'}
                  </button>
                </div>
                <pre>{JSON.stringify(selected, null, 2)}</pre>
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
