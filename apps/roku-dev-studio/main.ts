const { app, BrowserWindow, ipcMain, Menu, clipboard, dialog, shell } = require('electron');
const { IPC } = require('./shared/ipc/channels');
const pkg = require('./package.json');
// Align Electron app name with productName so Hide/Quit match the bundle title (not package "name").
app.setName((pkg.build && pkg.build.productName) || pkg.name);
const path = require('path');
const fs = require('fs');
const os = require('os');
const { resolveUnderBase, isPathUnderOneOf, resolveUserPathUnderOneOf } = require('./lib/path-safe');

// Import IPC handler modules
const { setupIpcHandlers } = require('./main/ipc/index');
const { registerLogViewerIpc, openLogFileViewerWindow } = require('./main/log-file-viewer-window');
const {
  registerFiddleIpc,
  openFiddleWindow,
  broadcastFiddleTerminalData,
  broadcastFiddlePrivacyMode
} = require('./main/fiddle-window');
const { registerBsFiddleIpc } = require('./main/ipc/bs-fiddle-handlers');
const { showAboutDialog, registerAboutIpc } = require('./main/about-dialog');
const { showSettingsDialog } = require('./main/settings-dialog');
const { registerSettingsWindowIpc } = require('./main/settings-window-ipc');
const { initSettings, loadSettings, saveSettings, registerSettingsIpc } = require('./main/settings');
const secretStore = require('./main/secret-store') as typeof import('./main/secret-store');
const { startMcpBridge } = require('./main/mcp-bridge');
const { getDeviceInfo, getDeviceId } = require('roku-dev-studio-api');

// ============================================
// File Logging for Debugging (File menu setting)
// ============================================
let debugLoggingEnabled = false;
let logFile: string | null = null; // Set in app.whenReady from app.getPath('userData')
type ConsoleFn = (...args: unknown[]) => void;
let _originalConsoleLog: ConsoleFn | null = null;
let _originalConsoleError: ConsoleFn | null = null;
let _originalConsoleWarn: ConsoleFn | null = null;

function enableFileLogging(filePath: string) {
  // Idempotent: if already wrapped, a naive re-capture would store our wrapper as the
  // "original" and permanently break console restoration in disableFileLogging.
  if (_originalConsoleLog) return;
  _originalConsoleLog = console.log;
  _originalConsoleError = console.error;
  _originalConsoleWarn = console.warn;
  const userData = app ? app.getPath('userData') : '';
  const logPathToUse = filePath && userData ? resolveUserPathUnderOneOf([userData], filePath) : null;

  function writeLog(level: string, ...args: unknown[]) {
    const timestamp = new Date().toISOString();
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    const logLine = `[${timestamp}] [${level}] ${message}\n`;
    try {
      if (logPathToUse) fs.appendFileSync(logPathToUse, logLine);
    } catch (e) { /* ignore */ }
    if (level === 'LOG' && _originalConsoleLog) _originalConsoleLog.apply(console, args);
    else if (level === 'ERROR' && _originalConsoleError) _originalConsoleError.apply(console, args);
    else if (level === 'WARN' && _originalConsoleWarn) _originalConsoleWarn.apply(console, args);
  }

  console.log = (...args) => writeLog('LOG', ...args);
  console.error = (...args) => writeLog('ERROR', ...args);
  console.warn = (...args) => writeLog('WARN', ...args);

  try {
    if (logPathToUse) {
      fs.writeFileSync(logPathToUse, `=== Roku Dev Studio Debug Log at ${new Date().toISOString()} ===\n`);
      _originalConsoleLog?.('Debug logging enabled. Log file:', logPathToUse);
    }
  } catch (e) { /* ignore */ }
}

function disableFileLogging() {
  if (_originalConsoleLog && _originalConsoleError && _originalConsoleWarn) {
    console.log = _originalConsoleLog;
    console.error = _originalConsoleError;
    console.warn = _originalConsoleWarn;
    _originalConsoleLog = _originalConsoleError = _originalConsoleWarn = null;
  }
}

let mainWindow: import('electron').BrowserWindow | undefined;
let developerModeEnabled = false;
let privacyModeEnabled = false;

