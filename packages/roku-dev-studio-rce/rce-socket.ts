/**
 * `RceSocket` — a `net.Socket`-shaped `Duplex` over `wss://<instanceApiUrl>/api/v0/ports/<port>`
 * (note: **`ports`, plural**). This flip-flopped twice in one day before landing here for good —
 * see the full story below — so this time it's backed by the server's own words, not inference:
 *
 * A user-shared screenshot of Roku's published RCE docs showed **singular** `port` for the three
 * debug console URLs, which looked authoritative enough to revert a same-day "confirmed live"
 * plural claim (itself a bad inference from the *different*, genuinely-plural HTTP-proxy route
 * `/api/v0/ports/{port}/http/{path}`, applied here without ever completing a live WS handshake).
 * Direct live testing (2026-09-12) then settled it for real:
 *   - `GET .../api/v0/port/8080` (singular) → `404 {"detail":"Not Found"}` — not registered.
 *   - `GET .../api/v0/ports/8080` (plural) → `400 {"detail":{"message":"This is a WebSocket
 *     endpoint. Connect using ws:// or wss:// protocol.","port":8080,"documentation":"SceneGraph
 *     debug server..."}}` — the live server's *own* error message, not a guess.
 *   - Connecting `wss://.../api/v0/ports/8080` and sending `plugins\n` returned the device's real
 *     serial/firmware banner and full installed-channel list — a genuine, working round trip.
 * The docs screenshot was evidently stale/preview and didn't match what's actually deployed.
 * Lesson: a live 400/404 pair from the real server beats a docs screenshot beats a code inference —
 * don't skip straight to the docs-screenshot tier next time when the live server is reachable.
 *
 * The byte-parity tunnel to an RCE instance's raw TCP ports. This is what lets telnet (shipped,
 * `main/ipc/rce-handlers.ts`'s telnet-system handlers), the BrightScript debugger, and (per design
 * doc §2/Non-goals) RALE work against an RCE device with zero changes to their own logic — each
 * just needs its one `new net.Socket()` construction site swapped for this class behind a small
 * factory (`connectRceSocket`, below).
 *
 * **Confirmed port**: 8080 (SceneGraph debug server / the physical-device "system telnet" console —
 * live-verified above, real `plugins` output). 8085 (BrightScript console) and 8087 (Screensaver)
 * are documented alongside it in both the docs screenshot and this route's own 400 error shape but
 * not yet round-trip tested. Everything beyond those three (8081/8082 debugger split, 9999, the
 * 49152–65535 ephemeral range) was an earlier bad inference and is still unconfirmed — re-verify
 * before relying on it for the debugger or RALE work.
 *
 * Auth header on the WS handshake: plain `Authorization: Bearer <token>` — confirmed live
 * (2026-09-12, same test above). `X-Authorization` (what `roku-deploy`'s reference client uses for
 * this host) was also tried and made no difference; the gateway accepts the plain header fine.
 */

import { Duplex } from 'node:stream';
import WebSocketImpl, { type RawData } from 'ws';
import { normalizeInstanceApiUrl } from './rce-ecp';

/** `instanceApiUrl` is normalized the same way `RceEcpClient` does — confirmed live that the real
 *  API's `instance_api_url` includes a protocol prefix (`https://...`), which a naive
 *  `wss://${instanceApiUrl}/...` would double up into an unreachable `wss://https://...` URL. See
 *  `rce-ecp.ts`'s `normalizeInstanceApiUrl` for the full story. */
export function buildPortBridgeUrl(instanceApiUrl: string, port: number): string {
  return `wss://${normalizeInstanceApiUrl(instanceApiUrl)}/api/v0/ports/${port}`;
}

export interface RceSocketOptions {
  instanceApiUrl: string;
  token: string;
  port: number;
  /** Override the constructed URL — for tests only; production callers always use `instanceApiUrl`+`port`. */
  urlOverride?: string;
}

/**
 * `net.Socket`-compatible enough for telnet/debugger/RALE code that only calls `.write()`,
 * `.on('data'|'close'|'error')`, `.end()`, `.destroy()` — not a full `net.Socket` polyfill.
 */
export class RceSocket extends Duplex {
  private readonly socket: WebSocketImpl;
  private wsOpen = false;
  private readonly writeQueue: Array<{ chunk: Buffer; callback: (error?: Error | null) => void }> = [];

