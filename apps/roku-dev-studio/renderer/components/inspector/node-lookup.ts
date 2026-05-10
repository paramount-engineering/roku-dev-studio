// Shared helpers for RALE path parsing and response formatting (used by Execute Function → RALE builtins)

import type { DisplayResponseFn } from './inspector-types.js';

const RALE_OBJECT_PLACEHOLDER = '{object}';

function normalizeFieldType(item: Record<string, unknown>): string {
  const ft = item.fieldType ?? item.fieldtype;
  return ft != null ? String(ft).toLowerCase() : '';
}

function normalizeBsType(item: Record<string, unknown>): string {
  return item.type != null ? String(item.type) : '';
}

function looksLikeIntegerString(s: string): boolean {
  return /^-?\d+$/.test(String(s).trim());
}

function looksLikeFloatString(s: string): boolean {
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
 * Turn one TrackerTask fieldlist entry `{ item: { fieldtype, type, value, ... } }` into a JSON-friendly
 * scalar, `"{object}"`, `null` for invalid nodes, or the original entry if coercion is unsafe.
 */
export function flattenFieldListValue(fieldEntry: unknown): unknown {
  if (fieldEntry === null || fieldEntry === undefined) {
    return fieldEntry;
  }
  const fe = fieldEntry as Record<string, unknown>;
  if (typeof fieldEntry !== 'object' || Array.isArray(fieldEntry) || fe.item === undefined) {
    return fieldEntry;
  }
  const item = fe.item;
  if (!item || typeof item !== 'object') {
    return fieldEntry;
  }

  const itemRec = item as Record<string, unknown>;
  const valueStr = itemRec.value != null ? String(itemRec.value) : '';
  const fieldType = normalizeFieldType(itemRec);
  const bsType = normalizeBsType(itemRec);

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
 * Flatten TrackerTask `fieldlist` in place conceptually: same keys, values become scalars / placeholders / originals.
 */
export function flattenRaleFieldList(
  fieldlist: Record<string, unknown> | undefined | null
): Record<string, unknown> | undefined | null {
  if (!fieldlist || typeof fieldlist !== 'object' || Array.isArray(fieldlist)) {
    return fieldlist;
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(fieldlist)) {
    out[key] = flattenFieldListValue(fieldlist[key]);
  }
  return out;
}

function normalizeRaleTypeForSetField(ft: string): string {
  const t = (ft || '').toLowerCase().trim();
  if (t === 'bool') return 'boolean';
  return t;
}

/**
 * Per-field RALE type from raw TrackerTask `fieldlist` (before flattening values).
 */
export function extractRaleFieldMetadata(
  fieldlist: Record<string, unknown> | undefined | null
): Record<string, { fieldType: string }> {
  if (!fieldlist || typeof fieldlist !== 'object' || Array.isArray(fieldlist)) {
    return {};
  }
  const out: Record<string, { fieldType: string }> = {};
  for (const key of Object.keys(fieldlist)) {
    const entry = fieldlist[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      out[key] = { fieldType: 'string' };
      continue;
    }
    const raw = entry as Record<string, unknown>;
    const item = raw.item;
    if (!item || typeof item !== 'object') {
      out[key] = { fieldType: 'string' };
      continue;
    }
    const itemObj = item as Record<string, unknown>;
    let ft = normalizeFieldType(itemObj);
    if (!ft) {
      const bs = normalizeBsType(itemObj);
      const bsMap: Record<string, string> = {
        roBoolean: 'boolean',
        roInt: 'integer',
        roFloat: 'float',
        roString: 'string',
        roArray: 'array',
        roAssociativeArray: 'assocarray'
      };
      ft = bsMap[String(bs)] || '';
    }
    if (!ft) ft = 'string';
    out[key] = { fieldType: normalizeRaleTypeForSetField(ft) };
  }
  return out;
}

function flattenFieldListInObject(o: unknown): unknown {
  if (!o || typeof o !== 'object' || Array.isArray(o)) {
    return o;
  }
  const rec = o as Record<string, unknown>;
  const rawList = rec.fieldlist ?? rec.fieldList;
  if (!rawList || typeof rawList !== 'object' || Array.isArray(rawList)) {
    return o;
  }
  const fieldlistMeta = extractRaleFieldMetadata(rawList as Record<string, unknown>);
  const rest: Record<string, unknown> = { ...rec };
  delete rest.fieldlist;
  delete rest.fieldList;
  delete rest.fieldlistMeta;
  delete rest.fieldListMeta;
  return {
    ...rest,
    fieldlist: flattenRaleFieldList(rawList as Record<string, unknown>),
    fieldlistMeta
  };
}

/**
 * RALE `result.data` shaping for display: supports `fieldList` (camelCase) and nested `response` (getNodeById).
 */
export function withFlattenedFieldList(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }
  const o = data as Record<string, unknown>;
  const cmd = o.command != null ? String(o.command) : '';
  if (
    cmd === 'getNodeById' &&
    o.response != null &&
    typeof o.response === 'object' &&
    !Array.isArray(o.response)
  ) {
    return {
      ...o,
      response: flattenFieldListInObject(/** @type {Record<string, unknown>} */ (o.response))
    };
  }
  return flattenFieldListInObject(o);
}

/**
 * Parse RALE path: JSON array of segments (e.g. [] or [{"child":0}]).
 */
export function parseRalePath(raw: string): { ok: true; path: unknown[] } | { ok: false; error: string } {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return { ok: true, path: [] };
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      return { ok: false, error: 'Path must be a JSON array (e.g. [] or [{"child":0}])' };
    }
    return { ok: true, path: parsed };
  } catch (e: unknown) {
    return {
      ok: false,
      error: 'Invalid path JSON: ' + (e instanceof Error ? e.message : String(e))
    };
  }
}

/**
 * Normalize path value from parameter inputs (array from roArray, or stringify + parse).
 */
export function normalizePathArg(
  pathVal: unknown
): { ok: true; path: unknown[] } | { ok: false; error: string } {
  if (Array.isArray(pathVal)) {
    return { ok: true, path: pathVal };
  }
  if (pathVal == null) {
    return { ok: true, path: [] };
  }
  return parseRalePath(String(pathVal));
}

export function formatRaleCommandResponse(
  result: unknown,
  command: string,
  displayResponseFn: DisplayResponseFn
): void {
  if (!result || typeof result !== 'object') {
    return;
  }
  const r = result as Record<string, unknown>;
  if (r.success && r.data !== undefined) {
    const data = r.data;
    if (
      data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      (data as Record<string, unknown>).error &&
      ((data as Record<string, { message?: string }>).error?.message != null)
    ) {
      const err = (data as Record<string, { message?: string }>).error;
      displayResponseFn({ command: command, error: err?.message, data }, true);
      return;
    }
    displayResponseFn({ command: command, response: withFlattenedFieldList(data) });
    return;
  }
  displayResponseFn(
    { command: command, error: (r.error as string) || 'Command failed', details: result },
    true
  );
}
