/**
 * MCP Skill Server
 * 
 * Exposes SINT skills as MCP-compatible tools.
 * Other agents/tools can call SINT skills via the MCP protocol.
 * 
 * This implements a lightweight MCP server that wraps the skill registry.
 * Runs as an Express sub-router on /mcp/*
 */

import { Router } from 'express';
import { listSkillSummaries, getSkill } from '../core/skills/registry.js';
import type { Orchestrator } from '../orchestrator/index.js';
import type { Logger } from '../core/types.js';

// MCP Tool format
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; default?: unknown }>;
    required: string[];
  };
}

// MCP Tool Call result
interface MCPToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Convert SINT skills into MCP tool definitions.
 */
function skillsToMCPTools(): MCPTool[] {
  const skills = listSkillSummaries();
  return skills.map(s => {
    const skill = getSkill(s.name);
    if (!skill) return null;

    const properties: Record<string, { type: string; description: string; default?: unknown }> = {};
    const required: string[] = [];

    for (const input of skill.inputs) {
      const mcpType = input.type === 'array' ? 'string' : input.type === 'object' ? 'string' : input.type;
      properties[input.name] = {
        type: mcpType,
        description: `${input.description}${input.type === 'array' ? ' (comma-separated)' : input.type === 'object' ? ' (JSON string)' : ''}`,
      };
      if (input.default !== undefined) {
        properties[input.name].default = input.default;
      }
      if (input.required) {
        required.push(input.name);
      }
    }

    // Add brandId as required input
    properties.brandId = { type: 'string', description: 'Brand profile ID to use for generation' };
    required.push('brandId');

    return {
      name: `sint_${skill.id.replace(/-/g, '_')}`,
      description: `[SINT] ${skill.description} (Cost: ~${skill.costUnits} units)`,
      inputSchema: { type: 'object' as const, properties, required },
    };
  }).filter(Boolean) as MCPTool[];
}

/**
 * Create MCP-compatible routes.
 * 
 * GET  /mcp/tools          — List available tools (MCP discovery)
 * POST /mcp/tools/call     — Call a tool (MCP execution)
 * GET  /mcp/health         — Health check
 */
export function createMCPRoutes(orchestrator: Orchestrator): Router {
  const router = Router();

  const logger: Logger = {
    info: (msg, meta) => console.log(`[mcp] ${msg}`, meta ?? ''),
    warn: (msg, meta) => console.warn(`[mcp] ${msg}`, meta ?? ''),
    error: (msg, meta) => console.error(`[mcp] ${msg}`, meta ?? ''),
    debug: (msg, meta) => console.debug(`[mcp] ${msg}`, meta ?? ''),
  };

  // List tools (MCP discovery)
  router.get('/tools', (_req, res) => {
    const tools = skillsToMCPTools();
    res.json({ tools });
  });

  // Call a tool (MCP execution)
  router.post('/tools/call', async (req, res) => {
    try {
      const { name, arguments: args } = req.body;
      if (!name || !args) {
        return res.status(400).json({
          content: [{ type: 'text', text: 'Missing "name" or "arguments" in request body' }],
          isError: true,
        });
      }

      // Extract skill ID from MCP tool name (sint_skill_name → skill-name)
      const skillId = name.replace(/^sint_/, '').replace(/_/g, '-');
      const skill = getSkill(skillId);
      if (!skill) {
        return res.status(404).json({
          content: [{ type: 'text', text: `Unknown tool: ${name}. Use GET /mcp/tools for available tools.` }],
          isError: true,
        });
      }

      const brandId = args.brandId as string;
      if (!brandId) {
        return res.status(400).json({
          content: [{ type: 'text', text: 'brandId is required' }],
          isError: true,
        });
      }

      // Parse array/object inputs
      const inputs: Record<string, unknown> = {};
      for (const input of skill.inputs) {
        let val = args[input.name];
        if (val === undefined) {
          val = input.default;
        } else if (input.type === 'array' && typeof val === 'string') {
          val = val.split(',').map((s: string) => s.trim());
        } else if (input.type === 'object' && typeof val === 'string') {
          try { val = JSON.parse(val); } catch { /* keep as string */ }
        }
        inputs[input.name] = val;
      }

      // Run pipeline with single skill
      logger.info(`MCP tool call: ${name}`, { brandId, inputs });
      const result = await orchestrator.runSkill(skillId, brandId, inputs);

      const response: MCPToolResult = {
        content: [{
          type: 'text',
          text: JSON.stringify(result.output, null, 2),
        }],
      };

      res.json(response);
    } catch (err) {
      logger.error('MCP tool call failed', { error: String(err) });
      res.status(500).json({
        content: [{ type: 'text', text: `Tool execution failed: ${String(err)}` }],
        isError: true,
      });
    }
  });

  // Health
  router.get('/health', (_req, res) => {
    const tools = skillsToMCPTools();
    res.json({ status: 'ok', protocol: 'mcp', tools: tools.length });
  });

  return router;
}
