/**
 * Shared logic for Roku plugin_install (sideload + delete sideload).
 * Used by both the Electron main process and the remote server.
 */

const fs = require('fs');
const path = require('path');
const { isValidIp, validateDevPassword } = require('roku-dev-studio-platform/validation');
const {
  buildMultipartBody,
  httpDigestRequest,
  mapDeviceHttpError,
  responseLooksLikeAuthFailure
} = require('./http-digest');

type LogFn = (msg: string) => void;

interface SideloadChannelOpts {
  ip: string;
  filePath: string;
  password: string;
  log?: LogFn;
  /**
   * Optional extra multipart form fields sent alongside `mysubmit` + `archive`
   * (e.g. `remotedebug=1`). The Dev App sideload and the Sideload Relay fan-out
   * both forward this for "Sideload with Debugging" devices. Carried through every
   * attempt (Replace, Install, and the Delete+Install force-reload) so a debug
   * sideload keeps opening port 8081 on whichever path lands.
   */
  extraFields?: { name: string; value: string }[];
  /**
   * Force a clean Delete+Install launch instead of the Replace fast-path. Required
   * for DEBUG sideloads: some firmware (seen on Roku OS 15.x) reloads a running
   * channel on `mysubmit=Replace` WITHOUT re-applying `remotedebug=1`, so the socket
   * debugger never opens port 8081 and STOPs fall into the 8085 micro-debugger. A
   * fresh Delete+Install always relaunches with the debug flag honored.
   */
  cleanInstall?: boolean;
}

interface DeleteSideloadOpts {
  ip: string;
  password: string;
  log?: LogFn;
}

interface DevPortalOpts {
  ip: string;
  password: string;
  log?: LogFn;
}

const SIDELOAD_TIMEOUT_MS = 120000;
const DELETE_TIMEOUT_MS = 30000;
const SWUP_TIMEOUT_MS = 30000;

type DevRequestError = { success: false; error: string };

/**
 * Shared entry guard for every dev-portal request (sideload / delete / reboot /
 * check-update): the device IP must be valid and a developer password present
 * and well-formed. Returns an error result to hand straight back to the caller,
 * or `null` when the request may proceed.
 */
function validateDevRequest(ip: string, password: string): DevRequestError | null {
  if (!isValidIp(ip)) {
    return { success: false, error: 'Invalid device IP address' };
  }
  const pwdCheck = validateDevPassword(password);
  if (!pwdCheck.valid) {
    return { success: false, error: pwdCheck.error || 'Invalid developer password' };
  }
  return null;
}

/**
 * Detect the dev portal's "wrong developer password" response (HTTP 401 or a
 * login page in the body) and return the shared auth-failure result, else null.
 */
function authFailureResult(statusCode: number, text: string): (DevRequestError & { authFailed: true }) | null {
  if (statusCode === 401 || responseLooksLikeAuthFailure(statusCode, text)) {
    return { success: false, error: 'Authentication failed. Check your developer password.', authFailed: true };
  }
  return null;
}

function parsePluginInstallResponse(response: string): { success: true; message: string } | { success: false; error: string; authFailed?: boolean } {
  if (response.includes('Install Success') || response.includes('Application Received') || response.includes('Conversion complete')) {
    return { success: true, message: 'Channel installed successfully!' };
  }
  if (response.includes('Install Failure')) {
    const errorMatch = response.match(/Install Failure:\s*([^<\n]+)/);
    return { success: false, error: errorMatch ? errorMatch[1].trim() : 'Installation failed' };
  }
  if (responseLooksLikeAuthFailure(0, response)) {
    return { success: false, error: 'Authentication failed. Check your developer password.', authFailed: true };
  }
  // Install-only parser (deleteSideload parses its own response). A generic success
  // page ("Roku" present, no "Failure") means the install landed — this used to be
  // shadowed by a misplaced delete-success branch that mislabeled installs as deletes.
  if (response.includes('Roku') && !response.includes('Failure')) {
    return { success: true, message: 'Channel installed! Check your Roku device.' };
  }
  return { success: false, error: 'Unknown response from device. Check your Roku to see if the channel was installed.' };
}

