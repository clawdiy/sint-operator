import React, { useState, useEffect } from 'react';

const BG = '#0a0a1a';
const CARD = '#1a1a2e';
const ACCENT = '#6366f1';
const GREEN = '#22c55e';
const TEXT = '#e6edf3';
const MUTED = '#8b949e';
const BORDER = '#30363d';

const keyframes = `
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
`;

const features = [
  { icon: '🔄', title: 'Content Repurposing', desc: 'One video becomes 5 TikTok clips, 3 LinkedIn posts, an SEO blog, and Instagram carousels' },
  { icon: '📊', title: 'Infographic Creation', desc: 'Drop data in, get professional infographics out. AI identifies key points and designs the visual.' },
  { icon: '🎨', title: 'Ad Variations', desc: 'Upload one product photo → 10 ad creatives with different layouts, headlines, and CTAs' },
  { icon: '📅', title: 'Content Calendar', desc: 'AI-generated 30-day content strategy based on your goals and industry trends' },
  { icon: '🏷️', title: 'Brand Identity', desc: 'Complete brand package — 5 logo concepts, color palette, typography, and mockups' },
  { icon: '🔍', title: 'SEO Blog Writer', desc: '1500-word SEO-optimized articles that compete with page 1 content' },
];

const steps = [
  { num: '01', title: 'Upload', desc: 'Upload your content or describe what you need' },
  { num: '02', title: 'Generate', desc: 'AI generates platform-specific content with images' },
  { num: '03', title: 'Publish', desc: 'Review, approve, and publish — or let SINT auto-schedule' },
];

const stats = [
  { value: '7', label: 'AI Pipelines' },
  { value: '18', label: 'Skills' },
  { value: '5', label: 'Platforms' },
  { value: '< 60s', label: 'Processing' },
];

interface Props {
  onGetStarted: () => void;
}

export default function Landing({ onGetStarted }: Props) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', overflowX: 'hidden' }}>
      <style>{keyframes}</style>

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: scrollY > 50 ? 'rgba(10,10,26,0.95)' : 'transparent',
        backdropFilter: scrollY > 50 ? 'blur(20px)' : 'none',
        borderBottom: scrollY > 50 ? `1px solid ${BORDER}` : 'none',
        transition: 'all 0.3s ease',
        padding: '16px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>🎯</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>SINT</span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <button onClick={() => scrollTo('features')} style={navLink}>Features</button>
          <button onClick={() => scrollTo('how')} style={navLink}>How It Works</button>
          <button onClick={() => scrollTo('pricing')} style={navLink}>Pricing</button>
          <button onClick={onGetStarted} style={{ ...btnPrimary, padding: '8px 20px', fontSize: 14 }}>Get Started</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '120px 20px 80px', position: 'relative',
      }}>
        {/* Gradient orbs */}
        <div style={{ position: 'absolute', top: '10%', left: '15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', animation: 'pulse 4s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.1) 0%, transparent 70%)', animation: 'pulse 5s ease-in-out infinite 1s', pointerEvents: 'none' }} />

        <div style={{ animation: 'fadeInUp 0.8s ease-out', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-block', background: 'rgba(99,102,241,0.15)', border: `1px solid rgba(99,102,241,0.3)`, borderRadius: 20, padding: '6px 16px', fontSize: 13, color: ACCENT, marginBottom: 24, fontWeight: 500 }}>
            ✨ Now in Public Beta — All Features Free
          </div>
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 800, lineHeight: 1.1, margin: '0 0 24px', maxWidth: 800,
            background: `linear-gradient(135deg, ${TEXT} 0%, ${ACCENT} 50%, ${GREEN} 100%)`,
            backgroundSize: '200% 200%', animation: 'gradientShift 6s ease infinite',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            AI Marketing That Executes
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: MUTED, maxWidth: 640, margin: '0 auto 40px', lineHeight: 1.6 }}>
            Upload one asset. Get dozens of platform-ready posts, images, and a publishing schedule — in seconds, not hours.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={onGetStarted} style={btnPrimary}>Get Started Free</button>
            <button onClick={() => scrollTo('how')} style={btnSecondary}>Watch Demo ↓</button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: '40px 20px 80px', display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap' }}>
        {stats.map(s => (
          <div key={s.label} style={{ textAlign: 'center', minWidth: 120 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: ACCENT }}>{s.value}</div>
            <div style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '80px 20px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 36, fontWeight: 700, marginBottom: 12 }}>Everything You Need</h2>
        <p style={{ textAlign: 'center', color: MUTED, fontSize: 16, marginBottom: 60, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
          Six AI-powered tools that replace your entire content team
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {features.map(f => (
            <div key={f.title} style={{
              background: CARD, borderRadius: 16, padding: 32, border: `1px solid ${BORDER}`,
              transition: 'transform 0.2s, border-color 0.2s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.borderColor = ACCENT; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
            >
              <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: TEXT }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how" style={{ padding: '80px 20px', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 36, fontWeight: 700, marginBottom: 60 }}>How It Works</h2>
        <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap' }}>
          {steps.map((s, i) => (
            <div key={s.num} style={{ flex: '1 1 220px', maxWidth: 280, textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
                background: `linear-gradient(135deg, ${ACCENT}, ${i === 2 ? GREEN : '#818cf8'})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: '#fff',
              }}>{s.num}</div>
              <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 36, fontWeight: 700, marginBottom: 12 }}>Simple Pricing</h2>
        <p style={{ color: MUTED, fontSize: 16, marginBottom: 40 }}>Free during beta — all features included</p>
        <div style={{
          display: 'inline-block', background: CARD, borderRadius: 20, padding: '48px 56px',
          border: `2px solid ${ACCENT}`, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, fontWeight: 800, marginBottom: 8 }}>$0</div>
          <div style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>per month during beta</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', textAlign: 'left' }}>
            {['All 7 AI pipelines', '18 creative skills', 'Unlimited generations', 'All platforms supported', 'Priority support'].map(item => (
              <li key={item} style={{ padding: '6px 0', fontSize: 14, color: TEXT }}>
                <span style={{ color: GREEN, marginRight: 8 }}>✓</span>{item}
              </li>
            ))}
          </ul>
          <button onClick={onGetStarted} style={{ ...btnPrimary, width: '100%' }}>Get Started Free</button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '40px 20px', borderTop: `1px solid ${BORDER}`, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
          <a href="/api-docs" style={footerLink}>API Docs</a>
          <a href="https://github.com/sint-ai" target="_blank" rel="noopener" style={footerLink}>GitHub</a>
          <a href="mailto:hello@sint.ai" style={footerLink}>Contact</a>
        </div>
        <p style={{ color: '#555', fontSize: 13, margin: 0 }}>Built by SINT AI · {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

const navLink: React.CSSProperties = {
  background: 'none', border: 'none', color: MUTED, fontSize: 14, cursor: 'pointer', padding: '4px 8px',
};

const btnPrimary: React.CSSProperties = {
  padding: '14px 32px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 10,
  fontSize: 16, fontWeight: 600, cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
};

const btnSecondary: React.CSSProperties = {
  padding: '14px 32px', background: 'transparent', color: TEXT, border: `1px solid ${BORDER}`,
  borderRadius: 10, fontSize: 16, fontWeight: 500, cursor: 'pointer',
};

const footerLink: React.CSSProperties = {
  color: MUTED, textDecoration: 'none', fontSize: 14,
};
