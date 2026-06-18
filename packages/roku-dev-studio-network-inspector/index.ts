import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import type {
  HotspotClientDevice,
  NetworkHttpMessage,
  NetworkInspectorCaInfo,
  NetworkInspectorListener,
  NetworkInspectorStatus,
  ParsedNetworkEvent,
  DeviceTrafficRules,
  NetworkTrafficRules,
  MitmPortConflict
} from './types';
import { detectPortHolder, isAddressInUseError } from './port-conflict';
import {
  DEFAULT_MAX_RAW_PACKETS_PER_DEVICE,
  clampMaxRawPacketsPerDevice,
  resolveTrafficDecision
} from './types';
import { scanHotspotSubnet } from './device-matcher';
import { CaptureEngine } from './capture-engine';
import { getCapturePlatform } from './platform';
import type { CapturePlatform, HotspotInterfaceInfo } from './platform/types';
import { getCaInfo, getOrCreateCa } from './ca-store';
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
  NetworkInspectorDeviceLeftPayload
} from './types';

// Re-exported for the app's Electron factory (initNetworkInspectorFromSettings), which lives in the
// app layer because it wires the Electron IPC adapter.
export { initCaStore } from './ca-store';
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
export { installCaptureAccessLinux } from './capture-access-linux';
// Per-platform capture worker abstraction (one provider per OS behind a common contract).
export { getCapturePlatform } from './platform';
export type { CapturePlatform, PlatformCaptureReadiness } from './platform/types';
import { RokuMitmProxy } from './mitm-proxy';
import { mitmTransactionToEvent } from './mitm-events';
import { NetworkDetailStore } from './detail-store';
import { extractFrameIps } from './packet-parser';
import { exportCaCertToFile, exportCaPemToFile } from './channel-ca-inject';

const DEFAULT_MITM_PORT = 8888;

