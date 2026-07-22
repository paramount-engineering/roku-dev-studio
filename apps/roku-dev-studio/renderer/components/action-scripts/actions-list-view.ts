/**
 * Shared actions list view for Builder and Executor.
 * Renders the script's steps (data model) as a list of actions (UI); mode determines columns and row actions.
 */

import {
  stepDescription,
  formatWaitStepListDetails,
  formatIfStepListDetails
} from './executor-engine.js';
import { getAssignToVarName } from './action-script-variables-client.js';
import { queryEndpointLabel } from './action-registry.js';
import { escapeHtml, setSafeHTML } from '../../modules/utils/index.js';
import { escapeAttr } from './builder-step-helpers.js';
import {
  flattenStepsPreorder,
  stepPathToDisplayId,
  stepsTreeContainsIf,
  type StepPath,
  type FlattenedStep
} from './action-script-tree.js';
import { S } from '@shared/strings/index.js';

/** Where an "Add Step" row inserts relative to the tree. */
export type BuilderAddPlacement =
  | { kind: 'root-end' }
  | { kind: 'after'; path: StepPath }
  | { kind: 'if-branch'; ifPath: StepPath; branch: 'then' | 'else' };

export type StepsListRowMeta =
  | {
      kind: 'step';
      step: object;
      index: number;
      depth: number;
      path: StepPath;
      ifBranch: 'then' | 'else' | null;
    }
  | {
      kind: 'add';
      depth: number;
      placement: BuilderAddPlacement;
      syntheticPath: StepPath;
    };

interface BuilderStepsRenderOptions {
  onDelete?: (i: number) => void;
  onReorder?: (from: number, to: number) => void;
  onCopyStep?: (i: number) => void;
  selectedIndex?: number | null;
  onSelectStep?: (i: number) => void;
  onOpenAddForm?: (placement: BuilderAddPlacement) => void;
  hasCopiedStep?: boolean;
  onPasteStep?: (placement: BuilderAddPlacement) => void;
}

interface ExecutorStepsRenderOptions {
  stepStates?: Array<'pending' | 'executing' | 'done' | 'error' | 'skipped'>;
  skippedSet?: Set<number>;
  onSkip?: (i: number) => void;
  onUnskip?: (i: number) => void;
  onReorder?: (from: number, to: number) => void;
  validationErrorIndices?: Set<number> | null;
  readOnlyList?: boolean;
}

/**
 * Innermost `if` branch containing this step (`then` / `else`), or null at root / on the `if` row itself.
 * @param {import('./action-script-tree.js').StepPath | null | undefined} path
 * @returns {'then'|'else'|null}
 */
export function ifBranchFromPath(path) {
  if (!path || path.length < 2) return null;
  for (let i = path.length - 2; i >= 0; i--) {
    const seg = path[i];
    if (seg === 'then' || seg === 'else') return seg;
  }
  return null;
}

/**
 * @param {'then'|'else'|null|undefined} branch
 * @returns {string}
 */
function branchBadgeHtml(branch) {
  if (branch === 'else') {
    return `<span class="steps-list-branch steps-list-branch--else">${S.actionScripts.branchElse}</span>`;
  }
  if (branch === 'then') {
    return `<span class="steps-list-branch steps-list-branch--then">${S.actionScripts.branchThen}</span>`;
  }
  return '';
}

/**
 * Get short details string for a step (Builder "Details" column).
 */
export function getStepDetails(step: Record<string, unknown> | null | undefined) {
  if (!step) return '';
  const av = getAssignToVarName(step);
  const outVar = av ? ` → $${av}` : '';
  if (step.type === 'wait') {
    const w = formatWaitStepListDetails(step);
    return w || step.type;
  }
  if (step.type === 'if') {
    const line = formatIfStepListDetails(step);
    return line || step.type;
  }
  if (step.type === 'systemTelnet' && step.telnetCommand) {
    return String(step.telnetCommand);
  }
  if (step.type === 'query' && step.endpoint != null && String(step.endpoint).trim() !== '') {
    return queryEndpointLabel(String(step.endpoint));
  }
  if (step.type === 'devicePerformance') {
    const chart = step.chart != null ? String(step.chart) : '';
    const lab =
      chart === 'objects'
        ? S.actionScripts.chartObjects
        : chart === 'cpu'
          ? S.actionScripts.chartCpu
          : chart === 'memory'
            ? S.actionScripts.chartMemory
            : chart === 'aboveAll'
              ? S.actionScripts.chartAboveAll
              : chart || '—';
    return step.label ? `${lab} · ${step.label}` : lab;
  }
  const condObj =
    step.condition && typeof step.condition === 'object'
      ? (step.condition as Record<string, unknown>)
      : null;
  const details = step.label || step.key || step.endpoint || step.functionName ||
    (step.type === 'raleCommand' && step.command) ||
    condObj?.check ||
    step.type;
  const base = typeof details === 'string' ? details : JSON.stringify(details);
  if ((step.type === 'appFunction' || step.type === 'raleCommand') && outVar) {
    return base + outVar;
  }
  return base;
}

