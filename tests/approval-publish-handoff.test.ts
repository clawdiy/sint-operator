import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';
import {
  approveItem,
  closeApprovalStore,
  createApprovalsFromRun,
  editItem,
  initApprovalStore,
} from '../src/services/approval/index.js';
import { __resetSocialPublishingForTests, getQueue } from '../src/services/social/index.js';

const TEST_DIR = join(import.meta.dirname ?? '.', '__approval_publish_tmp__');

describe('Approval → Publish Queue handoff', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    __resetSocialPublishingForTests();
    initApprovalStore(TEST_DIR);
  });

  afterEach(() => {
    closeApprovalStore();
    __resetSocialPublishingForTests();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('queues supported platform content when approved', () => {
    const created = createApprovalsFromRun({
      runId: 'run_1',
      pipelineId: 'content-repurpose',
      brandId: 'brand_1',
      userId: 'user_1',
      result: {
        steps: [
          {
            output: {
              deliverables: [
                { platform: 'twitter', content: 'Approved tweet content' },
              ],
            },
          },
        ],
      },
    });

    expect(created).toHaveLength(1);
    expect(approveItem(created[0].id)).toBe(true);

    const queue = getQueue({ userId: 'user_1', brandId: 'brand_1' });
    expect(queue).toHaveLength(1);
    expect(queue[0].request.platform).toBe('twitter');
    expect(queue[0].request.content).toBe('Approved tweet content');
    expect(queue[0].status).toBe('pending');
  });

  it('uses edited content when approving and does not duplicate queue entries', () => {
    const created = createApprovalsFromRun({
      runId: 'run_2',
      pipelineId: 'content-repurpose',
      brandId: 'brand_2',
      userId: 'user_2',
      result: {
        steps: [
          {
            output: {
              deliverables: [
                { platform: 'linkedin', content: 'Original draft' },
              ],
            },
          },
        ],
      },
    });

    expect(created).toHaveLength(1);

    expect(editItem(created[0].id, 'Edited LinkedIn final copy')).toBe(true);
    expect(editItem(created[0].id, 'Edited LinkedIn final copy')).toBe(true);

    const queue = getQueue({ userId: 'user_2', brandId: 'brand_2' });
    expect(queue).toHaveLength(1);
    expect(queue[0].request.platform).toBe('linkedin');
    expect(queue[0].request.content).toBe('Edited LinkedIn final copy');
  });
});
