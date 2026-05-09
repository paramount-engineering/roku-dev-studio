/**
 * Canonical Action Script validator (Phase 0a of `unified-action-script-validation`).
 *
 * Pure-data input → structured `{ ok, errors[], stepCounts }` output, suitable
 * for every consumer:
 *
 *   - MCP server's `validate_script` tool (agent flow)
 *   - Dev Studio renderer Builder / Executor (UI)
 *   - Headless `script-runner.validateScriptStructure` (CLI / remote relay)
 *
 * In Phase 0a the file lives **alongside** the existing per-surface validators;
 * Phase 0b switches each call site to delegate to this implementation; Phase 0c
 * deletes the duplicates.
 *
 * Every error carries a JSON-pointer-ish `path`, a stable `code`, a human
 * `message`, an optional `expected` (enum-like values), and an optional
 * `stepIndex` (preorder index — preserves the renderer's per-row UI without a
 * second walk).
 */

'use strict';

// Single source of truth for catalogs — also kept in lock-step with this file
// per the "anti-drift" comment at the top of catalogs.ts.
const {
  STEP_SCHEMA,
  KEYPRESS_OPTIONS,
  WAIT_SOURCES,
  IF_SOURCES,
  MEDIA_PLAYER_STATES,
  ACTIVE_APP_IF_ATTRIBUTES,
  NODE_FIELD_OPERATOR_DEFS,
  DEVICE_PERFORMANCE_CHART_IDS,
  RALE_BUILTINS,
  SCRIPT_VERSIONS
} = require('./catalogs');

const { resolveMediaPlayerWaitExpectedState } = require('./action-script-wait-core');
const {
  validateIfConditionShape,
  normalizePathArg,
  RALE_NODE_FIELD_OPERATORS,
  OPS_NEED_VALUE
} = require('./action-script-if-eval');
const {
  validateOutputFields,
  getAssignToVarName,
  parseVariableDotPath
} = require('./action-script-variables');
const { raleCommandSupportsAssignToVar } = require('./rale-command-assign-vars');
const { validateAndNormalizeRaleCommandArgs } = require('./rale-command-args');

// =============================================================================
// Types (TS sees these via the JSDoc; CJS keeps the runtime simple)
// =============================================================================

/**
 * @typedef {{
 *   path: string,
 *   code: string,
 *   message: string,
 *   expected?: string | string[],
 *   stepIndex?: number
 * }} ValidationError
 *
 * @typedef {{
 *   ok: boolean,
 *   errors: ValidationError[],
 *   stepCounts: Record<string, number>
 * }} ValidationResult
 *
 * @typedef {{
 *   raleFunctions?: ReadonlyArray<{ name?: string; params?: ReadonlyArray<{ name?: string; type?: string }> }>
 * }} ValidationOptions
 */

// =============================================================================
// Constants derived from catalogs
// =============================================================================

const STEP_TYPE_NAMES = Object.keys(STEP_SCHEMA);
const RALE_BUILTIN_NAMES = new Set(RALE_BUILTINS.map((b: { command: string }) => b.command));
const MEDIA_PLAYER_STATE_VALUES: string[] = MEDIA_PLAYER_STATES.map((s: { value: string }) => s.value);
const ACTIVE_APP_IF_VALUES = new Set(ACTIVE_APP_IF_ATTRIBUTES.map((a: { value: string }) => a.value));
const NODE_FIELD_OPERATOR_REQUIRES_VALUE = new Map<string, boolean>(
  NODE_FIELD_OPERATOR_DEFS.map((o: { operator: string; requiresValue: boolean }) => [o.operator, !!o.requiresValue])
);

// =============================================================================
// Tiny helpers
// =============================================================================

function isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Map a Device Query `endpoint` to a dev telnet command, or null for normal
 * ECP GET. Mirrors `apps/.../action-registry.ts::queryEndpointToTelnetCommand`
 * — pure data, lives here so the headless runner doesn't need a renderer
 * import to validate scripts.
 */
