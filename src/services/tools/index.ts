/**
 * Tool Services — FFmpeg, Sharp, Browser wrappers
 */

import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { FFmpegService, SharpService, BrowserService, ToolServices } from '../../core/types.js';

const execAsync = promisify(exec);

// ─── FFmpeg Service ───────────────────────────────────────────

class FFmpegServiceImpl implements FFmpegService {
  private ffmpegPath: string;

  constructor() {
    // Try system ffmpeg first, fall back to ffmpeg-static
    try {
      execSync('ffmpeg -version', { stdio: 'ignore' });
      this.ffmpegPath = 'ffmpeg';
    } catch {
      this.ffmpegPath = 'ffmpeg'; // Will error at runtime if missing
    }
  }

  async extractClip(input: string, start: number, duration: number, output: string): Promise<string> {
    this.ensureDir(output);
    await execAsync(
      `${this.ffmpegPath} -y -i "${input}" -ss ${start} -t ${duration} -c copy "${output}"`
    );
    return output;
  }

  async transcode(input: string, options: Record<string, unknown>): Promise<string> {
    const output = options.output as string;
    const codec = options.codec as string ?? 'libx264';
    const resolution = options.resolution as string ?? '';
    
    this.ensureDir(output);
    
    let cmd = `${this.ffmpegPath} -y -i "${input}" -c:v ${codec}`;
    if (resolution) cmd += ` -s ${resolution}`;
    if (options.crf) cmd += ` -crf ${options.crf}`;
    if (options.fps) cmd += ` -r ${options.fps}`;
    cmd += ` "${output}"`;

    await execAsync(cmd);
    return output;
  }

  async extractAudio(input: string, output: string): Promise<string> {
    this.ensureDir(output);
    await execAsync(
      `${this.ffmpegPath} -y -i "${input}" -vn -acodec libmp3lame -q:a 2 "${output}"`
    );
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
  async resize(input: string, width: number, height: number, output: string): Promise<string> {
    const sharp = (await import('sharp')).default;
    this.ensureDir(output);
    await sharp(input)
      .resize(width, height, { fit: 'cover' })
      .toFile(output);
    return output;
  }

  async crop(input: string, options: Record<string, unknown>, output: string): Promise<string> {
    const sharp = (await import('sharp')).default;
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
    const sharp = (await import('sharp')).default;
    this.ensureDir(output);
    const base = sharp(input);
    const meta = await base.metadata();
    
    const wm = await sharp(watermark)
      .resize(Math.round((meta.width ?? 200) * 0.15))
      .toBuffer();

    await base
      .composite([{
        input: wm,
        gravity: 'southeast',
        blend: 'over',
      }])
      .toFile(output);
    return output;
  }

  async toFormat(input: string, format: string, output: string): Promise<string> {
    const sharp = (await import('sharp')).default;
    this.ensureDir(output);
    await sharp(input).toFormat(format as any).toFile(output);
    return output;
  }

  private ensureDir(path: string): void {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

// ─── Browser Service ──────────────────────────────────────────

class BrowserServiceImpl implements BrowserService {
  private browser: any = null;

  private async getBrowser() {
    if (!this.browser) {
      const puppeteer = await import('puppeteer');
      this.browser = await puppeteer.default.launch({
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
        await page.setViewport({
          width: options.width as number,
          height: options.height as number,
        });
      }
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
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
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      if (selector) {
        const element = await page.$(selector);
        return element ? await page.evaluate((el: any) => el.textContent, element) : '';
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
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      const dir = dirname(output);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      
      await page.pdf({ path: output, format: 'A4' });
      return output;
    } finally {
      await page.close();
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────

export function createToolServices(): ToolServices {
  return {
    ffmpeg: new FFmpegServiceImpl(),
    sharp: new SharpServiceImpl(),
    browser: new BrowserServiceImpl(),
  };
}