export type NetworkInspectorBootConfig = {
  enabled: boolean;
  mitmEnabled?: boolean;
  mitmPort?: number;
  maxRawPacketsPerDevice?: number;
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
    durationMs: ev.durationMs,
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
  private lastError: string | undefined;
  // Set when a capture attempt fails with a blocking error (permission/missing tool) so the 4s
  // tick doesn't respawn the capture process in a loop. Cleared when readiness is restored
  // (macOS BPF re-check, Linux/Windows explicit setup) or when the inspector is re-enabled.
  private captureStartSuppressed = false;
  private captureInterface: string | undefined;
  private hotspotSubnet: string | undefined;
  private hotspotSubnetPrefix: string | undefined;
  private lastSubnetScanAt = 0;
  private readonly subnetScanIntervalMs = 12_000;
  // Consecutive missed subnet scans per client key. A single missed probe (Wi‑Fi
  // hiccup, device asleep) shouldn't evict a Roku and fire onDeviceLeft — only
  // remove after this many consecutive misses (~2 scans ≈ 24s of silence).
  private readonly clientMissCounts = new Map<string, number>();
  private readonly maxClientScanMisses = 2;
  private pendingEvents: ParsedNetworkEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private trackedDeviceIps = new Set<string>();
  // On-disk store for full headers/bodies; memory keeps only lightweight summaries.
  private detailStore: NetworkDetailStore | null = null;
  private userDataPath: string | undefined;
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
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    } else {
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
      !!rules && (rules.blockAll || (rules.hosts && rules.hosts.length > 0) || !!rules.throttle);
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
      const iface = this.platform.detectHotspotInterface();
      if (iface && this.enabled && !this.captureInterface) {
        this.startCapture(iface.name, iface.subnet);
        this.captureInterface = iface.name;
        this.hotspotSubnet = `${iface.subnet}.0/24`;
        this.hotspotSubnetPrefix = iface.subnet;
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
    return this.detailStore.get(id);
  }

  clearEventsForDevices(deviceIps?: string[]): { cleared: number } {
    const before = this.eventBuffer.length;
    if (!deviceIps || deviceIps.length === 0) {
      this.eventBuffer = [];
      this.pendingEvents = [];
      this.eventSeq.clear();
      this.detailStore?.clear();
    } else {
      const queries = deviceIps.filter((ip) => typeof ip === 'string' && ip.trim());
      const matches = (e: ParsedNetworkEvent) =>
        queries.some((ip) => this.eventMatchesDeviceQuery(e, ip));
      for (const e of this.eventBuffer) {
        if (matches(e)) {
          this.detailStore?.remove(e.id);
          this.eventSeq.delete(e.id);
        }
      }
      this.eventBuffer = this.eventBuffer.filter((e) => !matches(e));
      this.pendingEvents = this.pendingEvents.filter((e) => !matches(e));
    }
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
      fs.writeSync(fd, global);
      for (const pkt of packets) {
        const hdr = Buffer.alloc(16);
        const sec = Math.floor(pkt.timestampMs / 1000);
        const usec = (pkt.timestampMs % 1000) * 1000;
        hdr.writeUInt32LE(sec, 0);
        hdr.writeUInt32LE(usec, 4);
        hdr.writeUInt32LE(pkt.frame.length, 8);
        hdr.writeUInt32LE(pkt.frame.length, 12);
        fs.writeSync(fd, hdr);
        fs.writeSync(fd, pkt.frame);
      }
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
    void this.tick();
    this.pollTimer = setInterval(() => void this.tick(), 4000);
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
    this.hotspotSubnet = undefined;
    this.clients.clear();
    this.clientMissCounts.clear();
    this.matchedSerials.clear();
    this.pendingEvents = [];
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    // Drop captured detail and delete the temp cache file when capture stops / inspector disables.
    this.eventBuffer = [];
    this.eventSeq.clear();
    this.rawPacketsByDevice.clear();
    if (this.detailStore) {
      this.detailStore.dispose();
      this.detailStore = null;
    }
  }

  private async tick(): Promise<void> {
    if (!this.enabled) return;
    // Let the platform worker refresh any runtime-variable readiness it caches (e.g. Linux re-runs
    // getcap so capture only reports "ready" when tcpdump actually carries the capabilities).
    await this.platform.refreshCaptureAccess();
    const iface = this.platform.detectHotspotInterface();
    if (!iface) {
      if (this.captureInterface) {
        this.capture.stop();
        this.captureInterface = undefined;
        this.hotspotSubnet = undefined;
        this.gatewayIp = undefined;
        this.stopMitm();
        this.clearMitmError();
        this.clients.clear();
        this.clientMissCounts.clear();
        this.matchedSerials.clear();
        this.listener.onClientsCleared();
      } else if (this.mitmEnabled) {
        // MITM-only setup (no hotspot — e.g. Roku + this machine on the same Wi-Fi): the proxy
        // still runs here, so keep (re)trying to bind it every tick. Without this, a MITM-only
        // setup that hit a port conflict (EADDRINUSE) would never recover after the offending
        // process is closed, because startMitm() is otherwise only retried on the hotspot path
        // below. startMitm() is a no-op when the proxy is already listening.
        this.startMitm();
      }
      this.broadcastStatus();
      return;
    }
    const subnet = iface.subnet;
    this.gatewayIp = iface.gatewayIp;
    if (this.mitmEnabled) this.startMitm();
    // Retry capture once access is restored at runtime (macOS BPF becoming writable). The worker
    // decides whether its platform can recover detectably — Linux/Windows return false (their
    // privilege isn't observable before spawning), so recovery there stays explicit via Setup.
    if (this.lastError && this.platform.canRecoverCaptureAfterError()) {
      this.capture.stop();
      this.captureInterface = undefined;
      this.lastError = undefined;
      this.captureStartSuppressed = false;
    }
    if (!this.captureStartSuppressed && this.captureInterface !== iface.name) {
      this.startCapture(iface.name, subnet);
      this.broadcastStatus();
    }
    const shouldScan =
      this.clients.size === 0 || Date.now() - this.lastSubnetScanAt >= this.subnetScanIntervalMs;
    if (shouldScan) {
      this.lastSubnetScanAt = Date.now();
      const discovered = await scanHotspotSubnet(subnet);
      for (const dev of discovered) {
        this.trackedDeviceIps.add(dev.ip);
      }
      if (this.captureInterface) {
        this.capture.updateParseContext({
          deviceIps: this.trackedDeviceIps,
          hotspotSubnetPrefix: subnet
        });
      }
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
          if (removed?.serialNumber) {
            this.matchedSerials.delete(removed.serialNumber);
            this.listener.onDeviceLeft({
              serialNumber: removed.serialNumber,
              ip: removed.ip
            });
          }
        }
      }
    } else if (this.captureInterface) {
      this.capture.updateParseContext({
        deviceIps: this.trackedDeviceIps,
        hotspotSubnetPrefix: subnet
      });
    }
    this.broadcastStatus();
  }

  private startCapture(interfaceName: string, subnet: string): void {
    const started = this.capture.start({
      interfaceName,
      deviceIps: this.trackedDeviceIps,
      hotspotSubnetPrefix: subnet,
      onEvents: (events) => this.enqueueEvents(events),
      onError: (message) => {
        this.lastError = message;
        this.capture.stop();
        this.captureInterface = undefined;
        // Don't auto-respawn capture every tick after a blocking failure (e.g. missing privilege).
        // Recovery is explicit: macOS BPF re-check in tick(), or the Setup action on Linux/Windows.
        this.captureStartSuppressed = true;
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
      this.captureInterface = interfaceName;
      this.hotspotSubnet = `${subnet}.0/24`;
      this.hotspotSubnetPrefix = subnet;
      this.lastError = undefined;
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
            this.mitmLastError = undefined;
            this.mitmPortConflict = undefined;
          }
          this.broadcastStatus();
        },
        // Asynchronous listen failure (most commonly EADDRINUSE). Record the error and, when it's a
        // port conflict, resolve which process is squatting the port so the UI can name it.
        onError: (message) => {
          this.mitmLastError = message || 'MITM proxy failed to start';
          this.mitmPortConflict = this.buildPortConflict(message);
          this.broadcastStatus();
        },
        onTransaction: (tx) => {
          this.mitmTransactions += 1;
          this.enqueueEvents([mitmTransactionToEvent(tx)]);
        }
      });
      const started = this.mitmProxy.start();
      if (!started) {
        this.mitmLastError = this.mitmProxy.getLastError() || 'MITM proxy failed to start';
        this.mitmPortConflict = this.buildPortConflict(this.mitmLastError);
        this.mitmProxy = null;
      }
      // On `started === true` we DON'T optimistically clear the conflict here: `start()` returns
      // before the async `listen()` resolves, so the bind may still fail with EADDRINUSE. The
      // success is confirmed in `onListening` (clears) and failure in `onError` (re-sets) — clearing
      // here would flap the warning off/on every retry tick.
    } catch (err) {
      this.mitmLastError = err instanceof Error ? err.message : String(err);
      this.mitmPortConflict = this.buildPortConflict(this.mitmLastError);
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
    this.mitmLastError = undefined;
  }

  /**
   * Turn a proxy start failure into a structured, user-facing port conflict. Returns undefined when
   * the failure isn't an address-in-use error (those keep flowing through `mitmLastError`). When it
   * is, best-effort resolves the squatting process so the warning can name it and recommend either
   * closing it or changing the proxy port in RDS.
   */
  private buildPortConflict(message: string | undefined): MitmPortConflict | undefined {
    if (!isAddressInUseError(message)) return undefined;
    const port = this.mitmPort;
    const holder = detectPortHolder(port);
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
    // Persist the heavy headers/body to disk; keep only a lightweight summary in memory.
    const store = this.ensureDetailStore();
    const stored = store ? store.put(full) : false;
    const summary = summarizeEvent(full, stored);
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
    }
  }

  private enqueueEvents(events: ParsedNetworkEvent[]): void {
    for (const ev of events) {
      this.upsertEvent(ev);
    }
    this.trimEventBuffer();
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        const batch = this.pendingEvents.splice(0, this.pendingEvents.length);
        if (batch.length > 0) {
          this.listener.onEvents(batch);
        }
      }, 100);
    }
  }

  private broadcastStatus(): void {
    this.listener.onStatus(this.getStatus());
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