function queryEndpointToTelnetCommand(endpoint: unknown): string | null {
  if (typeof endpoint !== 'string') return null;
  const e = endpoint.trim();
  if (e === '/query/plugins') return 'plugins';
  if (e === 'telnet:plugins') return 'plugins';
  if (e === 'telnet:free') return 'free';
  return null;
}

function pushError(errors: any[], err: any): void {
  errors.push(err);
}

// =============================================================================
// Per-step validators
// =============================================================================

/**
 * Validate a `wait` or `if` condition object. Same vocabulary in both contexts;
 * the source-list narrows by context.
 */
function validateCondition(
  cond: unknown,
  path: string,
  context: 'wait' | 'if',
  errors: any[],
  stepIndex: number
): void {
  if (!isObject(cond)) {
    pushError(errors, {
      path,
      code: 'condition_not_object',
      message: `${context}.condition must be an object`,
      stepIndex
    });
    return;
  }
  const sourceList = context === 'wait' ? WAIT_SOURCES : IF_SOURCES;
  const source = cond.source;
  if (typeof source !== 'string' || !(sourceList as readonly string[]).includes(source)) {
    pushError(errors, {
      path: `${path}.source`,
      code: 'invalid_condition_source',
      message: `Unknown condition source for ${context}`,
      expected: [...sourceList],
      stepIndex
    });
    return;
  }
  if (source === 'media-player') {
    const resolved = resolveMediaPlayerWaitExpectedState(cond);
    if (resolved && !MEDIA_PLAYER_STATE_VALUES.includes(resolved)) {
      pushError(errors, {
        path: `${path}.state`,
        code: 'invalid_media_state',
        message: `Unknown media-player state "${resolved}"`,
        expected: [...MEDIA_PLAYER_STATE_VALUES],
        stepIndex
      });
    }
    const okState = resolved !== '' && MEDIA_PLAYER_STATE_VALUES.includes(resolved);
    const okCheck = typeof cond.check === 'string' && cond.check.trim() !== '';
    if (!okState && !okCheck) {
      pushError(errors, {
        path,
        code: 'media_player_condition_incomplete',
        message: `media-player ${context} needs condition.state (one of: ${MEDIA_PLAYER_STATE_VALUES.join(', ')}), condition.check (string), or field "state" with operator "equals" and a valid value`,
        expected: [...MEDIA_PLAYER_STATE_VALUES],
        stepIndex
      });
    }
    return;
  }
  if (source === 'active-app') {
    if (cond.attribute != null && typeof cond.attribute === 'string' && !ACTIVE_APP_IF_VALUES.has(cond.attribute)) {
      pushError(errors, {
        path: `${path}.attribute`,
        code: 'invalid_active_app_attribute',
        message: `Unknown active-app attribute "${cond.attribute}"`,
        expected: [...ACTIVE_APP_IF_VALUES],
        stepIndex
      });
    }
    if (context === 'if') {
      // `if` source `active-app` uses the same operator/value vocabulary as
      // RALE-node-field. Defer to the shared `if`-condition validator for
      // operator/value rules; Builder uses the same path.
      const cvr = validateIfConditionShape(cond, MEDIA_PLAYER_STATE_VALUES);
      if (!cvr.ok) {
        pushError(errors, {
          path,
          code: 'invalid_if_active_app_condition',
          message: cvr.error || 'Invalid active-app if condition',
          stepIndex
        });
      }
    }
    return;
  }
  if (source === 'rale-node-field') {
    const pathNorm = normalizePathArg(cond.path);
    if (!pathNorm.ok) {
      pushError(errors, {
        path: `${path}.path`,
        code: 'invalid_path',
        message: pathNorm.error || 'rale-node-field condition requires a `path` array (use [] for root)',
        stepIndex
      });
    }
    if (typeof cond.id !== 'string' || cond.id.trim() === '') {
      pushError(errors, {
        path: `${path}.id`,
        code: 'missing_id',
        message: 'rale-node-field condition requires a non-empty `id`',
        stepIndex
      });
    }
    if (typeof cond.field !== 'string' || cond.field.trim() === '') {
      pushError(errors, {
        path: `${path}.field`,
        code: 'missing_field',
        message: 'rale-node-field condition requires a non-empty `field`',
        stepIndex
      });
    }
    const op = cond.operator;
    if (typeof op !== 'string' || !NODE_FIELD_OPERATOR_REQUIRES_VALUE.has(op)) {
      pushError(errors, {
        path: `${path}.operator`,
        code: 'invalid_operator',
        message: 'Unknown rale-node-field operator',
        expected: [...NODE_FIELD_OPERATOR_REQUIRES_VALUE.keys()],
        stepIndex
      });
    } else if (NODE_FIELD_OPERATOR_REQUIRES_VALUE.get(op) && cond.value == null) {
      pushError(errors, {
        path: `${path}.value`,
        code: 'missing_value',
        message: `Operator "${op}" requires a \`value\``,
        stepIndex
      });
    }
    return;
  }
  if (source === 'variables') {
    // `if` allows variables source; `wait` does not (filtered above by
    // sourceList). For `if`, accept either renderer-style `condition.variablePath`
    // or shorthand `condition.path`. validateIfConditionShape covers it.
    if (context === 'if') {
      const cvr = validateIfConditionShape(cond, MEDIA_PLAYER_STATE_VALUES);
      if (!cvr.ok) {
        pushError(errors, {
          path,
          code: 'invalid_variables_condition',
          message: cvr.error || 'Invalid variables if condition',
          stepIndex
        });
      }
    }
    return;
  }
}

