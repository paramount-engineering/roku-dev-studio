/**
 * Loopback HTTP bridge that the bundled MCP server (`roku-dev-studio-mcp`)
 * uses to call into the running Dev Studio process for live tools.
 *
 * Lifecycle:
 *   - Started on app ready, regardless of whether any client is currently
 *     enabled — keeps the descriptor file in sync with the running process.
 *   - Listens on 127.0.0.1 only, on a random port.
 *   - Per-launch bearer token, written to `<userData>/mcp-bridge.json`.
 *   - Stopped (and descriptor removed) when the app is about to quit.
 *
 * State:
 *   - The renderer is the source of truth for selected-device and the App
 *     Connector function list. It pushes a snapshot here whenever those
 *     change (`McpBridgeReportState`). The bridge serves the latest snapshot.
 *   - `send_script_to_builder` is a fire-and-acknowledge round-trip: bridge →
 *     renderer (drop) → renderer → bridge (result). A correlation id pairs
 *     the request with the result.
 *
 * Security:
 *   - Bound to 127.0.0.1; not reachable from the network.
 *   - Per-launch bearer token, compared in constant time
 *     (`crypto.timingSafeEqual`) on every request.
 *   - DNS-rebinding mitigation: requests must carry a loopback `Host` header
 *     (`127.0.0.1:<port>` or `localhost:<port>`); when an `Origin` header is
 *     present it must also be loopback (or the opaque `null` origin). A
 *     malicious page on a domain that briefly resolves to 127.0.0.1 reaches
 *     the socket but carries the attacker's domain in `Host` / `Origin` and
 *     is rejected before the bearer check.
 *   - Read-only by design. The only "write" is `send_script_to_builder` which
 *     opens a modal; the human still presses Run.
 *   - For password-bearing ops, an omitted `password` is filled from the same
 *     per-serial localStorage the device panel uses (Remember); only the active
 *     renderer receives the lookup — never written to disk by the bridge.
 */

import type { App, IpcMain, WebContents } from 'electron';
import * as http from 'http';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { IPC } from '../shared/ipc/channels';
import { parseDeviceRef, deviceMatches, findDevice } from 'roku-dev-studio-platform/device-ref';
import type {
  McpBridgeAppConnectorState,
  McpBridgeDeviceSnapshot,
  McpBridgeSelectedDeviceSnapshot
} from '../shared/mcp-bridge-state';
import { mainLog, mainWarn } from './log.js';
import { hashParamsForAudit, recordMcpAudit, setMcpAuditLogDir } from './mcp-audit-log';
import { rateBudgetForRequest, take as takeRateToken } from './mcp-rate-limit';
import {
  getNetworkInspectorService,
  type NetworkInspectorService,
  type NetworkEventQuery,
  type ParsedNetworkEvent
} from './network-inspector/index';

const rokuApi = require('roku-dev-studio-api') as {
  query: (ip: string, endpoint: string) => Promise<unknown>;
  keypress: (ip: string, key: string) => Promise<unknown>;
  launch: (ip: string, appId: string, params?: Record<string, string>) => Promise<unknown>;
  post: (ip: string, endpoint: string) => Promise<unknown>;
  inputText: (ip: string, text: string) => Promise<unknown>;
  deeplink: (ip: string, appId: string, contentId?: string, mediaType?: string) => Promise<unknown>;
  testConnection: (ip: string) => Promise<unknown>;
  getIcon: (ip: string, appId: string) => Promise<unknown>;
  sideloadChannel: (opts: { ip: string; filePath: string; password: string; log?: (m: string) => void }) => Promise<{ success: boolean; error?: string }>;
  deleteSideload: (opts: { ip: string; password: string; log?: (m: string) => void }) => Promise<{ success: boolean; error?: string }>;
  captureRokuScreenshot: (opts: {
    ip: string;
    password: string;
    waitAfterTriggerMs?: number;
  }) => Promise<{ success: boolean; imageBuffer?: Buffer; buffer?: Buffer; filename?: string; error?: string }>;
  ssdpDiscover: (opts?: { timeoutMs?: number }) => Promise<Array<Record<string, unknown>>>;
  subnetScan: (opts?: { concurrency?: number; timeoutMs?: number }) => Promise<Array<Record<string, unknown>>>;
  // Operations framework (canonical source of truth for device ops).
  findOp: (id: string) => RokuOp | undefined;
  runOpForHttp: (op: RokuOp, body: unknown) => Promise<{ status: number; body: Record<string, unknown> }>;
  ALL_OPS: ReadonlyArray<RokuOp>;
};

type RokuOp = {
  id: string;
  title: string;
  description: string;
  runIn: 'main' | 'renderer';
  destructive: boolean;
  inputSchema: Record<string, unknown>;
};

const ecpQueryDirect = rokuApi.query;

const BRIDGE_FILE_NAME = 'mcp-bridge.json';
const DROP_REQUEST_TIMEOUT_MS = 15000;

type DeviceSnapshot = McpBridgeDeviceSnapshot;
type SelectedDeviceSnapshot = McpBridgeSelectedDeviceSnapshot;
type AppConnectorState = McpBridgeAppConnectorState;

type BridgeState = {
  selectedDevice: SelectedDeviceSnapshot;
  /** Every device with an open tab in the running Dev Studio. */
  connectedDevices: DeviceSnapshot[];
  /** All known devices (connected + discovered on LAN + remote-location devices the user has seen). */
  knownDevices: DeviceSnapshot[];
  /** ISO time the renderer last pushed `connectedDevices` / `knownDevices`. */
  connectedDevicesObservedAt: string | null;
  appConnector: AppConnectorState;
};

type DropResult = { ok: boolean; error?: string };

type PendingDrop = {
  resolve: (r: DropResult) => void;
  timer: NodeJS.Timeout;
};

type RaleResult = { ok: boolean; data?: unknown; error?: string };

type PendingRale = {
  resolve: (r: RaleResult) => void;
  timer: NodeJS.Timeout;
};

type FunctionsResult = {
  ok: boolean;
  status?: AppConnectorState['status'];
  functions?: AppConnectorState['functions'];
  error?: string;
};

type PendingFunctions = {
  resolve: (r: FunctionsResult) => void;
  timer: NodeJS.Timeout;
};

type ConnectResult = {
  ok: boolean;
  device?: { ip: string | null; serial: string | null };
  error?: string;
};

type PendingConnect = {
  resolve: (r: ConnectResult) => void;
  timer: NodeJS.Timeout;
};

type ToolResult = { ok: boolean; data?: unknown; error?: string };
type PendingTool = {
  resolve: (r: ToolResult) => void;
  timer: NodeJS.Timeout;
};

type TargetRef = { targetSerial?: string; targetIp?: string };

/**
 * Resolve a caller-supplied `device` string to the known-devices entry so we
 * can forward consistent serial + ip fields to the renderer regardless of
 * which the agent passed. Returns the target even if the device isn't
 * connected, so "known but not connected" can be handled explicitly.
 */
function resolveTarget(deviceArg: string | undefined): TargetRef | null {
  // Parse + match via the shared device-ref helpers (single source of truth for
  // "what did the caller mean and which device is it?").
  const ref = parseDeviceRef(deviceArg);
  if (!ref) return null;
  // Search connectedDevices first (freshest data), then knownDevices as fallback.
  // Avoids a stale knownDevices entry winning over a live connectedDevices entry.
  // findDevice() matches serial before IP, so a live entry normalizes serial + ip together.
  const match = findDevice([...state.connectedDevices, ...state.knownDevices], ref);
  if (match) return { targetSerial: match.serial || undefined, targetIp: match.ip || undefined };
  // Nothing matched — still forward whatever the caller typed so the renderer
  // can produce a clear error.
  return { targetSerial: ref.serial, targetIp: ref.ip };
}

/**
 * Whether the resolved target is currently connected. When false, the bridge
 * can short-circuit with a clear error + suggestion to call `connect_device`.
 */
function isTargetConnected(target: TargetRef | null): boolean {
  if (!target) return state.connectedDevices.length > 0;
  const ref = { serial: target.targetSerial, ip: target.targetIp };
  return state.connectedDevices.some((d) => deviceMatches(d, ref));
}

function notConnectedError(target: TargetRef): { error: string; suggestion: string } {
  const label = target.targetSerial || target.targetIp || '(unspecified)';
  return {
    error: `Device "${label}" is not connected in Dev Studio.`,
    suggestion:
      'Call `connect_device({ device: "..." })` to open a tab, or `list_devices` to see what\'s available.'
  };
}

let server: http.Server | null = null;
let bridgePort = 0;
let bridgeToken = '';
let descriptorPath = '';
let descriptorRecheckInterval: NodeJS.Timeout | null = null;
let getRendererSender: (() => WebContents | null) = () => null;

const pendingDrops = new Map<string, PendingDrop>();
let dropCorrelationCounter = 0;

const pendingRale = new Map<string, PendingRale>();
let raleCorrelationCounter = 0;

const pendingFunctions = new Map<string, PendingFunctions>();
let functionsCorrelationCounter = 0;
/** Hard ceiling on a borrow-fetch — TrackerTask init can be slow. */
const FUNCTIONS_REQUEST_TIMEOUT_MS = 20000;

const pendingConnect = new Map<string, PendingConnect>();
let connectCorrelationCounter = 0;
/** Connects that involve real device handshakes can take a moment. */
const CONNECT_REQUEST_TIMEOUT_MS = 30000;

