/**
 * Standalone window: open a saved network capture (`.rds-network-inspector.json` bundle, HAR 1.2, or
 * `.pcap`) and browse it with the same two-pane UI as the live Network Inspector — read-only.
 *
 * **Load model: whole-file.** Unlike the log viewer (which windows a multi-GB file through a byte
 * index), network captures are small, so the file is parsed once into `ParsedNetworkEvent[]`
 * (`network-session-parse.ts`) and the whole session is handed to the renderer in one `Load` reply.
 * The renderer reuses the Network Inspector's pure render modules (`buildSessions`, `network-detail`)
 * to paint the list + detail. Parsing lives in main because pcap decoding needs Node Buffers and the
 * capture engine's frame parser.
 */
import type { BrowserWindow as ElectronBrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';
import { IPC } from '../shared/ipc/channels';
import { S } from '../shared/strings/index';
import { setupZoomGuards } from './window-zoom';
import { mainError } from './log.js';
import { createWorkerPool, type WorkerPool } from 'roku-dev-studio-platform/worker-pool';
import type { ParsedSession } from './network-session-parse';
import type { SessionParseInput } from './network-session-parse.worker';

const fs = require('fs');
const path = require('path');
const { BrowserWindow, dialog, screen } = require('electron') as typeof import('electron');

/** Lazy singleton — spawned on first import so a session viewer that's never opened never pays for
 *  idle worker threads. Parsing is pure/stateless, so a small fungible pool (not one worker per
 *  window) is the right shape; imports aren't frequent or concurrent enough to need more than 2. */
let sessionParsePool: WorkerPool<SessionParseInput, ParsedSession> | null = null;
function getSessionParsePool(): WorkerPool<SessionParseInput, ParsedSession> {
  if (!sessionParsePool) {
    sessionParsePool = createWorkerPool<SessionParseInput, ParsedSession>({
      workerFile: path.join(__dirname, 'network-session-parse.worker.js'),
      poolSize: 2
    });
  }
  return sessionParsePool;
}

/** Sanity ceiling. Network captures are tiny next to logs; a multi-hundred-MB pcap is almost
 *  certainly a mistaken target, and parsing it fully into memory would be wasteful. */
const MAX_SESSION_BYTES = 512 * 1024 * 1024;

/** Per-window backing state, keyed by BrowserWindow.id. `filePath` is set at open. */
type SessionViewerState = { filePath: string };
const stateByWindowId = new Map<number, SessionViewerState>();

let ipcRegistered = false;

export function registerNetworkSessionViewerIpc(ipcMain: IpcMain): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle(
    IPC.NetSessionViewerLoad,
    async (event: IpcMainInvokeEvent) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const state = win ? stateByWindowId.get(win.id) : undefined;
      if (!state) return { success: false, error: 'No file is associated with this window.' };
      try {
        // Async I/O: the file can be up to MAX_SESSION_BYTES (512 MB); a sync stat/read
        // would freeze the main process (and every window) while it loads.
        const stat = await fs.promises.stat(state.filePath);
        if (!stat.isFile()) return { success: false, error: 'Not a file.' };
        if (stat.size > MAX_SESSION_BYTES) {
          return {
            success: false,
            error: `File is too large (${Math.round(stat.size / (1024 * 1024))} MB). Maximum is ${MAX_SESSION_BYTES / (1024 * 1024)} MB.`
          };
        }
        const buf = (await fs.promises.readFile(state.filePath)) as Buffer;
        // Off the main thread: a multi-hundred-MB capture parses synchronously (PCAP/HAR decode),
        // which would freeze every window for the duration if run here. Deliberately NOT transferring
        // `buf.buffer` — small Buffers (below Node's ~4KB pool threshold) share a backing ArrayBuffer
        // with unrelated allocations, and transferring a shared/pooled buffer throws `DataCloneError:
        // Cannot transfer object of unsupported type` (confirmed empirically). A structured-clone copy
        // is a fast memory copy either way, negligible next to the parse it's avoiding on this thread.
        const parsed = await getSessionParsePool().run({ filePath: state.filePath, buf });
        return {
          success: true,
          fileName: path.basename(state.filePath),
          format: parsed.format,
          events: parsed.events,
          deviceIps: parsed.deviceIps,
          notice: parsed.notice
        };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );
}

export function openNetworkSessionViewerWindow(
  parent: ElectronBrowserWindow | undefined,
  filePath: string
): void {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    const boxOpts = {
      type: 'error' as const,
      title: S.networkSessionViewer.openErrorTitle,
      message: S.common.couldNotOpenFile
    };
    if (parent && !parent.isDestroyed()) {
      void dialog.showMessageBox(parent, boxOpts);
    } else {
      void dialog.showMessageBox(boxOpts);
    }
    return;
  }

  const preloadPath = path.join(__dirname, 'network-session-viewer-preload.bundled.cjs');
  const htmlPath = path.join(__dirname, 'renderer', 'network-session-viewer.html');

  const child = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 640,
    minHeight: 420,
    title: S.networkSessionViewer.windowTitleWithFile(path.basename(resolved)),
    backgroundColor: '#0a0a12',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  stateByWindowId.set(child.id, { filePath: resolved });
  child.once('closed', () => {
    stateByWindowId.delete(child.id);
  });

  setupZoomGuards(child);

  child.once('ready-to-show', () => {
    if (parent && !parent.isDestroyed()) {
      try {
        const pb = parent.getBounds();
        const [w, h] = child.getSize();
        const { workArea } = screen.getDisplayMatching(pb);
        let x = Math.round(pb.x + (pb.width - w) / 2);
        let y = Math.round(pb.y + (pb.height - h) / 2);
        x = Math.min(Math.max(workArea.x, x), workArea.x + workArea.width - w);
        y = Math.min(Math.max(workArea.y, y), workArea.y + workArea.height - h);
        child.setPosition(x, y);
      } catch {
        /* keep OS default placement */
      }
    }
    child.show();
  });

  child.webContents.on('preload-error', (_e: unknown, failedPath: string, error: Error) => {
    mainError('[Network session viewer] Preload failed:', failedPath, error);
  });

  void child.loadFile(htmlPath).catch((err: unknown) => {
    mainError('[Network session viewer] loadFile failed:', err);
    stateByWindowId.delete(child.id);
    if (!child.isDestroyed()) child.close();
  });
}