export { stepDescription };

const DRAG_HANDLE_HTML = `<span class="steps-list-drag-handle" title="${S.actionScripts.dragToReorder}"><svg width="12" height="12"><use href="#icon-grip-vertical"/></svg></span>`;

/** Shared header row for both Builder and Executor (same columns, same look). */
const STEPS_LIST_HEADER_HTML = `
  <div class="steps-list-row steps-list-header">
    ${DRAG_HANDLE_HTML}
    <span class="steps-list-tree-header" aria-hidden="true"></span>
    <span class="steps-list-num">#</span>
    <span class="steps-list-type">${S.actionScripts.columnType}</span>
    <span class="steps-list-desc">${S.actionScripts.columnDetails}</span>
    <span class="steps-list-action"></span>
  </div>
`;

/** Max nesting levels drawn in the tree gutter (matches prior indent cap). */
const TREE_DEPTH_CAP = 12;

/**
 * @param {BuilderAddPlacement} placement
 * @returns {import('./action-script-tree.js').StepPath}
 */
function syntheticPathForAddPlacement(placement: BuilderAddPlacement): StepPath {
  if (placement.kind === 'if-branch') {
    return placement.ifPath.concat(placement.branch, -1);
  }
  if (placement.kind === 'after') {
    return placement.path.concat(-1);
  }
  return [];
}

/**
 * @param {StepsListRowMeta} row
 * @returns {import('./action-script-tree.js').StepPath}
 */
function metaPathForStripeRow(row: StepsListRowMeta): StepPath {
  return row.kind === 'add' ? row.syntheticPath : row.path;
}

/**
 * Paths to each ancestor `if` (outermost first): the `if` row, everything in its then branch,
 * everything in its else branch, and nested content all share these stripes.
 * @param {unknown[]} rootSteps
 * @param {import('./action-script-tree.js').StepPath} path
 * @returns {import('./action-script-tree.js').StepPath[]}
 */
function ancestorIfPathsForRow(rootSteps: unknown[], path: StepPath) {
  const out: StepPath[] = [];
  if (!Array.isArray(rootSteps) || !path || path.length === 0) return out;
  /** @type {unknown[] | null} */
  let container = rootSteps;
  let k = 0;
  while (k < path.length) {
    const seg = path[k];
    if (typeof seg !== 'number') return out;
    if (seg < 0) break;
    if (!Array.isArray(container)) return out;
    const step = container[seg];
    if (!step || typeof step !== 'object') return out;
    const prefix = path.slice(0, k + 1);
    const stepRec = step as { type?: string; then?: unknown[]; else?: unknown[] };
    if (stepRec.type === 'if') {
      out.push(prefix);
    }
    k++;
    if (k >= path.length) break;
    const branch = path[k];
    if (branch !== 'then' && branch !== 'else') break;
    k++;
    if (stepRec.type !== 'if') return out;
    const br = stepRec;
    container = branch === 'then' ? (br.then || []) : (br.else || []);
    if (k < path.length && path[k] === -1) break;
  }
  return out;
}

/**
 * @param {unknown[]} rootSteps
 * @param {import('./action-script-tree.js').StepPath} path
 * @returns {string}
 */
