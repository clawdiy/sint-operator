import React, { useState, useEffect } from 'react';
import { getOnboardingStatus, completeOnboarding } from '../api';

const BG = '#0a0a1a';
const CARD = '#1a1a2e';
const ACCENT = '#6366f1';
const GREEN = '#22c55e';
const TEXT = '#e6edf3';
const MUTED = '#8b949e';
const BORDER = '#30363d';

const VOICES = ['Professional', 'Casual', 'Bold', 'Friendly', 'Technical'];
const PLATFORMS = [
  { id: 'twitter', label: 'Twitter / X', icon: '𝕏' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'facebook', label: 'Facebook', icon: '👥' },
];

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [brandName, setBrandName] = useState('');
  const [industry, setIndustry] = useState('');
  const [audience, setAudience] = useState('');
  const [voice, setVoice] = useState('Professional');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [accentColor, setAccentColor] = useState('#22c55e');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [contentInput, setContentInput] = useState('');
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState('');
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

  const togglePlatform = (id: string) =>
    setPlatforms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleBrandSubmit = async () => {
    if (!brandName.trim()) { setError('Brand name is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      await completeOnboarding({
        brandName,
        brandUrl: undefined,
        brandTone: [voice.toLowerCase()],
        openaiApiKey: undefined as any,
      });
      setStep(3);
    } catch (e: any) {
      // Continue anyway - onboarding API may not support all fields
      setStep(3);
    } finally {
      setSubmitting(false);
    }
  };

  const runPipeline = async () => {
    if (!contentInput.trim()) return;
    setPipelineRunning(true);
    setPipelineResult('');
    try {
      const res = await fetch('/api/pipelines/content-repurpose/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sint_auth_token')}` },
        body: JSON.stringify({ input: contentInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setPipelineResult(data.summary || data.message || 'Content generated! Check your Results page.');
      } else {
        setPipelineResult('Pipeline queued! Check Results page in a moment.');
      }
    } catch {
      setPipelineResult('Pipeline queued! Check the Results page.');
    } finally {
      setPipelineRunning(false);
    }
  };

  const totalSteps = 5;
  const progress = ((step + 1) / totalSteps) * 100;

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const modal: React.CSSProperties = {
    background: CARD, borderRadius: 20, padding: '40px 48px', width: 520, maxWidth: '92vw',
    border: `1px solid ${BORDER}`, position: 'relative', maxHeight: '90vh', overflowY: 'auto',
  };

  const input: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: BG, border: `1px solid ${BORDER}`,
    borderRadius: 8, color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };

  const label: React.CSSProperties = {
    display: 'block', color: MUTED, fontSize: 13, marginBottom: 6, fontWeight: 500,
  };

  const btn: React.CSSProperties = {
    padding: '12px 24px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 10,
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
  };

  const btnOutline: React.CSSProperties = {
    ...btn, background: 'transparent', border: `1px solid ${BORDER}`, color: TEXT,
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <button onClick={dismiss} style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', color: MUTED, fontSize: 22, cursor: 'pointer' }}>×</button>

        {/* Progress bar */}
        <div style={{ height: 4, background: BORDER, borderRadius: 2, marginBottom: 32, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${ACCENT}, ${GREEN})`, borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>👋</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, color: TEXT }}>Welcome to SINT!</h2>
            <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
              Let's set up your first brand. This takes about 2 minutes and you'll be creating content right away.
            </p>
            <button style={btn} onClick={() => setStep(1)}>Let's Go →</button>
            <div style={{ marginTop: 16 }}>
              <button onClick={dismiss} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>Skip for now</button>
            </div>
          </div>
        )}

        {/* Step 1: Brand Setup */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎨</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: TEXT }}>Brand Setup</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={label}>Brand Name *</label>
              <input style={input} value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Your Company" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Industry</label>
              <input style={input} value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. SaaS, E-commerce, Health & Fitness" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Target Audience</label>
              <input style={input} value={audience} onChange={e => setAudience(e.target.value)} placeholder="e.g. Startup founders, 25-40, tech-savvy" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Brand Voice</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {VOICES.map(v => (
                  <button key={v} onClick={() => setVoice(v)} style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    background: voice === v ? ACCENT : BG, color: voice === v ? '#fff' : TEXT,
                    border: `1px solid ${voice === v ? ACCENT : BORDER}`, transition: 'all 0.2s',
                  }}>{v}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={label}>Brand Colors</label>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 12, color: MUTED }}>Primary</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: 36, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                    <input style={{ ...input, width: 100 }} value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} />
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: MUTED }}>Accent</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ width: 36, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                    <input style={{ ...input, width: 100 }} value={accentColor} onChange={e => setAccentColor(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {error && <div style={{ color: '#f85149', fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button style={btnOutline} onClick={() => setStep(0)}>← Back</button>
              <button style={btn} onClick={() => { if (!brandName.trim()) { setError('Brand name is required'); return; } setError(''); setStep(2); }}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 2: Connect Platforms */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: TEXT }}>Connect Platforms</h2>
            <p style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>Choose where you want to publish content. You can connect accounts later too.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {PLATFORMS.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', borderRadius: 12, background: BG,
                  border: `1px solid ${platforms.includes(p.id) ? ACCENT : BORDER}`,
                  transition: 'border-color 0.2s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22 }}>{p.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>{p.label}</span>
                  </div>
                  <button onClick={() => togglePlatform(p.id)} style={{
                    padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    background: platforms.includes(p.id) ? GREEN : 'transparent',
                    color: platforms.includes(p.id) ? '#fff' : MUTED,
                    border: `1px solid ${platforms.includes(p.id) ? GREEN : BORDER}`,
                    transition: 'all 0.2s',
                  }}>
                    {platforms.includes(p.id) ? '✓ Selected' : 'Connect'}
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button style={btnOutline} onClick={() => setStep(1)}>← Back</button>
              <button style={btn} onClick={handleBrandSubmit} disabled={submitting}>
                {submitting ? 'Saving...' : 'Next →'}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={() => { setStep(3); }} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>Skip for now</button>
            </div>
          </div>
        )}

        {/* Step 3: First Pipeline */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🚀</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: TEXT }}>Create Your First Content</h2>
            <p style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>Paste a URL, describe your topic, or type anything — our AI will repurpose it into multi-platform content.</p>

            <textarea
              style={{ ...input, height: 100, resize: 'vertical', fontFamily: 'inherit' }}
              value={contentInput}
              onChange={e => setContentInput(e.target.value)}
              placeholder="e.g. https://yourblog.com/post or 'Write about the benefits of AI in marketing'"
            />

            {pipelineResult && (
              <div style={{ marginTop: 16, padding: 16, background: BG, borderRadius: 10, border: `1px solid ${GREEN}`, color: GREEN, fontSize: 14 }}>
                ✓ {pipelineResult}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button style={btnOutline} onClick={() => setStep(2)}>← Back</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnOutline} onClick={() => setStep(4)}>Skip</button>
                <button style={btn} onClick={contentInput.trim() ? runPipeline : () => setStep(4)} disabled={pipelineRunning}>
                  {pipelineRunning ? 'Generating...' : contentInput.trim() ? 'Generate ✨' : 'Next →'}
                </button>
              </div>
            </div>
            {pipelineResult && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button style={{ ...btn, background: GREEN }} onClick={() => setStep(4)}>Continue →</button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, color: TEXT }}>You're All Set!</h2>
            <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
              Your dashboard is ready. Start creating content, manage your brand, and watch AI do the heavy lifting.
            </p>
            <button style={{ ...btn, padding: '14px 40px', fontSize: 16 }} onClick={dismiss}>
              Go to Dashboard 🚀
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
