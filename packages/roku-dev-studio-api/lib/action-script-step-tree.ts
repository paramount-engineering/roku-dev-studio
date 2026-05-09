/**
 * Action Script v2 step tree: preorder indices (keep in sync with renderer `action-script-tree.js`).
 */

'use strict';

/**
 * @param {unknown[]} rootSteps
 * @returns {Array<{ step: object, depth: number, path: Array<number|string>, index: number }>}
 */
type PreorderEntry = {
  step: object;
  depth: number;
  path: Array<number | string>;
  index: number;
};

function flattenStepsPreorder(rootSteps: unknown): PreorderEntry[] {
  const out: PreorderEntry[] = [];
  let idx = 0;
  /**
   * @param {unknown[]} arr
   * @param {number} depth
   * @param {Array<number|string>} prefix
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
 * @param {unknown} step
 * @returns {number}
 */
function preorderStepSubtreeSize(step) {
  if (!step || typeof step !== 'object') return 1;
  const t = /** @type {{ type?: string, then?: unknown[], else?: unknown[] }} */ (step);
  if (t.type !== 'if') return 1;
  let n = 1;
  for (const s of t.then || []) n += preorderStepSubtreeSize(s);
  for (const s of t.else || []) n += preorderStepSubtreeSize(s);
  return n;
}

/**
 * @param {unknown[]} arr
 * @returns {number}
 */
function preorderBlockSize(arr) {
  if (!Array.isArray(arr)) return 0;
  let n = 0;
  for (const s of arr) n += preorderStepSubtreeSize(s);
  return n;
}

module.exports = {
  flattenStepsPreorder,
  preorderStepSubtreeSize,
  preorderBlockSize
};
