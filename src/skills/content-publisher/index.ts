/**
 * Content Publisher Skill
 * 
 * Takes generated deliverables + calendar schedule and creates publish jobs.
 * Integrates with the social publishing queue (LinkedIn, Twitter) and
 * the approval system for human-in-the-loop workflows.
 */

import type { Skill, SkillContext, SkillResult } from '../../core/types.js';

interface PublishJob {
  id: string;
  platform: string;
  content: string;
  scheduledAt: string;
  imageUrl?: string;
  videoUrl?: string;
  status: 'queued' | 'pending_approval' | 'approved' | 'published' | 'failed';
  metadata: Record<string, unknown>;
}

export const contentPublisherSkill: Skill = {
  name: 'content-publisher',
  description: 'Queue content for publishing across platforms with scheduling and approval support',
  version: '1.0.0',
  costUnits: 2,
  inputs: [
    { name: 'deliverables', type: 'object', required: true, description: 'Generated content pieces from repurpose step' },
    { name: 'calendar', type: 'object', required: false, description: 'Content calendar with scheduling info' },
    { name: 'images', type: 'object', required: false, description: 'Generated images for posts' },
    { name: 'video_clips', type: 'object', required: false, description: 'Generated video clips' },
    { name: 'auto_schedule', type: 'boolean', required: false, description: 'Auto-queue or require approval', default: false },
  ],
  outputs: [
    { name: 'publish_queue', type: 'array', description: 'List of queued publish jobs' },
    { name: 'summary', type: 'string', description: 'Summary of what was scheduled' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    
    const deliverables = ctx.inputs.deliverables as Record<string, unknown> ?? {};
    const calendar = ctx.inputs.calendar as Record<string, unknown> ?? {};
    const images = ctx.inputs.images as Record<string, unknown> ?? {};
    const videoClips = ctx.inputs.video_clips as Record<string, unknown> ?? {};
    const autoSchedule = ctx.inputs.auto_schedule === true || ctx.inputs.auto_schedule === 'true';
    
    const deliverablesList = (deliverables as any)?.deliverables ?? 
                             (deliverables as any)?.items ?? 
                             (deliverables as any)?.posts ??
                             [];
    
    const imagesList = (images as any)?.images ?? [];
    
    const calendarEntries = (calendar as any)?.calendar ??
                            (calendar as any)?.schedule ??
                            (calendar as any)?.days ??
                            [];

    const jobs: PublishJob[] = [];
    const now = new Date();

    // Process each deliverable into a publish job
    const items = Array.isArray(deliverablesList) ? deliverablesList : 
                  typeof deliverablesList === 'object' ? Object.values(deliverablesList) : [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Record<string, unknown>;
      const platform = (item?.platform as string) ?? 'unknown';
      const content = (item?.content as string) ?? (item?.text as string) ?? JSON.stringify(item);
      
      // Find matching calendar slot
      const calendarSlot = Array.isArray(calendarEntries) 
        ? calendarEntries.find((c: any) => c?.platform === platform || c?.day === i + 1)
        : null;
      
      // Calculate schedule time
      let scheduledAt: Date;
      if (calendarSlot && (calendarSlot as any)?.date) {
        scheduledAt = new Date((calendarSlot as any).date);
      } else {
        // Spread across days with optimal timing per platform
        const dayOffset = Math.floor(i / 2); // 2 posts per day
        const hour = getOptimalHour(platform);
        scheduledAt = new Date(now);
        scheduledAt.setDate(scheduledAt.getDate() + dayOffset + 1);
        scheduledAt.setHours(hour, 0, 0, 0);
      }

      // Assign image if available
      const image = Array.isArray(imagesList) && imagesList[i % imagesList.length];
      
      const job: PublishJob = {
        id: `pub_${Date.now()}_${i}_${platform}`,
        platform,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        scheduledAt: scheduledAt.toISOString(),
        imageUrl: image?.url ?? image?.revisedPrompt ?? undefined,
        status: autoSchedule ? 'queued' : 'pending_approval',
        metadata: {
          deliverableIndex: i,
          calendarSlot: calendarSlot ?? null,
          contentType: (item as any)?.type ?? (item as any)?.format ?? 'post',
          hashtags: (item as any)?.hashtags ?? [],
        },
      };

      jobs.push(job);
    }

    // Store jobs in memory for the publish queue worker to pick up
    if (ctx.memory) {
      try {
        await ctx.memory.store(
          'publish-queue',
          `batch-${Date.now()}`,
          JSON.stringify(jobs),
          { ttl: 30 * 24 * 60 * 60 } // 30 days
        );
      } catch {
        // Memory store may not be available
      }
    }

    const platformCounts = jobs.reduce((acc, j) => {
      acc[j.platform] = (acc[j.platform] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summary = [
      `📋 Created ${jobs.length} publish jobs:`,
      ...Object.entries(platformCounts).map(([p, c]) => `  • ${p}: ${c} posts`),
      `📅 Scheduled across ${new Set(jobs.map(j => j.scheduledAt.split('T')[0])).size} days`,
      `🔒 Status: ${autoSchedule ? 'Auto-queued for publishing' : 'Pending approval — review in dashboard or Telegram'}`,
    ].join('\n');

    return {
      output: {
        publish_queue: jobs,
        total_jobs: jobs.length,
        platforms: platformCounts,
        auto_scheduled: autoSchedule,
        summary,
      },
      tokensUsed: 0,
      costUnits: 2,
    };
  },
};

function getOptimalHour(platform: string): number {
  const hours: Record<string, number> = {
    linkedin: 10,     // 10am — professionals browsing
    twitter: 9,       // 9am — morning news cycle
    instagram: 12,    // 12pm — lunch break scrolling
    instagram_reels: 19, // 7pm — evening entertainment
    tiktok: 20,       // 8pm — peak TikTok hours
    facebook: 11,     // 11am — mid-morning
    blog: 8,          // 8am — SEO indexing window
  };
  return hours[platform] ?? 10;
}

export default contentPublisherSkill;