function renderIfStripeGutterHtml(rootSteps: unknown[], path: StepPath) {
  const ancestors = ancestorIfPathsForRow(rootSteps, path);
  const n = Math.min(ancestors.length, TREE_DEPTH_CAP);
  if (n === 0) {
    return '<span class="steps-list-tree-gutter steps-list-tree-gutter--empty" aria-hidden="true"></span>';
  }
  const parts: string[] = [];
  for (let d = 0; d < n; d++) {
    const mod = d % 8;
    parts.push(`<span class="steps-list-if-stripe steps-list-if-stripe--depth-${mod}" aria-hidden="true"></span>`);
  }
  return `<div class="steps-list-tree-gutter steps-list-if-stripes" aria-hidden="true">${parts.join('')}</div>`;
}

/**
 * Decode `data-placement` from an Add Step placeholder row (see `placementToWire`).
 * @param {string} encoded - `encodeURIComponent(JSON.stringify(...))`
 * @returns {BuilderAddPlacement}
 */
export function decodeBuilderAddPlacementAttr(encoded: string): BuilderAddPlacement {
  const o = JSON.parse(decodeURIComponent(encoded)) as {
    k?: string;
    p?: StepPath;
    i?: StepPath;
    b?: string;
  };
  if (o.k === 'r') return { kind: 'root-end' };
  if (o.k === 'a') return { kind: 'after', path: o.p ?? [] };
  return { kind: 'if-branch', ifPath: o.i ?? [], branch: o.b === 'else' ? 'else' : 'then' };
}

/**
 * @param {BuilderAddPlacement} p
 * @returns {{ k: 'r' } | { k: 'a', p: import('./action-script-tree.js').StepPath } | { k: 'b', i: import('./action-script-tree.js').StepPath, b: 'then'|'else' }}
 */
function placementToWire(p) {
  if (p.kind === 'root-end') return { k: 'r' };
  if (p.kind === 'after') return { k: 'a', p: p.path };
  return { k: 'b', i: p.ifPath, b: p.branch };
}

/**
 * @param {number} depth
 * @param {BuilderAddPlacement} p
 * @param {string} treeGutterHtml
 * @param {boolean} showPasteStep
 */
function renderAddPlaceholderRow(depth, p, treeGutterHtml, showPasteStep) {
  const enc = encodeURIComponent(JSON.stringify(placementToWire(p)));
  const branch =
    p.kind === 'if-branch' ? p.branch : null;
  const branchHtml = branch ? branchBadgeHtml(branch) : '';
  const pasteBtn = showPasteStep
    ? `<button type="button" class="btn btn-secondary steps-list-paste-step-btn" title="${S.actionScripts.pasteActionTooltip}" aria-label="${S.actionScripts.pasteActionTooltip}">${S.actionScripts.pasteStepBtn}</button>`
    : '';
  return `<div class="steps-list-row steps-list-add-placeholder-row" data-placement="${escapeAttr(enc)}">
    <span class="steps-list-drag-handle steps-list-add-placeholder-grip" aria-hidden="true"></span>
    ${treeGutterHtml}
    <span class="steps-list-num steps-list-add-placeholder-muted">—</span>
    <div class="steps-list-add-placeholder-main">
      ${branchHtml}
      <button type="button" class="btn btn-secondary steps-list-add-step-placeholder-btn">${S.actionScripts.addStep}</button>
      ${pasteBtn}
    </div>
  </div>`;
}

/**
 * @param {unknown[]} arr
 * @param {number} depth
 * @param {import('./action-script-tree.js').StepPath} pathPrefix
 * @param {BuilderAddPlacement} trailingPlacement
 * @param {{ i: number }} preorderRef
 * @param {StepsListRowMeta[]} metaOut
 * @param {number|null|undefined} selectedIndex
 */
function walkBuilderTreeMeta(
  arr: unknown[],
  depth: number,
  pathPrefix: StepPath,
  trailingPlacement: BuilderAddPlacement,
  preorderRef: { i: number },
  metaOut: StepsListRowMeta[],
  selectedIndex: number | null | undefined
) {
  const list = Array.isArray(arr) ? arr : [];
  for (let i = 0; i < list.length; i++) {
    const step = list[i];
    if (!step || typeof step !== 'object') continue;
    const path = pathPrefix.length === 0 ? [i] : pathPrefix.concat(i);
    const idx = preorderRef.i++;
    metaOut.push({
      kind: 'step',
      step,
      index: idx,
      depth,
      path,
      ifBranch: ifBranchFromPath(path)
    });
    const t = step as { type?: string; then?: unknown[]; else?: unknown[] };
    if (t.type === 'if') {
      const ifPath = path;
      walkBuilderTreeMeta(t.then || [], depth + 1, ifPath.concat('then'), { kind: 'if-branch', ifPath, branch: 'then' }, preorderRef, metaOut, selectedIndex);
      walkBuilderTreeMeta(t.else || [], depth + 1, ifPath.concat('else'), { kind: 'if-branch', ifPath, branch: 'else' }, preorderRef, metaOut, selectedIndex);
    }
  }
  metaOut.push({
    kind: 'add',
    depth,
    placement: trailingPlacement,
    syntheticPath: syntheticPathForAddPlacement(trailingPlacement)
  });
}

