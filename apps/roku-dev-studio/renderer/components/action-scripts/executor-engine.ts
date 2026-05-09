/**
 * Action Script executor: run steps in order, call API, handle wait/screenshot,
 * report progress via onStepStart/onStepEnd/onError/onComplete.
 */

import { validateAndNormalizeRaleCommandArgs } from './rale-command-validator.js';
import {
  evaluateNodeFieldWaitPredicate,
  formatRaleNodeFieldWaitDetails,
  getFieldStringFromGetNodeByIdData,
  valueToWaitString
} from './wait-node-field.js';
import { OPS_NEED_VALUE as WAIT_OPS_NEED_VALUE } from './action-script-if-client.js';
import { normalizePathArg } from '../inspector/node-lookup.js';
import {
  parseMediaPlayerXml,
  evaluateWaitCheck,
  sleepWithStop,
  resolveMediaPlayerWaitExpectedState
} from '../../modules/utils/action-script-wait-core.js';
import {
  processTelnetSystemCommandOutput,
  runTelnetSystemCommandSession
} from '../../modules/utils/telnet-system-command-run.js';
import {
  resolveStepWithVariables,
  getAssignToVarName,
  raleCommandSupportsAssignToVar
} from './action-script-variables-client.js';
import { evaluateIfConditionOnce } from './action-script-if-client.js';
import { devLog, isDeveloperModeEnabled } from '../../modules/utils/dev-log.js';
import {
  flattenStepsPreorder,
  preorderStepSubtreeSize,
  preorderBlockSize,
  ensureIfBranches
} from './action-script-tree.js';
import { queryEndpointToTelnetCommand, queryEndpointLabel } from './action-registry.js';
import { resolveDevPassword } from '../../modules/utils/dev-password.js';
import { isRaleNotConnectedResult } from '../../modules/utils/rale-result-guards.js';
import { normalizeRaleFunctions } from '../../modules/utils/rale-functions.js';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Callable that issues a RALE command against the shared AppConnector.
 * The connector already performs verify-and-reconnect on `"Not connected"`,
 * so callers here do not re-implement that logic. Passing `null` disables all
 * RALE-dependent steps (they fall back to skipping).
 */
export type EngineRaleCommand = (
  command: string,
  args?: unknown
) => Promise<{ success?: boolean; data?: unknown; error?: string }>;

/**
 * Poll getNodeById until field predicate matches (rale-node-field).
 */
async function runRaleNodeFieldWait(
  step,
  api,
  onLog,
  shouldStop,
  onWaiting,
  raleCommand: EngineRaleCommand | null
) {
  const condition = step.condition || {};
  const pathNorm = normalizePathArg(condition.path);
  if (!pathNorm.ok) {
    return { success: false, error: pathNorm.error || 'Invalid path' };
  }
  const id = String(condition.id != null ? condition.id : '').trim();
  const field = String(condition.field != null ? condition.field : '').trim();
  const operator = String(condition.operator || '');
  const valueRaw = condition.value;
  const valueStr = valueRaw != null ? valueToWaitString(valueRaw) : '';
  const caseInsensitive = !!condition.caseInsensitive;
  const timeoutMs = step.timeoutMs != null ? step.timeoutMs : 300000;
  const pollIntervalMs = step.pollIntervalMs != null ? step.pollIntervalMs : 2000;

  if (typeof raleCommand !== 'function') {
    onWaiting && onWaiting(false);
    return { success: false, error: 'App Connector not available for RALE Node wait' };
  }

  devLog('[rale-node-wait] start', {
    path: pathNorm.path,
    id,
    field,
    operator,
    valueStr,
    caseInsensitive,
    timeoutMs,
    pollIntervalMs
  });

  const start = Date.now();
  let pollCount = 0;
  while (Date.now() - start < timeoutMs) {
    if (typeof shouldStop === 'function' && shouldStop()) {
      onWaiting && onWaiting(false);
      return { success: false, error: 'Stopped', stopped: true };
    }
    // The connector's command() auto-reconnects on "Not connected", so a
    // mid-wait app restart (which kills the TrackerTask socket) is handled
    // transparently.
    pollCount++;
    devLog('[rale-node-wait] poll -> getNodeById', { pollCount, path: pathNorm.path, id });
    const res = await raleCommand('getNodeById', { path: pathNorm.path, id });
    if (isDeveloperModeEnabled()) {
      const dataPreview = describeGetNodeByIdResponse(res);
      devLog('[rale-node-wait] poll <- getNodeById', { pollCount, success: res && res.success, error: res && res.error, dataPreview });
    }
    let logValue = '';
    if (res && res.success && res.data != null) {
      const got = getFieldStringFromGetNodeByIdData(res.data, field);
      devLog('[rale-node-wait] got', { pollCount, field, got });
      if (got.ready) {
        if (evaluateNodeFieldWaitPredicate(got.actualStr, valueStr, operator, caseInsensitive)) {
          const elapsed = Math.round((Date.now() - start) / 1000);
          onLog && onLog(`Polling... (${elapsed}s) — field "${field}" — condition met`);
          onWaiting && onWaiting(false);
          devLog('[rale-node-wait] condition met', { pollCount, field, actualStr: got.actualStr, operator, valueStr });
          return { success: true };
        }
        logValue = got.actualStr
          ? JSON.stringify(got.actualStr.slice(0, 40)) + (got.actualStr.length > 40 ? '…' : '')
          : '(empty)';
      } else {
        logValue = `(${got.reason})`;
      }
    } else if (isRaleNotConnectedResult(res)) {
      logValue = '(reconnecting...)';
    } else {
      logValue = '(no response)';
    }
    const elapsed = Math.round((Date.now() - start) / 1000);
    onLog && onLog(`Polling... (${elapsed}s) — field "${field}": ${logValue}`);
    onWaiting && onWaiting(true);
    const completed = await sleepWithStop(pollIntervalMs, shouldStop);
    onWaiting && onWaiting(false);
    if (!completed) return { success: false, error: 'Stopped', stopped: true };
  }
  onWaiting && onWaiting(false);
  devLog('[rale-node-wait] timeout', { pollCount, field, operator, valueStr, timeoutMs });
  return { success: false, error: 'Wait timeout' };
}