const pendingTool = new Map<string, PendingTool>();
let toolCorrelationCounter = 0;
/** Generic renderer tools inherit the same timeout as connect. */
const TOOL_REQUEST_TIMEOUT_MS = 30000;

type PendingStoredPassword = { resolve: (password: string | null) => void; timer: NodeJS.Timeout };
const pendingStoredPassword = new Map<string, PendingStoredPassword>();
let storedPasswordCorrelationCounter = 0;
const STORED_PASSWORD_REQUEST_TIMEOUT_MS = 3000;

/** Minimum gap between scan-devices calls to prevent LAN flooding by a looping agent. */
const SCAN_DEVICES_COOLDOWN_MS = 10000;
let lastScanDevicesAt = 0;

function serialForConnectedIp(ip: string): string | null {
  const row = state.connectedDevices.find((d) => d.ip === ip);
  if (row?.serial) return row.serial;
  if (state.selectedDevice?.ip === ip && state.selectedDevice.serial) return state.selectedDevice.serial;
  return null;
}

async function requestStoredDevPassword(serial: string): Promise<string | null> {
  const sender = getRendererSender();
  if (!sender) return null;
  const correlationId = `mcp-pw-${++storedPasswordCorrelationCounter}-${Date.now()}`;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingStoredPassword.delete(correlationId);
      resolve(null);
    }, STORED_PASSWORD_REQUEST_TIMEOUT_MS);
    pendingStoredPassword.set(correlationId, { resolve, timer });
    try {
      sender.send(IPC.McpBridgeStoredPasswordRequest, { correlationId, serial });
    } catch (e) {
      clearTimeout(timer);
      pendingStoredPassword.delete(correlationId);
      resolve(null);
    }
  });
}

/**
 * When the MCP agent omits `password`, use the value remembered in the
 * renderer for this device's serial (same storage as the device panel).
 */
async function fillPasswordFromDevStudioIfNeeded(opId: string, params: Record<string, unknown>): Promise<void> {
  if (opId !== 'screenshot' && opId !== 'sideload' && opId !== 'delete_sideload') return;
  const pw = params.password;
  if (typeof pw === 'string' && pw.trim().length > 0) return;
  const ip = typeof params.ip === 'string' ? params.ip.trim() : '';
  if (!ip) return;
  const serial = serialForConnectedIp(ip);
  if (!serial) return;
  const stored = await requestStoredDevPassword(serial);
  if (stored && stored.trim()) params.password = stored.trim();
}

const state: BridgeState = {
  selectedDevice: null,
  connectedDevices: [],
  knownDevices: [],
  connectedDevicesObservedAt: null,
  appConnector: { status: 'unknown', functions: [] }
};

function logInfo(message: string, ...rest: unknown[]): void {
  mainLog(`[mcp-bridge] ${message}`, ...rest);
}

function logWarn(message: string, ...rest: unknown[]): void {
  mainWarn(`[mcp-bridge] ${message}`, ...rest);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Cached payload for the descriptor so we can rewrite it without recomputing
 * — needed by `descriptorWatcher` below, which heals an externally-deleted
 * file as long as the bridge is still alive.
 */
let descriptorPayload: {
  port: number;
  token: string;
  pid: number;
  startedAt: string;
} | null = null;

function writeDescriptor(userData: string): void {
  const file = path.join(userData, BRIDGE_FILE_NAME);
  const payload = {
    port: bridgePort,
    token: bridgeToken,
    pid: process.pid,
    startedAt: new Date().toISOString()
  };
  try {
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), { encoding: 'utf-8', mode: 0o600 });
    descriptorPath = file;
    descriptorPayload = payload;
    logInfo(`bridge descriptor at ${file} (port ${bridgePort})`);
  } catch (e) {
    logWarn('failed to write bridge descriptor', e);
  }
}

function rewriteDescriptorIfMissing(): void {
  if (!descriptorPath || !descriptorPayload) return;
  if (fs.existsSync(descriptorPath)) return;
  try {
    fs.mkdirSync(path.dirname(descriptorPath), { recursive: true });
    fs.writeFileSync(descriptorPath, JSON.stringify(descriptorPayload, null, 2), {
      encoding: 'utf-8',
      mode: 0o600
    });
    logInfo(`bridge descriptor was missing — rewrote at ${descriptorPath} (port ${bridgePort})`);
  } catch (e) {
    logWarn('failed to rewrite bridge descriptor', e);
  }
}

function removeDescriptor(): void {
  if (!descriptorPath) return;
  try {
    fs.rmSync(descriptorPath, { force: true });
  } catch {
    /* ignore */
  }
  descriptorPayload = null;
}

/**
 * Constant-time string compare. Length-mismatched inputs are rejected up
 * front (the token length is fixed and well-known anyway — 64 hex chars
 * for a 32-byte secret — so leaking length here doesn't reveal anything).
 * For equal-length inputs we use `crypto.timingSafeEqual` so the byte-by-
 * byte compare doesn't short-circuit on the first mismatch.
 */
function safeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf-8');
  const bBuf = Buffer.from(b, 'utf-8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Reject requests whose Host or Origin doesn't look like a legitimate
 * loopback caller. Defends against DNS rebinding: a page on a domain
 * that resolves (briefly) to 127.0.0.1 still reaches our socket, but
 * carries the attacker's hostname in the `Host` header (and, if it's a
 * cross-origin fetch from a browser, in `Origin` too).
 *
 * Allowed:
 *   - `Host: 127.0.0.1:<port>` or `Host: localhost:<port>`
 *   - `Origin` absent (our own bridge-client / curl / Postman) OR
 *     loopback (`http://127.0.0.1[:port]`, `http://localhost[:port]`,
 *     or the opaque `null` origin some local file:// pages emit).
 */
function isLoopbackRequest(req: http.IncomingMessage): boolean {
  const host = typeof req.headers.host === 'string' ? req.headers.host : '';
  if (!host) return false;
  const lastColon = host.lastIndexOf(':');
  const hostname = lastColon >= 0 ? host.slice(0, lastColon) : host;
  if (hostname !== '127.0.0.1' && hostname !== 'localhost') return false;

  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  if (origin === '') return true;
  if (origin === 'null') return true;
  return (
    origin === 'http://localhost' ||
    origin.startsWith('http://localhost:') ||
    origin === 'http://127.0.0.1' ||
    origin.startsWith('http://127.0.0.1:')
  );
}

function isAuthorized(req: http.IncomingMessage): boolean {
  if (bridgeToken.length === 0) return false;
  const auth = req.headers['authorization'];
  if (typeof auth !== 'string') return false;
  const space = auth.indexOf(' ');
  if (space < 0) return false;
  const scheme = auth.slice(0, space);
  const token = auth.slice(space + 1);
  if (scheme !== 'Bearer') return false;
  return safeStringEqual(token, bridgeToken);
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const max = 1024 * 1024; // 1 MB cap; scripts are small.
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > max) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf-8');
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

type JsonObject = Record<string, unknown>;
type JsonRead = JsonObject & { __err?: string };

/** POST body read that maps JSON parse errors to `{ __err }` instead of throwing. */
async function readJsonLoose(req: http.IncomingMessage): Promise<JsonRead> {
  try {
    const body = await readJsonBody(req);
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as JsonRead;
    return {};
  } catch (e) {
    return { __err: e instanceof Error ? e.message : String(e) };
  }
}

function send400IfJsonErr(res: http.ServerResponse, body: JsonRead): body is JsonObject {
  if (typeof body.__err === 'string') {
    sendJson(res, 400, { error: body.__err });
    return false;
  }
  return true;
}

/**
 * From a POST body with optional `device`, require a connected tab and resolved IP.
 * Sends 409 and returns null when the target is missing, not connected, or has no IP.
 */
function resolveIpForConnectedDevice(
  res: http.ServerResponse,
  body: JsonObject,
  noIpMessage = 'No device selected. Pass `device` or open a device tab.'
): { target: TargetRef | null; ip: string } | null {
  const target = resolveTarget(typeof body.device === 'string' ? body.device : undefined);
  if (target && !isTargetConnected(target)) {
    sendJson(res, 409, notConnectedError(target));
    return null;
  }
  const ip = resolveIp(target);
  if (!ip) {
    sendJson(res, 409, { error: noIpMessage });
    return null;
  }
  return { target, ip };
}

function completeCorrelation<T>(
  map: Map<string, { resolve: (r: T) => void; timer: NodeJS.Timeout }>,
  correlationId: unknown,
  value: T
): void {
  if (typeof correlationId !== 'string') return;
  const pending = map.get(correlationId);
  if (!pending) return;
  map.delete(correlationId);
  clearTimeout(pending.timer);
  pending.resolve(value);
}

function rejectAllPending<T>(
  map: Map<string, { resolve: (r: T) => void; timer: NodeJS.Timeout }>,
  value: T
): void {
  for (const pending of map.values()) {
    clearTimeout(pending.timer);
    pending.resolve(value);
  }
  map.clear();
}

async function runFunctionsFetch(target: TargetRef | null): Promise<FunctionsResult> {
  const sender = getRendererSender();
  if (!sender) {
    return { ok: false, error: 'No active Roku Dev Studio window to fetch functions.' };
  }
  const correlationId = `mcp-fn-${++functionsCorrelationCounter}-${Date.now()}`;
  return new Promise<FunctionsResult>((resolve) => {
    const timer = setTimeout(() => {
      pendingFunctions.delete(correlationId);
      resolve({ ok: false, error: 'Timed out waiting for App Connector fetch.' });
    }, FUNCTIONS_REQUEST_TIMEOUT_MS);
    pendingFunctions.set(correlationId, { resolve, timer });
    try {
      sender.send(IPC.McpBridgeFunctionsRequest, { correlationId, ...(target || {}) });
    } catch (e) {
      clearTimeout(timer);
      pendingFunctions.delete(correlationId);
      resolve({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}

/**
 * Generic round-trip for renderer-owned tools: RALE writes (full surface),
 * App Connector connect/disconnect, telnet send. The renderer dispatches by
 * tool name and returns { ok, data?, error? }.
 */
async function runRendererTool(
  tool: string,
  args: unknown,
  target: TargetRef | null,
  timeoutMs = TOOL_REQUEST_TIMEOUT_MS
): Promise<ToolResult> {
  const sender = getRendererSender();
  if (!sender) {
    return { ok: false, error: 'No active Roku Dev Studio window to run the tool.' };
  }
  const correlationId = `mcp-tool-${++toolCorrelationCounter}-${Date.now()}`;
  return new Promise<ToolResult>((resolve) => {
    const timer = setTimeout(() => {
      pendingTool.delete(correlationId);
      resolve({ ok: false, error: `Timed out running renderer tool "${tool}".` });
    }, timeoutMs);
    pendingTool.set(correlationId, { resolve, timer });
    try {
      sender.send(IPC.McpBridgeToolRequest, { correlationId, tool, args, ...(target || {}) });
    } catch (e) {
      clearTimeout(timer);
      pendingTool.delete(correlationId);
      resolve({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}

/**
 * Broadcast an agent-initiated action to the renderer for toast surfacing.
 * Non-blocking; agent proceeds while the user sees it.
 */
function notifyAgentAction(payload: {
  level: 'info' | 'destructive';
  summary: string;
  details?: Record<string, unknown>;
}): void {
  const sender = getRendererSender();
  if (!sender) return;
  try {
    sender.send(IPC.McpBridgeAgentAction, payload);
  } catch (e) {
    logWarn('agent-action broadcast failed', e);
  }
}

/**
 * Broadcast an agent-captured screenshot to the renderer so the matching
 * device tab's screenshot pane can display it. Sent regardless of whether
 * the agent asked the MCP response to include base64 (`returnImageBase64`).
 */
function notifyAgentScreenshot(payload: {
  ip: string;
  dataUrl: string;
  filename: string;
  bytes: number;
  mimeType: string;
}): void {
  const sender = getRendererSender();
  if (!sender) return;
  try {
    sender.send(IPC.McpBridgeAgentScreenshot, payload);
  } catch (e) {
    logWarn('agent-screenshot broadcast failed', e);
  }
}

/**
 * Resolve the IP of a device from a target (or fall back to the focused
 * device's IP). Used by main-direct ECP/sideload endpoints.
 */
function resolveIp(target: TargetRef | null): string | null {
  if (target) {
    const match = findDevice(state.connectedDevices, { serial: target.targetSerial, ip: target.targetIp });
    return match?.ip || null;
  }
  return state.selectedDevice?.ip || null;
}

/**
 * Human-friendly device label for toasts ("Roku Ultra (192.168.1.182)").
 */
function deviceLabel(ip: string | null): string {
  if (!ip) return 'selected device';
  const match = state.connectedDevices.find((d) => d.ip === ip) || state.knownDevices.find((d) => d.ip === ip);
  const name = match?.friendlyDeviceName || match?.modelName || 'device';
  return `${name} (${ip})`;
}

async function runConnectDevice(target: TargetRef): Promise<ConnectResult> {
  const sender = getRendererSender();
  if (!sender) {
    return { ok: false, error: 'No active Roku Dev Studio window to connect a device.' };
  }
  if (!target.targetSerial && !target.targetIp) {
    return { ok: false, error: 'connect_device requires a `device` (IP or serial).' };
  }
  const correlationId = `mcp-connect-${++connectCorrelationCounter}-${Date.now()}`;
  return new Promise<ConnectResult>((resolve) => {
    const timer = setTimeout(() => {
      pendingConnect.delete(correlationId);
      resolve({ ok: false, error: 'Timed out waiting for device connect.' });
    }, CONNECT_REQUEST_TIMEOUT_MS);
    pendingConnect.set(correlationId, { resolve, timer });
    try {
      sender.send(IPC.McpBridgeConnectRequest, { correlationId, ...target });
    } catch (e) {
      clearTimeout(timer);
      pendingConnect.delete(correlationId);
      resolve({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}

async function runRaleCommand(command: string, args: unknown, target: TargetRef | null): Promise<RaleResult> {
  const sender = getRendererSender();
  if (!sender) {
    return { ok: false, error: 'No active Roku Dev Studio window to handle the request.' };
  }
  const correlationId = `mcp-rale-${++raleCorrelationCounter}-${Date.now()}`;
  return new Promise<RaleResult>((resolve) => {
    const timer = setTimeout(() => {
      pendingRale.delete(correlationId);
      resolve({ ok: false, error: 'Timed out waiting for renderer to ack the RALE command.' });
    }, DROP_REQUEST_TIMEOUT_MS);
    pendingRale.set(correlationId, { resolve, timer });
    try {
      sender.send(IPC.McpBridgeRaleRequest, { correlationId, command, args, ...(target || {}) });
    } catch (e) {
      clearTimeout(timer);
      pendingRale.delete(correlationId);
      resolve({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}

async function handleDropScript(payload: unknown): Promise<DropResult> {
  const sender = getRendererSender();
  if (!sender) {
    return { ok: false, error: 'No active Roku Dev Studio window to receive the script.' };
  }
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const script = body.script ?? null;
  if (script == null) return { ok: false, error: 'Missing `script` in request body.' };
  const target = resolveTarget(typeof body.device === 'string' ? body.device : undefined);

  const correlationId = `mcp-drop-${++dropCorrelationCounter}-${Date.now()}`;
  return new Promise<DropResult>((resolve) => {
    const timer = setTimeout(() => {
      pendingDrops.delete(correlationId);
      resolve({ ok: false, error: 'Timed out waiting for renderer to ack the drop.' });
    }, DROP_REQUEST_TIMEOUT_MS);
    pendingDrops.set(correlationId, { resolve, timer });
    try {
      sender.send(IPC.McpBridgeDropScript, { correlationId, script, ...(target || {}) });
    } catch (e) {
      clearTimeout(timer);
      pendingDrops.delete(correlationId);
      resolve({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}

/**
 * Per-request audit accumulator. Each branch in `handleRequest` populates
 * the fields it knows (`op`, `device`, `destructive`, `params`) and sets
 * `enabled = true` to opt this request into the audit log. The
 * `res.on('finish')` hook below writes the final record once the response
 * has flushed (so we capture the real status + duration, not what we
 * intended).
 */
type AuditDraft = {
  enabled: boolean;
  op: string;
  device: string | null;
  destructive: boolean;
  params: unknown;
  /** When set, written verbatim into the audit `error` field. */
  errorOverride?: string;
};

/**
 * Seed audit defaults from the request method + path. Skips read-only
 * state queries (`/health`, `/selected-device`, `/devices`) — those are
 * served from in-memory snapshots and don't need an audit trail. Branches
 * that handle the request later refine `device` and `params` (and, for
 * `/tool`, the actual tool name).
 */
const ALIAS_AUDIT_MAP: Record<string, { op: string; destructive: boolean }> = {
  '/keypress': { op: 'keypress', destructive: false },
  '/launch': { op: 'launch_app', destructive: false },
  '/input-text': { op: 'input_text', destructive: false },
  '/deep-link': { op: 'deep_link', destructive: false },
  '/ecp-query': { op: 'ecp_query', destructive: false },
  '/ecp-post': { op: 'ecp_post', destructive: true },
  '/test-connection': { op: 'test_connection', destructive: false },
  '/sideload': { op: 'sideload', destructive: true },
  '/delete-sideload': { op: 'delete_sideload', destructive: true },
  '/screenshot': { op: 'screenshot', destructive: true },
  '/scan-devices': { op: 'scan_devices', destructive: false },
  '/get-app-icon': { op: 'get_app_icon', destructive: false },
  '/rale/get-node-by-id': { op: 'rale_get_node_by_id', destructive: false }
};

function seedAuditFromPath(audit: AuditDraft, method: string, pathname: string): void {
  if (method === 'GET') {
    if (pathname === '/app-connector/functions') {
      audit.enabled = true;
      audit.op = 'list_app_connector_functions';
      audit.destructive = false;
    }
    return;
  }
  if (method !== 'POST') return;
  if (pathname.startsWith('/op/')) {
    const opId = pathname.slice('/op/'.length);
    const op = rokuApi.findOp(opId);
    audit.enabled = true;
    audit.op = opId;
    audit.destructive = op ? op.destructive : true;
    return;
  }
  if (pathname === '/tool') {
    // `op` is refined to `tool:<name>` later when the body is parsed.
    audit.enabled = true;
    audit.op = 'tool';
    audit.destructive = true;
    return;
  }
  if (pathname === '/connect-device') {
    audit.enabled = true;
    audit.op = 'connect_device';
    audit.destructive = false;
    return;
  }
  if (pathname === '/builder/drop-script') {
    audit.enabled = true;
    audit.op = 'send_script_to_builder';
    audit.destructive = true;
    return;
  }
  const m = ALIAS_AUDIT_MAP[pathname];
  if (m) {
    audit.enabled = true;
    audit.op = m.op;
    audit.destructive = m.destructive;
  }
}

/**
 * Bridge-side accessor for the Network Inspector singleton. The service is constructed at app
 * startup by `setupNetworkInspectorHandlers` (which runs before `startMcpBridge`), so passing this
 * forwarding `safeSend` just returns the existing instance — it never clobbers the renderer wiring.
 */
function networkInspectorService(): NetworkInspectorService {
  return getNetworkInspectorService((channel, data) => {
    const wc = getRendererSender();
    if (!wc) return;
    try {
      wc.send(channel, data);
    } catch {
      /* renderer gone; drop */
    }
  });
}

/**
 * Resolve an agent-supplied `device` (IP or serial) to the IP the Network Inspector keys captured
 * traffic under (a Roku's hotspot lease IP == its ECP IP). Returns undefined when no device was
 * supplied (caller treats that as "all connected Rokus"). Falls back to a raw IP literal so capture
 * still works for a device that has traffic but no open Dev Studio tab.
 */
function resolveNetworkInspectorDeviceIp(deviceArg: unknown): string | undefined {
  if (typeof deviceArg !== 'string') return undefined;
  const s = deviceArg.trim();
  if (!s) return undefined;
  const ip = resolveIp(resolveTarget(s));
  if (ip) return ip;
  return s.includes('.') ? s : undefined;
}

/**
 * Gate every Network Inspector read on the feature being enabled. When disabled we return a
 * structured 409 with copy-pasteable remediation (per the permission-remediation UX rule) so the
 * agent can tell the user exactly how to turn it on rather than reporting an opaque empty result.
 */
function networkInspectorGate(res: http.ServerResponse): NetworkInspectorService | null {
  const svc = networkInspectorService();
  if (!svc.isEnabled()) {
    sendJson(res, 409, {
      error: 'Network Inspector is disabled in Roku Dev Studio.',
      code: 'network-inspector-disabled',
      remediation: [
        'In Roku Dev Studio open Settings → Network Inspector.',
        'Enable Network Inspector. Keep the HTTPS proxy (MITM) on so request/response bodies from sideloaded dev channels are decrypted; otherwise only HTTP plus DNS/TLS metadata is visible.',
        'Make sure the Roku is on this machine\'s hotspot / shared connection so its traffic is captured.',
        'Return and retry. Call network_inspector_status to confirm capture is active before reading events.'
      ]
    });
    return null;
  }
  return svc;
}

/** Status fields most relevant to an agent deciding whether reads will return anything useful. */
function networkInspectorReadiness(svc: NetworkInspectorService): {
  ready: boolean;
  notice?: string;
  remediation?: string[];
} {
  const status = svc.getStatus();
  if (status.captureToolAvailable === false) {
    const prereq = (status.prerequisites || []).find((p) => !p.ok);
    return {
      ready: false,
      notice: prereq?.message || status.capturePermissionHint || 'Packet capture is not available.',
      remediation: prereq?.remediation
    };
  }
  if (!status.captureActive) {
    return {
      ready: false,
      notice:
        'Network Inspector is enabled but not capturing yet — no active hotspot/shared connection was detected. Connect the Roku to this machine\'s hotspot or Internet Sharing.',
      remediation: status.capturePermissionHint ? [status.capturePermissionHint] : undefined
    };
  }
  return { ready: true };
}

/** Cap large request/response bodies on a detail read so a single entry can't blow the agent's context. */
function sanitizeEventDetail(
  event: ParsedNetworkEvent | null,
  opts: { includeFullBody: boolean; maxBodyChars: number }
): { event: ParsedNetworkEvent | null; warnings: string[] } {
  if (!event) return { event, warnings: [] };
  const warnings: string[] = [];
  const clone: ParsedNetworkEvent = { ...event };
  const trimSide = (side: 'httpRequest' | 'httpResponse'): void => {
    const msg = event[side];
    if (!msg) return;
    const next = { ...msg };
    if (!opts.includeFullBody && typeof next.body === 'string' && next.body.length > opts.maxBodyChars) {
      next.body = next.body.slice(0, opts.maxBodyChars);
      next.bodyTruncated = true;
      warnings.push(
        `${side} body truncated to ${opts.maxBodyChars} chars. Pass includeFullBody=true (or a larger maxBodyChars) to read the rest.`
      );
    }
    clone[side] = next;
  };
  trimSide('httpRequest');
  trimSide('httpResponse');
  return { event: clone, warnings };
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  // Origin/Host check runs before the bearer check so a DNS-rebinding
  // attempt is rejected without the attacker getting a 401-vs-403 oracle
  // that confirms the bearer token is set.
  if (!isLoopbackRequest(req)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }
  const url = req.url || '';
  const method = req.method || 'GET';
  // Strip query string for routing.
  const pathname = url.split('?')[0];

  // Rate-limit live op endpoints. The map of pathname → bucket lives in
  // `mcp-rate-limit.ts`; read-state GETs and `/scan-devices` (own cooldown)
  // return null and bypass this check.
  const budget = rateBudgetForRequest(method, pathname, (id) => rokuApi.findOp(id));
  if (budget) {
    const decision = takeRateToken(budget.key, budget.capacity, budget.windowMs);
    if (!decision.allowed) {
      const retryAfterS = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
      try {
        res.setHeader('Retry-After', String(retryAfterS));
      } catch {
        /* headers may already be sent in pathological cases */
      }
      sendJson(res, 429, {
        error: `Rate limit exceeded for ${budget.key}. Retry in ${retryAfterS}s.`,
        retryAfterMs: decision.retryAfterMs
      });
      return;
    }
  }

  // Audit hook: every branch that handles a live op sets these fields
  // before sending the response; `res.on('finish')` writes the record.
  const requestStartedAt = Date.now();
  const audit: AuditDraft = {
    enabled: false,
    op: '',
    device: null,
    destructive: false,
    params: undefined
  };
  seedAuditFromPath(audit, method, pathname);
  res.on('finish', () => {
    if (!audit.enabled) return;
    const status = res.statusCode || 0;
    const ok = status >= 200 && status < 300;
    let error: string | undefined = audit.errorOverride;
    if (!ok && !error) error = `HTTP ${status}`;
    recordMcpAudit({
      ts: new Date().toISOString(),
      op: audit.op || pathname,
      device: audit.device,
      durationMs: Date.now() - requestStartedAt,
      status,
      ok,
      destructive: audit.destructive,
      error,
      paramsHash: audit.params != null ? hashParamsForAudit(audit.params) : undefined
    });
  });

  if (method === 'GET' && pathname === '/selected-device') {
    if (!state.selectedDevice) {
      sendJson(res, 404, { error: 'No device is currently selected in Dev Studio.' });
      return;
    }
    sendJson(res, 200, state.selectedDevice);
    return;
  }

  if (method === 'GET' && pathname === '/app-connector/functions') {
    // Trigger a fresh fetch through the renderer (same "borrow" pattern the
    // Action Scripts Builder uses). Optional `device` query param routes the
    // request to a specific device; omit to use the focused one.
    const qIdx = url.indexOf('?');
    const qs = qIdx >= 0 ? new URLSearchParams(url.slice(qIdx + 1)) : new URLSearchParams();
    audit.params = qs.get('device') ? { device: qs.get('device') } : {};
    const target = resolveTarget(qs.get('device') || undefined);
    audit.device = resolveIp(target);
    if (target && !isTargetConnected(target)) {
      const info = notConnectedError(target);
      sendJson(res, 409, { ...info });
      return;
    }
    const fetched = await runFunctionsFetch(target);
    if (fetched.ok && fetched.status) {
      // Return the live result directly. Do not mutate bridge state here —
      // state.appConnector is renderer-driven (McpBridgeReportState); a write
      // from a GET handler would create a second source of truth and could
      // overwrite fresher renderer-pushed data.
      sendJson(res, 200, {
        status: fetched.status,
        functions: fetched.functions || [],
        fetchedAt: new Date().toISOString()
      });
      return;
    }
    // Fetch failed — return cached if we have any, with a warning field.
    sendJson(res, 200, {
      ...state.appConnector,
      warning: fetched.error || 'Live fetch failed; returning last cached snapshot.',
      cached: true
    });
    return;
  }

  if (method === 'GET' && pathname === '/devices') {
    // Prefer the expanded "known" list when present; fall back to connected.
    const devices = state.knownDevices.length > 0 ? state.knownDevices : state.connectedDevices;
    sendJson(res, 200, {
      devices,
      connectedDevices: state.connectedDevices,
      observedAt: state.connectedDevicesObservedAt,
      selectedSerial: state.selectedDevice?.serial || null
    });
    return;
  }

  if (method === 'POST' && pathname === '/ecp-query') {
    let body: { endpoint?: unknown; device?: unknown };
    try {
      body = (await readJsonBody(req)) as { endpoint?: unknown; device?: unknown };
    } catch (e) {
      sendJson(res, 400, { error: e instanceof Error ? e.message : 'Invalid JSON body' });
      return;
    }
    audit.params = body;
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
    if (!endpoint) {
      sendJson(res, 400, { error: 'Missing required `endpoint`.' });
      return;
    }
    const target = resolveTarget(typeof body.device === 'string' ? body.device : undefined);
    let ip: string | null = null;
    if (target) {
      if (!isTargetConnected(target)) {
        sendJson(res, 409, notConnectedError(target));
        return;
      }
      // Find the connected entry with matching serial or ip to get its IP.
      const match = state.connectedDevices.find(
        (d) =>
          (target.targetSerial && d.serial === target.targetSerial) ||
          (target.targetIp && d.ip === target.targetIp)
      );
      ip = match?.ip || null;
    } else {
      ip = state.selectedDevice?.ip || null;
    }
    if (!ip) {
      sendJson(res, 409, {
        error:
          'No device specified and none is currently selected in Dev Studio. Pass `device` or open a device tab.'
      });
      return;
    }
    audit.device = ip;
    try {
      const result = await ecpQueryDirect(ip, endpoint);
      sendJson(res, 200, { ip, endpoint, result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      sendJson(res, 502, { error: `ECP query failed: ${msg}`, ip, endpoint });
    }
    return;
  }

  if (method === 'POST' && pathname === '/rale/get-node-by-id') {
    let body: { path?: unknown; id?: unknown; device?: unknown };
    try {
      body = (await readJsonBody(req)) as { path?: unknown; id?: unknown; device?: unknown };
    } catch (e) {
      sendJson(res, 400, { error: e instanceof Error ? e.message : 'Invalid JSON body' });
      return;
    }
    audit.params = body;
    const idStr = typeof body.id === 'string' ? body.id.trim() : '';
    if (!idStr) {
      sendJson(res, 400, { error: 'Missing required `id`.' });
      return;
    }
    const target = resolveTarget(typeof body.device === 'string' ? body.device : undefined);
    audit.device = resolveIp(target);
    if (target && !isTargetConnected(target)) {
      sendJson(res, 409, notConnectedError(target));
      return;
    }
    const args = { path: Array.isArray(body.path) ? body.path : [], id: idStr };
    const result = await runRaleCommand('getNodeById', args, target);
    if (result.ok) sendJson(res, 200, result.data);
    else sendJson(res, 502, { error: result.error || 'RALE command failed' });
    return;
  }

  // ============================================================
  // Main-direct device control endpoints. All accept an optional
  // `device` (IP or serial) in the body; fall back to focused device.
  // ============================================================

  if (method === 'POST' && pathname === '/keypress') {
    const body = await readJsonLoose(req);
    if (!send400IfJsonErr(res, body)) return;
    audit.params = body;
    const key = typeof body.key === 'string' ? body.key.trim() : '';
    if (!key) {
      sendJson(res, 400, { error: 'Missing required `key`.' });
      return;
    }
    const ctx = resolveIpForConnectedDevice(res, body);
    if (!ctx) return;
    const { ip } = ctx;
    audit.device = ip;
    try {
      const result = await rokuApi.keypress(ip, key);
      sendJson(res, 200, { ip, key, result });
    } catch (e) {
      sendJson(res, 502, { error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  if (method === 'POST' && pathname === '/launch') {
    const body = await readJsonLoose(req);
    if (!send400IfJsonErr(res, body)) return;
    audit.params = body;
    const appId = typeof body.appId === 'string' ? body.appId.trim() : '';
    if (!appId) return void sendJson(res, 400, { error: 'Missing required `appId`.' });
    const ctx = resolveIpForConnectedDevice(res, body, 'No device selected.');
    if (!ctx) return;
    const { ip } = ctx;
    audit.device = ip;
    const params =
      body.params && typeof body.params === 'object' && !Array.isArray(body.params)
        ? (body.params as Record<string, string>)
        : undefined;
    try {
      const result = await rokuApi.launch(ip, appId, params);
      notifyAgentAction({
        level: 'info',
        summary: `AI agent launched app "${appId}" on ${deviceLabel(ip)}`
      });
      sendJson(res, 200, { ip, appId, result });
    } catch (e) {
      sendJson(res, 502, { error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  if (method === 'POST' && pathname === '/input-text') {
    const body = await readJsonLoose(req);
    if (!send400IfJsonErr(res, body)) return;
    audit.params = body;
    const text = typeof body.text === 'string' ? body.text : '';
    if (!text) return void sendJson(res, 400, { error: 'Missing required `text`.' });
    const ctx = resolveIpForConnectedDevice(res, body, 'No device selected.');
    if (!ctx) return;
    const { ip } = ctx;
    audit.device = ip;
    try {
      const result = await rokuApi.inputText(ip, text);
      sendJson(res, 200, { ip, result });
    } catch (e) {
      sendJson(res, 502, { error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  if (method === 'POST' && pathname === '/deep-link') {
    const body = await readJsonLoose(req);
    if (!send400IfJsonErr(res, body)) return;
    audit.params = body;
    const appId = typeof body.appId === 'string' ? body.appId.trim() : '';
    if (!appId) return void sendJson(res, 400, { error: 'Missing required `appId`.' });
    const contentId = typeof body.contentId === 'string' ? body.contentId : undefined;
    const mediaType = typeof body.mediaType === 'string' ? body.mediaType : undefined;
    const ctx = resolveIpForConnectedDevice(res, body, 'No device selected.');
    if (!ctx) return;
    const { ip } = ctx;
    audit.device = ip;
    try {
      const result = await rokuApi.deeplink(ip, appId, contentId, mediaType);
      notifyAgentAction({
        level: 'info',
        summary: `AI agent deep-linked "${appId}" on ${deviceLabel(ip)}`
      });
      sendJson(res, 200, { ip, appId, contentId, mediaType, result });
    } catch (e) {
      sendJson(res, 502, { error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  if (method === 'POST' && pathname === '/ecp-post') {
    const body = await readJsonLoose(req);
    if (!send400IfJsonErr(res, body)) return;
    audit.params = body;
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
    if (!endpoint) return void sendJson(res, 400, { error: 'Missing required `endpoint`.' });
    const ctx = resolveIpForConnectedDevice(res, body, 'No device selected.');
    if (!ctx) return;
    const { ip } = ctx;
    audit.device = ip;
    try {
      const result = await rokuApi.post(ip, endpoint);
      notifyAgentAction({
        level: 'destructive',
        summary: `AI agent POSTed ${endpoint} to ${deviceLabel(ip)}`
      });
      sendJson(res, 200, { ip, endpoint, result });
    } catch (e) {
      sendJson(res, 502, { error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  if (method === 'POST' && pathname === '/test-connection') {
    const body = await readJsonLoose(req);
    if (!send400IfJsonErr(res, body)) return;
    audit.params = body;
    const ip = typeof body.ip === 'string' ? body.ip.trim() : '';
    if (!ip) return void sendJson(res, 400, { error: 'Missing required `ip`.' });
    audit.device = ip;
    try {
      const result = await rokuApi.testConnection(ip);
      sendJson(res, 200, { ip, result });
    } catch (e) {
      sendJson(res, 502, { error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  if (method === 'POST' && pathname === '/sideload') {
    const body = await readJsonLoose(req);
    if (!send400IfJsonErr(res, body)) return;
    audit.params = body;
    const filePath = typeof body.filePath === 'string' ? body.filePath.trim() : '';
    if (!filePath) return void sendJson(res, 400, { error: 'Missing required `filePath`.' });
    const ctx = resolveIpForConnectedDevice(res, body, 'No device selected.');
    if (!ctx) return;
    const { ip } = ctx;
    audit.device = ip;
    const params: Record<string, unknown> = {
      ip,
      filePath,
      password: typeof body.password === 'string' ? body.password : ''
    };
    await fillPasswordFromDevStudioIfNeeded('sideload', params);
    const password = typeof params.password === 'string' ? params.password.trim() : '';
    if (!password) {
      return void sendJson(res, 400, {
        error:
          'Missing `password` and no remembered Dev Password for this device. Save it in the device panel (Remember) or pass `password`.'
      });
    }
    try {
      const result = await rokuApi.sideloadChannel({ ip, filePath, password });
      notifyAgentAction({
        level: 'destructive',
        summary: `AI agent sideloaded "${filePath.split('/').pop()}" on ${deviceLabel(ip)}`
      });
      sendJson(res, result.success ? 200 : 502, { ip, filePath, ...result });
    } catch (e) {
      sendJson(res, 502, { error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  if (method === 'POST' && pathname === '/delete-sideload') {
    const body = await readJsonLoose(req);
    if (!send400IfJsonErr(res, body)) return;
    audit.params = body;
    const ctx = resolveIpForConnectedDevice(res, body, 'No device selected.');
    if (!ctx) return;
    const { ip } = ctx;
    audit.device = ip;
    const params: Record<string, unknown> = { ip, password: typeof body.password === 'string' ? body.password : '' };
    await fillPasswordFromDevStudioIfNeeded('delete_sideload', params);
    const password = typeof params.password === 'string' ? params.password.trim() : '';
    if (!password) {
      return void sendJson(res, 400, {
        error:
          'Missing `password` and no remembered Dev Password for this device. Save it in the device panel (Remember) or pass `password`.'
      });
    }
    try {
      const result = await rokuApi.deleteSideload({ ip, password });
      notifyAgentAction({
        level: 'destructive',
        summary: `AI agent removed the sideloaded channel on ${deviceLabel(ip)}`
      });
      sendJson(res, result.success ? 200 : 502, { ip, ...result });
    } catch (e) {
      sendJson(res, 502, { error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  if (method === 'POST' && pathname === '/screenshot') {
    const body = await readJsonLoose(req);
    if (!send400IfJsonErr(res, body)) return;
    audit.params = body;
    const ctx = resolveIpForConnectedDevice(res, body, 'No device selected.');
    if (!ctx) return;
    const { ip } = ctx;
    audit.device = ip;
    const params: Record<string, unknown> = { ip, password: typeof body.password === 'string' ? body.password : '' };
    await fillPasswordFromDevStudioIfNeeded('screenshot', params);
    const password = typeof params.password === 'string' ? params.password.trim() : '';
    if (!password) {
      return void sendJson(res, 400, {
        error:
          'Missing `password` and no remembered Dev Password for this device. Save it in the device panel (Remember) or pass `password`.'
      });
    }
    const waitAfterTriggerMs =
      typeof body.waitAfterTriggerMs === 'number' ? body.waitAfterTriggerMs : undefined;
    const returnImageBase64 = body.returnImageBase64 !== false;
    try {
      const result = await rokuApi.captureRokuScreenshot({ ip, password, waitAfterTriggerMs });
      const imageBuf =
        result && typeof result === 'object' && 'imageBuffer' in result && Buffer.isBuffer((result as { imageBuffer: Buffer }).imageBuffer)
          ? (result as { imageBuffer: Buffer }).imageBuffer
          : 'buffer' in (result as object) && Buffer.isBuffer((result as { buffer: Buffer }).buffer)
            ? (result as { buffer: Buffer }).buffer
            : null;
      const bufBytes = imageBuf ? imageBuf.length : 0;
      notifyAgentAction({
        level: 'info',
        summary: `AI agent captured a screenshot from ${deviceLabel(ip)}`
      });
      const payload: Record<string, unknown> = {
        ip,
        success: result.success,
        filename: result.filename || 'dev.jpg',
        bytes: bufBytes,
        imageMimeType: 'image/jpeg',
        error: result.error
      };
      if (returnImageBase64 && result.success && imageBuf) {
        payload.imageBase64 = imageBuf.toString('base64');
      }
      if (result.success && imageBuf) {
        // Mirror to the renderer's device-tab screenshot pane regardless of
        // whether the agent asked for base64 in the response.
        notifyAgentScreenshot({
          ip,
          dataUrl: `data:image/jpeg;base64,${imageBuf.toString('base64')}`,
          filename: (result.filename as string) || 'dev.jpg',
          bytes: bufBytes,
          mimeType: 'image/jpeg'
        });
      }
      sendJson(res, result.success ? 200 : 502, payload);
    } catch (e) {
      sendJson(res, 502, { error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  if (method === 'POST' && pathname === '/scan-devices') {
    const now = Date.now();
    const msSinceLast = now - lastScanDevicesAt;
    if (lastScanDevicesAt > 0 && msSinceLast < SCAN_DEVICES_COOLDOWN_MS) {
      sendJson(res, 429, {
        error: `scan_devices is rate-limited. Wait ${Math.ceil((SCAN_DEVICES_COOLDOWN_MS - msSinceLast) / 1000)}s before retrying.`,
        retryAfterMs: SCAN_DEVICES_COOLDOWN_MS - msSinceLast
      });
      return;
    }
    lastScanDevicesAt = now;
    const body = (await readJsonBody(req).catch(() => ({}))) as {
      includeSubnetScan?: unknown;
      timeoutMs?: unknown;
    };
    audit.params = body;
    const wantSubnet = !!body.includeSubnetScan;
    const timeoutMs = typeof body.timeoutMs === 'number' ? body.timeoutMs : 4000;
    try {
      const ssdp = await rokuApi.ssdpDiscover({ timeoutMs });
      const subnet = wantSubnet ? await rokuApi.subnetScan({ timeoutMs }) : [];
      sendJson(res, 200, { ssdp, subnet });
    } catch (e) {
      sendJson(res, 502, { error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  if (method === 'POST' && pathname === '/get-app-icon') {
    const body = await readJsonLoose(req);
    if (!send400IfJsonErr(res, body)) return;
    audit.params = body;
    const appId = typeof body.appId === 'string' ? body.appId.trim() : '';
    if (!appId) return void sendJson(res, 400, { error: 'Missing required `appId`.' });
    const ctx = resolveIpForConnectedDevice(res, body, 'No device selected.');
    if (!ctx) return;
    const { ip } = ctx;
    audit.device = ip;
    try {
      const result = await rokuApi.getIcon(ip, appId);
      sendJson(res, 200, { ip, appId, result });
    } catch (e) {
      sendJson(res, 502, { error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  // ============================================================
  // Renderer-routed generic tools (RALE writes, telnet, App Connector).
  // ============================================================

  // ============================================================
  // Generic op-descriptor endpoint. Single handler for every main-direct
  // op; transports (MCP tools, future remote server) POST here with the
  // op id as the path segment and the op's params in the body. Replaces
  // the per-op routes (/keypress, /launch, ...) which are kept as
  // back-compat aliases above.
  // ============================================================

  if (method === 'POST' && pathname.startsWith('/op/')) {
    const opId = pathname.slice('/op/'.length);
    const op = rokuApi.findOp(opId);
    if (!op) {
      sendJson(res, 404, { error: `Unknown op "${opId}". Call list_devices / tools/list for available ops.` });
      return;
    }
    if (op.runIn !== 'main') {
      sendJson(res, 400, {
        error: `Op "${opId}" runs only in the Electron renderer. Use POST /tool for renderer-routed ops.`
      });
      return;
    }
    const body = await readJsonLoose(req);
    if (!send400IfJsonErr(res, body)) return;
    audit.params = body;
    // Resolve `device` (agent-friendly) into `ip` that the op expects.
    // Connected-only for ops that will actually communicate with a device;
    // scan-style ops (no device param) pass through unchanged.
    const params: Record<string, unknown> = { ...body };
    if (typeof params.device === 'string' && !params.ip) {
      const target = resolveTarget(params.device);
      if (target && !isTargetConnected(target)) {
        sendJson(res, 409, notConnectedError(target));
        return;
      }
      const ip = resolveIp(target);
      if (ip) params.ip = ip;
      delete params.device;
    }
    // For ops that need an ip and none was resolved, fall back to the
    // focused device. `test_connection` ships its own ip, so this only
    // kicks in when the op declared ip in its schema but the caller left
    // it out.
    const schema = op.inputSchema as { required?: string[] };
    if (Array.isArray(schema.required) && schema.required.includes('ip') && !params.ip) {
      const fallbackIp = state.selectedDevice?.ip;
      if (!fallbackIp) {
        sendJson(res, 409, {
          error:
            'Op requires `ip` but none provided and no device is currently focused in Dev Studio. Pass `device` or open a device tab.'
        });
        return;
      }
      params.ip = fallbackIp;
    }
    if (typeof params.ip === 'string') audit.device = params.ip;
    await fillPasswordFromDevStudioIfNeeded(opId, params);
    /**
     * For the screenshot op specifically, force the underlying API call to
     * always produce the base64 image so we can mirror it to the renderer's
     * device-tab screenshot pane — regardless of whether the agent passed
     * `returnImageBase64: false`. We still honor the agent's flag for the
     * MCP response (strip the bytes from the body before replying when the
     * agent opted out).
     */
    const isScreenshot = opId === 'screenshot';
    const agentWantsImage = isScreenshot ? params.returnImageBase64 !== false : true;
    if (isScreenshot) params.returnImageBase64 = true;
    const result = await rokuApi.runOpForHttp(op, params);
    if (
      isScreenshot &&
      result.status >= 200 &&
      result.status < 300 &&
      result.body &&
      typeof result.body === 'object'
    ) {
      const body = result.body as Record<string, unknown>;
      const base64 = typeof body.imageBase64 === 'string' ? (body.imageBase64 as string) : '';
      const ip = typeof params.ip === 'string' ? (params.ip as string) : '';
      if (base64 && ip) {
        const mimeType = typeof body.imageMimeType === 'string' ? (body.imageMimeType as string) : 'image/jpeg';
        const filename = typeof body.filename === 'string' ? (body.filename as string) : 'dev.jpg';
        const bytes = typeof body.bytes === 'number' ? (body.bytes as number) : 0;
        notifyAgentScreenshot({
          ip,
          dataUrl: `data:${mimeType};base64,${base64}`,
          filename,
          bytes,
          mimeType
        });
      }
      if (!agentWantsImage) {
        // Agent asked for metadata only; remove the base64 we forced on for
        // the renderer push so the MCP response stays small.
        delete body.imageBase64;
      }
    }
    if (result.status >= 200 && result.status < 300 && op.destructive) {
      notifyAgentAction({
        level: 'destructive',
        summary: `AI agent ran ${op.title} on ${deviceLabel((params.ip as string) || null)}`
      });
    } else if (result.status >= 200 && result.status < 300 && !op.destructive) {
      // Silent for read-only; no toast.
    }
    sendJson(res, result.status, result.body);
    return;
  }

  if (method === 'POST' && pathname === '/tool') {
    const body = await readJsonLoose(req);
    if (!send400IfJsonErr(res, body)) return;
    audit.params = body;
    const tool = typeof body.tool === 'string' ? body.tool.trim() : '';
    if (!tool) return void sendJson(res, 400, { error: 'Missing required `tool`.' });
    audit.op = `tool:${tool}`;
    const renderOp = rokuApi.findOp(tool);
    if (renderOp) audit.destructive = renderOp.destructive;
    const target = resolveTarget(typeof body.device === 'string' ? body.device : undefined);
    audit.device = resolveIp(target);
    if (target && !isTargetConnected(target)) {
      sendJson(res, 409, notConnectedError(target));
      return;
    }
    const result = await runRendererTool(tool, body.args, target);
    if (result.ok) {
      // Renderer-routed tools are generally destructive (rale writes, telnet
      // send, app connector control). Toast them after success.
      notifyAgentAction({
        level: 'destructive',
        summary: `AI agent ran "${tool}" on ${deviceLabel(resolveIp(target))}`
      });
      sendJson(res, 200, result.data ?? {});
    } else {
      sendJson(res, 502, { error: result.error || 'Tool failed' });
    }
    return;
  }

  if (method === 'POST' && pathname === '/connect-device') {
    let body: { device?: unknown };
    try {
      body = (await readJsonBody(req)) as { device?: unknown };
    } catch (e) {
      sendJson(res, 400, { error: e instanceof Error ? e.message : 'Invalid JSON body' });
      return;
    }
    audit.params = body;
    const target = resolveTarget(typeof body.device === 'string' ? body.device : undefined);
    audit.device = target?.targetIp ?? null;
    if (!target) {
      sendJson(res, 400, {
        error: 'connect_device requires a `device` (IP or serial).'
      });
      return;
    }
    // Already connected → short-circuit as a no-op success.
    if (isTargetConnected(target)) {
      sendJson(res, 200, {
        already: true,
        device: { ip: target.targetIp || null, serial: target.targetSerial || null }
      });
      return;
    }
    const result = await runConnectDevice(target);
    if (result.ok) sendJson(res, 200, { already: false, device: result.device });
    else sendJson(res, 502, { error: result.error || 'Connect failed' });
    return;
  }

  if (method === 'POST' && pathname === '/builder/drop-script') {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      sendJson(res, 400, { error: e instanceof Error ? e.message : 'Invalid JSON body' });
      return;
    }
    // Don't store the full script in audit params (could be large + may
    // contain user-supplied prose); record only the device target + a
    // shape summary so the audit log says "drop-script for device X".
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const b = body as Record<string, unknown>;
      const stepsCount =
        b.script && typeof b.script === 'object' && Array.isArray((b.script as { steps?: unknown[] }).steps)
          ? (b.script as { steps: unknown[] }).steps.length
          : null;
      audit.params = {
        device: b.device,
        scriptStepsCount: stepsCount
      };
      const target = resolveTarget(typeof b.device === 'string' ? b.device : undefined);
      audit.device = resolveIp(target);
    }
    const result = await handleDropScript(body);
    if (result.ok) sendJson(res, 200, { delivered: true });
    else sendJson(res, 502, { error: result.error || 'Drop failed' });
    return;
  }

  // ============================================================
  // Network Inspector (read-only). Whole-hotspot capture lives in the main
  // process, so these are bespoke main-direct routes (not /op/<id>): the
  // op framework can't reach the Electron-main NetworkInspectorService
  // singleton. Every route is gated on the feature being enabled.
  // ============================================================

  if (method === 'GET' && pathname === '/network-inspector/status') {
    const svc = networkInspectorService();
    const status = svc.getStatus();
    const readiness = networkInspectorReadiness(svc);
    sendJson(res, 200, { status, ready: readiness.ready, notice: readiness.notice, remediation: readiness.remediation });
    return;
  }

  if (method === 'POST' && pathname === '/network-inspector/events') {
    const svc = networkInspectorGate(res);
    if (!svc) return;
    const body = await readJsonLoose(req);
    if (!send400IfJsonErr(res, body)) return;
    const deviceIp = resolveNetworkInspectorDeviceIp(body.device);
    const query: NetworkEventQuery = {
      deviceIp,
      host: typeof body.host === 'string' ? body.host : undefined,
      method: typeof body.method === 'string' ? body.method : undefined,
      type: typeof body.type === 'string' ? (body.type as NetworkEventQuery['type']) : undefined,
      errorsOnly: body.errorsOnly === true,
      mitmOnly: body.mitmOnly === true,
      limit: typeof body.limit === 'number' ? body.limit : undefined
    };
    const events = svc.queryEventSummaries(query);
    const readiness = networkInspectorReadiness(svc);
    const payload: Record<string, unknown> = { events, count: events.length, deviceIp: deviceIp ?? null };
    if (events.length === 0 && !readiness.ready) {
      payload.notice = readiness.notice;
      payload.remediation = readiness.remediation;
    }
    sendJson(res, 200, payload);
    return;
  }

  if (method === 'POST' && pathname === '/network-inspector/event-detail') {
    const svc = networkInspectorGate(res);
    if (!svc) return;
    const body = await readJsonLoose(req);
    if (!send400IfJsonErr(res, body)) return;
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) return void sendJson(res, 400, { error: 'Missing required `id` (from network_inspector_list_events).' });
    const includeFullBody = body.includeFullBody === true;
    const maxBodyChars =
      typeof body.maxBodyChars === 'number' && body.maxBodyChars > 0 ? Math.floor(body.maxBodyChars) : 4096;
    const detail = await svc.getEventDetail(id);
    if (!detail) {
      sendJson(res, 404, {
        error: `No stored detail for event "${id}". It may be a DNS/TLS event (no body), or it was evicted from the buffer. Re-list events and use a current id.`
      });
      return;
    }
    const { event, warnings } = sanitizeEventDetail(detail, { includeFullBody, maxBodyChars });
    sendJson(res, 200, { event, warnings });
    return;
  }

  if (method === 'POST' && pathname === '/network-inspector/analyze') {
    const svc = networkInspectorGate(res);
    if (!svc) return;
    const body = await readJsonLoose(req);
    if (!send400IfJsonErr(res, body)) return;
    const deviceIp = resolveNetworkInspectorDeviceIp(body.device);
    const analysis = svc.analyzeEvents({
      deviceIp,
      host: typeof body.host === 'string' ? body.host : undefined,
      method: typeof body.method === 'string' ? body.method : undefined,
      type: typeof body.type === 'string' ? (body.type as NetworkEventQuery['type']) : undefined,
      errorsOnly: body.errorsOnly === true,
      mitmOnly: body.mitmOnly === true
    });
    const readiness = networkInspectorReadiness(svc);
    const payload: Record<string, unknown> = { analysis, deviceIp: deviceIp ?? null };
    if (analysis.totalMatched === 0 && !readiness.ready) {
      payload.notice = readiness.notice;
      payload.remediation = readiness.remediation;
    }
    sendJson(res, 200, payload);
    return;
  }

  if (method === 'GET' && pathname === '/network-inspector/ca-info') {
    const svc = networkInspectorService();
    const status = svc.getStatus();
    sendJson(res, 200, {
      caInfo: svc.getCaInfo(),
      mitmEnabled: status.mitmEnabled === true,
      mitmActive: status.mitmActive === true,
      mitmListenAddress: status.mitmListenAddress
    });
    return;
  }

  if (method === 'GET' && pathname === '/health') {
    sendJson(res, 200, { ok: true, pid: process.pid });
    return;
  }

  sendJson(res, 404, { error: `Unknown bridge endpoint: ${method} ${pathname}` });
}

/**
 * Sanitize the renderer-supplied state push: copy only known fields.
 */
function sanitizeOneDevice(d: Record<string, unknown>): DeviceSnapshot {
  const sourceRaw = typeof d.source === 'string' ? d.source : 'unknown';
  const source: DeviceSnapshot['source'] =
    sourceRaw === 'local' || sourceRaw === 'remote' ? sourceRaw : 'unknown';
  return {
    ip: typeof d.ip === 'string' ? d.ip : null,
    serial: typeof d.serial === 'string' ? d.serial : null,
    modelName: typeof d.modelName === 'string' ? d.modelName : null,
    modelNumber: typeof d.modelNumber === 'string' ? d.modelNumber : null,
    friendlyDeviceName: typeof d.friendlyDeviceName === 'string' ? d.friendlyDeviceName : null,
    softwareVersion: typeof d.softwareVersion === 'string' ? d.softwareVersion : null,
    source,
    remoteLocationId: typeof d.remoteLocationId === 'string' ? d.remoteLocationId : null,
    isFocused: !!d.isFocused,
    isConnected: d.isConnected == null ? undefined : !!d.isConnected
  };
}

function sanitizeStatePush(raw: unknown): Partial<BridgeState> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Partial<BridgeState> = {};
  const o = raw as Record<string, unknown>;

  if (o.selectedDevice != null && typeof o.selectedDevice === 'object' && !Array.isArray(o.selectedDevice)) {
    const d = o.selectedDevice as Record<string, unknown>;
    out.selectedDevice = {
      ...sanitizeOneDevice(d),
      observedAt: new Date().toISOString()
    };
  } else if (o.selectedDevice === null) {
    out.selectedDevice = null;
  }

  if (Array.isArray(o.connectedDevices)) {
    out.connectedDevices = o.connectedDevices
      .filter((d): d is Record<string, unknown> => d != null && typeof d === 'object' && !Array.isArray(d))
      .map((d) => ({ ...sanitizeOneDevice(d), isConnected: true }));
    out.connectedDevicesObservedAt = new Date().toISOString();
  }

  if (Array.isArray(o.knownDevices)) {
    out.knownDevices = o.knownDevices
      .filter((d): d is Record<string, unknown> => d != null && typeof d === 'object' && !Array.isArray(d))
      .map(sanitizeOneDevice);
  }

  if (o.appConnector != null && typeof o.appConnector === 'object' && !Array.isArray(o.appConnector)) {
    const a = o.appConnector as Record<string, unknown>;
    const status = typeof a.status === 'string' ? a.status : 'unknown';
    const allowed = ['connected', 'available-not-connected', 'not-applicable', 'unknown'];
    out.appConnector = {
      status: (allowed.includes(status) ? status : 'unknown') as AppConnectorState['status'],
      functions: Array.isArray(a.functions)
        ? a.functions
            .filter((f): f is Record<string, unknown> => f != null && typeof f === 'object' && !Array.isArray(f))
            .map((f) => ({
              name: typeof f.name === 'string' ? f.name : '',
              params: Array.isArray(f.params)
                ? f.params
                    .filter(
                      (p): p is Record<string, unknown> => p != null && typeof p === 'object' && !Array.isArray(p)
                    )
                    .map((p) => ({
                      name: typeof p.name === 'string' ? p.name : '',
                      type: typeof p.type === 'string' ? p.type : undefined
                    }))
                : []
            }))
            .filter((f) => f.name !== '')
        : [],
      fetchedAt: typeof a.fetchedAt === 'string' ? a.fetchedAt : new Date().toISOString()
    };
  }

  return out;
}

/**
 * Public entry point. Call once on app ready.
 */
export type BridgeDeps = {
  app: App;
  ipcMain: IpcMain;
  /**
   * Returns the WebContents to send "drop script" requests to. Caller is
   * responsible for picking the active main window.
   */
  getActiveWebContents: () => WebContents | null;
};

export function startMcpBridge(deps: BridgeDeps): void {
  if (server) return;
  const { app, ipcMain } = deps;
  getRendererSender = deps.getActiveWebContents;
  bridgeToken = generateToken();
  setMcpAuditLogDir(app.getPath('userData'));

  server = http.createServer((req, res) => {
    handleRequest(req, res).catch((e) => {
      logWarn('request handler threw', e);
      try {
        sendJson(res, 500, { error: e instanceof Error ? e.message : 'Internal error' });
      } catch {
        /* ignore */
      }
    });
  });

  server.listen(0, '127.0.0.1', () => {
    const addr = server!.address();
    if (addr && typeof addr !== 'string') {
      bridgePort = addr.port;
      writeDescriptor(app.getPath('userData'));
      // Defense-in-depth: an external delete or a partial-quit sequence
      // (the `before-quit` → `stopMcpBridge` → window-close-prevented
      // path documented in `.discussion-docs/mcp-flows-test-report.md`)
      // can leave the bridge alive while the descriptor file disappears.
      // Re-write it any time it goes missing while the server is still
      // listening — the MCP server polls for the file every few seconds,
      // so a single rewrite restores the connection.
      if (descriptorRecheckInterval == null) {
        descriptorRecheckInterval = setInterval(() => {
          if (!server) return;
          rewriteDescriptorIfMissing();
        }, 2000);
        // Don't keep the event loop alive just for this watcher; if the
        // process is otherwise idle and quitting, let it.
        if (typeof descriptorRecheckInterval.unref === 'function') {
          descriptorRecheckInterval.unref();
        }
      }
    }
  });

  server.on('error', (err) => {
    logWarn('server error', err);
  });

  ipcMain.on(IPC.McpBridgeReportState, (_event, payload: unknown) => {
    const sanitized = sanitizeStatePush(payload);
    if (sanitized.selectedDevice !== undefined) state.selectedDevice = sanitized.selectedDevice;
    if (sanitized.appConnector !== undefined) state.appConnector = sanitized.appConnector;
    if (sanitized.connectedDevices !== undefined) state.connectedDevices = sanitized.connectedDevices;
    if (sanitized.knownDevices !== undefined) state.knownDevices = sanitized.knownDevices;
    if (sanitized.connectedDevicesObservedAt !== undefined) {
      state.connectedDevicesObservedAt = sanitized.connectedDevicesObservedAt;
    }
  });

  ipcMain.on(IPC.McpBridgeDropScriptResult, (_event, payload: { correlationId?: string; ok?: boolean; error?: string }) => {
    completeCorrelation(pendingDrops, payload?.correlationId, {
      ok: !!payload?.ok,
      error: payload?.error
    });
  });

  ipcMain.on(
    IPC.McpBridgeRaleResult,
    (_event, payload: { correlationId?: string; ok?: boolean; data?: unknown; error?: string }) => {
      completeCorrelation(pendingRale, payload?.correlationId, {
        ok: !!payload?.ok,
        data: payload?.data,
        error: payload?.error
      });
    }
  );

  ipcMain.on(
    IPC.McpBridgeFunctionsResult,
    (
      _event,
      payload: {
        correlationId?: string;
        ok?: boolean;
        status?: AppConnectorState['status'];
        functions?: AppConnectorState['functions'];
        error?: string;
      }
    ) => {
      completeCorrelation(pendingFunctions, payload?.correlationId, {
        ok: !!payload?.ok,
        status: payload?.status,
        functions: payload?.functions,
        error: payload?.error
      });
    }
  );

  ipcMain.on(
    IPC.McpBridgeToolResult,
    (_event, payload: { correlationId?: string; ok?: boolean; data?: unknown; error?: string }) => {
      completeCorrelation(pendingTool, payload?.correlationId, {
        ok: !!payload?.ok,
        data: payload?.data,
        error: payload?.error
      });
    }
  );

  ipcMain.on(
    IPC.McpBridgeConnectResult,
    (
      _event,
      payload: {
        correlationId?: string;
        ok?: boolean;
        device?: { ip?: string | null; serial?: string | null };
        error?: string;
      }
    ) => {
      completeCorrelation(pendingConnect, payload?.correlationId, {
        ok: !!payload?.ok,
        device: payload?.device
          ? {
              ip: payload.device.ip == null ? null : payload.device.ip,
              serial: payload.device.serial == null ? null : payload.device.serial
            }
          : undefined,
        error: payload?.error
      });
    }
  );

  ipcMain.on(
    IPC.McpBridgeStoredPasswordResult,
    (_event, payload: { correlationId?: string; password?: string }) => {
      const pw =
        typeof payload?.password === 'string' && payload.password.trim() ? payload.password.trim() : null;
      completeCorrelation(pendingStoredPassword, payload?.correlationId, pw);
    }
  );

  // Tear down on `will-quit`, **not** `before-quit`. `before-quit` fires
  // earlier in the quit sequence and is preventable — Electron may still
  // cancel the quit if a window's `close` handler calls
  // `event.preventDefault()` (we have one in `settings-dialog.ts` for the
  // settings window, plus various menu / app-update flows). When that
  // happens, `before-quit` already fired but the app stays alive — and
  // calling `stopMcpBridge` here deletes the descriptor file even though
  // the bridge keeps listening on its port. The MCP server then can't
  // discover it, and the agent reports "live: false" while the app is
  // still up. `will-quit` fires *after* all windows have actually closed,
  // i.e. the app is committed to terminating; safe to release resources
  // there. See `.discussion-docs/mcp-flows-test-report.md` Issue #3 for
  // the original observation.
  app.on('will-quit', () => {
    stopMcpBridge();
  });
}

/**
 * Tear down the MCP bridge. Production call site is the `will-quit` hook
 * above — **not** `before-quit`, which any window's `close` handler can
 * cancel (see `engineering-principles.md` §19 "Resource ownership: release
 * on commitment"). If you're adding a new caller and the app isn't about
 * to terminate, reconsider — `stopMcpBridge` releases the port, descriptor
 * file, token, and all pending bridge IPC, and the heal watcher exits with it.
 */
export function stopMcpBridge(): void {
  if (descriptorRecheckInterval) {
    try {
      clearInterval(descriptorRecheckInterval);
    } catch {
      /* ignore */
    }
    descriptorRecheckInterval = null;
  }
  if (server) {
    try {
      server.close();
    } catch {
      /* ignore */
    }
    server = null;
  }
  removeDescriptor();
  bridgePort = 0;
  bridgeToken = '';
  rejectAllPending(pendingDrops, { ok: false, error: 'Bridge shutting down' });
  rejectAllPending(pendingRale, { ok: false, error: 'Bridge shutting down' });
  rejectAllPending(pendingFunctions, { ok: false, error: 'Bridge shutting down' });
  rejectAllPending(pendingConnect, { ok: false, error: 'Bridge shutting down' });
  rejectAllPending(pendingTool, { ok: false, error: 'Bridge shutting down' });
  rejectAllPending(pendingStoredPassword, null);
  // Reset the renderer-driven snapshot so a hypothetical bridge restart
  // inside the same process (hot-reload, restart-on-error, future
  // tooling) starts from a clean slate. In the normal `before-quit` →
  // `stopMcpBridge` path the whole renderer is gone right after, so this
  // is belt-and-suspenders rather than load-bearing today.
  state.selectedDevice = null;
  state.connectedDevices = [];
  state.knownDevices = [];
  state.connectedDevicesObservedAt = null;
  state.appConnector = { status: 'unknown', functions: [] };
}

/**
 * Test/debug accessor — returns the descriptor path (only after start).
 */
export function getMcpBridgeDescriptorPath(): string {
  return descriptorPath;
}
