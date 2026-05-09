/**
 * HTTP client for Roku Dev Studio Remote Relay Server (same API surface as direct ECP where applicable).
 */

'use strict';

import type { IncomingMessage } from 'http';

const { DEFAULT_RALE_PORT, QUERY_TIMEOUT } = require('./lib/shared-constants');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

/** Parsed JSON from relay (shape varies by endpoint). */
type RelayJson = Record<string, unknown>;

interface MultipartField {
  name: string;
  value: string | Buffer;
  filename?: string;
  contentType?: string;
}

interface CreateRelayClientOptions {
  baseUrl: string;
  timeout?: number;
  uploadTimeout?: number;
}

/**
 * @param {string} baseUrl
 * @returns {string} normalized base without trailing slash
 */
function validateRelayBaseUrl(baseUrl: unknown): string {
  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('baseUrl is required');
  }
  let u;
  try {
    u = new URL(baseUrl);
  } catch {
    throw new Error('Invalid baseUrl');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('baseUrl must use http or https');
  }
  return baseUrl.replace(/\/$/, '');
}

function relayRequest(
  base: string,
  method: string,
  pathname: string,
  bodyObj: unknown,
  timeout: number
): Promise<RelayJson> {
  return new Promise((resolve, reject) => {
    const u = new URL(pathname, base + '/');
    const lib = u.protocol === 'https:' ? https : http;
    const bodyStr = bodyObj != null ? JSON.stringify(bodyObj) : null;
    const port = u.port ? parseInt(u.port, 10) : (u.protocol === 'https:' ? 443 : 80);
    const opts = {
      hostname: u.hostname,
      port,
      path: u.pathname + u.search,
      method,
      headers: bodyStr
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr, 'utf8') }
        : {}
    };

    const req = lib.request(opts, (res: IncomingMessage) => {
      let data = '';
      res.on('data', (c: string | Buffer) => {
        data += c.toString();
      });
      res.on('end', () => {
        try {
          const json = (data ? JSON.parse(data) : {}) as RelayJson;
          resolve(json);
        } catch {
          resolve({ success: false, error: data || 'Invalid JSON from relay' });
        }
      });
    });

    req.on('error', (err: Error) => {
      reject(err);
    });

    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Build a multipart/form-data body from field entries (no external deps).
 * @param {string} boundary
 * @param {{ name: string, value: string | Buffer, filename?: string, contentType?: string }[]} fields
 * @returns {Buffer}
 */
function buildMultipartBody(boundary: string, fields: MultipartField[]): Buffer {
  const parts: Buffer[] = [];
  for (const f of fields) {
    let header = `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"`;
    if (f.filename) header += `; filename="${f.filename}"`;
    header += '\r\n';
    if (f.contentType) header += `Content-Type: ${f.contentType}\r\n`;
    header += '\r\n';
    parts.push(Buffer.from(header, 'utf8'));
    parts.push(Buffer.isBuffer(f.value) ? f.value : Buffer.from(String(f.value), 'utf8'));
    parts.push(Buffer.from('\r\n', 'utf8'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  return Buffer.concat(parts);
}

/**
 * Send a multipart/form-data POST to the relay server.
 * @param {string} base  normalized relay base URL
 * @param {string} pathname  request path (e.g. /device/:ip/sideload)
 * @param {{ name: string, value: string | Buffer, filename?: string, contentType?: string }[]} fields
 * @param {number} timeout  ms
 * @returns {Promise<object>}
 */
function relayMultipartRequest(
  base: string,
  pathname: string,
  fields: MultipartField[],
  timeout: number
): Promise<RelayJson> {
  return new Promise((resolve, reject) => {
    const boundary = `----RokuDevStudio${crypto.randomBytes(16).toString('hex')}`;
    const body = buildMultipartBody(boundary, fields);
    const u = new URL(pathname, base + '/');
    const lib = u.protocol === 'https:' ? https : http;
    const port = u.port ? parseInt(u.port, 10) : (u.protocol === 'https:' ? 443 : 80);
    const opts = {
      hostname: u.hostname,
      port,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    };

    const req = lib.request(opts, (res: IncomingMessage) => {
      let data = '';
      res.on('data', (c: string | Buffer) => {
        data += c.toString();
      });
      res.on('end', () => {
        try {
          resolve((data ? JSON.parse(data) : {}) as RelayJson);
        } catch {
          resolve({ success: false, error: data || 'Invalid JSON from relay' });
        }
      });
    });

    req.on('error', (err: Error) => reject(err));

    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.write(body);
    req.end();
  });
}

/**
 * @param {{ baseUrl: string, timeout?: number, uploadTimeout?: number }} options
 */
function createRelayClient({
  baseUrl,
  timeout = QUERY_TIMEOUT,
  uploadTimeout = 180000
}: CreateRelayClientOptions) {
  const base = validateRelayBaseUrl(baseUrl);
  const enc = encodeURIComponent;

  return {
    discover() {
      return relayRequest(base, 'GET', '/devices', null, timeout).then((body) => {
        if (body && body.success === true && Array.isArray(body.devices)) return body.devices;
        if (Array.isArray(body.devices)) return body.devices;
        return [];
      });
    },

    getDeviceInfo(deviceIp: string) {
      return relayRequest(base, 'GET', `/device/${enc(deviceIp)}/info`, null, timeout).then((body) => {
        if (body && body.success === true && body.deviceInfo != null) return body.deviceInfo;
        throw new Error((typeof body.error === 'string' && body.error) || 'Failed to get device info');
      });
    },

    keypress(deviceIp: string, key: string) {
      return relayRequest(base, 'POST', `/device/${enc(deviceIp)}/keypress/${enc(key)}`, null, timeout);
    },

    launch(deviceIp: string, appId: string, launchOpts: string | { params?: string } = {}) {
      const params = typeof launchOpts === 'string' ? launchOpts : launchOpts.params;
      const body = params ? { params } : {};
      return relayRequest(base, 'POST', `/device/${enc(deviceIp)}/launch/${enc(appId)}`, body, timeout);
    },

    query(deviceIp: string, endpoint: string) {
      const e = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      return relayRequest(base, 'GET', `/device/${enc(deviceIp)}${e}`, null, timeout);
    },

    post(deviceIp: string, endpoint: string) {
      const e = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      return relayRequest(base, 'POST', `/device/${enc(deviceIp)}/post${e}`, null, timeout);
    },

    inputText(deviceIp: string, text: string) {
      return relayRequest(base, 'POST', `/device/${enc(deviceIp)}/input-text`, { text }, timeout);
    },

    deeplink(deviceIp: string, appId: string, contentId: string, mediaType: string) {
      return relayRequest(
        base,
        'POST',
        `/device/${enc(deviceIp)}/deeplink`,
        { appId, contentId, mediaType },
        timeout
      );
    },

    getIcon(deviceIp: string, appId: string) {
      return relayRequest(base, 'GET', `/device/${enc(deviceIp)}/icon/${enc(appId)}`, null, timeout);
    },

    deleteSideload(deviceIp: string, password: string) {
      return relayRequest(base, 'POST', `/device/${enc(deviceIp)}/delete-sideload`, { password }, timeout);
    },

    screenshot(
      deviceIp: string,
      { password, waitAfterTriggerMs }: { password?: string; waitAfterTriggerMs?: number } = {}
    ) {
      return relayRequest(base, 'POST', `/device/${enc(deviceIp)}/screenshot`, {
        password,
        waitAfterTriggerMs
      }, timeout);
    },

    verifyDevAuth(deviceIp: string, { password }: { password?: string } = {}) {
      return relayRequest(base, 'POST', `/device/${enc(deviceIp)}/verify-dev-auth`, { password }, timeout);
    },

    /**
     * Sideload a channel package to the Roku via the relay.
     *
     * Upload modes (checked in order):
     *  - `file` is a Buffer  → multipart upload of that buffer
     *  - `file` is a string  → read from that local path, then multipart upload
     *  - neither `file` provided → JSON body with `filePath` (must exist on relay host)
     *
     * @param {string} deviceIp
     * @param {{ file?: Buffer | string, filePath?: string, password: string, fileName?: string }} opts
     *   `fileName` is optional; derived from the path when `file` is a string, defaults to "package.zip" for Buffers.
     */
    sideload(
      deviceIp: string,
      {
        file,
        filePath,
        password,
        fileName
      }: {
        file?: Buffer | string;
        filePath?: string;
        password?: string;
        fileName?: string;
      } = {}
    ) {
      if (file != null) {
        if (password == null || password === '') {
          throw new Error('password is required for sideload');
        }
        let buf: Buffer;
        let name: string;
        if (Buffer.isBuffer(file)) {
          buf = file;
          name = fileName || 'package.zip';
        } else if (typeof file === 'string') {
          buf = fs.readFileSync(file);
          name = fileName || path.basename(file);
        } else {
          throw new Error('file must be a Buffer or a string path');
        }
        const fields: MultipartField[] = [
          { name: 'file', value: buf, filename: name, contentType: 'application/zip' },
          { name: 'password', value: password }
        ];
        return relayMultipartRequest(base, `/device/${enc(deviceIp)}/sideload`, fields, uploadTimeout);
      }
      return relayRequest(base, 'POST', `/device/${enc(deviceIp)}/sideload`, { filePath, password }, timeout);
    },

    raleWake(deviceIp: string, port = DEFAULT_RALE_PORT) {
      return relayRequest(base, 'POST', `/device/${enc(deviceIp)}/rale/wake`, { port }, timeout);
    },

    raleConnect(deviceIp: string, port = DEFAULT_RALE_PORT) {
      return relayRequest(base, 'POST', `/device/${enc(deviceIp)}/rale/connect`, { port }, Math.max(timeout, 15000));
    },

    raleCommand(
      deviceIp: string,
      {
        connectionId,
        command,
        args,
        timeoutMs: deviceCommandTimeoutMs
      }: {
        connectionId: string;
        command: string;
        args?: unknown;
        timeoutMs?: number;
      }
    ) {
      const deviceWait =
        typeof deviceCommandTimeoutMs === 'number' && deviceCommandTimeoutMs > 0
          ? deviceCommandTimeoutMs
          : 30000;
      const body = {
        connectionId,
        command,
        args: args != null ? args : {},
        timeoutMs: deviceWait
      };
      return relayRequest(
        base,
        'POST',
        `/device/${enc(deviceIp)}/rale/command`,
        body,
        Math.max(timeout, deviceWait + 20000, 120000)
      );
    },

    raleDisconnect(deviceIp: string, { connectionId }: { connectionId: string }) {
      return relayRequest(
        base,
        'POST',
        `/device/${enc(deviceIp)}/rale/disconnect`,
        { connectionId },
        timeout
      );
    }
  };
}

module.exports = { createRelayClient, validateRelayBaseUrl };
