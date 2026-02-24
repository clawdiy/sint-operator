import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';

interface Approval {
  id: string;
  runId: string;
  pipelineId: string;
  brandId: string;
  status: string;
  contentType: string;
  contentPreview: string;
  contentFull: string;
  platform?: string;
  rejectReason?: string;
  editedContent?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Approvals() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending_review');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const params = filter ? `?status=${filter}` : '';
      const data = await apiGet(`/api/approvals${params}`);
      setApprovals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchApprovals(); }, [filter]);

  const handleApprove = async (id: string) => {
    try {
      await apiPost(`/api/approvals/${id}/approve`, {});
      fetchApprovals();
    } catch (err) {
      console.error('Approve failed:', err);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      await apiPost(`/api/approvals/${id}/reject`, { reason });
      fetchApprovals();
    } catch (err) {
      console.error('Reject failed:', err);
    }
  };

  const handleEdit = async (id: string) => {
    if (editingId === id) {
      try {
        await apiPost(`/api/approvals/${id}/edit`, { content: editContent });
        setEditingId(null);
        fetchApprovals();
      } catch (err) {
        console.error('Edit failed:', err);
      }
    } else {
      const approval = approvals.find(a => a.id === id);
      if (approval) {
        setEditContent(approval.contentFull);
        setEditingId(id);
      }
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: '#6b7280',
      pending_review: '#f59e0b',
      approved: '#10b981',
      published: '#3b82f6',
      rejected: '#ef4444',
    };
    return (
      <span style={{
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        color: '#fff',
        backgroundColor: colors[status] || '#6b7280',
      }}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>📋 Content Approvals</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['pending_review', 'approved', 'rejected', ''].map(f => (
            <button
              key={f || 'all'}
              onClick={() => setFilter(f)}
              className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              {f ? f.replace('_', ' ') : 'All'}
            </button>
          ))}
          <button onClick={fetchApprovals} className="btn btn-secondary" style={{ fontSize: '13px', padding: '6px 12px' }}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Loading...</div>
      ) : approvals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
          {filter === 'pending_review' ? '✨ No pending approvals!' : '📭 No approvals found.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {approvals.map(a => (
            <div key={a.id} className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {statusBadge(a.status)}
                  <span style={{ fontSize: '13px', color: '#9ca3af' }}>{a.platform?.toUpperCase()}</span>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>{a.contentType}</span>
                </div>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{new Date(a.createdAt).toLocaleString()}</span>
              </div>

              <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
                Pipeline: {a.pipelineId} · Brand: {a.brandId} · Run: <code style={{ fontSize: '11px' }}>{a.runId}</code>
              </div>

              <div
                style={{
                  background: '#1a1a2e',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  cursor: 'pointer',
                  maxHeight: expandedId === a.id ? 'none' : '120px',
                  overflow: 'hidden',
                }}
                onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
              >
                {editingId === a.id ? (
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{
                      width: '100%',
                      minHeight: '200px',
                      background: '#0d0d1a',
                      border: '1px solid #3b82f6',
                      borderRadius: '4px',
                      color: '#e5e7eb',
                      padding: '8px',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                ) : (
                  a.editedContent || a.contentFull || a.contentPreview
                )}
              </div>

              {a.rejectReason && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: '#ef4444' }}>
                  Reason: {a.rejectReason}
                </div>
              )}

              {a.status === 'pending_review' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button onClick={() => handleApprove(a.id)} className="btn btn-primary" style={{ fontSize: '13px' }}>
                    ✅ Approve
                  </button>
                  <button onClick={() => handleReject(a.id)} className="btn btn-secondary" style={{ fontSize: '13px', borderColor: '#ef4444', color: '#ef4444' }}>
                    ❌ Reject
                  </button>
                  <button onClick={() => handleEdit(a.id)} className="btn btn-secondary" style={{ fontSize: '13px' }}>
                    {editingId === a.id ? '💾 Save & Approve' : '✏️ Edit'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
