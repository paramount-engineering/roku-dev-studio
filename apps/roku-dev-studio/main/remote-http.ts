/**
 * Shared minimal JSON HTTP client for remote RDS location servers.
 *
 * One implementation used by the remote-device IPC handlers, the Sideload Relay
 * discovery, and the Settings window (previously three near-identical copies).
 */

import type { IncomingMessage } from 'http';

/** Cap on an accumulated JSON response body (these endpoints return small payloads). */
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

/** True only for a well-formed http(s) URL. */
export function isSafeRelayUrl(serverUrl: unknown): serverUrl is string {
  if (!serverUrl || typeof serverUrl !== 'string') return false;
  try {
    const u = new URL(serverUrl);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Issue a JSON HTTP request to `serverUrl + pathStr` and resolve the parsed
 * body (or `{ success: false, error }` on any failure — never rejects).
 */
export function remoteHttpRequest(
  serverUrl: string,
  pathStr: string,
  method = 'GET',
  body: Record<string, unknown> | null = null,
  timeout = 15000
): Promise<any> {
  return new Promise((resolve) => {
    if (!isSafeRelayUrl(serverUrl)) {
      resolve({ success: false, error: 'Invalid relay server URL' });
      return;
    }
    const url = new URL(pathStr, serverUrl);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? require('https') : require('http');

    const headers: Record<string, string | number> = {};
    let postData: string | null = null;
    if (body) {
      postData = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = httpModule.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        // Preserve the query string — `url.pathname` alone would drop it.
        path: url.pathname + url.search,
        method,
        headers,
        timeout
      },
      (res: IncomingMessage) => {
        let data = '';
        let aborted = false;
        res.on('data', (chunk: Buffer | string) => {
          if (aborted) return;
          data += chunk;
          // Defensive cap: these endpoints return small JSON; bail on anything
          // absurd so a rogue/broken server can't balloon memory.
          if (data.length > MAX_RESPONSE_BYTES) {
            aborted = true;
            res.destroy();
            resolve({ success: false, error: 'Response too large' });
          }
        });
        res.on('end', () => {
          if (aborted) return;
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ success: false, error: 'Invalid JSON response', raw: data });
          }
        });
      }
    );
    req.on('error', (err: Error) => resolve({ success: false, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Request timed out' });
    });
    if (postData) req.write(postData);
    req.end();
  });
}
