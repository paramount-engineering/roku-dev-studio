/**
 * Normalize RALE getExternalControlFunctions response.
 * Renderer uses the same logic via preload (`rokuNormalize`); keep behavior in sync with this file only.
 */

'use strict';

const EMPTY_PARAMS: unknown[] = [];

/**
 * Normalized App Connector Function entry.
 *
 * Channels may optionally include a `description` per function in the
 * `GetExternalControlFunctions` payload; we preserve it here so every
 * downstream consumer (Inspector hint, Builder, MCP `list_app_connector_functions`,
 * bridge state push) can show or forward it. `description` is optional and
 * absent when the channel didn't declare one.
 *
 * @param {unknown} raw
 * @returns {Array<{ name: string, params: unknown[], description?: string }>}
 */
function normalizeRaleFunctions(raw: unknown): Array<{
  name: string;
  params: unknown[];
  description?: string;
}> {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((f: unknown) => {
    if (typeof f === 'string') {
      return { name: f, params: EMPTY_PARAMS };
    }
    if (f && typeof f === 'object') {
      const o = f as Record<string, unknown>;
      const name = o.name ?? o.functionName ?? 'unknown';
      const params = Array.isArray(o.params)
        ? o.params
        : Array.isArray(o.parameters)
          ? o.parameters
          : EMPTY_PARAMS;
      const entry: { name: string; params: unknown[]; description?: string } = {
        name: String(name),
        params
      };
      const description = typeof o.description === 'string' ? o.description.trim() : '';
      if (description) entry.description = description;
      return entry;
    }
    return { name: 'unknown', params: EMPTY_PARAMS };
  });
}

/**
 * Interpret raleCommand / one-shot result for getExternalControlFunctions.
 * @param {{ success?: boolean, data?: unknown, error?: string }} raleResult
 * @returns {{ ok: true, functions: Array<{ name: string, params: unknown[], description?: string }>, raw?: unknown } | { ok: false, error: string, raw?: unknown }}
 */
function parseGetExternalControlFunctionsResponse(raleResult: unknown): {
  ok: true;
  functions: Array<{ name: string; params: unknown[]; description?: string }>;
  raw?: unknown;
} | { ok: false; error: string; raw?: unknown } {
  const rr = raleResult as { success?: boolean; data?: unknown; error?: string } | null | undefined;
  if (!rr || rr.success === false) {
    return { ok: false, error: (rr && rr.error) || 'RALE command failed' };
  }
  let d: unknown = rr.data;
  if (d == null) {
    return { ok: false, error: 'Empty response from getExternalControlFunctions' };
  }
  if (typeof d === 'string') {
    try {
      d = JSON.parse(d) as unknown;
    } catch {
      return { ok: false, error: 'Response was not valid JSON', raw: rr.data };
    }
  }
  if (!d || typeof d !== 'object') {
    return { ok: false, error: 'Unexpected response shape', raw: d };
  }
  const obj = d as Record<string, unknown>;
  if (obj.success === false) {
    return {
      ok: false,
      error:
        'Channel returned success:false — implement GetExternalControlFunctions in your scene (see Dev Studio App Connector docs).',
      raw: d
    };
  }
  let funcs: unknown = null;
  if (Array.isArray(obj.functions)) {
    funcs = obj.functions;
  } else if (obj.response && typeof obj.response === 'object' && Array.isArray((obj.response as Record<string, unknown>).functions)) {
    funcs = (obj.response as Record<string, unknown>).functions;
  }
  if (funcs) {
    return { ok: true, functions: normalizeRaleFunctions(funcs), raw: d };
  }
  return { ok: false, error: 'No functions array in response', raw: d };
}

module.exports = { normalizeRaleFunctions, parseGetExternalControlFunctionsResponse };
