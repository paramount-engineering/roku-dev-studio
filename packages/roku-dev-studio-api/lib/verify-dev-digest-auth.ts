const { isValidIp, validateDevPassword } = require('roku-dev-studio-platform/validation');
const { httpDigestRequest, mapDeviceHttpError } = require('./http-digest');

interface VerifyDeveloperDigestAuthOptions {
  ip: string;
  password: string;
}

/**
 * Check developer credentials via HTTP Digest on the device web UI (same as browser sign-in to http://device/).
 * Uses Node's HTTP client so verification works on Windows/Linux without shelling out to curl.
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

  try {
    const { statusCode: code } = await httpDigestRequest({
      ip,
      password,
      path: '/',
      method: 'GET'
    });

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
    return mapDeviceHttpError(err, 'Developer authentication check');
  }
}

module.exports = { verifyDeveloperDigestAuth };
