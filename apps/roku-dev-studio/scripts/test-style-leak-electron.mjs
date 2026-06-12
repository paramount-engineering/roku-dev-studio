#!/usr/bin/env node
/**
 * Check whether index.html leaks <style> contents into visible body text.
 *
 * Run from apps/roku-dev-studio (NOT electron -e — multiline -e breaks on spaces in paths):
 *   npx electron scripts/test-style-leak-electron.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, '..');
const require = createRequire(path.join(appDir, 'package.json'));
const { app, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { webSecurity: false } });

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('LOAD FAILED', { code, desc, url });
    app.quit();
  });

  await win.loadFile(path.join(appDir, 'renderer', 'index.html'));

  const result = await win.webContents.executeJavaScript(`(() => {
    const bodyText = Array.from(document.body.childNodes)
      .filter((n) => n.nodeType === 3 && n.textContent.trim())
      .map((n) => n.textContent.trim());
    const cssLeak = bodyText.filter(
      (t) =>
        t.includes('.titlebar-') ||
        t.includes('titlebar-help-btn') ||
        t.includes('.telnet-fold-group')
    );
    return {
      title: document.title,
      styleElements: document.querySelectorAll('style').length,
      bodyTextCount: bodyText.length,
      cssLeakCount: cssLeak.length,
      cssLeakSample: cssLeak[0] ? cssLeak[0].slice(0, 240) : null
    };
  })()`);

  console.log(JSON.stringify(result, null, 2));
  win.destroy();
  app.quit();
});

app.on('window-all-closed', () => app.quit());
