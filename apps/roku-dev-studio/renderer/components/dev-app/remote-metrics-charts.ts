/**
 * Parsers + SVG time-series drawing for Remote tab resource quadrants.
 * Styled for dark UI; structure inspired by Roku Resource Monitor (legend + gridded plot).
 */

const NS = 'http://www.w3.org/2000/svg';

export type ChanperfParsed = {
  cpuUser: number;
  cpuSys: number;
  memUsed: number;
  memRes: number;
  memAnon: number;
  memSwap: number;
  memFile: number;
  memShared: number;
  /** Plugin / channel memory ceiling when the firmware sends `total` / `limit` in chanperf XML. */
  memLimitBytes: number | null;
};

function firstMatchInt(xml: string, tag: string): number | null {
  const m = xml.match(new RegExp(`<${tag}>(\\d+)</${tag}>`, 'i'));
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function firstMatchFloat(xml: string, tag: string): number | null {
  const m = xml.match(new RegExp(`<${tag}>([\\d.]+)</${tag}>`, 'i'));
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Full chanperf parse: CPU user/sys + memory byte fields from `<plugin>` and/or `<memory>`. */
export function parseChanperfFull(xml: string): ChanperfParsed | null {
  if (!xml || !xml.includes('chanperf')) return null;
  const pluginMatch = xml.match(/<plugin[\s\S]*?<\/plugin>/i);
  const memoryMatch = xml.match(/<memory[\s\S]*?<\/memory>/i);
  const pluginBlock = pluginMatch ? pluginMatch[0] : xml;
  /** Prefer dedicated `<memory>` subtree when present (some firmware layouts). */
  const memBlock = memoryMatch ? memoryMatch[0] : pluginBlock;

  const user = firstMatchFloat(pluginBlock, 'user') ?? firstMatchFloat(xml, 'user') ?? 0;
  const sys = firstMatchFloat(pluginBlock, 'sys') ?? firstMatchFloat(xml, 'sys') ?? 0;
  const used =
    firstMatchInt(memBlock, 'used') ??
    firstMatchInt(pluginBlock, 'used');
  if (used == null) return null;

  const memLimitRaw =
    firstMatchInt(memBlock, 'total') ??
    firstMatchInt(memBlock, 'limit') ??
    firstMatchInt(pluginBlock, 'total') ??
    firstMatchInt(pluginBlock, 'limit');
  const memLimitBytes =
    memLimitRaw != null && memLimitRaw > 0 && Number.isFinite(memLimitRaw) ? memLimitRaw : null;

  return {
    cpuUser: Math.min(100, Math.max(0, user)),
    cpuSys: Math.min(100, Math.max(0, sys)),
    memUsed: used,
    memRes: firstMatchInt(memBlock, 'res') ?? firstMatchInt(pluginBlock, 'res') ?? used,
    memAnon: firstMatchInt(memBlock, 'anon') ?? firstMatchInt(pluginBlock, 'anon') ?? 0,
    memSwap: firstMatchInt(memBlock, 'swap') ?? firstMatchInt(pluginBlock, 'swap') ?? 0,
    memFile: firstMatchInt(memBlock, 'file') ?? firstMatchInt(pluginBlock, 'file') ?? 0,
    memShared: firstMatchInt(memBlock, 'shared') ?? firstMatchInt(pluginBlock, 'shared') ?? 0,
    memLimitBytes
  };
}

/**
 * When chanperf returns no `<plugin>` / `<used>` (e.g. status FAILED), surface `<error>` text
 * so the UI can explain why CPU/system-memory lines are missing.
 */
export function extractChanperfFailureMessage(xml: string): string | null {
  if (!xml || !xml.includes('chanperf')) return null;
  const errM = xml.match(/<error>([^<]*)<\/error>/i);
  const err = errM?.[1]?.trim() ?? '';
  if (err.length > 0) {
    return `Channel performance unavailable: ${err}`;
  }
  const stM = xml.match(/<status>([^<]*)<\/status>/i);
  const st = stM?.[1]?.trim() ?? '';
  if (/^failed$/i.test(st)) {
    return 'Channel performance unavailable (chanperf status failed).';
  }
  return null;
}

export type ObjectCountRow = { label: string; count: number; bytes?: number | null };

/** ECP `/query/active-app` → foreground channel id for object-count queries. */
export function parseActiveAppId(xml: string): string | null {
  if (!xml) return null;
  const m = xml.match(/<app[^>]*\bid="([^"]+)"/i);
  const id = m?.[1]?.trim();
  return id || null;
}

const OBJECT_COUNT_TAG_EXCLUDE = new Set(
  [
    'app-object-counts',
    'object-counts',
    'object_counts',
    'objectcounts',
    'counts',
    'count',
    'objects',
    'object',
    'status',
    'error',
    'app',
    'xml',
    'result',
    'response',
    'plugin',
    'total',
    'root',
    'roku',
    'timestamp',
    'channel-id',
    'channel-title',
    'channel-version',
    'objects-count',
    'objects-num-bytes-physical',
    'objects-num-bytes-logical',
    'num-bytes-physical',
    'num-bytes-logical',
    'subtype',
    'type'
  ].map((s) => s.toLowerCase())
);

export type ObjectCountsBreakdown = {
  rows: ObjectCountRow[];
  total: number;
  /** Sum or device-reported total bytes when XML includes them; otherwise null. */
  totalBytes: number | null;
};

/**
 * Roku OS app-object-counts document: `<object><type>…</type><count>…</count>` plus optional
 * `<subtype>` and `<num-bytes-physical>`.
 */
function parseAppObjectCountsStructured(xml: string): ObjectCountsBreakdown | null {
  if (!xml.includes('<object>')) return null;
  const blocks = Array.from(xml.matchAll(/<object>([\s\S]*?)<\/object>/gi));
  if (blocks.length === 0) return null;

  const rows: ObjectCountRow[] = [];
  for (const blockMatch of blocks) {
    const block = blockMatch[1];
    const typeM = block.match(/<type>([^<]*)<\/type>/i);
    const subM = block.match(/<subtype>([^<]*)<\/subtype>/i);
    const countM = block.match(/<count>(\d+)<\/count>/i);
    const physM = block.match(/<num-bytes-physical>(\d+)<\/num-bytes-physical>/i);
    const logM = block.match(/<num-bytes-logical>(\d+)<\/num-bytes-logical>/i);
    if (!typeM || !countM) continue;
    const t = typeM[1].trim();
    if (!t) continue;
    const st = subM?.[1]?.trim() ?? '';
    const count = parseInt(countM[1], 10);
    if (!Number.isFinite(count) || count < 0) continue;
    const label =
      st.length > 0 ? `${t} · ${st}`.slice(0, 80) : t.slice(0, 80);
    const bytesRaw = physM?.[1] ?? logM?.[1];
    const bytesParsed = bytesRaw != null ? parseInt(bytesRaw, 10) : NaN;
    const bytes =
      Number.isFinite(bytesParsed) && bytesParsed >= 0 ? bytesParsed : null;
    rows.push({ label, count, bytes });
  }

  if (rows.length === 0) return null;

  const byLabel = new Map<string, ObjectCountRow>();
  for (const r of rows) {
    const prev = byLabel.get(r.label);
    if (!prev) {
      byLabel.set(r.label, { ...r });
    } else {
      const pb = prev.bytes;
      const rb = r.bytes;
      byLabel.set(r.label, {
        label: r.label,
        count: prev.count + r.count,
        bytes:
          pb != null && rb != null ? pb + rb : (pb ?? rb ?? null)
      });
    }
  }
  const merged = [...byLabel.values()].sort((a, b) => b.count - a.count);
  const top = merged.slice(0, 10);

  let total = 0;
  const objectsCountM = xml.match(/<objects-count>(\d+)<\/objects-count>/i);
  if (objectsCountM) {
    total = parseInt(objectsCountM[1], 10);
  }
  const sumMerged = merged.reduce((s, r) => s + r.count, 0);
  if (!objectsCountM || total <= 0 || (sumMerged > 0 && total < sumMerged * 0.5)) {
    total = Math.max(total, sumMerged);
  }

  let totalBytes: number | null = null;
  const physTot = xml.match(
    /<objects-num-bytes-physical>(\d+)<\/objects-num-bytes-physical>/i
  );
  if (physTot) {
    totalBytes = parseInt(physTot[1], 10);
    if (!Number.isFinite(totalBytes) || totalBytes < 0) totalBytes = null;
  }
  if (totalBytes == null) {
    const logTot = xml.match(
      /<objects-num-bytes-logical>(\d+)<\/objects-num-bytes-logical>/i
    );
    if (logTot) {
      totalBytes = parseInt(logTot[1], 10);
      if (!Number.isFinite(totalBytes) || totalBytes < 0) totalBytes = null;
    }
  }

  return { rows: top, total, totalBytes };
}

/** Parse per-type counts (and optional bytes) from app-object-counts XML. */
export function parseObjectCountsBreakdown(xml: string): ObjectCountsBreakdown {
  if (!xml) return { rows: [], total: 0, totalBytes: null };

  const structured = parseAppObjectCountsStructured(xml);
  if (structured) return structured;

  const pairs: ObjectCountRow[] = [];

  const tryPair = (name: string, countStr: string) => {
    const c = parseInt(countStr, 10);
    if (!Number.isFinite(c) || c < 0) return;
    const label = name.trim().slice(0, 48) || 'unknown';
    pairs.push({ label, count: c });
  };

  const bytesByLabel = new Map<string, number>();
  const addBytes = (name: string, bytesStr: string) => {
    const b = parseInt(bytesStr, 10);
    if (!Number.isFinite(b) || b < 0) return;
    const label = name.trim().slice(0, 48) || 'unknown';
    bytesByLabel.set(label, (bytesByLabel.get(label) ?? 0) + b);
  };

  const re1 = /\b(?:type|name|object-class|class)="([^"]+)"[^>]{0,200}?\bcount="(\d+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(xml)) !== null) {
    tryPair(m[1], m[2]);
  }
  if (pairs.length === 0) {
    const re2 = /\bcount="(\d+)"[^>]{0,200}?\b(?:type|name|object-class|class)="([^"]+)"/gi;
    while ((m = re2.exec(xml)) !== null) {
      tryPair(m[2], m[1]);
    }
  }

  const re3 =
    /\b(?:object_class|object-class|objectClass|objectType|objecttype)="([^"]+)"[^>]{0,240}?\b(?:count|value|num)="(\d+)"/gi;
  while ((m = re3.exec(xml)) !== null) {
    tryPair(m[1], m[2]);
  }
  const re4 =
    /\b(?:count|value|num)="(\d+)"[^>]{0,240}?\b(?:object_class|object-class|objectClass|objectType|objecttype)="([^"]+)"/gi;
  while ((m = re4.exec(xml)) !== null) {
    tryPair(m[2], m[1]);
  }

  const reTag = /<([A-Za-z][\w:.-]*)\b[^>]*\bcount="(\d+)"[^>]*\/?>/gi;
  while ((m = reTag.exec(xml)) !== null) {
    const tag = m[1];
    if (OBJECT_COUNT_TAG_EXCLUDE.has(tag.toLowerCase())) continue;
    tryPair(tag, m[2]);
  }

  const reB1 =
    /\b(?:type|name|object-class|class)="([^"]+)"[^>]{0,240}?\b(?:bytes|memory|heap|size)="(\d+)"/gi;
  while ((m = reB1.exec(xml)) !== null) {
    addBytes(m[1], m[2]);
  }
  const reB2 =
    /\b(?:bytes|memory|heap|size)="(\d+)"[^>]{0,240}?\b(?:type|name|object-class|class)="([^"]+)"/gi;
  while ((m = reB2.exec(xml)) !== null) {
    addBytes(m[2], m[1]);
  }
  const reTagBytes = /<([A-Za-z][\w:.-]*)\b[^>]*\b(?:bytes|memory|heap|size)="(\d+)"[^>]*\/?>/gi;
  while ((m = reTagBytes.exec(xml)) !== null) {
    const tag = m[1];
    if (OBJECT_COUNT_TAG_EXCLUDE.has(tag.toLowerCase())) continue;
    addBytes(tag, m[2]);
  }

  const byLabel = new Map<string, number>();
  for (const p of pairs) {
    byLabel.set(p.label, (byLabel.get(p.label) ?? 0) + p.count);
  }
  const rowsSorted = [...byLabel.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  let total = 0;
  const totalM = xml.match(/<total[^>]*>(\d+)<\/total>/i);
  if (totalM) {
    total = parseInt(totalM[1], 10);
  }
  const sumRows = rowsSorted.reduce((s, r) => s + r.count, 0);
  if (rowsSorted.length > 0) {
    if (total <= 0 || (sumRows > 0 && total < sumRows * 0.5)) {
      total = sumRows;
    }
  } else if (total <= 0) {
    total = sumRows;
  }

  let totalBytes: number | null = null;
  const totalBytesAttr = xml.match(/<total[^>]*\b(?:bytes|memory|heap|size)="(\d+)"/i);
  if (totalBytesAttr) {
    totalBytes = parseInt(totalBytesAttr[1], 10);
    if (!Number.isFinite(totalBytes) || totalBytes < 0) totalBytes = null;
  }
  const physAgg = xml.match(
    /<objects-num-bytes-physical>(\d+)<\/objects-num-bytes-physical>/i
  );
  if (totalBytes == null && physAgg) {
    totalBytes = parseInt(physAgg[1], 10);
    if (!Number.isFinite(totalBytes) || totalBytes < 0) totalBytes = null;
  }

  const top = rowsSorted.slice(0, 10).map((r) => ({
    label: r.label,
    count: r.count,
    bytes: bytesByLabel.has(r.label) ? (bytesByLabel.get(r.label) ?? null) : null
  }));

  const sumTopBytes = top.reduce((s, r) => s + (typeof r.bytes === 'number' ? r.bytes : 0), 0);
  if (totalBytes == null && sumTopBytes > 0) {
    totalBytes = sumTopBytes;
  }

  return { rows: top, total, totalBytes };
}

