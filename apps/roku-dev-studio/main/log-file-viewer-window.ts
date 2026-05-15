/**
 * Standalone window: open a log file with the same console-style rendering as the device Console.
 *
 * **Load model: streaming.** Earlier the main process read the entire file
 * into a Buffer, decoded to a single string, and shipped that whole string
 * back to the renderer in one IPC reply. For a 36 MB file that meant the
 * file lived three times in memory at peak (Buffer + decoded string in main +
 * IPC-cloned string in renderer) before parsing even started, then a fourth
 * time as the parsed `entries[]` settled. Streaming chunks instead lets the
 * renderer parse and discard text incrementally; only `entries[]` survives
 * at steady state, and the user sees content as it arrives.
 */

import type { BrowserWindow as ElectronBrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';
import { TextDecoder } from 'util';
import { IPC } from '../shared/ipc/channels';
import { setupZoomGuards } from './window-zoom';

const fs = require('fs');
const path = require('path');
const { BrowserWindow, dialog, screen } = require('electron') as typeof import('electron');

const LOG_VIEWER_MAX_BYTES = 36 * 1024 * 1024;
/**
 * Streaming chunk size. 256 KB is the sweet spot for our setup:
 *  - Small enough that the first chunk arrives quickly (sub-50 ms perceived
 *    latency on macOS spinning disks; near-instant on SSD).
 *  - Big enough that the parser amortizes per-chunk overhead — `setImmediate`
 *    yields between chunks, so smaller chunks would mean more yield trips
 *    per file with no win on parse throughput.
 *  - Big enough that a typical 5 MB file completes in 20 chunks (so the
 *    progress bar / status line ticks meaningfully without flooding IPC).
 */
const LOG_VIEWER_STREAM_CHUNK_BYTES = 256 * 1024;

/**
 * Encoding sniffer. Examines the first 2–3 bytes of the file and returns:
 *
 *   - `{ encoding, bomBytes }` — chosen encoding label for `TextDecoder`,
 *     and the number of BOM bytes to skip before decoding starts.
 *   - The body of the very first chunk that follows the BOM (so the caller
 *     doesn't have to re-buffer it).
 *
 * Three encodings cover the Roku ecosystem:
 *
 *   - UTF-8  (`EF BB BF` BOM) — sideloaded BrightScript dumps from macOS /
 *     Linux test harnesses; also the no-BOM default.
 *   - UTF-16 LE (`FF FE`)     — Windows native (PowerShell `Out-File`,
 *     Notepad's "Unicode" save, several Win-side QA tools).
 *   - UTF-16 BE (`FE FF`)     — much rarer, but trivial to handle while
 *     we're already sniffing.
 *
 * No BOM ⇒ assume UTF-8. No heuristic charset detection — false positives
 * are worse than mojibake the user can immediately see is wrong.
 */
function sniffEncoding(firstChunk: Buffer): { encoding: string; bomBytes: number } {
  if (firstChunk.length >= 2 && firstChunk[0] === 0xff && firstChunk[1] === 0xfe) {
    return { encoding: 'utf-16le', bomBytes: 2 };
  }
  if (firstChunk.length >= 2 && firstChunk[0] === 0xfe && firstChunk[1] === 0xff) {
    return { encoding: 'utf-16be', bomBytes: 2 };
  }
  if (
    firstChunk.length >= 3 &&
    firstChunk[0] === 0xef &&
    firstChunk[1] === 0xbb &&
    firstChunk[2] === 0xbf
  ) {
    return { encoding: 'utf-8', bomBytes: 3 };
  }
  return { encoding: 'utf-8', bomBytes: 0 };
}

/** BrowserWindow.id → absolute file path (set before load; cleared on close). */
const logViewerPathsByWindowId = new Map<number, string>();

let logViewerIpcRegistered = false;

export function registerLogViewerIpc(ipcMain: IpcMain): void {
  if (logViewerIpcRegistered) return;
  logViewerIpcRegistered = true;

  // Streaming load. Renderer kicks off via `LogViewerStreamStart` (invoke);
  // main answers with `{ success, fileName?, fileSize? }` and starts emitting
  // `LogViewerStreamChunk` events on the same `webContents`. Either
  // `LogViewerStreamComplete` (EOF) or `LogViewerStreamError` (read failure)
  // terminates the stream.
  ipcMain.handle(
    IPC.LogViewerStreamStart,
    async (event: IpcMainInvokeEvent): Promise<{
      success: boolean;
      fileName?: string;
      fileSize?: number;
      error?: string;
    }> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || win.isDestroyed()) {
        return { success: false, error: 'Internal error: no window' };
      }
      const filePath = logViewerPathsByWindowId.get(win.id);
      if (!filePath) {
        return { success: false, error: 'No file is associated with this window' };
      }

      let stat: ReturnType<typeof fs.statSync>;
      try {
        stat = fs.statSync(filePath);
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
      if (!stat.isFile()) {
        return { success: false, error: 'Not a file' };
      }
      if (stat.size > LOG_VIEWER_MAX_BYTES) {
        return {
          success: false,
          error: `File is too large (${Math.round(stat.size / (1024 * 1024))} MB). Maximum is ${LOG_VIEWER_MAX_BYTES / (1024 * 1024)} MB.`
        };
      }

      const fileName = path.basename(filePath);
      const fileSize: number = stat.size;
      const sender = event.sender;

      // Start the stream on the next tick so the invoke result lands in the
      // renderer *before* the first chunk event — the renderer needs the
      // fileName/fileSize to mount the surface scaffold before chunks arrive.
      setImmediate(() => {
        if (sender.isDestroyed()) return;
        streamFileToRenderer(sender, filePath, fileSize).catch((err: unknown) => {
          if (sender.isDestroyed()) return;
          sender.send(IPC.LogViewerStreamError, {
            error: err instanceof Error ? err.message : String(err)
          });
        });
      });

      return { success: true, fileName, fileSize };
    }
  );
}

