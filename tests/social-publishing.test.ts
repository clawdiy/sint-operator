/**
 * Social Publishing Service Tests
 *
 * Tests the unified publish interface, queue management, and platform detection.
 */

import { describe, it, expect } from 'vitest';
import {
  publish,
  publishMulti,
  queuePublish,
  getQueue,
  cancelQueueItem,
  getConfiguredPlatforms,
} from '../src/services/social/index.js';

describe('Social Publishing Manager', () => {
  describe('Platform Status', () => {
    it('returns configured platforms map', () => {
      const status = getConfiguredPlatforms();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
      expect('twitter' in status).toBe(true);
      expect('linkedin' in status).toBe(true);
    });

    it('shows platforms as not configured without env vars', () => {
      const status = getConfiguredPlatforms();
      // Without env vars, platforms should not be configured
      expect(status.twitter).toBe(false);
      expect(status.linkedin).toBe(false);
    });
  });

  describe('Publish Queue', () => {
    it('adds items to the publish queue', () => {
      const item = queuePublish(
        { platform: 'twitter' as any, content: 'Test tweet from SINT' },
        'sint-brand',
      );
      expect(item).toBeDefined();
      expect(item.id).toBeDefined();
      expect(item.status).toBe('pending');
      expect(item.request.content).toBe('Test tweet from SINT');
    });

    it('lists queue items', () => {
      const items = getQueue();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });

    it('filters queue by status', () => {
      const pending = getQueue({ status: 'pending' });
      expect(Array.isArray(pending)).toBe(true);
      for (const item of pending) {
        expect(item.status).toBe('pending');
      }
    });

    it('cancels a queue item', () => {
      const item = queuePublish(
        { platform: 'linkedin' as any, content: 'Test post' },
        'sint-brand',
      );
      const cancelled = cancelQueueItem(item.id);
      expect(cancelled).toBe(true);
      const items = getQueue();
      const found = items.find(i => i.id === item.id);
      expect(found?.status).toBe('cancelled');
    });

    it('returns false when cancelling non-existent item', () => {
      const result = cancelQueueItem('nonexistent-id');
      expect(result).toBe(false);
    });
  });

  describe('Publish (without credentials)', () => {
    it('fails gracefully for twitter without credentials', async () => {
      const result = await publish({
        platform: 'twitter' as any,
        content: 'Test tweet',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('fails gracefully for linkedin without credentials', async () => {
      const result = await publish({
        platform: 'linkedin' as any,
        content: 'Test post',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('publishMulti handles multiple platforms', async () => {
      const results = await publishMulti(
        [
          { platform: 'twitter' as any, content: 'Tweet test' },
          { platform: 'linkedin' as any, content: 'LinkedIn test' },
        ],
      );
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      for (const result of results) {
        expect(result.success).toBe(false);
      }
    });
  });
});
