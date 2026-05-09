/**
 * Validation + normalization for `raleCommand` step args.
 *
 * Ported from `apps/.../inspector/{rale-builtins,registry-validation}.ts`
 * + `apps/.../action-scripts/rale-command-args.ts` so the canonical
 * Action Script validator (`validate-action-script.ts`) can run the
 * deep per-builtin shape check from any surface (MCP agent flow,
 * Builder, headless CLI / remote relay).
 *
 * The renderer keeps its UI-only helpers (`raleArgsToParamStrings`,
 * `buildRaleArgsFromParamValues`) — only the validation/normalization
 * is shared. See `.discussion-docs/unified-action-script-validation.md`.
 */

'use strict';

const { normalizePathArg } = require('./action-script-if-eval');

// =============================================================================
// Built-in catalog (data only — UI prefixing happens in the renderer)
// =============================================================================

type BuiltinDef = {
  command: string;
  requiresPath?: boolean;
  /** UI label only; not consulted by validation. */
  label?: string;
  description?: string;
};

const RALE_BUILTIN_COMMAND_DEFS: Record<string, BuiltinDef> = Object.freeze({
  getNodeById: { command: 'getNodeById', requiresPath: true },
  getNodeByName: { command: 'getNodeByName', requiresPath: true },
  getRegistrySections: { command: 'getRegistrySections' },
  clearRegistry: { command: 'clearRegistry' },
  addRegistrySection: { command: 'addRegistrySection' },
  removeRegistrySection: { command: 'removeRegistrySection' },
  addRegistryField: { command: 'addRegistryField' },
  removeRegistryField: { command: 'removeRegistryField' },
  editRegistryField: { command: 'editRegistryField' }
});

// =============================================================================
// Registry section value-shape check (port of inspector/registry-validation.ts)
// =============================================================================

function isBlank(s: unknown): boolean {
  return s == null || String(s).trim() === '';
}

/**
 * The Roku registry stores **string** values keyed by **non-empty** keys.
 * Anything else fails the shape check before the agent ever talks to the
 * device.
 */
function validateAddRegistrySection(name: unknown, section: unknown): string | null {
  if (isBlank(name)) return 'Section name is required.';
  if (section == null || typeof section !== 'object' || Array.isArray(section)) {
    return 'Section must be a JSON object (not an array).';
  }
  const sec = section as Record<string, unknown>;
  for (const k of Object.keys(sec)) {
    if (isBlank(k)) {
      return 'Section object keys cannot be empty or whitespace-only.';
    }
    const v = sec[k];
    if (typeof v !== 'string') {
      return `Each value must be a string (roRegistry stores strings). Key "${k}" is not a string — use quoted strings in JSON.`;
    }
  }
  return null;
}

// =============================================================================
// validateAndNormalizeRaleCommandArgs
// =============================================================================

type ValidationOk = { ok: true; args: Record<string, unknown> };
type ValidationFail = { ok: false; error: string };
type ValidationResult = ValidationOk | ValidationFail;

/**
 * Validate + normalize wire args for a built-in `raleCommand` step.
 *
 * Returns `{ ok: true, args }` with cleaned-up values (path parsed,
 * strings trimmed, empty optionals filled) so callers can hand the result
 * straight to the device. Returns `{ ok: false, error }` with a single
 * human-readable message on failure (matches the renderer's existing
 * single-line error contract).
 */
