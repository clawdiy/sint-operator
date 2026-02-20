import React, { useEffect, useState } from 'react';
import { getBrands, getBrand, createBrand } from '../api';

export default function Brands() {
  const [brands, setBrands] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newBrand, setNewBrand] = useState({
    id: '', name: '', voice: { tone: [''], style: '', doNot: [''], vocabulary: [''], examples: [''] },
    visual: { primaryColors: ['#6366f1'], secondaryColors: ['#818cf8'], fonts: ['Inter'] },
    platforms: [], keywords: [''], competitors: [''],
  });
  const [error, setError] = useState('');

  const load = () => {
    getBrands().then(setBrands).catch(() => {});
  };

  useEffect(load, []);

  const viewBrand = async (id: string) => {
    try {
      const b = await getBrand(id);
      setSelected(b);
      setShowCreate(false);
    } catch { }
  };

  const handleCreate = async () => {
    setError('');
    try {
      await createBrand(newBrand);
      load();
      setShowCreate(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <h1>Brands</h1>

      <div className="toolbar">
        <button className="btn primary" onClick={() => { setShowCreate(true); setSelected(null); }}>
          + New Brand
        </button>
      </div>

      <div className="two-col">
        {/* Brand List */}
        <div className="card">
          <h3>Brand Profiles</h3>
          {brands.length === 0 ? (
            <p className="empty-state">No brands configured. Create one or add YAML to config/brands/.</p>
          ) : (
            <ul className="pipeline-list">
              {brands.map(b => (
                <li
                  key={b.id}
                  className={`pipeline-item ${selected?.id === b.id ? 'active' : ''}`}
                  onClick={() => viewBrand(b.id)}
                >
                  <strong>{b.name}</strong>
                  <span className="pipeline-desc">{b.voice?.tone?.join(', ') || b.id}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Brand Detail / Create */}
        <div className="card">
          {showCreate ? (
            <>
              <h3>Create Brand</h3>
              <div className="form-group">
                <label>ID</label>
                <input value={newBrand.id} onChange={e => setNewBrand({ ...newBrand, id: e.target.value })} placeholder="my-brand" />
              </div>
              <div className="form-group">
                <label>Name</label>
                <input value={newBrand.name} onChange={e => setNewBrand({ ...newBrand, name: e.target.value })} placeholder="My Brand" />
              </div>
              <div className="form-group">
                <label>Tone (comma-separated)</label>
                <input
                  value={newBrand.voice.tone.join(', ')}
                  onChange={e => setNewBrand({
                    ...newBrand,
                    voice: { ...newBrand.voice, tone: e.target.value.split(',').map(s => s.trim()) }
                  })}
                  placeholder="professional, friendly"
                />
              </div>
              <div className="form-group">
                <label>Style</label>
                <input
                  value={newBrand.voice.style}
                  onChange={e => setNewBrand({ ...newBrand, voice: { ...newBrand.voice, style: e.target.value } })}
                  placeholder="Concise and data-driven"
                />
              </div>
              <div className="form-group">
                <label>Keywords (comma-separated)</label>
                <input
                  value={newBrand.keywords.join(', ')}
                  onChange={e => setNewBrand({ ...newBrand, keywords: e.target.value.split(',').map(s => s.trim()) })}
                  placeholder="AI, marketing, automation"
                />
              </div>
              {error && <div className="alert error">{error}</div>}
              <div className="btn-group">
                <button className="btn primary" onClick={handleCreate}>Create</button>
                <button className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </>
          ) : selected ? (
            <>
              <h3>{selected.name}</h3>
              <div className="result-box">
                <div className="result-header">
                  <h4>Brand YAML</h4>
                  <button className="btn small" onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(selected, null, 2));
                  }}>📋 Copy</button>
                </div>
                <pre>{JSON.stringify(selected, null, 2)}</pre>
              </div>
            </>
          ) : (
            <p className="empty-state">Select a brand to view details, or create a new one.</p>
          )}
        </div>
      </div>
    </div>
  );
}
