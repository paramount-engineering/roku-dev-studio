/**
 * Renderer-side adapter for the canonical `validateAndNormalizeRaleCommandArgs`
 * implementation that lives in `roku-dev-studio-api/lib/rale-command-args.ts`
 * and is exposed to the renderer through the preload bridge as
 * `window.actionScriptValidator.validateRaleCommandArgs`.
 *
 * Thin on purpose — this file exists only so consumers have a single, typed
 * import and don't each re-implement the `window` probe. All rule logic lives
 * in the api package (same implementation as the headless `rds` CLI and the
 * MCP server's `validate_script`), so a script that looks OK in the Builder
 * runs the same way everywhere. See
 * `.discussion-docs/unified-action-script-validation.md`.
 */

type ValidationOk = { ok: true; args: Record<string, unknown> };
type ValidationFail = { ok: false; error: string };
export type ValidationResult = ValidationOk | ValidationFail;

export function validateAndNormalizeRaleCommandArgs(
  command: unknown,
  args: unknown
): ValidationResult {
  const v = typeof window !== 'undefined' ? window.actionScriptValidator : undefined;
  if (!v || typeof v.validateRaleCommandArgs !== 'function') {
    return {
      ok: false,
      error:
        'Renderer canonical RALE-args validator unavailable: preload must expose `actionScriptValidator.validateRaleCommandArgs`.'
    };
  }
  return v.validateRaleCommandArgs(command, args);
}