/**
 * Produce a compact summary of a RALE getNodeById response for Developer Mode
 * logging. Avoids dumping huge layout/fieldlist payloads to the console.
 */
function describeGetNodeByIdResponse(res: unknown) {
  if (!res || typeof res !== 'object') return { kind: typeof res };
  const r = res as Record<string, unknown>;
  const data = r.data;
  const out: Record<string, unknown> = { success: r.success, error: r.error };
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    out.dataKind = Array.isArray(data) ? 'array' : typeof data;
    return out;
  }
  const d = data as Record<string, unknown>;
  out.dataKeys = Object.keys(d);
  if (d.command != null) out.command = d.command;
  if (d.path !== undefined) out.pathIsArray = Array.isArray(d.path);
  if (d.error && typeof d.error === 'object') {
    out.rootError = (d.error as Record<string, unknown>).message ?? '(object)';
  }
  if (d.item && typeof d.item === 'object' && !Array.isArray(d.item)) {
    out.itemType = String((d.item as Record<string, unknown>).type ?? '');
    out.itemId = (d.item as Record<string, unknown>).id;
  } else if (d.item !== undefined) {
    out.itemKind = Array.isArray(d.item) ? 'array' : typeof d.item;
  }
  const fl = (d.fieldlist ?? d.fieldList) as unknown;
  if (fl && typeof fl === 'object' && !Array.isArray(fl)) {
    const flo = fl as Record<string, unknown>;
    out.fieldlistKeys = Object.keys(flo).slice(0, 30);
    if (flo.error) out.fieldlistError = (flo.error as Record<string, unknown>).message ?? '(object)';
  } else if (fl !== undefined) {
    out.fieldlistKind = Array.isArray(fl) ? 'array' : typeof fl;
  }
  if (d.layout && typeof d.layout === 'object' && !Array.isArray(d.layout)) {
    const lay = d.layout as Record<string, unknown>;
    if (lay.error) out.layoutError = (lay.error as Record<string, unknown>).message ?? '(object)';
    else out.layoutKeys = Object.keys(lay).slice(0, 20);
  }
  return out;
}

/**
 * Run a single wait step: fixed delay (delayMs) or poll until condition.
 * Respects shouldStop so Stop button interrupts immediately (within chunkMs).
 */
