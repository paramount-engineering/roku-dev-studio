/**
 * Shared logic for Roku plugin_install (sideload + delete sideload).
 * Used by both the Electron main process and the remote server.
 */

const fs = require('fs');
const path = require('path');
const { isValidIp, validateDevPassword } = require('./validate-input');
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
}

interface DeleteSideloadOpts {
  ip: string;
  password: string;
  log?: LogFn;
}

const SIDELOAD_TIMEOUT_MS = 120000;
const DELETE_TIMEOUT_MS = 30000;

function parsePluginInstallResponse(response: string): { success: true; message: string } | { success: false; error: string; authFailed?: boolean } {
  if (response.includes('Install Success') || response.includes('Application Received') || response.includes('Conversion complete')) {
    return { success: true, message: 'Channel installed successfully!' };
  }
  if (response.includes('Install Failure')) {
    const errorMatch = response.match(/Install Failure:\s*([^<\n]+)/);
    return { success: false, error: errorMatch ? errorMatch[1].trim() : 'Installation failed' };
  }
  if (response.includes('Delete Success') || (response.includes('Roku') && !response.includes('Failure'))) {
    return { success: true, message: 'Sideloaded channel deleted successfully!' };
  }
  if (responseLooksLikeAuthFailure(0, response)) {
    return { success: false, error: 'Authentication failed. Check your developer password.', authFailed: true };
  }
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
  if (!fs.existsSync(normalizedPath)) {
    return { success: false, error: 'File not found' };
  }

  try {
    const fileData = fs.readFileSync(normalizedPath);
    const filename = path.basename(normalizedPath);
    const { statusCode, text } = await postPluginInstall(
      ip,
      password,
      [{ name: 'mysubmit', value: 'Install' }],
      [{ name: 'archive', filename, data: fileData }],
      SIDELOAD_TIMEOUT_MS,
      log
    );

    if (statusCode === 401 || responseLooksLikeAuthFailure(statusCode, text)) {
      return { success: false, error: 'Authentication failed. Check your developer password.', authFailed: true };
    }

    const parsed = parsePluginInstallResponse(text);
    if (!parsed.success) {
      log(`Sideload: unexpected response (first 500): ${text.substring(0, 500)}`);
    }
    return parsed;
  } catch (error: unknown) {
    const mapped = mapDeviceHttpError(error, 'Upload');
    if (mapped.error.includes('Connection refused')) {
      return { success: false, error: 'Connection refused. Make sure Developer Mode is enabled.' };
    }
    if (mapped.error.includes('timed out')) {
      return { success: false, error: 'Connection timed out. Check the device IP address.' };
    }
    return mapped;
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

module.exports = { sideloadChannel, deleteSideload };
