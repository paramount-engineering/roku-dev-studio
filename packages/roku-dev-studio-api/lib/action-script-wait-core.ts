/**
 * Shared Action Script wait logic (media-player XML parsing, condition checks, polling sleep).
 * Used by headless script-runner and exposed to the Electron renderer via preload.
 */

'use strict';

const WAIT_CHECK_PATTERN =
  /^\s*(state|position|duration)\s*(===?|!==?|<=?|>=?)\s*('[^']*'|"[^"]*"|-?\d+(?:\.\d+)?)\s*$/;

const MEDIA_STATES = new Set(['play', 'pause', 'buffer', 'close', 'startup', 'stop']);

function parseMediaPlayerXml(xmlText: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (xmlText == null) return result;
  const str = typeof xmlText === 'string' ? xmlText : String(xmlText);
  if (!str.trim()) return result;
  const playerStateMatch = str.match(/<player[^>]*?\s+state\s*=\s*["']([^"']*)["']/i);
  const stateMatch = str.match(/<state>([^<]*)<\/state>/i);
  if (playerStateMatch) result.state = playerStateMatch[1].trim().toLowerCase();
  else if (stateMatch) result.state = stateMatch[1].trim().toLowerCase();
  const posMatch = str.match(/<position>([^<]*)<\/position>/i);
  if (posMatch) {
    const num = parseInt(posMatch[1].trim(), 10);
    if (!isNaN(num)) result.position = num;
  }
  const durMatch = str.match(/<duration>([^<]*)<\/duration>/i);
  if (durMatch) {
    const num = parseInt(durMatch[1].trim(), 10);
    if (!isNaN(num)) result.duration = num;
  }
  return result;
}

function evaluateWaitCheck(check: unknown, data: Record<string, unknown>) {
  if (!check || !data || typeof check !== 'string') return false;
  const m = check.match(WAIT_CHECK_PATTERN);
  if (!m) return false;
  const [, varName, op, literal] = m;
  const state = String(data.state ?? '');
  const position = Number(data.position) || 0;
  const duration = Number(data.duration) || 0;
  let actual;
  if (varName === 'state') actual = state;
  else if (varName === 'position') actual = position;
  else actual = duration;
  let expected;
  const litTrim = literal.trim();
  if (
    (litTrim.startsWith("'") && litTrim.endsWith("'")) ||
    (litTrim.startsWith('"') && litTrim.endsWith('"'))
  ) {
    expected = litTrim.slice(1, -1);
  } else {
    expected = Number(litTrim);
    if (varName === 'state') actual = String(actual);
    else actual = Number(actual);
  }
  switch (op) {
    case '==':
      return String(actual) === String(expected);
    case '===':
      return actual === expected;
    case '!=':
      return String(actual) !== String(expected);
    case '!==':
      return actual !== expected;
    case '<':
      return actual < expected;
    case '<=':
      return actual <= expected;
    case '>':
      return actual > expected;
    case '>=':
      return actual >= expected;
    default:
      return false;
  }
}

async function sleepWithStop(ms, shouldStop, chunkMs = 200) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (typeof shouldStop === 'function' && shouldStop()) return false;
    const remaining = Math.min(chunkMs, deadline - Date.now());
    if (remaining <= 0) return true;
    await new Promise((r) => setTimeout(r, remaining));
  }
  return true;
}

function isValidMediaPlayerState(state) {
  if (state == null) return false;
  return MEDIA_STATES.has(String(state).trim().toLowerCase());
}

/**
 * Media-player wait/if conditions may use `state: "play"` or the RALE-style
 * shape `field: "state", operator: "equals", value: "play"`.
 * @param {Record<string, unknown>} condition
 * @returns {string} lowercased expected state, or '' if none
 */
function resolveMediaPlayerWaitExpectedState(condition: Record<string, unknown>): string {
  if (!condition || typeof condition !== 'object') return '';
  if (condition.state != null) {
    const s = String(condition.state).trim().toLowerCase();
    if (s) return s;
  }
  const source = condition.source != null ? String(condition.source).trim().toLowerCase() : 'media-player';
  if (source !== 'media-player') return '';
  const f = String(condition.field != null ? condition.field : '').trim().toLowerCase();
  const op = String(condition.operator != null ? condition.operator : '').trim().toLowerCase();
  if (f === 'state' && op === 'equals' && condition.value != null) {
    return String(condition.value).trim().toLowerCase();
  }
  return '';
}

module.exports = {
  WAIT_CHECK_PATTERN,
  MEDIA_STATES,
  parseMediaPlayerXml,
  evaluateWaitCheck,
  resolveMediaPlayerWaitExpectedState,
  sleepWithStop,
  isValidMediaPlayerState
};
