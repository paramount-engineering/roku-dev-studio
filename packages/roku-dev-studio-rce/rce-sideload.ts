/**
 * Sideload (install/delete a dev channel) against an RCE instance's Device API. Confirmed live
 * 2026-09-12: `POST /sideload/plugin_install` returns a real `401 Digest qop="auth",
 * realm="rokudev"` challenge, and a hand-built Digest response (wrong password, to avoid needing
 * real credentials for the test) got a clean second `401` rather than a structural error — proving
 * this reaches genuine device-level Digest auth, not a routing dead end.
 *
 * **Two auth headers, not one** (per a user-shared narrative-guide page, cross-checked against the
 * live 401 above): `X-Authorization: Bearer <rceToken>` (the RCE account token — same header
 * `roku-deploy`'s reference implementation uses for every Device-API call, see `rce-socket.ts`'s
 * header) *and* classic HTTP Digest (`Authorization: Digest ...`, username `rokudev`, password =
 * the device's own dev password — the same credential a physical device's installer uses).
 *
 * Deliberately NOT a branch inside `roku-dev-studio-api/lib/plugin-install.ts`: that module's
 * `httpDigestRequest` is hardcoded to raw `http.request({host: ip, port: 80, ...})` — RCE needs
 * HTTPS to a full instance URL plus the extra `X-Authorization` header, a genuinely different
 * transport, the same reasoning `rce-ecp.ts`'s header gives for not forcing ECP into
 * `roku-dev-studio-api/ecp.ts`. This file reuses that package's transport-agnostic *pure* helpers
 * (digest math, challenge parsing, multipart body building) via its `./lib/http-digest` subpath
 * export rather than re-implementing them.
 *
 * Roku's installer always answers HTTP 200 with an HTML body, even on failure — status code alone
 * never tells you whether it worked; the body must be parsed (`parseSideloadResponse` below, the
 * same string patterns `plugin-install.ts`'s internal `parsePluginInstallResponse` checks for
 * physical devices — not reused directly since that function isn't part of that module's exported
 * surface).
 */

import { errorMessage } from 'roku-dev-studio-platform';
import { normalizeInstanceApiUrl } from './rce-ecp';

const {
  DEV_USERNAME,
  buildDigestAuthorizationHeader,
  parseDigestChallenge,
  findDigestChallengeHeader,
  buildMultipartBody,
  responseLooksLikeAuthFailure
} = require('roku-dev-studio-api/lib/http-digest');

const SIDELOAD_PATH = '/sideload/plugin_install';
const DEFAULT_TIMEOUT_MS = 120000;

export interface RceSideloadOptions {
  instanceApiUrl: string;
  /** RCE account bearer token — sent as `X-Authorization`, not the Digest credential. */
  rceToken: string;
  /** The device's own dev password (set when Developer Mode was enabled) — the Digest credential. */
  devPassword: string;
  timeoutMs?: number;
}

export interface RceSideloadResult {
  success: boolean;
  message?: string;
  error?: string;
  authFailed?: boolean;
}

function parseSideloadResponse(text: string): RceSideloadResult {
  if (text.includes('Install Success') || text.includes('Application Received') || text.includes('Conversion complete')) {
    return { success: true, message: 'Channel installed successfully!' };
  }
  if (text.includes('Delete Success')) {
    return { success: true, message: 'Sideloaded channel deleted successfully!' };
  }
  if (text.includes('Install Failure')) {
    const match = text.match(/Install Failure:\s*([^<\n]+)/);
    return { success: false, error: match ? match[1].trim() : 'Installation failed' };
  }
  // The device kept the OLD instance running — nothing relaunched (reads as a success page otherwise).
  if (isIdenticalBuild(text)) {
    return { success: false, error: 'Identical to previous version — the device did not relaunch the channel.' };
  }
  if (responseLooksLikeAuthFailure(0, text)) {
    return { success: false, error: 'Authentication failed. Check the dev password.', authFailed: true };
  }
  if (text.includes('Roku') && !text.includes('Failure')) {
    return { success: true, message: 'Channel installed! Check the device.' };
  }
  return { success: false, error: 'Unknown response from device.' };
}

