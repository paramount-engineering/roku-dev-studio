/** Shared Network Inspector contracts (main ↔ renderer ↔ settings). */

/**
 * Raw frames are retained per device so a per-device pcap download always has a full window of
 * that Roku's traffic, regardless of how chatty other hotspot clients are. The cap bounds memory
 * to roughly (limit × number of active devices) frames.
 */
export const DEFAULT_MAX_RAW_PACKETS_PER_DEVICE = 5000;
export const MIN_MAX_RAW_PACKETS_PER_DEVICE = 100;
export const MAX_MAX_RAW_PACKETS_PER_DEVICE = 100_000;

/** Clamp an arbitrary value to the supported per-device raw packet retention range. */
export function clampMaxRawPacketsPerDevice(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : NaN;
  if (Number.isNaN(n)) return DEFAULT_MAX_RAW_PACKETS_PER_DEVICE;
  return Math.min(MAX_MAX_RAW_PACKETS_PER_DEVICE, Math.max(MIN_MAX_RAW_PACKETS_PER_DEVICE, n));
}

export type NetworkInspectorHotspotState =
  | 'disabled'
  | 'waiting'
  | 'starting'
  | 'active'
  | 'error';

export type NetworkInspectorPlatform = 'darwin' | 'win32' | 'linux';

/**
 * Structured description of why the MITM proxy could not bind its configured port (another
 * app/process is already listening on it). Follows the permission-remediation shape so the renderer
 * can show what is blocked, which process holds the port, and how to fix it (close that process or
 * change the proxy port in RDS) instead of leaving a raw `EADDRINUSE` in the logs.
 */
export type MitmPortConflict = {
  /** The configured proxy port RDS tried (and failed) to bind. */
  port: number;
  /** PID of the process currently holding the port, when it could be resolved. */
  pid?: number;
  /** Short process/command name holding the port (e.g. `node`, `Charles`), when resolved. */
  processName?: string;
  /** Fuller command line / image path of the holding process, when resolved. */
  command?: string;
  /** Short user-facing label. */
  title: string;
  /** One sentence describing what failed. */
  message: string;
  /** Ordered, copy-pasteable steps the user can follow to clear the conflict. */
  remediation: string[];
};

export type ParsedNetworkEventType =
  | 'dns-query'
  | 'dns-response'
  | 'tls-handshake'
  | 'tcp-connection'
  | 'udp-datagram'
  | 'http-transaction';

export type NetworkHttpMessage = {
  method?: string;
  url?: string;
  statusCode?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  bodyTruncated?: boolean;
  /**
   * How `body` is encoded. 'text' (default) is a charset-decoded string; 'base64' preserves
   * the raw bytes of binary payloads (images/video/audio/etc.) so they can be previewed.
   */
  bodyEncoding?: 'text' | 'base64';
  /**
   * Lightweight fields carried on the in-memory *summary* (the list view) so the renderer can
   * show content-type and size without holding the full `headers`/`body` in memory. The heavy
   * `headers`/`body` live in the on-disk detail store and are fetched on demand. `contentType`
   * is the bare mime (no charset); `bodyBytes` is the decoded payload size in bytes.
   */
  contentType?: string;
  bodyBytes?: number;
};

export type ParsedNetworkEvent = {
  id: string;
  type: ParsedNetworkEventType;
  deviceIp: string;
  timestamp: string;
  hostname?: string;
  resolvedIps?: string[];
  sni?: string;
  destIp?: string;
  destPort?: number;
  ttl?: number;
  flowId?: string;
  httpRequest?: NetworkHttpMessage;
  httpResponse?: NetworkHttpMessage;
  /** True when captured via local MITM proxy (decrypted HTTPS). */
  mitm?: boolean;
  /** Round-trip time in milliseconds when known (MITM HTTP). */
  durationMs?: number;
  /**
   * True on a list *summary* when the full headers/body for this event are retrievable from the
   * on-disk detail store via `NetworkInspectorGetEventDetail`. False/undefined means the detail
   * was never stored or has been evicted, so the detail panes have nothing more to load.
   */
  detailAvailable?: boolean;
};

export type HotspotClientDevice = {
  ip: string;
  serialNumber?: string;
  deviceName?: string;
  modelName?: string;
  firstSeen: string;
  lastSeen: string;
};

export type NetworkInspectorDeviceJoinedPayload = {
  serialNumber?: string;
  ip: string;
  deviceName?: string;
  modelName?: string;
};

export type NetworkInspectorDeviceLeftPayload = {
  serialNumber?: string;
  ip: string;
};

