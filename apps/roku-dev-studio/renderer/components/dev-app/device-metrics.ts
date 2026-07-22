/**
 * Remote Section: quadrant metrics (chanperf + app-object-counts for active app).
 * Q1 Remote · Q2 Objects · Q3 CPU · Q4 Memory — Resource Monitor–style charts when possible.
 */

import { errMessage, type DevAppApi, type DevicePanelRoot } from './dev-app-types.js';
import {
  REMEMBER_DEVICE_PERFORMANCE_QUAD_PER_DEVICE,
  getDevicePerformanceQuadPref,
  setDevicePerformanceQuadPref
} from '../../modules/utils/app-user-settings.js';
import { onAppSettingsChanged } from '../../modules/utils/app-settings-change-bus.js';
import { showToast } from '../../modules/utils/ui.js';
import {
  DEVICE_METRICS_SAMPLE_INTERVAL_MS,
  DEVICE_METRICS_CHART_HISTORY_MS,
  QUERY_ENDPOINTS
} from '../../modules/utils/constants.js';
import {
  parseChanperfFull,
  parseObjectCountsBreakdown,
  parseActiveAppId,
  extractChanperfFailureMessage,
  drawTimeseriesChart,
  drawSparklineTimeseries,
  memChartYAxisMaxBytes,
  type ObjectCountRow,
  type ProcStatParsed
} from './remote-metrics-charts.js';
import type { DevicePerformanceChartId } from '../action-scripts/action-registry.js';
import {
  runDevicePerformanceCaptureStep,
  isDevicePerformanceChartId,
  type MetricsRingSnapshot
} from './device-metrics-performance-step.js';
import { pollDevAppForegroundAfterLaunch } from './dev-app-foreground-sync.js';
import { rendererWarn } from '../../modules/utils/logger.js';
import { S } from '@shared/strings/index.js';

/** When active-app has no id, still query sideloaded dev package (often zero if another app is foreground). */
const OBJECT_COUNTS_FALLBACK_APP_ID = 'dev';
const JITTER_MIN = 200;
const JITTER_MAX = 400;

/** Matches Settings → Device Performance minimum chart history (5 min); x-axis is never narrower. */
const MIN_CHART_DISPLAY_HISTORY_MS = 300_000;

const COL_CPU_TOTAL = '#f87171';
const COL_CPU_USER = '#60a5fa';
const COL_CPU_SYS = '#4ade80';
const COL_MEM_USED = '#f87171';
const COL_MEM_RES = '#60a5fa';
const COL_MEM_ANON = '#c084fc';
const COL_MEM_SHARED = '#fb923c';
const COL_FAULTS_MINOR = '#60a5fa';
const COL_FAULTS_MAJOR = '#f87171';

type CpuMode = 'percent' | 'process';

/** Linux process-state letter → dot color class (see `proc_pid_stat(5)`). */
function stateToClass(state: string): 'green' | 'amber' | 'red' | 'neutral' {
  switch (state) {
    case 'R':
      return 'green';
    case 'S':
    case 'I':
      return 'neutral';
    case 't':
      return 'amber';
    case 'D':
    case 'T':
    case 'Z':
    case 'X':
      return 'red';
    default:
      return 'neutral';
  }
}

/** Linux process-state letter → friendly label. */
function stateToLabel(state: string): string {
  switch (state) {
    case 'R': return S.devApp.stateRunning;
    case 'S': return S.devApp.stateSleeping;
    case 'I': return S.devApp.stateIdle;
    case 't': return S.devApp.stateTracingStop;
    case 'D': return S.devApp.stateDiskWait;
    case 'T': return S.devApp.stateStopped;
    case 'Z': return S.devApp.stateZombie;
    case 'X': return S.devApp.stateDead;
    default: return state || '?';
  }
}

