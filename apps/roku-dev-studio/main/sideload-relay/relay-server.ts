/**
 * Sideload Relay ingest server — the "fake Roku" HTTP endpoint.
 *
 * Impersonates a Roku dev server on `/plugin_install`: issues the Digest 401
 * challenge, validates the IDE's `Authorization` (user `rokudev` + the relay
 * password), parses the multipart upload, saves the .zip to a temp dir, and
 * **fast-ACKs** `Install Success` so the IDE's socket doesn't wait on N-device
 * fan-out. The saved package + parsed flags are handed to `onUpload`; the
 * service runs the actual fan-out asynchronously.
 *
 * Port strategy: try the requested port (default 80), fall back to a high port
 * (8888) when binding fails (privileged-port EACCES / EADDRINUSE), and report
 * the port actually bound so the UI can tell the user what to paste into
 * roku-deploy.
 */

import type { IncomingMessage, ServerResponse, Server } from 'http';

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { buildDigestChallenge, validateDigestAuthorization } = require('roku-dev-studio-api/lib/digest-server');
const { parseMultipart, getField, getFirstFile } = require('roku-dev-studio-api/lib/multipart-parse');
const { mainLog, mainWarn, mainError } = require('../log');
const { RELAY_FALLBACK_PORT } = require('../../shared/sideload-relay/types');

type LogFn = (...args: unknown[]) => void;

/** Cap the accepted upload so a rogue client can't exhaust memory. Roku channels are small. */
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

export interface RelayUpload {
  /** Absolute path to the saved .zip (caller owns cleanup). */
  filePath: string;
  filename: string;
  bytes: number;
  /** roku-debug adds `remotedebug=1` for the "BrightScript Debug: Launch" path. */
  remotedebug: boolean;
  /** `remotedebug_connect_early=1` when configured. */
  remotedebugConnectEarly: boolean;
}

export interface RelayServerCallbacks {
  /** Password validated against (user `rokudev`). Read lazily so a settings change applies without a rebind. */
  getPassword: () => string;
  /** Called after a successful Install upload is saved. Fire-and-forget fan-out. */
  onUpload: (upload: RelayUpload) => void;
  /** Called for a `mysubmit=Delete` request so the service can fan the delete out. */
  onDelete?: () => void;
}

