/**
 * IPC handlers for the BrightScript Fiddle window.
 *
 *  fiddle:lint — run brighterscript validation over the user's snippet and
 *                return normalized diagnostics for Monaco markers.
 *  fiddle:run  — wrap user code in a SceneGraph channel, zip it, sideload
 *                it (local or remote). For local devices we bounce the shared
 *                8085 telnet socket so output streams from a clean state.
 *  fiddle:stop — deleteSideload on the currently-selected device.
 */

import type { IpcMain, IpcMainInvokeEvent, WebContents } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import { S } from '../../shared/strings/index';
import {
  getFiddleStateByWindow,
  broadcastFiddleTerminalCleared,
  setFiddleActiveSideload,
  requestMainRendererClearPassword,
  onFiddleWindowClosed,
  type FiddleDeviceSnapshotEntry
} from '../fiddle-window';
import {
  ensureDebugTelnetConnected,
  bounceDebugTelnet
} from './telnet-handlers';
import { ensureRemoteTelnetConnected } from './remote-handlers';
import { mainLog, mainWarn, mainError } from '../log.js';

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { BrowserWindow } = require('electron') as typeof import('electron');

const rdsApi = require('roku-dev-studio-api');
const { buildFiddleZip, sideloadChannel, deleteSideload, query: ecpQuery } = rdsApi;
const { userCodeDefinesInit } = rdsApi as { userCodeDefinesInit?: (src: string) => boolean };

/**
 * Must match the `title=` in `roku-components/fiddle/manifest`. If that title
 * ever changes, update this constant too — `isFiddleInstalled` compares the
 * sideloaded channel's title against this string to decide whether it's safe
 * to `deleteSideload` on behalf of the user (Stop button + window-close
 * cleanup). A mismatch silently makes both no-ops and the stale channel
 * lingers on the device.
 */
const FIDDLE_CHANNEL_TITLE = 'Roku Dev Studio Fiddle';

// Lazy-load brighterscript so a broken install doesn't crash main at startup.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let brighterscriptMod: any = null;
function loadBrighterscript() {
  if (brighterscriptMod !== null) return brighterscriptMod;
  try {
    brighterscriptMod = require('brighterscript');
  } catch (err) {
    mainError('[Fiddle] brighterscript not available — syntax diagnostics disabled.', err);
    brighterscriptMod = false;
  }
  return brighterscriptMod;
}

function randomRunId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function resolveDevice(
  deviceId: string,
  fiddleState: ReturnType<typeof getFiddleStateByWindow>
): FiddleDeviceSnapshotEntry | null {
  if (!fiddleState) return null;
  return fiddleState.devices.find((d) => d.id === deviceId) || null;
}

interface LintOut {
  diagnostics: Array<{
    severity: 'error' | 'warning' | 'info' | 'hint';
    message: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    code?: string | number;
  }>;
  engineAvailable: boolean;
}