async function runWaitStep(
  step,
  api,
  onLog,
  shouldStop,
  onWaiting,
  raleCommand: EngineRaleCommand | null
) {
  if (step.delayMs != null && step.delayMs >= 0) {
    const ms = Math.max(0, Number(step.delayMs));
    onLog && onLog(`Waiting ${ms} ms...`);
    onWaiting && onWaiting(true);
    const completed = await sleepWithStop(ms, shouldStop);
    onWaiting && onWaiting(false);
    if (!completed) return { success: false, error: 'Stopped', stopped: true };
    return { success: true };
  }

  const condition = step.condition || {};
  const source = condition.source || 'media-player';

  if (source === 'rale-node-field') {
    return runRaleNodeFieldWait(step, api, onLog, shouldStop, onWaiting, raleCommand);
  }
  // Normalize state to lowercase so "Play" from UI/script matches parsed "play" from XML
  const expectedState = resolveMediaPlayerWaitExpectedState(condition);
  const check = (source === 'media-player' && expectedState !== '')
    ? `state == "${expectedState.replace(/"/g, '\\"')}"`
    : (condition.check || "state == 'stop'");
  const timeoutMs = step.timeoutMs != null ? step.timeoutMs : 300000;
  const pollIntervalMs = step.pollIntervalMs != null ? step.pollIntervalMs : 2000;

  const start = Date.now();
  const endpoint = source === 'media-player' ? '/query/media-player' : `/query/${source}`;

  while (Date.now() - start < timeoutMs) {
    if (typeof shouldStop === 'function' && shouldStop()) {
      onWaiting && onWaiting(false);
      return { success: false, error: 'Stopped', stopped: true };
    }
    const res = await api.query(endpoint);
    let pollStatus = '';
    let data: unknown = null;
    if (res && res.success && res.data != null) {
      const xmlRaw = typeof res.data === 'string' ? res.data : String(res.data);
      data = parseMediaPlayerXml(xmlRaw);
      if (data && typeof data === 'object') {
        const row = data as { state?: unknown };
        if (source === 'media-player' && expectedState !== '' && row.state != null && String(row.state).toLowerCase() === expectedState) {
          const elapsed = Math.round((Date.now() - start) / 1000);
          const finalStatus = row.state != null && row.state !== '' ? `state: ${row.state}` : 'state: (none)';
          onLog && onLog(`Polling... (${elapsed}s) — ${finalStatus} — condition met`);
          return { success: true };
        }
        if (evaluateWaitCheck(check, data)) {
          const elapsed = Math.round((Date.now() - start) / 1000);
          const finalStatus = row.state != null && row.state !== '' ? `state: ${row.state}` : 'state: (none)';
          onLog && onLog(`Polling... (${elapsed}s) — ${finalStatus} — condition met`);
          return { success: true };
        }
        pollStatus = row.state != null && row.state !== ''
          ? `state: ${row.state}`
          : 'state: (none)';
      } else {
        pollStatus = 'invalid media player response';
      }
    } else {
      pollStatus = res && res.error ? `query failed: ${res.error}` : 'no response';
    }
    const elapsed = Math.round((Date.now() - start) / 1000);
    onLog && onLog(`Polling... (${elapsed}s) — ${pollStatus}`);
    onWaiting && onWaiting(true);
    const completed = await sleepWithStop(pollIntervalMs, shouldStop);
    onWaiting && onWaiting(false);
    if (!completed) return { success: false, error: 'Stopped', stopped: true };
  }

  onWaiting && onWaiting(false);
  return { success: false, error: 'Wait timeout' };
}

/**
 * Details column for wait steps (Builder + Executor lists): condition source and target.
 * @param {object} step
 * @returns {string}
 */
export function formatWaitStepListDetails(step) {
  if (!step || step.type !== 'wait') return '';
  if (step.delayMs != null && Number(step.delayMs) >= 0) {
    return `Fixed Delay ${step.delayMs} ms`;
  }
  const c = step.condition || {};
  const src = c.source || 'media-player';
  const timeoutMs = step.timeoutMs != null ? Number(step.timeoutMs) : 300000;
  const pollMs = step.pollIntervalMs != null ? Number(step.pollIntervalMs) : 2000;
  const timing = ` · max ${Math.round(timeoutMs / 1000)}s · poll ${pollMs}ms`;
  if (src === 'media-player') {
    const st = resolveMediaPlayerWaitExpectedState(c);
    if (st) return `Media player · until state "${st}"${timing}`;
    const chk = c.check && typeof c.check === 'string' ? c.check : "state == 'stop'";
    return `Media player · until ${chk}${timing}`;
  }
  if (src === 'rale-node-field') {
    const line = formatRaleNodeFieldWaitDetails(c);
    return line ? `RALE Node Field · ${line}${timing}` : `RALE Node Field · (incomplete)${timing}`;
  }
  return `Wait · source ${src}${timing}`;
}

