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
import { mainError } from '../log.js';

/** Maps the controller's transport-agnostic event kinds onto this app's concrete IPC channels. */
const EVENT_TO_IPC_CHANNEL: Record<DebuggerEventKind, string> = {
  [DEBUGGER_EVENTS.State]: IPC.DebuggerState,
  [DEBUGGER_EVENTS.Stopped]: IPC.DebuggerStopped,
  [DEBUGGER_EVENTS.Output]: IPC.DebuggerOutput,
  [DEBUGGER_EVENTS.RuntimeError]: IPC.DebuggerRuntimeError,
  [DEBUGGER_EVENTS.CompileErrors]: IPC.DebuggerCompileErrors,
  [DEBUGGER_EVENTS.Breakpoints]: IPC.DebuggerBreakpoints
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
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, payload);
  }
}

/**
 * Tell the windows a debug-enabled device was just (re)sideloaded so the Telnet
 * debug sidebar reattaches to the fresh run. Called from the normal sideload
 * handler and the Sideload Relay fan-out.
 */
export function notifyDebuggerReattach(ip: string, extra?: { discovered?: number }): void {
  if (ip) broadcastDebugEvent(IPC.DebuggerReattach, { ip, ...(extra ?? {}) });
}

/** Lazily-created singleton shared by every debugger IPC handler. */
let controllerSingleton: DebugSessionController | null = null;
function getController(): DebugSessionController {
  if (!controllerSingleton) {
    controllerSingleton = new DebugSessionController((event, payload) => {
      broadcastDebugEvent(EVENT_TO_IPC_CHANNEL[event], payload);
    });
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
    const res = await controller.attach(reqIp(payload));
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