  constructor(opts: RceSocketOptions) {
    super();
    const url = opts.urlOverride ?? buildPortBridgeUrl(opts.instanceApiUrl, opts.port);
    this.socket = new WebSocketImpl(url, {
      headers: { Authorization: `Bearer ${opts.token}` }
    });

    this.socket.on('open', () => {
      this.wsOpen = true;
      const queued = this.writeQueue.splice(0, this.writeQueue.length);
      for (const { chunk, callback } of queued) {
        this.socket.send(chunk, callback);
      }
      // Custom event, not a Duplex built-in — lets `connectRceSocket` (below) resolve as soon as
      // the tunnel is actually usable, the same "wait for connect-or-error" shape
      // `connectRokuTcp` (roku-dev-studio-api) already gives physical-device callers.
      this.emit('open');
    });

    this.socket.on('message', (data: RawData, isBinary: boolean) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      // Readable-side backpressure: pause the underlying WS socket until the consumer drains.
      if (!this.push(buffer) && typeof this.socket.pause === 'function') {
        this.socket.pause();
      }
      void isBinary;
    });

    // 'end' (readable side) fires independently of — and before — the Duplex's own 'close',
    // which also waits on the writable side finishing. Reference implementations treat a
    // clean WS close as EOF, not an error.
    this.socket.on('close', () => {
      this.push(null);
    });

    this.socket.on('error', (error: Error) => {
      this.destroy(error);
    });
  }

  override _read(): void {
    if (this.wsOpen && typeof this.socket.resume === 'function') {
      this.socket.resume();
    }
  }

  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    if (!this.wsOpen) {
      this.writeQueue.push({ chunk, callback });
      return;
    }
    this.socket.send(chunk, callback);
  }

  override _final(callback: (error?: Error | null) => void): void {
    try {
      this.socket.close();
    } catch {
      /* already closed */
    }
    callback();
  }

  override _destroy(err: Error | null, callback: (error?: Error | null) => void): void {
    try {
      this.socket.terminate();
    } catch {
      /* already terminated */
    }
    callback(err);
  }
}

const DEFAULT_CONNECT_TIMEOUT_MS = 5000;

/**
 * Construct an `RceSocket` and wait for it to actually be usable — mirrors
 * `connectRokuTcp` (roku-dev-studio-api)'s `{success, socket} | {success: false, error}` shape so
 * telnet/debugger/RALE call sites can swap their `new net.Socket()` + connect-wait for this with
 * minimal change. Resolves on the tunnel's `open` event, an early `error`, or a timeout.
 */
export function connectRceSocket(
  opts: RceSocketOptions & { connectTimeoutMs?: number }
): Promise<{ success: true; socket: RceSocket } | { success: false; error: string }> {
  return new Promise((resolve) => {
    const socket = new RceSocket(opts);
    let resolved = false;

    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({ success: false, error: 'Connection timed out' });
    }, opts.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS);

    socket.once('open', () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      resolve({ success: true, socket });
    });

    socket.once('error', (err: Error) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Factory for `DebugProtocolClient`'s `connectSocket` option (`roku-dev-studio-api`'s in-house
 * BrightScript debug protocol client) — opens the debug protocol's control socket (8081) and
 * whatever IO port the device negotiates, through this same ports-bridge tunnel, instead of a raw
 * TCP connect. Not imported from `roku-dev-studio-api` (no reverse package dependency needed): the
 * returned function only needs to structurally match that package's `DebugSocketLike`, which an
 * `RceSocket` already satisfies (it's a `stream.Duplex` with `on`/`once`/`write`/`destroy`/
 * `removeAllListeners`).
 */
export function createRceDebugSocketFactory(opts: { instanceApiUrl: string; token: string }): (port: number) => Promise<RceSocket> {
  return async (port: number) => {
    const result = await connectRceSocket({ instanceApiUrl: opts.instanceApiUrl, token: opts.token, port });
    if (result.success) return result.socket;
    // A 502 upgrade rejection means the port is open at the bridge but nothing is listening on it
    // device-side yet (not launched with debugging, or still booting) — the same transient
    // condition a local device reports as ECONNREFUSED. Tag it the same way so
    // DebugSessionController's attach-retry loop classifies and retries it identically instead of
    // reporting a misleading "handshake never completed" (live-verified 2026-09-12: a closed RCE
    // debug port 502s exactly like this — see rce-socket.ts's header for the sibling console-port
    // findings from the same test session).
    const refused = /Unexpected server response: 502/i.test(result.error);
    throw new Error(refused ? `ECONNREFUSED (${result.error})` : result.error);
  };
}