/**
 * Render a single action row. Shared by Builder and Executor for consistent structure.
 * @param {Object} step - Step object
 * @param {number} index - 0-based index
 * @param {{ mode: 'builder'|'executor', treeGutter: string, selectedIndex?: number|null, stepState?: string, isMarkedSkipped?: boolean, validationError?: boolean, readOnlyExecutorRow?: boolean, depth?: number, path?: import('./action-script-tree.js').StepPath, ifBranch?: 'then'|'else'|null }} opts - Mode and mode-specific options
 * @returns {string} Row HTML
 */
function renderStepRow(
  step: Record<string, unknown>,
  index: number,
  opts: {
    mode: 'builder' | 'executor';
    treeGutter: string;
    selectedIndex?: number | null;
    stepState?: string;
    isMarkedSkipped?: boolean;
    validationError?: boolean;
    readOnlyExecutorRow?: boolean;
    depth?: number;
    path?: StepPath;
    ifBranch?: 'then' | 'else' | null;
  }
) {
  const treeGutter = opts.treeGutter || '<span class="steps-list-tree-gutter steps-list-tree-gutter--empty" aria-hidden="true"></span>';
  const detailsStr = getStepDetails(step);
  const num = stepPathToDisplayId(opts.path, index);
  const typeHtml = escapeHtml(String(step.type ?? ''));
  const descHtml = escapeHtml(detailsStr);
  const branch = opts.ifBranch || null;
  const branchPrefix =
    branch === 'else' ? S.actionScripts.ariaElseBranchPrefix : branch === 'then' ? S.actionScripts.ariaThenBranchPrefix : '';

  if (opts.mode === 'builder') {
    const selectedClass = opts.selectedIndex === index ? ' steps-list-row-selected' : '';
    const ariaPressed = opts.selectedIndex === index;
    const ariaLabel = `${branchPrefix}${S.actionScripts.stepRowAria(escapeAttr(num), escapeAttr(String(step.type ?? '')), detailsStr ? escapeAttr(detailsStr) : '')}`;
    const typeCell = `<span class="steps-list-type">${branchBadgeHtml(branch)}<span class="steps-list-type-text">${typeHtml}</span></span>`;
    return `
      <div class="steps-list-row steps-list-builder-row${selectedClass}" data-index="${index}" role="button" tabindex="0" aria-pressed="${ariaPressed}" aria-label="${escapeAttr(ariaLabel)}">
        ${DRAG_HANDLE_HTML}
        ${treeGutter}
        <span class="steps-list-num">${num}</span>
        ${typeCell}
        <span class="steps-list-desc">${descHtml}</span>
        <span class="steps-list-action steps-list-action-group">
          <button type="button" class="steps-list-btn steps-list-btn-copy" data-index="${index}" title="${S.actionScripts.copyActionTooltip}" aria-label="${S.actionScripts.copyActionTooltip}"><span class="icon icon-sm"><svg><use href="#icon-copy"/></svg></span></button>
          <button type="button" class="steps-list-btn steps-list-btn-remove" data-index="${index}" title="${S.actionScripts.removeActionTooltip}" aria-label="${S.actionScripts.removeActionTooltip}"><span class="icon icon-sm"><svg><use href="#icon-trash"/></svg></span></button>
        </span>
      </div>
    `;
  }

  const state = opts.stepState || 'pending';
  const isMarkedSkipped = opts.isMarkedSkipped || false;
  const stateClass = `executor-step-${state}`;
  const readOnly = opts.readOnlyExecutorRow === true;
  const actionHtml = readOnly
    ? '<span class="steps-list-action-empty"></span>'
    : (state === 'pending' && !isMarkedSkipped)
      ? `<button type="button" class="steps-list-btn steps-list-btn-skip" data-index="${index}" title="${S.actionScripts.skipActionTooltip}" aria-label="${S.actionScripts.skipActionAria}">${S.actionScripts.skipBtn}</button>`
      : (state === 'pending' && isMarkedSkipped)
        ? `<button type="button" class="steps-list-btn steps-list-btn-unskip" data-index="${index}" title="${S.actionScripts.runActionTooltip}" aria-label="${S.actionScripts.unskipActionAria}">${S.actionScripts.unskipBtn}</button>`
        : '<span class="steps-list-action-empty"></span>';

  const validationErrClass = opts.validationError ? ' executor-step-validation-error' : '';
  const typeCell = `<span class="steps-list-type">${branchBadgeHtml(branch)}<span class="steps-list-type-text">${typeHtml}</span></span>`;

  return `<div class="steps-list-row steps-list-executor-row ${stateClass}${validationErrClass}" data-step-index="${index}" data-index="${index}">
      ${DRAG_HANDLE_HTML}
      ${treeGutter}
      <span class="steps-list-num">${num}</span>
      ${typeCell}
      <span class="steps-list-desc">${descHtml}</span>
      <span class="steps-list-action">${actionHtml}</span>
    </div>`;
}

