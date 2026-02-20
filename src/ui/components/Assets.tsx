import React, { useEffect, useState, useRef } from 'react';
import { getAssets, uploadAsset } from '../api';
import { useToast } from './Toast';
import Spinner from './Spinner';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TYPE_ICONS: Record<string, string> = {
  image: '🖼️', video: '🎬', audio: '🎵', document: '📄', url: '🔗', text: '📝',
};

export default function Assets() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    getAssets()
      .then(a => { setAssets(Array.isArray(a) ? a : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadAsset(file);
      }
      addToast('success', `${files.length} file${files.length > 1 ? 's' : ''} uploaded!`);
      load();
    } catch (err: any) {
      addToast('error', err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  if (loading) return <Spinner text="Loading assets..." />;

  return (
    <div className="page">
      <h1>Assets</h1>
      <p className="subtitle">Upload and manage content assets for pipeline processing.</p>

      {/* Upload Area */}
      <div
        className={`card upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleUpload(e.target.files)}
        />
        {uploading ? (
          <div>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p>Uploading...</p>
          </div>
        ) : (
          <>
            <p className="upload-icon">📤</p>
            <p>Drop files here or click to upload</p>
            <p className="upload-hint">Images, videos, documents, audio</p>
          </>
        )}
      </div>

      {/* Asset List */}
      <div className="card">
        <h3>Uploaded Assets ({assets.length})</h3>
        {assets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📁</div>
            <div className="empty-title">No assets uploaded yet</div>
            <div className="empty-desc">Upload content assets to use them in your pipelines.</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>MIME</th>
                <th>Size</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(a => (
                <tr key={a.id}>
                  <td>{TYPE_ICONS[a.type] ?? '📎'}</td>
                  <td>{a.originalName}</td>
                  <td><code style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{a.mimeType}</code></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{formatSize(a.size)}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(a.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