/**
 * Run dev telnet (8080) for action scripts — same transport as Query tab Plugins / Memory.
 * @param {object} api
 * @param {string} telnetCommand
 * @param {(msg: string) => void} [onLog]
 * @param {() => boolean} [shouldStop]
 */
async function runTelnetSystemScriptStep(api, telnetCommand, onLog, shouldStop) {
  if (
    !api ||
    typeof api.telnetSystemConnect !== 'function' ||
    typeof api.telnetSystemSend !== 'function' ||
    typeof api.telnetSystemDisconnect !== 'function'
  ) {
    return { success: false, error: 'Telnet system commands are not available in this context' };
  }
  const tApi = {
    ip: api.ip,
    isRemote: api.isRemote,
    serverUrl: api.serverUrl != null ? api.serverUrl : null,
    telnetSystemDisconnect: api.telnetSystemDisconnect.bind(api),
    telnetSystemConnect: api.telnetSystemConnect.bind(api),
    telnetSystemSend: api.telnetSystemSend.bind(api)
  };
  onLog && onLog('Connecting to telnet (port 8080)...');
  const session = await runTelnetSystemCommandSession(tApi, telnetCommand, {
    onStatus: (m) => onLog && onLog(m),
    shouldStop
  });
  if (!session.ok) {
    if (session.stopped) {
      return { success: false, error: 'Stopped', stopped: true };
    }
    return { success: false, error: session.error };
  }
  const processed = processTelnetSystemCommandOutput(session.raw, telnetCommand);
  const data =
    processed.trim().length > 0 ? processed : (typeof session.raw === 'string' ? session.raw.trim() : '') || '';
  return { success: true, data };
}

/**
 * Details column for if steps: condition source and predicate.
 * @param {object} step
 * @returns {string}
 */
export function formatIfStepListDetails(step) {
  if (!step || step.type !== 'if') return '';
  const c = step.condition || {};
  const src = c.source || 'media-player';
  if (src === 'media-player') {
    const st = c.state != null ? String(c.state).trim() : '';
    if (st) return `Media player · state "${st}"`;
    const chk = c.check && typeof c.check === 'string' ? c.check : "state == 'stop'";
    return `Media player · ${chk}`;
  }
  if (src === 'rale-node-field') {
    const line = formatRaleNodeFieldWaitDetails(c);
    return line ? `RALE Node Field · ${line}` : 'RALE Node Field · …';
  }
  if (src === 'variables') {
    const p = c.variablePath != null ? String(c.variablePath).trim() : '';
    const op = typeof c.operator === 'string' ? c.operator : '?';
    let tail = '';
    if (p && WAIT_OPS_NEED_VALUE.has(op) && c.value !== undefined && c.value !== null) {
      const vs = valueToWaitString(c.value);
      tail = vs.length > 36 ? ` · ${op} "${vs.slice(0, 35)}…"` : ` · ${op} "${vs}"`;
    } else if (p) {
      tail = ` · ${op}`;
    }
    return p ? `Variable · $${p}${tail}` : 'Variable · …';
  }
  if (src === 'active-app') {
    const attr = c.attribute != null ? String(c.attribute).trim() : '';
    const op = typeof c.operator === 'string' ? c.operator : '?';
    let tail = '';
    if (attr && WAIT_OPS_NEED_VALUE.has(op) && c.value !== undefined && c.value !== null) {
      const vs = valueToWaitString(c.value);
      tail = vs.length > 36 ? ` · ${op} "${vs.slice(0, 35)}…"` : ` · ${op} "${vs}"`;
    } else if (attr) {
      tail = ` · ${op}`;
    }
    return attr ? `Active app · ${attr}${tail}` : 'Active app · …';
  }
  return `if · ${src}`;
}

/**
 * Human-readable description of a step (for UI labels).
 */