/**
 * Validate `appFunction.functionParams` shape:
 *   - missing → required-field error (already raised by the schema check)
 *   - array → OK (canonical)
 *   - object → OK (legacy/agent named-object form; runtimes auto-rewrite to positional)
 *   - primitive (string/number/boolean) → reject
 *
 * When `raleFunctions` is supplied, also check the function name exists, the
 * arg count matches, and (for named-object form) the keys cover all declared
 * params.
 */
function validateAppFunctionParams(
  step: Record<string, unknown>,
  path: string,
  errors: any[],
  stepIndex: number,
  options: { raleFunctions?: any[] }
): void {
  const raw = step.functionParams;

  // Required: caller already raised `missing_required` for null/undefined; only
  // check shape when a value is present.
  if (raw == null) return;

  const isArr = Array.isArray(raw);
  const isObj = !isArr && isObject(raw);
  if (!isArr && !isObj) {
    pushError(errors, {
      path: `${path}.functionParams`,
      code: 'invalid_function_params_shape',
      message:
        'appFunction.functionParams must be a positional array (preferred) or an object keyed by RALE param names',
      expected: ['array', 'object'],
      stepIndex
    });
    return;
  }

  // raleFunctions opt-in: deeper checks when the caller supplied a live list.
  const raleFunctions = options.raleFunctions;
  if (!raleFunctions || !Array.isArray(raleFunctions)) return;
  const fnName = step.functionName;
  if (typeof fnName !== 'string' || fnName.trim() === '') return;
  const fn = raleFunctions.find((f: any) => f && f.name === fnName);
  if (!fn) {
    pushError(errors, {
      path: `${path}.functionName`,
      code: 'unknown_app_function',
      message: `App function "${fnName}" was not found in list_app_connector_functions for the running channel`,
      stepIndex
    });
    return;
  }
  const declared: any[] = Array.isArray(fn.params) ? fn.params : [];

  let asArray: unknown[];
  if (isArr) {
    asArray = raw as unknown[];
  } else {
    // Named-object form — normalize using declared param order.
    const o = raw as Record<string, unknown>;
    asArray = declared.map((p: any) => (p && typeof p.name === 'string' ? o[p.name] : undefined));
  }

  if (asArray.length !== declared.length) {
    pushError(errors, {
      path: `${path}.functionParams`,
      code: 'app_function_param_count_mismatch',
      message: `App function "${fnName}" expects ${declared.length} param(s), got ${asArray.length}`,
      stepIndex
    });
  }

  if (isObj) {
    const missing = declared
      .map((p: any, idx: number) => ({ name: p && p.name, hasValue: asArray[idx] !== undefined }))
      .filter((x) => !x.hasValue && typeof x.name === 'string')
      .map((x) => x.name);
    if (missing.length > 0) {
      pushError(errors, {
        path: `${path}.functionParams`,
        code: 'app_function_missing_named_params',
        message: `App function "${fnName}" missing named functionParams key(s): ${missing.join(', ')}. Prefer a positional array — see roku-dev-studio://action-script-contract.md.`,
        expected: missing as string[],
        stepIndex
      });
    }
  }
}

