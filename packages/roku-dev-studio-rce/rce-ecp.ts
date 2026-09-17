/**
 * RCE Device API — ECP proxy (`https://<instanceApiUrl>/...`). Deliberately NOT an extra branch in
 * `roku-dev-studio-api/ecp.ts`: that module's `ecpRequest` is built around a raw LAN `ip`
 * (`isValidIp` gate, plain `http.request` to `ip:8060`) — RCE talks HTTPS to a hostname+path
 * prefix with a Bearer token, a different enough transport that forcing it into the same function
 * would be the "shoehorn two shapes into one signature" mistake, not a clean one-more-branch — see
 * design doc §1's revised auth-table note. The renderer's `createRceApiAdapter` is where local vs
 * RCE actually branches, one level up from here.
 *
 * **Route paths below are confirmed live (2026-09-11) against the real, per-instance OpenAPI spec**
 * at `https://<instanceApiUrl>/openapi.json` (discoverable with the same Bearer token — a genuine
 * FastAPI app, distinct from `api.rce.roku.com`'s Core API) — NOT the narrative "RCE API Guide"
 * PDF, which turned out to document a materially different (possibly older, or aspirational) route
 * shape. Concretely: keypress/keydown/keyup live at `/api/v0/input/{action}/{key}`, not
 * `/api/v0/ecp1/{action}/{key}`; there is no dedicated `/ecp1/{command}` raw-ECP proxy at all —
 * every other ECP call (query, launch, search, deeplink) goes through the generic
 * `/api/v0/ports/{port_number}/http/{path}` HTTP-port proxy, with port 8060 being the device's ECP
 * port (same port a physical device serves ECP on). `keypress` and `query/device-info` were both
 * verified against a live running instance and returned real 200 responses before the instance's
 * `max_runtime` expired mid-session.
 */

import { errorMessage } from 'roku-dev-studio-platform';

// Reused from the physical-device implementation rather than re-parsed here — same pure regex
// scrape of the UPnP `<iconList>` block, no reason to fork it (see rce-sideload.ts's identical
// "reuse the pure helper via a subpath require" precedent for roku-dev-studio-api/lib/http-digest).
const { parseUpnpDeviceImagePath } = require('roku-dev-studio-api/lib/device-hardware-image') as {
  parseUpnpDeviceImagePath: (xml: string) => string | null;
};

/** Delay between synthetic keypresses for inputText — matches the local implementation's default. */
const INPUT_TEXT_KEY_DELAY_MS = 6;

/**
 * A freshly-started RCE instance's emulated device can take a few seconds to bring its own ECP
 * port up; Roku's own gateway responds with a 503 ("upstream connect error ... Connection
 * refused") during that window instead of queuing the request. The gateway rejects it before it
 * ever reaches the device, so retrying is safe (no risk of a duplicate keypress/launch landing
 * twice) — a bounded retry here rides out normal boot instead of surfacing it as a hard failure
 * for whichever call happened to run first. Same shape as `SCREENSHOT_MAX_RETRIES` /
 * `SCREENSHOT_RETRY_WAIT_MS` in rce-sideload.ts for the analogous "RCE still catching up" case.
 */
const RCE_GATEWAY_RETRY_STATUS = 503;
const RCE_GATEWAY_RETRY_MAX_ATTEMPTS = 4;
const RCE_GATEWAY_RETRY_WAIT_MS = 1500;

/**
 * Node's fetch (undici) wraps every network-level failure — DNS, connection refused/reset,
 * TLS, abort — in a generic `TypeError: fetch failed`, with the actual reason only on `.cause`.
 * Surfacing just `errorMessage(error)` would always read "fetch failed" with no way to tell a
 * bad instanceApiUrl from a real outage from a timeout — worth unwrapping so the *next* failure
 * is diagnosable instead of a repeat of this one. Shared by every fetch call site across the
 * RCE package (rce-ecp.ts, rce-management-client.ts).
 */
export function describeFetchError(error: unknown): string {
  const errorCause = error instanceof Error ? (error as { cause?: unknown }).cause : undefined;
  const cause = errorCause instanceof Error ? `: ${errorCause.message}` : '';
  return `${errorMessage(error)}${cause}`;
}