// ============================================
// Window zoom (View > Zoom In/Out/Reset, ⌘=/⌘-/⌘0, Ctrl+wheel)
// ============================================
//
// Why this lives here: the frameless main window has a CSS title bar that
// scales with `webContents` zoom, while the macOS-drawn traffic-light
// buttons (and the Win/Linux custom controls) DO NOT scale. At extreme
// zoom-out the title bar shrinks below the traffic lights' height and they
// spill into the content (overlapping device tabs). We:
//   1. Clamp zoom to a sensible band so it can never break the chrome
//      catastrophically (50%–200%).
//   2. Broadcast every change to the renderer via `IPC.AppZoomChanged` so
//      the title-bar CSS can inverse-scale itself to stay at a constant
//      screen-pixel size — matching the OS-drawn traffic lights.
const ZOOM_MIN_FACTOR = 0.5;
const ZOOM_MAX_FACTOR = 2.0;
const ZOOM_STEP_FACTOR = 0.1;
const ZOOM_DEFAULT_FACTOR = 1.0;
const ZOOM_EPSILON = 0.001;

function clampZoomFactor(factor: number): number {
  if (!Number.isFinite(factor)) return ZOOM_DEFAULT_FACTOR;
  return Math.max(ZOOM_MIN_FACTOR, Math.min(ZOOM_MAX_FACTOR, factor));
}

function applyZoomFactor(win: import('electron').BrowserWindow | undefined, factor: number) {
  if (!win || !win.webContents || win.webContents.isDestroyed()) return;
  const target = clampZoomFactor(factor);
  // setZoomFactor → triggers a layout pass; the renderer reads the new
  // factor off the IPC payload below rather than via a getter.
  if (Math.abs(win.webContents.getZoomFactor() - target) > ZOOM_EPSILON) {
    win.webContents.setZoomFactor(target);
  }
  safeSendToRenderer(IPC.AppZoomChanged, { factor: target });
}

function zoomIn(win: import('electron').BrowserWindow | undefined) {
  if (!win) return;
  applyZoomFactor(win, win.webContents.getZoomFactor() + ZOOM_STEP_FACTOR);
}

function zoomOut(win: import('electron').BrowserWindow | undefined) {
  if (!win) return;
  applyZoomFactor(win, win.webContents.getZoomFactor() - ZOOM_STEP_FACTOR);
}

function resetZoom(win: import('electron').BrowserWindow | undefined) {
  applyZoomFactor(win, ZOOM_DEFAULT_FACTOR);
}

// Helper function to safely send messages to renderer
function safeSendToRenderer(channel: string, data: unknown) {
  if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    try {
      mainWindow.webContents.send(channel, data);
      return true;
    } catch (error) {
      // Window was destroyed during send, ignore
      return false;
    }
  }
  return false;
}

// Fiddle windows tap into the same 8085 telnet stream as the main renderer.
// Intercept the TelnetData send so we can also forward to any open Fiddle window.
function safeSendToRendererWithFiddleMirror(channel: string, data: unknown) {
  try {
    if (channel === 'telnet:data' && data && typeof data === 'object') {
      const payload = data as { ip?: string; data?: string; isRemote?: boolean };
      if (typeof payload.ip === 'string' && typeof payload.data === 'string') {
        try {
          broadcastFiddleTerminalData(payload.ip, payload.data, !!payload.isRemote);
        } catch (e) {
          /* ignore fiddle broadcast errors */
        }
      }
    }
  } catch (e) {
    /* ignore */
  }
  return safeSendToRenderer(channel, data);
}

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  const code = error && typeof error === 'object' && 'code' in error ? (error as NodeJS.ErrnoException).code : undefined;
  // Don't crash the app for network errors
  if (code === 'EPIPE' || code === 'ECONNRESET' || code === 'ECONNREFUSED') {
    console.log('Network error caught globally, continuing...');
    return;
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

/** Sandboxed preload may only require('electron'); API code is inlined in preload.bundled.cjs */
function ensurePreloadBundle() {
  const bundled = path.join(__dirname, 'preload.bundled.cjs');
  if (fs.existsSync(bundled)) return;
  console.log('[Roku Dev Studio] Running scripts/build (main, preload, HTML renderer)...');
  const { execFileSync } = require('child_process');
  execFileSync(process.execPath, [path.join(__dirname, 'scripts', 'build', 'index.js')], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env
  });
}

