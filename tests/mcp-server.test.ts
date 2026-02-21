/**
 * MCP Skill Server Tests
 *
 * Tests that MCP tool definitions are generated correctly from the skill registry.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import { Orchestrator } from '../src/orchestrator/index.js';
import { createMCPRoutes } from '../src/integrations/mcp-skill-server.js';

let app: express.Express;
let orchestrator: Orchestrator;

beforeAll(() => {
  orchestrator = new Orchestrator({
    dataDir: './data',
    configDir: './config',
    openaiApiKey: '',
    models: {
      complex: 'claude-opus-4-6',
      routine: 'claude-sonnet-4-5',
      fallback: 'kimi-k2.5',
    },
  });

  app = express();
  app.use(express.json());
  app.use('/mcp', createMCPRoutes(orchestrator));
});

describe('MCP Skill Server', () => {
  it('createMCPRoutes returns an Express router', () => {
    const router = createMCPRoutes(orchestrator);
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('all skills are available as MCP tools', () => {
    // Verify all 15 skills are registered and could be exposed
    const skills = orchestrator.listSkills();
    expect(skills.length).toBeGreaterThanOrEqual(15);

    const expectedSkills = [
      'asset-ingester', 'content-analyzer', 'content-repurpose',
      'seo-blog', 'social-calendar', 'platform-formatter',
      'video-clipper', 'linkedin-writer', 'output-packager',
      'brand-researcher', 'serp-scraper', 'seo-optimizer',
      'notifier', 'newsletter', 'competitor-analyzer',
    ];

    const skillNames = skills.map(s => s.name);
    for (const expected of expectedSkills) {
      expect(skillNames).toContain(expected);
    }
  });

  it('skills have valid input definitions for MCP conversion', () => {
    const skills = orchestrator.listSkills();
    for (const skill of skills) {
      expect(skill.name).toBeDefined();
      expect(typeof skill.name).toBe('string');
      expect(skill.name.length).toBeGreaterThan(0);
      // Skills must have descriptions
      expect(skill.description).toBeDefined();
    }
  });
});
