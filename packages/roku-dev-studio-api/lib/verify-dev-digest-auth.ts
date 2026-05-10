import type { ExecException } from 'child_process';

const { promisify } = require('util');
const { exec } = require('child_process');
const { isValidIp, validateDevPassword } = require('./validate-input');
const { errorMessage } = require('./err-util');

const execPromise = promisify(exec);

interface VerifyDeveloperDigestAuthOptions {
  ip: string;
  password: string;
}

/**
 * Check developer credentials via HTTP Digest on the device web UI (same as browser sign-in to http://device/).
 * Does not require a sideloaded channel or screenshot pipeline.
 *
 * @returns {Promise<{ success: true } | { success: false, error: string, authFailed?: boolean }>}
 */
async function verifyDeveloperDigestAuth(options: VerifyDeveloperDigestAuthOptions) {
  const { ip, password } = options;

  if (!isValidIp(ip)) {
    return { success: false, error: 'Invalid device IP address' };
  }
  const pwdCheck = validateDevPassword(password);
  if (!pwdCheck.valid) {
    return { success: false, error: pwdCheck.error || 'Invalid developer password' };
  }

  const auth = `rokudev:${password}`;
  const cmd = `curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 --digest --user "${auth}" "http://${ip}/"`;

  try {
    const { stdout } = await execPromise(cmd, {
      timeout: 30000,
      maxBuffer: 64
    });
    const code = parseInt(String(stdout).trim(), 10);

    if (code === 401) {
      return {
        success: false,
        error: 'Authentication failed. Check your developer password.',
        authFailed: true
      };
    }
    if (Number.isFinite(code) && code >= 200 && code < 300) {
      return { success: true };
    }
    if (!Number.isFinite(code) || code === 0) {
      return {
        success: false,
        error: 'Could not reach the device web server (port 80). Check the IP and network.'
      };
    }
    return {
      success: false,
      error: `Unexpected HTTP status ${code} from device web server.`
    };
  } catch (err: unknown) {
    const msg = errorMessage(err);
    const code = (err as ExecException)?.code;
    if (code === 7 || /connection refused|failed to connect|couldn't connect|Could not resolve host/i.test(msg)) {
      return {
        success: false,
        error: 'Could not reach the device web server. Check the IP and network.'
      };
    }
    return { success: false, error: `Developer authentication check failed: ${msg}` };
  }
}

module.exports = { verifyDeveloperDigestAuth };