export type TsSeries = {
  id: string;
  color: string;
  values: Array<number | null>;
  /** Horizontal reference across the plot (e.g. memory limit). Not sampled from `values`. */
  yConstant?: number;
};

/** Optional hover scrubber (CPU / memory charts): labels keyed by {@link TsSeries.id}. */
export type TimeseriesHoverOpts = {
  seriesLabels: Record<string, string>;
};

function el<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number>
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    e.setAttribute(k, String(v));
  }
  return e;
}

/** Default chart window if timing settings are missing or invalid (5 min). */
const DEFAULT_CHART_HISTORY_MS = 300_000;

/** Format “mm:ss” for a duration in seconds (time ago / span). */
function formatMmSs(totalSec: number): string {
  if (!Number.isFinite(totalSec)) return '00:00';
  const sec = Math.max(0, Math.round(totalSec));
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function finitePositiveMs(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  return fallback;
}

type AgePoint = { idx: number; age: number };

function seriesHasFiniteSampleAt(s: TsSeries, i: number): boolean {
  if (typeof s.yConstant === 'number' && Number.isFinite(s.yConstant)) return false;
  const v = s.values[i];
  return typeof v === 'number' && Number.isFinite(v);
}

/** True if at least one non-constant series would draw a point at this ring index (see draw loop). */
function indexHasPlottedSample(series: TsSeries[], i: number): boolean {
  for (const s of series) {
    if (seriesHasFiniteSampleAt(s, i)) return true;
  }
  return false;
}

function pickAgeBracket(
  targetAgeMs: number,
  pts: AgePoint[]
): { i0: number; i1: number; alpha: number } {
  if (pts.length === 0) return { i0: 0, i1: 0, alpha: 0 };
  if (pts.length === 1) return { i0: pts[0].idx, i1: pts[0].idx, alpha: 0 };
  const oldest = pts[0];
  const newest = pts[pts.length - 1];
  if (targetAgeMs > oldest.age) return { i0: oldest.idx, i1: oldest.idx, alpha: 0 };
  if (targetAgeMs < newest.age) return { i0: newest.idx, i1: newest.idx, alpha: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const hi = pts[i].age;
    const lo = pts[i + 1].age;
    if (hi >= targetAgeMs && targetAgeMs >= lo) {
      const span = hi - lo;
      const alpha = span > 1e-6 ? (hi - targetAgeMs) / span : 0;
      return { i0: pts[i].idx, i1: pts[i + 1].idx, alpha: Math.max(0, Math.min(1, alpha)) };
    }
  }
  return { i0: newest.idx, i1: newest.idx, alpha: 0 };
}

function lerpSeriesValue(
  values: Array<number | null>,
  i0: number,
  i1: number,
  alpha: number
): number | null {
  const va = values[i0];
  const vb = values[i1];
  if (typeof va === 'number' && Number.isFinite(va) && typeof vb === 'number' && Number.isFinite(vb)) {
    return va * (1 - alpha) + vb * alpha;
  }
  if (typeof va === 'number' && Number.isFinite(va)) return va;
  if (typeof vb === 'number' && Number.isFinite(vb)) return vb;
  return null;
}

function formatHoverAge(ageMs: number): string {
  if (!Number.isFinite(ageMs) || ageMs < 0) return '—';
  if (ageMs < 750) return 'now';
  return `${formatMmSs(ageMs / 1000)} ago`;
}

/**
 * Per-SVG last mouse pointer state, used to restore the hover tooltip after the chart is redrawn
 * (each refresh recreates the hit rect, so without a replay the tooltip vanishes until the cursor
 * moves again).
 */
type LastPointerState = { x: number; y: number; isOver: boolean };
const lastPointerBySvg: WeakMap<SVGSVGElement, LastPointerState> = new WeakMap();

type HoverLayout = {
  pl: number;
  pt: number;
  gw: number;
  gh: number;
  vbW: number;
  vbH: number;
  historyMs: number;
  nowMs: number;
  sampleAt: Array<number | null>;
  series: TsSeries[];
  seriesLabels: Record<string, string>;
  yFormat: (n: number) => string;
  /** Do not interpolate tooltip values across larger wall-clock gaps between bracket samples. */
  maxSampleGapMs: number;
};

function attachTimeseriesHover(svg: SVGSVGElement, h: HoverLayout): void {
  const {
    pl,
    pt,
    gw,
    gh,
    vbW,
    vbH,
    historyMs,
    nowMs,
    sampleAt,
    series,
    seriesLabels,
    yFormat,
    maxSampleGapMs
  } = h;

  const n = Math.min(
    sampleAt.length,
    ...series.map((s) =>
      typeof s.yConstant === 'number' && Number.isFinite(s.yConstant)
        ? sampleAt.length
        : s.values.length
    )
  );
  const hasSampledSeries = series.some(
    (s) => !(typeof s.yConstant === 'number' && Number.isFinite(s.yConstant))
  );
  const pts: AgePoint[] = [];
  for (let i = 0; i < n; i++) {
    const ts = sampleAt[i];
    if (ts == null || !Number.isFinite(ts)) continue;
    const ageMs = nowMs - ts;
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > historyMs) continue;
    if (hasSampledSeries && !indexHasPlottedSample(series, i)) continue;
    pts.push({ idx: i, age: ageMs });
  }
  if (pts.length === 0) return;

  pts.sort((a, b) => b.age - a.age);
  const oldestAge = pts[0].age;
  const newestAge = pts[pts.length - 1].age;

  const hit = el('rect', {
    x: String(pl),
    y: String(pt),
    width: String(gw),
    height: String(gh),
    fill: 'transparent',
    stroke: 'none',
    'pointer-events': 'all',
    class: 'remote-ts-hit-area'
  });

  const hoverG = el('g', { class: 'remote-ts-hover-layer', 'pointer-events': 'none' });
  const vline = el('line', {
    x1: String(pl),
    y1: String(pt),
    x2: String(pl),
    y2: String(pt + gh),
    stroke: 'rgba(255,255,255,0.4)',
    'stroke-width': '1',
    'stroke-dasharray': '4 3',
    visibility: 'hidden',
    class: 'remote-ts-hover-vline'
  });
  const tooltipBg = el('rect', {
    rx: '5',
    ry: '5',
    fill: 'rgba(14, 14, 20, 0.96)',
    stroke: 'rgba(139, 92, 246, 0.35)',
    'stroke-width': '1',
    visibility: 'hidden',
    class: 'remote-ts-hover-tooltip-bg'
  });
  const tooltipTextG = el('g', { class: 'remote-ts-hover-tooltip-text', visibility: 'hidden' });

  hoverG.appendChild(vline);
  hoverG.appendChild(tooltipBg);
  hoverG.appendChild(tooltipTextG);

  function hide(): void {
    vline.setAttribute('visibility', 'hidden');
    tooltipBg.setAttribute('visibility', 'hidden');
    tooltipTextG.setAttribute('visibility', 'hidden');
  }

  function markOver(clientX: number, clientY: number): void {
    lastPointerBySvg.set(svg, { x: clientX, y: clientY, isOver: true });
  }
  function markOut(): void {
    const prev = lastPointerBySvg.get(svg);
    if (prev) lastPointerBySvg.set(svg, { ...prev, isOver: false });
  }

  function showAt(clientX: number, clientY: number): void {
    const p = svg.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      hide();
      return;
    }
    const m = p.matrixTransform(ctm.inverse());
    const mx = m.x;
    const my = m.y;
    if (mx < pl || mx > pl + gw || my < pt || my > pt + gh) {
      hide();
      return;
    }

    const u = (mx - pl) / gw;
    const targetAge = Math.max(0, Math.min(historyMs, (1 - u) * historyMs));
    const spanEps = 0.5;
    if (pts.length === 1) {
      const a = pts[0].age;
      const xSample = pl + gw * (1 - Math.max(0, Math.min(historyMs, a)) / historyMs);
      if (Math.abs(mx - xSample) > 14) {
        hide();
        return;
      }
    } else if (targetAge > oldestAge + spanEps || targetAge < newestAge - spanEps) {
      hide();
      return;
    }

    const { i0, i1, alpha } = pickAgeBracket(targetAge, pts);

    const ts0 = sampleAt[i0];
    const ts1 = sampleAt[i1];
    const age0 =
      ts0 != null && Number.isFinite(ts0) ? nowMs - ts0 : Number.NaN;
    const age1 =
      ts1 != null && Number.isFinite(ts1) ? nowMs - ts1 : Number.NaN;
    const hugeGap =
      maxSampleGapMs > 0 &&
      ts0 != null &&
      ts1 != null &&
      Number.isFinite(ts0) &&
      Number.isFinite(ts1) &&
      Math.abs(ts1 - ts0) > maxSampleGapMs;
    /**
     * Drawing breaks polylines across these gaps, so the X band between the two samples has no line.
     * Snapping hover to the nearer endpoint (below) would still show values under the scrub line in
     * that empty band — suppress series values unless the scrub is essentially at a real sample age.
     */
    const gapHoverDead =
      hugeGap &&
      Number.isFinite(age0) &&
      Number.isFinite(age1) &&
      (() => {
        const olderAge = Math.max(age0, age1);
        const newerAge = Math.min(age0, age1);
        const eps = 0.5;
        return targetAge > newerAge + eps && targetAge < olderAge - eps;
      })();

    let alphaUse = alpha;
    if (hugeGap && !gapHoverDead) {
      alphaUse = Math.abs(targetAge - age0) <= Math.abs(targetAge - age1) ? 0 : 1;
    }

    vline.setAttribute('x1', String(mx));
    vline.setAttribute('x2', String(mx));
    vline.setAttribute('visibility', 'visible');

    const lines: string[] = [formatHoverAge(targetAge)];
    for (const s of series) {
      const constY =
        typeof s.yConstant === 'number' && Number.isFinite(s.yConstant)
          ? s.yConstant
          : null;
      const v =
        constY != null
          ? constY
          : gapHoverDead
            ? null
            : lerpSeriesValue(s.values, i0, i1, alphaUse);
      const label = seriesLabels[s.id] ?? s.id;
      lines.push(`${label}: ${v != null && Number.isFinite(v) ? yFormat(v) : '—'}`);
    }

    const padX = 8;
    const padY = 6;
    const lineH = 12;
    const fontSize = 9;
    const maxChars = Math.max(...lines.map((l) => l.length), 8);
    const tw = Math.min(vbW - pl - 4, Math.max(108, maxChars * 5.8 + padX * 2));
    const th = padY * 2 + lines.length * lineH;

    let tx = mx + 10;
    if (tx + tw > vbW - 4) tx = mx - tw - 10;
    tx = Math.max(4, Math.min(tx, vbW - tw - 4));
    let ty = my - th / 2;
    ty = Math.max(pt + 4, Math.min(ty, pt + gh - th - 4));

    tooltipBg.setAttribute('x', String(tx));
    tooltipBg.setAttribute('y', String(ty));
    tooltipBg.setAttribute('width', String(tw));
    tooltipBg.setAttribute('height', String(th));
    tooltipBg.setAttribute('visibility', 'visible');

    while (tooltipTextG.firstChild) tooltipTextG.removeChild(tooltipTextG.firstChild);
    lines.forEach((line, i) => {
      const t = el('text', {
        x: String(tx + padX),
        y: String(ty + padY + fontSize + i * lineH),
        fill: i === 0 ? 'rgba(148, 163, 184, 0.95)' : 'rgba(241, 245, 249, 0.98)',
        'font-size': String(fontSize),
        'font-family': 'JetBrains Mono, ui-monospace, monospace',
        'font-weight': i === 0 ? '500' : '600'
      });
      t.textContent = line;
      tooltipTextG.appendChild(t);
    });
    tooltipTextG.setAttribute('visibility', 'visible');
  }

  hit.addEventListener('mousemove', (ev) => {
    markOver(ev.clientX, ev.clientY);
    showAt(ev.clientX, ev.clientY);
  });
  hit.addEventListener('mouseleave', () => {
    markOut();
    hide();
  });
  hit.addEventListener('touchstart', (ev) => {
    const touch = ev.touches[0];
    if (touch) showAt(touch.clientX, touch.clientY);
  }, { passive: true });
  hit.addEventListener(
    'touchmove',
    (ev) => {
      const touch = ev.touches[0];
      if (touch) showAt(touch.clientX, touch.clientY);
    },
    { passive: true }
  );
  hit.addEventListener('touchend', hide, { passive: true });
  hit.addEventListener('touchcancel', hide, { passive: true });

  svg.appendChild(hit);
  svg.appendChild(hoverG);

  /**
   * The redraw above wiped the previous hit rect mid-hover. Replay the last known pointer position
   * so the tooltip reappears with updated values instead of waiting for the next mousemove.
   */
  const last = lastPointerBySvg.get(svg);
  if (last && last.isOver) {
    showAt(last.x, last.y);
  }
}

