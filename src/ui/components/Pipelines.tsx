import React, { useEffect, useState } from 'react';
import { getPipelines, getBrands, runPipeline } from '../api';

interface Pipeline {
  id: string;
  name: string;
  description: string;
  inputs: Array<{ name: string; type: string; description?: string; required?: boolean; default?: unknown }>;
}

export default function Pipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [selected, setSelected] = useState<Pipeline | null>(null);
  const [brandId, setBrandId] = useState('');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getPipelines().then(setPipelines).catch(() => {});
    getBrands().then(b => {
      setBrands(b);
      if (b.length > 0) setBrandId(b[0].id);
    }).catch(() => {});
  }, []);

  const handleRun = async () => {
    if (!selected || !brandId) return;
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const parsedInputs: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(inputs)) {
        const input = selected.inputs.find(i => i.name === key);
        if (input?.type === 'number') parsedInputs[key] = Number(val);
        else if (input?.type === 'boolean') parsedInputs[key] = val === 'true';
        else if (input?.type === 'array') parsedInputs[key] = val.split(',').map(s => s.trim());
        else parsedInputs[key] = val;
      }
      const res = await runPipeline(selected.id, brandId, parsedInputs);
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="page">
      <h1>Pipelines</h1>

      <div className="two-col">
        {/* Pipeline List */}
        <div className="card">
          <h3>Available Pipelines</h3>
          {pipelines.length === 0 ? (
            <p className="empty-state">No pipelines configured.</p>
          ) : (
            <ul className="pipeline-list">
              {pipelines.map(p => (
                <li
                  key={p.id}
                  className={`pipeline-item ${selected?.id === p.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelected(p);
                    setResult(null);
                    setError('');
                    const defaults: Record<string, string> = {};
                    p.inputs.forEach(inp => {
                      if (inp.default !== undefined && inp.default !== null) {
                        defaults[inp.name] = Array.isArray(inp.default) ? inp.default.join(', ') : String(inp.default);
                      }
                    });
                    setInputs(defaults);
                  }}
                >
                  <strong>{p.name}</strong>
                  <span className="pipeline-desc">{p.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pipeline Runner */}
        <div className="card">
          {selected ? (
            <>
              <h3>Run: {selected.name}</h3>
              <div className="form-group">
                <label>Brand</label>
                <select value={brandId} onChange={e => setBrandId(e.target.value)}>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {selected.inputs.map(inp => (
                <div className="form-group" key={inp.name}>
                  <label>
                    {inp.name}
                    {inp.required && <span className="required">*</span>}
                    {inp.description && <small>{inp.description}</small>}
                  </label>
                  {inp.type === 'boolean' ? (
                    <select
                      value={inputs[inp.name] ?? 'false'}
                      onChange={e => setInputs({ ...inputs, [inp.name]: e.target.value })}
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      type={inp.type === 'number' ? 'number' : 'text'}
                      placeholder={inp.description || inp.name}
                      value={inputs[inp.name] ?? ''}
                      onChange={e => setInputs({ ...inputs, [inp.name]: e.target.value })}
                    />
                  )}
                </div>
              ))}

              <button className="btn primary" onClick={handleRun} disabled={running}>
                {running ? '⏳ Running...' : '▶ Run Pipeline'}
              </button>

              {error && <div className="alert error">{error}</div>}

              {result && (
                <div className="result-box">
                  <div className="result-header">
                    <h4>Result</h4>
                    <button className="btn small" onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                    }}>📋 Copy</button>
                  </div>
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </div>
              )}
            </>
          ) : (
            <p className="empty-state">Select a pipeline to run it.</p>
          )}
        </div>
      </div>
    </div>
  );
}