/**
 * Validate one step plus recurse into `if.then` / `if.else`. Tracks variable
 * roots assigned by earlier `appFunction` / `raleCommand` (read-only) steps so
 * later `if` conditions on the `variables` source can reference them.
 */
function validateStep(
  step: unknown,
  path: string,
  errors: any[],
  counts: Record<string, number>,
  state: { preorderIndex: number; assignedRoots: Set<string>; scriptVersion: string },
  options: { raleFunctions?: any[] }
): void {
  if (!isObject(step)) {
    pushError(errors, {
      path,
      code: 'step_not_object',
      message: 'Each step must be an object',
      stepIndex: state.preorderIndex
    });
    state.preorderIndex++;
    return;
  }
  const stepIndex = state.preorderIndex++;
  const type = step.type;
  if (typeof type !== 'string' || !(type in STEP_SCHEMA)) {
    pushError(errors, {
      path: `${path}.type`,
      code: 'unknown_step_type',
      message: `Unknown step type "${String(type)}"`,
      expected: STEP_TYPE_NAMES,
      stepIndex
    });
    return;
  }
  counts[type] = (counts[type] || 0) + 1;

  // Required-field check from STEP_SCHEMA. Skipped for `if.then` / `if.else`
  // because those are arrays (handled below as recursion targets).
  const schema = STEP_SCHEMA[type as keyof typeof STEP_SCHEMA] as { required: readonly string[] };
  for (const required of schema.required) {
    if (required === 'then' || required === 'else') continue;
    if (!(required in step) || step[required] == null || step[required] === '') {
      pushError(errors, {
        path: `${path}.${required}`,
        code: 'missing_required',
        message: `Step "${type}" requires \`${required}\``,
        stepIndex
      });
    }
  }

  // Reject literal step.password (mirrors the script-root devPassword rule).
  if (typeof step.password === 'string' && step.password.length > 0) {
    pushError(errors, {
      path: `${path}.password`,
      code: 'password_in_script',
      message:
        'Do not embed literal `password` in generated steps. Leave it absent — the user provides it at run time.',
      stepIndex
    });
  }

  // Per-type semantic checks.

  if (type === 'keypress') {
    if (typeof step.key === 'string' && !(KEYPRESS_OPTIONS as readonly string[]).includes(step.key)) {
      pushError(errors, {
        path: `${path}.key`,
        code: 'invalid_keypress',
        message: `Unknown ECP key "${step.key}"`,
        expected: [...(KEYPRESS_OPTIONS as readonly string[])],
        stepIndex
      });
    }
  }

  if (type === 'query') {
    const ep = typeof step.endpoint === 'string' ? step.endpoint.trim() : '';
    if (ep.startsWith('telnet:') && !queryEndpointToTelnetCommand(ep)) {
      pushError(errors, {
        path: `${path}.endpoint`,
        code: 'invalid_query_endpoint',
        message: `Invalid query endpoint "${ep}". Use telnet:plugins or telnet:free for dev telnet, or any /query/* path for ECP.`,
        stepIndex
      });
    }
  }

  if (type === 'devicePerformance') {
    if (typeof step.chart === 'string' && !(DEVICE_PERFORMANCE_CHART_IDS as readonly string[]).includes(step.chart)) {
      pushError(errors, {
        path: `${path}.chart`,
        code: 'invalid_chart_id',
        message: 'Unknown devicePerformance chart',
        expected: [...(DEVICE_PERFORMANCE_CHART_IDS as readonly string[])],
        stepIndex
      });
    }
  }

  if (type === 'raleCommand') {
    if (typeof step.command === 'string' && !RALE_BUILTIN_NAMES.has(step.command)) {
      pushError(errors, {
        path: `${path}.command`,
        code: 'unknown_rale_command',
        message: `Unknown RALE built-in "${step.command}"`,
        expected: [...RALE_BUILTIN_NAMES],
        stepIndex
      });
    } else if (typeof step.command === 'string') {
      // Deep per-builtin shape check (Phase 0c.1 — folded into the canonical
      // validator from `rale-command-args.ts`). Surfaces things like
      // `addRegistryField args.sectionName is required` to every consumer
      // (MCP, Builder, headless CLI) the same way.
      if (step.args != null && !isObject(step.args)) {
        pushError(errors, {
          path: `${path}.args`,
          code: 'rale_args_not_object',
          message: 'raleCommand.args must be an object',
          stepIndex
        });
      } else {
        const vr = validateAndNormalizeRaleCommandArgs(
          step.command,
          step.args == null ? {} : step.args
        );
        if (!vr.ok) {
          pushError(errors, {
            path: `${path}.args`,
            code: 'invalid_rale_args',
            message: vr.error || 'Invalid raleCommand args',
            stepIndex
          });
        }
      }
    } else if (step.args != null && !isObject(step.args)) {
      // Command is missing/non-string but args is also wrong — still surface
      // the args-shape error.
      pushError(errors, {
        path: `${path}.args`,
        code: 'rale_args_not_object',
        message: 'raleCommand.args must be an object',
        stepIndex
      });
    }
  }

  if (type === 'appFunction') {
    validateAppFunctionParams(step, path, errors, stepIndex, options);
  }

  if (type === 'wait') {
    if (step.condition != null) {
      validateCondition(step.condition, `${path}.condition`, 'wait', errors, stepIndex);
    }
    const hasDelay = typeof step.delayMs === 'number' && (step.delayMs as number) >= 0;
    const hasCondition = step.condition != null;
    if (!hasDelay && !hasCondition) {
      pushError(errors, {
        path,
        code: 'wait_needs_signal',
        message: 'wait requires either `delayMs` (number, fixed) or `condition` (until)',
        stepIndex
      });
    }
  }

  if (type === 'if') {
    if (state.scriptVersion !== '2') {
      pushError(errors, {
        path: `${path}.type`,
        code: 'version_required_for_if',
        message: '`if` step requires `script.version` "2"',
        expected: '2',
        stepIndex
      });
    }
    if (step.condition != null) {
      validateCondition(step.condition, `${path}.condition`, 'if', errors, stepIndex);
      // Cross-step variable cycle check: an `if` whose condition references a
      // variable root must run *after* a step that assigns that root.
      const cond = step.condition as Record<string, unknown>;
      if (cond.source === 'variables') {
        const pathStr =
          typeof cond.variablePath === 'string'
            ? cond.variablePath.trim()
            : typeof cond.path === 'string'
              ? cond.path.trim()
              : '';
        const parts = pathStr ? parseVariableDotPath(pathStr) : null;
        if (parts && parts.length > 0 && !state.assignedRoots.has(parts[0])) {
          pushError(errors, {
            path: `${path}.condition.variablePath`,
            code: 'variable_root_not_assigned',
            message: `if (variables): root "${parts[0]}" must be assigned on an earlier step (assignToVar)`,
            stepIndex
          });
        }
      }
    } else {
      pushError(errors, {
        path: `${path}.condition`,
        code: 'missing_condition',
        message: 'if requires a condition object',
        stepIndex
      });
    }
    if (!Array.isArray(step.then)) {
      pushError(errors, {
        path: `${path}.then`,
        code: 'missing_branch',
        message: 'if.then must be an array of steps',
        stepIndex
      });
    } else {
      step.then.forEach((s, i) =>
        validateStep(s, `${path}.then[${i}]`, errors, counts, state, options)
      );
    }
    if (!Array.isArray(step.else)) {
      pushError(errors, {
        path: `${path}.else`,
        code: 'missing_branch',
        message: 'if.else must be an array of steps (use [] for none)',
        stepIndex
      });
    } else {
      step.else.forEach((s, i) =>
        validateStep(s, `${path}.else[${i}]`, errors, counts, state, options)
      );
    }
    return;
  }

  // Record assignToVar after the step has been validated, so subsequent `if`
  // (variables) references can find the root. Mirrors the renderer's
  // `recordAssignIfApplicable`.
  const assignName = getAssignToVarName(step);
  if (assignName) {
    if (type === 'appFunction') {
      state.assignedRoots.add(assignName);
    } else if (type === 'raleCommand' && raleCommandSupportsAssignToVar(step.command)) {
      state.assignedRoots.add(assignName);
    }
  }
}

