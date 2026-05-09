/**
 * Renderer-side glue between the Action Scripts UI and the main-process MCP
 * bridge.
 *
 * ## Routing model
 *
 * Each device panel registers its own drop / RALE / functions handlers keyed
 * by the device's **serial number** (or IP as a fallback). When the bridge
 * forwards an MCP tool call, it includes a `targetSerial` (and/or
 * `targetIp`). The renderer dispatcher picks the handler in this order:
 *
 *   1. Exact match on serial.
 *   2. Exact match on IP.
 *   3. The currently focused device's handler (back-compat when the agent
 *      doesn't specify a target).
 *   4. No handler → return a clear error so the agent can call `list_devices`
 *      or `connect_device` and retry.
 *
 * Handlers auto-clean when their registration's unregister fn is called (see
 * the return value of each `register*` function).
 */

import type {
  McpBridgeAppConnectorState,
  McpBridgeDeviceSnapshot
} from '../../shared/mcp-bridge-state.js';
import { getStoredPassword } from './utils/storage.js';

export type SelectedDeviceState = McpBridgeDeviceSnapshot;

export type AppConnectorState = McpBridgeAppConnectorState;

type McpBridgeApi = {
  reportState: (payload: unknown) => void;
  ackDrop: (payload: { correlationId: string; ok: boolean; error?: string }) => void;
  onDropScript: (
    callback: (payload: {
      correlationId: string;
      script: unknown;
      targetSerial?: string;
      targetIp?: string;
    }) => void
  ) => (() => void) | void;
  ackRale: (payload: {
    correlationId: string;
    ok: boolean;
    data?: unknown;
    error?: string;
  }) => void;
  onRaleRequest: (
    callback: (payload: {
      correlationId: string;
      command: string;
      args: unknown;
      targetSerial?: string;
      targetIp?: string;
    }) => void
  ) => (() => void) | void;
  ackFunctions: (payload: {
    correlationId: string;
    ok: boolean;
    status?: string;
    functions?: unknown[];
    error?: string;
  }) => void;
  onFunctionsRequest: (
    callback: (payload: {
      correlationId: string;
      targetSerial?: string;
      targetIp?: string;
    }) => void
  ) => (() => void) | void;
  ackConnect: (payload: {
    correlationId: string;
    ok: boolean;
    device?: unknown;
    error?: string;
  }) => void;
  onConnectRequest: (
    callback: (payload: {
      correlationId: string;
      targetSerial?: string;
      targetIp?: string;
    }) => void
  ) => (() => void) | void;
  ackTool: (payload: { correlationId: string; ok: boolean; data?: unknown; error?: string }) => void;
  onToolRequest: (
    callback: (payload: {
      correlationId: string;
      tool: string;
      args: unknown;
      targetSerial?: string;
      targetIp?: string;
    }) => void
  ) => (() => void) | void;
  onAgentAction: (
    callback: (payload: {
      level: 'info' | 'destructive';
      summary: string;
      details?: Record<string, unknown>;
    }) => void
  ) => (() => void) | void;
  onAgentScreenshot?: (
    callback: (payload: {
      ip: string;
      dataUrl: string;
      filename: string;
      bytes: number;
      mimeType: string;
    }) => void
  ) => (() => void) | void;
  ackStoredPassword: (payload: { correlationId: string; password?: string }) => void;
  onStoredPasswordRequest: (
    callback: (payload: { correlationId: string; serial: string }) => void
  ) => (() => void) | void;
};

declare global {
  interface Window {
    rdsMcpBridge?: McpBridgeApi;
  }
}

type DropResult = { ok: boolean; message?: string };
type DropHandler = (jsonScript: string) => Promise<DropResult>;

type RaleResult = { ok: boolean; data?: unknown; error?: string };
type RaleHandler = (req: { command: string; args: unknown }) => Promise<RaleResult>;

type FunctionsResult = {
  ok: boolean;
  status?: AppConnectorState['status'];
  functions?: AppConnectorState['functions'];
  error?: string;
};
type FunctionsHandler = () => Promise<FunctionsResult>;

type ConnectResult = {
  ok: boolean;
  device?: { ip: string | null; serial: string | null };
  error?: string;
};
/** Resolver for auto-connect: given a target ip or serial, open a device tab. */
type ConnectResolver = (target: { ip?: string; serial?: string }) => Promise<ConnectResult>;

/** Identity used to key handlers. At least one of (serial, ip) must be set. */
export type HandlerKey = { serial?: string | null; ip?: string | null };

type HandlerEntry<T> = {
  serial: string | null;
  ip: string | null;
  handler: T;
};

const dropHandlers: HandlerEntry<DropHandler>[] = [];
const raleHandlers: HandlerEntry<RaleHandler>[] = [];
const functionsHandlers: HandlerEntry<FunctionsHandler>[] = [];
let connectResolver: ConnectResolver | null = null;

