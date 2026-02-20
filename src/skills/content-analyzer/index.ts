/**
 * Content Analyzer Skill
 * 
 * Analyzes source content to identify:
 * - Key themes and topics
 * - Quotable moments
 * - Data points and statistics
 * - Platform suitability scores per segment
 * - Top 10 "hook" moments for short-form content
 * 
 * Uses Claude Sonnet 4.5 (routine tier) by default.
 */

import { buildBrandContext } from '../../core/brand/manager.js';
import type { Skill, SkillContext, SkillResult, Platform, TimestampedSegment } from '../../core/types.js';

interface ContentMap {
  summary: string;
  themes: Array<{
    name: string;
    description: string;
    relevanceScore: number;
  }>;
  quotablesMoments: Array<{
    text: string;
    context: string;
    platforms: Platform[];
    segmentIndex?: number;
  }>;
  dataPoints: Array<{
    point: string;
    source: string;
    usableAs: string;
  }>;
  hooks: Array<{
    text: string;
    hookType: 'question' | 'statistic' | 'contrarian' | 'story' | 'pain_point' | 'transformation';
    platformFit: Record<string, number>;
    segmentIndex?: number;
    timestamp?: { start: number; end: number };
  }>;
  platformSuitability: Record<string, {
    score: number;
    bestFormats: string[];
    contentAngle: string;
  }>;
  keyTakeaways: string[];
}

export const contentAnalyzerSkill: Skill = {
  id: 'content-analyzer',
  name: 'Content Analyzer',
  description: 'Analyze content to identify themes, hooks, quotable moments, and platform suitability. Produces a content map for downstream skills.',
  version: '1.0.0',
  costUnits: 10,
  inputs: [
    { name: 'raw_transcript', type: 'string', required: true, description: 'Source content text' },
    { name: 'segments', type: 'array', required: false, description: 'Timestamped segments (from video)', default: [] },
    { name: 'target_platforms', type: 'array', required: false, description: 'Platforms to analyze for', default: ['twitter', 'linkedin', 'instagram', 'tiktok', 'blog'] },
  ],
  outputs: [
    { name: 'content_map', type: 'object', description: 'Complete content analysis map' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const transcript = ctx.inputs.raw_transcript as string;
    const segments = (ctx.inputs.segments as TimestampedSegment[]) ?? [];
    const platforms = (ctx.inputs.target_platforms as string[]) ?? ['twitter', 'linkedin', 'instagram', 'tiktok', 'blog'];

    const brandContext = buildBrandContext(ctx.brand);

    const hasTimestamps = segments.length > 0;

    const prompt = `You are an expert content strategist analyzing source material for multi-platform repurposing.

${brandContext}

## Source Content:
${transcript.slice(0, 20000)}

${hasTimestamps ? `
## Timestamped Segments (${segments.length} total):
${segments.slice(0, 30).map((s, i) =>
  `[${formatTime(s.start)} - ${formatTime(s.end)}] Segment ${i}: ${s.text.slice(0, 200)}`
).join('\n')}
` : ''}

## Target Platforms: ${platforms.join(', ')}

## Your Task:
Perform a deep content analysis and produce a content map with:

1. **Themes**: Identify 3-5 key themes/topics with relevance scores (0-1)
2. **Quotable Moments**: Extract 5-10 specific quotes or statements that are shareable as-is
3. **Data Points**: Find any statistics, numbers, or concrete facts
4. **Hooks**: Identify the TOP 10 "hook" moments — these are attention-grabbing openings for short-form content. Classify each hook type (question, statistic, contrarian take, story opener, pain point, transformation)
5. **Platform Suitability**: Score each platform (0-1) and suggest best content format and angle
6. **Key Takeaways**: 3-5 main points a reader/viewer should remember

${hasTimestamps ? 'For video content: include segment indices and timestamps for hooks and quotables.' : ''}

Respond with JSON matching this structure:
{
  "summary": "<2-3 sentence content summary>",
  "themes": [{ "name": "", "description": "", "relevanceScore": 0.0 }],
  "quotablesMoments": [{ "text": "", "context": "", "platforms": [], "segmentIndex": 0 }],
  "dataPoints": [{ "point": "", "source": "", "usableAs": "" }],
  "hooks": [{
    "text": "", "hookType": "question|statistic|contrarian|story|pain_point|transformation",
    "platformFit": { "twitter": 0.0, "linkedin": 0.0, "tiktok": 0.0 },
    "segmentIndex": 0, "timestamp": { "start": 0, "end": 0 }
  }],
  "platformSuitability": {
    "<platform>": { "score": 0.0, "bestFormats": [], "contentAngle": "" }
  },
  "keyTakeaways": [""]
}`;

    const result = await ctx.llm.completeJSON<ContentMap>(prompt, {
      type: 'object',
    }, {
      tier: 'routine',  // Claude Sonnet 4.5 — analysis doesn't need Opus
      maxTokens: 4096,
      temperature: 0.3,
    });

    // Store analysis in memory for brand learning
    await ctx.memory.store(
      'content_analysis',
      `analysis-${Date.now()}`,
      result.data.summary,
      {
        themes: result.data.themes.map(t => t.name),
        hookCount: result.data.hooks.length,
        platforms,
      }
    );

    return {
      output: { content_map: result.data },
      tokensUsed: result.meta.totalTokens,
      costUnits: result.meta.costUnits,
      modelUsed: result.meta.model,
      durationMs: Date.now() - start,
    };
  },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
