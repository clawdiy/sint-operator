import React, { useState } from 'react';
import PublishButton from './PublishButton';

interface Deliverable {
  platform: string;
  content: string;
  format?: string;
  hashtags?: string[];
  hook?: string;
  mediaPrompt?: string;
  notes?: string;
}

interface Article {
  title: string;
  metaTitle?: string;
  metaDescription?: string;
  content?: string;
  headers?: string[];
  keywords?: { primary: string; secondary?: string[]; lsi?: string[] };
}

interface CalendarDay {
  day: number;
  date?: string;
  posts: Array<{ platform: string; content: string; time?: string; hashtags?: string[] }>;
}

interface GeneratedImage {
  url?: string;
  base64?: string;
  revisedPrompt?: string;
  error?: string;
}

interface PublishJob {
  id: string;
  platform: string;
  content: string;
  scheduledAt: string;
  imageUrl?: string;
  status: string;
}

interface ContentPreviewProps {
  deliverables: Deliverable[];
  article?: Article;
  calendar?: CalendarDay[];
  images?: GeneratedImage[];
  publishQueue?: PublishJob[];
  onPublish?: (platform: string, content: string) => void;
  onEdit?: (index: number, newContent: string) => void;
}

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280, threads: 500, instagram: 2200, linkedin: 3000,
  facebook: 63206, tiktok: 2200, blog: 50000,
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1d9bf0', linkedin: '#0a66c2', instagram: '#e1306c',
  facebook: '#1877f2', threads: '#000', tiktok: '#00f2ea', blog: '#6366f1',
};

