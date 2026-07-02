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
import { setupZoomGuards } from './window-zoom';
import { mainError } from './log.js';
import { parseSessionBuffer } from './network-session-parse';

const fs = require('fs');
const path = require('path');
const { BrowserWindow, dialog, screen } = require('electron') as typeof import('electron');

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
        const parsed = parseSessionBuffer(state.filePath, buf);
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
      title: 'Open Network Session',
      message: 'Could not open the selected file.'
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
    title: `Network Session — ${path.basename(resolved)}`,
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
