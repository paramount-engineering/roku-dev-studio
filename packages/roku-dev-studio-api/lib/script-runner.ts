/**
 * Headless Action Script runner for rds CLI (subset parity with desktop executor).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { query, post, keypress, inputText, launch } = require('../ecp');
const { sideloadChannel, deleteSideload } = require('./plugin-install');
const { captureRokuScreenshot } = require('./screenshot');
const { validateDevPassword } = require('./validate-input');
const raleDirect = require('./rale-direct');
const { DEFAULT_RALE_PORT, QUERY_TIMEOUT } = require('./shared-constants');
const {
  parseMediaPlayerXml,
  evaluateWaitCheck,
  sleepWithStop,
  isValidMediaPlayerState,
  resolveMediaPlayerWaitExpectedState
} = require('./action-script-wait-core');
const {
  resolveStepWithVariables,
  validateOutputFields,
  getAssignToVarName,
  raleCommandSupportsAssignToVar,
  parseVariableDotPath
} = require('./action-script-variables');
const { evaluateIfConditionOnce, validateIfConditionShape } = require('./action-script-if-eval');
const { flattenStepsPreorder, preorderBlockSize } = require('./action-script-step-tree');
const { MEDIA_STATES } = require('./action-script-wait-core');
const { errorMessage } = require('./err-util');
const { validateScript: canonicalValidate } = require('./validate-action-script');
const { normalizeRaleFunctions } = require('./rale-functions-normalize');

const MEDIA_PLAYER_STATE_VALUES = Array.from(MEDIA_STATES);

/** One step object from JSON (loose). */
type ScriptStep = Record<string, unknown> & { type?: string; then?: unknown[]; else?: unknown[] };

type VisitArrayResult =
  | { ok: true }
  | {
      ok: false;
      err: {
        success: false;
        error: string;
        stepIndex?: number;
        stopped?: boolean;
        lastStepIndex?: number;
      };
    };

/** Minimal shape of `createRelayClient()` for the script runner. */
interface RelayClientLike {
  query(deviceIp: string, endpoint: string): Promise<unknown>;
  post(deviceIp: string, endpoint: string): Promise<unknown>;
  keypress(deviceIp: string, key: string): Promise<unknown>;
  inputText(deviceIp: string, text: string): Promise<unknown>;
  launch(deviceIp: string, appId: string, opts: unknown): Promise<unknown>;
  sideload(deviceIp: string, opts: unknown): Promise<unknown>;
  deleteSideload(deviceIp: string, password: string): Promise<unknown>;
  raleWake(deviceIp: string, port?: number): Promise<unknown>;
  raleConnect(deviceIp: string, port?: number): Promise<unknown>;
  raleCommand(deviceIp: string, body: unknown): Promise<unknown>;
  raleDisconnect(deviceIp: string, body: unknown): Promise<unknown>;
  screenshot?(deviceIp: string, opts: unknown): Promise<Record<string, unknown>>;
}

interface RunActionScriptOptions {
  ip: string;
  password?: string;
  relayClient?: RelayClientLike | null;
  ecpTimeout?: number;
  ralePort?: number;
  raleCommandTimeoutMs?: number;
  screenshotDir?: string | null;
  onLog?: (msg: string) => void;
  onStepStart?: (idx: number, step: unknown) => void;
  onStepEnd?: (idx: number, result: unknown) => void;
  shouldStop?: (() => boolean) | null;
}

type IfEvalApi = {
  query: (path: string) => Promise<Record<string, unknown>>;
};

const STEP_REQUIRED = {
  query: ['endpoint'],
  post: ['endpoint'],
  keypress: ['key'],
  inputText: ['text'],
  launch: ['appId'],
  sideload: ['filePath'],
  deleteSideload: [],
  appFunction: ['functionName', 'functionParams'],
  raleCommand: ['command'],
  screenshot: [],
  devicePerformance: ['chart'],
  wait: [],
  if: ['condition', 'then', 'else']
};

const DEVICE_PERFORMANCE_CHART_IDS = ['objects', 'cpu', 'memory', 'aboveAll'];

const SUPPORTED_TYPES = Object.keys(STEP_REQUIRED);

function getScriptVersion(script: unknown): string {
  const s = script as Record<string, unknown> | null | undefined;
  const v = s && s.version != null ? String(s.version).trim() : '';
  return v === '2' ? '2' : '1';
}

