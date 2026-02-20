/**
 * Command Allowlist & Security Layer
 * Enforces command filtering, network allowlisting, and approval gates.
 */

import { readFileSync, existsSync } from 'fs';
import yaml from 'js-yaml';

interface AllowlistConfig {
  allowed_commands: string[];
  blocked_patterns: string[];
  network_allowlist: string[];
}

interface ApprovalRule {
  action: string;
  requiresApproval: boolean;
  channel: string;
}

const APPROVAL_RULES: ApprovalRule[] = [
  { action: 'content_generation', requiresApproval: false, channel: 'auto' },
  { action: 'social_publish', requiresApproval: true, channel: 'telegram' },
  { action: 'email_send', requiresApproval: true, channel: 'telegram' },
  { action: 'brand_profile_modify', requiresApproval: true, channel: 'telegram' },
  { action: 'integration_setup', requiresApproval: true, channel: 'telegram' },
  { action: 'file_deletion', requiresApproval: true, channel: 'telegram' },
  { action: 'cost_over_50', requiresApproval: true, channel: 'telegram' },
];

let config: AllowlistConfig = {
  allowed_commands: ['ffmpeg', 'node', 'python3', 'npm', 'git', 'curl', 'playwright'],
  blocked_patterns: ['>', '|', 'sudo', 'rm -rf', 'eval(', 'exec('],
  network_allowlist: [
    'api.anthropic.com', 'api.openai.com', 'api.stability.ai',
    'googleapis.com', 'api.twitter.com', 'graph.facebook.com',
  ],
};

export function loadAllowlist(configPath: string): void {
  if (!existsSync(configPath)) return;
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = yaml.load(raw) as AllowlistConfig;
    if (parsed) config = { ...config, ...parsed };
  } catch { /* use defaults */ }
}

export function isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
  const cmd = command.trim().split(/\s+/)[0];
  
  if (!config.allowed_commands.includes(cmd)) {
    return { allowed: false, reason: `Command not in allowlist: ${cmd}` };
  }
  
  for (const pattern of config.blocked_patterns) {
    if (command.includes(pattern)) {
      return { allowed: false, reason: `Blocked pattern detected: ${pattern}` };
    }
  }
  
  return { allowed: true };
}

export function isNetworkAllowed(hostname: string): boolean {
  return config.network_allowlist.some(allowed => 
    hostname === allowed || hostname.endsWith(`.${allowed}`)
  );
}

export function requiresApproval(action: string): ApprovalRule | null {
  return APPROVAL_RULES.find(r => r.action === action && r.requiresApproval) ?? null;
}

export function getApprovalRules(): ApprovalRule[] {
  return APPROVAL_RULES;
}