/** IPv4, non-internal interface addresses — the "host = <this>" hint for the IDE. */
function lanAddresses(): string[] {
  const out: string[] = [];
  try {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const info of ifaces[name] || []) {
        if (info && info.family === 'IPv4' && !info.internal) out.push(info.address);
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

const INSTALL_SUCCESS_BODY =
  '<html><body><font color="red">Install Success.</font></body></html>';
const DELETE_SUCCESS_BODY =
  '<html><body><font color="red">Delete Success.</font></body></html>';
const CHALLENGE_BODY =
  '<html><head><title>401 Unauthorized</title></head><body>Authentication required.</body></html>';

export class RelayIngestServer {
  private server: Server | null = null;
  private boundPort: number | null = null;
  private requestedPort = 0;
  private lastError: string | undefined;
  private tempDir: string | null = null;
  private readonly callbacks: RelayServerCallbacks;
  private readonly log: LogFn;

  constructor(callbacks: RelayServerCallbacks, log: LogFn = mainLog) {
    this.callbacks = callbacks;
    this.log = log;
  }

  getBoundPort(): number | null {
    return this.boundPort;
  }
  getRequestedPort(): number {
    return this.requestedPort;
  }
  isListening(): boolean {
    return !!this.server && this.boundPort != null;
  }
  getLastError(): string | undefined {
    return this.lastError;
  }
  getAddresses(): string[] {
    return lanAddresses();
  }

  /** Bind on `port`, falling back to a high port when the privileged port is unavailable. */
  async start(port: number): Promise<void> {
    this.requestedPort = port;
    this.lastError = undefined;
    if (this.server) await this.stop();

    const tryBind = (p: number): Promise<Server> =>
      new Promise((resolve, reject) => {
        const srv: Server = http.createServer((req: IncomingMessage, res: ServerResponse) =>
          this.handle(req, res)
        );
        srv.on('error', (err: NodeJS.ErrnoException) => reject(err));
        // Bind on all interfaces so LAN IDEs (and remote/VPN IPs) can reach it.
        srv.listen(p, () => resolve(srv));
      });

    try {
      this.server = await tryBind(port);
      this.boundPort = port;
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if ((code === 'EACCES' || code === 'EADDRINUSE') && port !== RELAY_FALLBACK_PORT) {
        this.log(`[SideloadRelay] port ${port} unavailable (${code}); falling back to ${RELAY_FALLBACK_PORT}`);
        try {
          this.server = await tryBind(RELAY_FALLBACK_PORT);
          this.boundPort = RELAY_FALLBACK_PORT;
        } catch (err2: unknown) {
          this.boundPort = null;
          this.lastError = `Bind failed on ${port} and ${RELAY_FALLBACK_PORT}: ${(err2 as Error)?.message || err2}`;
          mainError('[SideloadRelay]', this.lastError);
          throw err2;
        }
      } else {
        this.boundPort = null;
        this.lastError = `Bind failed on ${port}: ${(err as Error)?.message || err}`;
        mainError('[SideloadRelay]', this.lastError);
        throw err;
      }
    }
    this.log(`[SideloadRelay] ingest server listening on :${this.boundPort} (interfaces: ${lanAddresses().join(', ') || 'none'})`);
  }

  async stop(): Promise<void> {
    const srv = this.server;
    this.server = null;
    this.boundPort = null;
    if (!srv) return;
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  }

  private ensureTempDir(): string {
    if (this.tempDir && fs.existsSync(this.tempDir)) return this.tempDir;
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), 'rds-relay-'));
    this.tempDir = dir;
    return dir;
  }

  private readBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      req.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_UPLOAD_BYTES) {
          reject(new Error('Upload too large'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  private sendChallenge(res: ServerResponse): void {
    const { header } = buildDigestChallenge();
    res.writeHead(401, {
      'WWW-Authenticate': header,
      'Content-Type': 'text/html',
      Connection: 'close'
    });
    res.end(CHALLENGE_BODY);
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || '/';
    const method = (req.method || 'GET').toUpperCase();

    // Health / root — lets the user confirm the relay is up in a browser.
    if (method === 'GET' && (url === '/' || url.startsWith('/index'))) {
      res.writeHead(200, { 'Content-Type': 'text/html', Connection: 'close' });
      res.end('<html><body>Roku Dev Studio — Sideload Relay is running.</body></html>');
      return;
    }

    if (!url.startsWith('/plugin_install')) {
      res.writeHead(404, { Connection: 'close' });
      res.end('Not found');
      return;
    }

    // Read the full body first: HTTP-Digest clients (roku-deploy / postman-request)
    // stream the body on the un-authenticated attempt too, so we must drain it
    // before returning 401 or the client socket resets mid-upload.
    let body: Buffer;
    try {
      body = await this.readBody(req);
    } catch (e) {
      mainWarn('[SideloadRelay] failed reading upload body:', (e as Error)?.message || e);
      res.writeHead(413, { Connection: 'close' });
      res.end('Payload too large');
      return;
    }

    const auth = req.headers['authorization'];
    const password = this.callbacks.getPassword();
    if (!password) {
      // Relay password not configured — reject clearly rather than accept-all.
      res.writeHead(500, { Connection: 'close' });
      res.end('Sideload Relay password is not configured.');
      return;
    }
    const check = validateDigestAuthorization({ authorization: auth, method, password });
    if (!check.ok) {
      this.sendChallenge(res);
      return;
    }

    const contentType = req.headers['content-type'];
    const parsed = parseMultipart(body, contentType);
    const mysubmit = (parsed && getField(parsed, 'mysubmit')) || '';

    if (/^delete$/i.test(mysubmit)) {
      res.writeHead(200, { 'Content-Type': 'text/html', Connection: 'close' });
      res.end(DELETE_SUCCESS_BODY);
      try {
        this.callbacks.onDelete?.();
      } catch (e) {
        mainWarn('[SideloadRelay] onDelete handler threw:', (e as Error)?.message || e);
      }
      return;
    }

    const file = parsed ? getFirstFile(parsed) : undefined;
    if (!file || !file.data || file.data.length === 0) {
      res.writeHead(400, { 'Content-Type': 'text/html', Connection: 'close' });
      res.end('<html><body><font color="red">Install Failure: no package received.</font></body></html>');
      return;
    }

    // Persist the package so async fan-out can read it after we ACK.
    let savedPath = '';
    try {
      const dir = this.ensureTempDir();
      const safeName = (file.filename || 'channel.zip').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120) || 'channel.zip';
      savedPath = path.join(dir, `${Date.now()}-${safeName}`);
      fs.writeFileSync(savedPath, file.data);
    } catch (e) {
      mainError('[SideloadRelay] failed saving package:', (e as Error)?.message || e);
      res.writeHead(500, { 'Content-Type': 'text/html', Connection: 'close' });
      res.end('<html><body><font color="red">Install Failure: could not save package.</font></body></html>');
      return;
    }

    // Fast ACK — reply exactly what roku-deploy expects, then fan out async.
    res.writeHead(200, { 'Content-Type': 'text/html', Connection: 'close' });
    res.end(INSTALL_SUCCESS_BODY);

    const remotedebug = /^1|true$/i.test((parsed && getField(parsed, 'remotedebug')) || '');
    const remotedebugConnectEarly = /^1|true$/i.test(
      (parsed && getField(parsed, 'remotedebug_connect_early')) || ''
    );
    try {
      this.callbacks.onUpload({
        filePath: savedPath,
        filename: file.filename || 'channel.zip',
        bytes: file.data.length,
        remotedebug,
        remotedebugConnectEarly
      });
    } catch (e) {
      mainWarn('[SideloadRelay] onUpload handler threw:', (e as Error)?.message || e);
    }
  }

  /** Best-effort removal of the temp package dir (on dispose). */
  cleanupTemp(): void {
    if (this.tempDir) {
      try {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      } catch {
        /* OS reclaims tmp */
      }
      this.tempDir = null;
    }
  }
}
