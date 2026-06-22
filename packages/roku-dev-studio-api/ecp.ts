/**
 * Roku ECP (External Control Protocol) — single implementation for app and relay server.
 */

import type { IncomingMessage } from 'http';

const http = require('http');
const { isValidIp } = require('roku-dev-studio-platform/validation');
const { getDeviceInfo } = require('./lib/device-info');
const { getDeviceImageUrl } = require('./lib/device-hardware-image');
const { QUERY_TIMEOUT, INPUT_TEXT_KEY_DELAY_MS, INPUT_TEXT_PER_KEY_TIMEOUT_MS } = require('./lib/shared-constants');
const { errorMessage } = require('roku-dev-studio-platform');

interface EcpRequestOptions {
  path: string;
  method?: string;
  body?: string;
  headers?: Record<string, string | string[] | undefined>;
  timeout?: number;
}

interface EcpCallOpts {
  timeout?: number;
  port?: number;
  inputKeyDelayMs?: number;
  includeSameSubnet?: boolean;
  /** Reuse TCP connections across sequential ECP calls (used by `inputText`). */
  agent?: import('http').Agent;
}

function ecpErrorFromStatus(statusCode: number): { error: string; authFailed?: boolean } {
  if (statusCode === 401) {
    return { error: 'ECP access denied (401). Check Developer Mode and ECP settings on the device.', authFailed: true };
  }
  if (statusCode === 403) {
    return { error: 'ECP not allowed (403). Device may have ECP set to Disabled or Limited.', authFailed: true };
  }
  if (statusCode >= 400 && statusCode < 500) {
    return { error: `Request failed (HTTP ${statusCode}). Check device and ECP settings.` };
  }
  if (statusCode >= 500) {
    return { error: `Device error (HTTP ${statusCode}). Try again later.` };
  }
  return { error: `Unexpected response (HTTP ${statusCode}).` };
}

/**
 * Generic ECP HTTP request. Returns success: false for 4xx/5xx with user-facing error.
 * @param {string} ip
 * @param {{ path: string, method?: string, body?: string, headers?: object }} options
 * @param {{ timeout?: number, port?: number }} [opts]
 */
