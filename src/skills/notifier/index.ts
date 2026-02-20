/**
 * Notifier Skill
 * 
 * Formats a message from template variables and supports
 * channel specification (telegram, slack, email, etc.).
 * Returns the formatted notification message ready for delivery.
 * 
 * Triggers: "notify", "send notification", "alert"
 */

import type { Skill, SkillContext, SkillResult } from '../../core/types.js';

export type NotificationChannel = 'telegram' | 'slack' | 'email' | 'discord' | 'webhook';

interface NotificationOutput {
  message: string;
  channel: NotificationChannel;
  formatted: string;
  metadata: {
    templateUsed: boolean;
    variablesResolved: number;
    channel: NotificationChannel;
  };
}

/**
 * Format a template string by replacing {{variable}} placeholders
 * with values from the provided data object.
 */
function formatTemplate(template: string, data: Record<string, unknown>): { text: string; resolved: number } {
  let resolved = 0;
  const text = template.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    const trimmedKey = key.trim();
    if (trimmedKey in data && data[trimmedKey] !== undefined) {
      resolved++;
      const val = data[trimmedKey];
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    }
    return match; // Leave unresolved placeholders as-is
  });
  return { text, resolved };
}

/**
 * Apply channel-specific formatting to the message.
 */
function formatForChannel(message: string, channel: NotificationChannel): string {
  switch (channel) {
    case 'telegram':
      // Telegram supports HTML and Markdown
      return message;

    case 'slack':
      // Slack uses mrkdwn format — convert **bold** to *bold*, _italic_ stays
      return message
        .replace(/\*\*(.+?)\*\*/g, '*$1*')
        .replace(/^# (.+)$/gm, '*$1*')
        .replace(/^## (.+)$/gm, '*$1*')
        .replace(/^### (.+)$/gm, '_$1_');

    case 'discord':
      // Discord uses standard Markdown
      return message;

    case 'email':
      // Basic plain text for email
      return message
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1');

    case 'webhook':
      // Raw — no formatting changes
      return message;

    default:
      return message;
  }
}

export const notifierSkill: Skill = {
  id: 'notifier',
  name: 'Notifier',
  description: 'Format and prepare notification messages from templates with variable substitution. Supports Telegram, Slack, Discord, email, and webhook channels.',
  version: '1.0.0',
  costUnits: 1,
  inputs: [
    { name: 'template', type: 'string', required: true, description: 'Message template with {{variable}} placeholders' },
    { name: 'channel', type: 'string', required: false, description: 'Target channel: telegram, slack, email, discord, webhook', default: 'telegram' },
    { name: 'data', type: 'object', required: false, description: 'Variables to inject into the template', default: {} },
    { name: 'subject', type: 'string', required: false, description: 'Subject line (for email channel)', default: '' },
  ],
  outputs: [
    { name: 'message', type: 'string', description: 'The raw formatted message' },
    { name: 'formatted', type: 'string', description: 'Channel-formatted message' },
    { name: 'channel', type: 'string', description: 'Target channel' },
    { name: 'metadata', type: 'object', description: 'Formatting metadata' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const template = ctx.inputs.template as string;
    const channel = (ctx.inputs.channel as NotificationChannel) ?? 'telegram';
    const data = (ctx.inputs.data as Record<string, unknown>) ?? {};
    const subject = (ctx.inputs.subject as string) ?? '';

    // Format the template
    const { text: message, resolved } = formatTemplate(template, data);

    // Apply channel-specific formatting
    let formatted = formatForChannel(message, channel);

    // Add subject for email
    if (channel === 'email' && subject) {
      const formattedSubject = formatTemplate(subject, data).text;
      formatted = `Subject: ${formattedSubject}\n\n${formatted}`;
    }

    const output: NotificationOutput = {
      message,
      channel,
      formatted,
      metadata: {
        templateUsed: true,
        variablesResolved: resolved,
        channel,
      },
    };

    return {
      output: output as unknown as Record<string, unknown>,
      tokensUsed: 0,     // No LLM call needed
      costUnits: 1,
      modelUsed: 'none',
      durationMs: Date.now() - start,
    };
  },
};