/**
 * Wire up HTML5 drag-and-drop reorder on rows inside a container.
 * Shows an empty placeholder between rows while dragging to indicate drop position.
 * @param {HTMLElement} container
 * @param {string} rowSelector - CSS selector for draggable rows
 * @param {string} indexAttr - data attribute name holding the row index (e.g. 'index' or 'step-index')
 * @param {(fromIndex: number, toIndex: number) => void} onReorder
 */
function wireReorder(container, rowSelector, indexAttr, onReorder) {
  if (!container || typeof onReorder !== 'function') return;
  let dragSrcIndex: number | null = null;
  /** Intended drop index (where the item will go); set on dragover so drop uses it regardless of which element receives the drop. */
  let pendingDropToIndex: number | null = null;
  const placeholder = document.createElement('div');
  placeholder.className = 'steps-list-drop-placeholder';
  placeholder.setAttribute('aria-hidden', 'true');

  function removePlaceholder() {
    if (placeholder.parentNode) placeholder.remove();
  }

  function placeBefore(row) {
    if (row.parentNode !== container) return;
    if (placeholder.parentNode && placeholder.nextElementSibling === row) return;
    container.insertBefore(placeholder, row);
  }

  function placeAfter(row) {
    if (row.parentNode !== container) return;
    const next = row.nextElementSibling;
    if (placeholder.parentNode && placeholder.previousElementSibling === row) return;
    container.insertBefore(placeholder, next);
  }

  container.querySelectorAll(rowSelector).forEach(row => {
    const handle = row.querySelector('.steps-list-drag-handle');
    if (!handle) return;
    row.setAttribute('draggable', 'true');

    row.addEventListener('dragstart', (e) => {
      dragSrcIndex = parseInt(row.dataset[indexAttr], 10);
      pendingDropToIndex = null;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(dragSrcIndex));
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      container.querySelectorAll('.drag-over-above, .drag-over-below').forEach(r => r.classList.remove('drag-over-above', 'drag-over-below'));
      removePlaceholder();
      dragSrcIndex = null;
      pendingDropToIndex = null;
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const targetIndex = parseInt(row.dataset[indexAttr], 10);
      if (dragSrcIndex === null || targetIndex === dragSrcIndex) return;
      container.querySelectorAll('.drag-over-above, .drag-over-below').forEach(r => r.classList.remove('drag-over-above', 'drag-over-below'));
      if (targetIndex < dragSrcIndex) {
        row.classList.add('drag-over-above');
        pendingDropToIndex = targetIndex;
        placeBefore(row);
      } else {
        row.classList.add('drag-over-below');
        pendingDropToIndex = targetIndex + 1;
        placeAfter(row);
      }
    });
    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over-above', 'drag-over-below');
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove('drag-over-above', 'drag-over-below');
      removePlaceholder();
      const dropTargetIndex = parseInt(row.dataset[indexAttr], 10);
      const dropBackOnSelf = dropTargetIndex === dragSrcIndex;
      if (dragSrcIndex !== null && pendingDropToIndex !== null && dragSrcIndex !== pendingDropToIndex && !dropBackOnSelf) {
        onReorder(dragSrcIndex, pendingDropToIndex);
      }
      dragSrcIndex = null;
      pendingDropToIndex = null;
    });
  });

  container.addEventListener('dragover', (e) => {
    if (dragSrcIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rows = container.querySelectorAll(rowSelector);
    if (rows.length === 0) return;
    const rect = container.getBoundingClientRect();
    const bottomZoneHeight = 56;
    const inBottomZone = e.clientY >= rect.bottom - bottomZoneHeight;
    if (inBottomZone) {
      container.querySelectorAll('.drag-over-above, .drag-over-below').forEach(r => r.classList.remove('drag-over-above', 'drag-over-below'));
      const lastRow = rows[rows.length - 1];
      lastRow.classList.add('drag-over-below');
      pendingDropToIndex = rows.length;
      placeAfter(lastRow);
    }
  });
  container.addEventListener('drop', (e) => {
    e.preventDefault();
    removePlaceholder();
    container.querySelectorAll('.drag-over-above, .drag-over-below').forEach(r => r.classList.remove('drag-over-above', 'drag-over-below'));
    if (dragSrcIndex !== null && pendingDropToIndex !== null && dragSrcIndex !== pendingDropToIndex) {
      onReorder(dragSrcIndex, pendingDropToIndex);
    }
    dragSrcIndex = null;
    pendingDropToIndex = null;
  });
}