function formatSecondsCompact(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0 s';
  if (seconds < 1) return `${seconds.toFixed(2)} s`;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m} m ${s.toString().padStart(2, '0')} s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h} h ${mm.toString().padStart(2, '0')} m`;
}

function formatRate(perSec: number): string {
  if (!Number.isFinite(perSec) || perSec <= 0) return '0 / s';
  if (perSec >= 1000) return `${(perSec / 1000).toFixed(1)}k / s`;
  if (perSec >= 10) return `${perSec.toFixed(0)} / s`;
  return `${perSec.toFixed(1)} / s`;
}
const OBJ_BAR_COLORS = [
  '#f87171',
  '#60a5fa',
  '#4ade80',
  '#c084fc',
  '#fb923c',
  '#2dd4bf',
  '#f472b6',
  '#94a3b8',
  '#e5e7eb'
];

function jitterMs(): number {
  return JITTER_MIN + Math.floor(Math.random() * (JITTER_MAX - JITTER_MIN + 1));
}

/** Ring slots ≈ chart history time ÷ sampling rate (clamped for memory). */
function ringSlotCount(): number {
  const rawIv = DEVICE_METRICS_SAMPLE_INTERVAL_MS;
  const interval =
    typeof rawIv === 'number' && Number.isFinite(rawIv) && rawIv > 0
      ? Math.max(500, rawIv)
      : 2000;
  const rawSpan = DEVICE_METRICS_CHART_HISTORY_MS;
  const span =
    typeof rawSpan === 'number' && Number.isFinite(rawSpan) && rawSpan > 0 ? rawSpan : 300_000;
  const n = Math.ceil(span / interval);
  if (!Number.isFinite(n)) return 150;
  return Math.min(7200, Math.max(10, n));
}

/**
 * Last non-null value in a ring, scanning from the end. Replaces the hot-path
 * `[...ring].reverse().find(...)` which copied the whole ring (up to 7200 slots) and
 * reversed it on every metrics frame, several times per frame.
 */
function lastNonNull(ring: Array<number | null>): number | null {
  for (let i = ring.length - 1; i >= 0; i--) {
    const v = ring[i];
    if (v != null) return v;
  }
  return null;
}

/**
 * Max finite value across one or more rings. Replaces `Math.max(0, ...[...a,...b].filter(...))`
 * which both allocated a merged+filtered array and spread up to ~28k elements into a variadic
 * call (a stack-overflow risk at large history) on every frame.
 */
function maxFiniteAcross(...rings: Array<Array<number | null>>): number {
  let max = 0;
  for (const ring of rings) {
    for (const v of ring) {
      if (v != null && Number.isFinite(v) && v > max) max = v;
    }
  }
  return max;
}

function makeRing(len: number): Array<number | null> {
  return Array.from({ length: len }, () => null);
}

function resizeRingPreserve(old: Array<number | null>, newLen: number): Array<number | null> {
  const next = makeRing(newLen);
  const take = Math.min(old.length, newLen);
  const srcStart = old.length - take;
  const dstStart = newLen - take;
  for (let i = 0; i < take; i++) {
    next[dstStart + i] = old[srcStart + i];
  }
  return next;
}

function pushRing(ring: Array<number | null>, value: number | null): void {
  ring.shift();
  ring.push(value);
}

/**
 * Visible time span for CPU / memory / object charts: at least {@link MIN_CHART_DISPLAY_HISTORY_MS}
 * (full width on the axis even when data is sparse), at most `configuredHistoryMs`. When configured
 * is greater than the minimum, the span grows with wall time since `chartSessionStartMs` until it
 * reaches the configured cap.
 *
 * When `chartSessionStartMs` is null, we must not use `nowMs` as a synthetic start: that would make
 * elapsed 0 on every frame and freeze the x-axis at the 5‑minute floor. Use the full configured span
 * until a real session anchor exists.
 */
function effectiveChartDisplayHistoryMs(
  configuredHistoryMs: number,
  chartSessionStartMs: number | null,
  nowMs: number
): number {
  const cfg =
    typeof configuredHistoryMs === 'number' &&
    Number.isFinite(configuredHistoryMs) &&
    configuredHistoryMs > 0
      ? configuredHistoryMs
      : MIN_CHART_DISPLAY_HISTORY_MS;
  if (chartSessionStartMs == null) {
    return Math.max(MIN_CHART_DISPLAY_HISTORY_MS, cfg);
  }
  const elapsed = Math.max(0, nowMs - chartSessionStartMs);
  return Math.min(cfg, Math.max(MIN_CHART_DISPLAY_HISTORY_MS, elapsed));
}

/** @deprecated Use parseChanperfFull; kept for callers/tests. */
export function parseChanperfXml(xml: string): { cpu: number; memBytes: number } | null {
  const f = parseChanperfFull(xml);
  if (!f) return null;
  return { cpu: Math.min(100, f.cpuUser + f.cpuSys), memBytes: f.memUsed };
}

export function parseObjectCountsTotal(xml: string): number | null {
  const b = parseObjectCountsBreakdown(xml);
  return b.total > 0 ? b.total : null;
}

function setLegendMetric(
  wrap: HTMLElement,
  legendSelector: string,
  series: string,
  text: string
): void {
  const host = wrap.querySelector(legendSelector);
  if (!(host instanceof HTMLElement)) return;
  const cell = host.querySelector(`.remote-legend-row[data-series="${series}"] .remote-legend-val`);
  if (cell) cell.textContent = text;
}

function fmtMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 100 ? `${mb.toFixed(0)} MB` : `${mb.toFixed(1)} MB`;
}

type ObjectsMode = 'count' | 'memory';

function niceAxisMax(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 1;
  const raw = n * 1.06;
  const exp = Math.floor(Math.log10(raw));
  const mant = raw / 10 ** exp;
  const nice = mant <= 1 ? 1 : mant <= 2 ? 2 : mant <= 5 ? 5 : 10;
  return nice * 10 ** exp;
}

/** Cell text for Memory mode (bytes). */
function fmtMemCell(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 100) return `${mb.toFixed(0)} MB`;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  if (kb >= 1) return `${kb.toFixed(1)} KB`;
  return `${Math.round(bytes)} B`;
}

function formatAxisTick(val: number, memory: boolean): string {
  if (!memory) return Math.round(val).toLocaleString();
  const mb = val / (1024 * 1024);
  if (mb >= 1 || val >= 512 * 1024) return mb >= 10 ? `${mb.toFixed(0)}M` : `${mb.toFixed(1)}M`;
  const kb = val / 1024;
  return `${kb.toFixed(0)}K`;
}

function rowMetricValue(
  row: ObjectCountRow,
  mode: ObjectsMode,
  totalCount: number,
  totalBytes: number | null,
  channelMemBytes: number
): number {
  if (mode === 'count') return row.count;
  if (typeof row.bytes === 'number' && row.bytes > 0) return row.bytes;
  const base = totalBytes != null && totalBytes > 0 ? totalBytes : channelMemBytes;
  if (totalCount <= 0 || base <= 0) return 0;
  return (row.count / totalCount) * base;
}

function totalMetricValue(
  mode: ObjectsMode,
  totalCount: number,
  totalBytes: number | null,
  channelMemBytes: number,
  rows: ObjectCountRow[]
): number {
  if (mode === 'count') return Math.max(0, totalCount);
  if (totalBytes != null && totalBytes > 0) return totalBytes;
  const sumRowBytes = rows.reduce((s, r) => s + (typeof r.bytes === 'number' ? r.bytes : 0), 0);
  if (sumRowBytes > 0) return sumRowBytes;
  return Math.max(0, channelMemBytes);
}

/** Last-rendered data signature per resource-monitor element, so an unchanged tick can
 *  skip the full `innerHTML=''` + re-sort + createElement rebuild. */
const objectsRmSignatures = new WeakMap<HTMLElement, string>();

function renderObjectsResourceMonitor(
  rm: HTMLElement,
  footerEl: HTMLElement | null,
  memHint: HTMLElement | null,
  rows: ObjectCountRow[],
  totalCount: number,
  totalBytes: number | null,
  channelMemBytes: number,
  mode: ObjectsMode
): void {
  // Skip the (expensive) rebuild when nothing that affects the rendered output changed.
  // The "Updated:" label is intentionally part of this — it reflects when the data last
  // changed, not wall-clock ticks. Signature is cheap (O(rows), rows are few dozen).
  let sig = `${mode}|${totalCount}|${totalBytes}|${channelMemBytes}`;
  for (const r of rows) sig += `|${r.label}:${r.count}:${r.bytes ?? ''}`;
  if (objectsRmSignatures.get(rm) === sig) return;
  objectsRmSignatures.set(rm, sig);

  const now = new Date();
  const timeStr = S.devApp.updatedAt(now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }));

  const hasDevTotalBytes = totalBytes != null && totalBytes > 0;
  const hasRowBytes = rows.some((r) => typeof r.bytes === 'number' && r.bytes > 0);
  if (memHint) {
    if (mode === 'memory' && !hasDevTotalBytes && !hasRowBytes && channelMemBytes > 0 && totalCount > 0) {
      memHint.hidden = false;
      memHint.textContent = S.devApp.memoryEstimatedHint;
    } else {
      memHint.hidden = true;
      memHint.textContent = '';
    }
  }

  const memory = mode === 'memory';
  const totalVal = totalMetricValue(mode, totalCount, totalBytes, channelMemBytes, rows);
  const metric = (r: ObjectCountRow) =>
    rowMetricValue(r, mode, totalCount, totalBytes, channelMemBytes);
  const displayRows = [...rows].sort((a, b) => {
    const d = metric(b) - metric(a);
    if (d !== 0) return d;
    return a.label.localeCompare(b.label);
  });
  const rowVals = displayRows.map((r) => metric(r));
  const maxVal = niceAxisMax(Math.max(1, totalVal, ...rowVals));

  rm.innerHTML = '';
  if (footerEl) footerEl.innerHTML = '';
  const rowsEl = document.createElement('div');
  rowsEl.className = 'remote-objects-rm-rows';

  displayRows.forEach((r, i) => {
    const v = rowVals[i] ?? 0;
    const pct = maxVal > 0 ? Math.min(100, (100 * v) / maxVal) : 0;
    const color = OBJ_BAR_COLORS[i % OBJ_BAR_COLORS.length];
    const valStr = memory ? fmtMemCell(v) : r.count.toLocaleString();

    const row = document.createElement('div');
    row.className = 'remote-objects-rm-row';

    const idx = document.createElement('span');
    idx.className = 'remote-objects-rm-idx';
    idx.textContent = String(i + 1);

    const lab = document.createElement('div');
    lab.className = 'remote-objects-rm-label';
    const name = document.createElement('span');
    name.className = 'remote-objects-rm-name';
    name.style.color = color;
    name.title = r.label;
    name.textContent = r.label;
    const valSpan = document.createElement('span');
    valSpan.className = 'remote-objects-rm-val';
    valSpan.style.color = color;
    valSpan.textContent = valStr;
    lab.appendChild(name);
    lab.appendChild(valSpan);

    const track = document.createElement('div');
    track.className = 'remote-objects-rm-track';
    const fill = document.createElement('div');
    fill.className = 'remote-objects-rm-fill';
    fill.style.background = color;
    fill.style.width = `${pct}%`;
    track.appendChild(fill);

    row.appendChild(idx);
    row.appendChild(lab);
    row.appendChild(track);
    rowsEl.appendChild(row);
  });

  const totalPct = maxVal > 0 ? Math.min(100, (100 * totalVal) / maxVal) : 0;
  const totalStr = memory ? fmtMemCell(totalVal) : totalCount.toLocaleString();

  const totalRow = document.createElement('div');
  totalRow.className = 'remote-objects-rm-row remote-objects-rm-row--total';
  const tIdx = document.createElement('span');
  tIdx.className = 'remote-objects-rm-idx';
  tIdx.textContent = '';
  const tLab = document.createElement('div');
  tLab.className = 'remote-objects-rm-label';
  const tName = document.createElement('span');
  tName.className = 'remote-objects-rm-name';
  tName.textContent = S.devApp.totalBrightScriptObjects;
  const tVal = document.createElement('span');
  tVal.className = 'remote-objects-rm-val';
  tVal.textContent = totalStr;
  tLab.appendChild(tName);
  tLab.appendChild(tVal);
  const tTrack = document.createElement('div');
  tTrack.className = 'remote-objects-rm-track';
  const tFill = document.createElement('div');
  tFill.className = 'remote-objects-rm-fill';
  tFill.style.width = `${totalPct}%`;
  tTrack.appendChild(tFill);
  totalRow.appendChild(tIdx);
  totalRow.appendChild(tLab);
  totalRow.appendChild(tTrack);
  rowsEl.appendChild(totalRow);

  rm.appendChild(rowsEl);

  if (footerEl) {
    const grid = document.createElement('div');
    grid.className = 'remote-objects-footer-grid';
    const idxSp = document.createElement('span');
    idxSp.className = 'remote-objects-rm-idx';
    idxSp.setAttribute('aria-hidden', 'true');
    const timeSp = document.createElement('span');
    timeSp.className = 'remote-objects-timecode';
    timeSp.setAttribute('data-objects-time', '');
    timeSp.textContent = timeStr;
    const ticks = document.createElement('div');
    ticks.className = 'remote-objects-rm-axis-ticks';
    const tickN = 6;
    for (let i = 0; i < tickN; i++) {
      const span = document.createElement('span');
      const t = (maxVal * i) / (tickN - 1);
      span.textContent = formatAxisTick(t, memory);
      ticks.appendChild(span);
    }
    grid.appendChild(idxSp);
    grid.appendChild(timeSp);
    grid.appendChild(ticks);
    footerEl.appendChild(grid);
  }
}

/** Per-device Remote Section: developer mode + stable storage key (serial, else `ip:…`). */
export type RemoteTabMetricsContext = {
  developerEnabled: boolean;
  deviceKey: string;
};

/**
 * Wire chanperf / object-count polling to the Remote Section quadrant layout (`.remote-tab-metrics-root`).
 */
export function setupRemoteTabMetrics(
  panel: DevicePanelRoot,
  api: DevAppApi,
  ctx: RemoteTabMetricsContext
): void {
  const wrapRaw = panel.querySelector('.remote-tab-metrics-root');
  if (!(wrapRaw instanceof HTMLElement)) return;
  const wrap: HTMLElement = wrapRaw;
  const { developerEnabled, deviceKey } = ctx;

  const cpuSvg = wrap.querySelector('svg[data-chart="cpu"]');
  const memSvg = wrap.querySelector('svg[data-chart="mem"]');
  const objTotalSvg = wrap.querySelector('svg[data-chart="objects-total"]');
  const objRm = wrap.querySelector('[data-objects-rm]');
  const objFooterRaw = wrap.querySelector('[data-objects-footer]');
  const objMemHint = wrap.querySelector('[data-objects-mem-hint]');
  const objFallbackWrap = wrap.querySelector('[data-objects-fallback-wrap]');

  if (!(cpuSvg instanceof SVGSVGElement)) {
    rendererWarn('[Remote metrics] Chart template elements missing');
    return;
  }
  if (!(memSvg instanceof SVGSVGElement)) {
    rendererWarn('[Remote metrics] Chart template elements missing');
    return;
  }
  if (!(objTotalSvg instanceof SVGSVGElement)) {
    rendererWarn('[Remote metrics] Chart template elements missing');
    return;
  }
  if (!(objRm instanceof HTMLElement)) {
    rendererWarn('[Remote metrics] Object chart template missing');
    return;
  }
  if (!(objFallbackWrap instanceof HTMLElement)) {
    rendererWarn('[Remote metrics] Chart template elements missing');
    return;
  }

  const chartCpu = cpuSvg;
  const chartMem = memSvg;
  const chartObjTotal = objTotalSvg;
  const elObjRm = objRm;
  const elObjFooter = objFooterRaw instanceof HTMLElement ? objFooterRaw : null;
  const elObjMemHint = objMemHint instanceof HTMLElement ? objMemHint : null;
  const elObjFallback = objFallbackWrap;

  let ringCpuUser = makeRing(ringSlotCount());
  let ringCpuSys = makeRing(ringSlotCount());
  let ringMemUsed = makeRing(ringSlotCount());
  let ringMemRes = makeRing(ringSlotCount());
  let ringMemAnon = makeRing(ringSlotCount());
  let ringMemShared = makeRing(ringSlotCount());
  let ringObjTotal = makeRing(ringSlotCount());
  /** Roku OS 15.2+ proc-stat-derived rates (faults per second between samples). */
  let ringFaultsMinorPerSec = makeRing(ringSlotCount());
  let ringFaultsMajorPerSec = makeRing(ringSlotCount());
  /** Wall ms aligned with each chanperf tick (same length as metric rings). */
  let ringSampleAt = makeRing(ringSlotCount());

  function rebuildMetricRings(): void {
    const n = ringSlotCount();
    ringCpuUser = resizeRingPreserve(ringCpuUser, n);
    ringCpuSys = resizeRingPreserve(ringCpuSys, n);
    ringMemUsed = resizeRingPreserve(ringMemUsed, n);
    ringMemRes = resizeRingPreserve(ringMemRes, n);
    ringMemAnon = resizeRingPreserve(ringMemAnon, n);
    ringMemShared = resizeRingPreserve(ringMemShared, n);
    ringObjTotal = resizeRingPreserve(ringObjTotal, n);
    ringFaultsMinorPerSec = resizeRingPreserve(ringFaultsMinorPerSec, n);
    ringFaultsMajorPerSec = resizeRingPreserve(ringFaultsMajorPerSec, n);
    ringSampleAt = resizeRingPreserve(ringSampleAt, n);
  }

  let lastObjectRows: ObjectCountRow[] = [];
  let lastObjectTotalBytes: number | null = null;
  let lastChanperfMemUsed = 0;
  /** Last chanperf-reported plugin memory cap (`total` / `limit`); keeps axis scale stable between polls. */
  let lastChanperfMemLimitBytes: number | null = null;

  /** Latched: once a single chanperf carries `<proc-stat>`, reveal the CPU mode-switch and never re-hide it. */
  let procStatSeen = false;
  /** Previous proc-stat snapshot (for delta-rate computation). */
  let prevProcStat: ProcStatParsed | null = null;
  /** Wall ms when prev proc-stat was sampled — used as elapsed denominator. */
  let prevProcStatSampleMs: number | null = null;
  /** Most recent proc-stat snapshot (for table render). */
  let lastProcStat: ProcStatParsed | null = null;
  /** Wall ms when we first observed the current `starttime` — reset to "now" on respawn. */
  let procStatUptimeAnchorMs: number | null = null;
  /** Pending one-shot row-flicker animation flag for respawn (consumed by the next renderCharts). */
  let pendingRespawnFlicker = false;

  /**
   * Fold a fresh `<proc-stat>` sample into rings + anchor state. Pushes a null onto fault rings
   * when proc-stat is absent or the previous sample is missing (delta unavailable).
   */
  function applyProcStatSample(procStat: ProcStatParsed | null, nowMs: number): void {
    if (!procStat) {
      pushRing(ringFaultsMinorPerSec, null);
      pushRing(ringFaultsMajorPerSec, null);
      /* Do not clear `lastProcStat` — keep the last known table values visible during transient gaps. */
      return;
    }

    procStatSeen = true;

    /* Respawn detection: `starttime` changes only when the channel process restarts. */
    const respawned =
      prevProcStat != null && prevProcStat.starttime !== procStat.starttime;
    if (respawned || procStatUptimeAnchorMs == null) {
      procStatUptimeAnchorMs = nowMs;
      if (respawned) pendingRespawnFlicker = true;
    }

    /* Fault rates: cumulative counters divided by elapsed wall time. */
    let minorRate: number | null = null;
    let majorRate: number | null = null;
    if (
      prevProcStat != null &&
      prevProcStatSampleMs != null &&
      !respawned &&
      nowMs > prevProcStatSampleMs
    ) {
      const dtSec = (nowMs - prevProcStatSampleMs) / 1000;
      if (dtSec > 0) {
        const dMinor = Math.max(0, procStat.minflt - prevProcStat.minflt);
        const dMajor = Math.max(0, procStat.majflt - prevProcStat.majflt);
        minorRate = dMinor / dtSec;
        majorRate = dMajor / dtSec;
      }
    }
    pushRing(ringFaultsMinorPerSec, minorRate);
    pushRing(ringFaultsMajorPerSec, majorRate);

    lastProcStat = procStat;
    prevProcStat = procStat;
    prevProcStatSampleMs = nowMs;
  }

  /** Wall time when this performance session began (quad on); drives ramping chart x-axis span. */
  let chartSessionStartMs: number | null = null;
  let prevConfiguredChartHistoryMs = DEVICE_METRICS_CHART_HISTORY_MS;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let failStreak = 0;
  let destroyed = false;
  /** Dedupe toasts while the same metrics error repeats on every poll. */
  let lastMetricsErrorToast: string | null = null;

  function clearTimer(): void {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function isQuadLayout(): boolean {
    if (destroyed) return false;
    return wrap.getAttribute('data-remote-layout') === 'quad';
  }

  /** `null` until first `dev-app-active-polled` so we do not treat “unknown” as backgrounded. */
  let devAppForeground: boolean | null = null;

  function shouldPoll(): boolean {
    if (destroyed || !developerEnabled) return false;
    return isQuadLayout() && devAppForeground === true;
  }

  /** Avoid toast spam for a device the user is not currently viewing. Polling still runs in the background. */
  function shouldSurfaceMetricsToasts(): boolean {
    if (!shouldPoll()) return false;
    if (document.visibilityState === 'hidden') return false;
    if (!panel.classList.contains('active')) return false;
    return true;
  }

  function setError(msg: string | null | undefined): void {
    if (msg == null || msg === '') {
      lastMetricsErrorToast = null;
      return;
    }
    if (!shouldSurfaceMetricsToasts()) return;
    if (msg !== lastMetricsErrorToast) {
      lastMetricsErrorToast = msg;
      showToast(msg, 'error');
    }
  }

  function computeChartFrameTiming(): {
    nowMs: number;
    historyMs: number;
    maxSampleGapMs: number;
  } {
    const nowMs = Date.now();
    /* One place for session anchor (also used by header sparklines via this helper). */
    if (
      wrap.getAttribute('data-remote-layout') === 'quad' &&
      chartSessionStartMs == null &&
      devAppForeground === true
    ) {
      chartSessionStartMs = nowMs;
    }
    const configuredHistoryMs =
      typeof DEVICE_METRICS_CHART_HISTORY_MS === 'number' &&
      Number.isFinite(DEVICE_METRICS_CHART_HISTORY_MS) &&
      DEVICE_METRICS_CHART_HISTORY_MS > 0
        ? DEVICE_METRICS_CHART_HISTORY_MS
        : MIN_CHART_DISPLAY_HISTORY_MS;
    if (configuredHistoryMs !== prevConfiguredChartHistoryMs) {
      prevConfiguredChartHistoryMs = configuredHistoryMs;
      chartSessionStartMs = nowMs;
    }
    const historyMs = effectiveChartDisplayHistoryMs(
      configuredHistoryMs,
      chartSessionStartMs,
      nowMs
    );
    const maxSampleGapMs = Math.max(30_000, DEVICE_METRICS_SAMPLE_INTERVAL_MS * 8);
    return { nowMs, historyMs, maxSampleGapMs };
  }

  /**
   * Header mini-panel: when Device Performance (quad) is on, show on non-Remote inner tabs only
   * (Remote already has the full quad; no duplicate summary there).
   */
  function syncDevicePanelPerfStrip(): void {
    const aside = panel.querySelector('[data-device-panel-perf-wrap]');
    if (!(aside instanceof HTMLElement)) return;
    const btn = panel.querySelector('[data-device-panel-perf-btn]');
    const liveRow = panel.querySelector('[data-perf-strip-live]');
    const pausedEl = panel.querySelector('[data-perf-strip-paused]');
    const elCpu = panel.querySelector('[data-strip-cpu]');
    const elMem = panel.querySelector('[data-strip-mem]');
    const elObj = panel.querySelector('[data-strip-obj]');

    /* Same as "Show Device Performance" on: solo layout means strip stays hidden. */
    const quadOn = wrap.getAttribute('data-remote-layout') === 'quad';
    if (!quadOn) {
      aside.hidden = true;
      return;
    }

    const activeInner =
      panel.querySelector('.inner-tab.active')?.getAttribute('data-inner-tab') ?? '';
    if (activeInner === 'remote') {
      aside.hidden = true;
      return;
    }

    aside.hidden = false;

    const sampling = devAppForeground === true;
    if (!(liveRow instanceof HTMLElement) || !(pausedEl instanceof HTMLElement)) {
      aside.hidden = true;
      return;
    }

    /* Paused state is shown by `.device-panel-paused-nav` (warning + Launch/Sideload). */
    if (!sampling) {
      aside.hidden = true;
      return;
    }

    liveRow.hidden = false;
    pausedEl.hidden = true;

    const lastU = lastNonNull(ringCpuUser);
      const lastS = lastNonNull(ringCpuSys);
      const lastT =
        lastU != null && lastS != null
          ? Math.min(100, lastU + lastS)
          : lastU != null || lastS != null
            ? Math.min(100, (lastU ?? 0) + (lastS ?? 0))
            : null;
      const lastUsed = lastNonNull(ringMemUsed);

      const totalLast = lastNonNull(ringObjTotal);
      const modeRaw = wrap
        .querySelector('.remote-objects-mode-btn.is-active')
        ?.getAttribute('data-objects-mode');
      const objectsMode: ObjectsMode = modeRaw === 'memory' ? 'memory' : 'count';
      let objStr = '—';
      if (objectsMode === 'memory' && lastObjectTotalBytes != null && lastObjectTotalBytes > 0) {
        objStr = fmtMemCell(lastObjectTotalBytes);
      } else if (totalLast != null) {
        objStr = String(Math.round(totalLast));
      }

      if (elCpu) elCpu.textContent = lastT != null ? `${lastT.toFixed(1)}%` : '—';
      if (elMem) elMem.textContent = lastUsed != null ? fmtMb(lastUsed) : '—';
      if (elObj) elObj.textContent = objStr;

      const { nowMs: sparkNow, historyMs: sparkHist, maxSampleGapMs: sparkGap } =
        computeChartFrameTiming();

      const sparkCpu = panel.querySelector('[data-strip-spark="cpu"]');
      const sparkMem = panel.querySelector('[data-strip-spark="mem"]');
      const sparkObj = panel.querySelector('[data-strip-spark="obj"]');

      const cpuTotalRingSp = ringCpuUser.map((u, i) => {
        const s = ringCpuSys[i];
        if (u == null || s == null) return null;
        return Math.min(100, u + s);
      });
      if (sparkCpu instanceof SVGSVGElement) {
        drawSparklineTimeseries(sparkCpu, {
          series: [{ id: 'tot', color: COL_CPU_TOTAL, values: cpuTotalRingSp }],
          yMin: 0,
          yMax: 100,
          sampleAt: ringSampleAt,
          historyMs: sparkHist,
          nowMs: sparkNow,
          maxSampleGapMs: sparkGap
        });
      }

      const peakMemH = maxFiniteAcross(ringMemUsed, ringMemRes, ringMemAnon, ringMemShared);
      const memYMaxH = memChartYAxisMaxBytes({
        peakSampleBytes: peakMemH,
        chanperfLimitBytes: lastChanperfMemLimitBytes
      });
      const memSeriesForSpark = [
        { id: 'used', color: COL_MEM_USED, values: ringMemUsed },
        ...(lastChanperfMemLimitBytes != null &&
        Number.isFinite(lastChanperfMemLimitBytes) &&
        lastChanperfMemLimitBytes > 0
          ? [
              {
                id: 'lim',
                color: 'rgba(226, 232, 240, 0.72)',
                values: [] as Array<number | null>,
                yConstant: lastChanperfMemLimitBytes
              }
            ]
          : [])
      ];
      if (sparkMem instanceof SVGSVGElement) {
        drawSparklineTimeseries(sparkMem, {
          series: memSeriesForSpark,
          yMin: 0,
          yMax: memYMaxH,
          sampleAt: ringSampleAt,
          historyMs: sparkHist,
          nowMs: sparkNow,
          maxSampleGapMs: sparkGap
        });
      }

      const maxO = ringObjTotal.reduce<number>((m, v) => (v != null && v > m ? v : m), 0);
      const yMaxObjH =
        (totalLast ?? 0) > 0 || maxO > 0
          ? Math.max(100, Math.ceil((maxO * 1.12 + 50) / 100) * 100)
          : 100;
      if (sparkObj instanceof SVGSVGElement) {
        drawSparklineTimeseries(sparkObj, {
          series: [{ id: 'tot', color: '#fbbf24', values: ringObjTotal }],
          yMin: 0,
          yMax: yMaxObjH,
          sampleAt: ringSampleAt,
          historyMs: sparkHist,
          nowMs: sparkNow,
          maxSampleGapMs: sparkGap
        });
      }

    if (btn instanceof HTMLButtonElement) {
      btn.title = S.devApp.latestDevicePerfTitle;
    }
  }

  /**
   * Build a `<proc-stat>`-backed panel that replaces the CPU chart in `process` mode.
   * Layout is a vertical stack: a centered info table on top (state, uptime, CPU
   * times, clock tick rate) sized to its own content, then a 2-column faults row
   * below (Minor / Major) with tall sparklines filling the remaining height.
   */
  function renderCpuProcessTable(
    tableEl: HTMLElement,
    frame: { nowMs: number; historyMs: number; maxSampleGapMs: number }
  ): void {
    tableEl.innerHTML = '';
    const ps = lastProcStat;
    if (!ps) {
      const empty = document.createElement('div');
      empty.className = 'remote-cpu-process-row';
      const lab = document.createElement('span');
      lab.className = 'remote-cpu-process-label';
      lab.textContent = S.devApp.processLabel;
      const val = document.createElement('span');
      val.className = 'remote-cpu-process-value';
      val.textContent = S.devApp.waitingForProcStat;
      empty.appendChild(lab);
      empty.appendChild(val);
      tableEl.appendChild(empty);
      return;
    }

    const clk = ps.clkTck > 0 ? ps.clkTck : 100;
    const userSec = ps.utime / clk;
    const sysSec = ps.stime / clk;
    const lastUserPct = lastNonNull(ringCpuUser) ?? null;
    const lastSysPct = lastNonNull(ringCpuSys) ?? null;
    const lastMinorRate = lastNonNull(ringFaultsMinorPerSec) ?? null;
    const lastMajorRate = lastNonNull(ringFaultsMajorPerSec) ?? null;
    const uptimeSec =
      procStatUptimeAnchorMs != null
        ? Math.max(0, (frame.nowMs - procStatUptimeAnchorMs) / 1000)
        : 0;

    const flickerUptime = pendingRespawnFlicker;
    pendingRespawnFlicker = false;

    const infoBlock = document.createElement('div');
    infoBlock.className = 'remote-cpu-process-info';
    const faultsBlock = document.createElement('div');
    faultsBlock.className = 'remote-cpu-process-faults';
    tableEl.appendChild(infoBlock);
    tableEl.appendChild(faultsBlock);

    const addInfoRow = (
      label: string,
      value: string,
      opts?: {
        valueSecondary?: string;
        leftDotClass?: 'green' | 'amber' | 'red' | 'neutral';
        flicker?: boolean;
      }
    ): void => {
      const row = document.createElement('div');
      row.className = 'remote-cpu-process-row';
      if (opts?.flicker) row.classList.add('remote-cpu-process-row--uptime-flicker');

      const lab = document.createElement('span');
      lab.className = 'remote-cpu-process-label';
      if (opts?.leftDotClass) {
        const dot = document.createElement('span');
        dot.className = `remote-cpu-process-state-dot remote-cpu-process-state-dot--${opts.leftDotClass}`;
        lab.appendChild(dot);
      }
      const text = document.createElement('span');
      text.textContent = label;
      lab.appendChild(text);

      const val = document.createElement('span');
      val.className = 'remote-cpu-process-value';
      val.textContent = value;
      if (opts?.valueSecondary) {
        const sec = document.createElement('span');
        sec.className = 'remote-cpu-process-value-secondary';
        sec.textContent = opts.valueSecondary;
        val.appendChild(sec);
      }

      row.appendChild(lab);
      row.appendChild(val);
      infoBlock.appendChild(row);
    };

    const addFaultCard = (
      label: string,
      value: string,
      opts: {
        valueSecondary?: string;
        sparkRing: Array<number | null>;
        sparkColor: string;
        majorActive?: boolean;
      }
    ): void => {
      const card = document.createElement('div');
      card.className = 'remote-cpu-process-fault-card';
      if (opts.majorActive) card.classList.add('remote-cpu-process-fault-card--major-active');

      const header = document.createElement('div');
      header.className = 'remote-cpu-process-fault-card-header';

      const lab = document.createElement('span');
      lab.className = 'remote-cpu-process-label';
      lab.textContent = label;

      const val = document.createElement('span');
      val.className = 'remote-cpu-process-value';
      val.textContent = value;
      if (opts.valueSecondary) {
        const sec = document.createElement('span');
        sec.className = 'remote-cpu-process-value-secondary';
        sec.textContent = opts.valueSecondary;
        val.appendChild(sec);
      }

      header.appendChild(lab);
      header.appendChild(val);

      const sparkWrap = document.createElement('div');
      sparkWrap.className = 'remote-cpu-process-fault-spark-wrap';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
      svg.classList.add('remote-cpu-process-fault-spark');
      sparkWrap.appendChild(svg);
      const peak = opts.sparkRing.reduce<number>(
        (m, v) => (v != null && Number.isFinite(v) && v > m ? v : m),
        0
      );
      drawSparklineTimeseries(svg, {
        series: [{ id: 'r', color: opts.sparkColor, values: opts.sparkRing }],
        yMin: 0,
        yMax: Math.max(1, peak * 1.12),
        sampleAt: ringSampleAt,
        historyMs: frame.historyMs,
        nowMs: frame.nowMs,
        maxSampleGapMs: frame.maxSampleGapMs
      });

      card.appendChild(header);
      card.appendChild(sparkWrap);
      faultsBlock.appendChild(card);
    };

    addInfoRow(S.devApp.stateFieldLabel, stateToLabel(ps.state), {
      leftDotClass: stateToClass(ps.state),
      valueSecondary: `(${ps.state})`
    });

    addInfoRow(
      S.devApp.channelUptime,
      S.devApp.stableFor(formatSecondsCompact(uptimeSec)),
      {
        valueSecondary: S.devApp.sinceFirstObserved,
        flicker: flickerUptime
      }
    );

    addInfoRow(S.devApp.userCpuTime, `${userSec.toFixed(2)} s`, {
      valueSecondary: lastUserPct != null ? `· ${lastUserPct.toFixed(1)}%` : undefined
    });
    addInfoRow(S.devApp.kernelCpuTime, `${sysSec.toFixed(2)} s`, {
      valueSecondary: lastSysPct != null ? `· ${lastSysPct.toFixed(1)}%` : undefined
    });

    if (ps.cutime > 0 || ps.cstime > 0) {
      const cUserSec = ps.cutime / clk;
      const cSysSec = ps.cstime / clk;
      addInfoRow(S.devApp.childCpuTime, `${(cUserSec + cSysSec).toFixed(2)} s`, {
        valueSecondary: S.devApp.childCpuTimeSecondary(cUserSec.toFixed(2), cSysSec.toFixed(2))
      });
    }
    if (ps.cminflt > 0 || ps.cmajflt > 0) {
      addInfoRow(
        S.devApp.childFaults,
        `${ps.cminflt.toLocaleString()} / ${ps.cmajflt.toLocaleString()}`,
        { valueSecondary: S.devApp.minorMajor }
      );
    }

    addInfoRow(S.devApp.clockTickRate, `${clk} Hz`);

    addFaultCard(S.devApp.minorFaults, ps.minflt.toLocaleString(), {
      valueSecondary: `· ${formatRate(lastMinorRate ?? 0)}`,
      sparkRing: ringFaultsMinorPerSec,
      sparkColor: COL_FAULTS_MINOR
    });
    const majorActive = (lastMajorRate ?? 0) > 0;
    addFaultCard(S.devApp.majorFaults, ps.majflt.toLocaleString(), {
      valueSecondary: `· ${formatRate(lastMajorRate ?? 0)}${majorActive ? '' : ' ✓'}`,
      sparkRing: ringFaultsMajorPerSec,
      sparkColor: COL_FAULTS_MAJOR,
      majorActive
    });
  }

  function renderCpuPercentChart(
    root: HTMLElement,
    frame: { nowMs: number; historyMs: number; maxSampleGapMs: number }
  ): void {
    const { nowMs, historyMs, maxSampleGapMs } = frame;
    const lastU = lastNonNull(ringCpuUser);
    const lastS = lastNonNull(ringCpuSys);
    const lastT =
      lastU != null && lastS != null
        ? Math.min(100, lastU + lastS)
        : lastU != null || lastS != null
          ? Math.min(100, (lastU ?? 0) + (lastS ?? 0))
          : null;
    setLegendMetric(root, '[data-legend="cpu"]', 'cpu-total', lastT != null ? `${lastT.toFixed(1)}%` : '—');
    setLegendMetric(root, '[data-legend="cpu"]', 'cpu-user', lastU != null ? `${lastU.toFixed(1)}%` : '—');
    setLegendMetric(root, '[data-legend="cpu"]', 'cpu-sys', lastS != null ? `${lastS.toFixed(1)}%` : '—');

    const cpuTotalRing = ringCpuUser.map((u, i) => {
      const s = ringCpuSys[i];
      if (u == null || s == null) return null;
      return Math.min(100, u + s);
    });
    drawTimeseriesChart(chartCpu, {
      series: [
        { id: 'tot', color: COL_CPU_TOTAL, values: cpuTotalRing },
        { id: 'usr', color: COL_CPU_USER, values: ringCpuUser },
        { id: 'sys', color: COL_CPU_SYS, values: ringCpuSys }
      ],
      yMin: 0,
      yMax: 100,
      yTickCount: 5,
      yFormat: (n) => `${Math.round(n)}%`,
      sampleAt: ringSampleAt,
      historyMs,
      nowMs,
      maxSampleGapMs,
      hover: {
        seriesLabels: { tot: S.devApp.hoverTotal, usr: S.devApp.hoverUser, sys: S.devApp.hoverKernel }
      }
    });
  }

  function renderCharts(root: HTMLElement): void {
    if (wrap.getAttribute('data-remote-layout') !== 'quad') {
      syncDevicePanelPerfStrip();
      return;
    }

    const { nowMs, historyMs, maxSampleGapMs } = computeChartFrameTiming();

    /* CPU mode-switch visibility tracks `procStatSeen` — never hides once revealed. */
    const cpuModeWrap = root.querySelector('[data-cpu-mode-switch-wrap]');
    if (cpuModeWrap instanceof HTMLElement) {
      cpuModeWrap.hidden = !procStatSeen;
    }
    /* Read CPU mode from the DOM (single source of truth) so any toggler — click handler
     * or Action Script capture's `setCpuModeUi` — flips the visible panel consistently.
     * If proc-stat regressed (older firmware after a reconnect) force percent mode so the
     * table can't show empty. */
    const cpuModeRaw = root
      .querySelector('.remote-cpu-mode-btn.is-active')
      ?.getAttribute('data-cpu-mode');
    const requestedCpuMode: CpuMode = cpuModeRaw === 'process' ? 'process' : 'percent';
    const effectiveCpuMode: CpuMode = procStatSeen ? requestedCpuMode : 'percent';
    const cpuChartWrap = root.querySelector('[data-cpu-chart-wrap]');
    const cpuProcessTable = root.querySelector('[data-cpu-process-table]');
    const cpuLegend = root.querySelector('[data-legend="cpu"]');
    if (cpuChartWrap instanceof HTMLElement) {
      cpuChartWrap.hidden = effectiveCpuMode !== 'percent';
    }
    if (cpuProcessTable instanceof HTMLElement) {
      cpuProcessTable.hidden = effectiveCpuMode !== 'process';
    }
    /* Legend stays hidden in process mode; the surrounding `.remote-quad-card-footer` keeps
     * its `min-height: 34px` so the footer band height stays consistent with other cards. */
    if (cpuLegend instanceof HTMLElement) {
      cpuLegend.hidden = effectiveCpuMode !== 'percent';
    }

    if (effectiveCpuMode === 'process' && cpuProcessTable instanceof HTMLElement) {
      renderCpuProcessTable(cpuProcessTable, { nowMs, historyMs, maxSampleGapMs });
    } else {
      renderCpuPercentChart(root, { nowMs, historyMs, maxSampleGapMs });
    }

    const lastUsed = lastNonNull(ringMemUsed);
    const lastRes = lastNonNull(ringMemRes);
    const lastAnon = lastNonNull(ringMemAnon);
    const lastShared = lastNonNull(ringMemShared);
    setLegendMetric(root, '[data-legend="mem"]', 'mem-used', lastUsed != null ? fmtMb(lastUsed) : '—');
    setLegendMetric(root, '[data-legend="mem"]', 'mem-res', lastRes != null ? fmtMb(lastRes) : '—');
    setLegendMetric(root, '[data-legend="mem"]', 'mem-anon', lastAnon != null ? fmtMb(lastAnon) : '—');
    setLegendMetric(root, '[data-legend="mem"]', 'mem-shared', lastShared != null ? fmtMb(lastShared) : '—');

    const peakMem = maxFiniteAcross(ringMemUsed, ringMemRes, ringMemAnon, ringMemShared);
    const memYMax = memChartYAxisMaxBytes({
      peakSampleBytes: peakMem,
      chanperfLimitBytes: lastChanperfMemLimitBytes
    });
    const memLimitBytes =
      lastChanperfMemLimitBytes != null &&
      Number.isFinite(lastChanperfMemLimitBytes) &&
      lastChanperfMemLimitBytes > 0
        ? lastChanperfMemLimitBytes
        : null;
    setLegendMetric(
      root,
      '[data-legend="mem"]',
      'mem-limit',
      memLimitBytes != null ? fmtMb(memLimitBytes) : '—'
    );
    const memSeriesBase = [
      { id: 'used', color: COL_MEM_USED, values: ringMemUsed },
      { id: 'res', color: COL_MEM_RES, values: ringMemRes },
      { id: 'anon', color: COL_MEM_ANON, values: ringMemAnon },
      { id: 'sh', color: COL_MEM_SHARED, values: ringMemShared }
    ];
    const memSeriesForChart =
      memLimitBytes != null
        ? [
            ...memSeriesBase,
            {
              id: 'lim',
              color: 'rgba(226, 232, 240, 0.82)',
              values: [] as Array<number | null>,
              yConstant: memLimitBytes
            }
          ]
        : memSeriesBase;
    drawTimeseriesChart(chartMem, {
      series: memSeriesForChart,
      yMin: 0,
      yMax: memYMax,
      yTickCount: 5,
      yFormat: (n) => `${(n / (1024 * 1024)).toFixed(0)}`,
      sampleAt: ringSampleAt,
      historyMs,
      nowMs,
      maxSampleGapMs,
      hover: {
        seriesLabels: {
          used: S.devApp.hoverUsed,
          res: S.devApp.hoverResident,
          anon: S.devApp.hoverAnonymous,
          sh: S.devApp.hoverShared,
          lim: S.devApp.hoverLimit
        }
      }
    });

    const totalLast = lastNonNull(ringObjTotal);

    const modeRaw = root.querySelector('.remote-objects-mode-btn.is-active')?.getAttribute('data-objects-mode');
    const objectsMode: ObjectsMode = modeRaw === 'memory' ? 'memory' : 'count';

    const hasBreakdown = lastObjectRows.length > 0;
    if (hasBreakdown) {
      elObjFallback.hidden = true;
      if (elObjFooter) elObjFooter.hidden = false;
      renderObjectsResourceMonitor(
        elObjRm,
        elObjFooter,
        elObjMemHint,
        lastObjectRows,
        totalLast ?? 0,
        lastObjectTotalBytes,
        lastChanperfMemUsed,
        objectsMode
      );
    } else if ((totalLast ?? 0) > 0) {
      elObjRm.innerHTML = '';
      if (elObjFooter) {
        elObjFooter.hidden = true;
        elObjFooter.innerHTML = '';
      }
      if (elObjMemHint) {
        elObjMemHint.hidden = true;
        elObjMemHint.textContent = '';
      }
      elObjFallback.hidden = false;
      const maxO = ringObjTotal.reduce<number>((m, v) => (v != null && v > m ? v : m), 0);
      const yMaxObj = Math.max(100, Math.ceil((maxO * 1.12 + 50) / 100) * 100);
      drawTimeseriesChart(chartObjTotal, {
        series: [{ id: 'tot', color: '#fbbf24', values: ringObjTotal }],
        yMin: 0,
        yMax: yMaxObj,
        yTickCount: 4,
        yFormat: (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1000)}k`),
        sampleAt: ringSampleAt,
        historyMs,
        nowMs,
        maxSampleGapMs
      });
    } else {
      elObjFallback.hidden = true;
      const emptyMsg =
        devAppForeground === false
          ? S.devApp.objectsEmptyBackground
          : devAppForeground !== true
            ? S.devApp.objectsEmptyNoForeground
            : S.devApp.objectsEmptyNoCounts;
      elObjRm.innerHTML = `<div class="remote-objects-rm-empty">${emptyMsg}</div>`;
      if (elObjFooter) {
        elObjFooter.hidden = true;
        elObjFooter.innerHTML = '';
      }
      if (elObjMemHint) {
        elObjMemHint.hidden = true;
        elObjMemHint.textContent = '';
      }
    }

    syncDevicePanelPerfStrip();
  }

  function scheduleNext(delayMs?: number): void {
    clearTimer();
    if (destroyed || !shouldPoll()) return;
    const base =
      delayMs != null
        ? delayMs
        : DEVICE_METRICS_SAMPLE_INTERVAL_MS + jitterMs();
    timer = setTimeout(() => {
      timer = null;
      void tick();
    }, Math.max(0, base));
  }

  /**
   * Fetch chanperf + object counts, update rings, and redraw quad charts.
   * Used by the polling tick and by Action Script `devicePerformance` capture (which bypasses `shouldPoll()`).
   */
  async function fetchAndApplyMetrics(): Promise<boolean> {
    try {
      const [cp, aa] = await Promise.all([
        api.query('/query/chanperf'),
        api.query(QUERY_ENDPOINTS.ACTIVE_APP)
      ]);

      const chanperfXml = cp.success && typeof cp.data === 'string' ? cp.data : '';
      const full = chanperfXml ? parseChanperfFull(chanperfXml) : null;
      let chanperfErr: string | null = null;
      if (!cp.success || typeof cp.data !== 'string') {
        chanperfErr = cp.error || S.devApp.chanperfRequestFailed;
      } else if (!full) {
        chanperfErr =
          extractChanperfFailureMessage(chanperfXml) ||
          S.devApp.couldNotParseChanperf;
      }

      const activeId =
        aa.success && typeof aa.data === 'string' ? parseActiveAppId(aa.data) : null;
      const objectCountsAppId = activeId || OBJECT_COUNTS_FALLBACK_APP_ID;
      const oc = await api.query(
        `/query/app-object-counts/${encodeURIComponent(objectCountsAppId)}`
      );

      let objectOk = false;
      if (oc.success && typeof oc.data === 'string') {
        const bd = parseObjectCountsBreakdown(oc.data);
        lastObjectRows = bd.rows;
        lastObjectTotalBytes = bd.totalBytes;
        pushRing(ringObjTotal, bd.total >= 0 ? bd.total : null);
        objectOk = true;
      } else {
        lastObjectRows = [];
        lastObjectTotalBytes = null;
        pushRing(ringObjTotal, null);
      }

      const nowMs = Date.now();
      pushRing(ringSampleAt, nowMs);
      if (full) {
        pushRing(ringCpuUser, full.cpuUser);
        pushRing(ringCpuSys, full.cpuSys);
        pushRing(ringMemUsed, full.memUsed);
        pushRing(ringMemRes, full.memRes);
        pushRing(ringMemAnon, full.memAnon);
        pushRing(ringMemShared, full.memShared);
        lastChanperfMemUsed = full.memUsed;
        if (full.memLimitBytes != null && full.memLimitBytes > 0) {
          lastChanperfMemLimitBytes = full.memLimitBytes;
        }
        applyProcStatSample(full.procStat, nowMs);
      } else {
        pushRing(ringCpuUser, null);
        pushRing(ringCpuSys, null);
        /* Do not plot app-object-count heap here — it is not OS / chanperf plugin memory and reads as “wrong” vs tools like free(1). */
        pushRing(ringMemUsed, null);
        pushRing(ringMemRes, null);
        pushRing(ringMemAnon, null);
        pushRing(ringMemShared, null);
        lastChanperfMemUsed = 0;
        /* Keep lastChanperfMemLimitBytes so axis scale stays stable during chanperf gaps. */
        pushRing(ringFaultsMinorPerSec, null);
        pushRing(ringFaultsMajorPerSec, null);
      }

      const ocErr = oc.success ? null : oc.error || S.devApp.objectCountsFailed;
      if (!full && !objectOk) {
        failStreak += 1;
        setError(
          [chanperfErr, ocErr].filter(Boolean).join(' · ') || S.devApp.deviceMetricsUnavailable
        );
      } else {
        failStreak = 0;
        setError(chanperfErr ?? ocErr);
      }

      renderCharts(wrap);
      return false;
    } catch (e) {
      failStreak += 1;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      /* Keep drawing last good ring samples while polling fails (chanperf parse, network, etc.). */
      renderCharts(wrap);
      return true;
    }
  }

  async function tick(): Promise<void> {
    if (destroyed || !shouldPoll()) {
      clearTimer();
      return;
    }
    if (inFlight) {
      scheduleNext();
      return;
    }
    inFlight = true;
    let hadError = false;
    try {
      hadError = await fetchAndApplyMetrics();
    } finally {
      inFlight = false;
      if (!destroyed) {
        if (shouldPoll()) {
          if (hadError) {
            const backoff = Math.min(60_000, 2000 * 2 ** Math.min(failStreak, 5));
            scheduleNext(backoff);
          } else {
            scheduleNext();
          }
        }
      }
    }
  }

  /** One-off poll + redraw for Action Script capture (quad must already be visible). */
  async function forceMetricsSampleForActionScript(): Promise<void> {
    if (destroyed || !developerEnabled) return;
    if (wrap.getAttribute('data-remote-layout') !== 'quad') return;
    const waitUntil = Date.now() + 5000;
    while (inFlight && Date.now() < waitUntil) {
      await new Promise((r) => setTimeout(r, 40));
    }
    if (inFlight) return;
    inFlight = true;
    try {
      await fetchAndApplyMetrics();
    } finally {
      inFlight = false;
    }
  }

  function reschedule(): void {
    clearTimer();
    if (shouldPoll()) {
      scheduleNext(0);
    }
  }

  panel.addEventListener('innertabswitch', () => {
    reschedule();
    syncDevicePanelPerfStrip();
  });

  const vis = (): void => reschedule();
  document.addEventListener('visibilitychange', vis);

  const mo = new MutationObserver(() => reschedule());
  mo.observe(panel, { attributes: true, attributeFilter: ['class'] });

  let unsubSettings: (() => void) | null = null;

  const wrapUiAc = new AbortController();

  const perfHeaderBtn = panel.querySelector('[data-device-panel-perf-btn]');
  if (perfHeaderBtn instanceof HTMLButtonElement) {
    perfHeaderBtn.addEventListener(
      'click',
      () => {
        const remoteTab = panel.querySelector('.inner-tab[data-inner-tab="remote"]');
        if (remoteTab instanceof HTMLElement) remoteTab.click();
      },
      { signal: wrapUiAc.signal }
    );
  }

  panel.addEventListener(
    'click',
    (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;

      const launchBtn = t.closest('[data-paused-launch-dev]');
      if (launchBtn instanceof HTMLButtonElement && !launchBtn.hidden) {
        ev.preventDefault();
        if (launchBtn.disabled) return;
        launchBtn.disabled = true;
        const prevLabel = launchBtn.textContent;
        launchBtn.textContent = S.devApp.launchingProgress;
        void (async () => {
          try {
            await api.launch('dev');
            await pollDevAppForegroundAfterLaunch(panel, api);
          } catch (e: unknown) {
            showToast(errMessage(e) || S.devApp.launchFailed, 'error');
          } finally {
            launchBtn.disabled = false;
            if (prevLabel != null) launchBtn.textContent = prevLabel;
          }
        })();
        return;
      }

      const sideloadNavBtn = t.closest('[data-paused-goto-sideload]');
      if (!(sideloadNavBtn instanceof HTMLButtonElement) || sideloadNavBtn.hidden) return;
      ev.preventDefault();
      const devTab = panel.querySelector('.inner-tab[data-inner-tab="devapp"]');
      if (devTab instanceof HTMLButtonElement) devTab.click();
    },
    { signal: wrapUiAc.signal }
  );

  wrap.addEventListener(
    'click',
    (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;

      const cpuBtn = t.closest('[data-cpu-mode]');
      if (cpuBtn instanceof HTMLButtonElement && wrap.contains(cpuBtn)) {
        const m = cpuBtn.getAttribute('data-cpu-mode');
        if (m !== 'percent' && m !== 'process') return;
        if (m === 'process' && !procStatSeen) return;
        wrap.querySelectorAll('[data-cpu-mode]').forEach((b) => {
          const active = b === cpuBtn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        renderCharts(wrap);
        return;
      }

      const btn = t.closest('[data-objects-mode]');
      if (!btn || !wrap.contains(btn) || !(btn instanceof HTMLButtonElement)) return;
      const mode = btn.getAttribute('data-objects-mode');
      if (mode !== 'count' && mode !== 'memory') return;
      wrap.querySelectorAll('[data-objects-mode]').forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      renderCharts(wrap);
    },
    { signal: wrapUiAc.signal }
  );

  const perfToggle = wrap.querySelector('[data-remote-performance-toggle]');
  const perfWrap = wrap.querySelector('[data-remote-performance-wrap]');
  const pausedNav = panel.querySelector('[data-device-panel-paused-nav]');
  const launchNavBtn = panel.querySelector('[data-paused-launch-dev]');
  const sideloadNavBtn = panel.querySelector('[data-paused-goto-sideload]');
  let suppressToggleEvent = false;

  /** Set when `/query/apps` is checked (Dev App tab); drives header Launch vs Sideload. */
  let devAppSideloadInstalled: boolean | null = null;
  let metricsPaused = false;

  function pausedNavMessage(installed: boolean | null): {
    full: string;
    short: string;
    title: string;
  } {
    if (installed === false) {
      return {
        full: S.devApp.pausedSideloadFull,
        short: S.devApp.pausedSideloadShort,
        title: S.devApp.pausedSideloadFull
      };
    }
    if (installed === true) {
      return {
        full: S.devApp.pausedLaunchFull,
        short: S.devApp.pausedLaunchShort,
        title: S.devApp.pausedLaunchFull
      };
    }
    return {
      full: S.devApp.pausedUnknownFull,
      short: S.devApp.pausedUnknownShort,
      title: S.devApp.pausedUnknownFull
    };
  }

  function updateDevicePanelPausedNav(): void {
    if (pausedNav instanceof HTMLElement) {
      pausedNav.hidden = !metricsPaused;
    }
    const ready = metricsPaused && devAppSideloadInstalled !== null;
    if (launchNavBtn instanceof HTMLButtonElement) {
      launchNavBtn.hidden = !(ready && devAppSideloadInstalled === true);
    }
    if (sideloadNavBtn instanceof HTMLButtonElement) {
      sideloadNavBtn.hidden = !(ready && devAppSideloadInstalled === false);
    }
    const msg = pausedNavMessage(metricsPaused ? devAppSideloadInstalled : null);
    const textWrap = panel.querySelector('.device-panel-paused-nav-text');
    const fullEl = panel.querySelector('[data-paused-text-full]');
    const shortEl = panel.querySelector('[data-paused-text-short]');
    if (textWrap instanceof HTMLElement) {
      textWrap.title = msg.title;
    }
    if (fullEl) fullEl.textContent = msg.full;
    if (shortEl) shortEl.textContent = msg.short;
  }

  panel.addEventListener(
    'dev-app-sideload-state',
    (e: Event) => {
      const ce = e as CustomEvent<{ installed?: boolean }>;
      if (!ce.detail || typeof ce.detail.installed !== 'boolean') return;
      devAppSideloadInstalled = ce.detail.installed;
      updateDevicePanelPausedNav();
    },
    { signal: wrapUiAc.signal }
  );

  function applyPerformanceUiState(): void {
    if (!(perfToggle instanceof HTMLInputElement)) return;

    if (perfWrap instanceof HTMLElement) {
      perfWrap.hidden = !developerEnabled;
    }

    const wantQuad = developerEnabled && perfToggle.checked;
    wrap.setAttribute('data-remote-layout', wantQuad ? 'quad' : 'solo');
    metricsPaused = wantQuad && devAppForeground === false;
    updateDevicePanelPausedNav();

    /* Unchecked: only enable when dev is foreground. Checked: always allow uncheck (incl. paused / unknown). */
    perfToggle.disabled = !perfToggle.checked && devAppForeground !== true;

    const label = perfWrap instanceof HTMLElement ? perfWrap : perfToggle.closest('label');
    if (label instanceof HTMLElement) {
      if (!developerEnabled) {
        label.removeAttribute('title');
      } else if (devAppForeground !== true && !perfToggle.checked) {
        label.title = S.devApp.bringDevAppToForegroundTitle;
      } else if (devAppForeground === false && perfToggle.checked) {
        label.title = pausedNavMessage(devAppSideloadInstalled).title;
      } else {
        label.removeAttribute('title');
      }
    }

    if (!wantQuad) {
      lastMetricsErrorToast = null;
      chartSessionStartMs = null;
      lastChanperfMemLimitBytes = null;
    } else if (chartSessionStartMs == null && devAppForeground === true) {
      chartSessionStartMs = Date.now();
    }

    renderCharts(wrap);
    reschedule();
  }

  /** Action Script `devicePerformance`: show the quad when it was off (solo) so capture can run. */
  async function enableDevicePerformanceQuadForCapture(): Promise<boolean> {
    if (destroyed) return false;
    if (!developerEnabled) return false;
    if (wrap.getAttribute('data-remote-layout') === 'quad') return true;
    if (!(perfToggle instanceof HTMLInputElement)) return false;
    /* Programmatically match checking “Show Device Performance” (may be disabled in solo until dev is foreground). */
    perfToggle.disabled = false;
    suppressToggleEvent = true;
    perfToggle.checked = true;
    suppressToggleEvent = false;
    if (REMEMBER_DEVICE_PERFORMANCE_QUAD_PER_DEVICE && deviceKey) {
      try {
        await setDevicePerformanceQuadPref(deviceKey, true);
      } catch {
        /* non-fatal */
      }
    }
    applyPerformanceUiState();
    const ok = wrap.getAttribute('data-remote-layout') === 'quad';
    if (ok && panel.classList.contains('active') && document.visibilityState === 'visible') {
      showToast(
        S.devApp.showDevicePerfAutoOnToast,
        'info'
      );
    }
    return ok;
  }

  async function applyPersistedQuadPreference(): Promise<void> {
    if (!(perfToggle instanceof HTMLInputElement)) return;
    const remember = REMEMBER_DEVICE_PERFORMANCE_QUAD_PER_DEVICE;
    const persisted =
      remember && deviceKey ? await getDevicePerformanceQuadPref(deviceKey) : false;
    suppressToggleEvent = true;
    perfToggle.checked = !!(developerEnabled && persisted);
    suppressToggleEvent = false;
    applyPerformanceUiState();
  }

  if (perfToggle instanceof HTMLInputElement) {
    perfToggle.addEventListener(
      'change',
      async () => {
        if (suppressToggleEvent) return;
        // Match the gating used by applyPersistedQuadPreference: the pref is scoped
        // per-device, so skip the write when we have no device key.
        if (REMEMBER_DEVICE_PERFORMANCE_QUAD_PER_DEVICE && deviceKey) {
          await setDevicePerformanceQuadPref(deviceKey, perfToggle.checked);
        }
        applyPerformanceUiState();
      },
      { signal: wrapUiAc.signal }
    );

    void applyPersistedQuadPreference();
  } else {
    renderCharts(wrap);
    reschedule();
  }

  // Reload handled centrally by `app-settings-change-bus`; we only react here.
  unsubSettings = onAppSettingsChanged(() => {
    rebuildMetricRings();
    renderCharts(wrap);
    reschedule();
    void applyPersistedQuadPreference();
  });

  panel.addEventListener(
    'dev-app-active-polled',
    (e: Event) => {
      const ce = e as CustomEvent<{ active: boolean; ok?: boolean }>;
      if (!ce.detail || typeof ce.detail.active !== 'boolean') return;
      // When the active-app query errors (ok === false), keep the previous
      // foreground state so a flaky network tick doesn't pause Device Performance
      // or flip the Launch banner to "paused".
      if (ce.detail.ok === false) return;
      devAppForeground = ce.detail.active;
      applyPerformanceUiState();
    },
    { signal: wrapUiAc.signal }
  );

  function cloneMetricsSnapshotForActionScript(): MetricsRingSnapshot {
    const c = (r: Array<number | null>) => [...r];
    return {
      ringCpuUser: c(ringCpuUser),
      ringCpuSys: c(ringCpuSys),
      ringMemUsed: c(ringMemUsed),
      ringMemRes: c(ringMemRes),
      ringMemAnon: c(ringMemAnon),
      ringMemShared: c(ringMemShared),
      ringObjTotal: c(ringObjTotal),
      ringFaultsMinorPerSec: c(ringFaultsMinorPerSec),
      ringFaultsMajorPerSec: c(ringFaultsMajorPerSec),
      ringSampleAt: c(ringSampleAt),
      lastObjectRows: lastObjectRows.map((r) => ({ ...r })),
      lastObjectTotalBytes,
      lastChanperfMemUsed,
      lastChanperfMemLimitBytes,
      chartSessionStartMs,
      procStatSeen,
      lastProcStat: lastProcStat ? { ...lastProcStat } : null
    };
  }

  type PerfCaptureOpts = { shouldStop?: () => boolean; onWaiting?: (show: boolean) => void };

  (
    panel as DevicePanelRoot & {
      rokuDevicePerformanceCapture?: (
        chart: string,
        opts?: PerfCaptureOpts
      ) => ReturnType<typeof runDevicePerformanceCaptureStep>;
    }
  ).rokuDevicePerformanceCapture = (chart, opts) => {
    const id = String(chart ?? '').trim();
    if (!isDevicePerformanceChartId(id)) {
      return Promise.resolve({ success: false, error: S.devApp.invalidChartType });
    }
    return runDevicePerformanceCaptureStep({
      chart: id as DevicePerformanceChartId,
      developerEnabled,
      getWrap: () => wrap,
      cloneLiveRings: cloneMetricsSnapshotForActionScript,
      forceLiveSample: () => forceMetricsSampleForActionScript(),
      ensureDevicePerformanceQuadVisible: enableDevicePerformanceQuadForCapture,
      shouldStop: opts?.shouldStop,
      onWaiting: opts?.onWaiting
    });
  };

  const destroy = (): void => {
    destroyed = true;
    clearTimer();
    wrapUiAc.abort();
    document.removeEventListener('visibilitychange', vis);
    mo.disconnect();
    if (unsubSettings) unsubSettings();
    delete (
      panel as DevicePanelRoot & { rokuDevicePerformanceCapture?: typeof runDevicePerformanceCaptureStep }
    ).rokuDevicePerformanceCapture;
  };

  (panel as DevicePanelRoot & { _deviceMetricsCleanup?: () => void })._deviceMetricsCleanup = destroy;
}
