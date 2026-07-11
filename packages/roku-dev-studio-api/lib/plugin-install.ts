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
   * Optional extra multipart form fields sent alongside `mysubmit=Install` +
   * `archive` (e.g. a caller that wants to forward `remotedebug=1`). A general
   * capability; the Sideload Relay fan-out does not currently use it.
   */
  extraFields?: { name: string; value: string }[];
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
  log('plugin_install: posting multipart request');
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
async function sideloadChannel({ ip, filePath, password, log = (_m: string) => undefined, extraFields = [] }: SideloadChannelOpts) {
  if (!isValidIp(ip)) {
    return { success: false, error: 'Invalid device IP address' };
  }
  const pwdCheck = validateDevPassword(password);
  if (!pwdCheck.valid) {
    return { success: false, error: pwdCheck.error || 'Invalid developer password' };
  }
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

  try {
    const fileData = fs.readFileSync(normalizedPath);
    const filename = path.basename(normalizedPath);
    const { statusCode, text } = await postPluginInstall(
      ip,
      password,
      [{ name: 'mysubmit', value: 'Install' }, ...extraFields],
      [{ name: 'archive', filename, data: fileData }],
      SIDELOAD_TIMEOUT_MS,
      log
    );

    // Wrong developer password comes back as HTTP 401 — trust that over any
    // body-text heuristic, which can false-match the normal (successful) page.
    if (statusCode === 401) {
      return { success: false, error: 'Authentication failed. Check your developer password.', authFailed: true };
    }

    const parsed = parsePluginInstallResponse(text);
    if (!parsed.success) {
      log(`Sideload: unexpected response (statusCode=${statusCode}, first 500): ${text.substring(0, 500)}`);
      // The device frequently drops the connection right after a successful
      // install because it reboots into the new channel, leaving an empty or
      // unrecognized 2xx body. Don't report that as a failure — there's no
      // explicit "Install Failure" marker, and the post-install check verifies
      // the real device state. Genuine failures return a "Install Failure" body.
      const hasFailureMarker = /Install Failure|Failure/i.test(text);
      if (statusCode >= 200 && statusCode < 300 && !hasFailureMarker && !text.trim()) {
        return { success: true, message: 'Channel uploaded. Verifying on device…' };
      }
    }
    return parsed;
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
  if (!isValidIp(ip)) {
    return { success: false, error: 'Invalid device IP address' };
  }
  const pwdCheck = validateDevPassword(password);
  if (!pwdCheck.valid) {
    return { success: false, error: pwdCheck.error || 'Invalid developer password' };
  }

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

    if (statusCode === 401 || responseLooksLikeAuthFailure(statusCode, text)) {
      return { success: false, error: 'Authentication failed. Check your developer password.', authFailed: true };
    }
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
  if (!isValidIp(ip)) {
    return { success: false, error: 'Invalid device IP address' };
  }
  const pwdCheck = validateDevPassword(password);
  if (!pwdCheck.valid) {
    return { success: false, error: pwdCheck.error || 'Invalid developer password' };
  }
  try {
    const { statusCode, text } = await postPluginSwup(ip, password, 'Reboot', SWUP_TIMEOUT_MS, log);
    if (statusCode === 401 || responseLooksLikeAuthFailure(statusCode, text)) {
      return { success: false, error: 'Authentication failed. Check your developer password.', authFailed: true };
    }
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
  if (!isValidIp(ip)) {
    return { success: false, error: 'Invalid device IP address' };
  }
  const pwdCheck = validateDevPassword(password);
  if (!pwdCheck.valid) {
    return { success: false, error: pwdCheck.error || 'Invalid developer password' };
  }
  try {
    const { statusCode, text } = await postPluginSwup(ip, password, 'CheckUpdate', SWUP_TIMEOUT_MS, log);
    if (statusCode === 401 || responseLooksLikeAuthFailure(statusCode, text)) {
      return { success: false, error: 'Authentication failed. Check your developer password.', authFailed: true };
    }
    return { success: true, message: 'Asked the device to check for software updates.' };
  } catch (error: unknown) {
    return mapDeviceHttpError(error, 'Check for updates');
  }
}

module.exports = { sideloadChannel, deleteSideload, rebootDevice, checkForUpdate };
