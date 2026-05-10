/**
 * MCP server's `validate_script` adapter — delegates to the canonical
 * `roku-dev-studio-api/lib/validate-action-script` implementation
 * (Phase 0b of `.discussion-docs/unified-action-script-validation.md`).
 *
 * Why a thin wrapper instead of importing the api function directly:
 *   - Existing callers (`tools.ts`, `agent-contract.ts`) already
 *     `import { validateScript, ValidationError, ValidationResult }`
 *     from this file. Phase 0b is meant to be a behaviour-preserving
 *     re-pointing; keeping the shape lets every call site stay put.
 *   - This file is also where the `wrapValidationForAgent` ↔ rule
 *     output contract was previously documented; that contract still
 *     lives next door (`agent-contract.ts`), and the wrapper is the
 *     stable seam.
 *
 * Phase 0c deletes the per-surface validators outright and the
 * canonical implementation becomes the single source of truth.
 */

const { validateScript: validateActionScriptCanonical } = require('roku-dev-studio-api/lib/validate-action-script') as {
  validateScript: (input: unknown, options?: { raleFunctions?: ReadonlyArray<unknown> }) => {
    ok: boolean;
    errors: Array<{
      path: string;
      code: string;
      message: string;
      expected?: string | string[];
      stepIndex?: number;
    }>;
    stepCounts: Record<string, number>;
  };
};

export type ValidationError = {
  /** JSON-pointer-ish path, e.g. `steps[2].condition.operator`. */
  path: string;
  code: string;
  message: string;
  expected?: string | string[];
  /**
   * Preorder index of the offending step (mirrors the renderer's
   * Builder per-row error display). Optional — only set on per-step
   * errors, not on script-root errors like missing `steps`.
   */
  stepIndex?: number;
};

export type ValidationResult = {
  ok: boolean;
  errors: ValidationError[];
  /** Tally of step types so the agent can sanity-check its draft. */
  stepCounts: Record<string, number>;
};

/**
 * Validate an Action Script JSON document.
 *
 * Identical behaviour to the canonical
 * `roku-dev-studio-api/lib/validate-action-script::validateScript` —
 * this is just the agent-facing seam (kept so existing imports don't
 * have to change).
 */
export function validateScript(input: unknown): ValidationResult {
  return validateActionScriptCanonical(input);
}
