import type { Platform } from '../../core/types.js';

export type PublishQueueStatus =
  | 'pending'
  | 'pending_approval'
  | 'published'
  | 'failed'
  | 'cancelled';

export interface PublishRequest {
  platform: Platform;
  content: string;
  hashtags?: string[];
  media?: string[];
  articleUrl?: string;
  articleTitle?: string;
  articleDescription?: string;
  isThread?: boolean;
}

export interface PublishResult {
  platform: Platform;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface PublishQueueItem {
  id: string;
  request: PublishRequest;
  brandId: string;
  runId?: string;
  scheduledAt?: string;
  status: PublishQueueStatus;
  result?: PublishResult;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}
