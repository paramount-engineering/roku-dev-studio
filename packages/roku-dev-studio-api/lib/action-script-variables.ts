/**
 * Action Script variables: optional `assignToVar` on appFunction / raleCommand (deprecated `output` still read),
 * and {{path}} substitution in later steps (string fields and nested values; never password).
 *
 * Placeholders: {{root}} or {{root.a.0.b}} — dot-separated path from the stored value.
 * Missing root, missing path, or invalid segment syntax → empty string (silent).
 * Array indices are 0-based (JavaScript).
 */

'use strict';

const { raleCommandSupportsAssignToVar } = require('./rale-command-assign-vars');
const { errorMessage } = require('./err-util');

const OUTPUT_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
/** Inner content of {{ ... }}; validated per-segment in resolvePlaceholder */
const PLACEHOLDER_RE = /\{\{([^}]*)\}\}/g;

/** @param {unknown} name */
function isValidOutputName(name) {
  if (name == null || name === '') return true;
  const s = String(name).trim();
  if (s === '') return true;
  return OUTPUT_NAME_RE.test(s);
}

/**
 * Resolved variable name for a step (`assignToVar` preferred; else deprecated `output`).
 * @param {object} step
 * @returns {string} trimmed name or ''
 */
function getAssignToVarName(step) {
  if (!step || typeof step !== 'object') return '';
  if (step.assignToVar !== undefined && step.assignToVar !== null && String(step.assignToVar).trim() !== '') {
    return String(step.assignToVar).trim();
  }
  if (step.output !== undefined && step.output !== null && String(step.output).trim() !== '') {
    return String(step.output).trim();
  }
  return '';
}

/**
 * Dot path for `if` variables conditions (no `{{ }}`): `x` or `x.a.0.b`.
 * @param {string} pathStr
 * @returns {string[]|null}
 */
function parseVariableDotPath(pathStr) {
  if (typeof pathStr !== 'string' || !pathStr.trim()) return null;
  const parts = pathStr
    .trim()
    .split('.')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parts[0])) return null;
  for (let i = 1; i < parts.length; i++) {
    if (!/^[a-zA-Z0-9_]+$/.test(parts[i])) return null;
  }
  return parts;
}

/**
 * @param {Record<string, unknown>} variables
 * @param {string} pathStr
 * @returns {unknown}
 */
