/**
 * One-shot evaluation for Action Script `if` conditions (media-player, active-app, RALE Node Field, variables).
 */

'use strict';

const { errorMessage } = require('./err-util');
const {
  parseMediaPlayerXml,
  evaluateWaitCheck,
  resolveMediaPlayerWaitExpectedState
} = require('./action-script-wait-core');
const {
  resolveVariableDotPath,
  valueToWaitStringForCompare,
  parseVariableDotPath
} = require('./action-script-variables');

function trunc(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + '…';
}
const {
  valueToWaitString,
  evaluateNodeFieldWaitPredicate,
  getFieldStringFromGetNodeByIdData
} = require('./rale-node-field-compare');

const {
  RALE_NODE_FIELD_OPERATORS,
  OPS_NEED_VALUE
} = require('./action-script-node-field-constants');

/** Active-app XML fields exposed for `if` (matches ECP `/query/active-app` &lt;app&gt;). */
const ACTIVE_APP_ATTRIBUTES = ['id', 'type', 'version', 'name'];

/**
 * @param {string} xmlText
 * @returns {{ found: boolean, id: string, type: string, version: string, name: string }}
 */
function parseActiveAppXml(xmlText: unknown): {
  found: boolean;
  id: string;
  type: string;
  version: string;
  name: string;
} {
  const str = xmlText == null ? '' : typeof xmlText === 'string' ? xmlText : String(xmlText);
  const empty = { found: false, id: '', type: '', version: '', name: '' };
  if (!str.trim()) return empty;
  const open = str.match(/<app\b([^>]*)>/i);
  if (!open) return empty;
  const attrPart = open[1];
  function grab(name: string): string {
    const re = new RegExp(`\\b${name.replace(/-/g, '\\-')}\\s*=\\s*["']([^"']*)["']`, 'i');
    const m = attrPart.match(re);
    return m ? m[1].trim() : '';
  }
  const inner = str.match(/<app\b[^>]*>([^<]*)<\/app>/is);
  const name = inner ? inner[1].trim() : '';
  return {
    found: true,
    id: grab('id'),
    type: grab('type'),
    version: grab('version'),
    name
  };
}

/**
 * @param {{ found: boolean, id: string, type: string, version: string, name: string }} parsed
 * @param {string} attribute
 */
function getActiveAppAttributeValue(
  parsed: { found: boolean; id: string; type: string; version: string; name: string },
  attribute: string
): string {
  const a = attribute != null ? String(attribute).trim() : '';
  if (a === 'id' || a === 'type' || a === 'version' || a === 'name') {
    const v = parsed[a];
    return v != null ? String(v) : '';
  }
  return '';
}

/**
 * @param {unknown} pathVal
 * @returns {{ ok: true, path: unknown[] } | { ok: false, error: string }}
 */
function normalizePathArg(pathVal: unknown): { ok: true; path: unknown[] } | { ok: false; error: string } {
  if (Array.isArray(pathVal)) {
    return { ok: true, path: pathVal };
  }
  if (pathVal == null || pathVal === '') {
    return { ok: true, path: [] };
  }
  try {
    const parsed = JSON.parse(String(pathVal));
    if (!Array.isArray(parsed)) {
      return { ok: false, error: 'Path must be a JSON array (e.g. [] or [{"child":0}])' };
    }
    return { ok: true, path: parsed };
  } catch (e: unknown) {
    return { ok: false, error: 'Invalid path JSON: ' + errorMessage(e) };
  }
}

/**
 * @param {unknown} actual
 * @param {unknown} expectedRaw
 * @param {string} operator
 * @param {boolean} caseInsensitive
 * @returns {boolean}
 */
function evaluateVariablesPredicate(
  actual: unknown,
  expectedRaw: unknown,
  operator: string,
  caseInsensitive: boolean
): boolean {
  const actualStr = valueToWaitStringForCompare(actual);
  const expectedStr = valueToWaitStringForCompare(expectedRaw);
  return evaluateNodeFieldWaitPredicate(actualStr, expectedStr, operator, caseInsensitive);
}

