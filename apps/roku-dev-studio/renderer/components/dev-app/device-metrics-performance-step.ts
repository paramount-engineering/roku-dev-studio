/**
 * Action Script "devicePerformance" step: capture the Remote tab performance quad cards
 * (same DOM as live metrics) via canvas rasterization (`modern-screenshot` / DOM → PNG),
 * without switching device inner tabs or using `capturePage` viewport crops.
 */

import {
  DEVICE_PERFORMANCE_CHART_IDS,
  type DevicePerformanceChartId
} from '../action-scripts/action-registry.js';
import type { ObjectCountRow, ProcStatParsed } from './remote-metrics-charts.js';
import { domToPng } from '../../vendor/modern-screenshot.mjs';

/** Internal only: max wall time to wait for first usable metrics sample (not shown in UI). */
const INTERNAL_FIRST_SAMPLE_WAIT_MS = 2000;

/** Target minimum raster width so PDF / saved results stay readable on small app windows. */
const MIN_PERFORMANCE_CHART_EXPORT_WIDTH_PX = 600;
/** Cap `domToPng` scale so tiny quad cards do not allocate enormous canvases; `ensureMinChartExportWidth` covers the gap. */
const MAX_DEVICE_PERFORMANCE_CAPTURE_SCALE = 4;

const SEL_CPU = 'section.remote-quad.remote-quad-cpu';
const SEL_MEM = 'section.remote-quad.remote-quad-mem';
const SEL_OBJ = 'section.remote-quad.remote-quad-objects';

type PerformanceCaptureItem = {
  sel: string;
  caption: string;
  /** When set, Count/Memory UI is synced before this capture. */
  objectsMode?: 'count' | 'memory';
  /** When set, CPU % / Process UI is synced before this capture (Process requires proc-stat available). */
  cpuMode?: 'percent' | 'process';
  /** When true, this item is silently skipped if `procStat` is unavailable on the current device. */
  skipIfNoProcStat?: boolean;
};

/**
 * Per-chart capture plan. `cpu` and `aboveAll` emit a Process page in addition to the Graph when
 * the device has produced a `<proc-stat>` block this session; the runner consults the live wrap to
 * decide and filters items with `skipIfNoProcStat: true` if proc-stat is absent.
 */
function performanceCapturePlan(chart: DevicePerformanceChartId): PerformanceCaptureItem[] {
  switch (chart) {
    case 'cpu':
      return [
        { sel: SEL_CPU, caption: 'CPU Usage (Graph)', cpuMode: 'percent' },
        {
          sel: SEL_CPU,
          caption: 'CPU Usage (Process)',
          cpuMode: 'process',
          skipIfNoProcStat: true
        }
      ];
    case 'memory':
      return [{ sel: SEL_MEM, caption: 'System Memory' }];
    case 'objects':
      return [
        { sel: SEL_OBJ, caption: 'BrightScript Objects (Count)', objectsMode: 'count' },
        { sel: SEL_OBJ, caption: 'BrightScript Objects (Memory)', objectsMode: 'memory' }
      ];
    case 'aboveAll':
      return [
        { sel: SEL_CPU, caption: 'CPU Usage (Graph)', cpuMode: 'percent' },
        {
          sel: SEL_CPU,
          caption: 'CPU Usage (Process)',
          cpuMode: 'process',
          skipIfNoProcStat: true
        },
        { sel: SEL_MEM, caption: 'System Memory' },
        { sel: SEL_OBJ, caption: 'BrightScript Objects (Count)', objectsMode: 'count' },
        { sel: SEL_OBJ, caption: 'BrightScript Objects (Memory)', objectsMode: 'memory' }
      ];
    default: {
      const _exhaustive: never = chart;
      return _exhaustive;
    }
  }
}

export function isDevicePerformanceChartId(s: string): s is DevicePerformanceChartId {
  return (DEVICE_PERFORMANCE_CHART_IDS as readonly string[]).includes(s);
}

export type MetricsRingSnapshot = {
  ringCpuUser: Array<number | null>;
  ringCpuSys: Array<number | null>;
  ringMemUsed: Array<number | null>;
  ringMemRes: Array<number | null>;
  ringMemAnon: Array<number | null>;
  ringMemShared: Array<number | null>;
  ringObjTotal: Array<number | null>;
  /** Minor / major page-fault rates derived from successive `<proc-stat>` samples. */
  ringFaultsMinorPerSec: Array<number | null>;
  ringFaultsMajorPerSec: Array<number | null>;
  ringSampleAt: Array<number | null>;
  lastObjectRows: ObjectCountRow[];
  lastObjectTotalBytes: number | null;
  lastChanperfMemUsed: number;
  lastChanperfMemLimitBytes: number | null;
  chartSessionStartMs: number | null;
  /** Latched true once chanperf has carried a `<proc-stat>` block (Roku OS 15.2+). */
  procStatSeen: boolean;
  lastProcStat: ProcStatParsed | null;
};

