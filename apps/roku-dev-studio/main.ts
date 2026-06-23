const { app, BrowserWindow, ipcMain, Menu, clipboard, dialog, shell } = require('electron');
const { IPC } = require('./shared/ipc/channels');
const pkg = require('./package.json');
// Align Electron app name with productName so Hide/Quit match the bundle title (not package "name").
app.setName((pkg.build && pkg.build.productName) || pkg.name);
const path = require('path');
const fs = require('fs');
const os = require('os');
const { resolveUnderBase, isPathUnderOneOf, resolveUserPathUnderOneOf } = require('roku-dev-studio-platform/path-safe');

// Import IPC handler modules
const { setupIpcHandlers } = require('./main/ipc/index');
const { registerLogViewerIpc, openLogFileViewerWindow } = require('./main/log-file-viewer-window');
const { registerConsoleSpillIpc } = require('./main/console-spill');
const {
  registerFiddleIpc,
  openFiddleWindow,
  broadcastFiddleTerminalData,
  broadcastFiddlePrivacyMode
} = require('./main/fiddle-window');
const { registerBsFiddleIpc } = require('./main/ipc/bs-fiddle-handlers');
const { showAboutDialog, registerAboutIpc } = require('./main/about-dialog');
const { setupAutoUpdater } = require('./main/auto-updater');
const { showSettingsDialog } = require('./main/settings-dialog');
const { registerSettingsWindowIpc } = require('./main/settings-window-ipc');
const { initSettings, loadSettings, saveSettings, registerSettingsIpc } = require('./main/settings');
const secretStore = require('./main/secret-store') as typeof import('./main/secret-store');
const { startMcpBridge } = require('./main/mcp-bridge');
const { getDeviceInfo, getDeviceId } = require('roku-dev-studio-api');
const { mainLog, mainWarn, mainError } = require('./main/log');

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

/** Append one line to the debug log without invoking the console wrapper (diagnostic renderer capture). */
function appendDebugLogLine(line: string) {
  if (!logFile || !app) return;
  const userData = app.getPath('userData');
  const logPathToUse = resolveUserPathUnderOneOf([userData], logFile);
  if (!logPathToUse) return;
  try {
    fs.appendFileSync(logPathToUse, line.endsWith('\n') ? line : `${line}\n`);
  } catch {
    /* ignore */
  }
}

let mainWindow: import('electron').BrowserWindow | undefined;
let developerModeEnabled = false;
let privacyModeEnabled = false;

// ============================================
// Window zoom (View > Zoom In/Out/Reset, ⌘=/⌘-/⌘0, Ctrl+wheel)
// ============================================
//
// All zoom helpers (clamp band, applyZoomFactor, zoomIn/Out/Reset, and the
// per-window setupZoomGuards) live in `./main/window-zoom` so the Log Viewer
// and Fiddle windows can register the same guards. See that module for the
// rationale behind the clamp band and why pinch-zoom is disabled.
const { zoomIn, zoomOut, resetZoom, setupZoomGuards } = require('./main/window-zoom');
const { registerHamburgerMenuIpc } = require('./main/hamburger-menu');
const { registerStripAuxWindowMenus } = require('./main/strip-aux-window-menu');
const {
  isDiagnosticBuild,
  applyDiagnosticCommandLineSwitches,
  registerDiagnosticWebContents,
  startDiagnosticTelemetry,
  registerDiagnosticIpc
} = require('./main/diagnostic-build');

if (isDiagnosticBuild()) {
  applyDiagnosticCommandLineSwitches(app, app.getPath('userData'));
}

// Helper function to safely send messages to renderer.
//
// IMPORTANT: accessing `mainWindow.webContents` on a destroyed BrowserWindow
// itself throws `TypeError: Object has been destroyed` (the getter proxies
// into a native object that no longer exists). So the BrowserWindow's own
// `isDestroyed()` MUST be checked first, before touching `webContents` at
// all. The whole body is also wrapped in a try/catch as a last-resort guard
// against teardown races (e.g. window destroyed between the isDestroyed()
// check and `.send()` returning) — this used to crash the main process via
// `uncaughtException` when a buffered telnet flush landed mid-teardown.
function safeSendToRenderer(channel: string, data: unknown) {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    const wc = mainWindow.webContents;
    if (!wc || wc.isDestroyed()) return false;
    wc.send(channel, data);
    return true;
  } catch {
    return false;
  }
}