export interface RceEcpOptions {
  timeoutMs?: number;
  /** Every route in this client uses plain `Authorization: Bearer` — confirmed live. One route
   *  (`developer-settings-combo`, not an ECP call at all) instead needs `X-Authorization`, per the
   *  RokuCommunity roku-deploy reference implementation; this override exists for that one case. */
  authHeaderName?: 'Authorization' | 'X-Authorization';
  /** Delay between gateway-503 retries. Exposed mainly so tests don't have to sit through the
   *  real 1.5s default (same escape hatch as `RceScreenshotOptions.retryWaitMs`). */
  retryWaitMs?: number;
}

export interface RceEcpResult {
  success: boolean;
  status?: number;
  data?: string;
  error?: string;
}

export interface RceEcpIconResult {
  success: boolean;
  dataUrl?: string;
  mimeType?: string;
  error?: string;
}

/**
 * One `fetch` with the per-attempt abort timeout and the bounded gateway-503 retry loop described
 * above. `read` decodes the body (text vs binary) INSIDE the timeout window: a body that stalls
 * after the headers arrived must still fail at `timeoutMs`, exactly as the two pre-dedupe copies
 * did. Returns the final `Response` (2xx or a non-retryable / budget-exhausted status) with its
 * decoded body. Network-level failures throw.
 */
async function rceFetchWithRetry<T>(
  url: string,
  init: RequestInit,
  opts: RceEcpOptions,
  read: (res: Response) => Promise<T>
): Promise<{ res: Response; body: T }> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (res.status !== RCE_GATEWAY_RETRY_STATUS || attempt >= RCE_GATEWAY_RETRY_MAX_ATTEMPTS) {
        return { res, body: await read(res) };
      }
      await res.arrayBuffer().catch(() => undefined); // drain so the connection is reusable
    } finally {
      clearTimeout(timeout);
    }
    await new Promise((r) => setTimeout(r, opts.retryWaitMs ?? RCE_GATEWAY_RETRY_WAIT_MS));
  }
}

/**
 * Binary counterpart to {@link rceEcpFetch} — `res.text()` decodes the body as UTF-8, which
 * corrupts an image response into garbage bytes. Reads `arrayBuffer()` instead and base64-encodes
 * into a `data:` URL, matching what the local device's `getIcon` already returns (see
 * `roku-dev-studio-api/ecp.ts`) so the renderer's generic icon-loading code (which expects
 * `result.dataUrl`) works unchanged for RCE devices.
 */