function splitThread(content: string, limit = 280): string[] {
  if (content.length <= limit) return [content];
  const words = content.split(' ');
  const parts: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > limit - 6) {
      parts.push(current.trim());
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function CharBar({ count, limit }: { count: number; limit: number }) {
  const pct = Math.min((count / limit) * 100, 100);
  const color = count > limit ? '#ef4444' : count > limit * 0.9 ? '#eab308' : '#22c55e';
  return (
    <div className="char-count-bar">
      <div className="char-count-fill" style={{ width: `${pct}%`, background: color }} />
      <span className="char-count-label" style={{ color }}>{count}/{limit}</span>
    </div>
  );
}

function TwitterPreview({ d, index, onEdit, onPublish, copiedId, onCopy, image }: {
  d: Deliverable; index: number; onEdit?: (i: number, c: string) => void;
  onPublish?: (p: string, c: string) => void; copiedId: string; onCopy: (t: string, id: string) => void;
  image?: GeneratedImage;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.content);
  const limit = PLATFORM_LIMITS.twitter;
  const threads = splitThread(d.content, limit);
  const hashtags = d.hashtags || (d.content.match(/#[\w]+/g) || []);

  return (
    <div className="twitter-preview">
      {threads.map((part, ti) => (
        <div key={ti} className="twitter-tweet">
          <div className="twitter-header">
            <div className="twitter-avatar">🎯</div>
            <div className="twitter-user">
              <span className="twitter-name">SINT</span>
              <span className="twitter-handle">@sinthive</span>
            </div>
            {threads.length > 1 && <span className="thread-indicator">{ti + 1}/{threads.length}</span>}
          </div>
          {editing && ti === 0 ? (
            <textarea
              className="content-edit"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={4}
            />
          ) : (
            <div className="twitter-body">{part}</div>
          )}
          {ti === 0 && image?.url && (
            <div style={{ margin: '8px 0', borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2a4a' }}>
              <img src={image.url} alt={image.revisedPrompt || 'Post image'} style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} loading="lazy" />
            </div>
          )}
          {ti === 0 && <CharBar count={d.content.length} limit={limit} />}
        </div>
      ))}
      {hashtags.length > 0 && (
        <div className="hashtags">{hashtags.map((h, i) => <span key={i} className="hashtag">{typeof h === 'string' && !h.startsWith('#') ? '#' : ''}{h}</span>)}</div>
      )}
      <div className="twitter-actions">
        <span>💬</span><span>🔁</span><span>❤️</span><span>📊</span>
      </div>
      <div className="preview-actions">
        <button className="btn small" onClick={() => {
          if (editing) { onEdit?.(index, draft); setEditing(false); } else { setEditing(true); }
        }}>{editing ? '💾 Save' : '✏️ Edit'}</button>
        <button className={`btn small ${copiedId === `d-${index}` ? 'copied' : ''}`}
          onClick={() => onCopy(d.content, `d-${index}`)}>
          {copiedId === `d-${index}` ? '✅ Copied!' : '📋 Copy'}
        </button>
        <PublishButton platform="twitter" content={d.content} />
      </div>
    </div>
  );
}

function LinkedInPreview({ d, index, onEdit, copiedId, onCopy, image }: {
  d: Deliverable; index: number; onEdit?: (i: number, c: string) => void;
  copiedId: string; onCopy: (t: string, id: string) => void;
  image?: GeneratedImage;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.content);
  const [expanded, setExpanded] = useState(false);
  const limit = PLATFORM_LIMITS.linkedin;
  const truncated = d.content.length > 200 && !expanded;
  const display = truncated ? d.content.slice(0, 200) + '...' : d.content;

  return (
    <div className="linkedin-preview">
      <div className="linkedin-header">
        <div className="linkedin-avatar">🎯</div>
        <div className="linkedin-user">
          <span className="linkedin-name">SINT</span>
          <span className="linkedin-subtitle">AI Marketing Platform · 1d</span>
        </div>
      </div>
      {editing ? (
        <textarea className="content-edit" value={draft} onChange={e => setDraft(e.target.value)} rows={6} />
      ) : (
        <div className="linkedin-body">
          {d.hook && <div className="linkedin-hook">{d.hook}</div>}
          <div style={{ whiteSpace: 'pre-wrap' }}>{display}</div>
          {truncated && <button className="see-more" onClick={() => setExpanded(true)}>...see more</button>}
        </div>
      )}
      {image?.url && (
        <div style={{ margin: '8px 0', borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2a4a' }}>
          <img src={image.url} alt={image.revisedPrompt || 'Post image'} style={{ width: '100%', maxHeight: 300, objectFit: 'cover', display: 'block' }} loading="lazy" />
        </div>
      )}
      <CharBar count={d.content.length} limit={limit} />
      {(d.hashtags || []).length > 0 && (
        <div className="hashtags">{(d.hashtags || []).map((h, i) => <span key={i} className="hashtag">#{h}</span>)}</div>
      )}
      <div className="linkedin-actions">
        <span>👍 Like</span><span>💬 Comment</span><span>🔁 Repost</span><span>📤 Send</span>
      </div>
      <div className="preview-actions">
        <button className="btn small" onClick={() => {
          if (editing) { onEdit?.(index, draft); setEditing(false); } else { setEditing(true); }
        }}>{editing ? '💾 Save' : '✏️ Edit'}</button>
        <button className={`btn small ${copiedId === `d-${index}` ? 'copied' : ''}`}
          onClick={() => onCopy(d.content, `d-${index}`)}>
          {copiedId === `d-${index}` ? '✅ Copied!' : '📋 Copy'}
        </button>
        <PublishButton platform="linkedin" content={d.content} />
      </div>
    </div>
  );
}

function BlogPreview({ article, copiedId, onCopy }: {
  article: Article; copiedId: string; onCopy: (t: string, id: string) => void;
}) {
  const keywords = article.keywords;
  const content = article.content || '';
  const allKeywords = [keywords?.primary, ...(keywords?.secondary || []), ...(keywords?.lsi || [])].filter(Boolean);
  const found = allKeywords.filter(k => content.toLowerCase().includes((k as string).toLowerCase()));
  const score = allKeywords.length > 0 ? Math.round((found.length / allKeywords.length) * 100) : 0;
  const scoreColor = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';

  return (
    <div className="blog-preview">
      <div className="blog-meta-bar">
        <span className="seo-score" style={{ background: scoreColor + '22', color: scoreColor, borderColor: scoreColor }}>
          SEO {score}%
        </span>
        {keywords?.primary && <span className="badge">🔑 {keywords.primary}</span>}
      </div>
      {article.metaTitle && <div className="blog-meta-title">{article.metaTitle}</div>}
      {article.metaDescription && <div className="blog-meta-desc">{article.metaDescription}</div>}
      <h2 className="blog-title">{article.title}</h2>
      {article.headers && article.headers.length > 0 && (
        <div className="blog-toc">
          <strong>Outline:</strong>
          {article.headers.map((h, i) => <div key={i} className="blog-toc-item">• {h}</div>)}
        </div>
      )}
      <div className="blog-content-preview">{content.slice(0, 500)}{content.length > 500 ? '...' : ''}</div>
      <div className="preview-actions">
        <button className={`btn small ${copiedId === 'article' ? 'copied' : ''}`}
          onClick={() => onCopy(content, 'article')}>
          {copiedId === 'article' ? '✅ Copied!' : '📋 Copy Article'}
        </button>
      </div>
    </div>
  );
}

function CalendarPreview({ calendar }: { calendar: CalendarDay[] }) {
  const [hoveredPost, setHoveredPost] = useState<string | null>(null);
  return (
    <div className="calendar-preview">
      <div className="calendar-grid">
        {calendar.map((day) => (
          <div key={day.day} className="calendar-day">
            <div className="calendar-day-header">
              <span className="calendar-day-num">Day {day.day}</span>
              {day.date && <span className="calendar-day-date">{day.date}</span>}
            </div>
            <div className="calendar-posts">
              {day.posts.map((post, pi) => {
                const id = `${day.day}-${pi}`;
                return (
                  <div
                    key={pi}
                    className="calendar-post"
                    style={{ borderLeftColor: PLATFORM_COLORS[post.platform] || '#6366f1' }}
                    onMouseEnter={() => setHoveredPost(id)}
                    onMouseLeave={() => setHoveredPost(null)}
                  >
                    <div className="calendar-post-platform">{post.platform}</div>
                    {post.time && <div className="calendar-post-time">{post.time}</div>}
                    <div className="calendar-post-content">
                      {hoveredPost === id ? post.content : post.content.slice(0, 60) + (post.content.length > 60 ? '…' : '')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ContentPreview({ deliverables, article, calendar, images, publishQueue, onPublish, onEdit }: ContentPreviewProps) {
  const [copiedId, setCopiedId] = useState('');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const hasContent = deliverables.length > 0 || article || (calendar && calendar.length > 0);
  if (!hasContent) return null;

  return (
    <div className="content-preview-container">
      {article && (
        <div className="preview-section">
          <h4 className="preview-section-title">📝 Blog Article</h4>
          <BlogPreview article={article} copiedId={copiedId} onCopy={copyToClipboard} />
        </div>
      )}

      {deliverables.length > 0 && (
        <div className="preview-section">
          <h4 className="preview-section-title">📱 Platform Content</h4>
          {deliverables.map((d, i) => {
            const platform = d.platform?.toLowerCase();
            if (platform === 'twitter' || platform === 'x') {
              return <TwitterPreview key={i} d={d} index={i} onEdit={onEdit} onPublish={onPublish} copiedId={copiedId} onCopy={copyToClipboard} image={images?.[i % (images?.length || 1)]} />;
            }
            if (platform === 'linkedin') {
              return <LinkedInPreview key={i} d={d} index={i} onEdit={onEdit} copiedId={copiedId} onCopy={copyToClipboard} image={images?.[i % (images?.length || 1)]} />;
            }
            // Generic card for other platforms
            return (
              <div key={i} className="generic-preview" style={{ borderLeftColor: PLATFORM_COLORS[platform] || '#6366f1' }}>
                <div className="generic-header">
                  <span className="badge">{platform}</span>
                  {d.format && <span className="badge">{d.format}</span>}
                </div>
                {images?.[i % (images?.length || 1)]?.url && (
                  <div style={{ margin: '8px 0', borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2a4a' }}>
                    <img src={images[i % (images?.length || 1)].url} alt="Post image" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} loading="lazy" />
                  </div>
                )}
                <div className="generic-body" style={{ whiteSpace: 'pre-wrap' }}>{d.content}</div>
                {PLATFORM_LIMITS[platform] && <CharBar count={d.content.length} limit={PLATFORM_LIMITS[platform]} />}
                <div className="preview-actions">
                  <button className={`btn small ${copiedId === `d-${i}` ? 'copied' : ''}`}
                    onClick={() => copyToClipboard(d.content, `d-${i}`)}>
                    {copiedId === `d-${i}` ? '✅ Copied!' : '📋 Copy'}
                  </button>
                  <PublishButton platform={platform} content={d.content} hashtags={d.hashtags} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {images && images.length > 0 && (
        <div className="preview-section">
          <h4 className="preview-section-title">🖼️ Generated Images</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
            {images.filter(img => img.url && !img.error).map((img, i) => (
              <div key={i} style={{ background: '#1a1a2e', borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2a4a' }}>
                <img 
                  src={img.url} 
                  alt={img.revisedPrompt || 'Generated image'} 
                  style={{ width: '100%', height: 250, objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                />
                {img.revisedPrompt && (
                  <div style={{ padding: '8px 12px', fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                    {img.revisedPrompt.slice(0, 120)}{img.revisedPrompt.length > 120 ? '...' : ''}
                  </div>
                )}
                <div style={{ padding: '8px 12px', display: 'flex', gap: 8 }}>
                  <a href={img.url} target="_blank" rel="noopener noreferrer" className="btn small" style={{ textDecoration: 'none' }}>
                    🔗 Open
                  </a>
                  <button className="btn small" onClick={() => { navigator.clipboard.writeText(img.url || ''); }}>
                    📋 Copy URL
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {calendar && calendar.length > 0 && (
        <div className="preview-section">
          <h4 className="preview-section-title">📅 Content Calendar</h4>
          <CalendarPreview calendar={calendar} />
        </div>
      )}

      {publishQueue && publishQueue.length > 0 && (
        <div className="preview-section">
          <h4 className="preview-section-title">📤 Publish Queue</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {publishQueue.map((job, i) => {
              const normalizedStatus =
                job.status === 'queued' ? 'pending'
                  : job.status === 'pending_approval' ? 'pending_review'
                    : job.status;
              const statusStyles = normalizedStatus === 'pending'
                ? { bg: '#22c55e22', fg: '#22c55e' }
                : normalizedStatus === 'pending_review'
                  ? { bg: '#eab30822', fg: '#eab308' }
                  : normalizedStatus === 'failed'
                    ? { bg: '#ef444422', fg: '#ef4444' }
                    : { bg: '#6366f122', fg: '#6366f1' };
              return (
              <div key={i} style={{
                background: '#1a1a2e', borderRadius: 8, padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderLeft: '3px solid ' + (PLATFORM_COLORS[job.platform] || '#6366f1')
              }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span className="badge">{job.platform}</span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 999,
                      background: statusStyles.bg,
                      color: statusStyles.fg,
                    }}>{normalizedStatus}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>
                    📅 {new Date(job.scheduledAt).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    {job.content.slice(0, 80)}{job.content.length > 80 ? '...' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {job.imageUrl && (
                    <img src={job.imageUrl} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />
                  )}
                  <PublishButton platform={job.platform} content={job.content} />
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
