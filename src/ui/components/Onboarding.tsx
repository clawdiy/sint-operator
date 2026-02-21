import React, { useState, useEffect } from 'react';
import { getOnboardingStatus, completeOnboarding } from '../api';

const TONES = ['professional', 'friendly', 'witty', 'authoritative', 'casual', 'bold'];

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [brandName, setBrandName] = useState('');
  const [brandUrl, setBrandUrl] = useState('');
  const [tones, setTones] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (localStorage.getItem('sint_onboarding_done') === '1') return;
    getOnboardingStatus()
      .then(s => { if (s.needsSetup) setShow(true); })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    localStorage.setItem('sint_onboarding_done', '1');
    setShow(false);
    onComplete();
  };

  if (!show) return null;

  const toggleTone = (t: string) =>
    setTones(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const handleFinish = async () => {
    if (!apiKey.trim() || !brandName.trim()) {
      setError('API key and brand name are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await completeOnboarding({
        openaiApiKey: apiKey,
        brandName,
        brandUrl: brandUrl || undefined,
        brandTone: tones.length > 0 ? tones : undefined,
      });
      dismiss();
    } catch (e: any) {
      setError(e.message || 'Setup failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal" style={{ position: 'relative' }}>
        <button onClick={dismiss} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: '#999', fontSize: 22, cursor: 'pointer', lineHeight: 1 }} aria-label="Close">×</button>
        <div className="onboarding-progress">
          {[0, 1, 2].map(i => (
            <div key={i} className={`onboarding-progress-step ${i <= step ? 'active' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="onboarding-step">
            <div className="onboarding-icon">🎯</div>
            <h2>Welcome to SINT Marketing Operator</h2>
            <p>AI-powered content repurposing, SEO blogs, and social calendars — all from a single input. Let's get you set up in 2 minutes.</p>
            <button className="btn primary" onClick={() => setStep(1)}>Get Started →</button>
            <div style={{ marginTop: 12 }}><button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>Skip setup</button></div>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-step">
            <div className="onboarding-icon">🔑</div>
            <h2>Your OpenAI API Key</h2>
            <p>SINT uses a bring-your-own-key (BYOK) model. Your key stays on your server and is never shared.</p>
            <div className="form-group">
              <input type="password" placeholder="sk-..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
            </div>
            <div className="onboarding-nav">
              <button className="btn" onClick={() => setStep(0)}>← Back</button>
              <button className="btn primary" onClick={() => setStep(2)} disabled={!apiKey.trim()}>Next →</button>
            </div>
            <div style={{ marginTop: 12 }}><button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>Skip setup</button></div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step">
            <div className="onboarding-icon">🎨</div>
            <h2>Brand Setup</h2>
            <div className="form-group">
              <label>Brand Name <span className="required">*</span></label>
              <input placeholder="Your Company" value={brandName} onChange={e => setBrandName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Website URL <small>(optional)</small></label>
              <input placeholder="https://example.com" value={brandUrl} onChange={e => setBrandUrl(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Brand Tone</label>
              <div className="tone-checks">
                {TONES.map(t => (
                  <label key={t} className={`platform-check ${tones.includes(t) ? 'selected' : ''}`}>
                    <input type="checkbox" checked={tones.includes(t)} onChange={() => toggleTone(t)} />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            </div>
            {error && <div className="onboarding-error">{error}</div>}
            <div className="onboarding-nav">
              <button className="btn" onClick={() => setStep(1)}>← Back</button>
              <button className="btn primary" onClick={handleFinish} disabled={submitting}>
                {submitting ? 'Setting up...' : 'Create Brand & Start 🚀'}
              </button>
            </div>
            <div style={{ marginTop: 12 }}><button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>Skip setup</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