function snapHasChanperf(snap: MetricsRingSnapshot): boolean {
  return snap.ringCpuUser.some((v) => v != null) && snap.ringCpuSys.some((v) => v != null);
}

function snapHasObjectSignal(snap: MetricsRingSnapshot): boolean {
  if (snap.lastObjectRows.length > 0) return true;
  return snap.ringObjTotal.some((v) => v != null && v > 0);
}

function sleep(ms: number, shouldStop?: () => boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      if (shouldStop && shouldStop()) {
        resolve(false);
        return;
      }
      if (Date.now() - t0 >= ms) {
        resolve(true);
        return;
      }
      setTimeout(tick, 40);
    };
    tick();
  });
}

function getObjectsModeFromWrap(wrap: HTMLElement): 'count' | 'memory' {
  const raw = wrap.querySelector('.remote-objects-mode-btn.is-active')?.getAttribute('data-objects-mode');
  return raw === 'memory' ? 'memory' : 'count';
}

/** Match `device-metrics` click handler so `renderCharts` sees the intended mode after `forceLiveSample`. */
function setObjectsModeUi(wrap: HTMLElement, mode: 'count' | 'memory'): void {
  wrap.querySelectorAll('[data-objects-mode]').forEach((b) => {
    if (!(b instanceof HTMLElement)) return;
    const m = b.getAttribute('data-objects-mode');
    if (m !== 'count' && m !== 'memory') return;
    const active = m === mode;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function getCpuModeFromWrap(wrap: HTMLElement): 'percent' | 'process' {
  const raw = wrap.querySelector('.remote-cpu-mode-btn.is-active')?.getAttribute('data-cpu-mode');
  return raw === 'process' ? 'process' : 'percent';
}

function setCpuModeUi(wrap: HTMLElement, mode: 'percent' | 'process'): void {
  wrap.querySelectorAll('[data-cpu-mode]').forEach((b) => {
    if (!(b instanceof HTMLElement)) return;
    const m = b.getAttribute('data-cpu-mode');
    if (m !== 'percent' && m !== 'process') return;
    const active = m === mode;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

/** True when the device has produced at least one `<proc-stat>` block this session (mode-switch visible). */
function wrapHasProcStat(wrap: HTMLElement): boolean {
  const sw = wrap.querySelector('[data-cpu-mode-switch-wrap]');
  if (!(sw instanceof HTMLElement)) return false;
  return !sw.hidden;
}

async function rafTwice(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

type ScrollSnap = { el: HTMLElement; top: number; left: number };

/**
 * Capture scroll offsets for ancestors that can scroll. `scrollIntoView` (used before rasterize)
 * may move `.tab-panel`, inner panes, etc.; restoring avoids persistent “cropped header” glitches.
 */
function collectScrollSnaps(el: HTMLElement): ScrollSnap[] {
  const snaps: ScrollSnap[] = [];
  const seen = new Set<HTMLElement>();
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    if (seen.has(n)) continue;
    seen.add(n);
    if (n === document.documentElement || n === document.body) {
      snaps.push({ el: n, top: n.scrollTop, left: n.scrollLeft });
      continue;
    }
    const cs = getComputedStyle(n);
    const oy = cs.overflowY;
    const ox = cs.overflowX;
    const scrollLike =
      oy === 'auto' ||
      oy === 'scroll' ||
      oy === 'overlay' ||
      ox === 'auto' ||
      ox === 'scroll' ||
      ox === 'overlay';
    if (scrollLike || n.scrollTop !== 0 || n.scrollLeft !== 0) {
      snaps.push({ el: n, top: n.scrollTop, left: n.scrollLeft });
    }
  }
  return snaps;
}

function restoreScrollSnaps(snaps: readonly ScrollSnap[]): void {
  for (const { el, top, left } of snaps) {
    el.scrollTop = top;
    el.scrollLeft = left;
  }
}

/**
 * `domToPng` clones only the quad `section`, not the parent `.inner-tab-content`. When another
 * device inner tab is active, Remote inherits `visibility: hidden`; `copyCssStyles` inlines that
 * on every cloned node, so charts rasterize as empty unless we override after the full clone exists.
 */
function forceQuadCaptureClonePaintable(clone: Node): void {
  if (!(clone instanceof Element)) return;
  const nodes: Element[] = [clone, ...clone.querySelectorAll('*')];
  for (const node of nodes) {
    if (!('style' in node)) continue;
    const st = (node as HTMLElement | SVGElement).style;
    st.setProperty('visibility', 'visible', 'important');
  }
}

/**
 * If the PNG bitmap is narrower than `minWidth`, scale up with aspect ratio preserved (canvas).
 * Wider captures are returned unchanged. Used when `MAX_DEVICE_PERFORMANCE_CAPTURE_SCALE` still
 * leaves the bitmap under `minWidth` (very narrow cards).
 */
async function ensureMinChartExportWidth(dataUrl: string, minWidth: number): Promise<string> {
  if (minWidth <= 0) return dataUrl;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w < 1 || h < 1) {
        resolve(dataUrl);
        return;
      }
      if (w >= minWidth) {
        resolve(dataUrl);
        return;
      }
      const targetW = minWidth;
      const targetH = Math.max(1, Math.round((h * minWidth) / w));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Could not decode capture for export scaling'));
    img.src = dataUrl;
  });
}

/** Rasterize a quad `section` to PNG (off-DOM clone). */
async function captureQuadCardDomPng(getWrap: () => HTMLElement | null, selector: string): Promise<string> {
  const root = getWrap();
  if (!root) throw new Error('Remote metrics root not found.');
  const el = root.querySelector(selector);
  if (!(el instanceof HTMLElement)) throw new Error(`Performance card not found: ${selector}`);

  const scrollSnaps = collectScrollSnaps(el);
  try {
    let box = el.getBoundingClientRect();
    /* Prefer not to scroll: Action Scripts often run while Remote is inactive; scrollIntoView
       walks ancestors and can leave `.tab-panel` (or other panes) scrolled — headers then look clipped. */
    if (box.width < 4 || box.height < 4) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      await rafTwice();
      box = el.getBoundingClientRect();
    }
    if (box.width < 4 || box.height < 4) {
      throw new Error(
        'Performance card has no visible bounds. Enable “Show Device Performance” (quad layout) on the Remote tab.'
      );
    }
    const dpr =
      typeof window.devicePixelRatio === 'number' && window.devicePixelRatio > 0
        ? window.devicePixelRatio
        : 1;
    const cssW = box.width;
    const scaleNeeded = MIN_PERFORMANCE_CHART_EXPORT_WIDTH_PX / cssW;
    const scale = Math.min(
      MAX_DEVICE_PERFORMANCE_CAPTURE_SCALE,
      Math.max(dpr, scaleNeeded)
    );
    const dataUrl = await domToPng(el, {
      scale,
      backgroundColor: '#0f172a',
      onCloneNode(clone) {
        forceQuadCaptureClonePaintable(clone);
      }
    });
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      throw new Error('Chart rasterize failed (empty or invalid data URL).');
    }
    return dataUrl;
  } finally {
    restoreScrollSnaps(scrollSnaps);
    /* One more frame: domToPng can yield before layout settles. */
    requestAnimationFrame(() => restoreScrollSnaps(scrollSnaps));
  }
}

export type RunDevicePerformanceCaptureArgs = {
  chart: DevicePerformanceChartId;
  developerEnabled: boolean;
  /** Remote metrics root (quad layout must be active). */
  getWrap: () => HTMLElement | null;
  cloneLiveRings: () => MetricsRingSnapshot;
  /** Refresh chanperf + object counts and redraw quad charts (bypasses normal poll gating). */
  forceLiveSample: () => Promise<void>;
  /** When the quad is hidden (solo layout), turn on “Show Device Performance” so capture can proceed. */
  ensureDevicePerformanceQuadVisible?: () => Promise<boolean>;
  shouldStop?: () => boolean;
  onWaiting?: (show: boolean) => void;
};

export type DevicePerformanceCaptureResult = {
  success: boolean;
  error?: string;
  partial?: boolean;
  pngDataUrls?: string[];
  pngCaptions?: string[];
  textSummary?: string;
  htmlFragments?: string[];
  logNotes?: string[];
};

export async function runDevicePerformanceCaptureStep(
  args: RunDevicePerformanceCaptureArgs
): Promise<DevicePerformanceCaptureResult> {
  const {
    chart,
    developerEnabled,
    getWrap,
    cloneLiveRings,
    forceLiveSample,
    ensureDevicePerformanceQuadVisible,
    shouldStop,
    onWaiting
  } = args;
  const logNotes: string[] = [];

  if (!isDevicePerformanceChartId(chart)) {
    return { success: false, error: 'Invalid Device Performance chart type.' };
  }
  if (!developerEnabled) {
    return {
      success: false,
      error: 'Developer mode must be enabled on this device to capture performance metrics.'
    };
  }

  let wrap = getWrap();
  if (!wrap) {
    return { success: false, error: 'Remote metrics root not found for this device tab.' };
  }

  let autoEnabledQuad = false;
  if (wrap.getAttribute('data-remote-layout') !== 'quad') {
    if (typeof ensureDevicePerformanceQuadVisible !== 'function') {
      return {
        success: false,
        error:
          'Device Performance cards are hidden. On the Remote tab, turn on “Show Device Performance” (quad layout), then run this step again.'
      };
    }
    const turnedOn = await ensureDevicePerformanceQuadVisible();
    wrap = getWrap() ?? wrap;
    if (!turnedOn || wrap.getAttribute('data-remote-layout') !== 'quad') {
      return {
        success: false,
        error:
          'Could not show Device Performance automatically. On the Remote tab, turn on “Show Device Performance” (quad layout), then run this step again.'
      };
    }
    autoEnabledQuad = true;
    await rafTwice();
  }

  function satisfiedForWait(snap: MetricsRingSnapshot): boolean {
    if (chart === 'objects') return snapHasObjectSignal(snap);
    if (chart === 'cpu' || chart === 'memory') return snapHasChanperf(snap);
    return snapHasChanperf(snap) || snapHasObjectSignal(snap);
  }

  onWaiting && onWaiting(true);
  const deadline = Date.now() + INTERNAL_FIRST_SAMPLE_WAIT_MS;
  try {
    while (Date.now() < deadline) {
      if (shouldStop && shouldStop()) {
        return { success: false, error: 'Stopped' };
      }
      await forceLiveSample();
      if (satisfiedForWait(cloneLiveRings())) break;
      const slept = await sleep(120, shouldStop);
      if (!slept) {
        return { success: false, error: 'Stopped' };
      }
    }
  } finally {
    onWaiting && onWaiting(false);
  }

  const pngDataUrls: string[] = [];
  const pngCaptionList: string[] = [];
  let partial = false;

  const captureOne = async (sel: string, caption: string): Promise<boolean> => {
    try {
      const raw = await captureQuadCardDomPng(getWrap, sel);
      const scaled = await ensureMinChartExportWidth(raw, MIN_PERFORMANCE_CHART_EXPORT_WIDTH_PX);
      pngDataUrls.push(scaled);
      pngCaptionList.push(caption);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logNotes.push(msg);
      return false;
    }
  };

  const planRaw = performanceCapturePlan(chart);
  const procStatAvailable = wrapHasProcStat(wrap);
  const plan = planRaw.filter((p) => {
    if (p.skipIfNoProcStat && !procStatAvailable) {
      logNotes.push(
        `Skipped "${p.caption}" capture — device has not produced <proc-stat> yet (requires Roku OS 15.2+).`
      );
      return false;
    }
    return true;
  });
  const restoreObjectsMode = plan.some((p) => p.objectsMode != null);
  const previousObjectsMode = restoreObjectsMode ? getObjectsModeFromWrap(wrap) : null;
  const restoreCpuMode = plan.some((p) => p.cpuMode != null);
  const previousCpuMode = restoreCpuMode ? getCpuModeFromWrap(wrap) : null;

  let any = false;
  try {
    for (const item of plan) {
      if (item.objectsMode) {
        setObjectsModeUi(wrap, item.objectsMode);
        await forceLiveSample();
        await rafTwice();
      }
      if (item.cpuMode) {
        setCpuModeUi(wrap, item.cpuMode);
        await forceLiveSample();
        await rafTwice();
      }
      const ok = await captureOne(item.sel, item.caption);
      any = any || ok;
      if (!ok && chart === 'aboveAll') partial = true;
    }
  } finally {
    if (previousObjectsMode !== null) {
      setObjectsModeUi(wrap, previousObjectsMode);
      await forceLiveSample();
      await rafTwice();
    }
    if (previousCpuMode !== null) {
      setCpuModeUi(wrap, previousCpuMode);
      await forceLiveSample();
      await rafTwice();
    }
  }

  if (!any) {
    return {
      success: false,
      error:
        logNotes[0] ||
        'Could not capture Device Performance cards. Ensure the quad is visible and the window is not minimized.',
      logNotes: logNotes.length > 0 ? logNotes : undefined
    };
  }

  const pngCaptions =
    pngCaptionList.length === pngDataUrls.length && pngCaptionList.some((c) => c)
      ? pngCaptionList
      : undefined;

  return {
    success: true,
    partial: partial && any,
    pngDataUrls,
    pngCaptions,
    textSummary: autoEnabledQuad
      ? 'Show Device Performance (quad layout) was turned on automatically for this step.'
      : undefined,
    logNotes: logNotes.length > 0 ? logNotes : undefined
  };
}
