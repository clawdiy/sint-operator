import { describe, expect, it } from 'vitest';
import { summarizeUsageFromRuns } from '../src/api/server.js';
import type { AsyncRun } from '../src/core/storage/run-store.js';

function makeRun(partial: Partial<AsyncRun>): AsyncRun {
  return {
    id: partial.id ?? 'run-1',
    status: partial.status ?? 'completed',
    pipelineId: partial.pipelineId ?? 'content-repurpose',
    brandId: partial.brandId ?? 'brand-1',
    userId: partial.userId ?? 'user-1',
    startedAt: partial.startedAt ?? new Date().toISOString(),
    completedAt: partial.completedAt,
    result: partial.result,
    error: partial.error,
  };
}

describe('summarizeUsageFromRuns', () => {
  it('aggregates model, pipeline, and brand totals', () => {
    const runs: AsyncRun[] = [
      makeRun({
        id: 'r1',
        pipelineId: 'seo-blog',
        brandId: 'brand-a',
        result: {
          metering: {
            totalTokens: 1200,
            totalCostUnits: 3.5,
            modelBreakdown: {
              'gpt-4.1-mini': { tokens: 700, costUnits: 2.0 },
              o3: { tokens: 500, costUnits: 1.5 },
            },
          },
        },
      }),
      makeRun({
        id: 'r2',
        pipelineId: 'seo-blog',
        brandId: 'brand-a',
        result: {
          metering: {
            totalTokens: 800,
            totalCostUnits: 2.0,
            modelBreakdown: {
              'gpt-4.1-mini': { tokens: 800, costUnits: 2.0 },
            },
          },
        },
      }),
      makeRun({
        id: 'r3',
        pipelineId: 'social-calendar',
        brandId: 'brand-b',
        result: {
          metering: {
            totalTokens: 400,
            totalCostUnits: 1.0,
            modelBreakdown: {
              'gpt-4.1-nano': { tokens: 400, costUnits: 1.0 },
            },
          },
        },
      }),
    ];

    const summary = summarizeUsageFromRuns(runs, 30);
    expect(summary.totalRuns).toBe(3);
    expect(summary.totalTokens).toBe(2400);
    expect(summary.totalCostUnits).toBe(6.5);
    expect(summary.byPipeline['seo-blog']).toEqual({ runs: 2, costUnits: 5.5 });
    expect(summary.byBrand['brand-a']).toEqual({ runs: 2, costUnits: 5.5 });
    expect(summary.byModel['gpt-4.1-mini']).toEqual({ runs: 2, tokens: 1500, costUnits: 4.0 });
  });

  it('filters out runs older than the requested period', () => {
    const now = Date.now();
    const recent = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const old = new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString();

    const runs: AsyncRun[] = [
      makeRun({
        id: 'recent',
        startedAt: recent,
        result: {
          metering: {
            totalTokens: 100,
            totalCostUnits: 1,
            modelBreakdown: { 'gpt-4.1-mini': { tokens: 100, costUnits: 1 } },
          },
        },
      }),
      makeRun({
        id: 'old',
        startedAt: old,
        result: {
          metering: {
            totalTokens: 500,
            totalCostUnits: 5,
            modelBreakdown: { o3: { tokens: 500, costUnits: 5 } },
          },
        },
      }),
    ];

    const summary = summarizeUsageFromRuns(runs, 7);
    expect(summary.totalRuns).toBe(1);
    expect(summary.totalTokens).toBe(100);
    expect(summary.byModel.o3).toBeUndefined();
  });

  it('handles missing metering blocks safely', () => {
    const runs: AsyncRun[] = [
      makeRun({ id: 'r1', result: { somethingElse: true } }),
      makeRun({ id: 'r2', result: null }),
    ];

    const summary = summarizeUsageFromRuns(runs, 30);
    expect(summary.totalRuns).toBe(2);
    expect(summary.totalTokens).toBe(0);
    expect(summary.totalCostUnits).toBe(0);
    expect(Object.keys(summary.byModel)).toHaveLength(0);
  });
});