/**
 * Transport-agnostic sink for everything the Network Inspector engine pushes out. The engine
 * depends only on this interface — never on Electron IPC channel names — so the same engine can be
 * driven by an Electron-IPC adapter in the desktop app and by an HTTP/SSE adapter on the remote
 * server. Each method maps to one outbound message type.
 */
export interface NetworkInspectorListener {
  onEvents(batch: ParsedNetworkEvent[]): void;
  onStatus(status: NetworkInspectorStatus): void;
  onDeviceJoined(payload: NetworkInspectorDeviceJoinedPayload): void;
  onDeviceLeft(payload: NetworkInspectorDeviceLeftPayload): void;
  onDeviceDiscovered(device: HotspotClientDevice): void;
  onClientsCleared(): void;
}

export type NetworkInspectorStatus = {
  enabled: boolean;
  platform: NetworkInspectorPlatform;
  hotspotState: NetworkInspectorHotspotState;
  captureInterface?: string;
  captureActive: boolean;
  /**
   * A hotspot is *confidently* active (macOS Internet Sharing / Windows ICS·Mobile Hotspot /
   * Wi-Fi Direct / Linux shared gateway). Excludes the loose "any private LAN IP" Windows fallback,
   * so the Network Inspector only nudges capture setup when the user is genuinely using a hotspot.
   */
  hotspotInterfaceDetected?: boolean;
  hotspotSubnet?: string;
  hotspotGatewayIp?: string;
  connectedClients: HotspotClientDevice[];
  matchedSerials: string[];
  packetsCaptured: number;
  packetsDropped: number;
  eventsBuffered: number;
  lastError?: string;
  npcapInstalled?: boolean;
  capturePermissionHint?: string;
  bpfCaptureAvailable?: boolean;
  bpfLaunchDaemonInstalled?: boolean;
  /**
   * Platform-agnostic packet-capture readiness as far as it can be detected up front: macOS BPF
   * writable, Linux tcpdump present, Windows Npcap + native module loadable. Lets the renderer show
   * a single "capture blocked / set up" state without platform-specific branching.
   */
  captureToolAvailable?: boolean;
  /** Linux: tcpdump binary present (privilege is enforced at capture start). */
  linuxCaptureAvailable?: boolean;
  /** Windows: the native `cap` packet-capture binding loaded successfully. */
  capModuleAvailable?: boolean;
  prerequisites?: import('./prerequisites').PrerequisiteCheck[];
  /** Local HTTPS MITM proxy for dev channels. */
  mitmEnabled?: boolean;
  mitmActive?: boolean;
  mitmPort?: number;
  mitmListenAddress?: string;
  mitmLastError?: string;
  /**
   * Set when the MITM proxy can't bind its configured port because another process holds it.
   * Carries the offending process (when resolvable) and remediation so the Network tab can warn
   * the user to close that app or change the proxy port. Undefined when the port is free / bound.
   */
  mitmPortConflict?: MitmPortConflict;
  mitmCaFingerprint?: string;
  mitmTransactions?: number;
  /** Max raw frames retained per device for the pcap export (see DEFAULT_MAX_RAW_PACKETS_PER_DEVICE). */
  maxRawPacketsPerDevice?: number;
  /** Per-device block/throttle rules currently in effect (keyed by device IP). */
  trafficRules?: NetworkTrafficRules;
};

/**
 * Bandwidth/latency shaping applied to a device or host. `downKbps` caps download throughput in
 * kilobits/sec (0/undefined = unlimited); `latencyMs` adds artificial round-trip delay. Enforced at
 * the MITM proxy, so it only affects requests the dev channel routes through RDS.
 */
export type TrafficThrottle = {
  downKbps?: number;
  latencyMs?: number;
};

/**
 * Canned response the proxy returns instead of forwarding upstream (request mocking). Lets QA
 * exercise error/edge paths without touching the real backend. `body` is text; `contentType`
 * is merged into headers; `delayMs` stalls before responding (simulate slow endpoints).
 */
export type MockResponse = {
  statusCode: number;
  statusText?: string;
  contentType?: string;
  headers?: Record<string, string>;
  body?: string;
  delayMs?: number;
};

/** A per-host rule within a device's traffic rules. `host` matches a hostname exactly or by suffix. */
export type HostTrafficRule = {
  host: string;
  block?: boolean;
  throttle?: TrafficThrottle;
  /** Optional case-insensitive substring of the request path; when set the rule only applies to
   *  matching paths (lets you mock/block a single endpoint on a shared host). */
  pathContains?: string;
  /** Return this canned response instead of forwarding upstream (request mocking). */
  respond?: MockResponse;
  /** Fault injection: drop the connection (simulate a network failure / RST). */
  resetConnection?: boolean;
};

