// Shared UI utilities

const PIPELINE_DISPLAY_NAMES: Record<string, string> = {
  'content-repurpose': 'Content Repurposer',
  'seo-blog': 'SEO Blog Writer',
  'social-calendar': 'Content Calendar',
  'brand-identity': 'Brand Identity',
  'ad-variations': 'Ad Variations',
  'visual-metadata': 'Visual Metadata',
  'infographic': 'Infographic Creator',
};

const STATUS_DISPLAY: Record<string, string> = {
  queued: 'Starting...',
  running: 'Generating...',
  completed: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  queued: '#F59E0B',
  running: '#3B82F6',
  completed: '#10B981',
  failed: '#EF4444',
  cancelled: '#6B7280',
};

export function pipelineName(id: string): string {
  return PIPELINE_DISPLAY_NAMES[id] || id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function statusLabel(status: string): string {
  return STATUS_DISPLAY[status] || status;
}

export function statusColor(status: string): string {
  return STATUS_COLORS[status] || '#6B7280';
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return '<1s';
  if (ms < 60000) return Math.round(ms / 1000) + 's';
  return Math.round(ms / 60000) + 'm';
}

export function formatRelativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return new Date(date).toLocaleDateString();
}

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  linkedin: 3000,
  instagram: 2200,
  facebook: 63206,
  threads: 500,
  tiktok: 2200,
};

export function platformCharLimit(platform: string): number {
  return PLATFORM_LIMITS[platform.toLowerCase()] || 5000;
}

export const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  instagram: '#E4405F',
  facebook: '#1877F2',
  threads: '#000000',
  tiktok: '#000000',
  youtube: '#FF0000',
};

export const PLATFORM_ICONS: Record<string, string> = {
  twitter: '𝕏',
  linkedin: '💼',
  instagram: '📸',
  facebook: '👥',
  threads: '🧵',
  tiktok: '🎵',
  youtube: '📺',
};

/** Simple markdown to HTML for blog preview (no dependencies) */
export function renderMarkdown(md: string): string {
  if (!md) return '';
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p>')
    // Line breaks
    .replace(/\n/g, '<br/>');
  
  return '<p>' + html + '</p>';
}