/**
 * Evaluate an `if` step condition once.
 *
 * The `raleCommand` argument is a connector-aware callable:
 *   `(command, args) => Promise<{ success, data?, error? }>`
 *
 * - In the renderer it is bound to the panel's shared AppConnector, so
 *   verify-and-reconnect on a stale "Not connected" response is handled
 *   upstream.
 * - In the Node script-runner (`script-runner.ts`) it is a wrapper around
 *   the direct-ECP `rale-direct.raleCommand`.
 *
 * Pass `null`/`undefined` when no RALE connection is available — RALE-source
 * `if` conditions will fail with "App Connector not available".
 *
 * @param {object} condition
 * @param {Record<string, unknown>} variables
 * @param {object} api - { query } (other RALE calls go through `raleCommand`)
 * @param {((command: string, args?: unknown) => Promise<{ success?: boolean; data?: unknown; error?: string }>) | null | undefined} raleCommand
 * @returns {Promise<{ ok: true, branchThen: boolean, runtimeSummary?: string } | { ok: false, error: string }>}
 */
type IfEvalRaleCommand = (
  command: string,
  args?: unknown
) => Promise<{ success?: boolean; data?: unknown; error?: string }>;

async function evaluateIfConditionOnce(
  condition: unknown,
  variables: Record<string, unknown>,
  api: {
    query: (path: string) => Promise<Record<string, unknown>>;
  },
  raleCommand?: IfEvalRaleCommand | null
): Promise<
  { ok: true; branchThen: boolean; runtimeSummary?: string } | { ok: false; error: string }
