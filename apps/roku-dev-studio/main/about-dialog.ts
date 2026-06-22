/**
 * About dialog window and IPC handlers.
 * Uses preload for copy/openExternal; no Node in renderer.
 */

import type { BrowserWindow, Clipboard, IpcMain, IpcMainInvokeEvent, Shell } from 'electron';
import { IPC } from '../shared/ipc/channels';
import { openExternalUrl } from './open-external-url';
import { isMacOS, platformLabel } from 'roku-dev-studio-platform';
import { mainError } from './log.js';

const path = require('path');
const os = require('os');
const { BrowserWindow: BrowserWindowConstructor, dialog } = require('electron');

/**
 * Register IPC handlers for the About dialog (copy, openExternal).
 */
function registerAboutIpc(ipcMain: IpcMain, clipboard: Clipboard, shell: Shell) {
  ipcMain.handle(IPC.AboutCopy, (_event: IpcMainInvokeEvent, text: string) => {
    clipboard.writeText(text);
    return Promise.resolve();
  });
  ipcMain.handle(IPC.AboutOpenExternal, (_event: IpcMainInvokeEvent, url: string) => {
    return openExternalUrl(shell, url);
  });
}

/**
 * Show the About dialog (modal, parent = mainWindow).
 */
function showAboutDialog(mainWindow: BrowserWindow) {
  if (!mainWindow) {
    mainError('Main window not available');
    return;
  }

  const isMac = isMacOS();
  const packageJson = require('../package.json');
  const appVersion = packageJson.version;
  let rokuDevStudioApiVersion = 'unknown';
  try {
    rokuDevStudioApiVersion = require('roku-dev-studio-api').PACKAGE_VERSION ?? 'unknown';
  } catch {
    // Dependency missing or resolution failed (e.g. broken install)
  }
  const electronVersion = process.versions.electron;
  const nodeVersion = process.versions.node;
  const chromiumVersion = process.versions.chrome;
  const v8Version = process.versions.v8;
  const platform = os.platform();
  const arch = os.arch();
  const osRelease = os.release();
  const osType = platformLabel(platform);
  const iconPath = path.join(__dirname, 'assets', 'icon-256.png');
  const iconUrl = `file://${iconPath.replace(/\\/g, '/')}`;
  const authorUrl = packageJson.author?.url || 'https://github.com/hdonapati';
  const repoUrl = 'https://github.com/paramount-engineering/roku-dev-studio';

  const versionInfo = {
    appVersion,
    rokuDevStudioApiVersion,
    electronVersion,
    nodeVersion,
    chromiumVersion,
    v8Version,
    osType,
    arch,
    osRelease
  };

  const aboutContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>About Roku Dev Studio</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      background: #1e1e1e;
      color: #e0e0e0;
      padding: 16px;
      line-height: 1.4;
      overflow: hidden;
      min-height: 0;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    }
    .header {
      text-align: center;
      margin-bottom: 12px;
      flex-shrink: 0;
    }
    .logo {
      width: 56px;
      height: 56px;
      margin: 0 auto 8px;
      border-radius: 12px;
      display: block;
    }
    .app-name {
      font-size: 22px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 4px;
    }
    .app-version {
      font-size: 12px;
      color: #a0a0a0;
      margin-bottom: 10px;
    }
    .info-section {
      background: #252525;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      flex-shrink: 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #333;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #a0a0a0;
      font-size: 12px;
    }
    .info-value {
      color: #ffffff;
      font-size: 12px;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-weight: 500;
    }
    .copyright {
      text-align: center;
      color: #808080;
      font-size: 11px;
      margin-top: 10px;
      padding: 10px 0 14px;
      border-top: 1px solid #333;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .copyright a {
      color: #667eea;
      text-decoration: none;
      transition: color 0.2s;
    }
    .copyright a:hover {
      color: #8b5cf6;
      text-decoration: underline;
    }
    .copyright .sep {
      color: #444;
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 0;
      flex-shrink: 0;
    }
    button {
      padding: 6px 16px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }
    .btn-ok {
      background: #667eea;
      color: white;
    }
    .btn-ok:hover {
      background: #5568d3;
    }
    .btn-copy {
      background: #3a3a3a;
      color: #e0e0e0;
      border: 1px solid #555;
    }
    .btn-copy:hover {
      background: #4a4a4a;
    }
    .links {
      text-align: center;
      color: #808080;
      font-size: 10px;
      margin-top: 8px;
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .links a {
      color: #667eea;
      text-decoration: none;
      transition: color 0.2s;
    }
    .links a:hover {
      color: #8b5cf6;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="${iconUrl}" alt="Roku Dev Studio" class="logo" onerror="console.error('Icon failed to load:', this.src); this.style.display='none';">
    <div class="app-name">Roku Dev Studio</div>
    <div class="app-version">Version ${appVersion}</div>
  </div>
  <div class="info-section">
    <div class="info-row">
      <span class="info-label">roku-dev-studio-api Version:</span>
      <span class="info-value">${rokuDevStudioApiVersion}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Electron Version:</span>
      <span class="info-value">${electronVersion}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Node.js Version:</span>
      <span class="info-value">${nodeVersion}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Chromium Version:</span>
      <span class="info-value">${chromiumVersion}</span>
    </div>
    <div class="info-row">
      <span class="info-label">V8 Version:</span>
      <span class="info-value">${v8Version}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Operating System:</span>
      <span class="info-value">${osType} ${arch} ${osRelease}</span>
    </div>
  </div>
  <div class="copyright">
    <a href="#" onclick="openLink('${repoUrl}'); return false;">roku-dev-studio</a>
    <span class="sep">·</span>
    Built by <a href="#" onclick="openLink('${authorUrl}'); return false;">Hareendra Donapati</a>
  </div>
  <div class="buttons">
    <button class="btn-copy" onclick="copyVersionInfo()">Copy</button>
    <button class="btn-ok" onclick="window.close()">OK</button>
  </div>
  <script>
    const versionInfo = ${JSON.stringify(versionInfo)};
    function openLink(url) {
      if (window.aboutApi && window.aboutApi.openExternal) {
        window.aboutApi.openExternal(url);
      }
    }
    function copyVersionInfo() {
      const info = \`Roku Dev Studio Version: \${versionInfo.appVersion}
Roku Dev Studio API Version: \${versionInfo.rokuDevStudioApiVersion}
Electron Version: \${versionInfo.electronVersion}
Node.js Version: \${versionInfo.nodeVersion}
Chromium Version: \${versionInfo.chromiumVersion}
V8 Version: \${versionInfo.v8Version}
Operating System: \${versionInfo.osType} \${versionInfo.arch} \${versionInfo.osRelease}\`;
      if (!window.aboutApi || !window.aboutApi.copy) return;
      window.aboutApi.copy(info).then(function() {
        const btn = document.querySelector('.btn-copy');
        if (btn) {
          const originalText = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(function() { btn.textContent = originalText; }, 2000);
        }
      });
    }
  </script>
</body>
</html>`;

  const aboutWindow = new BrowserWindowConstructor({
    width: 500,
    height: 400,
    resizable: false,
    minimizable: false,
    maximizable: false,
    modal: true,
    parent: mainWindow,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload-about.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    },
    titleBarStyle: isMac ? 'default' : 'default',
    frame: true,
    show: false
  });

  aboutWindow.once('ready-to-show', () => {
    aboutWindow.show();
  });

  try {
    aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(aboutContent)}`);
  } catch (error) {
    mainError('Error loading About dialog:', error);
    dialog.showErrorBox('Error', 'Failed to load About dialog. Please try again.');
  }
}

export { showAboutDialog, registerAboutIpc };
