import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import type {
  HotspotClientDevice,
  MockResponse,
  NetworkHttpMessage,
  NetworkInspectorCaInfo,
  NetworkInspectorListener,
  NetworkInspectorStatus,
  ParsedNetworkEvent,
  DeviceTrafficRules,
  NetworkTrafficRules,
  MitmPortConflict,
  ReplayHttpInput,
  ReplayRequestOptions,
  ReplayResult,
  TrafficDecision
} from './types';
import { detectPortHolder, isAddressInUseError, type PortHolder } from './port-conflict';
import {
  DEFAULT_MAX_RAW_PACKETS_PER_DEVICE,
  clampMaxRawPacketsPerDevice,
  DEFAULT_MAX_BODY_RETAINED_BYTES,
  clampMaxBodyRetainedBytes,
  resolveTrafficDecision
} from './types';
import { scanHotspotSubnet } from './device-matcher';
import { CaptureEngine } from './capture-engine';
import { getCapturePlatform } from './platform';
import type { CapturePlatform, HotspotInterfaceInfo } from './platform/types';
import { getCaInfo, getOrCreateCa, warmLeafKeyPair } from './ca-store';
import { niLog, niWarn } from './log';
import { throttle, exponentialBackoff, type Cancellable, type BackoffStepper } from 'roku-dev-studio-platform/async-patterns';
// Re-export the contract types from the package root so consumers (remote server, app) can import
// them without reaching into the ./types subpath.
export type {
  NetworkInspectorListener,
  NetworkInspectorStatus,
  ParsedNetworkEvent,
  ParsedNetworkEventType,
  NetworkHttpMessage,
  HotspotClientDevice,
  NetworkInspectorCaInfo,
  TrafficThrottle,
  HostTrafficRule,
  DeviceTrafficRules,
  NetworkTrafficRules,
  TrafficDecision,
  MitmPortConflict,
  NetworkInspectorDeviceJoinedPayload,
  NetworkInspectorDeviceLeftPayload,
  ReplayHttpInput,
  ReplayRequestOptions,
  ReplayResult
} from './types';

// Re-exported for the app's Electron factory (initNetworkInspectorFromSettings), which lives in the
// app layer because it wires the Electron IPC adapter.
export { initCaStore } from './ca-store';
// Host-originated Replay (Replay / Edit & Resend). Re-exported from the package root so consumers
// (app main, remote server) import it without reaching into the ./mitm-proxy subpath. The replay
// TYPES are re-exported with the other contract types in the block above.
export { performReplay } from './mitm-proxy';
// Public capture-readiness API (used by the app's Settings window + status surfaces, and the
// remote server). Re-exported here so consumers import from the package root, not deep paths.
export {
  detectBpfCaptureAvailable,
  detectNpcapInstalled,
  detectLinuxCaptureAvailable,
  detectCapModuleAvailable,
  defaultCapturePermissionHint
} from './capture-engine';
export { isBpfLaunchDaemonInstalled, installBpfAccessMacOS } from './bpf-access-macos';
// "Find in content" matcher — shared by the desktop app (over disk-backed detail) and the offline
// Session Viewer (over in-memory events) so search semantics stay identical.
export {
  createContentMatcher,
  createContentMatchers,
  matchEventContent,
  matchEventContentMulti,
  findNeedsDetail,
  findNeedsDetailMulti,
  ALL_FIND_SCOPES
} from './content-search';
export type {
  NetworkFindScope,
  NetworkFindScopeCounts,
  NetworkFindTermCounts,
  NetworkFindMatch,
  NetworkFindOptions,
  NetworkFindTerm,
  NetworkFindRequest,
  CompiledFindTerm,
  ContentMatcher
} from './content-search';
export { installCaptureAccessLinux } from './capture-access-linux';
// Per-platform capture worker abstraction (one provider per OS behind a common contract).
export { getCapturePlatform } from './platform';
export type { CapturePlatform, PlatformCaptureReadiness } from './platform/types';
import { RokuMitmProxy, performReplay, type MitmTransaction } from './mitm-proxy';
import { mitmTransactionToEvent } from './mitm-events';
import {
  opsFor,
  applyRequestUrl,
  applyHeaderOps,
  applyBodyReplace,
  statusOverride,
  hasUrlRewrite,
  hasBodyReplace
} from './rewrite';
import { NetworkDetailStore } from './detail-store';
import {
  createContentMatchers,
  matchEventContentMulti,
  findNeedsDetailMulti,
  type NetworkFindMatch,
  type NetworkFindRequest
} from './content-search';
import { extractFrameIps } from './packet-parser';
import { exportCaCertToFile, exportCaPemToFile } from './channel-ca-inject';

const DEFAULT_MITM_PORT = 8888;

export type NetworkInspectorBootConfig = {
  enabled: boolean;
  mitmEnabled?: boolean;
  mitmPort?: number;
  maxRawPacketsPerDevice?: number;
  /** Max bytes of each body retained for display (snapshot-only; never affects forwarded traffic). */
  maxBodyRetainedBytes?: number;
  userDataPath?: string;
  /** Per-device block/throttle rules to hydrate on boot (persisted in settings). */
  trafficRules?: NetworkTrafficRules;
};

type RawPacketRecord = { timestampMs: number; frame: Buffer };

/** Decoded body size in bytes (base64 carries ~4/3 the chars of its raw bytes). */
function bodyByteSize(msg: NetworkHttpMessage | undefined): number {
  if (!msg?.body) return 0;
  if (msg.bodyEncoding === 'base64') return Math.floor((msg.body.length * 3) / 4);
  return Buffer.byteLength(msg.body, 'utf8');
}

function bareContentType(msg: NetworkHttpMessage | undefined): string | undefined {
  const h = msg?.headers;
  if (!h) return undefined;
  const raw = h['content-type'] || h['Content-Type'] || h['contenttype'];
  if (!raw) return undefined;
  return raw.split(';')[0].trim().toLowerCase() || undefined;
}

/**
 * Strip the heavy `headers`/`body` from an event, keeping only the lightweight fields the list
 * view and Overview tab need (method/url/status + content-type + decoded size). The full event
 * is persisted to the detail store separately and re-fetched on demand.
 */
function summarizeHttpMessage(msg: NetworkHttpMessage | undefined): NetworkHttpMessage | undefined {
  if (!msg) return undefined;
  const summary: NetworkHttpMessage = {
    method: msg.method,
    url: msg.url,
    statusCode: msg.statusCode,
    statusText: msg.statusText,
    bodyTruncated: msg.bodyTruncated,
    bodyEncoding: msg.bodyEncoding,
    contentType: bareContentType(msg),
    bodyBytes: bodyByteSize(msg)
  };
  return summary;
}

function summarizeEvent(ev: ParsedNetworkEvent, detailAvailable: boolean): ParsedNetworkEvent {
  return {
    id: ev.id,
    type: ev.type,
    deviceIp: ev.deviceIp,
    timestamp: ev.timestamp,
    // Preserve hostname for the list/host-grouping even though the `host` header is dropped.
    hostname: ev.hostname || ev.httpRequest?.headers?.host || ev.httpRequest?.headers?.Host,
    resolvedIps: ev.resolvedIps,
    sni: ev.sni,
    destIp: ev.destIp,
    destPort: ev.destPort,
    ttl: ev.ttl,
    flowId: ev.flowId,
    httpRequest: summarizeHttpMessage(ev.httpRequest),
    httpResponse: summarizeHttpMessage(ev.httpResponse),
    mitm: ev.mitm,
    // Keep the replay flag on the list summary so a replayed row stays first-class (labeled/filterable)
    // even before its full detail is (re)loaded from disk.
    ...(ev.replay ? { replay: true } : {}),
    durationMs: ev.durationMs,
    // Per-phase timing rides the summary too, so the Overview waterfall renders before the on-disk
    // detail loads (the detail-store put persists the full event, so a later detail load keeps it).
    timing: ev.timing,
    // Only worth fetching detail when there's an HTTP message with headers/body on disk; DNS/TLS
    // events carry nothing extra, so the renderer renders them from the summary directly.
    detailAvailable: detailAvailable && (!!ev.httpRequest || !!ev.httpResponse)
  };
}

/**
 * Read-only filter for the agent/MCP query surface over the captured summary buffer. Every field is
 * optional and AND-combined. `host` is a case-insensitive substring matched against hostname / SNI /
 * request URL; `method` and `type` are exact; `errorsOnly` keeps responses with status >= 400;
 * `mitmOnly` keeps decrypted-HTTPS transactions; `deviceIp` scopes to a single Roku's hotspot lease.
 */
export type NetworkEventQuery = {
  deviceIp?: string;
  host?: string;
  method?: string;
  type?: ParsedNetworkEvent['type'];
  errorsOnly?: boolean;
  mitmOnly?: boolean;
  limit?: number;
};

/** Aggregated rollup returned by {@link NetworkInspectorService.analyzeEvents}. */
export type NetworkEventAnalysis = {
  totalMatched: number;
  byType: Record<string, number>;
  byStatusClass: Record<string, number>;
  topHosts: Array<{ host: string; count: number; errors: number }>;
  topContentTypes: Array<{ contentType: string; count: number }>;
  httpTransactions: number;
  mitmTransactions: number;
  errors: number;
  largestResponses: Array<{ id: string; host?: string; url?: string; status?: number; bytes: number }>;
};

const MAX_QUERY_LIMIT = 2000;
const DEFAULT_QUERY_LIMIT = 200;

function clampQueryLimit(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : NaN;
  if (Number.isNaN(n) || n <= 0) return DEFAULT_QUERY_LIMIT;
  return Math.min(MAX_QUERY_LIMIT, n);
}

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  return 'other';
}

