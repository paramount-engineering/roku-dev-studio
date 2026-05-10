/**
 * Canonical prose + helpers so MCP tool descriptions and tool results teach
 * agents the exact Action Script input shape and how to interpret errors.
 *
 * The actual contract prose lives in `prose/action-script-contract.md`; it is
 * inlined here at build time by esbuild's `.md` text loader (see build.mjs).
 */

import type { ValidationError, ValidationResult } from './validator.js';
import ACTION_SCRIPT_AGENT_CONTRACT_MD from './prose/action-script-contract.md';

/** Shown in get_capability_bundle and referenced from tool descriptions. */
export const ACTION_SCRIPT_AGENT_CONTRACT: string = ACTION_SCRIPT_AGENT_CONTRACT_MD;

/**
 * One block per issue — optimized for LLM + human copy/paste into chat UIs.
 */
export function formatValidationErrorsForAgent(errors: ValidationError[]): string {
  if (!errors.length) return 'No validation issues.';
  return errors
    .map((e, i) => {
      const loc = e.path ? `path=${e.path}` : 'path=(script root)';
      const exp = e.expected !== undefined ? ` | expected=${JSON.stringify(e.expected)}` : '';
      return `${i + 1}. [${e.code}] ${loc} — ${e.message}${exp}`;
    })
    .join('\n');
}

export type ValidationToolPayload = ValidationResult & {
  /** Plain-language list of issues; empty when ok. */
  humanSummary: string;
  /** Short reminder of where to look up allowed values. */
  referenceTools: string[];
};

export function wrapValidationForAgent(result: ValidationResult): ValidationToolPayload {
  // Only real MCP tool names — list_media_player_states and get_authoring_rules
  // don't exist in the registry; agents should use get_capability_bundle instead.
  const referenceTools = [
    'list_action_types',
    'get_action_schema',
    'list_app_connector_functions',
    'get_capability_bundle'
  ];
  return {
    ...result,
    humanSummary: result.ok
      ? 'Validation passed. Script structure matches the catalog; appFunction names still must exist on the device (list_app_connector_functions) before run.'
      : `Validation failed (${result.errors.length} issue(s)):\n${formatValidationErrorsForAgent(result.errors)}`,
    referenceTools
  };
}