function ecpRequest(ip: string, options: EcpRequestOptions, opts: EcpCallOpts = {}) {
  if (!isValidIp(ip)) {
    return Promise.resolve({ success: false, error: 'Invalid device IP' });
  }
  const port = opts.port != null ? opts.port : 8060;
  const timeout = opts.timeout != null ? opts.timeout : (options.timeout != null ? options.timeout : 5000);

  return new Promise((resolve) => {
    const reqOptions: import('http').RequestOptions = {
      hostname: ip,
      port,
      path: options.path,
      method: options.method || 'GET',
      headers: options.headers || {},
      agent: opts.agent
    };

    const req = http.request(reqOptions, (res: IncomingMessage) => {
      let data = '';
      res.on('data', (chunk: string | Buffer) => {
        data += chunk.toString();
      });
      res.on('end', () => {
        const code = res.statusCode ?? 0;
        if (code >= 200 && code < 300) {
          resolve({ success: true, data, status: code, headers: res.headers });
        } else {
          const err = ecpErrorFromStatus(code);
          resolve({
            success: false,
            error: err.error,
            statusCode: res.statusCode,
            data,
            authFailed: err.authFailed
          });
        }
      });
    });

    req.on('error', (error: Error) => {
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Request timed out' });
    });

    req.setTimeout(timeout);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function keypress(ip: string, key: string, opts: EcpCallOpts = {}) {
  return ecpRequest(ip, {
    path: `/keypress/${key}`,
    method: 'POST',
    timeout: 3000
  }, { timeout: opts.timeout != null ? opts.timeout : 3000, port: opts.port });
}

function launch(ip: string, appId: string, params?: string, opts: EcpCallOpts = {}) {
  let path = `/launch/${appId}`;
  if (params) {
    path += typeof params === 'string' ? `?${params}` : '';
  }
  return ecpRequest(ip, {
    path,
    method: 'POST',
    timeout: 5000
  }, { timeout: opts.timeout != null ? opts.timeout : 5000, port: opts.port });
}

function query(ip: string, endpoint: string, opts: EcpCallOpts = {}) {
  return ecpRequest(ip, {
    path: endpoint,
    method: 'GET',
    timeout: QUERY_TIMEOUT
  }, { timeout: opts.timeout != null ? opts.timeout : QUERY_TIMEOUT, port: opts.port });
}

function post(ip: string, endpoint: string, opts: EcpCallOpts = {}) {
  return ecpRequest(ip, {
    path: endpoint,
    method: 'POST',
    timeout: 5000
  }, { timeout: opts.timeout != null ? opts.timeout : 5000, port: opts.port });
}

/**
 * Send text as sequential ECP keypresses (Lit_ per character), same as Dev App Quick Remote and
 * the remote relay server. POST /input is not used — many devices accept Lit_ reliably while
 * /input does not.
 *
 * @param {string} ip
 * @param {string} text
 * @param {{ timeout?: number, port?: number, inputKeyDelayMs?: number }} [opts]
 *   inputKeyDelayMs — pause between keys (default {@link INPUT_TEXT_KEY_DELAY_MS}); set 0 for fastest (may drop chars).
 * @returns {Promise<{ success: true, status: number, results: object[] } | { success: false, error: string, results?: object[], index?: number, statusCode?: number, authFailed?: boolean }>}
 */
async function inputText(ip: string, text: unknown, opts: EcpCallOpts = {}) {
  const str = text == null ? '' : String(text);
  if (!isValidIp(ip)) {
    return { success: false, error: 'Invalid device IP' };
  }
  if (!str) {
    return { success: true, status: 200, results: [] };
  }
  const delayMs = opts.inputKeyDelayMs != null ? opts.inputKeyDelayMs : INPUT_TEXT_KEY_DELAY_MS;
  const keyTimeout = opts.timeout != null ? opts.timeout : INPUT_TEXT_PER_KEY_TIMEOUT_MS;
  const port = opts.port;
  const results: unknown[] = [];
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
  try {
    for (const char of str) {
      const key = `Lit_${encodeURIComponent(char)}`;
      const result = await keypress(ip, key, { timeout: keyTimeout, port, agent });
      results.push(result);
      const r = result as {
        success: boolean;
        error?: string;
        statusCode?: number;
        authFailed?: boolean;
      };
      if (!r.success) {
        return {
          success: false,
          error: r.error || 'inputText failed',
          statusCode: r.statusCode,
          authFailed: r.authFailed,
          index: results.length - 1,
          results
        };
      }
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    return { success: true, status: 200, results };
  } finally {
    agent.destroy();
  }
}

function deeplink(
  ip: string,
  appId: string,
  contentId?: string,
  mediaType?: string,
  opts: EcpCallOpts = {}
) {
  let path = `/launch/${appId}`;
  const params: string[] = [];
  if (contentId) params.push(`contentID=${encodeURIComponent(contentId)}`);
  if (mediaType) params.push(`mediaType=${encodeURIComponent(mediaType)}`);
  if (params.length > 0) {
    path += `?${params.join('&')}`;
  }
  return ecpRequest(ip, {
    path,
    method: 'POST',
    timeout: 5000
  }, { timeout: opts.timeout != null ? opts.timeout : 5000, port: opts.port });
}

async function testConnection(ip: string, opts: EcpCallOpts = {}) {
  const timeout = opts.timeout != null ? opts.timeout : QUERY_TIMEOUT;
  try {
    const [deviceInfo, deviceImageUrl] = await Promise.all([
      getDeviceInfo(ip, {
        timeout,
        includeSameSubnet: opts.includeSameSubnet !== false
      }),
      getDeviceImageUrl(ip, { timeout }).catch(() => null)
    ]);
    if (deviceImageUrl) {
      deviceInfo.deviceImageUrl = deviceImageUrl;
    }
    return { success: true, deviceInfo };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) || 'Connection failed' };
  }
}

function getIcon(ip: string, appId: string, opts: EcpCallOpts = {}) {
  if (!isValidIp(ip)) {
    return Promise.resolve({ success: false, error: 'Invalid device IP' });
  }
  const port = opts.port != null ? opts.port : 8060;
  const timeout = opts.timeout != null ? opts.timeout : 5000;

  return new Promise((resolve) => {
    const reqOptions = {
      hostname: ip,
      port,
      path: `/query/icon/${appId}`,
      method: 'GET'
    };

    const req = http.request(reqOptions, (res: IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: string | Buffer) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      res.on('end', () => {
        if (res.statusCode === 200 && chunks.length > 0) {
          const buffer = Buffer.concat(chunks);
          const base64 = buffer.toString('base64');
          const mimeType = res.headers['content-type'] || 'image/png';
          const dataUrl = `data:${mimeType};base64,${base64}`;
          resolve({ success: true, dataUrl, mimeType });
        } else {
          const err = ecpErrorFromStatus(res.statusCode || 0);
          resolve({
            success: false,
            error: res.statusCode === 200 ? 'Empty icon response' : err.error,
            statusCode: res.statusCode,
            authFailed: err.authFailed
          });
        }
      });
    });

    req.on('error', (error: Error) => {
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Request timed out' });
    });

    req.setTimeout(timeout);
    req.end();
  });
}

module.exports = {
  ecpErrorFromStatus,
  ecpRequest,
  keypress,
  launch,
  query,
  post,
  inputText,
  deeplink,
  testConnection,
  getIcon
};