/**
 * Default UI: `renderer/index.html` + transpiled modules under `renderer/dist/`.
 * Solid + Vite: RDS_SOLID_RENDERER=1 → http://127.0.0.1:5173 (run `npm run dev:solid`).
 * Built Solid shell: RDS_SOLID_RENDERER=dist → renderer-vite-dist/index.html (after `npm run renderer:solid:build`).
 */
function loadMainRenderer(win: import('electron').BrowserWindow) {
  const solidDev = process.env.RDS_SOLID_RENDERER === '1';
  const solidDist = process.env.RDS_SOLID_RENDERER === 'dist';
  const builtPath = path.join(__dirname, 'renderer-vite-dist', 'index.html');
  const htmlRendererPath = path.join(__dirname, 'renderer', 'index.html');

  if (solidDev) {
    win.loadURL('http://127.0.0.1:5173/').catch((err: unknown) => {
      console.error(
        '[Roku Dev Studio] Vite dev server not reachable at http://127.0.0.1:5173/. Run `npm run dev:solid` in apps/roku-dev-studio (or `npm run start:solid` from repo root).',
        err
      );
    });
    return;
  }
  if (solidDist && fs.existsSync(builtPath)) {
    win.loadFile(builtPath);
    return;
  }
  win.loadFile(htmlRendererPath);
}

type AppWindowState = {
  developerModeEnabled: boolean;
  privacyModeEnabled: boolean;
  debugLoggingEnabled: boolean;
  logFile: string | null;
};