async function rceEcpFetchBinary(url: string, token: string, opts: RceEcpOptions = {}): Promise<RceEcpIconResult> {
  try {
    const { res, body } = await rceFetchWithRetry(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }, opts, (r) => r.arrayBuffer());
    const contentType = res.headers.get('content-type');
    // Mirrors the local device's icon-fetch guard — a device that 200s with an HTML "not found"
    // page would otherwise be base64-encoded into a broken image (absent content-type is
    // tolerated, some devices omit it, and defaults to png).
    const looksLikeImage = !contentType || /^image\//i.test(contentType);
    const buffer = Buffer.from(body);
    if (!res.ok) {
      return { success: false, error: `RCE ECP request failed (HTTP ${res.status}) for ${url}` };
    }
    if (buffer.length === 0) {
      return { success: false, error: 'Empty icon response' };
    }
    if (!looksLikeImage) {
      return { success: false, error: 'Device returned a non-image response for icon' };
    }
    const mimeType = contentType || 'image/png';
    return { success: true, dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`, mimeType };
  } catch (error: unknown) {
    return { success: false, error: describeFetchError(error) };
  }
}

async function rceEcpFetch(url: string, method: string, token: string, opts: RceEcpOptions = {}): Promise<RceEcpResult> {
  try {
    const { res, body: data } = await rceFetchWithRetry(url, { method, headers: { [opts.authHeaderName ?? 'Authorization']: `Bearer ${token}` } }, opts, (r) => r.text());
    if (!res.ok) {
      // Include the URL and a body snippet — a bare "HTTP 404" told us nothing about which of
      // {path structure, instanceApiUrl shape, auth} was wrong last time; this should make the
      // next failure self-diagnosing instead of another guess-and-check round trip.
      const bodySnippet = data ? ` — ${data.slice(0, 300)}` : '';
      return { success: false, status: res.status, data, error: `RCE ECP request failed (HTTP ${res.status}) for ${url}${bodySnippet}` };
    }
    return { success: true, status: res.status, data };
  } catch (error: unknown) {
    return { success: false, error: describeFetchError(error) };
  }
}

/**
 * Strips a leading `http(s)://` or `ws(s)://` from `instanceApiUrl` before this client re-adds
 * its own scheme. **Confirmed live 2026-09-11**: the real API's `instance_api_url` DOES include an
 * `https://` prefix, contradicting the OpenAPI schema's own field description ("Does not contain
 * the protocol prefix") this design originally trusted. Blindly prepending `https://` on top of an
 * already-prefixed value produced a literal `https://https://device.rce.roku.com/...` URL — Node's
 * URL parser reads that as host `https` (with the real host swallowed into the path), and `fetch`
 * fails with `getaddrinfo ENOTFOUND https`, which every RCE ECP call showed in production. Handles
 * both shapes so this survives if that's a live-account-specific behavior rather than universal.
 */
export function normalizeInstanceApiUrl(instanceApiUrl: string): string {
  return instanceApiUrl.replace(/^wss?:\/\//i, '').replace(/^https?:\/\//i, '');
}

/**
 * Client for one running RCE instance's Device API. `instanceApiUrl` is the host+path prefix from
 * `DeviceInstanceInfo.instanceApiUrl` — normalized on the way in, see {@link normalizeInstanceApiUrl}.
 */
export class RceEcpClient {
  private readonly instanceApiUrl: string;

  constructor(
    instanceApiUrl: string,
    private readonly token: string
  ) {
    this.instanceApiUrl = normalizeInstanceApiUrl(instanceApiUrl);
  }

  /** Port 8060 is the device's ECP port, proxied through `/api/v0/ports/{port}/http/{path}` —
   *  confirmed live; there is no dedicated `/ecp1` route (see class doc comment). */
  private static readonly ECP_PORT = 8060;

  private httpsUrl(path: string): string {
    return `https://${this.instanceApiUrl}${path}`;
  }

  /** Dedicated input route — confirmed live (`POST .../api/v0/input/keypress/{key}` → 200 with a
   *  real `ECP2Response` body) and, per the OpenAPI spec, survives Roku's "limited ECP mode" the
   *  same way a physical device's key-input route does (this device's own `ecp-setting-mode` was
   *  `limited` when the test succeeded). */
  keypress(key: string, opts?: RceEcpOptions): Promise<RceEcpResult> {
    return rceEcpFetch(this.httpsUrl(`/api/v0/input/keypress/${encodeURIComponent(key)}`), 'POST', this.token, opts);
  }

  keydown(key: string, opts?: RceEcpOptions): Promise<RceEcpResult> {
    return rceEcpFetch(this.httpsUrl(`/api/v0/input/keydown/${encodeURIComponent(key)}`), 'POST', this.token, opts);
  }

  keyup(key: string, opts?: RceEcpOptions): Promise<RceEcpResult> {
    return rceEcpFetch(this.httpsUrl(`/api/v0/input/keyup/${encodeURIComponent(key)}`), 'POST', this.token, opts);
  }

  /** Generic ECP proxy over port 8060 — confirmed live (`GET .../api/v0/ports/8060/http/query/device-info`
   *  returned a real device-info XML body). `path` must start with `/` (e.g. `/query/device-info`). */
  query(path: string, opts?: RceEcpOptions): Promise<RceEcpResult> {
    return rceEcpFetch(this.httpsUrl(`/api/v0/ports/${RceEcpClient.ECP_PORT}/http${path}`), 'GET', this.token, opts);
  }

  post(path: string, opts?: RceEcpOptions): Promise<RceEcpResult> {
    return rceEcpFetch(this.httpsUrl(`/api/v0/ports/${RceEcpClient.ECP_PORT}/http${path}`), 'POST', this.token, opts);
  }

  /** `GET /query/icon/{id}` over the same port-8060 HTTP proxy as {@link query} — can't reuse it
   *  directly, since `query`'s `res.text()` corrupts the binary image body. Returns a ready-to-use
   *  `data:` URL, the same shape the renderer's generic icon-loading code already expects from a
   *  physical device's `getIcon` (roku-dev-studio-api/ecp.ts). */
  getIcon(appId: string, opts?: RceEcpOptions): Promise<RceEcpIconResult> {
    return rceEcpFetchBinary(this.httpsUrl(`/api/v0/ports/${RceEcpClient.ECP_PORT}/http/query/icon/${encodeURIComponent(appId)}`), this.token, opts);
  }

  /** Same UPnP device-description trick the physical-device implementation uses
   *  (`roku-dev-studio-api/lib/device-hardware-image.ts`): `GET /` on the ECP port returns an XML
   *  document with an `<iconList>` pointing at a relative hardware-photo path (falls back to the
   *  same default filename when absent), then a second `GET` on that path fetches the actual
   *  image bytes — both over the same port-8060 HTTP proxy `getIcon`/`query` already use. */
  async getHardwareImage(opts?: RceEcpOptions): Promise<RceEcpIconResult> {
    const root = await rceEcpFetch(this.httpsUrl(`/api/v0/ports/${RceEcpClient.ECP_PORT}/http/`), 'GET', this.token, opts);
    if (!root.success || !root.data) {
      return { success: false, error: root.error || 'Failed to resolve device image path' };
    }
    const relativePath = parseUpnpDeviceImagePath(root.data) || 'device-image.png';
    const imagePath = '/' + relativePath.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    return rceEcpFetchBinary(this.httpsUrl(`/api/v0/ports/${RceEcpClient.ECP_PORT}/http${imagePath}`), this.token, opts);
  }

  launch(appId: string, params?: string, opts?: RceEcpOptions): Promise<RceEcpResult> {
    const query = params ? `?${params}` : '';
    return this.post(`/launch/${encodeURIComponent(appId)}${query}`, opts);
  }

  deeplink(appId: string, contentId?: string, mediaType?: string, extraParams?: Record<string, string>, opts?: RceEcpOptions): Promise<RceEcpResult> {
    const params: string[] = [];
    if (contentId) params.push(`contentID=${encodeURIComponent(contentId)}`);
    if (mediaType) params.push(`mediaType=${encodeURIComponent(mediaType)}`);
    if (extraParams) {
      for (const [key, value] of Object.entries(extraParams)) {
        const trimmedKey = key.trim();
        if (!trimmedKey) continue;
        params.push(`${encodeURIComponent(trimmedKey)}=${encodeURIComponent(value)}`);
      }
    }
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    return this.post(`/launch/${encodeURIComponent(appId)}${query}`, opts);
  }

  /**
   * Triggers the on-device Developer Settings wizard screen — the "Dev mode" quick action in
   * Roku's own RCE web dashboard. NOT an ECP call (`/api/v0/xi/...`, not the port-8060 proxy), and
   * unlike every other route in this client, needs `X-Authorization` rather than plain
   * `Authorization` — per the RokuCommunity `roku-deploy` reference implementation's
   * `sendDeveloperSettingsCombo` (`RokuDeploy.js`, `buildRceAuthHeaders`). Not yet live-verified by
   * this codebase; re-check the header if this 401s against a real instance. Only *opens* the
   * wizard on-device — it doesn't complete setup, and there's no response body to act on.
   */
  devSettingsCombo(opts?: RceEcpOptions): Promise<RceEcpResult> {
    return rceEcpFetch(this.httpsUrl('/api/v0/xi/developer-settings-combo'), 'POST', this.token, {
      ...opts,
      authHeaderName: 'X-Authorization'
    });
  }

  /** Sequential Lit_ keypresses, same approach as the local `inputText` (many devices reject raw `/input`). */
  async inputText(text: unknown, opts: RceEcpOptions & { delayMs?: number } = {}): Promise<RceEcpResult> {
    const str = text == null ? '' : String(text);
    if (!str) return { success: true, status: 200 };
    const delayMs = opts.delayMs ?? INPUT_TEXT_KEY_DELAY_MS;
    for (const char of str) {
      const result = await this.keypress(`Lit_${encodeURIComponent(char)}`, opts);
      if (!result.success) return result;
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
    return { success: true, status: 200 };
  }
}
