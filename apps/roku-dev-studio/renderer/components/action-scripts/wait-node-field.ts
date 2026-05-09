/**
 * Wait until condition: RALE getNodeById field value (Action Scripts — string comparisons).
 */

import { normalizePathArg, flattenFieldListValue } from '../inspector/node-lookup.js';
import { RALE_NODE_FIELD_OPERATORS, OPS_NEED_VALUE } from './action-script-if-client.js';
import { devLog } from '../../modules/utils/dev-log.js';

export { RALE_NODE_FIELD_OPERATORS, OPS_NEED_VALUE };

/** Max characters for the value segment in Builder / Executor step summaries */
const DETAILS_VALUE_MAX = 48;

/**
 * Short label for wait step lists: `field -> operator` or `field -> operator -> value`.
 * Omits the value for `hasAnyValue` / `hasNoValue`. Truncates long values.
 * @param {unknown} cond - step.condition
 * @returns {string}
 */
export function formatRaleNodeFieldWaitDetails(cond) {
  if (!cond || typeof cond !== 'object' || /** @type {{ source?: string }} */ (cond).source !== 'rale-node-field') {
    return '';
  }
  const c = /** @type {Record<string, unknown>} */ (cond);
  const fieldRaw = c.field;
  const field = fieldRaw != null ? String(fieldRaw).trim() : '';
  if (!field) return '';
  const op = typeof c.operator === 'string' && c.operator ? c.operator : '?';

  if (!OPS_NEED_VALUE.has(op)) {
    return `${field} -> ${op}`;
  }

  let v = valueToWaitString(c.value);
  if (v.length > DETAILS_VALUE_MAX) {
    v = v.slice(0, DETAILS_VALUE_MAX - 1) + '…';
  }
  const ci = c.caseInsensitive === true;
  return `${field} -> ${op} -> ${v}${ci ? ' (i)' : ''}`;
}

/**
 * @param {unknown} v
 * @returns {string}
 */
export function valueToWaitString(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Resolve field value for a RALE Node-field wait. Operators run only when `ready` is true
 * (valid node and field key present in fieldlist). No operator matches while node or field is missing.
 *
 * @param {unknown} data - api.raleCommand result.data
 * @param {string} fieldName
 * @returns {{ ready: false, reason: string } | { ready: true, actualStr: string }}
 */
export function getFieldStringFromGetNodeByIdData(data, fieldName) {
  if (!fieldName || typeof fieldName !== 'string') {
    return { ready: false, reason: 'invalid_field_name' };
  }
  if (!data || typeof data !== 'object') {
    devLog('[wait-node-field] getField no_data', { field: fieldName, dataType: typeof data });
    return { ready: false, reason: 'no_data' };
  }
  const d = /** @type {Record<string, unknown>} */ (data);
  if (d.error && typeof d.error === 'object' && d.error !== null && /** @type {{ message?: string }} */ (d.error).message) {
    devLog('[wait-node-field] getField rale_error', { field: fieldName, error: d.error });
    return { ready: false, reason: 'rale_error' };
  }

  // Accept both the App Connector wrapper shape ({ command, response }) and the
  // raw TrackerTask body ({ item, fieldlist, layout, ... }). Older / custom
  // TrackerTask builds may omit a top-level `path`, so we don't require it —
  // the `if` evaluator in the API package (`rale-node-field-compare.ts`) does
  // the same thing and this keeps wait + if in parity.
  let response: Record<string, unknown>;
  if (d.command === 'getNodeById' && d.response && typeof d.response === 'object') {
    response = d.response as Record<string, unknown>;
  } else if (d.fieldlist || d.item) {
    response = d;
  } else {
    devLog('[wait-node-field] getField no_node (no command/response/fieldlist/item)', {
      field: fieldName,
      keys: Object.keys(d)
    });
    return { ready: false, reason: 'no_node' };
  }

  const flRaw = response.fieldlist ?? response.fieldList;
  if (!flRaw || typeof flRaw !== 'object' || Array.isArray(flRaw)) {
    devLog('[wait-node-field] getField no_fieldlist', { field: fieldName, flType: typeof flRaw });
    return { ready: false, reason: 'no_fieldlist' };
  }
  const fieldlist = /** @type {Record<string, unknown>} */ (flRaw);
  if (!Object.prototype.hasOwnProperty.call(fieldlist, fieldName)) {
    devLog('[wait-node-field] getField no_field', {
      field: fieldName,
      availableFields: Object.keys(fieldlist).slice(0, 30)
    });
    return { ready: false, reason: 'no_field' };
  }
  const flat = flattenFieldListValue(fieldlist[fieldName]);
  const actualStr = valueToWaitString(flat);
  devLog('[wait-node-field] getField ready', { field: fieldName, actualStr });
  return { ready: true, actualStr };
}

/**
 * @param {string} actual
 * @param {string} expected
 * @param {string} operator
 * @param {boolean} caseInsensitive
 */
export function evaluateNodeFieldWaitPredicate(actual, expected, operator, caseInsensitive) {
  const a = caseInsensitive ? actual.toLowerCase() : actual;
  const e = caseInsensitive ? expected.toLowerCase() : expected;

  switch (operator) {
    case 'is':
      return a === e;
    case 'isNot':
      return a !== e;
    case 'hasAnyValue':
      return actual.length > 0;
    case 'hasNoValue':
      return actual.length === 0;
    case 'contains':
      return a.includes(e);
    case 'doesNotContain':
      return !a.includes(e);
    case 'beginsWith':
      return a.startsWith(e);
    case 'endsWith':
      return a.endsWith(e);
    default:
      return false;
  }
}

/**
 * @param {Record<string, unknown>} cond
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateRaleNodeFieldCondition(cond) {
  if (!cond || typeof cond !== 'object') return { ok: false, error: 'condition object required' };
  if (cond.source !== 'rale-node-field') return { ok: false, error: 'wrong source' };

  const pathNorm = normalizePathArg(cond.path);
  if (!pathNorm.ok) return { ok: false, error: pathNorm.error || 'Invalid path' };

  const id = cond.id;
  if (id == null || String(id).trim() === '') return { ok: false, error: 'condition.id is required' };

  const field = cond.field;
  if (field == null || String(field).trim() === '') return { ok: false, error: 'condition.field is required' };

  const op = cond.operator;
  if (typeof op !== 'string' || !RALE_NODE_FIELD_OPERATORS.includes(op)) {
    return { ok: false, error: `condition.operator must be one of: ${RALE_NODE_FIELD_OPERATORS.join(', ')}` };
  }

  if (OPS_NEED_VALUE.has(op)) {
    const v = cond.value;
    if (v === undefined || v === null) return { ok: false, error: `condition.value is required for operator "${op}"` };
  }

  return { ok: true };
}
