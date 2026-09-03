/**
 * Roku UPnP device description (GET / on port 8060) exposes iconList with a relative image URL.
 * Used for device hardware thumbnails in the desktop UI and relay proxy.
 */

'use strict';

const http = require('http');
const { isValidIp } = require('roku-dev-studio-platform/validation');
const { QUERY_TIMEOUT } = require('./shared-constants');
const { errorMessage } = require('roku-dev-studio-platform');

const ICON_LIST_BLOCK_RE = /<iconList>\s*([\s\S]*?)<\/iconList>/i;
const FIRST_URL_IN_BLOCK_RE = /<url>\s*([^<]+?)\s*<\/url>/i;

const DEFAULT_FALLBACK_PATH = 'device-image.png';

/**
 * @param {string} raw
 * @returns {string|null} safe relative path segments (no .., no absolute URLs)
 */
function normalizeIconRelativePath(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || t.includes('..')) return null;
  if (/^https?:\/\//i.test(t)) return null;
  return t.replace(/^\/+/, '');
}

/**
 * @param {string} xml
 * @returns {string|null}
 */
function parseUpnpDeviceImagePath(xml) {
  if (!xml || typeof xml !== 'string') return null;
  const block = xml.match(ICON_LIST_BLOCK_RE);
  if (!block) return null;
  const urlMatch = block[1].match(FIRST_URL_IN_BLOCK_RE);
  if (!urlMatch) return null;
  return normalizeIconRelativePath(urlMatch[1]);
}

/**
 * @param {string} rel
 * @returns {string}
 */
function encodeImagePathForUrl(rel) {
  const safe = rel || DEFAULT_FALLBACK_PATH;
  return safe
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/**
 * @param {string} ip
 * @param {number} port
 * @param {string} path
 * @param {number} timeout
 * @returns {Promise<string>}
 */
function httpGetText(ip, port, path, timeout) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: ip,
        port,
        path,
        method: 'GET',
        timeout
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200 && data) resolve(data);
          else reject(new Error('Bad status or empty body'));
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

/**
 * @param {string} ip
 * @param {number} port
 * @param {string} path
 * @param {number} timeout
 * @returns {Promise<{ statusCode: number, buffer: Buffer, contentType?: string }>}
 */
function httpGetBuffer(
  ip: string,
  port: number,
  path: string,
  timeout: number
): Promise<{ statusCode: number; buffer: Buffer; contentType?: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: ip,
        port,
        path,
        method: 'GET',
        timeout
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            buffer: Buffer.concat(chunks),
            contentType: res.headers['content-type']
          });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

/**
 * Resolve relative image path: UPnP root XML, else default filename.
 * @param {string} ip
 * @param {number} port
 * @param {number} timeout
 * @returns {Promise<string>}
 */
async function resolveDeviceImageRelativePath(ip, port, timeout) {
  try {
    const xml = await httpGetText(ip, port, '/', timeout);
    const parsed = parseUpnpDeviceImagePath(xml);
    if (parsed) return parsed;
  } catch (_) {
    /* use fallback */
  }
  return DEFAULT_FALLBACK_PATH;
}

/**
 * Absolute URL for <img src> (local LAN devices).
 * @param {string} ip
 * @param {{ port?: number, timeout?: number }} [opts]
 * @returns {Promise<string|null>}
 */
function getDeviceImageUrl(ip: string, opts: { port?: number; timeout?: number } = {}) {
  if (!isValidIp(ip)) return Promise.resolve(null);
  const port = opts.port != null ? opts.port : 8060;
  const timeout = opts.timeout != null ? opts.timeout : QUERY_TIMEOUT;
  return resolveDeviceImageRelativePath(ip, port, timeout).then((rel) => {
    const enc = encodeImagePathForUrl(rel);
    return `http://${ip}:${port}/${enc}`;
  });
}

/**
 * Fetch PNG (or other) bytes from the Roku — for relay HTTP proxy.
 * @param {string} ip
 * @param {{ port?: number, rootTimeout?: number, imageTimeout?: number }} [opts]
 * @returns {Promise<{ success: true, buffer: Buffer, contentType: string } | { success: false, error: string, statusCode?: number }>}
 */
async function fetchDeviceHardwareImage(
  ip: string,
  opts: { port?: number; rootTimeout?: number; imageTimeout?: number } = {}
) {
  if (!isValidIp(ip)) {
    return { success: false, error: 'Invalid device IP' };
  }
  const port = opts.port != null ? opts.port : 8060;
  const rootTimeout = opts.rootTimeout != null ? opts.rootTimeout : QUERY_TIMEOUT;
  const imageTimeout = opts.imageTimeout != null ? opts.imageTimeout : 8000;

  let rel;
  try {
    rel = await resolveDeviceImageRelativePath(ip, port, rootTimeout);
  } catch (e: unknown) {
    return { success: false, error: errorMessage(e) || 'Failed to resolve image path' };
  }

  const path = '/' + encodeImagePathForUrl(rel);
  try {
    const { statusCode, buffer, contentType } = await httpGetBuffer(
      ip,
      port,
      path,
      imageTimeout
    );
    if (statusCode === 200 && buffer.length > 0) {
      return {
        success: true,
        buffer,
        contentType: (contentType && String(contentType).split(';')[0].trim()) || 'image/png'
      };
    }
    return {
      success: false,
      error: statusCode === 200 ? 'Empty image' : `HTTP ${statusCode}`,
      statusCode: statusCode || 502
    };
  } catch (e: unknown) {
    return { success: false, error: errorMessage(e) || 'Image request failed' };
  }
}

/**
 * Fetch the hardware image and return it as a data: URL — for the desktop app's own renderer.
 * The renderer can't fetch `http://<lan-ip>:8060/...` directly with a plain <img src>: that's a
 * cross-process request from Chromium's sandboxed renderer to an arbitrary LAN address, which can
 * be silently blocked (net::ERR_ADDRESS_UNREACHABLE) in some environments even though the exact
 * same host is reachable fine from Node's http module in the main process (which is how every
 * other device operation — ECP, telnet, the debugger — already works). Routing the fetch through
 * here and handing the renderer a data: URL sidesteps that entirely, matching `getIcon`'s
 * existing convention in ecp.ts.
 * @param {string} ip
 * @param {{ port?: number, rootTimeout?: number, imageTimeout?: number }} [opts]
 * @returns {Promise<{ success: true, dataUrl: string } | { success: false, error: string, statusCode?: number }>}
 */
async function getDeviceHardwareImage(
  ip: string,
  opts: { port?: number; rootTimeout?: number; imageTimeout?: number } = {}
) {
  const result = await fetchDeviceHardwareImage(ip, opts);
  if (!result.success || !result.buffer) {
    return { success: false, error: (result as { error?: string }).error || 'Failed to fetch device image' };
  }
  const dataUrl = `data:${result.contentType || 'image/png'};base64,${result.buffer.toString('base64')}`;
  return { success: true, dataUrl };
}

module.exports = {
  parseUpnpDeviceImagePath,
  getDeviceImageUrl,
  fetchDeviceHardwareImage,
  getDeviceHardwareImage
};
