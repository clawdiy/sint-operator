/**
 * Skill Registry — Progressive Disclosure System
 * 
 * Three-level loading for context window efficiency:
 * 
 * L1: Discovery — Name + description (~50-100 tokens per skill)
 *     Loaded at startup. Agent aware of all 50+ skills.
 * 
 * L2: Activation — Full SKILL.md body (~2,000-5,000 tokens)
 *     Loaded when task matches skill trigger/description.
 * 
 * L3: Resources — Scripts, templates, reference docs (variable)
 *     Loaded on-demand during execution only.
 * 
 * This means the agent can know about 50+ marketing skills
 * while only consuming ~5K tokens at idle.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import type { Skill, SkillManifest, SkillRegistryEntry, SkillLevel, SkillContext, SkillResult } from '../types.js';

const registry = new Map<string, SkillRegistryEntry>();

// ─── Loading ──────────────────────────────────────────────────

/**
 * L1: Discovery — scan skill directories, load only manifests.
 * Token cost: ~50-100 per skill.
 */
export function discoverSkills(skillsDir: string): void {
  if (!existsSync(skillsDir)) return;

  const entries = readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const manifestPath = join(skillsDir, entry.name, 'SKILL.md');
    if (!existsSync(manifestPath)) continue;

    const manifest = parseSkillManifest(manifestPath);
    if (manifest) {
      registry.set(manifest.name, {
        manifest,
        level: 'L1',
        skillDir: join(skillsDir, entry.name),
        loaded: false,
      });
    }
  }
}

/**
 * L2: Activation — load full SKILL.md when task matches.
 * Token cost: ~2,000-5,000.
 */
export function activateSkill(name: string): SkillRegistryEntry | null {
  const entry = registry.get(name);
  if (!entry) return null;
  if (entry.level !== 'L1') return entry;

  // Load full skill module
  try {
    entry.level = 'L2';
    // Skills are loaded dynamically at this stage
    return entry;
  } catch {
    return null;
  }
}

/**
 * L3: Resources — load scripts, templates, assets on-demand.
 */
export function loadSkillResources(name: string): Record<string, string> {
  const entry = registry.get(name);
  if (!entry) return {};

  const resources: Record<string, string> = {};
  const dirs = ['scripts', 'templates', 'assets'];

  for (const dir of dirs) {
    const dirPath = join(entry.skillDir, dir);
    if (!existsSync(dirPath)) continue;

    const files = readdirSync(dirPath);
    for (const file of files) {
      try {
        resources[`${dir}/${file}`] = readFileSync(join(dirPath, file), 'utf-8');
      } catch {
        // Skip binary files
      }
    }
  }

  entry.level = 'L3';
  return resources;
}

// ─── Registration ─────────────────────────────────────────────

/**
 * Register a compiled skill (for built-in skills).
 */
export function registerSkill(skill: Skill): void {
  const existing = registry.get(skill.id);
  if (existing) {
    existing.skill = skill;
    existing.loaded = true;
    existing.level = 'L2';
  } else {
    registry.set(skill.id, {
      manifest: {
        name: skill.id,
        description: skill.description,
        version: skill.version,
        capabilities: [],
        allowedTools: [],
        memoryScope: 'shared',
        costUnits: skill.costUnits,
      },
      level: 'L2',
      skillDir: '',
      loaded: true,
      skill,
    });
  }
}

export function getSkill(id: string): Skill | undefined {
  const entry = registry.get(id);
  return entry?.skill;
}

// ─── Query ────────────────────────────────────────────────────

/**
 * Get L1 discovery data for all skills (~50-100 tokens each).
 */
export function listSkillSummaries(): Array<{ name: string; description: string; costUnits: number; triggers?: string[] }> {
  return Array.from(registry.values()).map(e => ({
    name: e.manifest.name,
    description: e.manifest.description,
    costUnits: e.manifest.costUnits,
    triggers: e.manifest.triggers,
  }));
}

/**
 * Find skills matching a task description.
 */
export function matchSkills(task: string): SkillRegistryEntry[] {
  const taskLower = task.toLowerCase();
  const matches: Array<{ entry: SkillRegistryEntry; score: number }> = [];

  for (const entry of registry.values()) {
    let score = 0;

    // Check trigger patterns
    if (entry.manifest.triggers) {
      for (const trigger of entry.manifest.triggers) {
        const regex = new RegExp(trigger, 'i');
        if (regex.test(task)) {
          score += 10;
        }
      }
    }

    // Check description match
    const descWords = entry.manifest.description.toLowerCase().split(/\s+/);
    const taskWords = taskLower.split(/\s+/);
    for (const tw of taskWords) {
      if (descWords.includes(tw)) score += 1;
    }

    // Check name match
    if (taskLower.includes(entry.manifest.name.replace(/-/g, ' '))) {
      score += 5;
    }

    if (score > 0) {
      matches.push({ entry, score });
    }
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .map(m => m.entry);
}

export function getRegistrySize(): number {
  return registry.size;
}

export function getTokenEstimate(): number {
  // ~75 tokens per L1 skill discovery
  return registry.size * 75;
}

// ─── Manifest Parsing ─────────────────────────────────────────

function parseSkillManifest(path: string): SkillManifest | null {
  try {
    const content = readFileSync(path, 'utf-8');

    // Parse YAML frontmatter (between --- delimiters)
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;

    const frontmatter = yaml.load(frontmatterMatch[1]) as Record<string, unknown>;

    return {
      name: (frontmatter.name as string) ?? '',
      description: (frontmatter.description as string) ?? '',
      version: (frontmatter.version as string) ?? '0.0.0',
      capabilities: (frontmatter.capabilities as string[]) ?? [],
      allowedTools: (frontmatter['allowed-tools'] as string[]) ?? [],
      memoryScope: (frontmatter['memory-scope'] as 'private' | 'shared' | 'global') ?? 'shared',
      costUnits: (frontmatter['cost-units'] as number) ?? 1,
      triggers: (frontmatter.triggers as string[]) ?? [],
    };
  } catch {
    return null;
  }
}
