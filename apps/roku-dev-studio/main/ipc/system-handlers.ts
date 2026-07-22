import type { App, BrowserWindow, Clipboard, Dialog, IpcMainInvokeEvent, Rectangle } from 'electron';
import { broadcastPrivacyModeToAllWindows } from '../privacy-broadcast';
import { openExternalUrl } from '../open-external-url';
import { IPC } from '../../shared/ipc/channels';
import { mainLog, mainError } from '../log.js';
import type {
  ActionScriptWriteFilePayload,
  CaptureViewRectPayload,
  ContextMenuItemLoose,
  ReadFileOrUrlPayload,
  CopyImagePayload,
  ReadFilePayload,
  SaveBinaryFilePayload,
  SaveResultsPdfPayload,
  SaveTextFilePayload
} from '../../shared/ipc/payloads';

// System handlers (menu, clipboard, file operations)

const fs = require('fs');
const path = require('path');
const os = require('os');
const { fileURLToPath } = require('url');
const { isPathUnderOneOf, resolveUnderBase, resolveUserPathUnderOneOf } = require('roku-dev-studio-platform/path-safe');

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

type AppWindowState = {
  developerModeEnabled: boolean;
  privacyModeEnabled: boolean;
  debugLoggingEnabled: boolean;
  logFile: string | null;
};

let mainWindowChromeIpcRegistered = false;

/**
 * Setup system IPC handlers
 */