function createWindow(appState: AppWindowState) {
  ensurePreloadBundle();
  const preloadPath = path.resolve(__dirname, 'preload.bundled.cjs');
  const isMac = process.platform === 'darwin';
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a0a12',
    frame: false,
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 14, y: 13 }
        }
      : {}),
    show: false, // Don't show until ready - faster perceived startup
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow = win;

  win.webContents.on('preload-error', (_event: unknown, failedPath: string, error: Error) => {
    console.error('[Roku Dev Studio] Preload failed:', failedPath, error);
  });

  // Show window as soon as it's ready (before content fully loads)
  win.once('ready-to-show', () => {
    win.show();
  });

  // ---- Zoom plumbing (see ZOOM_* helpers above for rationale) ---------
  // 1. Pinch-zoom on a touchpad bypasses our menu handlers entirely;
  //    disable it so the only paths to zoom are the menu (clamped) and
  //    Ctrl+wheel (caught + clamped via the `zoom-changed` listener
  //    below).
  win.webContents.setVisualZoomLevelLimits(1, 1).catch((err: Error) => {
    console.warn('[Zoom] setVisualZoomLevelLimits failed:', err.message);
  });
  // 2. Ctrl+wheel doesn't fire our menu handlers — Electron applies the
  //    new zoom level itself and emits `zoom-changed`. Re-clamp on top of
  //    its applied value, then re-broadcast so the renderer mirrors the
  //    final factor. Note: `zoom-changed` fires AFTER the new zoom is
  //    applied, so reading `getZoomFactor()` returns the post-Electron
  //    value; clamping it back is idempotent if already in-range.
  win.webContents.on('zoom-changed', (_event: Electron.Event, _direction: 'in' | 'out') => {
    applyZoomFactor(win, win.webContents.getZoomFactor());
  });
  // 3. Tell the renderer the starting zoom factor as soon as it loads,
  //    so the `--app-zoom` CSS variable is set before first paint and
  //    the title bar starts at the correct size on cold start / reload.
  win.webContents.on('did-finish-load', () => {
    safeSendToRenderer(IPC.AppZoomChanged, { factor: clampZoomFactor(win.webContents.getZoomFactor()) });
  });

  loadMainRenderer(win);

  // Create application menu
  const template = [
    // macOS app menu (first menu is always the app name on Mac)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        {
          label: 'About Roku Dev Studio',
          click: () => showAboutDialog(win)
        },
        { type: 'separator' },
        {
          label: 'Settings…',
          accelerator: 'CmdOrCtrl+,',
          click: () => showSettingsDialog(win)
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Developer Mode',
          type: 'checkbox',
          checked: developerModeEnabled,
          accelerator: 'CmdOrCtrl+Shift+D',
          click: (menuItem: import('electron').MenuItem) => {
            developerModeEnabled = !!menuItem.checked;
            // Notify renderer of the change
            if (win && win.webContents) {
              win.webContents.send('developer-mode-changed', developerModeEnabled);
            }
          }
        },
        {
          label: 'Privacy Mode',
          type: 'checkbox',
          checked: privacyModeEnabled,
          accelerator: 'CmdOrCtrl+Shift+P',
          click: (menuItem: import('electron').MenuItem) => {
            privacyModeEnabled = !!menuItem.checked;
            // Keep appState in sync so the system-handler `getPrivacyMode`
            // invoke (used by freshly-opened Fiddle / Settings windows) reads
            // the current value instead of the snapshot captured at startup.
            if (appState) {
              appState.privacyModeEnabled = privacyModeEnabled;
            }
            if (win && win.webContents) {
              win.webContents.send('privacy-mode-changed', privacyModeEnabled);
            }
            // Fan the toggle out to every open Fiddle window so its dropdown
            // and password modal mask IPs in lockstep with the main window.
            broadcastFiddlePrivacyMode(privacyModeEnabled);
          }
        },
        {
          label: 'Debug Logging',
          type: 'checkbox',
          checked: debugLoggingEnabled,
          accelerator: 'CmdOrCtrl+Shift+L',
          click: (menuItem: import('electron').MenuItem) => {
            debugLoggingEnabled = !!menuItem.checked;
            if (appState) {
              appState.debugLoggingEnabled = debugLoggingEnabled;
              appState.logFile = logFile;
            }
            const settings = loadSettings();
            settings.debugLoggingEnabled = debugLoggingEnabled;
            saveSettings(settings);
            if (debugLoggingEnabled && logFile) {
              enableFileLogging(logFile);
            } else {
              disableFileLogging();
            }
            if (win && win.webContents) {
              win.webContents.send('debug-logging-changed', debugLoggingEnabled);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Open Log File',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const res = await dialog.showOpenDialog(win, {
              title: 'Open log file',
              properties: ['openFile'],
              filters: [
                {
                  name: 'Log & text',
                  extensions: ['log', 'txt', 'text', 'out', 'err', 'trace', 'rtf']
                },
                { name: 'All files', extensions: ['*'] }
              ]
            });
            if (res.canceled || !res.filePaths?.length) return;
            openLogFileViewerWindow(win, res.filePaths[0]!);
          }
        },
        {
          label: 'Open Fiddle',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => {
            // Ask the renderer for the current device snapshot, then open a fresh Fiddle window.
            if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
              mainWindow.webContents.send(IPC.FiddleOpen, {});
            } else {
              openFiddleWindow(undefined, [], null);
            }
          }
        },
        // On macOS, Settings lives in the app menu (Roku Dev Studio → Settings…); listing
        // it here too would duplicate it. Keep the File-menu entry on Windows / Linux where
        // there is no app menu.
        ...(isMac
          ? []
          : [
              {
                label: 'Settings',
                accelerator: 'CmdOrCtrl+,',
                click: () => showSettingsDialog(win)
              }
            ]),
        { type: 'separator' },
        {
          label: 'Clear Cache and Reload',
          click: () => clearCacheAndReload(appState)
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        // Custom zoom handlers (instead of the built-in roles) so we can
        // clamp to ZOOM_MIN_FACTOR..ZOOM_MAX_FACTOR and broadcast the new
        // factor to the renderer for title-bar inverse-scaling.
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: () => resetZoom(win)
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => zoomIn(win)
        },
        {
          // Second binding — Cmd+= without Shift. Electron's
          // built-in `zoomIn` role registers both `CmdOrCtrl+Plus` and
          // `CmdOrCtrl+=`; we mirror that so the unshifted top-row "="
          // works too.
          label: 'Zoom In (=)',
          accelerator: 'CmdOrCtrl+=',
          visible: false,
          acceleratorWorksWhenHidden: true,
          click: () => zoomIn(win)
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => zoomOut(win)
        },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' }
      ]
    },
    // Help menu only on Windows / Linux — macOS already has About in the app menu and
    // Settings is also in the app menu, so a Help menu would either be empty or
    // duplicate those entries.
    ...(isMac
      ? []
      : [
          {
            label: 'Help',
            submenu: [
              {
                label: 'About Roku Dev Studio',
                click: () => showAboutDialog(win)
              }
            ]
          }
        ])
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * IPC surface for the encrypted secret store. The renderer hydrates an
 * in-memory cache from `secrets:get-all` once at startup, then issues
 * fire-and-forget `set` / `delete` calls on user actions. We never return
 * ciphertext to the renderer — the same trust boundary as the previous
 * `localStorage` scheme (the renderer always had cleartext anyway).
 */