// =============================================================================
// Public entry point
// =============================================================================

function validateScript(input: unknown, options?: { raleFunctions?: any[] }): any {
  const errors: any[] = [];
  const counts: Record<string, number> = {};
  const opts = options || {};

  if (!isObject(input)) {
    return {
      ok: false,
      errors: [
        {
          path: '',
          code: 'script_not_object',
          message: 'Script must be a JSON object with a `steps` array'
        }
      ],
      stepCounts: counts
    };
  }

  if (input.version != null) {
    if (typeof input.version !== 'string' || !(SCRIPT_VERSIONS as readonly string[]).includes(input.version)) {
      pushError(errors, {
        path: 'version',
        code: 'invalid_version',
        message: `Script version must be one of ${(SCRIPT_VERSIONS as readonly string[]).join(', ')}`,
        expected: [...(SCRIPT_VERSIONS as readonly string[])]
      });
    }
  }

  if (!Array.isArray(input.steps)) {
    pushError(errors, {
      path: 'steps',
      code: 'missing_steps',
      message: 'Script must have a `steps` array'
    });
    return { ok: false, errors, stepCounts: counts };
  }

  // Reject literal devPassword in the JSON (per authoring rules).
  if (typeof input.devPassword === 'string' && input.devPassword.length > 0) {
    pushError(errors, {
      path: 'devPassword',
      code: 'password_in_script',
      message:
        'Do not embed devPassword in generated scripts. Leave it absent; the user provides it in Builder before running.'
    });
  }

  const scriptVersion =
    input.version != null && typeof input.version === 'string' && input.version.trim() === '2'
      ? '2'
      : '1';

  const state = {
    preorderIndex: 0,
    assignedRoots: new Set<string>(),
    scriptVersion
  };

  input.steps.forEach((s, i) => validateStep(s, `steps[${i}]`, errors, counts, state, opts));

  // Cross-step `output[]` (legacy assignToVar list) check — mirrors the
  // renderer's `validateOutputFields` behaviour. Only fires when the script
  // uses the explicit `output` array form.
  for (const oe of validateOutputFields(input)) {
    pushError(errors, {
      path: oe.stepIndex != null ? `steps[${oe.stepIndex}].assignToVar` : 'output',
      code: 'invalid_output_field',
      message: oe.message,
      stepIndex: oe.stepIndex
    });
  }

  // version "2" required when any if is present anywhere in the tree.
  if ((counts.if || 0) > 0 && input.version !== '2') {
    pushError(errors, {
      path: 'version',
      code: 'version_required_for_if',
      message: 'Scripts that contain `if` steps must declare `"version": "2"`',
      expected: '2'
    });
  }

  return { ok: errors.length === 0, errors, stepCounts: counts };
}

module.exports = {
  validateScript,
  // Re-exported for callers that want the same telnet-endpoint helper without
  // importing renderer code.
  queryEndpointToTelnetCommand
};