/** Focus tracking so "no explicit target" falls back to the focused device. */
let focusedSerial: string | null = null;
let focusedIp: string | null = null;

let dropListenerInstalled = false;
let raleListenerInstalled = false;
let functionsListenerInstalled = false;
let connectListenerInstalled = false;
let toolListenerInstalled = false;
let storedPasswordListenerInstalled = false;

/**
 * Generic renderer-tool handler — RALE writes (full surface), App Connector
 * connect/disconnect, telnet send. Registered per (tool name, device key).
 */
type ToolHandler = (args: unknown) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
const toolHandlers: Map<string, HandlerEntry<ToolHandler>[]> = new Map();

function getApi(): McpBridgeApi | null {
  if (typeof window === 'undefined') return null;
  return window.rdsMcpBridge || null;
}

/**
 * Lets the MCP bridge read the per-serial dev password the user saved in the
 * device panel (same localStorage as Remember). Call once at app boot.
 */
export function ensureMcpStoredPasswordBridge(): void {
  if (storedPasswordListenerInstalled) return;
  const api = getApi();
  if (!api || typeof api.onStoredPasswordRequest !== 'function' || typeof api.ackStoredPassword !== 'function') {
    return;
  }
  api.onStoredPasswordRequest((payload) => {
    const correlationId = payload?.correlationId;
    if (typeof correlationId !== 'string') return;
    const serial = typeof payload.serial === 'string' ? payload.serial : '';
    let password = '';
    try {
      password = serial ? getStoredPassword(serial) : '';
    } catch {
      password = '';
    }
    const trimmed = password.trim();
    api.ackStoredPassword({
      correlationId,
      ...(trimmed ? { password: trimmed } : {})
    });
  });
  storedPasswordListenerInstalled = true;
}

function upsertEntry<T>(
  list: HandlerEntry<T>[],
  key: HandlerKey,
  handler: T
): HandlerEntry<T> {
  const serial = key.serial || null;
  const ip = key.ip || null;
  // Replace any existing entry with the same serial/ip.
  for (let i = 0; i < list.length; i++) {
    if (
      (serial && list[i].serial === serial) ||
      (!serial && ip && list[i].ip === ip && !list[i].serial)
    ) {
      list[i] = { serial, ip, handler };
      return list[i];
    }
  }
  const entry = { serial, ip, handler };
  list.push(entry);
  return entry;
}

function removeEntry<T>(list: HandlerEntry<T>[], entry: HandlerEntry<T>): void {
  const i = list.indexOf(entry);
  if (i >= 0) list.splice(i, 1);
}

function pickHandler<T>(
  list: HandlerEntry<T>[],
  target: { targetSerial?: string; targetIp?: string } | undefined
): T | null {
  const ts = target?.targetSerial || null;
  const ti = target?.targetIp || null;

  if (ts) {
    const hit = list.find((e) => e.serial === ts);
    if (hit) return hit.handler;
  }
  if (ti) {
    const hit = list.find((e) => e.ip === ti);
    if (hit) return hit.handler;
  }
  // No explicit target: fall back to focused device.
  if (!ts && !ti) {
    if (focusedSerial) {
      const hit = list.find((e) => e.serial === focusedSerial);
      if (hit) return hit.handler;
    }
    if (focusedIp) {
      const hit = list.find((e) => e.ip === focusedIp);
      if (hit) return hit.handler;
    }
    // Last resort: use the most-recently-registered handler. This preserves
    // the old behaviour when nothing has claimed focus yet.
    if (list.length > 0) return list[list.length - 1].handler;
  }
  return null;
}

function explainMiss(target: { targetSerial?: string; targetIp?: string } | undefined): string {
  if (target?.targetSerial) {
    return `No handler registered for device with serial "${target.targetSerial}". The device may not be connected yet. Call \`list_devices\` to see available targets, then \`connect_device\` to open a tab.`;
  }
  if (target?.targetIp) {
    return `No handler registered for device with IP "${target.targetIp}". The device may not be connected yet. Call \`list_devices\` to see available targets, then \`connect_device\` to open a tab.`;
  }
  return 'No active device tab. Connect a device via the sidebar, or call `list_devices` + `connect_device` from the agent.';
}

/**
 * Report which device the user has focused in the UI. Called by app.ts on
 * tab activation. Drives fallback routing when the agent omits a `device`.
 */
export function setFocusedDevice(key: HandlerKey | null): void {
  focusedSerial = key?.serial || null;
  focusedIp = key?.ip || null;
}

/**
 * Push a state delta to main. Main merges; pass only changed keys.
 */