function lintCode(code: string): LintOut {
  const bsc = loadBrighterscript();
  if (!bsc) return { diagnostics: [], engineAvailable: false };

  try {
    const program = new bsc.Program({
      rootDir: '/rds-fiddle',
      createPackage: false,
      copyToStaging: false,
      autoImportComponentScript: false
    });

    const pkgPath = 'components/FiddleScene.brs';
    program.setFile(pkgPath, code || '');
    program.validate();

    const MAX_COL = 10000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const diags = program.getDiagnostics()
      // Filter diagnostics that are irrelevant for single-file snippets.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((d: any) => {
        const codeVal = typeof d.code === 'string' || typeof d.code === 'number'
          ? d.code
          : (d.code && typeof d.code === 'object' && 'value' in d.code ? d.code.value : undefined);
        // "file-not-referenced" is always present for an orphan component file in Fiddle.
        if (codeVal === 1013 || codeVal === 'file-not-referenced') return false;
        return true;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((d: any) => {
        const sevNum = typeof d.severity === 'number' ? d.severity : 1;
        const severity: LintOut['diagnostics'][number]['severity'] =
          sevNum === 1 ? 'error' :
          sevNum === 2 ? 'warning' :
          sevNum === 3 ? 'info' : 'hint';
        const startLine = (d.range?.start?.line ?? 0) + 1;
        const startColRaw = d.range?.start?.character ?? 0;
        const startCol = Math.min(MAX_COL, Math.max(0, startColRaw)) + 1;
        const endLine = (d.range?.end?.line ?? d.range?.start?.line ?? 0) + 1;
        const endColRaw = d.range?.end?.character ?? startColRaw;
        const endCol = Math.min(MAX_COL, Math.max(0, endColRaw)) + 1;
        const codeField =
          typeof d.code === 'string' || typeof d.code === 'number'
            ? d.code
            : (d.code && typeof d.code === 'object' && 'value' in d.code ? d.code.value : undefined);
        return {
          severity,
          message: String(d.message || ''),
          line: startLine,
          column: startCol,
          endLine,
          endColumn: endCol,
          code: codeField
        };
      });

    // Fiddle-specific rule: `init` is reserved by the scene component that
    // hosts your snippet. Surface it as an error with a precise range so
    // Monaco highlights the offending line.
    if (userCodeDefinesInit && userCodeDefinesInit(code || '')) {
      const m = /(^|\n)(\s*)(sub|function)\s+init\s*\(/i.exec(code || '');
      if (m) {
        // Compute 1-based line/col of the `init` identifier.
        const before = (code || '').slice(0, (m.index || 0) + m[1].length + m[2].length);
        const lineIdx = (before.match(/\n/g) || []).length; // 0-based
        const kwLen = m[3].length; // "sub" or "function"
        const colIdx = (m[2]?.length || 0) + kwLen + 1; // before "init"
        const initStart = colIdx + 1; // after the single space after kw → points at `init`
        diags.push({
          severity: 'error',
          message: S.fiddle.lintReservedInit,
          line: lineIdx + 1,
          column: initStart + 1,
          endLine: lineIdx + 1,
          endColumn: initStart + 1 + 4, // length of "init"
          code: 'fiddle-reserved-init'
        });
      }
    }

    try { program.dispose?.(); } catch { /* ignore */ }

    return { diagnostics: diags, engineAvailable: true };
  } catch (err) {
    mainError('[Fiddle] lint error:', err);
    return { diagnostics: [], engineAvailable: true };
  }
}

/**
 * Classify a remote sideload failure message so we can decide whether it's
 * worth retrying. "Broken pipe" / "EPIPE" / "ECONNRESET" etc. are almost
 * always transient relay-to-device network blips.
 */
function isTransientRemoteUploadError(errorMessage: string | undefined): boolean {
  if (!errorMessage || typeof errorMessage !== 'string') return false;
  const m = errorMessage.toLowerCase();
  return (
    m.includes('broken pipe') ||
    m.includes('epipe') ||
    m.includes('econnreset') ||
    m.includes('etimedout') ||
    m.includes('connection reset') ||
    m.includes('send failure') ||
    m.includes('socket hang up') ||
    m.includes('stream error')
  );
}

/** Rewrite a raw curl/relay error into something a human can act on. */
function humanizeRemoteUploadError(raw: string | undefined): string {
  const msg = (raw || '').trim();
  if (!msg) return S.fiddle.errRemoteUnknown;
  if (isTransientRemoteUploadError(msg)) {
    return S.fiddle.errRemoteNetworkBlip;
  }
  // Surface the tail of the curl output (the part after the last "curl:" token
  // is usually the most actionable bit).
  const curlTail = msg.match(/curl[^A-Za-z0-9]+\(\d+\)[^\n]*/);
  if (curlTail) return S.fiddle.errRemoteCurl(curlTail[0]);
  return msg.length > 240 ? msg.slice(0, 240) + '…' : msg;
}

async function sideloadRemoteUploadOnce(opts: {
  serverUrl: string;
  ip: string;
  zipPath: string;
  password: string;
}): Promise<{ success: boolean; error?: string; message?: string; authFailed?: boolean }> {
  const fileName = path.basename(opts.zipPath);
  // Async read (the zip can be many MB) BEFORE constructing the upload Promise, so the main
  // thread isn't blocked and we avoid an async Promise executor.
  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.promises.readFile(opts.zipPath);
  } catch (err) {
    return { success: false, error: errMsg(err) };
  }
  return new Promise((resolve) => {
    try {
      const form = new FormData();
      form.append('file', fileBuffer, { filename: fileName, contentType: 'application/zip' });
      form.append('password', opts.password);
      const url = new URL(opts.serverUrl);
      const httpModule = require(url.protocol === 'https:' ? 'https' : 'http');
      const req = httpModule.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: `/device/${opts.ip}/sideload`,
          method: 'POST',
          headers: form.getHeaders(),
          timeout: 180000
        },
        (res: import('http').IncomingMessage) => {
          let data = '';
          res.on('data', (chunk: Buffer | string) => { data += chunk; });
          res.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch { resolve({ success: false, error: 'Invalid response from remote server' }); }
          });
        }
      );
      req.setTimeout(180000);
      req.on('error', (err: Error) => resolve({ success: false, error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Remote sideload timeout' });
      });
      form.pipe(req);
    } catch (err) {
      resolve({ success: false, error: errMsg(err) });
    }
  });
}