/** Best host label for grouping: hostname, then SNI, then the URL's host, then dest IP. */
function eventHostLabel(ev: ParsedNetworkEvent): string {
  if (ev.hostname) return ev.hostname;
  if (ev.sni) return ev.sni;
  const url = ev.httpRequest?.url;
  if (url) {
    try {
      const u = url.includes('://') ? new URL(url) : new URL(`http://${url}`);
      if (u.hostname) return u.hostname;
    } catch {
      /* fall through */
    }
  }
  return ev.destIp || 'unknown';
}

/** AND-combined predicate for {@link NetworkEventQuery} over a summary event. */
function eventMatchesQuery(ev: ParsedNetworkEvent, q: NetworkEventQuery): boolean {
  if (q.deviceIp && ev.deviceIp !== q.deviceIp) return false;
  if (q.type && ev.type !== q.type) return false;
  if (q.mitmOnly && !ev.mitm) return false;
  if (q.method) {
    const m = (ev.httpRequest?.method || '').toUpperCase();
    if (m !== q.method.toUpperCase()) return false;
  }
  if (q.errorsOnly) {
    const status = ev.httpResponse?.statusCode;
    if (!(typeof status === 'number' && status >= 400)) return false;
  }
  if (q.host) {
    const needle = q.host.toLowerCase();
    const hay = [ev.hostname, ev.sni, ev.httpRequest?.url]
      .filter((s): s is string => !!s)
      .join(' ')
      .toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

const CAPTURE_SUPPRESS_COOLDOWN_MS = 30_000;
const MITM_PORT_CONFLICT_DISABLE_MS = 30_000;
const STATUS_BROADCAST_DEBOUNCE_MS = 150;

/**
 * Apply a decision's REQUEST rewrite ops to a replay input, returning a mutated copy. Pure: URL/header
 * ops reuse the shared rewrite helpers; a body-replace applies only to a textual body (a captured
 * base64 blob is left unchanged). Header-only rewrites skip URL re-serialization.
 */
function applyRequestRewriteToInput(input: ReplayHttpInput, decision: TrafficDecision): ReplayHttpInput {
  const reqOps = opsFor(decision.rewrite, 'request');
  if (!reqOps.length) return input;
  const url = hasUrlRewrite(reqOps) ? applyRequestUrl(reqOps, input.url) : input.url;
  const headers = applyHeaderOps(reqOps, { ...(input.headers || {}) });
  let body = input.body;
  let bodyEncoding = input.bodyEncoding;
  if (hasBodyReplace(reqOps) && typeof body === 'string' && body && bodyEncoding !== 'base64') {
    body = applyBodyReplace(reqOps, body);
    bodyEncoding = 'text';
  }
  return { method: input.method, url, headers, body, bodyEncoding };
}

/**
 * Apply a decision's RESPONSE rewrite ops (status / header / body-replace) to a replay result.
 * `performReplay` already decoded the body, so a text body-replace works directly (no zlib needed);
 * a base64 (binary) body is left unchanged.
 */
function applyResponseRewriteToResult(result: ReplayResult, decision: TrafficDecision): ReplayResult {
  const resOps = opsFor(decision.rewrite, 'response');
  if (!resOps.length) return result;
  const response: NetworkHttpMessage = { ...result.response };
  const st = statusOverride(resOps);
  if (st !== undefined) response.statusCode = st;
  response.headers = applyHeaderOps(resOps, { ...(response.headers || {}) });
  if (hasBodyReplace(resOps) && typeof response.body === 'string' && response.body && response.bodyEncoding !== 'base64') {
    response.body = applyBodyReplace(resOps, response.body);
    response.bodyEncoding = 'text';
  }
  return { ...result, response };
}

export class NetworkInspectorService {
  private enabled = false;
  private mitmEnabled = false;
  private mitmPort = DEFAULT_MITM_PORT;
  private mitmProxy: RokuMitmProxy | null = null;
  private mitmTransactions = 0;
  private mitmLastError: string | undefined;
  // Set when the proxy can't bind its port because another process holds it. Carries the offending
  // process + remediation so the Network tab can warn the user. Cleared once the proxy binds.
  private mitmPortConflict: MitmPortConflict | undefined;
  // First-seen timestamp for the current continuous MITM port-conflict run. If the port stays
  // unavailable for long enough, Network Inspector auto-disables to match other blocking failures.
  private mitmPortConflictSince = 0;
  private gatewayIp: string | undefined;
  // The per-OS capture worker. All platform-specific behavior (hotspot detection, readiness,
  // prerequisites, capture mechanism, one-click setup) is routed through this single contract,
  // so the orchestrator below has no `process.platform` branches.
  private readonly platform: CapturePlatform = getCapturePlatform();
  private capture = new CaptureEngine(() => this.platform.createFrameSource());
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private clients = new Map<string, HotspotClientDevice>();
  private matchedSerials = new Set<string>();
  // In-memory buffer holds only lightweight summaries (no headers/bodies — those live on disk in
  // the detail store), so a large count is cheap. Bounds metadata memory; full payloads never
  // accumulate in RAM, which is what previously bloated memory and caused GC-driven sluggishness.
  private eventBuffer: ParsedNetworkEvent[] = [];
  // Raw frames bucketed by the device they belong to so a per-device pcap export keeps a full
  // window of that Roku's traffic even when another hotspot client is far chattier. Frames that
  // don't resolve to a tracked device / hotspot client aren't retained (they aren't exportable
  // per-device anyway). Memory is bounded to ~ maxRawPacketsPerDevice × active devices.
  private rawPacketsByDevice = new Map<string, RawPacketRecord[]>();
  // Monotonic mutation counter + per-event sequence, powering cursor-based delta polling. Every
  // add/update bumps `mutationSeq` and stamps the event id, so a poller can ask "what changed since
  // cursor N" and get only new/updated events instead of re-fetching (and re-merging) the buffer.
  private mutationSeq = 0;
  private readonly eventSeq = new Map<string, number>();
  private readonly maxEvents = 50_000;
  private maxRawPacketsPerDevice = DEFAULT_MAX_RAW_PACKETS_PER_DEVICE;
  private maxBodyRetainedBytes = DEFAULT_MAX_BODY_RETAINED_BYTES;
  private lastError: string | undefined;
  // Set when a capture attempt fails with a blocking error (permission/missing tool) so the 4s
  // tick doesn't respawn the capture process in a loop. Cleared when readiness is restored
  // (macOS BPF re-check, Linux/Windows explicit setup) or when the inspector is re-enabled.
  private captureStartSuppressed = false;
  // When capture was suppressed by a (possibly transient) error, so the tick can auto-retry after a
  // cooldown — but only when the platform still reports the capture tool available (so a genuine
  // permission failure stays suppressed instead of respawning tcpdump/Npcap in a loop).
  private captureSuppressedAt = 0;
  private captureInterface: string | undefined;
  private hotspotSubnet: string | undefined;
  private hotspotSubnetPrefix: string | undefined;
  private lastSubnetScanAt = 0;
  // Subnet scan cadence with exponential backoff: stays at the floor while the discovered device set
  // keeps changing, and doubles up to the ceiling once the set is stable (or empty) so an idle
  // hotspot isn't probed with 254 HTTP gets every cycle.
  private readonly subnetScanBackoff: BackoffStepper = exponentialBackoff({ baseMs: 12_000, maxMs: 60_000 });
  // Guards against overlapping ticks: a slow subnet scan can exceed the 4s timer, and `setInterval`
  // would otherwise stack a second tick (and a second scan) on top of the in-flight one.
  private tickInFlight = false;
  // Trailing throttle: a burst of state changes (a tick + many event flushes) collapses into one
  // getStatus() rebuild + emit. The latest state is read at fire time, so nothing is lost.
  private readonly broadcastStatus: Cancellable<[]> = throttle(
    () => this.listener.onStatus(this.getStatus()),
    STATUS_BROADCAST_DEBOUNCE_MS
  );
  // Throttle for the periodic diagnostics line emitted from the tick (so logs stay readable).
  private lastStatsLogAt = 0;
  private readonly statsLogIntervalMs = 10_000;
  // Consecutive missed subnet scans per client key. A single missed probe (Wi‑Fi
  // hiccup, device asleep) shouldn't evict a Roku and fire onDeviceLeft — only
  // remove after this many consecutive misses (~2 scans ≈ 24s of silence).
  private readonly clientMissCounts = new Map<string, number>();
  private readonly maxClientScanMisses = 2;
  private pendingEvents: ParsedNetworkEvent[] = [];
  // Trailing throttle: batch enqueued events into one onEvents() emit per ~100ms.
  private readonly scheduleEventFlush: Cancellable<[]> = throttle(() => {
    const batch = this.pendingEvents.splice(0, this.pendingEvents.length);
    if (batch.length > 0) this.listener.onEvents(batch);
  }, 100);
  private trackedDeviceIps = new Set<string>();
  // On-disk store for full headers/bodies; memory keeps only lightweight summaries.
  private detailStore: NetworkDetailStore | null = null;
  // Session-scoped user notes keyed by event id. Deliberately kept in this in-memory side map (NOT
  // written into the append-only detail-store .ndjson — a note edit would otherwise re-serialize the
  // whole record). Surfaced on both the list summary and the on-disk detail; not restart-persistent.
  private readonly eventNotes = new Map<string, string>();
  private userDataPath: string | undefined;
  // Incremental Find cache: memoized per-event match result for the CURRENT term signature. A captured
  // event is immutable once its detail is available, so re-searching every event on each live refresh
  // is wasted work — with the cache, a same-signature re-search only computes newly-arrived events
  // (O(Δ) instead of O(N) disk reads). Invalidated when the term set changes or events are removed.
  private findCache = new Map<string, NetworkFindMatch | null>();
  private findCacheSig = '';
  /** Device IPs for which the UI has paused session recording (events are dropped). */
  private pausedRecordingDeviceIps = new Set<string>();
  // Per-device block/throttle rules (keyed by device IP), enforced by the MITM proxy on proxied
  // requests. Held in memory for the session; the renderer is the source of truth and re-applies.
  private trafficRules = new Map<string, DeviceTrafficRules>();
  // Transport-agnostic sink (Electron IPC in the app, HTTP/SSE on the remote server). The engine
  // never references IPC channels directly — see NetworkInspectorListener.
  private listener: NetworkInspectorListener;

  constructor(listener: NetworkInspectorListener) {
    this.listener = listener;
  }

  setEnabled(enabled: boolean): void {
    niLog(`setEnabled(${enabled}) — platform=${this.platform.platform}, mitmEnabled=${this.mitmEnabled}`);
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    } else {
      this.lastError = undefined;
      this.captureStartSuppressed = false;
      this.captureSuppressedAt = 0;
      this.mitmPortConflictSince = 0;
      this.startPolling();
      if (this.mitmEnabled) this.startMitm();
    }
    this.broadcastStatus();
  }

  setMitmEnabled(enabled: boolean): void {
    this.mitmEnabled = enabled;
    if (!enabled) {
      this.stopMitm();
      this.clearMitmError();
    } else if (this.enabled) {
      this.startMitm();
    }
    this.broadcastStatus();
  }

  setMitmPort(port: number): void {
    const next = Number.isFinite(port) && port > 0 && port < 65536 ? Math.floor(port) : DEFAULT_MITM_PORT;
    if (next === this.mitmPort) return;
    this.mitmPort = next;
    // The conflict (if any) was about the previous port; drop it and re-attempt on the new port.
    this.mitmPortConflict = undefined;
    this.mitmLastError = undefined;
    this.stopMitm();
    if (this.mitmEnabled && this.enabled) this.startMitm();
    this.broadcastStatus();
  }

  /** Update the per-device raw frame retention cap and trim any existing buckets to fit. */
  setMaxRawPacketsPerDevice(limit: number): void {
    const next = clampMaxRawPacketsPerDevice(limit);
    if (next === this.maxRawPacketsPerDevice) return;
    this.maxRawPacketsPerDevice = next;
    for (const [ip, frames] of this.rawPacketsByDevice) {
      if (frames.length > next) frames.splice(0, frames.length - next);
      if (frames.length === 0) this.rawPacketsByDevice.delete(ip);
    }
    this.broadcastStatus();
  }

  getMaxRawPacketsPerDevice(): number {
    return this.maxRawPacketsPerDevice;
  }

  /** Update the retained-body display cap (bytes). Snapshot-only — applies to transactions captured
   *  from here on; never affects bytes forwarded to the device. */
  setMaxBodyRetainedBytes(limit: number): void {
    const next = clampMaxBodyRetainedBytes(limit);
    if (next === this.maxBodyRetainedBytes) return;
    this.maxBodyRetainedBytes = next;
    this.broadcastStatus();
  }

  getMaxBodyRetainedBytes(): number {
    return this.maxBodyRetainedBytes;
  }

  /** All per-device block/throttle rules (keyed by device IP). */
  getTrafficRules(): NetworkTrafficRules {
    const out: NetworkTrafficRules = {};
    for (const [ip, rules] of this.trafficRules) out[ip] = rules;
    return out;
  }

  getDeviceTrafficRules(deviceIp: string): DeviceTrafficRules | undefined {
    return this.trafficRules.get(deviceIp);
  }

  /** Replace the rules for one device (empty/undefined clears them). */
  setDeviceTrafficRules(deviceIp: string, rules: DeviceTrafficRules | undefined): void {
    const ip = typeof deviceIp === 'string' ? deviceIp.trim() : '';
    if (!ip) return;
    const hasRules =
      !!rules &&
      (rules.blockAll ||
        (rules.hosts && rules.hosts.length > 0) ||
        !!rules.throttle ||
        !!rules.noCaching ||
        !!rules.blockCookies);
    if (hasRules) this.trafficRules.set(ip, rules as DeviceTrafficRules);
    else this.trafficRules.delete(ip);
    this.broadcastStatus();
  }

  /** Replace all device rules at once (used to hydrate from the renderer/persisted config). */
  setAllTrafficRules(all: NetworkTrafficRules | undefined): void {
    this.trafficRules.clear();
    if (all && typeof all === 'object') {
      for (const [ip, rules] of Object.entries(all)) {
        if (ip && rules) this.trafficRules.set(ip, rules);
      }
    }
    this.broadcastStatus();
  }

  /**
   * Replay (re-issue) an HTTP(S) request FROM THE RDS HOST and inject the result as a first-class
   * event row. `input` carries method/url/headers/body; `deviceIp` attributes the synthetic event to
   * a watched device's list; `applyTrafficRules` runs it through that device's block/rewrite rules
   * (throttle is a host-origin no-op and is ignored); `timeoutMs` bounds the wait. The resulting
   * transaction is converted via the same `mitmTransactionToEvent` path (marked `replay: true`) and
   * enqueued — so it persists to the detail store, pushes over the capture-events channel, and is
   * searchable/exportable/savable with no new rendering. Returns the full event so the renderer can
   * select it immediately. Never throws: a bad URL / network error surfaces as `{ success: false }`.
   */
  async replayRequest(
    payload: { input: ReplayHttpInput } & ReplayRequestOptions
  ): Promise<{ success: boolean; event?: ParsedNetworkEvent; error?: string }> {
    const input = payload?.input;
    if (!input || typeof input.url !== 'string' || !input.url) {
      return { success: false, error: 'invalid url' };
    }
    let parsed: URL;
    try {
      parsed = new URL(input.url);
    } catch {
      return { success: false, error: `Invalid URL: ${input.url}` };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { success: false, error: `Unsupported protocol: ${parsed.protocol}` };
    }

    const deviceIp = typeof payload.deviceIp === 'string' ? payload.deviceIp : '';
    const timeoutMs = payload.timeoutMs;
    const startedAtISO = new Date().toISOString();
    const path = `${parsed.pathname}${parsed.search}`;
    const destPort = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;

    let result: ReplayResult;
    try {
      result =
        payload.applyTrafficRules && deviceIp
          ? await this.replayWithTrafficRules(input, deviceIp, parsed.hostname, path, destPort, timeoutMs)
          : await performReplay(input, { timeoutMs });
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    const tx: MitmTransaction = {
      transactionId: `replay-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
      deviceIp,
      timestamp: startedAtISO,
      hostname: result.hostname || parsed.hostname,
      destPort: result.destPort || destPort,
      request: result.request,
      response: result.response,
      durationMs: result.durationMs,
      replay: true
    };
    const ev = mitmTransactionToEvent(tx, this.maxBodyRetainedBytes);
    this.enqueueEvents([ev]);
    return { success: true, event: ev };
  }

  /**
   * Replay with this device's active traffic rules applied. Block / reset / mock short-circuit into a
   * synthetic response (no upstream call); otherwise request rewrite ops mutate the outgoing input and
   * response rewrite ops mutate `performReplay`'s (already-decoded) result — reusing the pure rewrite
   * helpers with no body-codec duplication. Throttle is a host-origin no-op and is deliberately ignored.
   */
  private async replayWithTrafficRules(
    input: ReplayHttpInput,
    deviceIp: string,
    hostname: string,
    path: string,
    destPort: number,
    timeoutMs: number | undefined
  ): Promise<ReplayResult> {
    const decision = resolveTrafficDecision(this.trafficRules.get(deviceIp), hostname, path);
    const reqSnapshot: NetworkHttpMessage = {
      method: (input.method || 'GET').toUpperCase(),
      url: input.url,
      headers: { ...(input.headers || {}) },
      ...(input.body ? { body: input.body, bodyEncoding: input.bodyEncoding || 'text' } : {})
    };
    const synthetic = (statusCode: number, statusText: string, body: string): ReplayResult => ({
      ok: false,
      request: reqSnapshot,
      response: { statusCode, statusText, body },
      durationMs: 0,
      hostname,
      destPort
    });

    if (decision.block) return synthetic(403, 'Blocked by RDS', 'Blocked by Roku Dev Studio traffic rules');
    if (decision.resetConnection) {
      return synthetic(0, 'Connection reset (RDS fault)', 'Connection reset by Roku Dev Studio traffic rule');
    }
    if (decision.respond) return this.mockReplayResult(decision.respond, reqSnapshot, hostname, destPort);

    // Non-terminal: apply request rewrite ops to the outgoing input, then response ops to the result.
    const mutatedInput = applyRequestRewriteToInput(input, decision);
    const result = await performReplay(mutatedInput, { timeoutMs });
    return applyResponseRewriteToResult(result, decision);
  }

  /**
   * Build a synthetic {@link ReplayResult} for a mock ("respond") rule when replaying with rules.
   * Inline body is served as-is; a Map Local `filePath` is read from disk (missing/unreadable → 502).
   */
  private async mockReplayResult(
    mock: MockResponse,
    request: NetworkHttpMessage,
    hostname: string,
    destPort: number
  ): Promise<ReplayResult> {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(mock.headers || {})) headers[k.toLowerCase()] = v;
    if (mock.contentType) headers['content-type'] = mock.contentType;
    let bodyBuf: Buffer;
    const filePath = (mock.filePath || '').trim();
    if (filePath) {
      try {
        bodyBuf = await fs.promises.readFile(filePath);
        if (!headers['content-type']) headers['content-type'] = 'application/octet-stream';
      } catch (err) {
        const msg = `Map Local: ${err instanceof Error ? err.message : String(err)}`;
        return {
          ok: false,
          request,
          response: { statusCode: 502, statusText: 'Map Local Failed', body: msg },
          durationMs: 0,
          hostname,
          destPort,
          error: msg
        };
      }
    } else {
      bodyBuf = Buffer.from(mock.body || '', 'utf8');
    }
    const ct = (headers['content-type'] || '').toLowerCase();
    const textual =
      !ct || ct.startsWith('text/') || /(json|xml|javascript|ecmascript|graphql|csv|x-www-form-urlencoded|svg)/.test(ct);
    const response: NetworkHttpMessage = {
      statusCode: mock.statusCode,
      statusText: mock.statusText || 'Mocked',
      headers,
      ...(bodyBuf.length
        ? { body: textual ? bodyBuf.toString('utf8') : bodyBuf.toString('base64'), bodyEncoding: textual ? 'text' : 'base64' }
        : {})
    };
    return { ok: true, request, response, durationMs: 0, hostname, destPort };
  }

  getMitmProxyHostPort(): string {
    // Prefer the hotspot gateway when one exists; otherwise fall back to this machine's primary
    // LAN IP so the snippet works on a shared Wi-Fi (no hotspot) setup. The old `192.168.2.1`
    // default is only correct on macOS Internet Sharing and is misleading off-hotspot.
    const host =
      this.gatewayIp || this.resolveGatewayIp() || detectPrimaryLanIp() || '192.168.2.1';
    return `${host}:${this.mitmPort}`;
  }

  getCaInfo(): NetworkInspectorCaInfo {
    const proxyHostPort = this.getMitmProxyHostPort();
    const info = getCaInfo();
    return {
      commonName: info.commonName,
      fingerprintSha256: info.fingerprintSha256,
      createdAt: info.createdAt,
      expiresAt: info.expiresAt,
      proxyHostPort
    };
  }

  exportCaPem(targetPath: string): { success: boolean; error?: string } {
    return exportCaPemToFile(targetPath);
  }

  exportCaCert(targetPath: string): { success: boolean; error?: string } {
    return exportCaCertToFile(targetPath);
  }

  /**
   * Grant packet-capture access with a one-time admin prompt, then (if it worked) kick capture off
   * without an app restart. Platform-dispatched: macOS installs the ChmodBPF launch daemon, Linux
   * applies tcpdump capabilities via pkexec, Windows points at the Npcap installer (no silent
   * install). The return shape keeps the macOS-era `bpfCaptureAvailable` field so existing callers
   * keep working, and adds `captureToolAvailable` as the cross-platform equivalent.
   */
  async installCaptureAccess(): Promise<{
    success: boolean;
    error?: string;
    bpfCaptureAvailable?: boolean;
    captureToolAvailable?: boolean;
    launchDaemonInstalled?: boolean;
  }> {
    // The selected platform worker owns the grant (macOS BPF, Linux setcap) or returns the
    // external-installer guidance (Windows Npcap). It also updates any cached readiness internally.
    const result = await this.platform.installCaptureAccess();
    if (result.captureToolAvailable) {
      this.lastError = undefined;
      this.captureStartSuppressed = false;
      if (this.platform.isHotspotConfidentlyActive() && this.enabled && !this.captureInterface) {
        const iface = this.platform.detectHotspotInterface();
        if (iface) {
          this.startCapture(iface.name, iface.subnet);
          this.captureInterface = iface.name;
          this.hotspotSubnet = `${iface.subnet}.0/24`;
          this.hotspotSubnetPrefix = iface.subnet;
        }
      }
    }
    this.broadcastStatus();
    return result;
  }

  /** @deprecated Back-compat alias for {@link installCaptureAccess}; kept for existing IPC wiring. */
  async installBpfAccess(): Promise<{
    success: boolean;
    error?: string;
    bpfCaptureAvailable?: boolean;
    captureToolAvailable?: boolean;
    launchDaemonInstalled?: boolean;
  }> {
    return this.installCaptureAccess();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getStatus(): NetworkInspectorStatus {
    const ca = this.mitmEnabled ? getOrCreateCa() : undefined;
    // All capture-readiness detection is delegated to the per-OS worker — one structured readiness
    // object drives the cross-platform `captureToolAvailable`, the per-platform detail flags, and
    // the structured prerequisites/remediation. No `process.platform` branching here.
    const readiness = this.platform.getReadiness();
    return {
      enabled: this.enabled,
      platform: this.platform.platform,
      hotspotState: this.resolveHotspotState(),
      captureInterface: this.captureInterface,
      captureActive: !!this.captureInterface,
      hotspotInterfaceDetected: this.platform.isHotspotConfidentlyActive(),
      hotspotSubnet: this.hotspotSubnet,
      hotspotGatewayIp: this.gatewayIp || this.resolveGatewayIp(),
      connectedClients: Array.from(this.clients.values()),
      matchedSerials: Array.from(this.matchedSerials),
      packetsCaptured: this.capture.getPacketsCaptured(),
      rawPacketsAvailable: Array.from(this.rawPacketsByDevice.values()).reduce(
        (sum, frames) => sum + frames.length,
        0
      ),
      packetsDropped: 0,
      eventsBuffered: this.eventBuffer.length,
      lastError: this.lastError,
      npcapInstalled: readiness.npcapInstalled,
      capturePermissionHint: this.platform.capturePermissionHint(),
      bpfCaptureAvailable: readiness.bpfCaptureAvailable,
      bpfLaunchDaemonInstalled: readiness.bpfLaunchDaemonInstalled,
      captureToolAvailable: readiness.captureToolAvailable,
      linuxCaptureAvailable: readiness.linuxCaptureAvailable,
      capModuleAvailable: readiness.capModuleAvailable,
      prerequisites: this.platform.buildPrerequisites(readiness),
      mitmEnabled: this.mitmEnabled,
      mitmActive: !!this.mitmProxy?.isRunning(),
      mitmPort: this.mitmPort,
      mitmListenAddress: this.mitmEnabled ? this.getMitmProxyHostPort() : undefined,
      // Fall back to the proxy's own last error for the asynchronous listen failure path, where the
      // server errored after start() returned (covered by onError, but stay robust if it didn't run).
      mitmLastError: this.mitmLastError ?? this.mitmProxy?.getLastError(),
      mitmPortConflict: this.mitmPortConflict,
      mitmCaFingerprint: ca?.fingerprintSha256,
      mitmTransactions: this.mitmTransactions,
      maxRawPacketsPerDevice: this.maxRawPacketsPerDevice,
      maxBodyRetainedBytes: this.maxBodyRetainedBytes,
      trafficRules: this.getTrafficRules()
    };
  }

  setUserDataPath(p: string | undefined): void {
    if (p && p !== this.userDataPath) {
      this.userDataPath = p;
      // Clear any cache files left by a previous (possibly crashed) session before we start.
      NetworkDetailStore.cleanupBaseDir(p);
    }
  }

  private ensureDetailStore(): NetworkDetailStore | null {
    if (this.detailStore) return this.detailStore;
    if (!this.userDataPath) return null;
    this.detailStore = new NetworkDetailStore(this.userDataPath);
    return this.detailStore;
  }

  getEventsForDevice(deviceIp: string, limit = 500): ParsedNetworkEvent[] {
    return this.eventBuffer
      .filter((e) => this.eventMatchesDeviceQuery(e, deviceIp))
      .slice(-limit);
  }

  /**
   * Read-only query over the in-memory summary buffer for the MCP / agent surface. Mirrors the
   * "summary first" model: returns lightweight summaries (no headers/bodies — fetch those via
   * {@link getEventDetail}); callers filter by device, host, method, type, error status, or
   * MITM-only, then drill down by id. Most-recent window, oldest→newest within the window.
   */
  queryEventSummaries(query: NetworkEventQuery = {}): ParsedNetworkEvent[] {
    const limit = clampQueryLimit(query.limit);
    return this.eventBuffer.filter((e) => eventMatchesQuery(e, query)).slice(-limit);
  }

  /**
   * Aggregate the (optionally filtered) summary buffer into hotspot/error rollups for the agent
   * surface — host/status/type/content-type group counts plus the largest responses — so an agent
   * can orient on a session with one call before drilling into individual entries.
   */
  analyzeEvents(query: NetworkEventQuery = {}): NetworkEventAnalysis {
    const matched = this.eventBuffer.filter((e) => eventMatchesQuery(e, query));
    const byType: Record<string, number> = {};
    const byStatusClass: Record<string, number> = {};
    const hostMap = new Map<string, { count: number; errors: number }>();
    const contentTypeMap = new Map<string, number>();
    let httpTransactions = 0;
    let mitmTransactions = 0;
    let errors = 0;
    const sized: Array<{ id: string; host?: string; url?: string; status?: number; bytes: number }> = [];

    for (const ev of matched) {
      byType[ev.type] = (byType[ev.type] || 0) + 1;
      if (ev.mitm) mitmTransactions += 1;
      const status = ev.httpResponse?.statusCode;
      const isHttp = !!(ev.httpRequest || ev.httpResponse);
      if (isHttp) httpTransactions += 1;
      if (typeof status === 'number') {
        const cls = statusClass(status);
        byStatusClass[cls] = (byStatusClass[cls] || 0) + 1;
        if (status >= 400) errors += 1;
      }
      const host = eventHostLabel(ev);
      const hostEntry = hostMap.get(host) || { count: 0, errors: 0 };
      hostEntry.count += 1;
      if (typeof status === 'number' && status >= 400) hostEntry.errors += 1;
      hostMap.set(host, hostEntry);
      const ct = ev.httpResponse?.contentType || ev.httpRequest?.contentType;
      if (ct) contentTypeMap.set(ct, (contentTypeMap.get(ct) || 0) + 1);
      const bytes = ev.httpResponse?.bodyBytes ?? ev.httpRequest?.bodyBytes ?? 0;
      if (bytes > 0) {
        sized.push({ id: ev.id, host, url: ev.httpRequest?.url, status, bytes });
      }
    }

    const topHosts = Array.from(hostMap.entries())
      .map(([host, v]) => ({ host, count: v.count, errors: v.errors }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    const topContentTypes = Array.from(contentTypeMap.entries())
      .map(([contentType, count]) => ({ contentType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    const largestResponses = sized.sort((a, b) => b.bytes - a.bytes).slice(0, 10);

    return {
      totalMatched: matched.length,
      byType,
      byStatusClass,
      topHosts,
      topContentTypes,
      httpTransactions,
      mitmTransactions,
      errors,
      largestResponses
    };
  }

  /**
   * Cursor-based delta fetch for a device. `sinceSeq <= 0` returns the most-recent `limit` window
   * and a cursor at the current head (so the next poll only gets new events). A positive cursor
   * returns only events added/updated after it, oldest-first and gap-safe (the returned cursor is
   * the last delivered event's sequence so a capped batch resumes cleanly next poll).
   */
  getEventsForDeviceSince(
    deviceIp: string,
    sinceSeq: number,
    limit = 2000
  ): { events: ParsedNetworkEvent[]; cursor: number } {
    const matched = this.eventBuffer.filter((e) => this.eventMatchesDeviceQuery(e, deviceIp));
    if (!Number.isFinite(sinceSeq) || sinceSeq <= 0) {
      return { events: matched.slice(-limit), cursor: this.mutationSeq };
    }
    const delta = matched
      .filter((e) => (this.eventSeq.get(e.id) ?? 0) > sinceSeq)
      .sort((a, b) => (this.eventSeq.get(a.id) ?? 0) - (this.eventSeq.get(b.id) ?? 0));
    const limited = delta.slice(0, limit);
    const cursor =
      limited.length > 0
        ? this.eventSeq.get(limited[limited.length - 1]!.id) ?? sinceSeq
        : this.mutationSeq;
    return { events: limited, cursor };
  }

  /** Fetch the full event (headers + bodies) for the focused request from the on-disk store. */
  async getEventDetail(id: string): Promise<ParsedNetworkEvent | null> {
    if (!id || !this.detailStore) return null;
    const ev = await this.detailStore.get(id);
    if (!ev) return ev;
    const n = this.eventNotes.get(id);
    // Attach via a shallow copy rather than mutating in place: `detailStore.get` can hand back the
    // still-buffered (not-yet-flushed) event by reference, and mutating it would risk the note being
    // serialized into the append-only .ndjson on the next drain (the note is deliberately kept out of
    // that file) and could leave a stale note behind after a clear. The copy is cheap — body strings
    // are shared by reference, not duplicated.
    return n ? { ...ev, note: n } : ev;
  }

  /**
   * Attach/replace/clear the session-scoped user note for an event. Trimmed empty removes the note.
   * The note is stored only in the in-memory side map and mirrored onto the buffered summary object
   * (so a fresh initial full fetch carries it); the renderer is authoritative for the live UI, so
   * this does NOT bump `mutationSeq` or flush a push.
   */
  setEventNote(id: string, note: string): void {
    if (!id) return;
    const trimmed = (note ?? '').trim();
    if (!trimmed) this.eventNotes.delete(id);
    else this.eventNotes.set(id, trimmed);
    const summary = this.eventBuffer.find((e) => e.id === id);
    if (summary) {
      if (trimmed) summary.note = trimmed;
      else delete summary.note;
    }
  }

  /**
   * "Find in content" over the captured transactions for one device: matches the query against the
   * requested scopes (URL / request+response headers+bodies) and returns per-event match counts.
   *
   * URL-only searches are served straight from the in-memory summary buffer (no disk). When a header
   * or body scope is active, the full event is pulled from the disk-backed detail store per id
   * (respecting `detailAvailable`), so bodies never have to live in memory. Results follow the same
   * newest-window ordering as the summary buffer; `maxResults` bounds worst-case work.
   */
  async searchEvents(
    deviceIp: string,
    request: NetworkFindRequest,
    maxResults = 2000
  ): Promise<NetworkFindMatch[]> {
    // Compile every colored term once; each keeps its own scope/case/regex. Empty/invalid terms drop.
    const terms = createContentMatchers(request?.terms ?? []);
    if (terms.length === 0) {
      this.findCache.clear();
      this.findCacheSig = '';
      return [];
    }
    // The memoized results are valid for exactly ONE term signature (query/scopes/case/regex/id — id
    // matters because the per-term breakdown is keyed by it). A change invalidates the whole cache.
    const sig = JSON.stringify(request?.terms ?? []);
    if (sig !== this.findCacheSig) {
      this.findCache.clear();
      this.findCacheSig = sig;
    }
    const summaries = this.eventBuffer.filter((e) => this.eventMatchesDeviceQuery(e, deviceIp));
    // A single disk read per event feeds ALL terms — needsDetail is the union across terms.
    const needsDetail = findNeedsDetailMulti(terms) && !!this.detailStore;
    const results: NetworkFindMatch[] = [];
    for (const summary of summaries) {
      if (results.length >= maxResults) break;
      // Reuse the memoized result for an already-searched, immutable event (undefined = not yet cached;
      // null = searched, no match).
      const cached = this.findCache.get(summary.id);
      if (cached !== undefined) {
        if (cached) results.push(cached);
        continue;
      }
      // Pull full detail only when some term needs headers/bodies and the event has it on disk;
      // otherwise the summary (which carries the URL) is enough.
      let event: ParsedNetworkEvent | null = summary;
      // Whether we searched the event's FINAL content — the only state safe to memoize. For a URL-only
      // search the summary is authoritative; for a detail-scoped search we must have actually fetched
      // the detail. `detailAvailable` can flip true a beat before the body is retrievable (a live-
      // capture race), so a null get() means "not final yet" — search the summary but DON'T cache the
      // miss, or a late-arriving body would be lost behind a poisoned null.
      let final = !needsDetail;
      // Capture the event's mutation stamp BEFORE the awaited disk read. If a concurrent upsertEvent
      // rewrites this event while we await (e.g. a MITM response body arriving mid-search), its stamp
      // changes — so the bytes we read may be stale and we must NOT memoize the result (recompute next
      // search). eventSeq is bumped on every upsert; `undefined` for the no-detail path (no await, no race).
      const seqBefore = this.eventSeq.get(summary.id);
      if (needsDetail && summary.detailAvailable) {
        const detail = await this.detailStore!.get(summary.id);
        if (detail) {
          event = detail;
          final = true;
        }
      }
      const match = matchEventContentMulti(event, terms);
      if (final && seqBefore !== undefined && this.eventSeq.get(summary.id) !== seqBefore) final = false;
      if (final) this.findCache.set(summary.id, match);
      if (match) results.push(match);
    }
    return results;
  }

  clearEventsForDevices(deviceIps?: string[]): { cleared: number } {
    const before = this.eventBuffer.length;
    if (!deviceIps || deviceIps.length === 0) {
      this.eventBuffer = [];
      this.pendingEvents = [];
      this.eventSeq.clear();
      this.eventNotes.clear();
      this.detailStore?.clear();
    } else {
      const queries = deviceIps.filter((ip) => typeof ip === 'string' && ip.trim());
      const matches = (e: ParsedNetworkEvent) =>
        queries.some((ip) => this.eventMatchesDeviceQuery(e, ip));
      for (const e of this.eventBuffer) {
        if (matches(e)) {
          this.detailStore?.remove(e.id);
          this.eventSeq.delete(e.id);
          this.eventNotes.delete(e.id);
        }
      }
      this.eventBuffer = this.eventBuffer.filter((e) => !matches(e));
      this.pendingEvents = this.pendingEvents.filter((e) => !matches(e));
    }
    // Removed events' ids may be reused conceptually; drop the whole Find cache (clearing is rare).
    this.findCache.clear();
    this.broadcastStatus();
    return { cleared: before - this.eventBuffer.length };
  }

  setRecordingForDevices(deviceIps: string[], recording: boolean): void {
    for (const ip of deviceIps) {
      const normalized = typeof ip === 'string' ? ip.trim() : '';
      if (!normalized) continue;
      if (recording) this.pausedRecordingDeviceIps.delete(normalized);
      else this.pausedRecordingDeviceIps.add(normalized);
    }
    this.broadcastStatus();
  }

  private eventMatchesDeviceQuery(ev: ParsedNetworkEvent, deviceIp: string): boolean {
    // Exact match only. The previous subnet-prefix fallback matched *every*
    // client on the hotspot, so a per-device fetch/clear/export mixed in (or
    // wiped) other Rokus' sessions. Callers that need a device's hotspot lease
    // pass that IP explicitly (the renderer queries each watched IP and
    // re-filters), so a subnet wildcard here is never required.
    return ev.deviceIp === deviceIp;
  }

  /**
   * Map a frame's src/dst IPs to the device bucket it should be filed under, mirroring the parser's
   * device resolution. Returns '' when the frame isn't attributable to a tracked device / client.
   */
  private resolveFrameDeviceIp(srcIp: string, dstIp: string): string {
    if (this.trackedDeviceIps.has(srcIp)) return srcIp;
    if (this.trackedDeviceIps.has(dstIp)) return dstIp;
    if (this.isHotspotClientIp(srcIp)) return srcIp;
    if (this.isHotspotClientIp(dstIp)) return dstIp;
    return '';
  }

  private shouldRecordEvent(ev: ParsedNetworkEvent): boolean {
    return !this.pausedRecordingDeviceIps.has(ev.deviceIp);
  }

  /**
   * Write captured frames to a Wireshark pcap. Capture stays whole-hotspot, but when `deviceIps`
   * is supplied the export is scoped to frames whose source or destination matches one of those
   * IPs — so a per-device download contains only that Roku's traffic, not the full hotspot log.
   */
  async exportPcap(
    targetPath: string,
    deviceIps?: string[]
  ): Promise<{ success: boolean; error?: string; packetsWritten?: number }> {
    try {
      const totalCaptured = Array.from(this.rawPacketsByDevice.values()).reduce(
        (sum, frames) => sum + frames.length,
        0
      );
      if (totalCaptured === 0) {
        return { success: false, error: 'No packets captured yet.' };
      }
      const wanted = Array.from(
        new Set(
          (deviceIps || [])
            .map((ip) => (typeof ip === 'string' ? ip.trim() : ''))
            .filter((ip) => ip && !ip.endsWith('.1'))
        )
      );
      const scoped = wanted.length > 0;
      // Pull the relevant device buckets (or all of them for a full-hotspot export) and merge in
      // timestamp order so a multi-device pcap stays chronological.
      const sources = scoped
        ? wanted.map((ip) => this.rawPacketsByDevice.get(ip) || [])
        : Array.from(this.rawPacketsByDevice.values());
      const packets = sources.flat().sort((a, b) => a.timestampMs - b.timestampMs);
      if (packets.length === 0) {
        return {
          success: false,
          error: scoped
            ? 'No packets captured for this device yet. Browse or play content on the Roku, then try again.'
            : 'No packets captured yet.'
        };
      }
      const fd = fs.openSync(targetPath, 'w');
      const global = Buffer.alloc(24);
      global.writeUInt32LE(0xa1b2c3d4, 0);
      global.writeUInt16LE(2, 4);
      global.writeUInt16LE(4, 6);
      global.writeInt32LE(0, 8);
      global.writeUInt32LE(0, 12);
      global.writeUInt32LE(65535, 16);
      global.writeUInt32LE(1, 20);
      // Assemble the whole pcap into one buffer and write it once. The previous per-packet
      // fs.writeSync (2 syscalls × up to 100k packets/device) blocked the main thread for the
      // entire export.
      const parts: Buffer[] = [global];
      for (const pkt of packets) {
        const hdr = Buffer.alloc(16);
        const sec = Math.floor(pkt.timestampMs / 1000);
        const usec = (pkt.timestampMs % 1000) * 1000;
        hdr.writeUInt32LE(sec, 0);
        hdr.writeUInt32LE(usec, 4);
        hdr.writeUInt32LE(pkt.frame.length, 8);
        hdr.writeUInt32LE(pkt.frame.length, 12);
        parts.push(hdr, pkt.frame);
      }
      fs.writeSync(fd, Buffer.concat(parts));
      fs.closeSync(fd);
      return { success: true, packetsWritten: packets.length };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  dispose(): void {
    this.stopAll();
  }

  private resolveHotspotState(): NetworkInspectorStatus['hotspotState'] {
    if (!this.enabled) return 'disabled';
    if (this.lastError) return 'error';
    if (this.captureInterface) return 'active';
    return 'waiting';
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    // `tickInner` awaits async platform calls that can reject; swallow so a failing tick can't become
    // an unhandled rejection (noisy, and fatal under strict main-process settings).
    const runTick = (): void => void this.tick().catch(() => {});
    runTick();
    this.pollTimer = setInterval(runTick, 4000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private stopAll(): void {
    this.stopPolling();
    this.stopMitm();
    this.clearMitmError();
    this.capture.stop();
    this.captureInterface = undefined;
    this.captureStartSuppressed = false;
    this.captureSuppressedAt = 0;
    this.subnetScanBackoff.reset();
    this.lastSubnetScanAt = 0;
    this.hotspotSubnet = undefined;
    this.clients.clear();
    this.clientMissCounts.clear();
    this.matchedSerials.clear();
    this.trackedDeviceIps.clear();
    this.pendingEvents = [];
    this.scheduleEventFlush.cancel();
    this.broadcastStatus.cancel();
    // Drop captured detail and delete the temp cache file when capture stops / inspector disables.
    this.eventBuffer = [];
    this.eventSeq.clear();
    this.eventNotes.clear();
    this.rawPacketsByDevice.clear();
    this.findCache.clear();
    this.findCacheSig = '';
    if (this.detailStore) {
      this.detailStore.dispose();
      this.detailStore = null;
    }
  }

  private async tick(): Promise<void> {
    if (!this.enabled) return;
    // A subnet scan can outlast the 4s timer; skip this tick rather than stacking a second scan on
    // top of the in-flight one (overlapping scans race on client state and pile up sockets).
    if (this.tickInFlight) return;
    this.tickInFlight = true;
    try {
      await this.tickInner();
    } finally {
      this.tickInFlight = false;
    }
  }

  private async tickInner(): Promise<void> {
    // Let the platform worker refresh any runtime-variable readiness it caches (e.g. Linux re-runs
    // getcap so capture only reports "ready" when tcpdump actually carries the capabilities).
    await this.platform.refreshCaptureAccess();

    // MITM runs whenever enabled — including MITM-only on the same Wi-Fi (no hotspot). Keep
    // retrying bind every tick so a transient port conflict can recover without user action.
    if (this.mitmEnabled) {
      const hint = this.platform.detectHotspotInterface();
      if (hint?.gatewayIp) this.gatewayIp = hint.gatewayIp;
      this.startMitm();
      if (this.shouldDisableForMitmPortConflict()) {
        this.disableForMitmPortConflict();
        return;
      }
    }

    // Packet capture and subnet discovery require a confident hotspot (macOS bridge100, Windows
    // ICS / Wi-Fi Direct, etc.). A normal home Wi-Fi adapter must not start capture on Windows.
    const hotspotActive = this.platform.isHotspotConfidentlyActive();
    const iface = hotspotActive ? this.platform.detectHotspotInterface() : null;
    if (!iface) {
      if (this.captureInterface) {
        niLog(`Hotspot no longer detected — stopping capture on "${this.captureInterface}".`);
        this.capture.stop();
        this.captureInterface = undefined;
        this.hotspotSubnet = undefined;
        this.hotspotSubnetPrefix = undefined;
        // The hotspot's clients left with it. Clear discovery state and notify the UI so departed
        // devices don't linger as stale entries — the miss-count eviction only runs while a hotspot
        // is present, so without this they'd never be removed until the inspector is disabled. MITM
        // is intentionally left running; it's driven independently of the hotspot above.
        this.gatewayIp = undefined;
        this.clients.clear();
        this.clientMissCounts.clear();
        this.matchedSerials.clear();
        this.trackedDeviceIps = new Set();
        this.listener.onClientsCleared();
      }
      // Hotspot is gone — reset the scan backoff so the next time one appears we discover promptly
      // instead of waiting out a stretched (up to 60s) interval inherited from the previous session.
      this.subnetScanBackoff.reset();
      this.lastSubnetScanAt = 0;
      this.broadcastStatus();
      return;
    }
    const subnet = iface.subnet;
    this.gatewayIp = iface.gatewayIp;
    // Retry capture once access is restored at runtime (macOS BPF becoming writable). The worker
    // decides whether its platform can recover detectably — Linux/Windows return false (their
    // privilege isn't observable before spawning), so recovery there stays explicit via Setup.
    if (this.lastError && this.platform.canRecoverCaptureAfterError()) {
      this.capture.stop();
      this.captureInterface = undefined;
      this.lastError = undefined;
      this.captureStartSuppressed = false;
      this.captureSuppressedAt = 0;
    }
    // Auto-recover from a (likely transient) capture failure once a cooldown has elapsed — but only
    // when the platform still reports the capture tool available. A genuine permission failure keeps
    // captureToolAvailable === false, so it stays suppressed instead of respawning in a tight loop.
    if (
      this.captureStartSuppressed &&
      this.captureSuppressedAt > 0 &&
      Date.now() - this.captureSuppressedAt >= CAPTURE_SUPPRESS_COOLDOWN_MS &&
      this.platform.getReadiness().captureToolAvailable
    ) {
      niLog('Capture suppression cooldown elapsed and capture tool still available — retrying capture.');
      this.captureStartSuppressed = false;
      this.captureSuppressedAt = 0;
      this.lastError = undefined;
    }
    if (!this.captureStartSuppressed && this.captureInterface !== iface.name) {
      niLog(`Hotspot detected on "${iface.name}" (subnet ${subnet}.0/24, gateway ${iface.gatewayIp}) — starting capture.`);
      this.startCapture(iface.name, subnet);
      this.broadcastStatus();
    }
    const shouldScan = Date.now() - this.lastSubnetScanAt >= this.subnetScanBackoff.value;
    if (shouldScan) {
      this.lastSubnetScanAt = Date.now();
      const discovered = await scanHotspotSubnet(subnet);
      niLog(`Subnet scan ${subnet}.0/24 found ${discovered.length} Roku device(s).`);
      // Tracks whether the discovered device *set* changed this scan (a join or an eviction) so the
      // scan cadence can back off while stable and snap back to the floor on any churn.
      let deviceSetChanged = false;
      const prevKeys = new Set(this.clients.keys());
      for (const dev of discovered) {
        const key = dev.serialNumber || dev.ip;
        const existing = this.clients.get(key);
        if (existing) {
          existing.ip = dev.ip;
          existing.lastSeen = new Date().toISOString();
          existing.deviceName = dev.deviceName ?? existing.deviceName;
          existing.modelName = dev.modelName ?? existing.modelName;
        } else {
          this.clients.set(key, dev);
          deviceSetChanged = true;
        }
        // Seen this scan — clear any accumulated miss count.
        this.clientMissCounts.delete(key);
        if (dev.serialNumber) {
          if (!this.matchedSerials.has(dev.serialNumber)) {
            this.matchedSerials.add(dev.serialNumber);
            this.listener.onDeviceJoined({
              serialNumber: dev.serialNumber,
              ip: dev.ip,
              deviceName: dev.deviceName,
              modelName: dev.modelName
            });
          }
        }
        this.listener.onDeviceDiscovered(dev);
      }
      for (const key of prevKeys) {
        if (!discovered.some((d) => (d.serialNumber || d.ip) === key)) {
          // Apply hysteresis: only evict after several consecutive misses so a
          // transient probe failure doesn't flap the device in/out of the list.
          const misses = (this.clientMissCounts.get(key) ?? 0) + 1;
          if (misses < this.maxClientScanMisses) {
            this.clientMissCounts.set(key, misses);
            continue;
          }
          this.clientMissCounts.delete(key);
          const removed = this.clients.get(key);
          this.clients.delete(key);
          deviceSetChanged = true;
          if (removed?.serialNumber) {
            this.matchedSerials.delete(removed.serialNumber);
            this.listener.onDeviceLeft({
              serialNumber: removed.serialNumber,
              ip: removed.ip
            });
          }
        }
      }
      // Rebuild the tracked-IP set from the live client list so departed devices don't linger
      // (stale frame attribution + unbounded growth). Hysteresis keeps a briefly-missed device in
      // `clients`, so its IP is retained until it's actually evicted above.
      this.trackedDeviceIps = new Set(Array.from(this.clients.values()).map((c) => c.ip));
      if (this.captureInterface) {
        this.capture.updateParseContext({
          deviceIps: this.trackedDeviceIps,
          hotspotSubnetPrefix: subnet
        });
      }
      // Back off the scan cadence while the device set is stable/empty (doubling up to the ceiling);
      // any join/leave snaps it straight back to the floor for responsive discovery.
      if (deviceSetChanged) this.subnetScanBackoff.reset();
      else this.subnetScanBackoff.next();
    } else if (this.captureInterface) {
      this.capture.updateParseContext({
        deviceIps: this.trackedDeviceIps,
        hotspotSubnetPrefix: subnet
      });
    }
    this.logStatsThrottled();
    this.broadcastStatus();
  }

  /** Emit a single-line runtime snapshot at most every statsLogIntervalMs, for shareable logs. */
  private logStatsThrottled(): void {
    const now = Date.now();
    if (now - this.lastStatsLogAt < this.statsLogIntervalMs) return;
    this.lastStatsLogAt = now;
    const src = this.capture.getSourceStats();
    const npcap = src ? ` npcapQueue=${src.queued} npcapDropped=${src.dropped}` : '';
    niLog(
      `stats: capture=${this.captureInterface ?? 'none'} ` +
        `clients=${this.clients.size} packets=${this.capture.getPacketsCaptured()} ` +
        `events=${this.eventBuffer.length} mitm=${this.mitmActiveLabel()} ` +
        `mitmTx=${this.mitmTransactions} scanIntervalMs=${this.subnetScanBackoff.value}${npcap}` +
        `${this.lastError ? ` lastError="${this.lastError}"` : ''}`
    );
  }

  private mitmActiveLabel(): string {
    if (!this.mitmEnabled) return 'off';
    return this.mitmProxy?.isRunning() ? `:${this.mitmPort}` : 'starting';
  }

  private startCapture(interfaceName: string, subnet: string): void {
    const started = this.capture.start({
      interfaceName,
      deviceIps: this.trackedDeviceIps,
      hotspotSubnetPrefix: subnet,
      onEvents: (events) => this.enqueueEvents(events),
      onError: (message) => {
        niWarn(`Capture error on "${interfaceName}": ${message} — suppressing retries until recovery.`);
        this.lastError = message;
        this.capture.stop();
        this.captureInterface = undefined;
        // Don't auto-respawn capture every tick after a blocking failure (e.g. missing privilege).
        // Recovery is explicit: macOS BPF re-check in tick(), the Setup action on Linux/Windows, or
        // the cooldown-gated transient retry in tick() (only when the capture tool stays available).
        this.captureStartSuppressed = true;
        this.captureSuppressedAt = Date.now();
        this.broadcastStatus();
      },
      onRawPacket: (frame, timestampMs) => {
        const ips = extractFrameIps(frame);
        if (!ips) return;
        const deviceIp = this.resolveFrameDeviceIp(ips.srcIp, ips.dstIp);
        if (!deviceIp) return;
        let bucket = this.rawPacketsByDevice.get(deviceIp);
        if (!bucket) {
          bucket = [];
          this.rawPacketsByDevice.set(deviceIp, bucket);
        }
        bucket.push({ frame: Buffer.from(frame), timestampMs });
        if (bucket.length > this.maxRawPacketsPerDevice) {
          bucket.splice(0, bucket.length - this.maxRawPacketsPerDevice);
        }
      },
      onProcessExit: (code, signal) => {
        if (!this.enabled || signal === 'SIGTERM') return;
        if (this.captureInterface !== interfaceName) return;
        // A blocking failure (e.g. missing capture privilege) sets
        // `captureStartSuppressed` in `onError`; don't let the exit handler
        // re-spawn capture and silently clear `lastError` — recovery must stay
        // explicit (macOS BPF re-check in tick(), or the Setup action).
        if (this.captureStartSuppressed) return;
        this.captureInterface = undefined;
        setTimeout(() => {
          if (!this.enabled || this.captureStartSuppressed) return;
          if (!this.platform.isHotspotConfidentlyActive()) return;
          const iface = this.platform.detectHotspotInterface();
          if (!iface || iface.name !== interfaceName) return;
          this.startCapture(iface.name, iface.subnet);
          this.captureInterface = interfaceName;
          this.hotspotSubnet = `${iface.subnet}.0/24`;
          this.hotspotSubnetPrefix = iface.subnet;
          this.lastError = undefined;
          this.broadcastStatus();
        }, 500);
      }
    });
    if (started) {
      niLog(`Capture engine started on "${interfaceName}" (subnet ${subnet}.0/24).`);
      this.captureInterface = interfaceName;
      this.hotspotSubnet = `${subnet}.0/24`;
      this.hotspotSubnetPrefix = subnet;
      this.lastError = undefined;
    } else {
      niWarn(`Capture engine failed to start on "${interfaceName}".`);
    }
  }

  private resolveGatewayIp(): string | undefined {
    const iface = this.platform.detectHotspotInterface();
    return iface?.gatewayIp;
  }

  private isHotspotClientIp(ip: string): boolean {
    if (!ip) return false;
    const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
    if (normalized.endsWith('.1')) return false;
    const prefix = this.hotspotSubnetPrefix;
    if (prefix && normalized.startsWith(`${prefix}.`)) return true;
    // Fall back to the RFC1918 private ranges (minus the .1 gateway) so clients are recognized
    // across every shared-network layout: macOS Internet Sharing (192.168.2.x), Windows ICS /
    // Mobile Hotspot (192.168.137.x) and Linux NetworkManager shared (10.42.x.x).
    return isPrivateClientIp(normalized);
  }

  private startMitm(): void {
    if (!this.mitmEnabled || !this.enabled) return;
    if (this.mitmProxy?.isRunning()) return;
    if (this.mitmProxy) {
      if (!this.mitmProxy.getLastError()) return;
      this.stopMitm();
    }
    try {
      const ca = getOrCreateCa();
      // Pre-generate the shared leaf keypair so the one keygen happens up front, not on the first
      // HTTPS handshake the proxy serves. Fire-and-forget + async: the keygen yields to the event
      // loop (see warmLeafKeyPair) so it never freezes startup or device connect. A handshake that
      // somehow beats it falls back to a one-time sync generate in getSharedLeafKeys.
      void warmLeafKeyPair();
      this.mitmProxy = new RokuMitmProxy({
        port: this.mitmPort,
        ca,
        gatewayIp: this.gatewayIp,
        isHotspotClient: (ip) => this.isHotspotClientIp(ip),
        // Block/throttle rules are read live per request so config changes take effect without
        // restarting the proxy.
        getTrafficDecision: (deviceIp, hostname, path) =>
          resolveTrafficDecision(this.trafficRules.get(deviceIp), hostname, path),
        onListening: () => {
          // Reached "listening" — the port was free, so clear any stale conflict/error.
          if (this.mitmProxy?.isRunning()) {
            niLog(`MITM proxy listening on 0.0.0.0:${this.mitmPort}.`);
            this.mitmLastError = undefined;
            this.mitmPortConflict = undefined;
            this.mitmPortConflictSince = 0;
          }
          this.broadcastStatus();
        },
        // Asynchronous listen failure (most commonly EADDRINUSE). Record the error and, when it's a
        // port conflict, resolve which process is squatting the port so the UI can name it.
        onError: (message) => {
          niWarn(`MITM proxy error on port ${this.mitmPort}: ${message}`);
          this.mitmLastError = message || 'MITM proxy failed to start';
          this.applyPortConflict(message);
          this.broadcastStatus();
        },
        onTransaction: (tx) => {
          this.mitmTransactions += 1;
          this.enqueueEvents([mitmTransactionToEvent(tx, this.maxBodyRetainedBytes)]);
        }
      });
      const started = this.mitmProxy.start();
      if (!started) {
        this.mitmLastError = this.mitmProxy.getLastError() || 'MITM proxy failed to start';
        this.applyPortConflict(this.mitmLastError);
        this.mitmProxy = null;
      }
      // On `started === true` we DON'T optimistically clear the conflict here: `start()` returns
      // before the async `listen()` resolves, so the bind may still fail with EADDRINUSE. The
      // success is confirmed in `onListening` (clears) and failure in `onError` (re-sets) — clearing
      // here would flap the warning off/on every retry tick.
    } catch (err) {
      this.mitmLastError = err instanceof Error ? err.message : String(err);
      this.applyPortConflict(this.mitmLastError);
      this.mitmProxy = null;
    }
    this.broadcastStatus();
  }

  private stopMitm(): void {
    if (this.mitmProxy) {
      this.mitmProxy.stop();
      this.mitmProxy = null;
    }
  }

  /** Clear a port-conflict warning + last error (used by intentional stops/disables). */
  private clearMitmError(): void {
    this.mitmPortConflict = undefined;
    this.mitmPortConflictSince = 0;
    this.mitmLastError = undefined;
  }

  private shouldDisableForMitmPortConflict(): boolean {
    return (
      !!this.mitmPortConflict &&
      this.mitmPortConflictSince > 0 &&
      Date.now() - this.mitmPortConflictSince >= MITM_PORT_CONFLICT_DISABLE_MS
    );
  }

  private disableForMitmPortConflict(): void {
    const conflict = this.mitmPortConflict;
    if (!conflict) return;
    const who = conflict.processName
      ? `${conflict.processName}${conflict.pid ? ` (PID ${conflict.pid})` : ''}`
      : 'another app or process';
    const timeoutSeconds = Math.round(MITM_PORT_CONFLICT_DISABLE_MS / 1000);
    this.lastError =
      `Network Inspector disabled: proxy port ${conflict.port} stayed unavailable for ${timeoutSeconds} seconds (${who}). ` +
      'Free that port, then re-enable Network Inspector in Settings.';
    niWarn(this.lastError);
    // Disable both MITM and the inspector so the renderer shows the same blocked-state style used
    // by other hard failures, instead of retrying forever with a persistent conflict.
    this.setMitmEnabled(false);
    this.setEnabled(false);
  }

  /**
   * Record a proxy port conflict from a start failure. No-op (and clears any prior conflict) when the
   * failure isn't an address-in-use error. The conflict is shown to the user immediately with a
   * generic message; resolving *which* process holds the port runs asynchronously
   * ({@link detectPortHolder} spawns `lsof`/`ps`, which must never block the main-process event loop
   * — a synchronous probe here used to freeze all IPC, including device connect, for seconds on every
   * EADDRINUSE and on every 4s retry tick). When it resolves, the conflict is enriched with the
   * process name/PID and re-broadcast.
   */
  private applyPortConflict(message: string | undefined): void {
    if (!isAddressInUseError(message)) {
      this.mitmPortConflict = undefined;
      this.mitmPortConflictSince = 0;
      return;
    }
    const port = this.mitmPort;
    // Already resolved (with a PID) for this same port on an earlier tick — keep it, don't re-probe.
    const alreadyResolved = this.mitmPortConflict?.port === port && this.mitmPortConflict?.pid != null;
    if (!alreadyResolved) {
      // Show the conflict instantly with no process name; the holder lookup follows off-thread.
      this.mitmPortConflict = this.makePortConflict(port, null);
    }
    if (!this.mitmPortConflictSince) this.mitmPortConflictSince = Date.now();
    if (alreadyResolved) return;
    void detectPortHolder(port)
      .then((holder) => {
        // Only enrich if we're still in the same live conflict and actually learned who holds it.
        if (holder && this.mitmPortConflict?.port === port) {
          this.mitmPortConflict = this.makePortConflict(port, holder);
          this.broadcastStatus();
        }
      })
      .catch(() => {
        /* holder lookup is best-effort — the generic conflict is already shown */
      });
  }

  /** Build the structured, user-facing port-conflict payload. `holder` is null until the async
   *  {@link detectPortHolder} lookup resolves (then the warning can name the squatting process). */
  private makePortConflict(port: number, holder: PortHolder | null): MitmPortConflict {
    const remediation: string[] = [];
    if (holder?.pid) {
      remediation.push(
        `Quit ${holder.processName ? `“${holder.processName}”` : 'the app'} (PID ${holder.pid}) that is using port ${port}.`
      );
    } else {
      remediation.push(`Close the app or process currently using port ${port}.`);
    }
    remediation.push(
      `Or change the proxy port in Roku Dev Studio: Settings → Network Inspector → MITM Proxy Port.`
    );
    remediation.push('Roku Dev Studio retries automatically once the port is free.');
    return {
      port,
      pid: holder?.pid,
      processName: holder?.processName,
      command: holder?.command,
      title: 'Proxy Port Unavailable',
      message: `An App or a Process is already using port ${port}, so the MITM proxy can't start. Decrypted HTTPS capture is paused until the port is free.`,
      remediation
    };
  }

  private upsertEvent(full: ParsedNetworkEvent): void {
    if (!this.shouldRecordEvent(full)) return;
    // This event's content is (re)written now — drop any memoized Find result so the next search
    // recomputes against the fresh detail. Critical for MITM, where the body arrives in a LATER put()
    // than the initial summary; without this, a match computed on the partial event would stick.
    this.findCache.delete(full.id);
    // Persist the heavy headers/body to disk; keep only a lightweight summary in memory.
    const store = this.ensureDetailStore();
    const stored = store ? store.put(full) : false;
    const summary = summarizeEvent(full, stored);
    const n = this.eventNotes.get(full.id);
    if (n) summary.note = n;
    if (full.mitm) {
      const idx = this.eventBuffer.findIndex((e) => e.id === summary.id);
      if (idx >= 0) {
        this.eventBuffer[idx] = summary;
        this.eventSeq.set(summary.id, ++this.mutationSeq);
        const pendingIdx = this.pendingEvents.findIndex((e) => e.id === summary.id);
        if (pendingIdx >= 0) this.pendingEvents[pendingIdx] = summary;
        else this.pendingEvents.push(summary);
        return;
      }
    }
    this.eventBuffer.push(summary);
    this.eventSeq.set(summary.id, ++this.mutationSeq);
    this.pendingEvents.push(summary);
  }

  // Evict oldest summaries (and their on-disk detail) once over the count cap.
  private trimEventBuffer(): void {
    if (this.eventBuffer.length <= this.maxEvents) return;
    const removed = this.eventBuffer.splice(0, this.eventBuffer.length - this.maxEvents);
    for (const e of removed) {
      this.detailStore?.remove(e.id);
      this.eventSeq.delete(e.id);
      this.findCache.delete(e.id);
      this.eventNotes.delete(e.id);
    }
  }

  private enqueueEvents(events: ParsedNetworkEvent[]): void {
    for (const ev of events) {
      this.upsertEvent(ev);
    }
    this.trimEventBuffer();
    this.scheduleEventFlush();
  }

}

/** RFC1918 private client IP (excluding the gateway `.1`) — used to recognize hotspot clients. */
export function isPrivateClientIp(ip: string): boolean {
  if (!ip || ip.endsWith('.1')) return false;
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(ip)
  );
}

/**
 * Detect the active hotspot/shared-network interface for this host. Thin compat shim that delegates
 * to the selected per-OS capture worker (macOS bridge100 / Windows ICS·Mobile Hotspot / Linux shared
 * gateway). Kept as a package-root export for existing consumers (e.g. device discovery).
 */
export function detectHotspotInterface(): HotspotInterfaceInfo | null {
  return getCapturePlatform().detectHotspotInterface();
}

/**
 * Whether a hotspot is *confidently* active — excludes loose "any private LAN IP" fallbacks so a
 * normal Wi-Fi connection isn't mistaken for a hotspot. Delegates to the per-OS capture worker.
 */
export function isHotspotConfidentlyActive(): boolean {
  return getCapturePlatform().isHotspotConfidentlyActive();
}

/**
 * Best-effort primary LAN IPv4 for this machine, used as the MITM proxy host when there's no
 * hotspot gateway (i.e. the Roku and this machine share a normal Wi-Fi). Skips internal,
 * link-local (169.254.x) and the macOS Internet-Sharing bridge range (192.168.2.x), then prefers
 * common home/office private ranges so the generated proxy URL points at a reachable address.
 */
export function detectPrimaryLanIp(): string | undefined {
  const ifaces = os.networkInterfaces();
  const candidates: string[] = [];
  for (const addrs of Object.values(ifaces)) {
    if (!addrs) continue;
    for (const a of addrs) {
      if (a.family !== 'IPv4' || a.internal) continue;
      const ip = a.address;
      if (ip.startsWith('169.254.')) continue;
      if (ip.startsWith('192.168.2.')) continue;
      candidates.push(ip);
    }
  }
  const rank = (ip: string): number => {
    if (/^192\.168\./.test(ip)) return 0;
    if (/^10\./.test(ip)) return 1;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
    return 3;
  };
  candidates.sort((a, b) => rank(a) - rank(b));
  return candidates[0];
}
