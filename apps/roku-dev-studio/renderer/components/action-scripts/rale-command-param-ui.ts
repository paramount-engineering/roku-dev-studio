/**
 * UI-only helpers for the Action Script Builder's `raleCommand` step rows and
 * the Inspector's App Connector tab: catalog metadata + bidirectional
 * conversion between "wire args object" and "ordered textarea values".
 *
 * These helpers have **no validation logic** — validation lives in the
 * canonical `roku-dev-studio-api/lib/rale-command-args.ts` and is exposed to
 * the renderer via `window.actionScriptValidator.validateRaleCommandArgs`
 * (adapter at `./rale-command-validator.ts`). That split was the shelf item
 * "Move `validateAndNormalizeRaleCommandArgs` consumers entirely off the
 * renderer's `rale-command-args.ts`" in `engineering-principles.md`.
 */

import { RALE_BUILTIN_COMMANDS } from '../inspector/rale-builtins.js';

type BuiltinDef = (typeof RALE_BUILTIN_COMMANDS)[keyof typeof RALE_BUILTIN_COMMANDS];

/** Wire-command → builtin def, built once from the inspector catalog. */
const DEF_BY_COMMAND: Record<string, BuiltinDef> = {};
for (const def of Object.values(RALE_BUILTIN_COMMANDS)) {
  if (def && def.command) DEF_BY_COMMAND[def.command] = def;
}

export const ALLOWED_RALE_COMMANDS: string[] = Object.keys(DEF_BY_COMMAND);

export function listRaleCommandsForBuilder(): Array<{ value: string; label: string }> {
  return ALLOWED_RALE_COMMANDS.map((cmd) => ({
    value: cmd,
    label: (DEF_BY_COMMAND[cmd] && DEF_BY_COMMAND[cmd].label) || cmd
  }));
}

/** Builtin metadata for a wire command (same object as App Connector RALE dropdown). */
export function getRaleBuiltinDefForCommand(command: string): BuiltinDef | null {
  return (command && DEF_BY_COMMAND[command]) || null;
}

/**
 * Display strings per param row (order matches `builtin.params` /
 * `getParamValues`). Used by the Builder when serializing an existing
 * script's args back into textarea values.
 */
export function raleArgsToParamStrings(command: string, args: unknown): string[] {
  const a =
    args && typeof args === 'object' && !Array.isArray(args)
      ? (args as Record<string, unknown>)
      : {};
  switch (command) {
    case 'getNodeById': {
      let pathStr = '[]';
      if (a.path != null) {
        pathStr = typeof a.path === 'string' ? a.path : JSON.stringify(a.path, null, 2);
      }
      return [pathStr, a.id != null ? String(a.id) : ''];
    }
    case 'getNodeByName': {
      let pathStr = '[]';
      if (a.path != null) {
        pathStr = typeof a.path === 'string' ? a.path : JSON.stringify(a.path, null, 2);
      }
      return [pathStr, a.name != null ? String(a.name) : ''];
    }
    case 'getRegistrySections':
    case 'clearRegistry':
      return [];
    case 'addRegistrySection': {
      const sec = a.section;
      const secStr =
        sec == null ? '{}' : typeof sec === 'string' ? sec : JSON.stringify(sec, null, 2);
      return [a.name != null ? String(a.name) : '', secStr];
    }
    case 'removeRegistrySection':
      return [a.name != null ? String(a.name) : ''];
    case 'addRegistryField':
      return [
        a.sectionName != null ? String(a.sectionName) : '',
        a.key != null ? String(a.key) : '',
        a.value != null ? String(a.value) : ''
      ];
    case 'removeRegistryField':
      return [
        a.sectionName != null ? String(a.sectionName) : '',
        a.key != null ? String(a.key) : ''
      ];
    case 'editRegistryField':
      return [
        a.sectionName != null ? String(a.sectionName) : '',
        a.key != null ? String(a.key) : '',
        a.newKey != null ? String(a.newKey) : '',
        a.newValue != null ? String(a.newValue) : ''
      ];
    default:
      return [];
  }
}

/**
 * Build a wire-args object from an ordered array of textarea values (same
 * order as `raleArgsToParamStrings` / `builtin.params` /
 * `inspector/parameter-inputs.ts::getParamValues`). Used by the Builder when
 * the user edits a row and we need to serialize back into JSON.
 */
export function buildRaleArgsFromParamValues(
  command: string,
  values: unknown[]
): Record<string, unknown> {
  const v = Array.isArray(values) ? values : [];
  switch (command) {
    case 'getNodeById':
      return { path: v[0], id: v[1] };
    case 'getNodeByName':
      return { path: v[0], name: v[1] };
    case 'getRegistrySections':
    case 'clearRegistry':
      return {};
    case 'addRegistrySection':
      return { name: v[0], section: v[1] };
    case 'removeRegistrySection':
      return { name: v[0] };
    case 'addRegistryField':
      return { sectionName: v[0], key: v[1], value: v[2] };
    case 'removeRegistryField':
      return { sectionName: v[0], key: v[1] };
    case 'editRegistryField':
      return { sectionName: v[0], key: v[1], newKey: v[2], newValue: v[3] };
    default:
      return {};
  }
}