function walkSteps(steps: unknown, visitor: (s: ScriptStep) => void): void {
  if (!Array.isArray(steps)) return;
  for (const s of steps) {
    if (!s || typeof s !== 'object') continue;
    visitor(s as ScriptStep);
    const st = s as ScriptStep;
    if (st.type === 'if') {
      walkSteps(st.then, visitor);
      walkSteps(st.else, visitor);
    }
  }
}

function normalizeQueryEndpoint(ep: unknown): string {
  if (!ep || typeof ep !== 'string') return '/query/';
  return ep.startsWith('/') ? ep : `/${ep}`;
}

/**
 * @param {object} options
 * @param {string} options.ip
 * @param {string} options.password - default dev password for steps
 * @param {object} [options.relayClient] - return value of createRelayClient()
 * @param {number} [options.ecpTimeout] — default QUERY_TIMEOUT from shared-constants
 * @param {number} [options.ralePort] — default `DEFAULT_RALE_PORT` from shared-constants
 * @param {number} [options.raleCommandTimeoutMs=30000] - per RALE command wait (direct TCP only)
 * @param {string} [options.screenshotDir] - directory to write screenshot steps
 * @param {function(string):void} [options.onLog]
 * @param {function(number, object):void} [options.onStepStart]
 * @param {function(number, object):void} [options.onStepEnd]
 * @param {function():boolean} [options.shouldStop]
 */