function registerSecretsIpc(ipc: typeof ipcMain) {
  ipc.handle(IPC.SecretsStatus, async () => {
    try {
      return { success: true, ...secretStore.getStatus() };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipc.handle(IPC.SecretsGetAll, async () => {
    try {
      const status = secretStore.getStatus();
      return { success: true, entries: secretStore.getAllPasswords(), ...status };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipc.handle(IPC.SecretsSetPassword, async (_event: import('electron').IpcMainInvokeEvent, payload: { serial?: unknown; password?: unknown }) => {
    const serial = typeof payload?.serial === 'string' ? payload.serial : '';
    const password = typeof payload?.password === 'string' ? payload.password : '';
    if (!serial) return { success: false, error: 'Missing serial' };
    try {
      secretStore.setPassword(serial, password);
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipc.handle(IPC.SecretsDeletePassword, async (_event: import('electron').IpcMainInvokeEvent, payload: { serial?: unknown }) => {
    const serial = typeof payload?.serial === 'string' ? payload.serial : '';
    if (!serial) return { success: false, error: 'Missing serial' };
    try {
      secretStore.deletePassword(serial);
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipc.handle(IPC.SecretsMigrateLegacy, async (_event: import('electron').IpcMainInvokeEvent, payload: { entries?: unknown }) => {
    const entries =
      payload && typeof payload.entries === 'object' && payload.entries !== null
        ? (payload.entries as Record<string, string>)
        : {};
    try {
      const result = secretStore.migrateLegacy(entries);
      return { success: true, ...result };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipc.handle(IPC.SecretsClearAll, async () => {
    try {
      secretStore.clearAll();
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
}

app.whenReady().then(() => {
  initSettings(app);
  const earlySettings = loadSettings();
  const rememberPasswordsInKeychain = earlySettings.rememberPasswordsInKeychain === true;
  secretStore.init(app, { enabled: rememberPasswordsInKeychain });
  registerAboutIpc(ipcMain, clipboard, shell);
  registerLogViewerIpc(ipcMain);
  registerSettingsIpc(ipcMain);
  registerSecretsIpc(ipcMain);
  registerFiddleIpc(ipcMain, () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null));
  registerBsFiddleIpc(ipcMain);

  // Renderer replies to the "Open Fiddle" menu click with the device snapshot.
  ipcMain.on(IPC.FiddleOpen, (event: import('electron').IpcMainEvent, payload: { devices?: unknown; initialDeviceId?: string | null }) => {
    const parent = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const devices = Array.isArray(payload?.devices) ? payload!.devices : [];
    const initialId = payload?.initialDeviceId ?? null;
    openFiddleWindow(parent || undefined, devices, initialId);
  });

  // Title-bar zoom indicator (`-` / `+` buttons in the renderer): route the
  // direction through the same `zoomIn`/`zoomOut`/`resetZoom` helpers as the
  // View menu so clamp + `AppZoomChanged` broadcast stay in one place.
  ipcMain.on(IPC.AppZoomChange, (event: import('electron').IpcMainEvent, payload: { direction?: unknown }) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!win) return;
    const direction = payload?.direction;
    if (direction === 'in') zoomIn(win);
    else if (direction === 'out') zoomOut(win);
    else if (direction === 'reset') resetZoom(win);
  });

  // Load debug logging from settings (no file-on-Desktop needed)
  const settings = loadSettings();
  debugLoggingEnabled = settings.debugLoggingEnabled === true;
  const userDataPath = app.getPath('userData');
  const resolvedLogFile =
    resolveUnderBase(userDataPath, 'roku-dev-studio-debug.log') ?? path.join(userDataPath, 'roku-dev-studio-debug.log');
  logFile = resolvedLogFile;
  if (debugLoggingEnabled) {
    enableFileLogging(resolvedLogFile);
  }

  // Create appState before createWindow so the menu can keep it in sync when toggling Debug Logging
  const appState = {
    developerModeEnabled,
    privacyModeEnabled,
    debugLoggingEnabled,
    logFile
  };
  createWindow(appState);
  setupIpcHandlers(mainWindow, getDeviceInfo, getDeviceId, safeSendToRendererWithFiddleMirror, dialog, Menu, clipboard, app, appState);

  startMcpBridge({
    app,
    ipcMain,
    getActiveWebContents: () =>
      mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null
  });

  registerSettingsWindowIpc(ipcMain, Menu, dialog, {
    getAppState: () => appState,
    applyModesAfterSave: (d: boolean, p: boolean, dbg: boolean) => {
      developerModeEnabled = d;
      privacyModeEnabled = p;
      debugLoggingEnabled = dbg;
      appState.developerModeEnabled = d;
      appState.privacyModeEnabled = p;
      appState.debugLoggingEnabled = dbg;
      appState.logFile = logFile;
      if (dbg && logFile) {
        enableFileLogging(logFile);
      } else {
        disableFileLogging();
      }
    },
    applyRememberPasswordsInKeychain: (next: boolean) => {
      // Flipping the toggle just changes the on-disk encoding (encrypted via
      // `safeStorage` when on, JSON-encoded plaintext when off — see
      // `main/secret-store.ts`). The file is re-written in the new mode so
      // the next cold launch reads it back correctly. "Clear Cache and
      // Reload" / the explicit clearAll IPC is the only thing that actually
      // deletes remembered entries.
      secretStore.setEnabled(next);
    },
    notifyRenderer: (channel: string, data: unknown) => {
      safeSendToRenderer(channel, data);
      // Privacy Mode toggles need to reach every open Fiddle window too —
      // the main renderer is no longer the only consumer of this signal.
      if (channel === IPC.PrivacyModeChanged) {
        broadcastFiddlePrivacyMode(!!data);
      }
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(appState);
      // Setup IPC handlers again if window was recreated
      setupIpcHandlers(mainWindow, getDeviceInfo, getDeviceId, safeSendToRendererWithFiddleMirror, dialog, Menu, clipboard, app, appState);
    }
  });
});

// Quit when the last window closes on all platforms (including macOS).
// Otherwise on macOS the process stays alive after the red close button and
// main-process Telnet/WebSocket sessions remain open until Cmd+Q / Quit.
app.on('window-all-closed', () => {
  app.quit();
});

// ============================================
// Clear Cache and Reload
// ============================================
async function clearCacheAndReload(appState: AppWindowState) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Clear Cache and Reload',
    message: 'Clear all Cached Data and Reload the app?',
    detail: 'This will clear: saved passwords, remote locations, device list state, minimized/collapsed state, and any other stored data. The app will then Reload. This cannot be undone.',
    buttons: ['Cancel', 'Clear and Reload'],
    defaultId: 0,
    cancelId: 0
  });
  if (response !== 1) return;
  try {
    const wc = mainWindow.webContents;
    if (wc && !wc.isDestroyed()) {
      await wc.session.clearStorageData({
        storages: ['cookies', 'localstorage', 'cachestorage', 'indexdb', 'filesystem']
      });
    }
    saveSettings({});
    // Encrypted dev-password store lives outside the renderer's `localStorage`
    // (under `<userData>/secrets/`), so `session.clearStorageData` doesn't
    // touch it. Wipe it here so "Clear Cache and Reload" really does clear
    // *all* persisted data.
    try {
      secretStore.clearAll();
    } catch (e) {
      console.warn('[main] secretStore.clearAll failed:', e);
    }
    // Keep in-memory/menu state in sync with the now-empty settings file so the
    // renderer can't read stale developer/privacy/debug flags from the main process.
    // appState is mirrored here too because `registerSettingsWindowIpc`
    // exposes it via `getAppState`; leaving it stale would cause the Settings
    // window to read pre-clear values.
    developerModeEnabled = false;
    privacyModeEnabled = false;
    appState.developerModeEnabled = false;
    appState.privacyModeEnabled = false;
    if (debugLoggingEnabled) {
      debugLoggingEnabled = false;
      disableFileLogging();
    }
    appState.debugLoggingEnabled = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  } catch (e) {
    console.error('Clear Cache failed:', e);
    const msg = e instanceof Error ? e.message : String(e);
    dialog.showErrorBox('Clear Cache failed', msg);
  }
}

// Settings and About IPC are registered in app.whenReady (see below).