> {
  if (!condition || typeof condition !== 'object') {
    return { ok: false, error: 'if step requires condition object' };
  }
  const cond = condition as Record<string, unknown>;
  const source = cond.source;

  if (source === 'media-player') {
    const expectedState = resolveMediaPlayerWaitExpectedState(cond);
    const check =
      expectedState !== ''
        ? `state == "${expectedState.replace(/"/g, '\\"')}"`
        : cond.check && typeof cond.check === 'string'
          ? cond.check
          : "state == 'stop'";
    const res = await api.query('/query/media-player');
    if (!res || !res.success || res.data == null) {
      return { ok: false, error: res && res.error ? String(res.error) : 'media-player query failed' };
    }
    const xmlRaw = typeof res.data === 'string' ? res.data : String(res.data);
    const data = parseMediaPlayerXml(xmlRaw);
    const actualDisplay =
      data.state != null && String(data.state) !== '' ? String(data.state) : '(none)';
    const want =
      expectedState !== '' ? `state "${expectedState}"` : `check ${check}`;
    let branchThen;
    if (expectedState !== '' && data.state != null && String(data.state).toLowerCase() === expectedState) {
      branchThen = true;
    } else {
      branchThen = !!evaluateWaitCheck(check, data);
    }
    const runtimeSummary = `If · media-player · want ${want} · actual ${actualDisplay} · took ${branchThen ? 'then' : 'else'}`;
    return { ok: true, branchThen, runtimeSummary };
  }

  if (source === 'active-app') {
    const attribute = cond.attribute != null ? String(cond.attribute).trim() : '';
    const operator = String(cond.operator || '');
    const valueRaw = cond.value;
    const valueStr = valueRaw != null ? valueToWaitString(valueRaw) : '';
    const caseInsensitive = !!cond.caseInsensitive;

    if (!attribute || !ACTIVE_APP_ATTRIBUTES.includes(attribute)) {
      return { ok: false, error: 'Invalid active-app condition (attribute)' };
    }
    if (!RALE_NODE_FIELD_OPERATORS.includes(operator)) {
      return { ok: false, error: 'Invalid active-app condition (operator)' };
    }
    if (OPS_NEED_VALUE.has(operator) && (valueRaw === undefined || valueRaw === null)) {
      return { ok: false, error: `condition.value is required for operator "${operator}"` };
    }

    const res = await api.query('/query/active-app');
    if (!res || !res.success || res.data == null) {
      return { ok: false, error: res && res.error ? String(res.error) : 'active-app query failed' };
    }
    const xmlRaw = typeof res.data === 'string' ? res.data : String(res.data);
    const parsed = parseActiveAppXml(xmlRaw);
    const actualStr = getActiveAppAttributeValue(parsed, attribute);
    if (!parsed.found) {
      const runtimeSummary = `If · active-app · no <app> in response · took else`;
      return { ok: true, branchThen: false, runtimeSummary };
    }
    const pass = evaluateNodeFieldWaitPredicate(actualStr, valueStr, operator, caseInsensitive);
    const actualDisp = trunc(actualStr, 72);
    const valDisp = valueStr ? trunc(valueStr, 40) : '';
    const opTail = OPS_NEED_VALUE.has(operator) && valDisp ? ` "${valDisp}"` : '';
    const runtimeSummary = `If · active-app · ${attribute} · actual "${actualDisp}" · ${operator}${opTail} · took ${pass ? 'then' : 'else'}`;
    return { ok: true, branchThen: !!pass, runtimeSummary };
  }

  if (source === 'rale-node-field') {
    const pathNorm = normalizePathArg(cond.path);
    if (!pathNorm.ok) {
      return { ok: false, error: pathNorm.error || 'Invalid path' };
    }
    const id = String(cond.id != null ? cond.id : '').trim();
    const field = String(cond.field != null ? cond.field : '').trim();
    const operator = String(cond.operator || '');
    const valueRaw = cond.value;
    const valueStr = valueRaw != null ? valueToWaitString(valueRaw) : '';
    const caseInsensitive = !!cond.caseInsensitive;

    if (!id || !field || !RALE_NODE_FIELD_OPERATORS.includes(operator)) {
      return { ok: false, error: 'Invalid rale-node-field condition' };
    }

    if (typeof raleCommand !== 'function') {
      return { ok: false, error: 'App Connector not available for if (RALE Node)' };
    }

    // `raleCommand` is already reconnect-aware (connector.command in the
    // renderer, or a direct-ECP wrapper on the server), so a single call is
    // enough here.
    const res = await raleCommand('getNodeById', { path: pathNorm.path, id });
    if (!res || !res.success || res.data == null) {
      return { ok: false, error: res && res.error ? String(res.error) : 'getNodeById failed' };
    }
    const got = getFieldStringFromGetNodeByIdData(res.data, field);
    if (!got.ready) {
      const runtimeSummary = `If · RALE · ${id}.${field} · actual unavailable (${got.reason}) · took else`;
      return { ok: true, branchThen: false, runtimeSummary };
    }
    const pass = evaluateNodeFieldWaitPredicate(got.actualStr, valueStr, operator, caseInsensitive);
    const actualDisp = trunc(got.actualStr, 72);
    const valDisp = valueStr ? trunc(valueStr, 40) : '';
    const opTail = OPS_NEED_VALUE.has(operator) && valDisp ? ` "${valDisp}"` : '';
    const runtimeSummary = `If · RALE · ${id}.${field} · actual "${actualDisp}" · ${operator}${opTail} · took ${pass ? 'then' : 'else'}`;
    return { ok: true, branchThen: !!pass, runtimeSummary };
  }

  if (source === 'variables') {
    const pathStr = cond.variablePath != null ? String(cond.variablePath).trim() : '';
    const operator = String(cond.operator || '');
    if (!pathStr || !RALE_NODE_FIELD_OPERATORS.includes(operator)) {
      return { ok: false, error: 'Invalid variables condition' };
    }
    if (OPS_NEED_VALUE.has(operator) && (cond.value === undefined || cond.value === null)) {
      return { ok: false, error: `condition.value is required for operator "${operator}"` };
    }
    const actual = resolveVariableDotPath(variables, pathStr);
    const pass = evaluateVariablesPredicate(actual, cond.value, operator, !!cond.caseInsensitive);
    const actualDisp = trunc(valueToWaitStringForCompare(actual), 48);
    const expDisp =
      OPS_NEED_VALUE.has(operator) ? trunc(valueToWaitStringForCompare(cond.value), 40) : '';
    const opTail = expDisp ? ` ${expDisp}` : '';
    const ci = cond.caseInsensitive ? ' (i)' : '';
    const runtimeSummary = `If · $${pathStr} · actual ${actualDisp}${ci} · ${operator}${opTail} · took ${pass ? 'then' : 'else'}`;
    return { ok: true, branchThen: !!pass, runtimeSummary };
  }

  return { ok: false, error: `Unknown if condition source: ${source}` };
}