/**
 * Draw a multi-series time-series chart (replaces SVG children).
 * `values` arrays must align index-wise with each other and with `sampleAt`.
 * X-axis spans `historyMs` (may be shorter than the ring’s configured retention while a session ramps up):
 * each point is placed by wall-clock age (`nowMs - sampleAt[i]`), so sparse data still uses the full
 * axis width instead of being squeezed to the right edge.
 * {@link maxSampleGapMs} breaks polylines (and hover interpolation) across longer wall-clock gaps
 * between consecutive plotted samples (e.g. performance polling paused).
 */
export function drawTimeseriesChart(
  svg: SVGSVGElement,
  opts: {
    series: TsSeries[];
    yMin: number;
    yMax: number;
    yTickCount?: number;
    yFormat: (n: number) => string;
    /** Wall ms when each ring slot was sampled; null skips that index. */
    sampleAt: Array<number | null>;
    /** Plot width represents this much history (newest at right). */
    historyMs: number;
    /** Reference time for ages (typically Date.now()). */
    nowMs: number;
    /**
     * Break line segments when consecutive included samples differ in wall time by more than this (ms).
     * Defaults to 30s if unset/invalid.
     */
    maxSampleGapMs?: number;
    /** Vertical scrub line + tooltip at pointer X (CPU / memory). */
    hover?: TimeseriesHoverOpts;
  }
): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const vbW = 420;
  const vbH = 200;
  svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);

  const pl = 36;
  const pr = 4;
  const pt = 10;
  const pb = 28;
  const gw = vbW - pl - pr;
  const gh = vbH - pt - pb;

  const { yMin, yMax, series } = opts;
  const ySpan = yMax - yMin || 1;
  const tickCount = Math.max(2, Math.min(8, opts.yTickCount ?? 5));
  const historyMs = finitePositiveMs(opts.historyMs, DEFAULT_CHART_HISTORY_MS);
  const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();
  const maxGapMs = finitePositiveMs(opts.maxSampleGapMs, 30_000);

  const gridG = el('g', { class: 'remote-ts-grid' });
  const lineG = el('g', { class: 'remote-ts-lines' });
  const labelG = el('g', { class: 'remote-ts-labels' });

  for (let i = 0; i <= tickCount; i++) {
    const t = yMin + (ySpan * i) / tickCount;
    const y = pt + gh - (gh * i) / tickCount;
    const line = el('line', {
      x1: String(pl),
      y1: String(y),
      x2: String(pl + gw),
      y2: String(y),
      stroke: 'rgba(255,255,255,0.07)',
      'stroke-width': '1'
    });
    gridG.appendChild(line);
    const txt = el('text', {
      x: String(pl - 3),
      y: String(y + 3),
      fill: 'var(--text-muted, #888)',
      'font-size': '9',
      'text-anchor': 'end'
    });
    txt.textContent = opts.yFormat(t);
    labelG.appendChild(txt);
  }

  const hasYConstant = series.some(
    (s) => typeof s.yConstant === 'number' && Number.isFinite(s.yConstant)
  );
  const n = Math.min(
    opts.sampleAt.length,
    ...series.map((s) =>
      typeof s.yConstant === 'number' && Number.isFinite(s.yConstant)
        ? Number.POSITIVE_INFINITY
        : s.values.length
    )
  );

  const xFromAgeMs = (ageMs: number) => {
    const a = Math.max(0, Math.min(historyMs, ageMs));
    return pl + gw * (1 - a / historyMs);
  };

  const xTickDivs = 6;
  for (let k = 0; k <= xTickDivs; k++) {
    const agoMs = (historyMs * k) / xTickDivs;
    const x = xFromAgeMs(agoMs);
    /* k === 0 is newest (right edge); middle-anchored “now” was clipped at the SVG/card edge. */
    const isRightmost = k === 0;
    const t = el('text', {
      x: String(isRightmost ? Math.min(pl + gw - 2, vbW - 4) : x),
      y: String(vbH - 6),
      fill: 'var(--text-muted, #888)',
      'font-size': '8',
      'text-anchor': isRightmost ? 'end' : 'middle'
    });
    t.textContent = agoMs < 750 ? 'now' : formatMmSs(agoMs / 1000);
    labelG.appendChild(t);
  }

  if (n < 1 && !hasYConstant) {
    svg.appendChild(gridG);
    svg.appendChild(lineG);
    svg.appendChild(labelG);
    return;
  }

  for (const s of series) {
    if (typeof s.yConstant === 'number' && Number.isFinite(s.yConstant)) continue;
    /** Each segment is a contiguous run of ring indices (no null gaps between samples). */
    const segments: string[][] = [];
    let cur: string[] = [];
    let prevIdx = -999;
    let lastIncludedTs: number | null = null;
    let lastCx = 0;
    let lastCy = 0;
    let lastIdx = -1;
    for (let i = 0; i < n; i++) {
      const ts = opts.sampleAt[i];
      const v = s.values[i];
      if (ts == null || v == null || !Number.isFinite(v)) continue;
      const ageMs = nowMs - ts;
      if (!Number.isFinite(ageMs) || ageMs < 0) continue;
      // Older than the chart window: dropped from the ring logically — do not clamp to the left edge
      if (ageMs > historyMs) continue;
      if (cur.length > 0) {
        if (i - prevIdx > 1) {
          segments.push(cur);
          cur = [];
          lastIncludedTs = null;
        } else if (
          lastIncludedTs != null &&
          (ts < lastIncludedTs || ts - lastIncludedTs > maxGapMs)
        ) {
          segments.push(cur);
          cur = [];
          lastIncludedTs = null;
        }
      }
      const x = xFromAgeMs(ageMs);
      const y = pt + gh - ((v - yMin) / ySpan) * gh;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      cur.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      prevIdx = i;
      lastIncludedTs = ts;
      lastCx = x;
      lastCy = y;
      lastIdx = i;
    }
    if (cur.length > 0) segments.push(cur);
    for (const pts of segments) {
      if (pts.length >= 2) {
        const poly = el('polyline', {
          fill: 'none',
          stroke: s.color,
          /* Thin strokes so overlapping series (e.g. CPU total vs user) stay readable */
          'stroke-width': '1.35',
          points: pts.join(' '),
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
          'shape-rendering': 'geometricPrecision'
        });
        lineG.appendChild(poly);
      }
    }
    if (lastIdx >= 0) {
      const dot = el('circle', {
        cx: String(lastCx.toFixed(2)),
        cy: String(lastCy.toFixed(2)),
        r: '2.25',
        fill: s.color,
        stroke: 'rgba(0,0,0,0.45)',
        'stroke-width': '0.65'
      });
      lineG.appendChild(dot);
    }
  }

  for (const s of series) {
    if (!(typeof s.yConstant === 'number' && Number.isFinite(s.yConstant))) continue;
    const y = pt + gh - ((s.yConstant - yMin) / ySpan) * gh;
    if (!Number.isFinite(y)) continue;
    if (y < pt - 2 || y > pt + gh + 2) continue;
    const hLine = el('line', {
      x1: String(pl),
      y1: String(y.toFixed(2)),
      x2: String(pl + gw),
      y2: String(y.toFixed(2)),
      stroke: s.color,
      'stroke-width': '1.15',
      'stroke-dasharray': '2 4',
      'stroke-opacity': '0.95'
    });
    lineG.appendChild(hLine);
  }

  svg.appendChild(gridG);
  svg.appendChild(lineG);
  svg.appendChild(labelG);

  if (opts.hover && n >= 1) {
    attachTimeseriesHover(svg, {
      pl,
      pt,
      gw,
      gh,
      vbW,
      vbH,
      historyMs,
      nowMs,
      sampleAt: opts.sampleAt,
      series,
      seriesLabels: opts.hover.seriesLabels,
      yFormat: opts.yFormat,
      maxSampleGapMs: maxGapMs
    });
  }
}

