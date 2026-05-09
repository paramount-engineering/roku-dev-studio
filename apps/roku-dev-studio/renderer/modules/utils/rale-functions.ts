/**
 * App Connector getExternalControlFunctions normalization (roku-dev-studio-api via preload).
 */

function getBridge() {
  const b = typeof globalThis !== 'undefined' ? globalThis.rokuNormalize : undefined;
  if (!b || typeof b.normalizeRaleFunctions !== 'function') {
    throw new Error('rokuNormalize bridge is not available (preload)');
  }
  return b;
}

/**
 * Normalize RALE getExternalControlFunctions response to { name, params }[].
 */
export function normalizeRaleFunctions(raw: unknown): unknown {
  return getBridge().normalizeRaleFunctions(raw);
}

export function parseGetExternalControlFunctionsResponse(raleResult: unknown): unknown {
  return getBridge().parseGetExternalControlFunctionsResponse(raleResult);
}