function validateAndNormalizeRaleCommandArgs(command: unknown, args: unknown): ValidationResult {
  if (typeof command !== 'string' || command.trim() === '') {
    return { ok: false, error: 'raleCommand requires non-empty command' };
  }
  const def = RALE_BUILTIN_COMMAND_DEFS[command];
  if (!def) {
    return { ok: false, error: `Unknown RALE command: "${command}"` };
  }

  const raw =
    args && typeof args === 'object' && !Array.isArray(args)
      ? (args as Record<string, unknown>)
      : {};

  if (def.requiresPath) {
    const pathNorm = normalizePathArg(raw.path);
    if (!pathNorm.ok) {
      return { ok: false, error: pathNorm.error || 'Invalid path' };
    }
    if (command === 'getNodeById') {
      const id = raw.id;
      if (id == null || String(id).trim() === '') {
        return { ok: false, error: 'getNodeById args.id is required' };
      }
      return { ok: true, args: { path: pathNorm.path, id: String(id).trim() } };
    }
    if (command === 'getNodeByName') {
      const name = raw.name;
      if (name == null || String(name).trim() === '') {
        return { ok: false, error: 'getNodeByName args.name is required' };
      }
      return { ok: true, args: { path: pathNorm.path, name: String(name).trim() } };
    }
  }

  if (command === 'getRegistrySections' || command === 'clearRegistry') {
    return { ok: true, args: {} };
  }

  if (command === 'addRegistrySection') {
    const name = raw.name;
    let section: unknown = raw.section;
    if (name == null || String(name).trim() === '') {
      return { ok: false, error: 'addRegistrySection args.name is required' };
    }
    if (section == null) {
      return { ok: false, error: 'addRegistrySection args.section is required' };
    }
    if (typeof section === 'string') {
      try {
        section = JSON.parse(section);
      } catch {
        return { ok: false, error: 'addRegistrySection args.section must be a JSON object' };
      }
    }
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      return { ok: false, error: 'addRegistrySection args.section must be an object' };
    }
    const sectionShapeErr = validateAddRegistrySection(name, section);
    if (sectionShapeErr) return { ok: false, error: sectionShapeErr };
    return {
      ok: true,
      args: {
        name: String(name).trim(),
        section: section as Record<string, string>
      }
    };
  }

  if (command === 'removeRegistrySection') {
    const name = raw.name;
    if (name == null || String(name).trim() === '') {
      return { ok: false, error: 'removeRegistrySection args.name is required' };
    }
    return { ok: true, args: { name: String(name).trim() } };
  }

  if (command === 'addRegistryField') {
    const sectionName = raw.sectionName;
    const key = raw.key;
    const value = raw.value;
    if (sectionName == null || String(sectionName).trim() === '') {
      return { ok: false, error: 'addRegistryField args.sectionName is required' };
    }
    if (key == null || String(key).trim() === '') {
      return { ok: false, error: 'addRegistryField args.key is required' };
    }
    return {
      ok: true,
      args: {
        sectionName: String(sectionName).trim(),
        key: String(key).trim(),
        value: value == null ? '' : String(value)
      }
    };
  }

  if (command === 'removeRegistryField') {
    const sectionName = raw.sectionName;
    const key = raw.key;
    if (sectionName == null || String(sectionName).trim() === '') {
      return { ok: false, error: 'removeRegistryField args.sectionName is required' };
    }
    if (key == null || String(key).trim() === '') {
      return { ok: false, error: 'removeRegistryField args.key is required' };
    }
    return {
      ok: true,
      args: { sectionName: String(sectionName).trim(), key: String(key).trim() }
    };
  }

  if (command === 'editRegistryField') {
    const sectionName = raw.sectionName;
    const key = raw.key;
    const newKey = raw.newKey;
    const newValue = raw.newValue;
    if (sectionName == null || String(sectionName).trim() === '') {
      return { ok: false, error: 'editRegistryField args.sectionName is required' };
    }
    if (key == null || String(key).trim() === '') {
      return { ok: false, error: 'editRegistryField args.key is required' };
    }
    if (newKey == null || String(newKey).trim() === '') {
      return { ok: false, error: 'editRegistryField args.newKey is required' };
    }
    return {
      ok: true,
      args: {
        sectionName: String(sectionName).trim(),
        key: String(key).trim(),
        newKey: String(newKey).trim(),
        newValue: newValue == null ? '' : String(newValue)
      }
    };
  }

  return { ok: false, error: `Unhandled RALE command: ${command}` };
}

module.exports = {
  RALE_BUILTIN_COMMAND_DEFS,
  validateAndNormalizeRaleCommandArgs,
  validateAddRegistrySection
};