function setupSystemHandlers(
  mainWindow: BrowserWindow | undefined,
  dialog: Dialog,
  Menu: typeof import('electron').Menu,
  clipboard: Clipboard,
  app: App,
  state: AppWindowState
) {
  const { ipcMain, BrowserWindow: ElectronBrowserWindow } = require('electron') as typeof import('electron');

  function mainWinFromEvent(sender: import('electron').WebContents): BrowserWindow | undefined {
    const fromSender = ElectronBrowserWindow.fromWebContents(sender);
    if (fromSender && !fromSender.isDestroyed()) return fromSender;
    if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
    return undefined;
  }

  function notifyMainRenderer(channel: string, data: unknown): void {
    const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
    if (win?.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }

  if (!mainWindowChromeIpcRegistered) {
    mainWindowChromeIpcRegistered = true;
    ipcMain.on(IPC.MainWindowMinimize, (event: import('electron').IpcMainEvent) => {
      mainWinFromEvent(event.sender)?.minimize();
    });
    ipcMain.on(IPC.MainWindowToggleMaximize, (event: import('electron').IpcMainEvent) => {
      const w = mainWinFromEvent(event.sender);
      if (!w) return;
      if (w.isMaximized()) w.unmaximize();
      else w.maximize();
    });
    ipcMain.on(IPC.MainWindowClose, (event: import('electron').IpcMainEvent) => {
      mainWinFromEvent(event.sender)?.close();
    });
  }
  const allowedFileBases = app ? [app.getPath('userData'), app.getPath('documents'), os.homedir()] : [os.homedir()];

  // Show context menu
  ipcMain.handle(IPC.ShowContextMenu, async (_event: IpcMainInvokeEvent, items: unknown) => {
    return new Promise((resolve) => {
      const list = Array.isArray(items) ? (items as ContextMenuItemLoose[]) : [];
      const menuItems = list.map((item: ContextMenuItemLoose) => {
        if (item.type === 'separator') {
          return { type: 'separator' as const };
        }
        return {
          label: item.label as string | undefined,
          click: () => {
            if (item.action === 'copy') {
              clipboard.writeText(String(item.value ?? ''));
            }
            resolve({ action: item.action, value: item.value });
          }
        };
      });

      const menu = Menu.buildFromTemplate(
        menuItems as import('electron').MenuItemConstructorOptions[]
      );
      menu.popup({
        window: mainWindow ?? undefined,
        callback: () => resolve(null)
      });
    });
  });

  // Clipboard write — the single text-clipboard channel (renderer `copyToClipboard`).
  ipcMain.handle(IPC.ClipboardWrite, async (_event: IpcMainInvokeEvent, text: string) => {
    clipboard.writeText(text);
    return { success: true };
  });

  // Open URL in default browser
  const shell = require('electron').shell;
  ipcMain.handle(IPC.ShellOpenExternal, async (_event: IpcMainInvokeEvent, url: string) => {
    try {
      await openExternalUrl(shell, url);
      return { success: true };
    } catch (error) {
      return { success: false, error: errMsg(error) };
    }
  });

  // Save arbitrary text content (console logs, ECP / App Connector responses, …) to a file.
  ipcMain.handle(
    IPC.RokuSaveTextFile,
    async (event: IpcMainInvokeEvent, { content, defaultName, dialogTitle }: SaveTextFilePayload) => {
      try {
        const win = mainWinFromEvent(event.sender);
        if (!win) return { success: false, error: 'No window available' };
        const result = await dialog.showSaveDialog(win, {
          title: dialogTitle || 'Save',
          defaultPath: defaultName || `response-${Date.now()}.txt`,
          filters: [
            { name: 'Text Files', extensions: ['txt', 'json', 'xml', 'log', 'har'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });
        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Save cancelled' };
        }
        await fs.promises.writeFile(result.filePath, content ?? '', 'utf-8');
        return { success: true, filePath: result.filePath };
      } catch (err) {
        mainError('Error saving text file:', err);
        return { success: false, error: errMsg(err) };
      }
    }
  );

  // Save raw binary content (e.g. an image / video / arbitrary response body) to a file.
  ipcMain.handle(
    IPC.RokuSaveBinaryFile,
    async (event: IpcMainInvokeEvent, { base64, defaultName, dialogTitle }: SaveBinaryFilePayload) => {
      try {
        const win = mainWinFromEvent(event.sender);
        if (!win) return { success: false, error: 'No window available' };
        const result = await dialog.showSaveDialog(win, {
          title: dialogTitle || 'Save File',
          defaultPath: defaultName || `download-${Date.now()}`,
          filters: [{ name: 'All Files', extensions: ['*'] }]
        });
        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Save cancelled' };
        }
        await fs.promises.writeFile(result.filePath, Buffer.from(base64 ?? '', 'base64'));
        return { success: true, filePath: result.filePath };
      } catch (err) {
        mainError('Error saving binary file:', err);
        return { success: false, error: errMsg(err) };
      }
    }
  );

  // Copy an image (data URL) to the OS clipboard as an actual picture (not text).
  ipcMain.handle(IPC.RokuCopyImage, async (_event: IpcMainInvokeEvent, { dataUrl }: CopyImagePayload) => {
    try {
      const { nativeImage } = require('electron') as typeof import('electron');
      const img = nativeImage.createFromDataURL(String(dataUrl ?? ''));
      if (img.isEmpty()) return { success: false, error: 'Unsupported or empty image' };
      clipboard.writeImage(img);
      return { success: true };
    } catch (err) {
      mainError('Error copying image:', err);
      return { success: false, error: errMsg(err) };
    }
  });

  // Save TrackerTask.xml to file
  ipcMain.handle(IPC.RokuSaveTrackerTask, async () => {
    try {
      // Show save dialog
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: 'Save TrackerTask.xml',
        defaultPath: 'TrackerTask.xml',
        filters: [
          { name: 'XML Files', extensions: ['xml'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Save cancelled' };
      }
      
      // Read the TrackerTask content from the bundled file (path under app dir only)
      const trackerTaskPath = resolveUnderBase(__dirname, '..', 'roku-components', 'TrackerTask.xml') || path.join(__dirname, '..', 'roku-components', 'TrackerTask.xml');
      let trackerTaskContent;
      
      try {
        // Try to read the bundled TrackerTask.xml
        trackerTaskContent = await fs.promises.readFile(trackerTaskPath, 'utf-8');
      } catch (readErr) {
        // If not found, return error with helpful message
        mainLog('TrackerTask.xml not found at', trackerTaskPath);
        return { 
          success: false, 
          error: 'TrackerTask.xml not found in application bundle. Please ensure the file exists in roku-components folder.' 
        };
      }
      
      // Write to selected path
      await fs.promises.writeFile(result.filePath, trackerTaskContent, 'utf-8');

      return { success: true, filePath: result.filePath };
    } catch (err) {
      mainError('Error saving TrackerTask:', err);
      return { success: false, error: errMsg(err) };
    }
  });

  // Check if debug logging is enabled
  ipcMain.handle(IPC.IsDebugEnabled, async () => {
    return {
      enabled: state.debugLoggingEnabled,
      logFile: state.logFile
    };
  });

  // Whether verbose logging is forced on by the unified RDS_DEBUG env flag. Env can't change at
  // runtime, so the renderer reads this once at startup and ORs it with the Developer Mode toggle.
  ipcMain.handle(IPC.GetVerboseDebug, async () => {
    const { debugEnvEnabled } = require('roku-dev-studio-platform/node') as typeof import('roku-dev-studio-platform/node');
    return { enabled: debugEnvEnabled() };
  });

  // Get developer mode state
  ipcMain.handle(IPC.GetDeveloperMode, async () => {
    return { enabled: state.developerModeEnabled };
  });

  // Set developer mode state
  ipcMain.handle(IPC.SetDeveloperMode, async (_event: IpcMainInvokeEvent, enabled: boolean) => {
    state.developerModeEnabled = enabled;
    // Update menu checkbox
    const menu = Menu.getApplicationMenu();
    if (menu) {
      const fileMenu = menu.items.find(item => item.label === 'File');
      if (fileMenu && fileMenu.submenu) {
        const devModeItem = fileMenu.submenu.items.find(item => item.label === 'Developer Mode');
        if (devModeItem) {
          devModeItem.checked = enabled;
        }
      }
    }
    notifyMainRenderer(IPC.DeveloperModeChanged, enabled);
    return { success: true, enabled: state.developerModeEnabled };
  });

  // Get privacy mode state
  ipcMain.handle(IPC.GetPrivacyMode, async () => {
    return { enabled: state.privacyModeEnabled };
  });

  // Set privacy mode state
  ipcMain.handle(IPC.SetPrivacyMode, async (_event: IpcMainInvokeEvent, enabled: boolean) => {
    state.privacyModeEnabled = enabled;
    // Update menu checkbox
    const menu = Menu.getApplicationMenu();
    if (menu) {
      const fileMenu = menu.items.find(item => item.label === 'File');
      if (fileMenu && fileMenu.submenu) {
        const privacyModeItem = fileMenu.submenu.items.find(item => item.label === 'Privacy Mode');
        if (privacyModeItem) {
          privacyModeItem.checked = enabled;
        }
      }
    }
    // Reach every window (main, Fiddle, Settings, Session Viewer, …), not just
    // the main renderer — each masks off the same broadcast.
    broadcastPrivacyModeToAllWindows(enabled);
    return { success: true, enabled: state.privacyModeEnabled };
  });

  ipcMain.handle(IPC.IsMainWindowMaximized, async (event: IpcMainInvokeEvent) => {
    const win = mainWinFromEvent(event.sender);
    return { maximized: !!win?.isMaximized() };
  });

  // ============================================
  // Action Scripts (Test Suite)
  // ============================================

  // Show folder picker for Action Script run (screenshots, console log)
  ipcMain.handle(IPC.RokuActionScriptShowSaveFolder, async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: 'Select folder to save screenshots and logs',
        properties: ['openDirectory']
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }
      return { success: true, folderPath: result.filePaths[0] };
    } catch (err) {
      return { success: false, error: errMsg(err) };
    }
  });

  // Write file to path (text or base64). filePath is full path, or use folderPath+filename.
  // Auto-creates intermediate directories if they don't exist. Path must be under userData, documents, or homedir.
  ipcMain.handle(IPC.RokuActionScriptWriteFile, async (
    _event: IpcMainInvokeEvent,
    { filePath, folderPath, filename, content, encoding }: ActionScriptWriteFilePayload
  ) => {
    try {
      const rawPath = filePath || (folderPath && filename ? path.join(folderPath, filename) : null);
      if (!rawPath || content === undefined) {
        return { success: false, error: 'filePath (or folderPath+filename) and content required' };
      }
      const targetPath = resolveUserPathUnderOneOf(allowedFileBases, rawPath);
      if (!targetPath) {
        return { success: false, error: 'Path is not under an allowed directory' };
      }
      // Ensure parent directory exists (recursive mkdir is idempotent — no existsSync race).
      const dir = path.dirname(targetPath);
      await fs.promises.mkdir(dir, { recursive: true });
      let data: string | Buffer =
        typeof content === 'string' ? content : Buffer.from(String(content ?? ''), 'utf8');
      let enc: NodeJS.BufferEncoding | undefined = (encoding || 'utf8') as NodeJS.BufferEncoding;
      if (typeof content === 'string' && content.startsWith('data:')) {
        const base64Match = content.match(/^data:[^;]+;base64,(.+)$/);
        if (base64Match) {
          data = Buffer.from(base64Match[1], 'base64');
          enc = undefined;
        }
      } else if (enc === 'base64' && typeof content === 'string') {
        data = Buffer.from(content, 'base64');
        enc = undefined;
      }
      if (enc !== undefined) {
        await fs.promises.writeFile(targetPath, data, enc);
      } else {
        await fs.promises.writeFile(targetPath, data);
      }
      return { success: true, filePath: targetPath };
    } catch (err) {
      return { success: false, error: errMsg(err) };
    }
  });

  // Check if file exists (for Action Script sideload step validation). Path must be under allowed bases.
  ipcMain.handle(IPC.RokuActionScriptCheckFileExists, async (_event: IpcMainInvokeEvent, { filePath }: ReadFilePayload) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, exists: false };
      }
      const resolved = resolveUserPathUnderOneOf(allowedFileBases, filePath);
      if (!resolved) {
        return { success: false, exists: false };
      }
      const exists = fs.existsSync(resolved);
      return { success: true, exists };
    } catch (err) {
      return { success: false, exists: false, error: errMsg(err) };
    }
  });

  // Show save dialog for Action Script (Builder save script)
  ipcMain.handle(IPC.RokuActionScriptShowSaveScriptDialog, async () => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: 'Save Action Script',
        defaultPath: `action-script-${Date.now()}.json`,
        filters: [
          { name: 'JSON', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }
      return { success: true, filePath: result.filePath };
    } catch (err) {
      return { success: false, error: errMsg(err) };
    }
  });

  // Read file as base64 (for PDF image embedding from file:// paths). Path must be under allowed bases.
  ipcMain.handle(IPC.RokuCaptureViewRect, async (event: IpcMainInvokeEvent, payload: CaptureViewRectPayload) => {
    try {
      /**
       * `webContents.capturePage(rect)` uses the rect in the same coordinate system as the
       * page view (DIP / CSS layout pixels, matching `getBoundingClientRect()`). Chromium then
       * scales the output bitmap by the display device scale factor internally — multiplying
       * by DPR here double-scales and crops the wrong region (often unrelated UI).
       */
      const x0 = Number(payload?.x);
      const y0 = Number(payload?.y);
      const w0 = Number(payload?.width);
      const h0 = Number(payload?.height);
      if (![x0, y0, w0, h0].every((n) => Number.isFinite(n))) {
        return { success: false as const, error: 'Invalid capture rect' };
      }
      const rect: Rectangle = {
        x: Math.round(x0),
        y: Math.round(y0),
        width: Math.max(1, Math.round(w0)),
        height: Math.max(1, Math.round(h0))
      };
      const image = await event.sender.capturePage(rect);
      if (image.isEmpty()) {
        return { success: false as const, error: 'Capture returned an empty image (is the region on-screen?)' };
      }
      const dataUrl = image.toDataURL();
      return { success: true as const, dataUrl };
    } catch (err) {
      return { success: false as const, error: errMsg(err) };
    }
  });

  ipcMain.handle(IPC.RokuReadFileAsBase64, async (_event: IpcMainInvokeEvent, { filePathOrUrl }: ReadFileOrUrlPayload) => {
    try {
      let filePath = filePathOrUrl;
      if (typeof filePath !== 'string' || !filePath) {
        return { success: false, error: 'Path required' };
      }
      if (filePath.startsWith('file://')) {
        try {
          filePath = fileURLToPath(filePath);
        } catch {
          filePath = filePath.slice(7);
        }
      }
      const resolved = resolveUserPathUnderOneOf(allowedFileBases, filePath);
      if (!resolved) {
        return { success: false, error: 'Path is not under an allowed directory' };
      }
      if (!fs.existsSync(resolved)) {
        return { success: false, error: 'File not found' };
      }
      const buf = await fs.promises.readFile(resolved);
      const ext = path.extname(resolved).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      const base64 = buf.toString('base64');
      const dataUrl = `data:${mime};base64,${base64}`;
      return { success: true, dataUrl };
    } catch (err) {
      return { success: false, error: errMsg(err) };
    }
  });

  // Save Action Script results as PDF (images embedded; displays correctly in all viewers)
  ipcMain.handle(IPC.RokuSaveResultsPdf, async (_event: IpcMainInvokeEvent, { payload }: SaveResultsPdfPayload) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: 'Save Results',
        defaultPath: `action-script-results-${Date.now()}.pdf`,
        filters: [
          { name: 'PDF', extensions: ['pdf'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }
      const { PDFDocument, StandardFonts, rgb, layoutMultilineText, TextAlignment } = require('pdf-lib');
      const doc = await PDFDocument.create();
      const helvetica = doc.embedStandardFont(StandardFonts.Helvetica);
      const helveticaBold = doc.embedStandardFont(StandardFonts.HelveticaBold);
      const courier = doc.embedStandardFont(StandardFonts.Courier);

      // US Letter: 612 x 792 pt; content area with consistent margins
      const PAGE_WIDTH = 612;
      const PAGE_HEIGHT = 792;
      const MARGIN_LEFT = 54;
      const MARGIN_RIGHT = 54;
      const MARGIN_TOP = 54;
      const MARGIN_BOTTOM = 54;
      const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
      const CONTENT_TOP = PAGE_HEIGHT - MARGIN_TOP;
      const CONTENT_BOTTOM = MARGIN_BOTTOM;
      const BODY_FONT_SIZE = 9;
      const HEADER_FONT_SIZE = 11;
      const LINE_SPACING = 4;
      const BLOCK_GAP = 14;
      const IMAGE_MARGIN = 6;
      const MAX_IMAGE_WIDTH = CONTENT_WIDTH;
      const MAX_IMAGE_HEIGHT = Math.floor(PAGE_HEIGHT * 0.55);
      /** Match executor UI: 12px margin per nesting level → 12 pt in PDF. */
      const INDENT_PT_PER_DEPTH = 12;

      let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      let y = CONTENT_TOP;

      // pdf-lib standard fonts are WinAnsi-only. Map or drop non-WinAnsi so PDF doesn't break.
      // - Explicit map: symbols/emojis -> ASCII text (→ ->, ✓/✗, quotes, arrows, bullets, etc.)
      // - ASCII 32-126 and Latin-1 (160-255): kept
      // - Everything else (other emojis, CJK, etc.): "?"
      const WINANSI_REPLACEMENTS: Record<string, string> = {
        '\u2192': '->', '\u2190': '<-', '\u2191': '^', '\u2193': 'v', '\u2194': '<->',
        '\u2713': 'OK', '\u2717': '[X]', '\u2714': 'OK', '\u274C': '[X]',
        '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"', '\u2013': '-', '\u2014': '-',
        '\u2022': '*', '\u2023': '>', '\u25E6': 'o', '\u25AA': '[.]', '\u25AB': '[.]',
        '\u2612': '[X]', '\u2610': '[ ]', '\u2611': '[X]',
        '\u26A0': '[!]', '\u26A0\uFE0F': '[!]', '\u2139': '(i)', '\u2139\uFE0F': '(i)',
        '\u274E': '[X]', '\u2705': 'OK', '\u2705\uFE0F': 'OK', '\u274C\uFE0F': '[X]',
        '\u00A0': ' '
      };
      function sanitizeForWinAnsi(str: unknown) {
        if (str == null) return '';
        let s = String(str);
        s = s.replace(/\u2713\s/g, '').replace(/\u2713/g, 'OK');
        let out = '';
        for (let i = 0; i < s.length; i++) {
          const code = s.codePointAt(i);
          if (code === undefined) break;
          let key = s[i];
          if (code >= 0x10000) {
            key = s[i] + s[i + 1];
            i++;
          } else if (s[i + 1] === '\uFE0F') {
            key = s[i] + '\uFE0F';
            i++;
          }
          const replacement = WINANSI_REPLACEMENTS[key as string];
          if (replacement !== undefined) { out += replacement; continue; }
          if (code >= 32 && code <= 126) { out += s[i]; continue; }
          if (code >= 160 && code <= 255) { out += s[i]; continue; }
          out += '?';
        }
        return out;
      }

      function ensureSpace(needed: number) {
        if (y - needed < CONTENT_BOTTOM) {
          page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          y = CONTENT_TOP;
        }
      }

      /** Draw text, preserving newlines so XML/JSON from query/appFunction stay formatted like in the tool. */
      function drawMultilineText(str: unknown, opts: Record<string, unknown> = {}) {
        const font = (opts.font as typeof helvetica | undefined) || helvetica;
        const fontSize = (opts.size as number | undefined) || BODY_FONT_SIZE;
        const color = (opts.color as ReturnType<typeof rgb> | undefined) || rgb(0, 0, 0);
        const indentPt = Math.max(0, (opts.indentPt as number | undefined) || 0);
        const raw = String(str).trim() || '';
        if (!raw) return;
        const layoutBoundsHeight = 12000;
        const textWidth = Math.max(36, CONTENT_WIDTH - indentPt);
        const layoutOpts = {
          alignment: TextAlignment.Left,
          fontSize,
          font,
          bounds: { x: MARGIN_LEFT + indentPt, y: 0, width: textWidth, height: layoutBoundsHeight }
        };
        const logicalLines = raw.split(/\n/);
        for (const lineContent of logicalLines) {
          const text = sanitizeForWinAnsi(lineContent || ' ');
          if (!text) {
            ensureSpace(fontSize * 1.2);
            y -= fontSize * 1.2;
            continue;
          }
          const layout = layoutMultilineText(text, layoutOpts);
          const lineHeight = layout.lineHeight;
          for (const line of layout.lines) {
            ensureSpace(lineHeight);
            page.drawText(line.text, {
              x: line.x,
              y: y - lineHeight,
              size: layout.fontSize,
              font,
              color
            });
            y -= lineHeight;
          }
          y -= LINE_SPACING;
        }
        y -= LINE_SPACING;
      }

      function drawSingleLine(text: unknown, opts: Record<string, unknown> = {}) {
        const font = (opts.font as typeof helvetica | undefined) || helvetica;
        const fontSize = (opts.size as number | undefined) || BODY_FONT_SIZE;
        const color = (opts.color as ReturnType<typeof rgb> | undefined) || rgb(0, 0, 0);
        const indentPt = Math.max(0, (opts.indentPt as number | undefined) || 0);
        const lineHeight = font.heightAtSize(fontSize) * 1.2;
        ensureSpace(lineHeight + LINE_SPACING);
        page.drawText(sanitizeForWinAnsi(String(text).replace(/\n/g, ' ')), {
          x: MARGIN_LEFT + indentPt,
          y: y - lineHeight,
          size: fontSize,
          font,
          color,
          maxWidth: Math.max(36, CONTENT_WIDTH - indentPt),
          lineHeight
        });
        y -= lineHeight + LINE_SPACING;
      }

      const payloadRec = payload as Record<string, unknown>;
      const blocks = payloadRec.blocks;
      if (!Array.isArray(blocks) || blocks.length === 0) {
        drawSingleLine('No Results to save.');
      } else {
        for (const block of blocks as Record<string, unknown>[]) {
          const depth = Math.min(12, Math.max(0, Number(block.depth) || 0));
          const indentPt = depth * INDENT_PT_PER_DEPTH;
          if (block.header) {
            const headerLineHeight = helveticaBold.heightAtSize(HEADER_FONT_SIZE) * 1.2;
            ensureSpace(headerLineHeight + LINE_SPACING);
            page.drawText(sanitizeForWinAnsi(block.header), {
              x: MARGIN_LEFT + indentPt,
              y: y - headerLineHeight,
              size: HEADER_FONT_SIZE,
              font: helveticaBold,
              color: rgb(0.2, 0.2, 0.2),
              maxWidth: Math.max(36, CONTENT_WIDTH - indentPt)
            });
            y -= headerLineHeight + LINE_SPACING;
          }
          const imageMaxW = Math.max(36, Math.min(MAX_IMAGE_WIDTH, CONTENT_WIDTH - indentPt));
          async function drawPdfImage(dataUrl: string) {
            if (!dataUrl || typeof dataUrl !== 'string') return;
            try {
              const isPng = /^data:image\/png;base64,/i.test(dataUrl);
              const isJpg = /^data:image\/jpeg;base64,/i.test(dataUrl) || /^data:image\/jpg;base64,/i.test(dataUrl);
              const image = isPng
                ? await doc.embedPng(dataUrl)
                : isJpg
                  ? await doc.embedJpg(dataUrl)
                  : null;
              if (!image) return;
              let drawW = image.width;
              let drawH = image.height;
              const scaleW = imageMaxW / drawW;
              const scaleH = MAX_IMAGE_HEIGHT / drawH;
              const scale = Math.min(1, scaleW, scaleH);
              drawW = Math.round(drawW * scale);
              drawH = Math.round(drawH * scale);
              ensureSpace(drawH + 2 * IMAGE_MARGIN);
              y -= IMAGE_MARGIN;
              page.drawImage(image, {
                x: MARGIN_LEFT + indentPt,
                y: y - drawH,
                width: drawW,
                height: drawH
              });
              y -= drawH + IMAGE_MARGIN;
            } catch (_) {
              // skip invalid image
            }
          }
          // Prefer ordered `body` (matches executor DOM). Fall back for older payloads.
          const bodyItems = Array.isArray(block.body)
            ? (block.body as Record<string, unknown>[])
            : null;
          if (bodyItems && bodyItems.length > 0) {
            for (const item of bodyItems) {
              if (!item || typeof item !== 'object') continue;
              const kind = item.type;
              if (kind === 'line') {
                drawMultilineText(item.text, {
                  font: courier,
                  size: BODY_FONT_SIZE,
                  color: item.isError ? rgb(0.75, 0.2, 0.2) : rgb(0.15, 0.15, 0.15),
                  indentPt
                });
              } else if (kind === 'output') {
                drawMultilineText(item.text, { font: courier, size: BODY_FONT_SIZE, indentPt });
              } else if (kind === 'textBlock') {
                drawMultilineText(item.text, { font: helvetica, size: BODY_FONT_SIZE, indentPt });
              } else if (kind === 'caption') {
                drawMultilineText(item.text, {
                  font: helveticaBold,
                  size: 10,
                  color: rgb(0.25, 0.25, 0.25),
                  indentPt
                });
              } else if (kind === 'image' && typeof item.dataUrl === 'string') {
                await drawPdfImage(item.dataUrl);
              }
            }
          } else {
            if (Array.isArray(block.lines)) {
              for (const line of block.lines as { text?: unknown; isError?: boolean }[]) {
                drawMultilineText(line.text, {
                  font: courier,
                  size: BODY_FONT_SIZE,
                  color: line.isError ? rgb(0.75, 0.2, 0.2) : rgb(0.15, 0.15, 0.15),
                  indentPt
                });
              }
            }
            if (block.output) {
              drawMultilineText(block.output, { font: courier, size: BODY_FONT_SIZE, indentPt });
            }
            if (Array.isArray(block.images)) {
              for (const dataUrl of block.images as string[]) {
                await drawPdfImage(dataUrl);
              }
            }
          }
          if (block.status) {
            drawMultilineText(block.status, {
              color: block.statusError ? rgb(0.75, 0.2, 0.2) : rgb(0.2, 0.6, 0.35),
              font: helvetica,
              size: BODY_FONT_SIZE,
              indentPt
            });
          }
          y -= BLOCK_GAP;
        }
      }

      const pdfBytes = await doc.save();
      await fs.promises.writeFile(result.filePath, pdfBytes);
      return { success: true, filePath: result.filePath };
    } catch (err) {
      mainError('Error saving results PDF:', err);
      return { success: false, error: errMsg(err) };
    }
  });

  // Open debug log file
  ipcMain.handle(IPC.OpenLogFile, async () => {
    if (!state.debugLoggingEnabled) {
      return { success: false, error: 'Debug logging not enabled' };
    }
    try {
      await shell.openPath(state.logFile);
      return { success: true, path: state.logFile };
    } catch (error) {
      return { success: false, error: errMsg(error) };
    }
  });
}

export { setupSystemHandlers };
