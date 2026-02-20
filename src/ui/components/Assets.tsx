import React, { useEffect, useState, useRef } from 'react';
import { getAssets, uploadAsset } from '../api';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TYPE_ICONS: Record<string, string> = {
  image: '🖼️', video: '🎬', audio: '🎵', document: '📄', url: '🔗', text: '📝',
};

export default function Assets() {
  const [assets, setAssets] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    getAssets().then(a => setAssets(Array.isArray(a) ? a : [])).catch(() => {});
  };

  useEffect(load, []);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        await uploadAsset(file);
      }
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  return (
    <div className="page">
      <h1>Assets</h1>

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
          <p>⏳ Uploading...</p>
        ) : (
          <>
            <p className="upload-icon">📤</p>
            <p>Drop files here or click to upload</p>
            <p className="upload-hint">Images, videos, documents, audio</p>
          </>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}

      {/* Asset List */}
      <div className="card">
        <h3>Uploaded Assets ({assets.length})</h3>
        {assets.length === 0 ? (
          <p className="empty-state">No assets uploaded yet.</p>
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
                  <td><code>{a.mimeType}</code></td>
                  <td>{formatSize(a.size)}</td>
                  <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