// Fiddle windows tap into the same 8085 telnet stream as the main renderer.
// Intercept the TelnetData send so we can also forward to any open Fiddle window.
function safeSendToRendererWithFiddleMirror(channel: string, data: unknown) {
  try {
    if (channel === 'telnet:data' && data && typeof data === 'object') {
      const payload = data as {
        ip?: string;
        data?: string;
        isRemote?: boolean;
        connectionId?: string;
      };
      if (typeof payload.ip === 'string' && typeof payload.data === 'string') {
        try {
          broadcastFiddleTerminalData({
            ip: payload.ip,
            data: payload.data,
            isRemote: payload.isRemote,
            connectionId: payload.connectionId
          });
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
  mainError('Uncaught Exception:', error);
  const code = error && typeof error === 'object' && 'code' in error ? (error as NodeJS.ErrnoException).code : undefined;
  // Don't crash the app for network errors
  if (code === 'EPIPE' || code === 'ECONNRESET' || code === 'ECONNREFUSED') {
    mainLog('Network error caught globally, continuing...');
    return;
  }
});

process.on('unhandledRejection', (reason, promise) => {
  mainError('Unhandled Rejection at:', promise, 'reason:', reason);
});

/** Sandboxed preload may only require('electron'); API code is inlined in preload.bundled.cjs */
function ensurePreloadBundle() {
  const bundled = path.join(__dirname, 'preload.bundled.cjs');
  if (fs.existsSync(bundled)) return;
  mainLog('[Roku Dev Studio] Running scripts/build (main, preload, HTML renderer)...');
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
      mainError(
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
  /** Keep in sync with `--titlebar-height-base` in renderer/index.html */
  const MACOS_TITLEBAR_HEIGHT = 38;
  /** macOS traffic-light cluster visual height (centers in the custom title bar). */
  const MACOS_TRAFFIC_LIGHT_HEIGHT = 14;
  const macTrafficLightY = Math.round(MACOS_TITLEBAR_HEIGHT / 2 - MACOS_TRAFFIC_LIGHT_HEIGHT / 2);
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a0a12',
    // macOS: keep the native frame so traffic lights layer correctly with
    // hiddenInset — frame:false + titleBarStyle is a known bad combo (HTML
    // title-bar controls can paint focus rings over the close button).
    // Win/Linux: frameless shell with custom min/max/close in the HTML title bar.
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 14, y: macTrafficLightY }
        }
      : { frame: false }),
    show: false, // Don't show until ready - faster perceived startup
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow = win;

  // Win/Linux: hide the native menu bar on the main window (hamburger is the
  // primary surface). Accelerators from setApplicationMenu still apply app-wide.
  if (!isMac) {
    win.setMenu(null);
  }

  win.webContents.on('preload-error', (_event: unknown, failedPath: string, error: Error) => {
    mainError('[Roku Dev Studio] Preload failed:', failedPath, error);
  });
  registerDiagnosticWebContents(win.webContents);

  // Show window as soon as it's ready (before content fully loads)
  win.once('ready-to-show', () => {
    win.show();
  });

  // Pinch-zoom disable, Ctrl+wheel re-clamp, and initial-factor broadcast —
  // all in one helper shared with Log Viewer / Fiddle windows. See
  // `./main/window-zoom` for rationale.
  setupZoomGuards(win);

  if (!isMac) {
    const sendMaximizeState = () => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.MainWindowMaximizeChanged, win.isMaximized());
      }
    };
    win.on('maximize', sendMaximizeState);
    win.on('unmaximize', sendMaximizeState);
  }

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
          label: 'Settings',
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
          enabled: !isDiagnosticBuild(),
          click: (menuItem: import('electron').MenuItem) => {
            if (isDiagnosticBuild()) return;
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
        ...(isDiagnosticBuild()
          ? [
              {
                label: 'Open Diagnostic Logs Folder',
                click: () => {
                  void shell.openPath(app.getPath('userData'));
                }
              }
            ]
          : []),
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
        // On macOS, Settings lives in the app menu (Roku Dev Studio → Settings); listing
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
        //
        // Use Electron's second click arg (the FOCUSED `BrowserWindow`)
        // instead of the captured main `win`, so View > Zoom and the
        // Cmd+/-/0 accelerators target whichever window the user is
        // looking at — including the Log Viewer and Fiddle windows.
        // Fall back to the main window if no window has focus (very
        // edge-casey, but keeps the menu functional).
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: (_mi: import('electron').MenuItem, focused?: import('electron').BrowserWindow) =>
            resetZoom(focused || win)
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: (_mi: import('electron').MenuItem, focused?: import('electron').BrowserWindow) =>
            zoomIn(focused || win)
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
          click: (_mi: import('electron').MenuItem, focused?: import('electron').BrowserWindow) =>
            zoomIn(focused || win)
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: (_mi: import('electron').MenuItem, focused?: import('electron').BrowserWindow) =>
            zoomOut(focused || win)
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
  registerStripAuxWindowMenus(app);
  initSettings(app);
  const earlySettings = loadSettings();
  const rememberPasswordsInKeychain = earlySettings.rememberPasswordsInKeychain === true;
  secretStore.init(app, { enabled: rememberPasswordsInKeychain });
  registerAboutIpc(ipcMain, clipboard, shell);
  setupAutoUpdater(app, ipcMain, () => mainWindow);
  registerLogViewerIpc(ipcMain);
  registerConsoleSpillIpc(ipcMain, app);
  registerSettingsIpc(ipcMain);
  registerSecretsIpc(ipcMain);
  registerFiddleIpc(ipcMain, () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null));
  registerBsFiddleIpc(ipcMain);

  // Main renderer (e.g. the Network Inspector port-conflict modal) asks to open Settings, optionally
  // navigated straight to a section.
  ipcMain.on(IPC.SettingsOpen, (event: import('electron').IpcMainEvent, payload: { section?: unknown }) => {
    const parent = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!parent) return;
    const section = typeof payload?.section === 'string' ? payload.section : undefined;
    showSettingsDialog(parent, section);
  });

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
  debugLoggingEnabled = isDiagnosticBuild() ? true : settings.debugLoggingEnabled === true;
  if (isDiagnosticBuild()) {
    developerModeEnabled = true;
  }
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

  registerHamburgerMenuIpc(ipcMain, {
    dialog,
    getMainWindow: () => mainWindow,
    getDebugLogging: () => debugLoggingEnabled,
    setDebugLogging: (enabled: boolean) => {
      if (isDiagnosticBuild() && !enabled) return;
      debugLoggingEnabled = enabled;
      appState.debugLoggingEnabled = debugLoggingEnabled;
      appState.logFile = logFile;
      const nextSettings = loadSettings();
      nextSettings.debugLoggingEnabled = debugLoggingEnabled;
      saveSettings(nextSettings);
      if (debugLoggingEnabled && logFile) {
        enableFileLogging(logFile);
      } else {
        disableFileLogging();
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC.DebugLoggingChanged, debugLoggingEnabled);
      }
    },
    showAboutDialog,
    showSettingsDialog,
    openLogFileViewer: openLogFileViewerWindow,
    openFiddle: () => {
      if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send(IPC.FiddleOpen, {});
      } else {
        openFiddleWindow(undefined, [], null);
      }
    },
    clearCacheAndReload: () => clearCacheAndReload(appState)
  });

  setupIpcHandlers(mainWindow, getDeviceInfo, getDeviceId, safeSendToRendererWithFiddleMirror, dialog, Menu, clipboard, app, appState);

  if (isDiagnosticBuild()) {
    registerDiagnosticIpc(ipcMain, shell, () => app.getPath('userData'));
    startDiagnosticTelemetry({
      userDataDir: userDataPath,
      appendMainLog: appendDebugLogLine,
      getMainWindow: () => mainWindow,
      getExtraSnapshot: () => {
        try {
          const { getNetworkInspectorService } = require('./main/network-inspector/index');
          const st = getNetworkInspectorService(safeSendToRenderer).getStatus();
          return {
            networkInspector: {
              enabled: st.enabled,
              captureActive: st.captureActive,
              captureInterface: st.captureInterface,
              mitmActive: st.mitmActive,
              mitmEnabled: st.mitmEnabled,
              packetsCaptured: st.packetsCaptured,
              eventsBuffered: st.eventsBuffered,
              hotspotInterfaceDetected: st.hotspotInterfaceDetected,
              lastError: st.lastError
            }
          };
        } catch {
          return {};
        }
      }
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('developer-mode-changed', true);
      mainWindow.webContents.send(IPC.DebugLoggingChanged, true);
    }
  }

  startMcpBridge({
    app,
    ipcMain,
    getActiveWebContents: () =>
      mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null
  });

  registerSettingsWindowIpc(ipcMain, Menu, dialog, {
    getAppState: () => appState,
    getSecretStoreStatus: () => secretStore.getStatus(),
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
      mainWarn('[main] secretStore.clearAll failed:', e);
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
    mainError('Clear Cache failed:', e);
    const msg = e instanceof Error ? e.message : String(e);
    dialog.showErrorBox('Clear Cache failed', msg);
  }
}

// Settings and About IPC are registered in app.whenReady (see below).
