/**
 * MCP Prompts — named, reusable prompt templates the user can pick from their
 * host's prompt picker (Cursor, Claude Desktop, VS Code, …). Keeps the
 * authoring workflow first-class without bloating `tools/list`.
 *
 * The prompt body prose lives in `prose/prompts/*.md` and is inlined at build
 * time by esbuild's `.md` text loader (see build.mjs). Each markdown body may
 * contain `{{name}}` placeholders; this file precomputes the variable values
 * (handling conditional sections in TS) before substituting via
 * `renderTemplate`.
 */

import ONE_SHOT_MD from './prose/prompts/one-shot-action.md';
import QUICKSTART_MD from './prose/prompts/action-script-quickstart.md';
import DEBUG_MD from './prose/prompts/debug-device.md';

/**
 * Trivial Mustache-lite renderer. Substitutes `{{name}}` with `vars[name]`;
 * unknown placeholders render as empty string (callers compute conditional
 * sections in TS and pass the final string).
 */
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => (key in vars ? vars[key] : ''));
}

export type PromptDescriptor = {
  name: string;
  title?: string;
  description: string;
  arguments?: Array<{ name: string; description: string; required?: boolean }>;
};

export type PromptMessage = {
  role: 'user' | 'assistant';
  content: { type: 'text'; text: string };
};

const PROMPTS: PromptDescriptor[] = [
  {
    name: 'roku-one-shot-action',
    title: 'Roku: One-shot Direct Action',
    description:
      'Primes the agent to perform a single deterministic action (keypress, launch, ecp_query/post, rale_command, screenshot, …) via a direct op — **not** by authoring an Action Script.',
    arguments: [
      {
        name: 'action',
        description: 'What the agent should do on the device, in one sentence (e.g. "press Home", "launch YouTube", "GET /query/active-app", "take a screenshot").',
        required: true
      },
      {
        name: 'device',
        description: 'Optional target device (IP or serial). Omit to use the focused Dev Studio tab.',
        required: false
      }
    ]
  },
  {
    name: 'roku-action-script-quickstart',
    title: 'Roku: Action Script — Quick Start',
    description:
      'Primes the agent to author an Action Script for multi-step / conditional / saved-or-reviewed flows (bridge probe → capability load → validate → send to Builder). For single actions, prefer `roku-one-shot-action`.',
    arguments: [
      {
        name: 'goal',
        description: 'What the Action Script should accomplish on the device (one or two sentences). Use this prompt only when the task needs ordering, conditions, polling waits, variables, or Builder review.',
        required: false
      }
    ]
  },
  {
    name: 'roku-debug-device',
    title: 'Roku: Debug a Device',
    description:
      'Primes the agent to inspect a Roku using read-only tools (probe_bridge → list_devices → get_selected_device → ecp_query / rale_get_node_by_id).',
    arguments: [
      {
        name: 'device',
        description: 'Optional target device (IP or serial). Omit to use the focused tab.',
        required: false
      }
    ]
  }
];

function renderOneShot(action: string, device: string): string {
  return renderTemplate(ONE_SHOT_MD, {
    actionDisplay: action || '(describe the action here)',
    deviceDisplay: device
      ? `"${device}"`
      : '(focused Dev Studio tab — omit `device` argument)'
  });
}

function renderQuickstart(goal: string): string {
  return renderTemplate(QUICKSTART_MD, {
    goalSection: goal ? `## User goal\n${goal}\n\n` : ''
  });
}

function renderDebug(device: string): string {
  return renderTemplate(DEBUG_MD, {
    targetSection: device ? `## Target device\n${device}\n\n` : '',
    deviceForUse: device ? `"${device}"` : '(focused tab)'
  });
}

export function listPrompts(): PromptDescriptor[] {
  return PROMPTS;
}

export function getPrompt(
  name: string,
  args: Record<string, unknown>
): { description: string; messages: PromptMessage[] } | null {
  const prompt = PROMPTS.find((p) => p.name === name);
  if (!prompt) return null;
  const argText = (key: string): string => {
    const v = args?.[key];
    return typeof v === 'string' ? v.trim() : '';
  };
  if (name === 'roku-one-shot-action') {
    return {
      description: prompt.description,
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: renderOneShot(argText('action'), argText('device')) }
        }
      ]
    };
  }
  if (name === 'roku-action-script-quickstart') {
    return {
      description: prompt.description,
      messages: [
        { role: 'user', content: { type: 'text', text: renderQuickstart(argText('goal')) } }
      ]
    };
  }
  if (name === 'roku-debug-device') {
    return {
      description: prompt.description,
      messages: [
        { role: 'user', content: { type: 'text', text: renderDebug(argText('device')) } }
      ]
    };
  }
  return null;
}