export function pushMcpBridgeState(payload: {
  selectedDevice?: SelectedDeviceState | null;
  appConnector?: AppConnectorState;
  /** Devices with an open tab. */
  connectedDevices?: SelectedDeviceState[];
  /** All known devices (connected + discovered on LAN + remembered). */
  knownDevices?: SelectedDeviceState[];
}): void {
  const api = getApi();
  if (!api) return;
  try {
    api.reportState(payload);
    ensureMcpStoredPasswordBridge();
  } catch (e) {
    console.warn('[mcp-bridge] reportState failed', e);
  }
}

// ============================================================
// Drop-script handler registry
// ============================================================

export function registerMcpBuilderDropHandler(key: HandlerKey, handler: DropHandler): () => void {
  const entry = upsertEntry(dropHandlers, key, handler);
  ensureDropListener();
  return () => removeEntry(dropHandlers, entry);
}

function ensureDropListener(): void {
  if (dropListenerInstalled) return;
  const api = getApi();
  if (!api) return;
  api.onDropScript(async (payload) => {
    const correlationId = payload?.correlationId;
    if (typeof correlationId !== 'string') return;
    try {
      const handler = pickHandler(dropHandlers, payload);
      if (!handler) {
        api.ackDrop({ correlationId, ok: false, error: explainMiss(payload) });
        return;
      }
      const json = typeof payload.script === 'string' ? payload.script : JSON.stringify(payload.script);
      const result = await handler(json);
      api.ackDrop({
        correlationId,
        ok: result.ok,
        error: result.ok ? undefined : result.message || 'Drop failed'
      });
    } catch (e) {
      api.ackDrop({ correlationId, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
  dropListenerInstalled = true;
}

// ============================================================
// RALE handler registry
// ============================================================

export function registerMcpRaleHandler(key: HandlerKey, handler: RaleHandler): () => void {
  const entry = upsertEntry(raleHandlers, key, handler);
  ensureRaleListener();
  return () => removeEntry(raleHandlers, entry);
}

function ensureRaleListener(): void {
  if (raleListenerInstalled) return;
  const api = getApi();
  if (!api) return;
  api.onRaleRequest(async (payload) => {
    const correlationId = payload?.correlationId;
    if (typeof correlationId !== 'string') return;
    try {
      const handler = pickHandler(raleHandlers, payload);
      if (!handler) {
        api.ackRale({ correlationId, ok: false, error: explainMiss(payload) });
        return;
      }
      const result = await handler({
        command: typeof payload.command === 'string' ? payload.command : '',
        args: payload.args
      });
      api.ackRale({
        correlationId,
        ok: result.ok,
        data: result.data,
        error: result.ok ? undefined : result.error || 'RALE command failed'
      });
    } catch (e) {
      api.ackRale({ correlationId, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
  raleListenerInstalled = true;
}

// ============================================================
// Functions handler registry
// ============================================================

export function registerMcpFunctionsHandler(
  key: HandlerKey,
  handler: FunctionsHandler
): () => void {
  const entry = upsertEntry(functionsHandlers, key, handler);
  ensureFunctionsListener();
  return () => removeEntry(functionsHandlers, entry);
}

function ensureFunctionsListener(): void {
  if (functionsListenerInstalled) return;
  const api = getApi();
  if (!api) return;
  api.onFunctionsRequest(async (payload) => {
    const correlationId = payload?.correlationId;
    if (typeof correlationId !== 'string') return;
    try {
      const handler = pickHandler(functionsHandlers, payload);
      if (!handler) {
        api.ackFunctions({
          correlationId,
          ok: true,
          status: 'unknown',
          functions: [],
          error: explainMiss(payload)
        });
        return;
      }
      const result = await handler();
      api.ackFunctions({
        correlationId,
        ok: result.ok,
        status: result.status,
        functions: result.functions,
        error: result.ok ? undefined : result.error || 'Functions fetch failed'
      });
    } catch (e) {
      api.ackFunctions({ correlationId, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
  functionsListenerInstalled = true;
}

// ============================================================
// Connect-device resolver (singleton; owned by app.ts)
// ============================================================

/**
 * Register a resolver that opens a device tab given (serial or ip). Called
 * once from app.ts with access to `connectDeviceLocal` / remote variants.
 */
export function registerMcpConnectResolver(resolver: ConnectResolver): () => void {
  connectResolver = resolver;
  ensureConnectListener();
  return () => {
    if (connectResolver === resolver) connectResolver = null;
  };
}

function ensureConnectListener(): void {
  if (connectListenerInstalled) return;
  const api = getApi();
  if (!api) return;
  api.onConnectRequest(async (payload) => {
    const correlationId = payload?.correlationId;
    if (typeof correlationId !== 'string') return;
    try {
      if (!connectResolver) {
        api.ackConnect({
          correlationId,
          ok: false,
          error: 'Connect resolver not registered in renderer.'
        });
        return;
      }
      const target = { ip: payload.targetIp, serial: payload.targetSerial };
      const result = await connectResolver(target);
      api.ackConnect({
        correlationId,
        ok: result.ok,
        device: result.device,
        error: result.ok ? undefined : result.error || 'Connect failed'
      });
    } catch (e) {
      api.ackConnect({ correlationId, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
  connectListenerInstalled = true;
}

// ============================================================
// Generic renderer-tool dispatcher
// ============================================================

/**
 * Register a handler for one of the generic tool names (e.g. `rale_command`,
 * `telnet_send`, `app_connector_connect`). Tools with no device affinity can
 * register with `{}` as the key; per-device handlers use the device's
 * `{ serial, ip }`. Latest registration for the same (tool, key) wins.
 */
export function registerMcpTool(tool: string, key: HandlerKey, handler: ToolHandler): () => void {
  let list = toolHandlers.get(tool);
  if (!list) {
    list = [];
    toolHandlers.set(tool, list);
  }
  const entry = upsertEntry(list, key, handler);
  ensureToolListener();
  return () => {
    const l = toolHandlers.get(tool);
    if (!l) return;
    removeEntry(l, entry);
    if (l.length === 0) toolHandlers.delete(tool);
  };
}

function ensureToolListener(): void {
  if (toolListenerInstalled) return;
  const api = getApi();
  if (!api) return;
  api.onToolRequest(async (payload) => {
    const correlationId = payload?.correlationId;
    if (typeof correlationId !== 'string') return;
    try {
      const tool = typeof payload.tool === 'string' ? payload.tool : '';
      const list = toolHandlers.get(tool);
      if (!list || list.length === 0) {
        api.ackTool({
          correlationId,
          ok: false,
          error: `No handler registered for tool "${tool}". The device panel may be absent — try connect_device or pick a different target.`
        });
        return;
      }
      const handler = pickHandler(list, payload);
      if (!handler) {
        api.ackTool({ correlationId, ok: false, error: explainMiss(payload) });
        return;
      }
      const result = await handler(payload.args);
      api.ackTool({
        correlationId,
        ok: result.ok,
        data: result.data,
        error: result.ok ? undefined : result.error || `Tool "${tool}" failed`
      });
    } catch (e) {
      api.ackTool({ correlationId, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
  toolListenerInstalled = true;
}

/**
 * Subscribe to main's agent-action broadcasts. Called once at boot by the
 * toast listener. Returns an unsubscribe fn if callers want it.
 */
export function onMcpAgentAction(
  callback: (payload: {
    level: 'info' | 'destructive';
    summary: string;
    details?: Record<string, unknown>;
  }) => void
): (() => void) | void {
  const api = getApi();
  if (!api) return;
  return api.onAgentAction(callback) || undefined;
}

/**
 * DOM CustomEvent name dispatched on a `.device-panel[data-ip="<ip>"]` when
 * an agent-driven screenshot lands. The dev-app screenshot module listens
 * for this on its panel and updates the screenshot pane just like a local
 * Capture click.
 */
export const AGENT_SCREENSHOT_EVENT = 'mcp:agent-screenshot';

export type AgentScreenshotDetail = {
  ip: string;
  dataUrl: string;
  filename: string;
  bytes: number;
  mimeType: string;
};

let agentScreenshotListenerInstalled = false;

/**
 * Install a single global subscriber that fans agent screenshots out to the
 * matching device panel as a DOM CustomEvent. Idempotent — safe to call
 * during multiple boot paths.
 */
export function ensureMcpAgentScreenshotBridge(): void {
  if (agentScreenshotListenerInstalled) return;
  const api = getApi();
  if (!api || typeof api.onAgentScreenshot !== 'function') return;
  api.onAgentScreenshot((payload) => {
    if (!payload || typeof payload.ip !== 'string' || !payload.ip) return;
    if (typeof payload.dataUrl !== 'string' || !payload.dataUrl) return;
    const ipSel = payload.ip.replace(/"/g, '\\"');
    /**
     * Device tabs render as `.tab-panel[data-ip="<ip>"]`. Multiple elements
     * carry `data-ip` (the tab button, sidebar device cards), so we scope to
     * `.tab-panel` which is the panel root that hosts the screenshot pane.
     */
    const panel = document.querySelector(`.tab-panel[data-ip="${ipSel}"]`);
    if (!panel) return;
    panel.dispatchEvent(
      new CustomEvent<AgentScreenshotDetail>(AGENT_SCREENSHOT_EVENT, {
        detail: {
          ip: payload.ip,
          dataUrl: payload.dataUrl,
          filename: payload.filename || 'dev.jpg',
          bytes: typeof payload.bytes === 'number' ? payload.bytes : 0,
          mimeType: payload.mimeType || 'image/jpeg'
        }
      })
    );
  });
  agentScreenshotListenerInstalled = true;
}
