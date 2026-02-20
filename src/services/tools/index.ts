/**
 * Tool Services — FFmpeg, Sharp, Playwright, Whisper wrappers
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { FFmpegService, SharpService, BrowserService, ToolServices, SERPResult, SocialCardOptions } from '../../core/types.js';
import { WhisperServiceImpl } from './whisper.js';

const execAsync = promisify(exec);

// ─── FFmpeg Service ───────────────────────────────────────────

class FFmpegServiceImpl implements FFmpegService {
  async extractClip(input: string, start: number, duration: number, output: string): Promise<string> {
    this.ensureDir(output);
    await execAsync(`ffmpeg -y -i "${input}" -ss ${start} -t ${duration} -c copy "${output}"`);
    return output;
  }

  async transcode(input: string, options: Record<string, unknown>): Promise<string> {
    const output = options.output as string;
    const codec = options.codec as string ?? 'libx264';
    const resolution = options.resolution as string ?? '';

    this.ensureDir(output);
    let cmd = `ffmpeg -y -i "${input}" -c:v ${codec}`;
    if (resolution) cmd += ` -s ${resolution}`;
    if (options.crf) cmd += ` -crf ${options.crf}`;
    if (options.fps) cmd += ` -r ${options.fps}`;
    if (options.aspectRatio) cmd += ` -aspect ${options.aspectRatio}`;
    cmd += ` "${output}"`;

    await execAsync(cmd);
    return output;
  }

  async extractAudio(input: string, output: string): Promise<string> {
    this.ensureDir(output);
    await execAsync(`ffmpeg -y -i "${input}" -vn -acodec libmp3lame -q:a 2 "${output}"`);
    return output;
  }

  async generateThumbnail(input: string, timestamp: number, output: string): Promise<string> {
    this.ensureDir(output);
    await execAsync(`ffmpeg -y -i "${input}" -ss ${timestamp} -vframes 1 -q:v 2 "${output}"`);
    return output;
  }

  async getMetadata(input: string): Promise<Record<string, unknown>> {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${input}"`
    );
    return JSON.parse(stdout);
  }

  private ensureDir(path: string): void {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

// ─── Sharp Service ────────────────────────────────────────────

class SharpServiceImpl implements SharpService {
  private async getSharp() {
    return (await import('sharp')).default;
  }

  async resize(input: string, width: number, height: number, output: string): Promise<string> {
    const sharp = await this.getSharp();
    this.ensureDir(output);
    await sharp(input).resize(width, height, { fit: 'cover' }).toFile(output);
    return output;
  }

  async crop(input: string, options: Record<string, unknown>, output: string): Promise<string> {
    const sharp = await this.getSharp();
    this.ensureDir(output);
    await sharp(input)
      .extract({
        left: (options.left as number) ?? 0,
        top: (options.top as number) ?? 0,
        width: (options.width as number) ?? 100,
        height: (options.height as number) ?? 100,
      })
      .toFile(output);
    return output;
  }

  async addWatermark(input: string, watermark: string, output: string): Promise<string> {
    const sharp = await this.getSharp();
    this.ensureDir(output);
    const base = sharp(input);
    const meta = await base.metadata();

    const wm = await sharp(watermark)
      .resize(Math.round((meta.width ?? 200) * 0.15))
      .toBuffer();

    await base
      .composite([{ input: wm, gravity: 'southeast', blend: 'over' }])
      .toFile(output);
    return output;
  }

  async toFormat(input: string, format: string, output: string): Promise<string> {
    const sharp = await this.getSharp();
    this.ensureDir(output);
    await sharp(input).toFormat(format as any).toFile(output);
    return output;
  }

  async createSocialCard(options: SocialCardOptions): Promise<string> {
    const sharp = await this.getSharp();
    this.ensureDir(options.output);

    const { width, height } = options.size;
    const bgColor = options.brandColors[0] ?? '#1a1a2e';

    // Create SVG-based social card
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${bgColor}"/>
        <text x="50%" y="40%" text-anchor="middle" fill="white"
              font-family="${options.fonts[0] ?? 'Arial'}" font-size="48" font-weight="bold">
          ${escapeXml(options.title.slice(0, 60))}
        </text>
        ${options.subtitle ? `
        <text x="50%" y="55%" text-anchor="middle" fill="#cccccc"
              font-family="${options.fonts[0] ?? 'Arial'}" font-size="24">
          ${escapeXml(options.subtitle.slice(0, 80))}
        </text>` : ''}
      </svg>`;

    await sharp(Buffer.from(svg))
      .resize(width, height)
      .png()
      .toFile(options.output);

    return options.output;
  }

  private ensureDir(path: string): void {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

// ─── Browser Service (Playwright) ─────────────────────────────

class BrowserServiceImpl implements BrowserService {
  private browser: any = null;

  private async getBrowser() {
    if (!this.browser) {
      const pw = await import('playwright');
      this.browser = await pw.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  async screenshot(url: string, output: string, options?: Record<string, unknown>): Promise<string> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      if (options?.width && options?.height) {
        await page.setViewportSize({
          width: options.width as number,
          height: options.height as number,
        });
      }
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      const dir = dirname(output);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      await page.screenshot({ path: output, fullPage: options?.fullPage as boolean ?? false });
      return output;
    } finally {
      await page.close();
    }
  }

  async scrape(url: string, selector?: string): Promise<string> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      if (selector) {
        const element = await page.$(selector);
        return element ? await element.textContent() : '';
      }

      return await page.evaluate(() => document.body.innerText);
    } finally {
      await page.close();
    }
  }

  async pdf(url: string, output: string): Promise<string> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const dir = dirname(output);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      await page.pdf({ path: output, format: 'A4' });
      return output;
    } finally {
      await page.close();
    }
  }

  async serpScrape(query: string): Promise<SERPResult[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      const encodedQuery = encodeURIComponent(query);
      await page.goto(`https://www.google.com/search?q=${encodedQuery}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      return await page.evaluate(() => {
        const results: Array<{ position: number; title: string; url: string; snippet: string }> = [];
        const items = document.querySelectorAll('.g');
        items.forEach((item, i) => {
          const titleEl = item.querySelector('h3');
          const linkEl = item.querySelector('a');
          const snippetEl = item.querySelector('.VwiC3b');
          if (titleEl && linkEl) {
            results.push({
              position: i + 1,
              title: titleEl.textContent ?? '',
              url: linkEl.getAttribute('href') ?? '',
              snippet: snippetEl?.textContent ?? '',
            });
          }
        });
        return results.slice(0, 10);
      });
    } catch {
      return [];
    } finally {
      await page.close();
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────

export function createToolServices(openaiApiKey?: string, openaiBaseUrl?: string): ToolServices {
  return {
    ffmpeg: new FFmpegServiceImpl(),
    sharp: new SharpServiceImpl(),
    browser: new BrowserServiceImpl(),
    whisper: new WhisperServiceImpl(openaiApiKey ?? '', openaiBaseUrl),
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c] ?? c));
}