/**
 * Upload the Fiddle zip to the relay server with automatic retry on transient
 * relay→device failures (broken pipe, ECONNRESET, etc.). Each retry rebuilds
 * the multipart body so the form stream isn't reused after it's been consumed.
 */
async function sideloadRemoteUpload(opts: {
  serverUrl: string;
  ip: string;
  zipPath: string;
  password: string;
}): Promise<{ success: boolean; error?: string; message?: string; authFailed?: boolean }> {
  const maxAttempts = 3;
  let last: { success: boolean; error?: string; message?: string; authFailed?: boolean } = { success: false };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await sideloadRemoteUploadOnce(opts);
    if (last.success) return last;
    if (!isTransientRemoteUploadError(last.error)) break;
    mainWarn(`[Fiddle] remote sideload attempt ${attempt} failed (transient): ${last.error}`);
    // Small backoff so the relay/device has a breath before we hit it again.
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  return { ...last, error: humanizeRemoteUploadError(last.error) };
}

/**
 * Read the device's installed-apps list and return `true` only when the dev
 * slot is currently our Fiddle channel (matched by manifest title). If the
 * query fails we return `false` — delete is suppressed rather than risking
 * removing someone else's sideloaded channel.
 */
async function isFiddleInstalled(ip: string, serverUrl: string | null | undefined): Promise<boolean> {
  try {
    const xml = serverUrl
      ? await fetchRemoteAppsXml(serverUrl, ip)
      : await fetchLocalAppsXml(ip);
    if (!xml) return false;
    // `<app id="dev" ...>Roku Dev Studio Fiddle</app>` — manifest title is
    // what Roku puts between the tags for sideloaded apps.
    const devTag = xml.match(/<app[^>]*\bid=["']dev["'][^>]*>([^<]*)<\/app>/i);
    if (!devTag || typeof devTag[1] !== 'string') return false;
    return devTag[1].trim() === FIDDLE_CHANNEL_TITLE;
  } catch (err) {
    mainWarn('[Fiddle] isFiddleInstalled check failed:', errMsg(err));
    return false;
  }
}

function fetchLocalAppsXml(ip: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      void ecpQuery(ip, '/query/apps', { timeout: 4000 }).then((res: { success?: boolean; data?: string }) => {
        if (res && res.success && typeof res.data === 'string') resolve(res.data);
        else resolve('');
      }).catch(() => resolve(''));
    } catch {
      resolve('');
    }
  });
}

function fetchRemoteAppsXml(serverUrl: string, ip: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const url = new URL(serverUrl);
      const httpModule = require(url.protocol === 'https:' ? 'https' : 'http');
      const req = httpModule.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: `/device/${ip}/query/apps`,
          method: 'GET',
          timeout: 5000
        },
        (res: import('http').IncomingMessage) => {
          let data = '';
          res.on('data', (chunk: Buffer | string) => { data += chunk; });
          res.on('end', () => {
            // Relay may wrap the xml in JSON { success, data: '<xml>...' }.
            try {
              const parsed = JSON.parse(data);
              if (parsed && typeof parsed.data === 'string') return resolve(parsed.data);
              if (parsed && typeof parsed.xml === 'string') return resolve(parsed.xml);
            } catch { /* not JSON — assume raw xml */ }
            resolve(data);
          });
        }
      );
      req.on('error', () => resolve(''));
      req.on('timeout', () => { try { req.destroy(); } catch { /* */ } resolve(''); });
      req.end();
    } catch {
      resolve('');
    }
  });
}