/**
 * Tiny time-series (no axes, grid, or hover): same wall-clock x mapping as {@link drawTimeseriesChart}.
 * For header perf strips and similar.
 */
export function drawSparklineTimeseries(
  svg: SVGSVGElement,
  opts: {
    series: TsSeries[];
    yMin: number;
    yMax: number;
    sampleAt: Array<number | null>;
    historyMs: number;
    nowMs: number;
    maxSampleGapMs?: number;
  }
): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const vbW = 88;
  const vbH = 28;
  svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
  svg.setAttribute('preserveAspectRatio', 'none');

  const pl = 2;
  const pr = 2;
  const pt = 2;
  const pb = 2;
  const gw = vbW - pl - pr;
  const gh = vbH - pt - pb;

  const plotBg = el('rect', {
    x: String(pl),
    y: String(pt),
    width: String(gw),
    height: String(gh),
    rx: '3',
    fill: 'rgba(255,255,255,0.05)',
    stroke: 'rgba(255,255,255,0.08)',
    'stroke-width': '1'
  });
  svg.appendChild(plotBg);

  const { yMin, yMax, series } = opts;
  const ySpan = yMax - yMin || 1;
  const historyMs = finitePositiveMs(opts.historyMs, DEFAULT_CHART_HISTORY_MS);
  const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();
  const maxGapMs = finitePositiveMs(opts.maxSampleGapMs, 30_000);

  const xFromAgeMs = (ageMs: number) => {
    const a = Math.max(0, Math.min(historyMs, ageMs));
    return pl + gw * (1 - a / historyMs);
  };

  const n = Math.min(
    opts.sampleAt.length,
    ...series.map((s) =>
      typeof s.yConstant === 'number' && Number.isFinite(s.yConstant)
        ? Number.POSITIVE_INFINITY
        : s.values.length
    )
  );

  const lineG = el('g', { class: 'remote-ts-spark-lines' });

  for (const s of series) {
    if (!(typeof s.yConstant === 'number' && Number.isFinite(s.yConstant))) continue;
    const y = pt + gh - ((s.yConstant - yMin) / ySpan) * gh;
    if (!Number.isFinite(y) || y < pt - 1 || y > pt + gh + 1) continue;
    const hLine = el('line', {
      x1: String(pl),
      y1: String(y.toFixed(2)),
      x2: String(pl + gw),
      y2: String(y.toFixed(2)),
      stroke: s.color,
      'stroke-width': '1',
      'stroke-dasharray': '2 3',
      'stroke-opacity': '0.9'
    });
    lineG.appendChild(hLine);
  }

  for (const s of series) {
    if (typeof s.yConstant === 'number' && Number.isFinite(s.yConstant)) continue;
    const segments: string[][] = [];
    let cur: string[] = [];
    let prevIdx = -999;
    let lastIncludedTs: number | null = null;
    for (let i = 0; i < n; i++) {
      const ts = opts.sampleAt[i];
      const v = s.values[i];
      if (ts == null || v == null || !Number.isFinite(v)) continue;
      const ageMs = nowMs - ts;
      if (!Number.isFinite(ageMs) || ageMs < 0) continue;
      if (ageMs > historyMs) continue;
      if (cur.length > 0) {
        if (i - prevIdx > 1) {
          segments.push(cur);
          cur = [];
          lastIncludedTs = null;
        } else if (
          lastIncludedTs != null &&
          (ts < lastIncludedTs || ts - lastIncludedTs > maxGapMs)
        ) {
          segments.push(cur);
          cur = [];
          lastIncludedTs = null;
        }
      }
      const x = xFromAgeMs(ageMs);
      const y = pt + gh - ((v - yMin) / ySpan) * gh;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      cur.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      prevIdx = i;
      lastIncludedTs = ts;
    }
    if (cur.length > 0) segments.push(cur);
    for (const pts of segments) {
      if (pts.length >= 2) {
        const poly = el('polyline', {
          fill: 'none',
          stroke: s.color,
          'stroke-width': '1.35',
          points: pts.join(' '),
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
          'shape-rendering': 'geometricPrecision'
        });
        lineG.appendChild(poly);
      }
    }
  }

  svg.appendChild(lineG);
}