async function postPluginInstall(
  ip: string,
  password: string,
  fields: { name: string; value: string }[],
  files: { name: string; filename: string; data: Buffer }[],
  timeoutMs: number,
  log: LogFn
): Promise<{ statusCode: number; text: string }> {
  const { body, contentType } = buildMultipartBody(fields, files);
  // Log the small text fields (mysubmit, remotedebug, …) — NOT the file — so the log
  // shows exactly what launch flags went to the device (e.g. `mysubmit=Install remotedebug=1`).
  log(`plugin_install: posting ${fields.map((f) => `${f.name}=${f.value}`).join(' ')}${files.length ? ` + ${files.length} file(s)` : ''}`);
  const { statusCode, body: responseBody } = await httpDigestRequest({
    ip,
    password,
    path: '/plugin_install',
    method: 'POST',
    body,
    headers: { 'Content-Type': contentType },
    timeoutMs
  });
  return { statusCode, text: responseBody.toString('utf8') };
}

/**
 * Sideload a channel package to a Roku device.
 */
async function sideloadChannel({ ip, filePath, password, log = (_m: string) => undefined, extraFields = [], cleanInstall = false }: SideloadChannelOpts) {
  const guard = validateDevRequest(ip, password);
  if (guard) return guard;
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return { success: false, error: 'File path is required' };
  }
  const normalizedPath = path.normalize(filePath.trim());
  // Reject only actual `..` path segments, not directory names that merely contain
  // ".." (e.g. `/Users/x/my..app/chan.zip`). After normalize, a legit path has no
  // standalone `..` segment, so this catches traversal without false-positives.
  if (normalizedPath.split(path.sep).includes('..')) {
    return { success: false, error: 'Invalid file path' };
  }
  if (!fs.existsSync(normalizedPath)) {
    return { success: false, error: 'File not found' };
  }

  const AUTH_FAIL = { success: false, error: 'Authentication failed. Check your developer password.', authFailed: true };
  // Roku refuses to Replace a byte-identical build — it keeps the running instance
  // and returns "Identical to previous version -- not replacing." (reads as success
  // in the body, but nothing actually reloaded: the "didn't reload" symptom).
  const isIdentical = (t: string) => /identical to previous version/i.test(t);
  // An explicit device-side failure (compile error / install failure). When we see
  // this we must NOT fall back to Delete+Install — that would wipe the working
  // channel and then fail to install the broken build.
  const isFailureBody = (t: string) => /Install Failure|Failure/i.test(t);

  try {
    const fileData = fs.readFileSync(normalizedPath);
    const filename = path.basename(normalizedPath);
    const files = [{ name: 'archive', filename, data: fileData }];
    const postWith = (submit: string) =>
      postPluginInstall(ip, password, [{ name: 'mysubmit', value: submit }, ...extraFields], files, SIDELOAD_TIMEOUT_MS, log);
    const postDelete = () =>
      postPluginInstall(ip, password, [{ name: 'mysubmit', value: 'Delete' }, { name: 'archive', value: ';' }], [], DELETE_TIMEOUT_MS, log);

    // One place to see EXACTLY what the device replied. Success stays terse (one
    // line, no body) — only something unexpected (failure, auth issue, an
    // "identical build" no-op, an unrecognized body) dumps the full body
    // (whitespace-collapsed, truncated so a full HTML page can't flood the log).
    // That's when a re-sideload "doesn't reload" bug is actually diagnosable from it.
    const logResp = (tag: string, sc: number, t: string, ok: boolean) => {
      if (ok) log(`Sideload[${tag}]: status=${sc} ok`);
      else log(`Sideload[${tag}]: status=${sc} body=${JSON.stringify(t.replace(/\s+/g, ' ').trim().slice(0, 800))}`);
    };

    // The clean reload the user does by hand ("delete the app, then sideload").
    // Roku keeps the old instance on an identical Replace, and some firmware won't
    // relaunch a running channel on Replace at all — Delete+Install always relaunches.
    const deleteThenInstall = async (why: string) => {
      log(`Sideload: ${why} — forcing a clean reload (Delete then Install).`);
      try {
        const del = await postDelete();
        logResp('Delete', del.statusCode, del.text, del.statusCode >= 200 && del.statusCode < 300);
      } catch (e) {
        log(`Sideload: Delete before reinstall failed (continuing to Install): ${e instanceof Error ? e.message : String(e)}`);
      }
      const inst = await postWith('Install');
      if (inst.statusCode === 401) {
        logResp('Install(after Delete)', inst.statusCode, inst.text, false);
        return AUTH_FAIL;
      }
      const p = parsePluginInstallResponse(inst.text);
      const emptyOk = inst.statusCode >= 200 && inst.statusCode < 300 && !isFailureBody(inst.text) && !inst.text.trim();
      logResp('Install(after Delete)', inst.statusCode, inst.text, p.success || emptyOk);
      if (p.success) return { success: true, message: 'Channel reloaded on the device.' };
      if (emptyOk) return { success: true, message: 'Channel reloaded. Verifying on device…' };
      return p;
    };

    // 0) Debug sideloads: skip the Replace fast-path entirely. `Replace` can reload a
    //    running channel WITHOUT re-launching it in debug mode (remotedebug=1 lost →
    //    STOPs hit the 8085 micro-debugger, port 8081 never opens). A clean
    //    Delete+Install always relaunches with the debug flag honored.
    if (cleanInstall) {
      return await deleteThenInstall('debug sideload — forcing a clean launch so remotedebug=1 is honored');
    }

    // 1) Replace first — atomic, and reloads the channel on current firmware.
    let { statusCode, text } = await postWith('Replace');
    if (statusCode === 401) {
      logResp('Replace', statusCode, text, false);
      return AUTH_FAIL;
    }

    // 2) "Identical -- not replacing": the device changed nothing and kept the OLD
    //    instance running. That's the "didn't reload" case — force a real reload
    //    instead of reporting the misleading success body.
    const replaceIdentical = isIdentical(text);
    let parsed = parsePluginInstallResponse(text);
    logResp('Replace', statusCode, text, !replaceIdentical && parsed.success);
    if (replaceIdentical) return await deleteThenInstall('device reported an identical build');

    // 3) Replace returned something we don't recognize (older firmware) — retry Install.
    if (!parsed.success && !parsed.authFailed && !isFailureBody(text)) {
      const retry = await postWith('Install');
      if (retry.statusCode === 401) {
        logResp('Install', retry.statusCode, retry.text, false);
        return AUTH_FAIL;
      }
      const retryIdentical = isIdentical(retry.text);
      const retryParsed = parsePluginInstallResponse(retry.text);
      logResp('Install', retry.statusCode, retry.text, !retryIdentical && retryParsed.success);
      statusCode = retry.statusCode;
      text = retry.text;
      if (retryIdentical) return await deleteThenInstall('device reported an identical build');
      parsed = retryParsed;
    }

    if (parsed.success) return parsed;

    // 4) The device frequently drops the connection right after a successful install
    //    (it reboots into the new channel), leaving an empty 2xx body — treat as success.
    if (statusCode >= 200 && statusCode < 300 && !isFailureBody(text) && !text.trim()) {
      return { success: true, message: 'Channel uploaded. Verifying on device…' };
    }

    // 5) A genuine device-reported failure (compile/install error) — surface it as-is;
    //    do NOT delete the working channel.
    if (isFailureBody(text)) {
      log(`Sideload: device reported a failure (status=${statusCode}).`);
      return parsed;
    }

    // 6) Last resort: neither Replace nor Install clearly landed and it isn't an
    //    explicit failure. Do the reliable Delete+Install the user falls back to by
    //    hand rather than surfacing a confusing "unknown response."
    return await deleteThenInstall('Replace and Install did not clearly succeed');
  } catch (error: unknown) {
    // Branch on the original error code/message — `mapDeviceHttpError` collapses
    // these into a single generic string, so matching its output for
    // "Connection refused" / "timed out" would never hit (the cause of the
    // misdiagnosed sideload failures after the curl → native-HTTP migration).
    const code = (error as NodeJS.ErrnoException)?.code;
    const rawMsg = error instanceof Error ? error.message : String(error);
    if (code === 'ECONNREFUSED' || /connection refused/i.test(rawMsg)) {
      return { success: false, error: 'Connection refused. Make sure Developer Mode is enabled.' };
    }
    if (code === 'ETIMEDOUT' || /timed out|timeout/i.test(rawMsg)) {
      return { success: false, error: 'Connection timed out. Check the device IP address.' };
    }
    return mapDeviceHttpError(error, 'Upload');
  }
}