async function runActionScript(script: unknown, options: RunActionScriptOptions) {
  const {
    ip,
    password: ctxPassword = '',
    relayClient = null,
    ecpTimeout = QUERY_TIMEOUT,
    ralePort = DEFAULT_RALE_PORT,
    raleCommandTimeoutMs = 30000,
    screenshotDir = null,
    onLog = (_m: string) => undefined,
    onStepStart = (_i: number, _s: unknown) => undefined,
    onStepEnd = (_i: number, _r: unknown) => undefined,
    shouldStop = null
  } = options;

  const to = { timeout: ecpTimeout };
  const scr = script as Record<string, unknown> | null | undefined;
  const scriptDevPassword = (scr && scr.devPassword) || '';

  // Canonical structural preflight (Phase 0c.2). The CLI already validates
  // before calling us, but third-party `roku-dev-studio-api` consumers might
  // not — having the runtime gate on the same canonical validator means a
  // bad script can never reach the device, and the failure mode is a clean
  // single-line error instead of a half-executed script.
  //
  // Per-step structural re-checks below this point have been removed (Q4 of
  // `.discussion-docs/unified-action-script-validation.md`); the canonical
  // validator is the only structural gate. Runtime *preconditions* like
  // "App Connector session must be live" are still enforced inline because
  // they depend on device state, not script shape.
  {
    const v = validateScriptStructure(script);
    if (!v.valid) {
      return { success: false, error: v.errors[0] || 'Invalid script' };
    }
  }

  function resolvePassword(step: ScriptStep): string {
    return (step && (step.password as string)) || String(scriptDevPassword) || ctxPassword;
  }

  const dataUrlToBuffer = (url: unknown): Buffer | null => {
    if (!url || typeof url !== 'string') return null;
    const m = url.match(/^data:([^;]+);base64,(.+)$/);
    return m ? Buffer.from(m[2], 'base64') : null;
  };

  function createDeviceApi() {
    if (relayClient) {
      const rc = relayClient;
      return {
        query: (endpoint: string) => {
          const e = normalizeQueryEndpoint(endpoint);
          const pathForRelay = e.startsWith('/query/') ? e : `/query${e.replace(/^\/+/, '/')}`;
          const q = pathForRelay.startsWith('/query/') ? pathForRelay : `/query/${pathForRelay.replace(/^\//, '')}`;
          return rc.query(ip, q);
        },
        post: (endpoint: string) => {
          let ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
          const relayPath = ep.startsWith('/post/') ? ep.replace(/^\/post/, '') || '/' : ep;
          const p = relayPath.startsWith('/') ? relayPath : `/${relayPath}`;
          return rc.post(ip, p);
        },
        keypress: (key: string) => rc.keypress(ip, key),
        inputText: (text: string) => rc.inputText(ip, text),
        launch: (appId: string, params: unknown) =>
          rc.launch(ip, appId, { params: params && String(params).trim() ? params : '' }),
        sideload: (filePath: string, pwd: string) =>
          rc.sideload(ip, { file: path.resolve(filePath), password: pwd }),
        deleteSideload: (pwd: string) => rc.deleteSideload(ip, pwd),
        raleCommand: (connectionId: string, command: string, args: unknown) =>
          rc.raleCommand(ip, {
            connectionId,
            command,
            args: args || {},
            timeoutMs: raleCommandTimeoutMs
          })
      };
    }
    return {
      query: (endpoint: string) => {
        const e = normalizeQueryEndpoint(endpoint);
        const pathEcp = e.startsWith('/query/') ? e : `/query${e}`;
        return query(ip, pathEcp, to);
      },
      post: (endpoint: string) => {
        const ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return post(ip, ep, to);
      },
      keypress: (key: string) => keypress(ip, key, to),
      inputText: (text: string) => inputText(ip, text, to),
      launch: (appId: string, params: unknown) =>
        launch(ip, appId, params && String(params).trim() ? String(params) : undefined, to),
      sideload: (filePath: string, pwd: string) =>
        sideloadChannel({ ip, filePath: path.resolve(filePath), password: pwd }),
      deleteSideload: (pwd: string) => deleteSideload({ ip, password: pwd }),
      raleCommand: (connectionId: string, command: string, args: unknown) =>
        raleDirect.raleCommand(connectionId, command, args, { timeoutMs: raleCommandTimeoutMs })
    };
  }

  const deviceApi = createDeviceApi();

  async function runWaitStep(step: ScriptStep) {
    if (typeof step.delayMs === 'number' && step.delayMs >= 0) {
      const ms = Math.max(0, Number(step.delayMs));
      onLog(`Waiting ${ms} ms...`);
      const completed = await sleepWithStop(ms, shouldStop);
      if (!completed) return { success: false, error: 'Stopped', stopped: true };
      return { success: true };
    }

    const condition = (
      step.condition && typeof step.condition === 'object' ? step.condition : {}
    ) as Record<string, unknown>;
    if (condition.source === 'rale-node-field') {
      return {
        success: false,
        error:
          'wait with condition.source "rale-node-field" is not supported in rds; use Roku Dev Studio or a media-player wait.'
      };
    }

    const source = condition.source || 'media-player';
    const expectedState = resolveMediaPlayerWaitExpectedState(condition);
    const check =
      source === 'media-player' && expectedState !== ''
        ? `state == "${expectedState.replace(/"/g, '\\"')}"`
        : condition.check || "state == 'stop'";
    const timeoutMs =
      typeof step.timeoutMs === 'number' && step.timeoutMs > 0 ? step.timeoutMs : 300000;
    const pollIntervalMs =
      typeof step.pollIntervalMs === 'number' && step.pollIntervalMs > 0 ? step.pollIntervalMs : 2000;

    const start = Date.now();
    const endpoint = source === 'media-player' ? '/query/media-player' : `/query/${source}`;

    while (Date.now() - start < Number(timeoutMs)) {
      if (shouldStop && shouldStop()) {
        return { success: false, error: 'Stopped', stopped: true };
      }
      const res = (await deviceApi.query(endpoint)) as Record<string, unknown>;
      if (res && res.success && res.data != null) {
        const xmlRaw = typeof res.data === 'string' ? res.data : String(res.data);
        const data = parseMediaPlayerXml(xmlRaw);
        if (
          source === 'media-player' &&
          expectedState !== '' &&
          data.state != null &&
          String(data.state).toLowerCase() === expectedState
        ) {
          return { success: true };
        }
        if (evaluateWaitCheck(check, data)) {
          return { success: true };
        }
      }
      const completed = await sleepWithStop(pollIntervalMs, shouldStop);
      if (!completed) return { success: false, error: 'Stopped', stopped: true };
    }
    return { success: false, error: 'Wait timeout' };
  }

  async function runScreenshotStep(step: ScriptStep, stepIndex: number) {
    const waitMs =
      step.waitBeforeMs != null && Number(step.waitBeforeMs) >= 0 ? Number(step.waitBeforeMs) : 100;
    if (waitMs > 0) {
      await sleepWithStop(waitMs, shouldStop);
    }
    const pwd = resolvePassword(step);
    if (!pwd) {
      return {
        success: false,
        error: 'Developer password required for screenshot (script.devPassword, step.password, or CLI --password).'
      };
    }
    const activeAppRes = (await deviceApi.query('/query/active-app')) as Record<string, unknown>;
    const devAppActive =
      activeAppRes.success &&
      activeAppRes.data &&
      String(activeAppRes.data).includes('id="dev"');
    if (!devAppActive) {
      return {
        success: false,
        error: 'Screenshot requires the Developer App to be active (sideloaded dev channel running).'
      };
    }
    const waitAfterTriggerMs =
      step.waitAfterTriggerMs != null && Number(step.waitAfterTriggerMs) >= 0
        ? Number(step.waitAfterTriggerMs)
        : undefined;

    let buf: Buffer;
    if (relayClient) {
      if (typeof relayClient.screenshot !== 'function') {
        return { success: false, error: 'Relay client does not support screenshot' };
      }
      const res = (await relayClient.screenshot(ip, {
        password: pwd,
        waitAfterTriggerMs
      })) as Record<string, unknown>;
      if (!res.success) return res as { success: false; error: string };
      const fromUrl = dataUrlToBuffer(res.url);
      if (!fromUrl || fromUrl.length < 100) {
        return { success: false, error: 'Invalid image data from relay' };
      }
      buf = fromUrl;
    } else {
      const res = await captureRokuScreenshot({
        ip,
        password: pwd,
        waitAfterTriggerMs
      });
      if (!res.success) return res;
      buf = res.imageBuffer;
    }

    let savedPath = null;
    if (screenshotDir) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      const label = String(step.label ?? `step-${stepIndex + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `step-${stepIndex + 1}_${label}.jpg`;
      savedPath = path.join(screenshotDir, filename);
      fs.writeFileSync(savedPath, buf);
    }
    return { success: true, savedPath, bytes: buf.length };
  }

  const steps = scr && Array.isArray(scr.steps) ? (scr.steps as unknown[]) : [];
  let raleConnectionId: string | null = null;

  let needsRale = false;
  walkSteps(steps, (s) => {
    if (!s.type) return;
    if (s.type === 'appFunction' || s.type === 'raleCommand') needsRale = true;
    const cond = s.condition as Record<string, unknown> | undefined;
    if (s.type === 'wait' && cond && cond.source === 'rale-node-field') needsRale = true;
    if (s.type === 'if' && cond && cond.source === 'rale-node-field') needsRale = true;
  });

  try {
    /** @type {Record<string, unknown>} */
    const variables = Object.create(null);

    if (needsRale) {
      if (relayClient) {
        await relayClient.raleWake(ip, ralePort);
        const conn = (await relayClient.raleConnect(ip, ralePort)) as {
          success: boolean;
          error?: string;
          connectionId?: string;
        };
        if (!conn.success) {
          return { success: false, error: conn.error || 'RALE connect failed (relay)' };
        }
        raleConnectionId = conn.connectionId ?? null;
      } else {
        await raleDirect.raleWake(ip, ralePort);
        const conn = await raleDirect.raleConnect(ip, ralePort);
        if (!conn.success) {
          return { success: false, error: conn.error || 'RALE connect failed' };
        }
        raleConnectionId = conn.connectionId;
      }
    }

    const flatList = flattenStepsPreorder(steps);
    let fi = 0;
    const scriptVersion = getScriptVersion(scr);
    /**
     * `raleCommand` for `evaluateIfConditionOnce`: binds the current
     * `raleConnectionId` so the helper never has to know about connection ids.
     * Script-runner manages its own reconnect logic around the for-loop; here
     * we just surface a "Not connected" error if the id is missing.
     */
    const ifRaleCommand = async (command: string, args?: unknown) => {
      if (!raleConnectionId || !deviceApi.raleCommand) {
        return { success: false, error: 'Not connected' };
      }
      return (await deviceApi.raleCommand(
        raleConnectionId,
        command,
        (args as Record<string, unknown>) ?? {}
      )) as { success?: boolean; data?: unknown; error?: string };
    };

    function ensureIfBranches(ifStep: ScriptStep): void {
      if (!ifStep || typeof ifStep !== 'object' || ifStep.type !== 'if') return;
      if (!Array.isArray(ifStep.then)) ifStep.then = [];
      if (!Array.isArray(ifStep.else)) ifStep.else = [];
    }

    async function visitArray(stepArray: unknown): Promise<VisitArrayResult> {
      if (!Array.isArray(stepArray)) return { ok: true };

      for (const rawStep of stepArray) {
        if (shouldStop && shouldStop()) {
          return {
            ok: false,
            err: { success: false, error: 'Stopped', stopped: true, lastStepIndex: fi - 1 }
          };
        }

        const entryPos = fi;
        const entry = flatList[entryPos];
        if (!entry) {
          return {
            ok: false,
            err: { success: false, error: 'Internal error: step preorder mismatch', stepIndex: fi }
          };
        }
        const myIdx = entry.index;
        fi = entryPos + 1;

        // Runtime variable substitution (`{{vars}}` → values). Not a
        // structural check — depends on previous-step output — so kept here.
        const resolved = resolveStepWithVariables(rawStep, variables);
        if (!resolved.ok) {
          const err = { success: false, error: `Step ${myIdx}: ${resolved.error}`, stepIndex: myIdx };
          onStepEnd(myIdx, err);
          return { ok: false, err: { success: false, error: err.error, stepIndex: myIdx } };
        }
        const step = resolved.step;
        onStepStart(myIdx, step);

        // Tiny "step is still an object after substitution" guard — variable
        // substitution can in theory return non-objects if a `{{var}}`
        // expanded to one, and we'd otherwise crash on `step.type`. Every
        // other structural check is now done by the canonical preflight.
        if (!step || typeof step !== 'object' || !step.type) {
          const err = { success: false, error: 'Invalid step object', stepIndex: myIdx };
          onStepEnd(myIdx, err);
          return { ok: false, err: { success: false, error: err.error, stepIndex: myIdx } };
        }

        let result;

        try {
          if (step.type === 'if') {
            ensureIfBranches(step);
            const ev = await evaluateIfConditionOnce(
              step.condition,
              variables,
              deviceApi as IfEvalApi,
              ifRaleCommand
            );
            if (!ev.ok) {
              result = { success: false, error: ev.error };
            } else {
              const takeThen = ev.branchThen;
              if (takeThen) {
                const sub: VisitArrayResult = await visitArray(step.then || []);
                if (!sub.ok) return sub;
                fi += preorderBlockSize(step.else || []);
              } else {
                fi += preorderBlockSize(step.then || []);
                const sub: VisitArrayResult = await visitArray(step.else || []);
                if (!sub.ok) return sub;
              }
              result = { success: true };
            }
          } else {
            switch (step.type) {
              case 'query':
                result = await deviceApi.query(step.endpoint);
                break;
              case 'post':
                result = await deviceApi.post(step.endpoint);
                break;
              case 'keypress':
                result = await deviceApi.keypress(step.key);
                break;
              case 'inputText':
                result = await deviceApi.inputText(step.text);
                break;
              case 'launch':
                result = await deviceApi.launch(step.appId, step.params || '');
                break;
              case 'sideload': {
                const pwd = resolvePassword(step);
                if (!validateDevPassword(pwd).valid) {
                  result = { success: false, error: 'Valid developer password required for sideload' };
                } else {
                  result = await deviceApi.sideload(step.filePath, pwd);
                }
                break;
              }
              case 'deleteSideload': {
                const pwd = resolvePassword(step);
                if (!validateDevPassword(pwd).valid) {
                  result = { success: false, error: 'Valid developer password required for deleteSideload' };
                } else {
                  result = await deviceApi.deleteSideload(pwd);
                }
                break;
              }
              case 'appFunction':
                if (!raleConnectionId) {
                  result = { success: false, error: 'RALE connection not established' };
                } else {
                  // Normalize a named-object `functionParams` to a positional
                  // array using the channel's declared param order. Roku's
                  // `Function ExecuteFunction(functionName, params)` reads
                  // `params[0]`, `params[1]` positionally — a named object
                  // would arrive as `params[0] = invalid` and the function
                  // would silently no-op. Mirrors the renderer executor so
                  // the same script behaves identically in Dev Studio's
                  // Builder and on the CLI / remote relay.
                  let runtimeParams: unknown = step.functionParams;
                  if (
                    runtimeParams != null &&
                    typeof runtimeParams === 'object' &&
                    !Array.isArray(runtimeParams)
                  ) {
                    try {
                      const fnList = (await deviceApi.raleCommand(
                        raleConnectionId,
                        'getExternalControlFunctions',
                        {}
                      )) as {
                        success?: boolean;
                        data?: { functions?: unknown[] };
                      };
                      // The wire shape uses `functionName`, not `name`. Always
                      // normalize before lookup; reading raw and matching `f.name`
                      // would silently never find anything (every channel would
                      // look empty). See engineering-principles.md
                      // §"normalize at the boundary".
                      const rawFns =
                        fnList && fnList.success && Array.isArray(fnList.data?.functions)
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
                      // If normalization fails (e.g. RALE temporarily
                      // unreachable), fall through with the original
                      // value; the underlying call's error will be
                      // surfaced consistently with other failure modes.
                    }
                  }
                  result = await deviceApi.raleCommand(raleConnectionId, 'executeExternalControlFunction', {
                    functionName: step.functionName,
                    functionParams: Array.isArray(runtimeParams) ? runtimeParams : []
                  });
                }
                break;
              case 'raleCommand':
                if (!raleConnectionId) {
                  result = { success: false, error: 'RALE connection not established' };
                } else {
                  result = await deviceApi.raleCommand(raleConnectionId, step.command, step.args || {});
                }
                break;
              case 'screenshot':
                result = await runScreenshotStep(step, myIdx);
                break;
              case 'wait':
                result = await runWaitStep(step);
                break;
              case 'devicePerformance':
                if (typeof onLog === 'function') {
                  onLog(
                    'Device Performance step skipped (only supported when running Action Scripts in Roku Dev Studio).'
                  );
                }
                result = {
                  success: true,
                  skipped: true,
                  skippedReason: 'Device Performance steps run only in the Roku Dev Studio app.'
                };
                break;
              default:
                result = { success: false, error: `Unhandled type ${step.type}` };
            }
          }
        } catch (e: unknown) {
          result = { success: false, error: errorMessage(e) };
        }

        const raw = rawStep as ScriptStep;
        const outName = rawStep ? getAssignToVarName(raw) : '';
        const raleBindOk =
          raw.type !== 'raleCommand' ||
          raleCommandSupportsAssignToVar(raw.command);
        if (
          outName &&
          raleBindOk &&
          (raw.type === 'appFunction' || raw.type === 'raleCommand') &&
          result &&
          (result as { success?: boolean }).success &&
          !(result as { skipped?: boolean }).skipped &&
          (result as { data?: unknown }).data !== undefined
        ) {
          variables[outName] = (result as { data: unknown }).data;
        }

        onStepEnd(myIdx, result);

        if (result && result.stopped) {
          return {
            ok: false,
            err: { success: false, error: result.error || 'Stopped', stopped: true, stepIndex: myIdx }
          };
        }
        if (result && result.success === false && result.error) {
          return { ok: false, err: { success: false, error: result.error, stepIndex: myIdx } };
        }
      }
      return { ok: true };
    }

    const final = await visitArray(steps);
    if (!final.ok) {
      return final.err;
    }

    return { success: true, steps: flatList.length };
  } finally {
    if (raleConnectionId) {
      if (relayClient) {
        await relayClient.raleDisconnect(ip, { connectionId: raleConnectionId });
      } else {
        raleDirect.raleDisconnect(raleConnectionId);
      }
    }
  }
}

/**
 * Headless validator (`rds validate-script` and the runtime preflight inside
 * `runActionScript`). Phase 0b: delegates to the canonical
 * `validate-action-script.ts` so the rules stay in lock-step with the MCP
 * agent surface and the renderer's Builder. Returns the legacy
 * `{ valid, errors: string[] }` shape so existing CLI output / callers don't
 * change; the structured per-error shape is available via
 * {@link validateScriptStructureRich}.
 */
function validateScriptStructureRich(
  script: unknown,
  options?: { raleFunctions?: ReadonlyArray<unknown> }
): {
  ok: boolean;
  errors: Array<{ path: string; code: string; message: string; expected?: string | string[]; stepIndex?: number }>;
  stepCounts: Record<string, number>;
} {
  return canonicalValidate(script, options);
}

function flattenErrorsToSentences(
  errors: Array<{ path: string; code: string; message: string; stepIndex?: number }>
): string[] {
  return errors.map((e) => {
    if (typeof e.stepIndex === 'number') {
      return `Step ${e.stepIndex}: ${e.message}`;
    }
    if (e.path) {
      return `${e.path}: ${e.message}`;
    }
    return e.message;
  });
}

function validateScriptStructure(
  script: unknown
): { valid: boolean; errors: string[] } {
  const r = validateScriptStructureRich(script);
  return { valid: r.ok, errors: flattenErrorsToSentences(r.errors) };
}

module.exports = {
  runActionScript,
  validateScriptStructure,
  validateScriptStructureRich,
  SUPPORTED_TYPES
};