export function stepDescription(step, index) {
  if (!step || !step.type) return '?';
  switch (step.type) {
    case 'query':
      return `query ${queryEndpointLabel(step.endpoint)}`;
    case 'systemTelnet':
      return `telnet ${step.telnetCommand || '?'}`;
    case 'post':
      return `post ${step.endpoint || '?'}`;
    case 'keypress':
      return `keypress ${step.key || '?'}`;
    case 'inputText':
      return `send text "${(step.text || '').slice(0, 30)}${(step.text && step.text.length > 30) ? '…' : ''}"`;
    case 'launch':
      return `launch app ${step.appId || '?'}`;
    case 'sideload':
      return `sideload ${step.filePath ? step.filePath.split(/[/\\]/).pop() : '?'}`;
    case 'deleteSideload':
      return 'delete sideload';
    case 'appFunction': {
      const o = getAssignToVarName(step);
      return `app function ${step.functionName || '?'}` + (o ? ` → $${o}` : '');
    }
    case 'raleCommand': {
      const o = getAssignToVarName(step);
      return `RALE ${step.command || '?'}` + (o ? ` → $${o}` : '');
    }
    case 'screenshot':
      if (step.label) return `screenshot (${step.label})`;
      if (step.waitAfterTriggerMs != null && Number(step.waitAfterTriggerMs) >= 0) {
        return `screenshot (wait after: ${step.waitAfterTriggerMs}ms)`;
      }
      return 'screenshot';
    case 'devicePerformance': {
      const chart = step.chart != null ? String(step.chart) : '';
      const chartLab =
        chart === 'objects'
          ? 'BrightScript Objects'
          : chart === 'cpu'
            ? 'CPU Usage'
            : chart === 'memory'
              ? 'System Memory'
              : chart === 'aboveAll'
                ? 'Above All'
                : chart || '?';
      return step.label
        ? `Device Performance (${step.label}) — ${chartLab}`
        : `Device Performance — ${chartLab}`;
    }
    case 'wait': {
      const w = formatWaitStepListDetails(step);
      return w ? `wait · ${w}` : 'wait';
    }
    case 'if': {
      const line = formatIfStepListDetails(step);
      return line ? `if · ${line}` : 'if (…)';
    }
    default:
      return step.type;
  }
}

/**
 * Run script steps.
 * @param {Object} script - { steps: [...] }
 * @param {Object} context - { api, raleCommand?, getPassword, saveFolder, runId, isStepSkipped?, shouldPause?, shouldStop?, captureDevicePerformance? }
 *   raleCommand: optional `(command, args) => Promise<{ success, data?, error? }>` bound to the panel's shared AppConnector. It already handles verify-and-reconnect on "Not connected". When omitted, RALE-dependent steps (appFunction, raleCommand, rale-node-field waits, RALE-source `if`) are skipped.
 * @param {Object} callbacks - { onStepStart, onStepEnd, onError, onComplete(flags?), onLog }
 * @returns {Promise<void>}
 */
