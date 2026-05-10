/**
 * If-condition evaluation and node-field operator constants (roku-dev-studio-api via preload).
 */

// Preload exposes a structured object; keep loose until IPC surface is typed.
function getApi(): any {
  const a = typeof window !== 'undefined' && window.actionScriptIf;
  if (!a) {
    throw new Error('actionScriptIf missing: preload must expose action-script-if-eval.js');
  }
  return a;
}

const _bridge = getApi();
if (!Array.isArray(_bridge.RALE_NODE_FIELD_OPERATORS) || !Array.isArray(_bridge.OPS_NEED_VALUE)) {
  throw new Error(
    'actionScriptIf.RALE_NODE_FIELD_OPERATORS / OPS_NEED_VALUE missing: preload must expose action-script-node-field-constants.js'
  );
}

/** @type {readonly string[]} */
export const RALE_NODE_FIELD_OPERATORS = _bridge.RALE_NODE_FIELD_OPERATORS;
export const OPS_NEED_VALUE = new Set(_bridge.OPS_NEED_VALUE);

/**
 * @param {object} condition
 * @param {Record<string, unknown>} variables
 * @param {object} api - { query }
 * @param {((command: string, args?: unknown) => Promise<{ success?: boolean; data?: unknown; error?: string }>) | null | undefined} raleCommand - connector-bound callable (auto-reconnects). Pass null when no App Connector is available.
 */
export function evaluateIfConditionOnce(condition, variables, api, raleCommand) {
  return getApi().evaluateIfConditionOnce(condition, variables, api, raleCommand ?? null);
}

/**
 * @param {object} cond
 * @param {string[]} mediaPlayerStateValues
 */
export function validateIfConditionShape(cond, mediaPlayerStateValues) {
  return getApi().validateIfConditionShape(cond, mediaPlayerStateValues);
}