/**
 * Render Builder actions list: drag-handle, #, Type, Details, actions (copy + delete).
 * @param {HTMLElement} container
 * @param {Array} steps
 * @param {{ onDelete: (i: number) => void, onReorder?: (from: number, to: number) => void, onCopyStep?: (i: number) => void, selectedIndex?: number | null, onSelectStep?: (i: number) => void, onOpenAddForm?: (placement: BuilderAddPlacement) => void, hasCopiedStep?: boolean, onPasteStep?: (placement: BuilderAddPlacement) => void }} options
 */
export function renderBuilderSteps(
  container: HTMLElement,
  steps: unknown[] | undefined,
  options: BuilderStepsRenderOptions = {}
) {
  if (!container) return;
  const {
    onDelete,
    onReorder,
    onCopyStep,
    selectedIndex,
    onSelectStep,
    onOpenAddForm,
    hasCopiedStep = false,
    onPasteStep
  } = options;

  const rootSteps = steps || [];

  container.classList.add('steps-list-mode-builder', 'steps-list-has-rows');
  const meta: StepsListRowMeta[] = [];
  walkBuilderTreeMeta(rootSteps, 0, [], { kind: 'root-end' }, { i: 0 }, meta, selectedIndex);
  const parts = meta.map((m) => {
    const gutter = renderIfStripeGutterHtml(rootSteps, metaPathForStripeRow(m));
    if (m.kind === 'add') {
      return renderAddPlaceholderRow(m.depth, m.placement, gutter, !!hasCopiedStep);
    }
    return renderStepRow(m.step as Record<string, unknown>, m.index, {
      mode: 'builder',
      selectedIndex,
      depth: m.depth,
      path: m.path,
      ifBranch: m.ifBranch,
      treeGutter: gutter
    });
  });
  setSafeHTML(container, STEPS_LIST_HEADER_HTML + parts.join(''));

  if (typeof onSelectStep === 'function') {
    container.querySelectorAll('.steps-list-builder-row').forEach((rowEl) => {
      const row = rowEl as HTMLElement;
      const handleSelect = (e: Event) => {
        const t = e.target;
        if (t instanceof Element && t.closest('.steps-list-btn')) return;
        const idx = parseInt(row.dataset.index || '', 10);
        onSelectStep(idx);
      };
      row.addEventListener('click', handleSelect);
      row.addEventListener('dblclick', handleSelect);
      row.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const idx = parseInt(row.dataset.index || '', 10);
          onSelectStep(idx);
        }
      });
    });
  }
  if (typeof onDelete === 'function') {
    container.querySelectorAll('.steps-list-btn-remove').forEach((btnEl) => {
      const btn = btnEl as HTMLElement;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index || '', 10);
        onDelete(idx);
      });
    });
  }
  if (typeof onCopyStep === 'function') {
    container.querySelectorAll('.steps-list-btn-copy').forEach((btnEl) => {
      const btn = btnEl as HTMLElement;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index || '', 10);
        onCopyStep(idx);
      });
    });
  }
  if (typeof onOpenAddForm === 'function') {
    container.querySelectorAll('.steps-list-add-step-placeholder-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = btn.closest('.steps-list-add-placeholder-row');
        const raw = row && row.getAttribute('data-placement');
        if (!raw) return;
        try {
          onOpenAddForm(decodeBuilderAddPlacementAttr(raw));
        } catch {
          /* ignore malformed */
        }
      });
    });
  }
  if (typeof onPasteStep === 'function') {
    container.querySelectorAll('.steps-list-paste-step-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = btn.closest('.steps-list-add-placeholder-row');
        const raw = row && row.getAttribute('data-placement');
        if (!raw) return;
        try {
          onPasteStep(decodeBuilderAddPlacementAttr(raw));
        } catch {
          /* ignore malformed */
        }
      });
    });
  }
  if (typeof onReorder === 'function') {
    wireReorder(container, '.steps-list-builder-row', 'index', (from, to) => {
      onReorder(from, to);
    });
  }
}

