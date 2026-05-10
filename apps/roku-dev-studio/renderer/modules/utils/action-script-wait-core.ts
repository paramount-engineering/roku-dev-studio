/**
 * Action Script wait helpers from roku-dev-studio-api (via preload bridge).
 */

function getCore() {
  const c = typeof globalThis !== 'undefined' ? globalThis.actionScriptWaitCore : undefined;
  if (!c || typeof c.parseMediaPlayerXml !== 'function') {
    throw new Error('actionScriptWaitCore bridge is not available (preload)');
  }
  return c;
}

export function parseMediaPlayerXml(xmlText: string): unknown {
  return getCore().parseMediaPlayerXml(xmlText);
}

export function evaluateWaitCheck(check: unknown, data: unknown): unknown {
  return getCore().evaluateWaitCheck(check, data);
}

export function sleepWithStop(ms: number, shouldStop: unknown, chunkMs?: number): Promise<unknown> {
  return getCore().sleepWithStop(ms, shouldStop, chunkMs);
}

export function isValidMediaPlayerState(state: unknown): boolean {
  return getCore().isValidMediaPlayerState(state);
}

export function resolveMediaPlayerWaitExpectedState(condition: unknown): string {
  return getCore().resolveMediaPlayerWaitExpectedState(condition);
}
