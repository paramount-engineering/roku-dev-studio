/**
 * Renderer-side Action Script validator (Phase 0b adapter).
 *
 * Delegates to the canonical `validate-action-script` in
 * `roku-dev-studio-api`, exposed to the renderer via the preload bridge
 * (`window.actionScriptValidator`). This file's job is *only* to translate
 * the canonical `{ ok, errors[…], stepCounts }` shape into the legacy
 * `{ valid, errors: [{ stepIndex?, message, code?, path?, expected? }] }`
 * shape the Builder UI / Executor / Import modal already consume, while
 * also surfacing the rich `code` / `path` / `expected` fields when present
 * so per-row error display can show inline hints.
 *
 * Phase 0c removes the old per-step rule code that used to live here; that
 * logic now lives in `validate-action-script.ts` next to the catalogs.
 */

type CanonicalError = {
  path: string;
  code: string;
  message: string;
  expected?: string | string[];
  stepIndex?: number;
};

type CanonicalResult = {
  ok: boolean;
  errors: CanonicalError[];
  stepCounts: Record<string, number>;
};

/** Renderer-side error shape — strict superset of the legacy `{ stepIndex?, message }`. */
export type RendererValidationError = {
  /** Preorder index of the offending step (per the renderer's flatten walk). */
  stepIndex?: number;
  /** Human-friendly message — preserved from the canonical validator. */
  message: string;
  /** Stable error code (e.g. `invalid_function_params_shape`) — for tooltip / a11y / tests. */
  code?: string;
  /** JSON-pointer-ish path (e.g. `steps[2].condition.operator`) — for inline UI hints. */
  path?: string;
  /** Allowed values when the error is enum-like (e.g. allowed keypress keys). */
  expected?: string | string[];
};

export type RendererValidationResult = {
  valid: boolean;
  errors: RendererValidationError[];
};

function getValidator():
  | ((
      input: unknown,
      options?: { raleFunctions?: ReadonlyArray<unknown> }
    ) => CanonicalResult)
  | null {
  if (typeof window === 'undefined') return null;
  const v = window.actionScriptValidator;
  if (!v || typeof v.validateScript !== 'function') return null;
  return v.validateScript.bind(v) as (
    input: unknown,
    options?: { raleFunctions?: ReadonlyArray<unknown> }
  ) => CanonicalResult;
}

function adaptError(err: CanonicalError): RendererValidationError {
  return {
    stepIndex: err.stepIndex,
    message: err.message,
    code: err.code,
    path: err.path,
    expected: err.expected
  };
}

function adaptResult(canonical: CanonicalResult): RendererValidationResult {
  return {
    valid: canonical.ok,
    errors: canonical.errors.map(adaptError)
  };
}

/**
 * Validate script JSON and steps.
 * Same return contract as before Phase 0b — additional rich fields
 * (`code`, `path`, `expected`) are appended to each error when present.
 *
 * @param script Parsed script object `{ version?, steps: [...] }`
 * @param raleFunctions Optional list from `getExternalControlFunctions` —
 *   when supplied, deepens the `appFunction` checks (function name exists,
 *   param count, missing keys for named-object form).
 */
export function validateScript(
  script: unknown,
  raleFunctions: unknown[] | null = null
): RendererValidationResult {
  const validator = getValidator();
  if (!validator) {
    // Preload bridge missing — typically only happens in unit tests run
    // outside Electron. Surface the error rather than silently passing.
    return {
      valid: false,
      errors: [
        {
          message:
            'Renderer canonical validator unavailable: preload must expose `actionScriptValidator` (see action-script-contract.md).'
        }
      ]
    };
  }
  const canonical = validator(script, raleFunctions ? { raleFunctions: raleFunctions as ReadonlyArray<unknown> } : undefined);
  return adaptResult(canonical);
}

/**
 * Loose script shape consumed by the Builder / Executor / Import modal —
 * a JSON object whose `steps` is an array. Typed as `any` here (deliberately)
 * because the renderer touches an open-ended set of fields per step type
 * (`step.filePath`, `step.functionName`, …) and tightening this type would
 * cascade into a much larger refactor than Phase 0b is meant to be.
 */
export type LooseScript = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Parse and validate script text as JSON.
 *
 * @param text Raw script text
 * @returns `{ parseError?, script?, validation? }` where `validation` is
 *   the same shape `validateScript` returns.
 */
export function parseAndValidateScript(
  text: unknown,
  raleFunctions: unknown[] | null = null
): {
  parseError?: string;
  script?: LooseScript;
  validation?: RendererValidationResult;
} {
  if (!text || typeof text !== 'string') {
    return { parseError: 'No script content' };
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return { parseError: 'Script is empty' };
  }
  let script: LooseScript;
  try {
    script = JSON.parse(trimmed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { parseError: msg || 'Invalid JSON' };
  }
  const validation = validateScript(script, raleFunctions);
  return { script, validation };
}
