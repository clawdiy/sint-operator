/**
 * Asset Processor
 * 
 * Ingests uploaded assets, extracts metadata, and prepares them
 * for pipeline consumption. Handles images, video, audio, documents, URLs.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { nanoid } from 'nanoid';
import type { Asset, AssetType, AssetMetadata } from '../types.js';

const assets = new Map<string, Asset>();

const MIME_MAP: Record<string, AssetType> = {
  // Images
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image',
  '.gif': 'image', '.webp': 'image', '.svg': 'image',
  // Video
  '.mp4': 'video', '.mov': 'video', '.avi': 'video',
  '.mkv': 'video', '.webm': 'video',
  // Audio
  '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio',
  '.m4a': 'audio', '.flac': 'audio',
  // Documents
  '.pdf': 'document', '.doc': 'document', '.docx': 'document',
  '.txt': 'document', '.md': 'document', '.rtf': 'document',
  '.csv': 'document', '.xlsx': 'document',
};

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown',
};

// ─── Asset Ingestion ──────────────────────────────────────────

export interface IngestOptions {
  filePath: string;
  assetsDir: string;
  originalName?: string;
}

export async function ingestAsset(opts: IngestOptions): Promise<Asset> {
  const { filePath, assetsDir, originalName } = opts;

  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
  }

  const ext = extname(filePath).toLowerCase();
  const type = MIME_MAP[ext] ?? 'document';
  const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';
  const id = nanoid(12);
  const stat = statSync(filePath);

  // Copy to assets dir with unique name
  const destName = `${id}${ext}`;
  const destPath = join(assetsDir, destName);
  const data = readFileSync(filePath);
  writeFileSync(destPath, data);

  const metadata = await extractMetadata(destPath, type);

  const asset: Asset = {
    id,
    type,
    originalName: originalName ?? basename(filePath),
    path: destPath,
    mimeType,
    size: stat.size,
    metadata,
    createdAt: new Date().toISOString(),
  };

  assets.set(id, asset);
  return asset;
}

export function ingestText(text: string, assetsDir: string): Asset {
  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
  }

  const id = nanoid(12);
  const destPath = join(assetsDir, `${id}.txt`);
  writeFileSync(destPath, text);

  const asset: Asset = {
    id,
    type: 'text',
    originalName: 'input.txt',
    path: destPath,
    mimeType: 'text/plain',
    size: Buffer.byteLength(text),
    metadata: {
      wordCount: text.split(/\s+/).length,
      extractedText: text,
    },
    createdAt: new Date().toISOString(),
  };

  assets.set(id, asset);
  return asset;
}

export function ingestUrl(url: string, assetsDir: string): Asset {
  const id = nanoid(12);

  const asset: Asset = {
    id,
    type: 'url',
    originalName: url,
    path: url,
    mimeType: 'text/uri-list',
    size: 0,
    metadata: {},
    createdAt: new Date().toISOString(),
  };

  assets.set(id, asset);
  return asset;
}

export function getAsset(id: string): Asset | undefined {
  return assets.get(id);
}

export function listAssets(): Asset[] {
  return Array.from(assets.values());
}

// ─── Metadata Extraction ──────────────────────────────────────

async function extractMetadata(path: string, type: AssetType): Promise<AssetMetadata> {
  const metadata: AssetMetadata = {};

  switch (type) {
    case 'document':
    case 'text': {
      try {
        const text = readFileSync(path, 'utf-8');
        metadata.extractedText = text.slice(0, 50_000); // Cap at 50k chars
        metadata.wordCount = text.split(/\s+/).filter(Boolean).length;
      } catch {
        // Binary document — would need parser
      }
      break;
    }

    case 'image': {
      // Sharp metadata extraction happens at skill level
      // Basic info stored here
      break;
    }

    case 'video':
    case 'audio': {
      // FFmpeg metadata extraction happens at skill level
      break;
    }
  }

  return metadata;
}
