/**
 * IPC surface for the BrightScript socket-based debugger.
 *
 * Owns one {@link DebugSessionController} whose emitted events are forwarded to
 * the main window (the debugger UI lives in the device panel's Telnet Console
 * sidebar). Request/response handlers wrap each controller method and always
 * resolve to a `{ ok, ... }` envelope so the renderer never sees a rejected
 * invoke.
 *
 * Mirrors the `setupXxxHandlers(mainWindow, …)` convention used by
 * telnet-handlers.ts et al.; registered from ipc/index.ts.
 */
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import { DebugSessionController, DEBUGGER_EVENTS, type DebuggerEventKind } from 'roku-dev-studio-api/lib/debugger/debug-session-controller';
import { getScannedStops } from 'roku-dev-studio-api/lib/debugger/scan-stops';
import { createRceDebugSocketFactory } from 'roku-dev-studio-rce';
import { resolveRceDeviceBySerial, resolveRceInstanceBySerial } from '../rce-device-registry';
import { mainError } from '../log.js';
import { broadcastToPortTerminals, hasPortTerminalWindows } from '../port-terminal-broadcast';

/** Maps the controller's transport-agnostic event kinds onto this app's concrete IPC channels. */
const EVENT_TO_IPC_CHANNEL: Record<DebuggerEventKind, string> = {
  [DEBUGGER_EVENTS.State]: IPC.DebuggerState,
  [DEBUGGER_EVENTS.Stopped]: IPC.DebuggerStopped,
  [DEBUGGER_EVENTS.Output]: IPC.DebuggerOutput,
  [DEBUGGER_EVENTS.RuntimeError]: IPC.DebuggerRuntimeError,
  [DEBUGGER_EVENTS.ExceptionBreakpointError]: IPC.DebuggerExceptionBreakpointError,
  [DEBUGGER_EVENTS.CompileErrors]: IPC.DebuggerCompileErrors,
  [DEBUGGER_EVENTS.Breakpoints]: IPC.DebuggerBreakpoints,
  [DEBUGGER_EVENTS.Wire]: IPC.DebuggerWire
};

interface IpPayload { ip?: string }
interface StepPayload { ip?: string; threadIndex?: number }
interface VariablesPayload { ip?: string; threadIndex?: number; stackFrameIndex?: number; variablePath?: string[] }
interface ExecutePayload { ip?: string; sourceCode?: string; threadIndex?: number; stackFrameIndex?: number }
interface BreakpointsPayload { ip?: string; breakpoints?: unknown }
interface RemoveByLocationPayload { ip?: string; locations?: Array<{ filePath: string; lineNumber: number }> }

type Result = { ok: true; data?: unknown } | { ok: false; error: string };

function reqIp(payload: { ip?: string }): string {
  const ip = (payload?.ip || '').trim();
  if (!ip) throw new Error('A device IP is required.');
  return ip;
}

/** Main window, captured at setup — debug events are mirrored here so the device
 *  panel's Telnet Console debug sidebar updates alongside the standalone window. */
let mainWindowRef: BrowserWindow | undefined;

/** Send a debug event to the main window (the Telnet Console sidebar lives there). */
function broadcastDebugEvent(channel: string, payload: unknown): void {
  // Per-frame control-port traffic is only for the Ports window's read-only 8081 tab — the main
  // window has no listener for it, so don't push a message per frame through its IPC.
  if (channel === IPC.DebuggerWire) {
    broadcastToPortTerminals(channel, payload);
    return;
  }
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, payload);
  }
  // The Ports window's 8081 tab hosts the same debugger sidebar as the Console tab, driven by the
  // same events (each window filters by device).
  broadcastToPortTerminals(channel, payload);
  // While a debugger is attached, Roku routes the channel's print output to the debugger's IO port
  // instead of 8085 — the Fiddle terminal (fed from telnet chunks) went blank the moment its run
  // attached (a per-device "Enable Debugger" now does that for every Fiddle run). Fan the output
  // out to Fiddle windows as terminal data; local + RCE sessions use connectionId = ip, matching
  // what rce-handlers/telnet forwarding already send. Lazy require: fiddle-window → remote-handlers
  // → this module would otherwise be an import cycle.
  if (channel === IPC.DebuggerOutput) {
    const p = payload as { ip?: unknown; text?: unknown } | null;
    if (p && typeof p.ip === 'string' && typeof p.text === 'string') {
      (require('../fiddle-window') as typeof import('../fiddle-window')).broadcastFiddleTerminalData({ ip: p.ip, data: p.text, connectionId: p.ip });
    }
  }
}

/** Every field a `DebuggerReattach` broadcast can carry beyond `ip` — call sites used to
 *  hand-declare their own (incompatible) subset of this via a `require(...) as {...}` cast;
 *  `import type` this instead so a signature change here is caught at every call site. */
export interface DebuggerReattachExtra {
  discovered?: number;
  isRemote?: boolean;
  serverUrl?: string;
}

/**
 * Tell the windows a debug-enabled device was just (re)sideloaded so the Telnet
 * debug sidebar reattaches to the fresh run. Called from the normal sideload
 * handler and the Sideload Relay fan-out.
 */
export function notifyDebuggerReattach(ip: string, extra?: DebuggerReattachExtra): void {
  if (ip) broadcastDebugEvent(IPC.DebuggerReattach, { ip, ...(extra ?? {}) });
}

