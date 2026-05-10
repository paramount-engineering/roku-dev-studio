/**
 * Shared logic for Roku plugin_install (sideload + delete sideload).
 * Used by both the Electron main process and the remote server.
 */

const { exec } = require('child_process');
const path = require('path');
const { promisify } = require('util');
const { isValidIp, validateDevPassword } = require('./validate-input');
const { errorMessage } = require('./err-util');

const execPromise = promisify(exec);

type LogFn = (msg: string) => void;

interface SideloadChannelOpts {
  ip: string;
  filePath: string;
  password: string;
  log?: LogFn;
}

interface DeleteSideloadOpts {
  ip: string;
  password: string;
  log?: LogFn;
}

/**
 * Sideload a channel package to a Roku device.
 *
 * @param {{ ip: string, filePath: string, password: string, log?: (msg: string) => void }}
 * @returns {Promise<{ success: true, message: string } | { success: false, error: string }>}
 */
async function sideloadChannel({ ip, filePath, password, log = (_m: string) => undefined }: SideloadChannelOpts) {
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
  if (normalizedPath.includes('..')) {
    return { success: false, error: 'Invalid file path' };
  }

  const curlCmd = `curl -s -S --digest --user "rokudev:${password}" -F "mysubmit=Install" -F "archive=@${normalizedPath}" "http://${ip}/plugin_install" --connect-timeout 10 --max-time 120`;
  try {
    log('Sideload: running curl');
    const { stdout, stderr } = await execPromise(curlCmd);
    const response = stdout || stderr;

    if (response.includes('Install Success') || response.includes('Application Received') || response.includes('Conversion complete')) {
      return { success: true, message: 'Channel installed successfully!' };
    }
    if (response.includes('Install Failure')) {
      const errorMatch = response.match(/Install Failure:\s*([^<\n]+)/);
      return { success: false, error: errorMatch ? errorMatch[1].trim() : 'Installation failed' };
    }
    if (response.includes('401') || response.includes('Authentication')) {
      // `authFailed: true` is the stable contract callers use to decide whether
      // to wipe a cached developer password and re-prompt (vs. a transient
      // network/state error where the cached password is still valid).
      return { success: false, error: 'Authentication failed. Check your developer password.', authFailed: true };
    }
    if (response.includes('Roku') && !response.includes('Failure')) {
      return { success: true, message: 'Channel installed! Check your Roku device.' };
    }
    log(`Sideload: unexpected response (first 500): ${response.substring(0, 500)}`);
    return { success: false, error: 'Unknown response from device. Check your Roku to see if the channel was installed.' };
  } catch (error: unknown) {
    const msg = errorMessage(error);
    if (msg.includes('Connection refused')) {
      return { success: false, error: 'Connection refused. Make sure Developer Mode is enabled.' };
    }
    if (msg.includes('timed out')) {
      return { success: false, error: 'Connection timed out. Check the device IP address.' };
    }
    if (msg.includes('Could not resolve host')) {
      return { success: false, error: 'Could not resolve host. Check the device IP address.' };
    }
    return { success: false, error: `Upload failed: ${msg}` };
  }
}

/**
 * Delete the sideloaded channel from a Roku device.
 *
 * @param {{ ip: string, password: string, log?: (msg: string) => void }}
 * @returns {Promise<{ success: true, message: string } | { success: false, error: string }>}
 */
async function deleteSideload({ ip, password, log = (_m: string) => undefined }: DeleteSideloadOpts) {
  if (!isValidIp(ip)) {
    return { success: false, error: 'Invalid device IP address' };
  }
  const pwdCheck = validateDevPassword(password);
  if (!pwdCheck.valid) {
    return { success: false, error: pwdCheck.error || 'Invalid developer password' };
  }

  const curlCmd = `curl -s -S --digest --user "rokudev:${password}" -F "mysubmit=Delete" -F "archive=;" "http://${ip}/plugin_install" --connect-timeout 10 --max-time 30`;
  try {
    log('Delete sideload: running curl');
    const { stdout, stderr } = await execPromise(curlCmd);
    const response = stdout || stderr;

    if (response.includes('Delete Success') || (response.includes('Roku') && !response.includes('Failure'))) {
      return { success: true, message: 'Sideloaded channel deleted successfully!' };
    }
    if (response.includes('401') || response.includes('Authentication')) {
      return { success: false, error: 'Authentication failed. Check your developer password.', authFailed: true };
    }
    return { success: true, message: 'Delete command sent. Check your Roku device.' };
  } catch (error: unknown) {
    return { success: false, error: `Delete failed: ${errorMessage(error)}` };
  }
}

module.exports = { sideloadChannel, deleteSideload };