/**
 * @param {Record<string, unknown>} cond
 * @param {string} [valueKey]
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function validateRaleStyleOperatorAndValue(cond: Record<string, unknown>, valueKey = 'value') {
  const op = cond.operator;
  if (typeof op !== 'string' || !RALE_NODE_FIELD_OPERATORS.includes(op)) {
    return { ok: false, error: `condition.operator must be one of: ${RALE_NODE_FIELD_OPERATORS.join(', ')}` };
  }
  if (OPS_NEED_VALUE.has(op)) {
    const v = cond[valueKey];
    if (v === undefined || v === null) {
      return { ok: false, error: `condition.${valueKey} is required for operator "${op}"` };
    }
  }
  return { ok: true };
}

/**
 * Structural validation for `if` condition (shared with renderer validator messaging).
 * @param {object} cond
 * @param {string[]} mediaPlayerStateValues
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function validateIfConditionShape(cond: Record<string, unknown>, mediaPlayerStateValues: string[]) {
  if (!cond || typeof cond !== 'object') {
    return { ok: false, error: 'condition object required' };
  }
  const source = cond.source;
  if (source === 'media-player') {
    const hasCheck = cond.check && typeof cond.check === 'string';
    const resolved = resolveMediaPlayerWaitExpectedState(cond);
    const hasState = resolved && mediaPlayerStateValues.includes(resolved);
    if (!hasState && !hasCheck) {
      return {
        ok: false,
        error: `condition.state must be one of: ${mediaPlayerStateValues.join(', ')} (or use condition.check, or field "state" with operator "equals" and a valid value)`
      };
    }
    return { ok: true };
  }
  if (source === 'active-app') {
    const attr = cond.attribute != null ? String(cond.attribute).trim() : '';
    if (!attr || !ACTIVE_APP_ATTRIBUTES.includes(attr)) {
      return {
        ok: false,
        error: `condition.attribute must be one of: ${ACTIVE_APP_ATTRIBUTES.join(', ')}`
      };
    }
    return validateRaleStyleOperatorAndValue(cond);
  }
  if (source === 'rale-node-field') {
    const pathNorm = normalizePathArg(cond.path);
    if (!pathNorm.ok) {
      return { ok: false, error: pathNorm.error || 'Invalid path' };
    }
    const id = cond.id;
    if (id == null || String(id).trim() === '') {
      return { ok: false, error: 'condition.id is required' };
    }
    const field = cond.field;
    if (field == null || String(field).trim() === '') {
      return { ok: false, error: 'condition.field is required' };
    }
    return validateRaleStyleOperatorAndValue(cond);
  }
  if (source === 'variables') {
    const pathStr = cond.variablePath != null ? String(cond.variablePath).trim() : '';
    if (!pathStr) {
      return { ok: false, error: 'condition.variablePath is required' };
    }
    if (!parseVariableDotPath(pathStr)) {
      return { ok: false, error: 'condition.variablePath must be root or root.segments (e.g. data.items.0.id)' };
    }
    return validateRaleStyleOperatorAndValue(cond);
  }
  return {
    ok: false,
    error: 'condition.source must be media-player, active-app, rale-node-field, or variables'
  };
}

module.exports = {
  evaluateIfConditionOnce,
  validateIfConditionShape,
  normalizePathArg,
  RALE_NODE_FIELD_OPERATORS,
  OPS_NEED_VALUE,
  ACTIVE_APP_ATTRIBUTES,
  parseActiveAppXml,
  getActiveAppAttributeValue
};
