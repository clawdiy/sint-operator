/**
 * Capability-based Permission Enforcement
 * Each skill declares required capabilities; this layer enforces them.
 */

const VALID_CAPABILITIES = new Set([
  'fs.uploads.read', 'fs.uploads.write',
  'fs.outputs.read', 'fs.outputs.write',
  'ffmpeg.exec', 'sharp.exec', 'playwright.exec',
  'whisper.transcribe',
  'ai.claude-opus.invoke', 'ai.claude-sonnet.invoke', 'ai.claude-haiku.invoke',
  'ai.stability.invoke', 'ai.dalle.invoke',
  'network.api', 'network.scrape',
  'brand.read', 'brand.write',
  'memory.read', 'memory.write',
]);

export function validateCapabilities(capabilities: string[]): { valid: boolean; invalid: string[] } {
  const invalid = capabilities.filter(c => !VALID_CAPABILITIES.has(c));
  return { valid: invalid.length === 0, invalid };
}

export function checkPermission(required: string[], granted: string[]): { allowed: boolean; missing: string[] } {
  const grantedSet = new Set(granted);
  const missing = required.filter(r => !grantedSet.has(r));
  return { allowed: missing.length === 0, missing };
}