function deleteSideloadRemote(opts: {
  serverUrl: string;
  ip: string;
  password: string;
}): Promise<{ success: boolean; error?: string; authFailed?: boolean }> {
  return new Promise((resolve) => {
    try {
      const url = new URL(opts.serverUrl);
      const httpModule = require(url.protocol === 'https:' ? 'https' : 'http');
      const postData = JSON.stringify({ password: opts.password });
      const req = httpModule.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: `/device/${opts.ip}/delete-sideload`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 30000
        },
        (res: import('http').IncomingMessage) => {
          let data = '';
          res.on('data', (chunk: Buffer | string) => { data += chunk; });
          res.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch { resolve({ success: false, error: 'Invalid response from remote server' }); }
          });
        }
      );
      req.on('error', (err: Error) => resolve({ success: false, error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Remote delete timeout' });
      });
      req.write(postData);
      req.end();
    } catch (err) {
      resolve({ success: false, error: errMsg(err) });
    }
  });
}

/**
 * Verify the device still has our Fiddle channel installed, then delete it.
 * Returns `{ success, error?, skipped?, authFailed? }` where `skipped: true`
 * means the channel wasn't our Fiddle (so we left it alone). Never throws.
 */
async function verifyAndDeleteFiddle(
  device: Pick<FiddleDeviceSnapshotEntry, 'ip' | 'isRemote' | 'serverUrl' | 'password'>
): Promise<{ success: boolean; error?: string; skipped?: boolean; authFailed?: boolean }> {
  if (!device.password) {
    return { success: false, error: S.fiddle.errNoPasswordAvailable };
  }
  const isOurs = await isFiddleInstalled(device.ip, device.serverUrl || null);
  if (!isOurs) {
    return { success: true, skipped: true };
  }
  try {
    if (device.isRemote && device.serverUrl) {
      return await deleteSideloadRemote({
        serverUrl: device.serverUrl,
        ip: device.ip,
        password: device.password
      });
    }
    return await deleteSideload({ ip: device.ip, password: device.password });
  } catch (err) {
    return { success: false, error: errMsg(err) };
  }
}

let registered = false;