/**
 * Read `filePath` in `LOG_VIEWER_STREAM_CHUNK_BYTES`-sized chunks, sniff the
 * encoding from the first chunk, decode each chunk through a streaming
 * `TextDecoder` (which buffers split multi-byte sequences across chunks),
 * and forward decoded text to the renderer with progress.
 *
 * `TextDecoder({ stream: true })` is the right primitive here:
 *  - On UTF-8 we'd otherwise see mojibake at any chunk boundary that lands
 *    in the middle of a multi-byte sequence (CJK, emoji, structured-payload
 *    Unicode escapes — all common in BrightScript log dumps).
 *  - On UTF-16 the chunk size is even (256 KB), so 16-bit code units never
 *    split — but BMP surrogate pairs that straddle chunks would; the
 *    streaming decoder handles them correctly.
 */
async function streamFileToRenderer(
  sender: Electron.WebContents,
  filePath: string,
  totalBytes: number
): Promise<void> {
  const stream = fs.createReadStream(filePath, { highWaterMark: LOG_VIEWER_STREAM_CHUNK_BYTES });
  let decoder: TextDecoder | null = null;
  let doneBytes = 0;
  let firstChunkSeen = false;

  for await (const raw of stream as AsyncIterable<Buffer>) {
    if (sender.isDestroyed()) {
      stream.destroy();
      return;
    }
    let chunk = raw;
    if (!firstChunkSeen) {
      firstChunkSeen = true;
      const { encoding, bomBytes } = sniffEncoding(chunk);
      try {
        decoder = new TextDecoder(encoding, { fatal: false });
      } catch {
        decoder = new TextDecoder('utf-8', { fatal: false });
      }
      if (bomBytes > 0) chunk = chunk.subarray(bomBytes);
    }
    if (!decoder) continue;
    const text = decoder.decode(chunk, { stream: true });
    doneBytes += raw.length;
    if (text.length > 0) {
      sender.send(IPC.LogViewerStreamChunk, { text, doneBytes, totalBytes });
    }
  }

  if (sender.isDestroyed()) return;

  // Flush any bytes the streaming decoder buffered (e.g. an incomplete
  // multi-byte sequence at EOF — invalid for the encoding but the
  // non-fatal decoder will replace with U+FFFD).
  if (decoder) {
    const tail = decoder.decode();
    if (tail.length > 0) {
      sender.send(IPC.LogViewerStreamChunk, {
        text: tail,
        doneBytes,
        totalBytes
      });
    }
  }
  sender.send(IPC.LogViewerStreamComplete, {});
}

export function openLogFileViewerWindow(parent: ElectronBrowserWindow | undefined, filePath: string): void {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    const boxOpts = {
      type: 'error' as const,
      title: 'Open Log File',
      message: 'Could not open the selected file.'
    };
    if (parent && !parent.isDestroyed()) {
      void dialog.showMessageBox(parent, boxOpts);
    } else {
      void dialog.showMessageBox(boxOpts);
    }
    return;
  }

  const preloadPath = path.join(__dirname, 'log-viewer-preload.bundled.cjs');
  const htmlPath = path.join(__dirname, 'renderer', 'log-file-viewer.html');

  // No `parent`: a child window stays above the main window and can vanish or mis-stack when
  // dragged to another display. This is a normal top-level window; we only center it on the
  // parent's display once at open time.
  const child = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 560,
    minHeight: 400,
    title: `Logs — ${path.basename(resolved)}`,
    backgroundColor: '#0a0a12',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  logViewerPathsByWindowId.set(child.id, resolved);
  child.once('closed', () => {
    logViewerPathsByWindowId.delete(child.id);
  });

  // Same zoom band + pinch-zoom guard as the main window so View > Zoom and
  // Ctrl+wheel both clamp to the configured min/max factor.
  setupZoomGuards(child);

  child.once('ready-to-show', () => {
    if (parent && !parent.isDestroyed()) {
      try {
        const pb = parent.getBounds();
        const [w, h] = child.getSize();
        const { workArea } = screen.getDisplayMatching(pb);
        let x = Math.round(pb.x + (pb.width - w) / 2);
        let y = Math.round(pb.y + (pb.height - h) / 2);
        const maxX = workArea.x + workArea.width - w;
        const maxY = workArea.y + workArea.height - h;
        x = Math.min(Math.max(workArea.x, x), maxX);
        y = Math.min(Math.max(workArea.y, y), maxY);
        child.setPosition(x, y);
      } catch {
        /* keep OS default placement */
      }
    }
    child.show();
  });

  child.webContents.on('preload-error', (_e: unknown, failedPath: string, error: Error) => {
    console.error('[Log viewer] Preload failed:', failedPath, error);
  });

  void child.loadFile(htmlPath).catch((err: unknown) => {
    console.error('[Log viewer] loadFile failed:', err);
    logViewerPathsByWindowId.delete(child.id);
    if (!child.isDestroyed()) child.close();
  });
}