/** Block/throttle rules for a single device (keyed by its IP), applied to proxied traffic. */
export type DeviceTrafficRules = {
  /** Block all of this device's proxied requests (returns 403 at the proxy). */
  blockAll?: boolean;
  /** Device-wide throttle applied to every proxied response for this device. */
  throttle?: TrafficThrottle;
  /** Per-host overrides (block or throttle specific hosts). */
  hosts?: HostTrafficRule[];
};

/** All device traffic rules, keyed by device IP. */
export type NetworkTrafficRules = Record<string, DeviceTrafficRules>;

/** Resolved decision for a single proxied request (device IP + target host + path). */
export type TrafficDecision = {
  block: boolean;
  throttle?: TrafficThrottle;
  /** Canned response to return instead of forwarding upstream (mocking). */
  respond?: MockResponse;
  /** Fault injection: drop the connection without responding. */
  resetConnection?: boolean;
};

/** True throttle (some positive limit/latency), so callers can skip pacing when it's a no-op. */
export function throttleIsActive(t: TrafficThrottle | undefined): boolean {
  if (!t) return false;
  return (typeof t.downKbps === 'number' && t.downKbps > 0) ||
    (typeof t.latencyMs === 'number' && t.latencyMs > 0);
}

/** A rule host matches a request hostname exactly or as a domain suffix (e.g. `paramount.com`). */
export function hostRuleMatches(ruleHost: string, hostname: string): boolean {
  const r = (ruleHost || '').trim().toLowerCase();
  const h = (hostname || '').trim().toLowerCase();
  if (!r || !h) return false;
  return h === r || h.endsWith('.' + r);
}

/** A host rule applies when its host matches AND (no `pathContains`, or the path contains it). */
function hostRuleApplies(rule: HostTrafficRule, hostname: string, path: string): boolean {
  if (!hostRuleMatches(rule.host, hostname)) return false;
  const needle = (rule.pathContains || '').trim().toLowerCase();
  if (!needle) return true;
  return (path || '').toLowerCase().includes(needle);
}

/**
 * Combine a host throttle with the device throttle so the device limit is always the bound:
 *  - bandwidth: the most restrictive (lowest positive) cap wins, so a host can only be the SAME or
 *    SLOWER than the device — never faster. A host "Unlimited" (unset) therefore inherits the
 *    device cap.
 *  - latency: the device latency is the floor; the host can only ADD more, never less (max of the
 *    two).
 */
function combineThrottle(
  device: TrafficThrottle | undefined,
  host: TrafficThrottle
): TrafficThrottle {
  const result: TrafficThrottle = {};
  const caps = [device?.downKbps, host.downKbps].filter(
    (k): k is number => typeof k === 'number' && k > 0
  );
  if (caps.length > 0) result.downKbps = Math.min(...caps);
  const latency = Math.max(device?.latencyMs ?? 0, host.latencyMs ?? 0);
  if (latency > 0) result.latencyMs = latency;
  return result;
}

/**
 * Resolve the effective decision for a request. Device-level block wins outright; otherwise the
 * matching host rules apply in order. A terminal action (block / mock response / reset) on a
 * matching rule short-circuits; a matching host throttle is combined with the device throttle so
 * the host stays capped to the device speed and floored to the device latency. `path` is the
 * request path/URL, used by per-host `pathContains` matching.
 */
export function resolveTrafficDecision(
  rules: DeviceTrafficRules | undefined,
  hostname: string,
  path = ''
): TrafficDecision {
  if (!rules) return { block: false };
  if (rules.blockAll) return { block: true };
  let throttle = throttleIsActive(rules.throttle) ? rules.throttle : undefined;
  if (Array.isArray(rules.hosts)) {
    for (const hr of rules.hosts) {
      if (!hostRuleApplies(hr, hostname, path)) continue;
      if (hr.block) return { block: true };
      if (hr.resetConnection) return { block: false, resetConnection: true };
      if (hr.respond) return { block: false, respond: hr.respond };
      if (hr.throttle && throttleIsActive(hr.throttle)) throttle = combineThrottle(rules.throttle, hr.throttle);
    }
  }
  return { block: false, throttle };
}

export type NetworkInspectorSettingsSave = {
  networkInspectorEnabled: boolean;
  networkInspectorMitmEnabled?: boolean;
  networkInspectorMitmPort?: number;
  networkInspectorMaxRawPacketsPerDevice?: number;
};

export type NetworkInspectorCaInfo = {
  commonName: string;
  fingerprintSha256: string;
  createdAt: string;
  proxyHostPort: string;
};