export function registerBsFiddleIpc(ipcMain: IpcMain): void {
  if (registered) return;
  registered = true;

  // Wire the window-close cleanup once. When the user closes the Fiddle
  // window while a Fiddle channel is still installed, we verify it's ours
  // and delete it automatically. `password` is the session-scoped password
  // that produced the active sideload; prefer it over the snapshot copy
  // (which may be empty if the user ran with a modal-only password).
  onFiddleWindowClosed(async ({ device, password }) => {
    if (!device) return;
    const effectivePassword = password || device.password || '';
    const result = await verifyAndDeleteFiddle({
      ip: device.ip,
      isRemote: device.isRemote,
      serverUrl: device.serverUrl || null,
      password: effectivePassword
    });
    if (result.skipped) {
      mainLog('[Fiddle] close cleanup: dev channel is not ours, leaving alone.');
    } else if (!result.success) {
      mainWarn('[Fiddle] close cleanup delete failed:', result.error);
      if (result.authFailed) {
        // The password we had stashed (session or persisted) no longer works.
        // Wipe the persisted copy so the user isn't silently locked out
        // next time; they'll be prompted fresh on their next Fiddle action.
        requestMainRendererClearPassword(device.id);
      }
    } else {
      mainLog('[Fiddle] close cleanup: fiddle channel removed from', device.ip);
    }
  });

  ipcMain.handle(IPC.FiddleLint, async (_event: IpcMainInvokeEvent, payload: { code: string }) => {
    const code = typeof payload?.code === 'string' ? payload.code : '';
    return lintCode(code);
  });

  ipcMain.handle(IPC.FiddleRun, async (event: IpcMainInvokeEvent, payload: { deviceId: string; code: string; password?: string }) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (!senderWin || senderWin.isDestroyed()) {
      return { success: false, error: S.fiddle.errWindowUnavailable };
    }
    const state = getFiddleStateByWindow(senderWin.id);
    if (!state) return { success: false, error: 'Fiddle state missing.' };

    const device = resolveDevice(String(payload?.deviceId || ''), state);
    if (!device) return { success: false, error: S.fiddle.errDeviceDisconnected };

    // Prefer the password the user just typed into the Fiddle modal (if any),
    // otherwise fall back to the snapshot's persisted password (sourced from
    // main-window localStorage). Track which path we used so an auth failure
    // against a *persisted* password wipes the stored copy, while an auth
    // failure against a fresh modal entry just gets reported back (we never
    // persisted it in the first place).
    const modalPassword = (typeof payload?.password === 'string' && payload.password.length > 0)
      ? payload.password
      : '';
    const password = modalPassword || device.password || '';
    const usedStoredPassword = !modalPassword && !!device.password;
    if (!password) {
      return {
        success: false,
        error: S.fiddle.errNoPasswordProvided,
        needsPassword: true
      };
    }

    const runId = randomRunId();
    // Clear the terminal immediately so any stale content from a previous run
    // disappears before the new one starts streaming. The renderer's
    // `suppressUntilBegin` gate then holds back new data until this run's
    // `[FIDDLE_BEGIN:<runId>]` marker arrives, so pre-install and
    // bounce-period noise never appears.
    broadcastFiddleTerminalCleared(senderWin.id);

    // Build the zipped channel. All template assets (manifest, BrightScript,
    // XML, channel icons) live under `roku-components/fiddle/` in the API
    // package — no icon paths to plumb through from the app side anymore.
    let zipPath: string;
    try {
      const built = await buildFiddleZip({
        code: payload?.code || '',
        runId
      });
      zipPath = built.zipPath;
    } catch (err) {
      return { success: false, error: S.fiddle.errPackageFailed(errMsg(err)), runId };
    }

    // Make sure a telnet stream is live for this device BEFORE sideloading.
    // For remote devices we dial the relay WebSocket (or reuse an already-
    // open one so we don't disrupt a Console session the user has going).
    // For local devices we make sure port 8085 has SOMETHING connected so the
    // channel-launch prints have a client to reach — but the authoritative
    // bounce happens AFTER the sideload HTTPS response (see post-sideload
    // block below), because Roku firmwares sometimes route BrightScript
    // prints only to whichever telnet client was bound last, and that needs
    // to be us at the exact moment `_rdsFiddle_setUpApp` runs.
    const fiddleTelnetHolder = `fiddle:${senderWin.id}`;
    if (!device.isRemote) {
      state.telnetIpsUsed.add(device.ip);
    } else if (device.serverUrl) {
      state.remoteTelnetTargetsUsed.push({ serverUrl: device.serverUrl, ip: device.ip });
    }
    if (device.isRemote) {
      if (!device.serverUrl) {
        return {
          success: false,
          error: S.fiddle.errRemoteMissingServerUrl,
          runId
        };
      }
      try {
        const tRes = await ensureRemoteTelnetConnected(device.serverUrl, device.ip, {
          holder: fiddleTelnetHolder
        });
        if (!tRes.success) {
          mainWarn('[Fiddle] Remote telnet connect failed (continuing):', tRes.error);
        }
      } catch (err) {
        mainWarn('[Fiddle] Remote telnet connect threw (continuing):', errMsg(err));
      }
    } else {
      try {
        const res = await ensureDebugTelnetConnected(device.ip, { holder: fiddleTelnetHolder });
        mainLog('[Fiddle] ensureDebugTelnetConnected (pre-sideload) →', res, 'for', device.ip);
      } catch (err) {
        mainWarn('[Fiddle] Telnet connect failed (continuing):', errMsg(err));
      }
    }

    // Sideload (local or remote).
    let sideloadRes: { success: boolean; error?: string; message?: string; authFailed?: boolean } = {
      success: false,
      error: 'unknown'
    };
    try {
      if (device.isRemote && device.serverUrl) {
        sideloadRes = await sideloadRemoteUpload({
          serverUrl: device.serverUrl,
          ip: device.ip,
          zipPath,
          password
        });
      } else {
        sideloadRes = await sideloadChannel({
          ip: device.ip,
          filePath: zipPath,
          password
        });
      }
    } catch (err) {
      sideloadRes = { success: false, error: errMsg(err) };
    } finally {
      try { fs.unlinkSync(zipPath); } catch { /* ignore */ }
    }

    // Auth-fail bookkeeping: if the Roku rejected our password, wipe any
    // persisted copy in the main renderer so the user isn't stuck re-running
    // with a stale password. We only clear localStorage when the failing
    // password actually came from storage (not when it was a one-off modal
    // entry that the user can simply retype).
    if (!sideloadRes.success && sideloadRes.authFailed && usedStoredPassword) {
      requestMainRendererClearPassword(device.id);
    }

    const runResult = {
      success: !!sideloadRes?.success,
      error: sideloadRes?.success ? undefined : sideloadRes?.error || S.fiddle.errSideloadFailed,
      authFailed: sideloadRes?.success ? false : !!sideloadRes?.authFailed,
      runId,
      deviceId: device.id
    };

    // Sideload finished. Intentionally no second terminal clear here: the
    // channel can start printing (including `[FIDDLE_BEGIN:…]`) the moment
    // the sideload HTTP POST returns, and interleaving a clear with those
    // already-queued data events can race-delete the BEGIN marker from the
    // Fiddle buffer. The pre-sideload clear already cleaned the slate and
    // the renderer's `suppressUntilBegin` gate holds back anything stale.
    if (runResult.success) {
      // Record the device id + password that produced the sideload so the
      // window-close cleanup can delete the channel even if the persisted
      // password is never written (session-only modal entry path).
      setFiddleActiveSideload(senderWin.id, device.id, password);

      // Post-sideload telnet bounce (LOCAL ONLY).
      //
      // Root cause this fixes: on some Roku firmwares port 8085 streams
      // BrightScript prints to only one telnet client at a time, and a
      // `/plugin_install` appears to unbind whichever client was connected
      // beforehand. The pre-sideload `ensureDebugTelnetConnected` keeps
      // *a* socket open so nothing fails on our side — but the client that
      // Roku's channel-launch emits into may not be ours any more. The
      // observable symptom: Fiddle terminal stuck at "Sideload complete —
      // waiting for output…" until the user manually Connects in the main
      // Console (which also destroys + reopens the socket and happens to
      // win the rebinding race).
      //
      // Fix: we force the same destroy+reconnect ourselves, right after the
      // sideload HTTPS response returns. The channel side cooperates — its
      // `source/main.brs` sleeps 500 ms between `screen.show()` and the
      // scene's `_rdsFiddle_setUpApp` call, and `_rdsFiddle_setUpApp`
      // prints `[FIDDLE_BEGIN:…]` twice with a short gap between — so by
      // the time the second (or usually even the first) BEGIN goes out,
      // our freshly bounced socket is the bound client. The host-side
      // bounce is fire-and-forget; we don't block the Fiddle IPC response
      // on it, but we do await the reconnect so subsequent logic sees a
      // live socket.
      if (!device.isRemote) {
        const ip = device.ip;
        void (async () => {
          try {
            const bounceRes = await bounceDebugTelnet(ip);
            mainLog('[Fiddle] post-sideload telnet bounce →', bounceRes, 'for', ip);
          } catch (e) {
            mainWarn('[Fiddle] post-sideload bounce threw:', errMsg(e));
          }
        })();
      }
    }

    try { senderWin.webContents.send(IPC.FiddleRunResult, runResult); } catch { /* ignore */ }

    return runResult;
  });

  ipcMain.handle(IPC.FiddleStop, async (event: IpcMainInvokeEvent, payload: { deviceId: string; password?: string }) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (!senderWin || senderWin.isDestroyed()) {
      return { success: false, error: S.fiddle.errWindowUnavailable };
    }
    const state = getFiddleStateByWindow(senderWin.id);
    const device = state ? resolveDevice(String(payload?.deviceId || ''), state) : null;
    if (!device) return { success: false, error: S.fiddle.errDeviceNotFound };

    const modalPassword = (typeof payload?.password === 'string' && payload.password.length > 0)
      ? payload.password
      : '';
    const password = modalPassword || device.password || '';
    const usedStoredPassword = !modalPassword && !!device.password;
    if (!password) {
      return { success: false, error: S.fiddle.errNoPasswordAvailable, needsPassword: true };
    }

    const result = await verifyAndDeleteFiddle({
      ip: device.ip,
      isRemote: device.isRemote,
      serverUrl: device.serverUrl || null,
      password
    });

    if (result.success) {
      // Clear the active marker + password so the window-close cleanup
      // doesn't try again on a device we've just uninstalled from.
      setFiddleActiveSideload(senderWin.id, null, null);
    }

    if (!result.success && result.authFailed && usedStoredPassword) {
      requestMainRendererClearPassword(device.id);
    }

    if (result.skipped) {
      return {
        success: false,
        error: S.fiddle.errNotFiddleChannel
      };
    }
    return { ...result, authFailed: !!result.authFailed };
  });
}