/**
 * Delete the sideloaded channel from a Roku device.
 */
async function deleteSideload({ ip, password, log = (_m: string) => undefined }: DeleteSideloadOpts) {
  const guard = validateDevRequest(ip, password);
  if (guard) return guard;

  try {
    const { statusCode, text } = await postPluginInstall(
      ip,
      password,
      [
        { name: 'mysubmit', value: 'Delete' },
        { name: 'archive', value: ';' }
      ],
      [],
      DELETE_TIMEOUT_MS,
      log
    );

    const authFail = authFailureResult(statusCode, text);
    if (authFail) return authFail;
    if (text.includes('Delete Success') || (text.includes('Roku') && !text.includes('Failure'))) {
      return { success: true, message: 'Sideloaded channel deleted successfully!' };
    }
    return { success: true, message: 'Delete command sent. Check your Roku device.' };
  } catch (error: unknown) {
    return mapDeviceHttpError(error, 'Delete');
  }
}

/**
 * POST to the device's Developer Application Installer "software update" page
 * (`/plugin_swup`). Reboot and Check-for-updates are the same request with a
 * different `mysubmit` value + an empty `archive` field — this mirrors what the
 * RokuCommunity `roku-deploy` tooling (used by the BrightScript VS Code
 * extension) does for its "Restart Device" / "Check for updates" commands.
 */
