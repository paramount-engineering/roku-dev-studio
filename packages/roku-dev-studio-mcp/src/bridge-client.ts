/**
 * Tiny HTTP client for the Dev Studio main-process bridge. Reads the bridge
 * descriptor (`mcp-bridge.json`) from the Electron app's userData directory,
 * verifies it points at a live process, and provides typed helpers for the
 * live tools. All requests are localhost-only and authenticated with a
 * per-launch token.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const APP_NAME = 'Roku Dev Studio';
const BRIDGE_FILE_NAME = 'mcp-bridge.json';
/**
 * Hard ceiling on a single bridge request. Must be at least as long as the
 * longest server-side round-trip the bridge performs:
 *   - connect_device renderer round-trip — 30s
 *   - generic renderer tool round-trip   — 30s
 *   - App Connector Function fetch       — 20s
 *   - screenshot capture + retries       — up to ~18s
 *   - RALE renderer round-trip           — 15s
 * Set above the 30s ceiling so the bridge always responds with a structured
 * error (including the device's actual error message) before the client gives
 * up. The previous 8s value swallowed real errors with a generic timeout.
 */
const REQUEST_TIMEOUT_MS = 35000;

export type BridgeDescriptor = {
  port: number;
  token: string;
  pid: number;
  /** Wall-clock ISO time the descriptor was written. */
  startedAt: string;
};

export type BridgeStatus =
  | { live: true; descriptor: BridgeDescriptor }
  | { live: false; reason: string };

function getUserDataDir(): string {
  // Match Electron's app.getPath('userData') for app name "Roku Dev Studio".
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, APP_NAME);
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdg, APP_NAME);
}

export function getBridgeDescriptorPath(): string {
  // Allow override for tests / unusual installs.
  if (process.env.RDS_MCP_BRIDGE_FILE) return process.env.RDS_MCP_BRIDGE_FILE;
  return path.join(getUserDataDir(), BRIDGE_FILE_NAME);
}

export function readBridgeDescriptor(): BridgeDescriptor | null {
  const file = getBridgeDescriptorPath();
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.port === 'number' &&
      typeof parsed.token === 'string' &&
      typeof parsed.pid === 'number' &&
      typeof parsed.startedAt === 'string'
    ) {
      return parsed as BridgeDescriptor;
    }
    return null;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    const code = e instanceof Error ? (e as NodeJS.ErrnoException).code : null;
    // EPERM means the process exists but we can't signal it; treat as alive.
    return code === 'EPERM';
  }
}

/**
 * In-memory cache for the bridge status check. Each call to `getBridgeStatus`
 * triggers a disk read + syscall; caching for a short TTL avoids redundant I/O
 * during burst tool calls while still detecting a crashed bridge quickly.
 */
const STATUS_CACHE_TTL_MS = 3000;
let cachedStatus: BridgeStatus | null = null;
let cachedStatusAt = 0;

/** Invalidate the status cache — call this when a request to the bridge fails. */
export function invalidateBridgeStatusCache(): void {
  cachedStatus = null;
  cachedStatusAt = 0;
}

export async function getBridgeStatus(): Promise<BridgeStatus> {
  const now = Date.now();
  if (cachedStatus && now - cachedStatusAt < STATUS_CACHE_TTL_MS) {
    return cachedStatus;
  }
  const descriptor = readBridgeDescriptor();
  if (!descriptor) {
    cachedStatus = { live: false, reason: 'No bridge descriptor — Roku Dev Studio is not running.' };
    cachedStatusAt = now;
    return cachedStatus;
  }
  if (!isProcessAlive(descriptor.pid)) {
    cachedStatus = { live: false, reason: 'Roku Dev Studio process is no longer running (stale descriptor).' };
    cachedStatusAt = now;
    return cachedStatus;
  }
  cachedStatus = { live: true, descriptor };
  cachedStatusAt = now;
  return cachedStatus;
}

export type BridgeRequest = {
  method: 'GET' | 'POST';
  pathname: string;
  body?: unknown;
};

export type BridgeResponse<T = unknown> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; error: string };

export async function bridgeRequest<T = unknown>(req: BridgeRequest): Promise<BridgeResponse<T>> {
  const status = await getBridgeStatus();
  if (!status.live) {
    return { ok: false, status: 0, error: status.reason };
  }
  const { descriptor } = status;
  return new Promise((resolve) => {
    const bodyStr = req.body == null ? undefined : JSON.stringify(req.body);
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${descriptor.token}`,
      'Accept': 'application/json'
    };
    if (bodyStr != null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyStr).toString();
    }
    const r = http.request(
      {
        host: '127.0.0.1',
        port: descriptor.port,
        method: req.method,
        path: req.pathname,
        headers,
        timeout: REQUEST_TIMEOUT_MS
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8');
          let parsed: unknown = text;
          if (text) {
            try {
              parsed = JSON.parse(text);
            } catch {
              /* leave as text */
            }
          }
          const code = res.statusCode || 0;
          if (code >= 200 && code < 300) {
            resolve({ ok: true, status: code, body: parsed as T });
          } else {
            const errMsg =
              parsed && typeof parsed === 'object' && parsed !== null && 'error' in parsed
                ? String((parsed as { error: unknown }).error)
                : `HTTP ${code}`;
            resolve({ ok: false, status: code, error: errMsg });
          }
        });
      }
    );
    r.on('error', (err) => {
      // Connection-level failure likely means the bridge is gone; bust the cache
      // so the next call re-reads the descriptor rather than retrying a dead port.
      invalidateBridgeStatusCache();
      resolve({ ok: false, status: 0, error: err.message });
    });
    r.on('timeout', () => {
      r.destroy();
      resolve({ ok: false, status: 0, error: 'Bridge request timed out' });
    });
    if (bodyStr != null) r.write(bodyStr);
    r.end();
  });
}
