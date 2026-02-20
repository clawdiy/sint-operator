/**
 * SINT CLI — Quick pipeline execution from command line
 */

import { Command } from 'commander';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { Orchestrator } from './orchestrator/index.js';

const program = new Command();

program
  .name('sint')
  .description('SINT Marketing Operator CLI')
  .version('0.1.0');

function createOrchestrator(): Orchestrator {
  return new Orchestrator({
    dataDir: resolve(process.env.SINT_DATA_DIR ?? './data'),
    configDir: resolve(process.env.SINT_CONFIG_DIR ?? './config'),
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    models: {
      complex: process.env.SINT_MODEL_COMPLEX ?? 'gpt-4o',
      routine: process.env.SINT_MODEL_ROUTINE ?? 'gpt-4o-mini',
      fallback: process.env.SINT_MODEL_FALLBACK ?? 'gpt-4o-mini',
    },
  });
}

program
  .command('repurpose')
  .description('Repurpose content across platforms')
  .requiredOption('-b, --brand <id>', 'Brand ID')
  .requiredOption('-p, --platforms <list>', 'Comma-separated platforms')
  .option('-f, --file <path>', 'Read content from file')
  .option('-t, --text <content>', 'Content text')
  .action(async (opts) => {
    const orch = createOrchestrator();
    const content = opts.file
      ? readFileSync(resolve(opts.file), 'utf-8')
      : opts.text;

    if (!content) {
      console.error('❌ Provide --text or --file');
      process.exit(1);
    }

    const platforms = opts.platforms.split(',').map((p: string) => p.trim());
    console.log(`🔄 Repurposing for: ${platforms.join(', ')}\n`);

    const run = await orch.repurposeContent(opts.brand, content, platforms);
    console.log(JSON.stringify(run, null, 2));
    orch.shutdown();
  });

program
  .command('blog')
  .description('Generate an SEO blog post')
  .requiredOption('-b, --brand <id>', 'Brand ID')
  .requiredOption('-t, --topic <topic>', 'Blog topic')
  .option('-k, --keywords <list>', 'Comma-separated keywords')
  .action(async (opts) => {
    const orch = createOrchestrator();
    const keywords = opts.keywords?.split(',').map((k: string) => k.trim()) ?? [];
    
    console.log(`📝 Generating blog: ${opts.topic}\n`);
    const run = await orch.generateBlogPost(opts.brand, opts.topic, keywords);
    console.log(JSON.stringify(run, null, 2));
    orch.shutdown();
  });

program
  .command('calendar')
  .description('Generate a social media calendar')
  .requiredOption('-b, --brand <id>', 'Brand ID')
  .requiredOption('-d, --days <number>', 'Number of days', parseInt)
  .option('-t, --themes <list>', 'Comma-separated themes')
  .action(async (opts) => {
    const orch = createOrchestrator();
    const themes = opts.themes?.split(',').map((t: string) => t.trim()) ?? [];
    
    console.log(`📅 Generating ${opts.days}-day calendar\n`);
    const run = await orch.generateSocialCalendar(opts.brand, opts.days, themes);
    console.log(JSON.stringify(run, null, 2));
    orch.shutdown();
  });

program
  .command('brands')
  .description('List all brands')
  .action(() => {
    const orch = createOrchestrator();
    const brands = orch.listBrands();
    if (brands.length === 0) {
      console.log('No brands configured. Add one in config/brands/');
    } else {
      brands.forEach(b => console.log(`  ${b.id} — ${b.name} (${b.voice.tone.join(', ')})`));
    }
    orch.shutdown();
  });

program
  .command('pipelines')
  .description('List all pipelines')
  .action(() => {
    const orch = createOrchestrator();
    const pipes = orch.listPipelines();
    if (pipes.length === 0) {
      console.log('No pipelines configured. Add them in config/pipelines/');
    } else {
      pipes.forEach(p => console.log(`  ${p.id} — ${p.name}: ${p.description}`));
    }
    orch.shutdown();
  });

program.parse();
