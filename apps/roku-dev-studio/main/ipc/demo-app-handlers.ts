/**
 * IPC handler for "Try Demo App" — sideload the bundled, static
 * "Roku Dev Studio Showcase" channel (`roku-components/demo/`) to a device
 * the user picks from a modal in the main window.
 *
 * Unlike BrightScript Fiddle, this channel is static (no per-run zip
 * templating, no live terminal, no window-close cleanup) — Roku
 * auto-launches a dev channel on a successful `/plugin_install`, and the
 * channel is meant to stay installed, so this handler is a single
 * build-zip → sideload → cleanup-temp-file round trip.
 */

import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import { S } from '../../shared/strings/index';
import { mainWarn } from '../log.js';
import { resolveRceDeviceBySerial, resolveRceInstanceBySerial } from '../rce-device-registry';
import { rceSideload } from 'roku-dev-studio-rce';
import { notifyDebuggerReattach } from './debugger-handlers';

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const rdsApi = require('roku-dev-studio-api');
const { buildDemoZip, sideloadChannel } = rdsApi;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export interface DemoAppLaunchPayload {
  ip: string;
  isRemote?: boolean;
  serverUrl?: string | null;
  password: string;
  remoteDebug?: boolean;
}

/** Single-attempt upload to a relay server's `/device/<ip>/sideload` — same
 * endpoint/shape as `bs-fiddle-handlers.ts`'s remote path, without its retry
 * logic (a one-off "try the demo" action doesn't need Fiddle's transient-
 * network-blip resilience; the user can just click the button again). */
function sideloadRemoteUpload(opts: {
  serverUrl: string;
  ip: string;
  zipPath: string;
  password: string;
  remoteDebug?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const fileName = path.basename(opts.zipPath);
  return new Promise((resolve) => {
    try {
      const fileBuffer = fs.readFileSync(opts.zipPath);
      const form = new FormData();
      form.append('file', fileBuffer, { filename: fileName, contentType: 'application/zip' });
      form.append('password', opts.password);
      // Same `remotedebug` field relay-server.ts checks — see bs-fiddle-handlers.ts's identical
      // comment for the convention this matches.
      if (opts.remoteDebug) form.append('remotedebug', '1');
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

let registered = false;

export function registerDemoAppIpc(ipcMain: IpcMain): void {
  if (registered) return;
  registered = true;

  ipcMain.handle(IPC.DemoAppLaunch, async (_event: IpcMainInvokeEvent, payload: DemoAppLaunchPayload) => {
    const ip = typeof payload?.ip === 'string' ? payload.ip : '';
    const password = typeof payload?.password === 'string' ? payload.password : '';
    if (!ip) return { success: false, error: S.tryDemoApp.errDeviceNotFound };
    if (!password) return { success: false, error: S.tryDemoApp.errNoPasswordAvailable };

    // RCE devices are identified by serial, not IP (`ip` already *is* the serial for RCE — see
    // normalizeRceDevice in renderer/app.ts). Resolved fresh, same as Sideload Relay/Fiddle — see
    // [[device-identity-key-rule]] / rce-device-registry.ts.
    const rceKnown = resolveRceDeviceBySerial(ip);
    const rceInstance = rceKnown ? await resolveRceInstanceBySerial(ip) : null;
    if (rceKnown && rceInstance && !rceInstance.success) {
      return { success: false, error: rceInstance.error };
    }

    let zipPath: string;
    try {
      const built = await buildDemoZip();
      zipPath = built.zipPath;
    } catch (err) {
      mainWarn('[TryDemoApp] buildDemoZip failed:', errMsg(err));
      return { success: false, error: S.tryDemoApp.errPackageFailed(errMsg(err)) };
    }

    // "Enable Debugger" — same remotedebug=1 convention Sideload Relay / the Dev App tab /
    // Fiddle use.
    const debugEnabled = !!payload.remoteDebug;

    let sideloadRes: { success: boolean; error?: string; authFailed?: boolean } = {
      success: false,
      error: 'unknown'
    };
    try {
      if (rceInstance?.success) {
        const zipData = fs.readFileSync(zipPath);
        sideloadRes = await rceSideload(
          { instanceApiUrl: rceInstance.instance.instanceApiUrl, rceToken: rceInstance.instance.token, devPassword: password },
          zipData,
          path.basename(zipPath),
          debugEnabled
        );
      } else if (payload.isRemote && payload.serverUrl) {
        sideloadRes = await sideloadRemoteUpload({
          serverUrl: payload.serverUrl,
          ip,
          zipPath,
          password,
          remoteDebug: debugEnabled
        });
      } else {
        sideloadRes = await sideloadChannel({
          ip,
          filePath: zipPath,
          password,
          // Clean Delete+Install so remotedebug=1 actually takes on relaunch (Replace can drop
          // it) — same reasoning dev-app-handlers.ts's sideload handler documents.
          cleanInstall: debugEnabled,
          ...(debugEnabled ? { extraFields: [{ name: 'remotedebug', value: '1' }] } : {})
        });
      }
    } catch (err) {
      sideloadRes = { success: false, error: errMsg(err) };
    } finally {
      try { fs.unlinkSync(zipPath); } catch { /* ignore */ }
    }

    if (!sideloadRes.success) {
      return {
        success: false,
        error: sideloadRes.error || S.tryDemoApp.errSideloadFailed,
        authFailed: !!sideloadRes.authFailed
      };
    }

    // Debug port (8081) is now open — reattach the Telnet debug sidebar to this fresh run, same
    // event the other sideload entry points fire.
    if (debugEnabled) {
      try {
        notifyDebuggerReattach(ip, payload.isRemote && payload.serverUrl ? { isRemote: true, serverUrl: payload.serverUrl } : undefined);
      } catch {
        /* best-effort */
      }
    }

    return { success: true };
  });
}