const DEFAULT_MEM_AXIS_BYTES = 256 * 1024 * 1024;

/**
 * Y-axis top for system memory chart: use chanperf-reported limit (total/limit) when present so the
 * scale is 0 … limit; otherwise a tight MB step ceiling from peak samples (no extra headroom).
 */
export function memChartYAxisMaxBytes(opts: {
  peakSampleBytes: number;
  chanperfLimitBytes: number | null;
}): number {
  const peak =
    typeof opts.peakSampleBytes === 'number' && Number.isFinite(opts.peakSampleBytes) && opts.peakSampleBytes > 0
      ? opts.peakSampleBytes
      : 0;
  const lim = opts.chanperfLimitBytes;
  if (lim != null && Number.isFinite(lim) && lim > 0) {
    return Math.max(lim, peak);
  }
  if (peak <= 0) return DEFAULT_MEM_AXIS_BYTES;
  const mb = peak / (1024 * 1024);
  const step = mb <= 64 ? 8 : mb <= 256 ? 16 : 32;
  return Math.ceil(mb / step) * step * 1024 * 1024;
}

/** @deprecated Prefer {@link memChartYAxisMaxBytes} for charts; kept for callers/tests. */
export function niceMemYMaxBytes(samples: Array<number | null>): number {
  const vals = samples.filter((v): v is number => v != null && Number.isFinite(v));
  if (vals.length === 0) return DEFAULT_MEM_AXIS_BYTES;
  const hi = Math.max(...vals);
  const pad = hi * 0.12 + 8 * 1024 * 1024;
  const target = hi + pad;
  const mb = target / (1024 * 1024);
  const step = mb <= 64 ? 8 : mb <= 256 ? 16 : 32;
  const roundedMb = Math.ceil(mb / step) * step;
  return roundedMb * 1024 * 1024;
}