/** Lazily-created singleton shared by every debugger IPC handler. */
let controllerSingleton: DebugSessionController | null = null;
function getController(): DebugSessionController {
  if (!controllerSingleton) {
    controllerSingleton = new DebugSessionController(
      (event, payload) => {
        broadcastDebugEvent(EVENT_TO_IPC_CHANNEL[event], payload);
      },
      // The per-frame 8081 trace only feeds Ports windows — don't summarise frames while none is open.
      { wireEnabled: hasPortTerminalWindows }
    );
  }
  return controllerSingleton;
}

/**
 * The shared {@link DebugSessionController} singleton — also used by the MCP bridge
 * (`mcp-bridge.ts`) so agent debugger tools operate on the SAME sessions/sockets as the
 * Telnet debug sidebar (never a second controller with its own 8081 lease). Lazily created;
 * its emit no-ops until a main window is captured, so an early bridge call is safe.
 */
export function getDebugSessionController(): DebugSessionController {
  return getController();
}

/**
 * Tear down every live debug session — called on app quit so the single-client
 * 8081 control sockets (and their IO sockets) close cleanly instead of relying on
 * process exit. Best-effort / fire-and-forget; only touches the controller if one
 * was ever created (i.e. someone actually debugged this session).
 */
export function teardownDebuggerSessions(): void {
  if (controllerSingleton) void controllerSingleton.detachAll();
}

export function setupDebuggerHandlers(mainWindow: BrowserWindow | undefined): void {
  const { ipcMain } = require('electron') as typeof import('electron');
  mainWindowRef = mainWindow;
  const controller = getController();

  /** Wrap a controller call in the `{ ok }` envelope + uniform error logging. */
  const guard = <P>(label: string, fn: (payload: P) => Promise<unknown>) =>
    async (_event: IpcMainInvokeEvent, payload: P): Promise<Result> => {
      try {
        const data = await fn(payload);
        return { ok: true, data };
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        mainError(`[debugger] ${label} failed:`, error);
        return { ok: false, error };
      }
    };

  // Session lifecycle.
  ipcMain.handle(IPC.DebuggerAttach, async (_e: IpcMainInvokeEvent, payload: IpPayload): Promise<Result> => {
    const ip = reqIp(payload);
    // `ip` doubles as the device serial for an RCE device (see [[device-identity-key-rule]] /
    // rce-device-registry.ts) — resolved fresh here, same as telnet/sideload/Fiddle, since a
    // cached instanceApiUrl 404s outright across a restart rather than degrading like a stale IP.
    const rceKnown = resolveRceDeviceBySerial(ip);
    if (rceKnown) {
      const instance = await resolveRceInstanceBySerial(ip);
      if (!instance.success) return { ok: false, error: instance.error };
      const connectSocket = createRceDebugSocketFactory({ instanceApiUrl: instance.instance.instanceApiUrl, token: instance.instance.token });
      const res = await controller.attach(ip, { connectSocket });
      return res.ok ? { ok: true } : { ok: false, error: res.error || 'Attach failed.' };
    }
    const res = await controller.attach(ip);
    return res.ok ? { ok: true } : { ok: false, error: res.error || 'Attach failed.' };
  });
  ipcMain.handle(IPC.DebuggerDetach, guard('detach', async (p: IpPayload) => controller.detach(reqIp(p))));
  ipcMain.handle(IPC.DebuggerStatus, guard('status', async (p: IpPayload) => controller.status(reqIp(p))));

  // Execution control.
  ipcMain.handle(IPC.DebuggerContinue, guard('continue', async (p: IpPayload) => controller.continue(reqIp(p))));
  ipcMain.handle(IPC.DebuggerPause, guard('pause', async (p: IpPayload) => controller.pause(reqIp(p))));
  ipcMain.handle(IPC.DebuggerStepOver, guard('stepOver', async (p: StepPayload) => controller.stepOver(reqIp(p), p.threadIndex)));
  ipcMain.handle(IPC.DebuggerStepIn, guard('stepIn', async (p: StepPayload) => controller.stepIn(reqIp(p), p.threadIndex)));
  ipcMain.handle(IPC.DebuggerStepOut, guard('stepOut', async (p: StepPayload) => controller.stepOut(reqIp(p), p.threadIndex)));

  // Inspection.
  ipcMain.handle(IPC.DebuggerStackTrace, guard('stackTrace', async (p: StepPayload) => controller.stackTrace(reqIp(p), p.threadIndex)));
  ipcMain.handle(IPC.DebuggerVariables, guard('variables', async (p: VariablesPayload) =>
    controller.variables(reqIp(p), { threadIndex: p.threadIndex, stackFrameIndex: p.stackFrameIndex, variablePath: p.variablePath })
  ));

  // Breakpoints.
  ipcMain.handle(IPC.DebuggerAddBreakpoints, guard('addBreakpoints', async (p: BreakpointsPayload) => controller.addBreakpoints(reqIp(p), p.breakpoints)));
  ipcMain.handle(IPC.DebuggerRemoveBreakpointsByLocation, guard('removeBreakpointsByLocation', async (p: RemoveByLocationPayload) => controller.removeBreakpointsByLocation(reqIp(p), Array.isArray(p.locations) ? p.locations : [])));
  ipcMain.handle(IPC.DebuggerScanStops, guard('scanStops', async (p: IpPayload) => getScannedStops(reqIp(p))));

  // REPL / evaluate.
  ipcMain.handle(IPC.DebuggerExecute, guard('execute', async (p: ExecutePayload) =>
    controller.execute(reqIp(p), String(p.sourceCode || ''), { threadIndex: p.threadIndex, stackFrameIndex: p.stackFrameIndex })
  ));
}
