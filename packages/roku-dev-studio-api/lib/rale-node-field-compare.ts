/**
 * RALE getNodeById fieldlist value extraction and string predicates (shared by if-eval and parity with wait-node-field).
 */

'use strict';

const RALE_OBJECT_PLACEHOLDER = '{object}';

function normalizeFieldType(item: unknown): string {
  if (!item || typeof item !== 'object') return '';
  const o = item as Record<string, unknown>;
  const ft = o.fieldType ?? o.fieldtype;
  return ft != null ? String(ft).toLowerCase() : '';
}

function normalizeBsType(item: unknown): string {
  if (!item || typeof item !== 'object') return '';
  const o = item as Record<string, unknown>;
  return o.type != null ? String(o.type) : '';
}

function looksLikeIntegerString(s: unknown): boolean {
  return /^-?\d+$/.test(String(s).trim());
}

function looksLikeFloatString(s: unknown): boolean {
  return /^-?\d+(\.\d+)?$/.test(String(s).trim()) || /^-?\d*\.\d+$/.test(String(s).trim());
}

function coerceByFieldType(valueStr: string, fieldType: string): unknown {
  if (!fieldType) return undefined;
  switch (fieldType) {
    case 'boolean':
      if (valueStr === 'true') return true;
      if (valueStr === 'false') return false;
      return undefined;
    case 'integer':
    case 'color':
      if (!looksLikeIntegerString(valueStr)) return undefined;
      return Number.parseInt(valueStr, 10);
    case 'float':
      if (!looksLikeFloatString(valueStr)) return undefined;
      return Number.parseFloat(valueStr);
    case 'string':
      return String(valueStr);
    case 'vector2d':
    case 'rect2d':
    case 'array':
      return undefined;
    default:
      return undefined;
  }
}

function coerceByBrightScriptType(valueStr: string, bsType: string): unknown {
  switch (bsType) {
    case 'roBoolean':
      if (valueStr === 'true') return true;
      if (valueStr === 'false') return false;
      return undefined;
    case 'roInt':
      if (!looksLikeIntegerString(valueStr)) return undefined;
      return Number.parseInt(valueStr, 10);
    case 'roFloat':
      if (!looksLikeFloatString(valueStr)) return undefined;
      return Number.parseFloat(valueStr);
    case 'roString':
      return String(valueStr);
    case 'roInvalid':
      return null;
    default:
      return undefined;
  }
}

/**
 * @param {unknown} fieldEntry
 * @returns {unknown}
 */
function flattenFieldListValue(fieldEntry: unknown): unknown {
  if (fieldEntry === null || fieldEntry === undefined) {
    return fieldEntry;
  }
  if (typeof fieldEntry !== 'object' || Array.isArray(fieldEntry)) {
    return fieldEntry;
  }
  const fe = fieldEntry as Record<string, unknown>;
  if (fe.item === undefined) {
    return fieldEntry;
  }
  const item = fe.item;
  if (!item || typeof item !== 'object') {
    return fieldEntry;
  }

  const it = item as Record<string, unknown>;
  const valueStr = it.value != null ? String(it.value) : '';
  const fieldType = normalizeFieldType(it);
  const bsType = normalizeBsType(it);

  if (valueStr === RALE_OBJECT_PLACEHOLDER) {
    return RALE_OBJECT_PLACEHOLDER;
  }

  if (bsType === 'roInvalid') {
    return null;
  }

  if (fieldType === 'node' || bsType === 'roSGNode') {
    return valueStr === '' ? null : RALE_OBJECT_PLACEHOLDER;
  }

  const byFt = coerceByFieldType(valueStr, fieldType);
  if (byFt !== undefined) {
    return byFt;
  }

  const byBs = coerceByBrightScriptType(valueStr, bsType);
  if (byBs !== undefined) {
    return byBs;
  }

  return fieldEntry;
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function valueToWaitString(v: unknown): string {
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
 * @param {string} actual
 * @param {string} expected
 * @param {string} operator
 * @param {boolean} caseInsensitive
 * @returns {boolean}
 */
function evaluateNodeFieldWaitPredicate(
  actual: string,
  expected: string,
  operator: string,
  caseInsensitive: boolean
): boolean {
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
 * @param {unknown} data - api.raleCommand result.data
 * @param {string} fieldName
 * @returns {{ ready: false, reason: string } | { ready: true, actualStr: string }}
 */
function getFieldStringFromGetNodeByIdData(
  data: unknown,
  fieldName: string
): { ready: false; reason: string } | { ready: true; actualStr: string } {
  if (!fieldName || typeof fieldName !== 'string') {
    return { ready: false, reason: 'invalid_field_name' };
  }
  if (!data || typeof data !== 'object') {
    return { ready: false, reason: 'no_data' };
  }
  const d = data as Record<string, unknown>;
  if (
    d.error &&
    typeof d.error === 'object' &&
    d.error !== null &&
    typeof (d.error as { message?: unknown }).message === 'string'
  ) {
    return { ready: false, reason: 'rale_error' };
  }

  let response: Record<string, unknown> | null = null;
  if (d.command === 'getNodeById' && d.response && typeof d.response === 'object') {
    response = d.response as Record<string, unknown>;
  } else if (d.fieldlist || d.item) {
    response = d;
  } else {
    return { ready: false, reason: 'no_node' };
  }

  const flRaw = response.fieldlist ?? response.fieldList;
  if (!flRaw || typeof flRaw !== 'object' || Array.isArray(flRaw)) {
    return { ready: false, reason: 'no_fieldlist' };
  }
  const fieldlist = flRaw as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(fieldlist, fieldName)) {
    return { ready: false, reason: 'no_field' };
  }
  const flat = flattenFieldListValue(fieldlist[fieldName]);
  return { ready: true, actualStr: valueToWaitString(flat) };
}

module.exports = {
  valueToWaitString,
  evaluateNodeFieldWaitPredicate,
  getFieldStringFromGetNodeByIdData
};
