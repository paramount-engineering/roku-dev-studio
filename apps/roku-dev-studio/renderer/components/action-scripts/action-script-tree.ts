/**
 * Action Script v2: nested steps under `if` (then / else).
 * Preorder traversal order matches executor step indices (Skip / onStepStart).
 */

export type StepPath = (number | 'then' | 'else')[];

export type FlattenedStep = {
  step: object;
  depth: number;
  path: StepPath;
  index: number;
};

/**
 * Hierarchical step label for display: root 1-based index, then `T`/`E` + 1-based index
 * for each branch (e.g. `8`, `8T1`, `8E2`, `8T2T1`).
 * @param {StepPath | null | undefined} path - From {@link flattenStepsPreorder} (e.g. `[7]`, `[7,'then',0]`).
 * @param {number} [flatIndexFallback] - 0-based preorder index used only if `path` is missing/invalid.
 * @returns {string}
 */
export function stepPathToDisplayId(path, flatIndexFallback = 0) {
  if (!path || path.length === 0 || typeof path[0] !== 'number') {
    return String((typeof flatIndexFallback === 'number' ? flatIndexFallback : 0) + 1);
  }
  let s = String(path[0] + 1);
  for (let k = 1; k + 1 < path.length; k += 2) {
    const branch = path[k];
    const idx = path[k + 1];
    if (branch !== 'then' && branch !== 'else') return s;
    if (typeof idx !== 'number') return s;
    s += (branch === 'then' ? 'T' : 'E') + String(idx + 1);
  }
  return s;
}

/**
 * @param {{ version?: string } | null | undefined} script
 * @returns {'1'|'2'}
 */
export function getScriptVersion(script) {
  const v = script && script.version != null ? String(script.version).trim() : '';
  return v === '2' ? '2' : '1';
}

/**
 * @param {unknown[]} steps
 * @returns {boolean}
 */
export function stepsTreeContainsIf(steps) {
  if (!Array.isArray(steps)) return false;
  for (const s of steps) {
    if (!s || typeof s !== 'object') continue;
    const t = /** @type {{ type?: string, then?: unknown[], else?: unknown[] }} */ (s);
    if (t.type === 'if') {
      if (stepsTreeContainsIf(t.then || []) || stepsTreeContainsIf(t.else || [])) return true;
      return true;
    }
  }
  return false;
}

/**
 * Preorder: each step, then full `then` subtree, then full `else` subtree.
 * @param {unknown[]} rootSteps
 * @returns {Array<{ step: object, depth: number, path: StepPath, index: number }>}
 */
export function flattenStepsPreorder(rootSteps: unknown[]): FlattenedStep[] {
  const out: FlattenedStep[] = [];
  let idx = 0;
  /**
   * @param {unknown[]} arr
   * @param {number} depth
   * @param {StepPath} prefix
   */
  function walk(arr, depth, prefix) {
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < arr.length; i++) {
      const step = arr[i];
      if (!step || typeof step !== 'object') continue;
      const o = /** @type {object} */ (step);
      const path = prefix.concat(i);
      out.push({ step: o, depth, path, index: idx++ });
      if (/** @type {{ type?: string }} */ (o).type === 'if') {
        const n = /** @type {{ then?: unknown[], else?: unknown[] }} */ (o);
        walk(n.then || [], depth + 1, path.concat('then'));
        walk(n.else || [], depth + 1, path.concat('else'));
      }
    }
  }
  walk(rootSteps || [], 0, []);
  return out;
}

/**
 * @param {unknown[]} rootSteps
 * @param {StepPath} path
 * @returns {object | null}
 */
export function getStepAtPath(rootSteps: unknown[], path: StepPath): object | null {
  if (!Array.isArray(rootSteps) || !path.length) return null;
  /** @type {unknown[] | null} */
  let container: unknown[] | null = rootSteps;
  let lastObj: object | null = null;
  for (let k = 0; k < path.length; k++) {
    const seg = path[k];
    if (typeof seg === 'number') {
      if (!Array.isArray(container)) return null;
      lastObj = /** @type {object | null} */ (container[seg] && typeof container[seg] === 'object' ? container[seg] : null);
      if (k === path.length - 1) return lastObj;
    } else if (seg === 'then' || seg === 'else') {
      const last = lastObj as { type?: string } | null;
      if (!last || last.type !== 'if') return null;
      const branch = (last as { then?: unknown[]; else?: unknown[] })[seg];
      container = Array.isArray(branch) ? branch : [];
      lastObj = null;
    } else {
      return null;
    }
  }
  return lastObj;
}

