import { describe, expect, it } from 'vitest';
import { matchOpenClawIntent } from '../src/integrations/openclaw-connector.js';

describe('matchOpenClawIntent', () => {
  it('maps repurpose commands to content-repurpose pipeline', () => {
    const intent = matchOpenClawIntent({
      message: 'repurpose this video into posts',
      url: 'https://example.com/video.mp4',
    });

    expect(intent).not.toBeNull();
    expect(intent?.pipeline).toBe('content-repurpose');
    expect(intent?.inputs).toMatchObject({
      source_url: 'https://example.com/video.mp4',
    });
  });

  it('maps image and video generation commands', () => {
    const imageIntent = matchOpenClawIntent({
      message: 'generate image for this campaign',
    });
    const videoIntent = matchOpenClawIntent({
      message: 'create video from this idea',
      url: 'https://example.com/reference.jpg',
    });

    expect(imageIntent?.pipeline).toBe('image-generate');
    expect(videoIntent?.pipeline).toBe('video-generate');
    expect(videoIntent?.inputs).toMatchObject({
      image_url: 'https://example.com/reference.jpg',
    });
  });

  it('returns null when no intent pattern matches', () => {
    const intent = matchOpenClawIntent({
      message: 'hello world',
    });
    expect(intent).toBeNull();
  });
});