function resolveVariableDotPath(variables, pathStr) {
  const parts = parseVariableDotPath(pathStr);
  if (!parts || parts.length === 0) return undefined;
  const root = parts[0];
  if (!Object.prototype.hasOwnProperty.call(variables, root)) return undefined;
  let value = variables[root];
  if (parts.length > 1) {
    value = getBySegments(value, parts.slice(1));
  }
  return value;
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function valueToWaitStringForCompare(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * @param {object} script
 * @returns {Array<{ stepIndex: number, message: string }>}
 */
type OutputFieldError = { stepIndex: number; message: string };

function validateOutputFields(script: unknown): OutputFieldError[] {
  const errors: OutputFieldError[] = [];
  const doc = script as { steps?: unknown } | null | undefined;
  if (!doc || !Array.isArray(doc.steps)) return errors;

  const seen = new Map<string, number>();
  let preorderIndex = 0;

  /**
   * @param {unknown[]} arr
   */
  /**
   * @param {object} step
   * @param {number} i
   */
  function checkAssignToVarStep(step, i) {
    const name = getAssignToVarName(step);
    if (!name) return;
    const type = step.type;
    if (type !== 'appFunction' && type !== 'raleCommand') {
      errors.push({
        stepIndex: i,
        message: `Property "assignToVar" (or deprecated "output") is only allowed on appFunction and raleCommand (not ${type})`
      });
      return;
    }
    if (type === 'raleCommand') {
      const cmd = step.command != null ? String(step.command).trim() : '';
      if (!raleCommandSupportsAssignToVar(cmd)) {
        errors.push({
          stepIndex: i,
          message: `assignToVar is only allowed for RALE read commands (getNodeById, getNodeByName, getRegistrySections), not "${cmd || '(missing)'}"`
        });
        return;
      }
    }
    if (!isValidOutputName(name)) {
      errors.push({
        stepIndex: i,
        message: `Invalid assignToVar "${name}". Use letters, digits, underscore; start with a letter or _.`
      });
      return;
    }
    if (seen.has(name)) {
      errors.push({
        stepIndex: i,
        message: `Duplicate assignToVar "${name}" (also used at action ${(seen.get(name) ?? 0) + 1})`
      });
    } else {
      seen.set(name, i);
    }
  }

  function walk(arr) {
    if (!Array.isArray(arr)) return;
    for (const step of arr) {
      if (!step || typeof step !== 'object') continue;
      const i = preorderIndex++;
      checkAssignToVarStep(step, i);
      if (step.type === 'if') {
        walk(step.then || []);
        walk(step.else || []);
      }
    }
  }

  walk(doc.steps);
  return errors;
}

/**
 * Walk from `cur` using dot-path segments (already split and validated).
 * @param {unknown} cur
 * @param {string[]} segments
 * @returns {unknown}
 */
function getBySegments(cur, segments) {
  let v = cur;
  for (const seg of segments) {
    if (v === null || v === undefined) return undefined;
    if (Array.isArray(v)) {
      const n = Number(seg);
      if (seg !== '' && Number.isInteger(n) && String(n) === seg && n >= 0 && n < v.length) {
        v = v[n];
      } else {
        return undefined;
      }
    } else if (typeof v === 'object') {
      if (!Object.prototype.hasOwnProperty.call(v, seg)) return undefined;
      v = /** @type {Record<string, unknown>} */ (v)[seg];
    } else {
      return undefined;
    }
  }
  return v;
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function formatValueForSubst(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return '';
  }
}

/**
 * Resolve one {{ ... }} expression to a string (never throws; invalid/missing → '').
 * @param {string} inner - text inside braces
 * @param {Record<string, unknown>} variables
 */
function resolvePlaceholder(inner, variables) {
  const trimmed = String(inner).trim();
  if (!trimmed) return '';
  const parts = trimmed.split('.').map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === 0) return '';

  const root = parts[0];
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(root)) return '';
  for (let i = 1; i < parts.length; i++) {
    if (!/^[a-zA-Z0-9_]+$/.test(parts[i])) return '';
  }

  if (!Object.prototype.hasOwnProperty.call(variables, root)) return '';
  let value = variables[root];
  if (parts.length > 1) {
    value = getBySegments(value, parts.slice(1));
  }
  return formatValueForSubst(value);
}

/**
 * @param {string} s
 * @param {Record<string, unknown>} variables
 * @returns {string}
 */
function interpolateString(s, variables) {
  if (typeof s !== 'string' || s.indexOf('{{') === -1) {
    return s;
  }
  return s.replace(PLACEHOLDER_RE, (match, inner) => resolvePlaceholder(inner, variables));
}

/**
 * @param {unknown} val
 * @param {Record<string, unknown>} variables
 * @returns {{ ok: true, value: unknown }}
 */
function interpolateDeep(
  val: unknown,
  variables: Record<string, unknown>
): { ok: true; value: unknown } {
  if (typeof val === 'string') {
    return { ok: true, value: interpolateString(val, variables) };
  }
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      if (k === 'password' || k === 'devPassword' || k === 'assignToVar' || k === 'output' || k === 'variablePath') {
        out[k] = o[k];
        continue;
      }
      const r = interpolateDeep(o[k], variables);
      out[k] = r.value;
    }
    return { ok: true, value: out };
  }
  if (Array.isArray(val)) {
    const out: unknown[] = [];
    for (let i = 0; i < val.length; i++) {
      const r = interpolateDeep(val[i], variables);
      out.push(r.value);
    }
    return { ok: true, value: out };
  }
  return { ok: true, value: val };
}

/**
 * Deep-clone a step and substitute {{path}} from `variables`.
 * @param {object} step
 * @param {Record<string, unknown>} variables
 * @returns {{ ok: true, step: object } | { ok: false, error: string }}
 */
function resolveStepWithVariables(step, variables) {
  if (!step || typeof step !== 'object') {
    return { ok: true, step };
  }
  try {
    const clone = JSON.parse(JSON.stringify(step));
    const r = interpolateDeep(clone, variables);
    return { ok: true, step: /** @type {object} */ (r.value) };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e) || 'Failed to resolve variables in step' };
  }
}

module.exports = {
  isValidOutputName,
  getAssignToVarName,
  validateOutputFields,
  resolveStepWithVariables,
  raleCommandSupportsAssignToVar,
  parseVariableDotPath,
  resolveVariableDotPath,
  valueToWaitStringForCompare
};