/**
 * One authenticated HTTP round through the digest challenge/response dance, over HTTPS to the
 * RCE instance URL instead of `plugin-install.ts`'s hardcoded `http://ip:80`. `path` must be the
 * exact request path (e.g. `/sideload/plugin_install`, `/sideload/plugin_inspect`,
 * `/sideload/pkgs/dev.jpg?...`) — it's part of the Digest hash, not just the URL, so a mismatch
 * between the two silently produces a bad auth header instead of an obvious error.
 */
async function digestRequest(
  opts: RceSideloadOptions,
  path: string,
  options: { method: 'GET' | 'POST'; body?: Buffer; contentType?: string }
): Promise<{ statusCode: number; response: Response }> {
  const { instanceApiUrl, rceToken, devPassword, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
  const url = `https://${normalizeInstanceApiUrl(instanceApiUrl)}${path}`;
  const baseHeaders: Record<string, string> = { 'X-Authorization': `Bearer ${rceToken}` };
  const { method, body, contentType } = options;

  // Bodyless probe first to get the Digest challenge — avoids uploading a multi-MB zip on a
  // request guaranteed to 401, same reasoning `http-digest.ts` gives for physical devices.
  const controller1 = new AbortController();
  const timeout1 = setTimeout(() => controller1.abort(), timeoutMs);
  let probe: Response;
  try {
    probe = await fetch(url, { method, headers: baseHeaders, signal: controller1.signal });
  } finally {
    clearTimeout(timeout1);
  }
  if (probe.status !== 401) {
    // No auth required (unexpected, but handle gracefully) — return whatever came back.
    return { statusCode: probe.status, response: probe };
  }
  const challengeHeader = findDigestChallengeHeader(probe.headers.get('www-authenticate') ?? undefined);
  if (!challengeHeader) {
    // Drain the real body (avoids leaking the connection) but hand back a synthetic Response —
    // a `Response`'s body can only be read once, and this fixed message is more useful than
    // whatever HTML the device sent for a plain 401 with no Digest challenge.
    await probe.text().catch(() => undefined);
    return { statusCode: 401, response: new Response('Device did not offer HTTP Digest authentication.') };
  }
  const challenge = parseDigestChallenge(challengeHeader);
  const authHeader = buildDigestAuthorizationHeader({
    username: DEV_USERNAME,
    password: devPassword,
    method,
    uri: path,
    challenge
  });

  const controller2 = new AbortController();
  const timeout2 = setTimeout(() => controller2.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { ...baseHeaders, Authorization: authHeader, ...(contentType ? { 'Content-Type': contentType } : {}) },
      body,
      signal: controller2.signal
    });
    return { statusCode: res.status, response: res };
  } finally {
    clearTimeout(timeout2);
  }
}

/** Text-body convenience wrapper — every sideload/delete/verify response is HTML. */
async function digestRequestText(
  opts: RceSideloadOptions,
  path: string,
  options: { method: 'GET' | 'POST'; body?: Buffer; contentType?: string }
): Promise<{ statusCode: number; text: string }> {
  const { statusCode, response } = await digestRequest(opts, path, options);
  return { statusCode, text: await response.text() };
}

async function postPluginInstall(
  opts: RceSideloadOptions,
  fields: { name: string; value: string }[],
  files: { name: string; filename: string; data: Buffer }[]
): Promise<{ statusCode: number; text: string }> {
  const { body, contentType } = buildMultipartBody(fields, files);
  return digestRequestText(opts, SIDELOAD_PATH, {
    method: 'POST',
    body,
    contentType
  });
}

/** Non-destructive credential check — a bodyless GET, same page a browser would load, no
 *  multipart/install side effects. Mirrors `verifyDeveloperDigestAuth`'s `GET /` shape for
 *  physical devices, just against the RCE instance's sideload path (confirmed live to 401 with a
 *  real Digest challenge, same as the POST route). */