async function postPluginSwup(
  ip: string,
  password: string,
  submit: string,
  timeoutMs: number,
  log: LogFn
): Promise<{ statusCode: number; text: string }> {
  const { body, contentType } = buildMultipartBody(
    [
      { name: 'mysubmit', value: submit },
      { name: 'archive', value: '' }
    ],
    []
  );
  log(`plugin_swup: posting mysubmit=${submit}`);
  const { statusCode, body: responseBody } = await httpDigestRequest({
    ip,
    password,
    path: '/plugin_swup',
    method: 'POST',
    body,
    headers: { 'Content-Type': contentType },
    timeoutMs
  });
  return { statusCode, text: responseBody.toString('utf8') };
}

/**
 * Reboot a Roku device via the Developer Application Installer (requires the
 * developer password / Developer Mode).
 */
async function rebootDevice({ ip, password, log = (_m: string) => undefined }: DevPortalOpts) {
  const guard = validateDevRequest(ip, password);
  if (guard) return guard;
  try {
    const { statusCode, text } = await postPluginSwup(ip, password, 'Reboot', SWUP_TIMEOUT_MS, log);
    const authFail = authFailureResult(statusCode, text);
    if (authFail) return authFail;
    return { success: true, message: 'Restart command sent — the device is rebooting.' };
  } catch (error: unknown) {
    // Rebooting frequently kills the socket before the response is fully read;
    // a dropped connection here means the command reached the device, so treat
    // it as success rather than an error.
    const code = (error as NodeJS.ErrnoException)?.code;
    const rawMsg = error instanceof Error ? error.message : String(error);
    if (code === 'ECONNRESET' || code === 'ECONNABORTED' || /socket hang up|ECONNRESET/i.test(rawMsg)) {
      return { success: true, message: 'Restart command sent — the device is rebooting.' };
    }
    return mapDeviceHttpError(error, 'Restart');
  }
}

/**
 * Ask a Roku device to check for a software update via the Developer
 * Application Installer (requires the developer password / Developer Mode).
 */
async function checkForUpdate({ ip, password, log = (_m: string) => undefined }: DevPortalOpts) {
  const guard = validateDevRequest(ip, password);
  if (guard) return guard;
  try {
    const { statusCode, text } = await postPluginSwup(ip, password, 'CheckUpdate', SWUP_TIMEOUT_MS, log);
    const authFail = authFailureResult(statusCode, text);
    if (authFail) return authFail;
    return { success: true, message: 'Asked the device to check for software updates.' };
  } catch (error: unknown) {
    return mapDeviceHttpError(error, 'Check for updates');
  }
}

module.exports = { sideloadChannel, deleteSideload, rebootDevice, checkForUpdate };