/**
 * @param {unknown[]} rootSteps
 * @param {StepPath} path
 * @returns {{ parent: unknown[], index: number } | null}
 */
export function getParentArrayAndIndex(rootSteps, path) {
  if (!Array.isArray(rootSteps) || path.length < 1) return null;
  const lastIdx = path[path.length - 1];
  if (typeof lastIdx !== 'number') return null;
  if (path.length === 1) return { parent: rootSteps, index: lastIdx };
  let container = rootSteps;
  let k = 0;
  while (k < path.length - 1) {
    const seg = path[k];
    if (typeof seg !== 'number') return null;
    const el = container[seg];
    if (!el || typeof el !== 'object') return null;
    k++;
    if (k >= path.length - 1) break;
    const br = path[k];
    if (br !== 'then' && br !== 'else') return null;
    const ifEl = /** @type {{ type?: string, then?: unknown[], else?: unknown[] }} */ (el);
    if (ifEl.type !== 'if') return null;
    container = Array.isArray(ifEl[br]) ? ifEl[br] : [];
    k++;
  }
  return { parent: container, index: lastIdx };
}

/**
 * @param {unknown[]} rootSteps
 * @param {StepPath} path
 * @returns {boolean}
 */
export function removeStepAtPath(rootSteps, path) {
  const loc = getParentArrayAndIndex(rootSteps, path);
  if (!loc || loc.index < 0 || loc.index >= loc.parent.length) return false;
  loc.parent.splice(loc.index, 1);
  return true;
}

/**
 * @param {unknown[]} rootSteps
 * @param {StepPath} path
 * @param {object} newStep
 * @returns {boolean}
 */
export function replaceStepAtPath(rootSteps, path, newStep) {
  const loc = getParentArrayAndIndex(rootSteps, path);
  if (!loc || loc.index < 0 || loc.index >= loc.parent.length) return false;
  loc.parent[loc.index] = newStep;
  return true;
}

/**
 * Insert `newStep` immediately after the step at `path` (same parent array).
 * @param {unknown[]} rootSteps
 * @param {StepPath} path
 * @param {object} newStep
 * @returns {boolean}
 */
export function insertStepAfterPath(rootSteps, path, newStep) {
  const loc = getParentArrayAndIndex(rootSteps, path);
  if (!loc || loc.index < 0 || loc.index >= loc.parent.length) return false;
  loc.parent.splice(loc.index + 1, 0, newStep);
  return true;
}

/**
 * @param {object} ifStep
 */
export function ensureIfBranches(ifStep) {
  if (!ifStep || typeof ifStep !== 'object' || ifStep.type !== 'if') return;
  if (!Array.isArray(ifStep.then)) ifStep.then = [];
  if (!Array.isArray(ifStep.else)) ifStep.else = [];
}

/**
 * Append a step to `if.then` or `if.else`. `ifPath` points at the if step (e.g. [2] or [1,'then',0,'else',2]).
 * @param {unknown[]} rootSteps
 * @param {StepPath} ifPath
 * @param {'then'|'else'} branch
 * @param {object} newStep
 */
export function appendStepToIfBranch(
  rootSteps: unknown[],
  ifPath: StepPath,
  branch: 'then' | 'else',
  newStep: object
): boolean {
  const s = getStepAtPath(rootSteps, ifPath) as { type?: string; then?: unknown[]; else?: unknown[] } | null;
  if (!s || s.type !== 'if') return false;
  ensureIfBranches(s as object & { then: unknown[]; else: unknown[] });
  const arr = branch === 'else' ? s.else! : s.then!;
  arr.push(newStep);
  return true;
}

/**
 * Number of preorder indices for one step (if includes full then + else subtrees).
 * @param {unknown} step
 * @returns {number}
 */
export function preorderStepSubtreeSize(step) {
  if (!step || typeof step !== 'object') return 1;
  const t = /** @type {{ type?: string, then?: unknown[], else?: unknown[] }} */ (step);
  if (t.type !== 'if') return 1;
  let n = 1;
  for (const s of t.then || []) n += preorderStepSubtreeSize(s);
  for (const s of t.else || []) n += preorderStepSubtreeSize(s);
  return n;
}

/**
 * Total preorder size of an array of steps.
 * @param {unknown[]} arr
 * @returns {number}
 */
export function preorderBlockSize(arr) {
  if (!Array.isArray(arr)) return 0;
  let n = 0;
  for (const s of arr) n += preorderStepSubtreeSize(s);
  return n;
}