export async function runScript(script, context, callbacks) {
  const {
    api,
    raleCommand,
    getPassword,
    saveFolder,
    runId,
    isStepSkipped,
    shouldPause,
    shouldStop,
    captureDevicePerformance
  } = context as {
    api;
    raleCommand?: EngineRaleCommand | null;
    getPassword?;
    saveFolder?;
    runId?;
    isStepSkipped?;
    shouldPause?;
    shouldStop?;
    captureDevicePerformance?;
  };
  const engineRaleCommand: EngineRaleCommand | null =
    typeof raleCommand === 'function' ? raleCommand : null;
  const { onStepStart, onStepEnd, onError, onComplete, onLog, onWaiting } = callbacks || {};
  const steps = script && script.steps ? script.steps : [];
  const scriptDevPassword = script && script.devPassword ? script.devPassword : '';

  /** Executor priority: explicit step password > script-level default > ambient UI input. */
  function resolvePassword(step) {
    return resolveDevPassword(
      {
        stepPassword: step && step.password,
        scriptDevPassword,
        uiInput: getPassword && getPassword()
      },
      ['stepPassword', 'scriptDevPassword', 'uiInput']
    );
  }

  /**
   * Lazy run folder: creates a subfolder inside saveFolder named after the runId
   * only on first call (i.e., only when something actually needs to be saved).
   */
  let _runFolderPath: string | null = null;
  function getRunFolder() {
    if (!saveFolder || !runId) return saveFolder || null;
    if (!_runFolderPath) {
      _runFolderPath = saveFolder + '/' + runId;
    }
    return _runFolderPath;
  }

  /** @type {Record<string, unknown>} */
  const variables = Object.create(null);

  const flatList = flattenStepsPreorder(steps);
  let fi = 0;

  /**
   * @param {unknown[]} stepArray
   * @returns {Promise<boolean>} false if run stopped or failed
   */
  async function visitArray(stepArray) {
    if (!Array.isArray(stepArray)) return true;

    for (const rawStep of stepArray) {
      if (typeof shouldStop === 'function' && shouldStop()) {
        onComplete && onComplete({ stopped: true });
        return false;
      }
      if (typeof shouldPause === 'function' && shouldPause()) {
        while (shouldPause() && !(typeof shouldStop === 'function' && shouldStop())) {
          await new Promise((r) => setTimeout(r, 200));
        }
        if (typeof shouldStop === 'function' && shouldStop()) {
          onComplete && onComplete({ stopped: true });
          return false;
        }
      }

      const entryPos = fi;
      const entry = flatList[entryPos];
      if (!entry) {
        onError && onError(fi, new Error('Internal error: step preorder mismatch'));
        return false;
      }
      const myIdx = entry.index;
      fi = entryPos + 1;

      const resolved = resolveStepWithVariables(rawStep, variables);
      if (!resolved.ok) {
        onStepEnd && onStepEnd(myIdx, { success: false, error: resolved.error });
        onError && onError(myIdx, new Error(resolved.error));
        return false;
      }
      const step = resolved.step;
      const stepDesc = stepDescription(step, myIdx);
      onStepStart && onStepStart(myIdx, step, stepDesc);

      if (typeof isStepSkipped === 'function' && isStepSkipped(myIdx)) {
        if (step.type === 'if') {
          const total = preorderStepSubtreeSize(step);
          onStepEnd && onStepEnd(myIdx, { success: true, skipped: true });
          for (let u = 1; u < total; u++) {
            const e = flatList[entryPos + u];
            if (!e) break;
            const desc = stepDescription(e.step, e.index);
            onStepStart && onStepStart(e.index, e.step, desc);
            onStepEnd && onStepEnd(e.index, { success: true, skipped: true });
          }
          fi = entryPos + total;
        } else {
          onStepEnd && onStepEnd(myIdx, { success: true, skipped: true });
        }
        continue;
      }

      try {
        if (step.type === 'if') {
          ensureIfBranches(step);
          const ev = await evaluateIfConditionOnce(
            step.condition,
            variables,
            api,
            engineRaleCommand
          );
          if (!ev.ok) {
            onStepEnd && onStepEnd(myIdx, { success: false, error: ev.error });
            onError && onError(myIdx, new Error(ev.error));
            return false;
          }
          const takeThen = ev.branchThen;
          if (/** @type {{ runtimeSummary?: string }} */ (ev).runtimeSummary && onLog) {
            onLog(/** @type {{ runtimeSummary?: string }} */ (ev).runtimeSummary);
          }
          if (takeThen) {
            if (!(await visitArray(step.then || []))) return false;
            fi += preorderBlockSize(step.else || []);
          } else {
            fi += preorderBlockSize(step.then || []);
            if (!(await visitArray(step.else || []))) return false;
          }
          onStepEnd && onStepEnd(myIdx, { success: true });
          continue;
        }

        let result;
        let stepSummary = '';

        switch (step.type) {
        case 'query': {
          const ep = step.endpoint;
          const telnetCmd = queryEndpointToTelnetCommand(ep);
          if (telnetCmd) {
            onLog &&
              onLog(
                `Device query "${ep}" uses dev telnet "${telnetCmd}" (same as the Query tab).`
              );
            result = await runTelnetSystemScriptStep(api, telnetCmd, onLog, shouldStop);
          } else {
            result = await api.query(ep);
          }
          if (result && result.success && result.data != null) {
            const len = typeof result.data === 'string' ? result.data.length : JSON.stringify(result.data).length;
            stepSummary = `→ ${len} chars`;
          }
          break;
        }
        case 'systemTelnet':
          result = await runTelnetSystemScriptStep(api, String(step.telnetCommand || '').trim(), onLog, shouldStop);
          if (result && result.success && result.data != null) {
            const len = typeof result.data === 'string' ? result.data.length : JSON.stringify(result.data).length;
            stepSummary = `→ ${len} chars`;
          }
          break;
        case 'post':
          result = await api.post(step.endpoint);
          if (result && result.success) stepSummary = '→ OK';
          break;
        case 'keypress':
          result = await api.keypress(step.key);
          if (result && result.success) stepSummary = `→ sent ${step.key}`;
          break;
        case 'inputText':
          result = await api.inputText(step.text);
          if (result && result.success) stepSummary = '→ sent';
          break;
        case 'launch':
          result = await api.launch(step.appId, step.params || '');
          if (result && result.success) stepSummary = `→ launched ${step.appId}`;
          break;
        case 'sideload':
          result = await api.sideload(step.filePath, resolvePassword(step));
          if (result && result.success) stepSummary = '→ sideload complete';
          break;
        case 'deleteSideload':
          result = await api.deleteSideload(resolvePassword(step));
          if (result && result.success) stepSummary = '→ deleted';
          break;
        case 'appFunction': {
          const skipReason = 'App Connector not available';
          if (!engineRaleCommand) {
            result = { success: true, skipped: true, skippedReason: skipReason };
            stepSummary = `→ skipped (${skipReason})`;
            break;
          }
          // Normalize named-object functionParams to a positional array using
          // the channel's declared param order. Roku's `ExecuteFunction(name,
          // params)` reads `params[0], params[1], ...`, so a named object
          // would arrive as `params[0] = invalid` on the device. The validator
          // already does this normalization for the validation pass; we
          // mirror it here so a saved/imported script in named-object form
          // (legacy or agent-generated) still runs correctly.
          let runtimeParams = step.functionParams;
          if (
            runtimeParams != null &&
            typeof runtimeParams === 'object' &&
            !Array.isArray(runtimeParams)
          ) {
            try {
              const fnList = (await engineRaleCommand('getExternalControlFunctions', {})) as {
                success?: boolean;
                data?: { functions?: unknown[] };
              };
              // The wire shape uses `functionName`, not `name`. Always normalize
              // (which renames `functionName` → `name`) before lookup; reading
              // raw `fnList.data.functions` and matching `f.name` would silently
              // never find anything. See engineering-principles.md
              // §"normalize at the boundary".
              const rawFns = fnList && fnList.success && Array.isArray(fnList.data?.functions)
                ? (fnList.data!.functions as unknown[])
                : [];
              const fns = normalizeRaleFunctions(rawFns) as Array<{
                name?: string;
                params?: Array<{ name?: string }>;
              }>;
              const fn = fns.find((f) => f && f.name === step.functionName);
              const declared = fn && Array.isArray(fn.params) ? fn.params : [];
              if (declared.length > 0) {
                const named = runtimeParams as Record<string, unknown>;
                runtimeParams = declared.map((p) =>
                  p && typeof p.name === 'string' ? named[p.name] : undefined
                );
              }
            } catch {
              // If normalization fails (e.g. App Connector temporarily down),
              // fall back to the raw value so the existing skip-on-not-connected
              // path below catches it consistently.
            }
          }
          // Connector.command handles verify-and-reconnect internally. A final
          // "Not connected" means the connector really couldn't reach the
          // device; treat it as a skip instead of a hard failure.
          result = await engineRaleCommand('executeExternalControlFunction', {
            functionName: step.functionName,
            functionParams: Array.isArray(runtimeParams) ? runtimeParams : []
          });
          if (!result || isRaleNotConnectedResult(result)) {
            result = { success: true, skipped: true, skippedReason: skipReason };
            stepSummary = `→ skipped (${skipReason})`;
          }
          if (result && result.success && result.data != null) {
            stepSummary = `→ ${typeof result.data === 'string' ? result.data.slice(0, 60) : JSON.stringify(result.data).slice(0, 60)}${(typeof result.data === 'string' ? result.data.length : JSON.stringify(result.data).length) > 60 ? '…' : ''}`;
          }
          break;
        }
        case 'raleCommand': {
          const skipReason = 'App Connector not available';
          const vr = validateAndNormalizeRaleCommandArgs(step.command, step.args);
          if (!vr.ok) {
            result = { success: false, error: vr.error || 'Invalid raleCommand' };
            break;
          }
          if (!engineRaleCommand) {
            result = { success: true, skipped: true, skippedReason: skipReason };
            stepSummary = `→ skipped (${skipReason})`;
            break;
          }
          result = await engineRaleCommand(step.command, vr.args);
          if (!result || isRaleNotConnectedResult(result)) {
            result = { success: true, skipped: true, skippedReason: skipReason };
            stepSummary = `→ skipped (${skipReason})`;
            break;
          }
          if (result && result.success && result.data != null) {
            stepSummary = `→ ${typeof result.data === 'string' ? result.data.slice(0, 60) : JSON.stringify(result.data).slice(0, 60)}${(typeof result.data === 'string' ? result.data.length : JSON.stringify(result.data).length) > 60 ? '…' : ''}`;
          }
          break;
        }
        case 'screenshot': {
          const waitMs = step.waitBeforeMs != null && Number(step.waitBeforeMs) >= 0
            ? Number(step.waitBeforeMs)
            : 100;
          if (waitMs > 0) {
            onLog && onLog(`Waiting ${waitMs} ms before capture...`);
            await new Promise(r => setTimeout(r, waitMs));
          }
          const password = resolvePassword(step);
          if (!password) {
            result = { success: false, error: 'Developer password required for screenshot. Specify it in the script (devPassword) or enter it during validation.' };
          } else {
            const activeAppRes = await api.query('/query/active-app');
            const activeAppQueryOk = activeAppRes.success && typeof activeAppRes.data === 'string';
            const devAppActive = activeAppQueryOk && activeAppRes.data!.includes('id="dev"');
            if (!activeAppQueryOk) {
              // Surface the actual failure instead of the misleading "Dev App not active"
              // that we'd report if query error and dev-backgrounded were collapsed.
              result = {
                success: false,
                error: `Could not verify Dev App status before screenshot: ${activeAppRes.error || 'active-app query failed'}`
              };
            } else if (!devAppActive) {
              result = {
                success: false,
                error: 'Screenshot requires the Developer App to be active. Launch your sideloaded channel from the Dev App tab first.'
              };
            } else {
              const screenshotOpts = (step.waitAfterTriggerMs != null && Number(step.waitAfterTriggerMs) >= 0)
                ? { waitAfterTriggerMs: Number(step.waitAfterTriggerMs) }
                : undefined;
              result = await api.screenshot(password, screenshotOpts);
            }
            if (result && result.success && saveFolder && result.url) {
              const runFolder = getRunFolder();
              const label = (step.label || `action-${myIdx + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
              const filename = `action-${myIdx + 1}_${label}.png`;
              const saveResult = await (window.roku && window.roku.actionScriptWriteFile
                ? window.roku.actionScriptWriteFile(runFolder, filename, result.url)
                : Promise.resolve({ success: false, error: 'Save not available' }));
              if (!saveResult.success) {
                result = { ...result, saveError: saveResult.error };
                stepSummary = `→ save failed: ${saveResult.error || 'unknown'}`;
              } else {
                stepSummary = `→ saved as ${filename}`;
              }
            } else if (result && result.success) {
              stepSummary = '→ captured (no save folder)';
            }
          }
          break;
        }
        case 'wait':
          result = await runWaitStep(step, api, onLog, shouldStop, onWaiting, engineRaleCommand);
          if (result && result.success) {
            stepSummary = step.delayMs != null ? `→ waited ${step.delayMs} ms` : '';
          }
          break;
        case 'devicePerformance': {
          const chart = step.chart != null ? String(step.chart).trim() : '';
          if (typeof captureDevicePerformance !== 'function') {
            result = {
              success: false,
              error: 'Device Performance is only available when running Action Scripts in Roku Dev Studio.'
            };
            break;
          }
          result = await captureDevicePerformance(chart, { shouldStop, onWaiting });
          if (result && result.success && result.partial && onLog) {
            onLog('Some performance sections were unavailable; partial snapshot.');
          }
          if (result && result.success) {
            const n = Array.isArray(result.pngDataUrls) ? result.pngDataUrls.length : 0;
            stepSummary = n ? `→ ${n} chart image(s)` : '→ captured';
          }
          break;
        }
        default:
          result = { success: false, error: `Unknown action type: ${step.type}` };
        }

        const outName = rawStep ? getAssignToVarName(rawStep) : '';
        const raleBindOk =
          rawStep.type !== 'raleCommand' ||
          raleCommandSupportsAssignToVar(/** @type {{ command?: string }} */ (rawStep).command);
        if (
          outName &&
          raleBindOk &&
          (rawStep.type === 'appFunction' || rawStep.type === 'raleCommand') &&
          result &&
          result.success &&
          !result.skipped &&
          result.data !== undefined
        ) {
          variables[outName] = result.data;
        }

        if (stepSummary && onLog) onLog(stepSummary);
        onStepEnd && onStepEnd(myIdx, result);
        if (result && result.stopped) {
          onComplete && onComplete({ stopped: true });
          return false;
        }
        if (result && result.success === false && result.error) {
          onError && onError(myIdx, new Error(result.error));
          return false;
        }
      } catch (err) {
        const m = errMsg(err);
        onStepEnd && onStepEnd(myIdx, { success: false, error: m });
        onError && onError(myIdx, err instanceof Error ? err : new Error(m));
        return false;
      }
    }
    return true;
  }

  const completed = await visitArray(steps);
  if (completed) {
    onComplete && onComplete();
  }
}
