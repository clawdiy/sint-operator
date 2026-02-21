import React, { useState, useEffect } from 'react';
import { publishContent, getPublishStatus } from '../api';

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '𝕏', linkedin: '💼', instagram: '📸', facebook: '👥',
  threads: '🧵', tiktok: '🎵',
};

const PLATFORM_NAMES: Record<string, string> = {
  twitter: 'Twitter/X', linkedin: 'LinkedIn', instagram: 'Instagram',
  facebook: 'Facebook', threads: 'Threads', tiktok: 'TikTok',
};

interface PublishButtonProps {
  platform: string;
  content: string;
  hashtags?: string[];
  disabled?: boolean;
  onPublished?: (result: any) => void;
}

export default function PublishButton({ platform, content, hashtags, disabled, onPublished }: PublishButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [postUrl, setPostUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [configured, setConfigured] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    getPublishStatus()
      .then(res => {
        setConfigured(res.platforms?.[platform]?.configured ?? false);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [platform]);

  const handlePublish = async () => {
    setState('loading');
    try {
      const result = await publishContent(platform, content, hashtags);
      if (result.success) {
        setState('success');
        setPostUrl(result.postUrl || '');
        onPublished?.(result);
      } else {
        setState('error');
        setErrorMsg(result.error || 'Unknown error');
      }
    } catch (err: any) {
      setState('error');
      setErrorMsg(err.message || 'Failed to publish');
    }
  };

  const icon = PLATFORM_ICONS[platform] || '📤';
  const name = PLATFORM_NAMES[platform] || platform;

  if (!checked) return null;

  if (!configured) {
    return (
      <button className="publish-btn disabled" disabled>
        {icon} Connect {name}
      </button>
    );
  }

  if (state === 'success') {
    return (
      <span className="publish-btn success">
        ✅ Posted{postUrl ? <> — <a href={postUrl} target="_blank" rel="noopener noreferrer">View ↗</a></> : ''}
      </span>
    );
  }

  if (state === 'error') {
    return (
      <button className="publish-btn error" onClick={handlePublish}>
        ❌ Failed — Retry
      </button>
    );
  }

  return (
    <button className="publish-btn" onClick={handlePublish} disabled={disabled || state === 'loading'}>
      {state === 'loading' ? '⏳ Posting...' : `${icon} Post to ${name}`}
    </button>
  );
}