/**
 * Render Executor actions list: drag-handle, #, Description, Skip/Unskip for pending.
 * @param {HTMLElement} container
 * @param {{ steps: Array }} script
 * @param {{
 *   stepStates: Array<'pending'|'executing'|'done'|'error'|'skipped'>,
 *   skippedSet: Set<number>,
 *   onSkip: (i: number) => void,
 *   onUnskip: (i: number) => void,
 *   onReorder?: (from: number, to: number) => void,
 *   validationErrorIndices?: Set<number>,
 *   readOnlyList?: boolean
 * }} options
 */
export function renderExecutorSteps(
  container: HTMLElement,
  script: { steps?: unknown[] } | null | undefined,
  options: ExecutorStepsRenderOptions = {}
) {
  if (!container) return;
  const steps = script && script.steps ? script.steps : [];
  const {
    stepStates = [],
    skippedSet = new Set(),
    onSkip,
    onUnskip,
    onReorder,
    validationErrorIndices = null,
    readOnlyList = false
  } = options;

  container.classList.add('steps-list-mode-executor', 'steps-list-has-rows');
  container.classList.remove('steps-list-mode-builder');

  const flat = flattenStepsPreorder(steps);

  if (flat.length === 0) {
    setSafeHTML(container, `<div class="steps-list-empty"><p class="steps-list-empty-text">${S.actionScripts.emptyNoScript}</p></div>`);
    container.classList.remove('steps-list-has-rows');
    return;
  }

  const disableReorder = stepsTreeContainsIf(steps);

  const errSet = validationErrorIndices instanceof Set ? validationErrorIndices : null;
  const rows = flat.map((e: FlattenedStep) =>
    renderStepRow(e.step as Record<string, unknown>, e.index, {
      mode: 'executor',
      stepState: stepStates[e.index],
      isMarkedSkipped: skippedSet.has(e.index),
      validationError: !!(errSet && errSet.has(e.index)),
      readOnlyExecutorRow: readOnlyList,
      depth: e.depth,
      path: e.path,
      ifBranch: ifBranchFromPath(e.path),
      treeGutter: renderIfStripeGutterHtml(steps, e.path)
    })
  );
  setSafeHTML(container, STEPS_LIST_HEADER_HTML + rows.join(''));

  if (!readOnlyList) {
    container.querySelectorAll('.steps-list-btn-skip').forEach((btnEl) => {
      const btn = btnEl as HTMLElement;
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.index || '', 10);
        onSkip && onSkip(i);
      });
    });
    container.querySelectorAll('.steps-list-btn-unskip').forEach((btnEl) => {
      const btn = btnEl as HTMLElement;
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.index || '', 10);
        onUnskip && onUnskip(i);
      });
    });
  }
  if (!disableReorder && typeof onReorder === 'function') {
    wireReorder(container, '.steps-list-row:not(.steps-list-header)', 'index', (from, to) => {
      onReorder(from, to);
    });
  }
}