export async function rceVerifyDevAuth(opts: RceSideloadOptions): Promise<RceSideloadResult> {
  try {
    const { statusCode, response } = await digestRequest(opts, SIDELOAD_PATH, {
      method: 'GET'
    });
    await response.text().catch(() => undefined);
    if (statusCode === 401) return { success: false, error: 'Authentication failed. Check the dev password.', authFailed: true };
    if (statusCode >= 200 && statusCode < 300) return { success: true };
    return { success: false, error: `Unexpected HTTP status ${statusCode} from the device.` };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

/** Roku's "Identical to previous version -- not replacing." reply: the OLD instance keeps running. */
function isIdenticalBuild(text: string): boolean {
  return /identical to previous version/i.test(text);
}

/** Sideload a channel package to a running RCE instance — the same launch semantics as the
 *  physical-device `sideloadChannel`, minimally: a DEBUG sideload (`remoteDebug`) is always
 *  Delete+Install so the channel really relaunches with `remotedebug=1`; a plain Install that the
 *  device answers with "Identical to previous version" (it kept the old instance running — no
 *  relaunch, so no new console output and no reopened debug port) falls back to Delete+Install too.
 *  The earlier "a plain Install is enough on RCE" assumption was wrong in practice: an instance
 *  stays up across many sideloads within a session, and a channel whose previous run had a socket
 *  debugger attached keeps its print output bound to that (closed) debugger until it relaunches.
 *
 *  `remoteDebug` forwards `remotedebug=1`, the same multipart field the physical/LAN-relay
 *  sideload paths use for "Enable Debugger" — it opens the debug control port (8081) on
 *  launch, tunneled the same ports-bridge way as the telnet consoles (see `rce-socket.ts`). */
export async function rceSideload(opts: RceSideloadOptions, zipData: Buffer, filename: string, remoteDebug?: boolean): Promise<RceSideloadResult> {
  const AUTH_FAIL: RceSideloadResult = { success: false, error: 'Authentication failed. Check the dev password.', authFailed: true };
  const install = () =>
    postPluginInstall(
      opts,
      [{ name: 'mysubmit', value: 'Install' }, ...(remoteDebug ? [{ name: 'remotedebug', value: '1' }] : [])],
      [{ name: 'archive', filename, data: zipData }]
    );
  try {
    if (remoteDebug) await rceDeleteSideload(opts).catch(() => undefined); // clean launch — best-effort
    let { statusCode, text } = await install();
    if (statusCode === 401) return AUTH_FAIL;
    if (isIdenticalBuild(text)) {
      await rceDeleteSideload(opts).catch(() => undefined);
      ({ statusCode, text } = await install());
      if (statusCode === 401) return AUTH_FAIL;
    }
    return parseSideloadResponse(text);
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

/** Delete the sideloaded channel from a running RCE instance. */
export async function rceDeleteSideload(opts: RceSideloadOptions): Promise<RceSideloadResult> {
  try {
    const { statusCode, text } = await postPluginInstall(
      opts,
      [
        { name: 'mysubmit', value: 'Delete' },
        { name: 'archive', value: ';' }
      ],
      []
    );
    if (statusCode === 401) return { success: false, error: 'Authentication failed. Check the dev password.', authFailed: true };
    return parseSideloadResponse(text);
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

// ── Screenshot (design doc — ported from the reference `roku-deploy` implementation the RokuCommunity
// VS Code extension uses for RCE devices, confirmed by reading its bundled dist/) ───────────────────
//
// Same classic `plugin_inspect` dev-web-installer flow physical devices use
// (`roku-dev-studio-api/lib/screenshot.ts`), just proxied through the RCE instance's `/sideload`
// path instead of a raw `http://ip:80` — POST `mysubmit=Screenshot` to trigger the device to render
// and save a screenshot file, then GET the on-device image path the response body embeds. The
// device needs a moment to actually write the file, so the download is retried a few times, same
// as the physical-device implementation.

const SCREENSHOT_TRIGGER_PATH = '/sideload/plugin_inspect';
const SCREENSHOT_MIN_VALID_BYTES = 1000;
const SCREENSHOT_RETRY_WAIT_MS = 1500;
const SCREENSHOT_MAX_RETRIES = 4;

export interface RceScreenshotOptions extends RceSideloadOptions {
  waitAfterTriggerMs?: number;
  /** Delay between download retries when the file hasn't been written yet. Exposed mainly so
   *  tests don't have to sit through the real 1.5s default. */
  retryWaitMs?: number;
}

export interface RceScreenshotResult {
  success: boolean;
  imageBuffer?: Buffer;
  error?: string;
  authFailed?: boolean;
}

/** Binary counterpart to {@link digestRequestText} — `res.text()` would corrupt the screenshot's
 *  JPEG/PNG bytes, the same pitfall `rce-ecp.ts`'s `rceEcpFetchBinary` exists to avoid for icons. */
async function digestRequestBinary(
  opts: RceSideloadOptions,
  path: string,
  options: { method: 'GET' | 'POST'; body?: Buffer; contentType?: string }
): Promise<{ statusCode: number; buffer: Buffer }> {
  const { statusCode, response } = await digestRequest(opts, path, options);
  return { statusCode, buffer: Buffer.from(await response.arrayBuffer()) };
}

/** Capture a screenshot from a running RCE instance. A dev channel must be running (same
 *  requirement as a physical device) or the trigger response won't embed an image URL. */
export async function rceCaptureScreenshot(opts: RceScreenshotOptions): Promise<RceScreenshotResult> {
  try {
    const { body, contentType } = buildMultipartBody([{ name: 'mysubmit', value: 'Screenshot' }, { name: 'archive', value: '' }], []);
    const trigger = await digestRequestText(opts, SCREENSHOT_TRIGGER_PATH, {
      method: 'POST',
      body,
      contentType
    });
    if (trigger.statusCode === 401) {
      return { success: false, error: 'Authentication failed. Check the dev password.', authFailed: true };
    }

    // The response body embeds the on-device image path, e.g. `pkgs/dev.jpg?t=...` — same pattern
    // the reference `roku-deploy` implementation extracts (see file header).
    const match = /["'](pkgs\/dev(\.jpg|\.png)\?[^"']+)["']/i.exec(trigger.text);
    if (!match) {
      return { success: false, error: 'No screenshot URL returned from device. Make sure a sideloaded channel is running.' };
    }
    const imagePath = `/sideload/${match[1]}`;

    const downloadOnce = async (): Promise<Buffer> => {
      const download = await digestRequestBinary(opts, imagePath, { method: 'GET' });
      if (download.statusCode === 401) throw Object.assign(new Error('auth'), { authFailed: true });
      return download.buffer;
    };

    const retryWaitMs = opts.retryWaitMs ?? SCREENSHOT_RETRY_WAIT_MS;
    await new Promise((r) => setTimeout(r, opts.waitAfterTriggerMs ?? 1500));
    let imageBuffer = await downloadOnce();
    for (let attempt = 0; imageBuffer.length < SCREENSHOT_MIN_VALID_BYTES && attempt < SCREENSHOT_MAX_RETRIES; attempt++) {
      await new Promise((r) => setTimeout(r, retryWaitMs));
      imageBuffer = await downloadOnce();
    }

    if (imageBuffer.length < SCREENSHOT_MIN_VALID_BYTES) {
      return { success: false, error: 'Screenshot file is empty or invalid. Make sure a sideloaded channel is running.' };
    }
    return { success: true, imageBuffer };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && (error as { authFailed?: boolean }).authFailed) {
      return { success: false, error: 'Authentication failed. Check the dev password.', authFailed: true };
    }
    return { success: false, error: errorMessage(error) };
  }
}
