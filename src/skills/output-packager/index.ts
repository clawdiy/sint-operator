/**
 * Output Packager Skill
 * 
 * Organizes all pipeline outputs into a deliverable folder:
 * /clips/      — short-form videos
 * /linkedin/   — post drafts (.md)
 * /blog/       — SEO post + schema (.html + .json)
 * /summary.md  — content map + distribution schedule
 */

import { writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join, basename } from 'path';
import type { Skill, SkillContext, SkillResult } from '../../core/types.js';

interface PackageOutput {
  packageDir: string;
  summary: string;
  files: Array<{ path: string; type: string; description: string }>;
  totalFiles: number;
}

export const outputPackagerSkill: Skill = {
  id: 'output-packager',
  name: 'Output Packager',
  description: 'Organize all pipeline outputs into a structured deliverable folder with summary and distribution schedule.',
  version: '1.0.0',
  costUnits: 2,
  inputs: [
    { name: 'clips', type: 'array', required: false, description: 'Video clips to package', default: [] },
    { name: 'linkedin_posts', type: 'array', required: false, description: 'LinkedIn posts', default: [] },
    { name: 'blog_post', type: 'object', required: false, description: 'Blog post content', default: null },
    { name: 'content_map', type: 'object', required: false, description: 'Content analysis map', default: null },
    { name: 'deliverables', type: 'object', required: false, description: 'Generic deliverables', default: null },
    { name: 'output_dir', type: 'string', required: false, description: 'Output directory', default: '' },
  ],
  outputs: [
    { name: 'packageDir', type: 'string', description: 'Path to deliverable package' },
    { name: 'summary', type: 'string', description: 'Package summary' },
    { name: 'files', type: 'array', description: 'List of packaged files' },
    { name: 'totalFiles', type: 'number', description: 'Total files in package' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const outputDir = (ctx.inputs.output_dir as string) || join('/tmp', `deliverable-${Date.now()}`);
    const clips = (ctx.inputs.clips as Array<Record<string, unknown>>) ?? [];
    const linkedinPosts = (ctx.inputs.linkedin_posts as Array<Record<string, unknown>>) ?? [];
    const blogPost = ctx.inputs.blog_post as Record<string, unknown> | null;
    const contentMap = ctx.inputs.content_map as Record<string, unknown> | null;
    const deliverables = ctx.inputs.deliverables as Record<string, unknown> | null;

    const files: PackageOutput['files'] = [];
    const sections: string[] = [`# Content Deliverable Package\n\nGenerated: ${new Date().toISOString()}\nBrand: ${ctx.brand.name}\n`];

    // Create directories
    for (const dir of ['clips', 'linkedin', 'blog', 'social']) {
      mkdirSync(join(outputDir, dir), { recursive: true });
    }

    // Package clips
    if (clips.length > 0) {
      sections.push(`## Video Clips (${clips.length})\n`);
      for (const clip of clips) {
        if (clip.path && existsSync(clip.path as string)) {
          const dest = join(outputDir, 'clips', basename(clip.path as string));
          copyFileSync(clip.path as string, dest);
          files.push({ path: dest, type: 'video', description: (clip.hookText as string) ?? 'Video clip' });
          sections.push(`- **Clip ${clip.index}** (${clip.platform}): ${(clip.hookText as string)?.slice(0, 80)}`);
        }
      }
    }

    // Package LinkedIn posts
    if (linkedinPosts.length > 0) {
      sections.push(`\n## LinkedIn Posts (${linkedinPosts.length})\n`);
      for (let i = 0; i < linkedinPosts.length; i++) {
        const post = linkedinPosts[i];
        const content = (post.content as string) ?? JSON.stringify(post);
        const filename = `linkedin-post-${i + 1}.md`;
        writeFileSync(join(outputDir, 'linkedin', filename), content);
        files.push({ path: join(outputDir, 'linkedin', filename), type: 'linkedin', description: (post.theme as string) ?? `Post ${i + 1}` });
        sections.push(`- **Post ${i + 1}** (${post.theme ?? 'general'}): ${content.slice(0, 80)}...`);
      }
    }

    // Package blog post
    if (blogPost) {
      sections.push(`\n## Blog Post\n`);
      const article = (blogPost.article as Record<string, unknown>) ?? blogPost;
      const content = (article.content as string) ?? '';
      const title = (article.title as string) ?? 'Blog Post';

      writeFileSync(join(outputDir, 'blog', 'blog-post.md'), content);
      files.push({ path: join(outputDir, 'blog', 'blog-post.md'), type: 'blog', description: title });

      // Schema markup
      if (article.schemaType) {
        const schema = {
          '@context': 'https://schema.org',
          '@type': article.schemaType,
          headline: article.metaTitle ?? title,
          description: article.metaDescription ?? '',
          wordCount: article.wordCount,
        };
        writeFileSync(join(outputDir, 'blog', 'schema.json'), JSON.stringify(schema, null, 2));
        files.push({ path: join(outputDir, 'blog', 'schema.json'), type: 'schema', description: 'Schema markup' });
      }

      sections.push(`- **${title}** (${article.wordCount ?? '?'} words, ~${article.readingTimeMin ?? '?'} min read)`);
    }

    // Package generic deliverables
    if (deliverables) {
      const items = (deliverables.deliverables as Array<Record<string, unknown>>) ?? [];
      if (items.length > 0) {
        sections.push(`\n## Social Content (${items.length} pieces)\n`);
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const platform = (item.platform as string) ?? 'general';
          const content = (item.content as string) ?? '';
          const filename = `${platform}-${i + 1}.md`;
          writeFileSync(join(outputDir, 'social', filename), content);
          files.push({ path: join(outputDir, 'social', filename), type: platform, description: `${platform} content` });
          sections.push(`- **${platform}**: ${content.slice(0, 60)}...`);
        }
      }
    }

    // Content map summary
    if (contentMap) {
      sections.push(`\n## Content Analysis\n`);
      sections.push(`Summary: ${(contentMap.summary as string) ?? 'N/A'}`);
      
      const themes = (contentMap.themes as Array<{ name: string }>) ?? [];
      if (themes.length > 0) {
        sections.push(`\nThemes: ${themes.map(t => t.name).join(', ')}`);
      }
    }

    // Distribution schedule
    sections.push(`\n## Recommended Distribution Schedule\n`);
    sections.push(`| Day | Platform | Content | Time |`);
    sections.push(`|-----|----------|---------|------|`);
    sections.push(`| Mon | LinkedIn | Thought leadership post | 8:00 AM |`);
    sections.push(`| Tue | Twitter | Thread from key insights | 10:00 AM |`);
    sections.push(`| Wed | Instagram | Visual + caption | 12:00 PM |`);
    sections.push(`| Thu | TikTok | Short-form clip | 7:00 PM |`);
    sections.push(`| Fri | Blog | SEO article publish | 9:00 AM |`);

    // Write summary
    const summary = sections.join('\n');
    writeFileSync(join(outputDir, 'summary.md'), summary);
    files.push({ path: join(outputDir, 'summary.md'), type: 'summary', description: 'Package summary' });

    return {
      output: {
        packageDir: outputDir,
        summary,
        files,
        totalFiles: files.length,
      },
      tokensUsed: 0,
      costUnits: 2,
      modelUsed: 'none',
      durationMs: Date.now() - start,
    };
  },
};
