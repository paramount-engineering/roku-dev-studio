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
const crypto = require('crypto');
const { buildDigestChallenge, validateDigestAuthorization } = require('roku-dev-studio-api/lib/digest-server');
const { parseMultipart, getField, getFirstFile } = require('roku-dev-studio-api/lib/multipart-parse');
const { mainLog, mainWarn, mainError } = require('../log');
const { RELAY_FALLBACK_PORT } = require('../../shared/sideload-relay/types');
const { renderUploadPage, renderLoginPage } = require('./relay-pages') as typeof import('./relay-pages');

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
}

export interface RelayServerCallbacks {
  /** Password validated against (user `rokudev`). Read lazily so a settings change applies without a rebind. */
  getPassword: () => string;
  /** Current enabled fan-out targets, for the upload page's "installs to" list. */
  getTargets?: () => { name: string; ip: string }[];
  /**
   * Gate a sideload arriving from a machine other than this one. Resolves true
   * to allow, false to deny. Same-machine uploads never call this. Undefined =
   * no gate (always allowed).
   */
  authorizeSource?: (info: { ip: string }) => Promise<boolean>;
  /** Called after a successful Install upload is saved. Fire-and-forget fan-out. */
  onUpload: (upload: RelayUpload) => void;
  /** Called for a `mysubmit=Delete` request so the service can fan the delete out. */
  onDelete?: () => void;
}

/** Strip an IPv4-mapped IPv6 prefix (`::ffff:192.168.1.5` → `192.168.1.5`). */
function normalizeIp(addr: string | undefined): string {
  if (!addr) return '';
  return addr.startsWith('::ffff:') ? addr.slice(7) : addr;
}

/** Name of the session cookie granted after a remote device logs in. */
const SESSION_COOKIE = 'rds_relay';
/** How long a remote login stays valid (8h). */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** Parse the request `Cookie` header into a plain map. */
function parseCookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  const header = req.headers['cookie'];
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
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
  /** Active remote-login sessions: token → expiry (ms). Cleared on stop(). */
  private readonly sessions = new Map<string, number>();
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

  /** True when the request originates from this machine (loopback or a local LAN address). */
  private isSameMachine(req: IncomingMessage): boolean {
    const r = normalizeIp(req.socket?.remoteAddress || undefined);
    if (!r) return false;
    if (r === '127.0.0.1' || r === '::1') return true;
    return lanAddresses().includes(r);
  }

  /**
   * Allow same-machine requests silently; for a remote machine, ask the injected
   * authorizer (native allow/deny prompt). Resolves true to proceed.
   */
  private async authorizeRequest(req: IncomingMessage): Promise<boolean> {
    if (this.isSameMachine(req)) return true;
    const authorize = this.callbacks.authorizeSource;
    if (!authorize) return true;
    try {
      return await authorize({ ip: normalizeIp(req.socket?.remoteAddress || undefined) });
    } catch {
      return false;
    }
  }

  /** True when the request carries a still-valid remote-login session cookie. */
  private hasValidSession(req: IncomingMessage): boolean {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return false;
    const expiry = this.sessions.get(token);
    if (!expiry) return false;
    if (expiry < Date.now()) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  /** Mint a new session and return the `Set-Cookie` header value. */
  private createSession(): string {
    const token = crypto.randomBytes(24).toString('hex');
    this.sessions.set(token, Date.now() + SESSION_TTL_MS);
    return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
  }

  /** Save the uploaded package and hand it to the fan-out. Returns false on save failure. */
  private saveAndDispatch(file: { filename?: string; data: Buffer }, parsed: unknown): boolean {
    let savedPath = '';
    try {
      const dir = this.ensureTempDir();
      const safeName = (file.filename || 'channel.zip').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120) || 'channel.zip';
      savedPath = path.join(dir, `${Date.now()}-${safeName}`);
      fs.writeFileSync(savedPath, file.data);
    } catch (e) {
      mainError('[SideloadRelay] failed saving package:', (e as Error)?.message || e);
      return false;
    }
    const remotedebug = /^1|true$/i.test((parsed && getField(parsed, 'remotedebug')) || '');
    try {
      this.callbacks.onUpload({
        filePath: savedPath,
        filename: file.filename || 'channel.zip',
        bytes: file.data.length,
        remotedebug
      });
    } catch (e) {
      mainWarn('[SideloadRelay] onUpload handler threw:', (e as Error)?.message || e);
    }
    return true;
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
    this.sessions.clear();
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

    // Root — the Roku-style upload page. A remote device that hasn't logged in
    // gets the login page instead (the target list / uploader are never sent to
    // an unauthenticated device). This machine loads the page directly.
    if (method === 'GET' && (url === '/' || url.startsWith('/index'))) {
      const sameMachine = this.isSameMachine(req);
      if (!sameMachine && !this.hasValidSession(req)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' });
        res.end(renderLoginPage());
        return;
      }
      const page = renderUploadPage({
        sameMachine,
        targets: (this.callbacks.getTargets?.() || []).slice(0, 50)
      });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' });
      res.end(page);
      return;
    }

    // Remote login: validate the Dev Password and grant a session cookie.
    if (method === 'POST' && url.startsWith('/relay_login')) {
      await this.handleLogin(req, res);
      return;
    }

    // Browser upload from the page. Same-machine proceeds; a remote machine must
    // hold a valid session (it logged in) AND clear the allow-prompt.
    if (method === 'POST' && url.startsWith('/relay_upload')) {
      await this.handleBrowserUpload(req, res);
      return;
    }

    if (!url.startsWith('/plugin_install')) {
      res.writeHead(404, { Connection: 'close' });
      res.end('Not found');
      return;
    }

    // Validate Digest from the HEADERS before touching the body. roku-deploy's
    // client (postman-request, sendImmediately:false) sends the request headers
    // but WITHHOLDS the multipart body until it receives the 401 challenge, then
    // retries with the Authorization header + the full body. If we awaited the
    // body first we'd deadlock (the client is waiting for our 401, we're waiting
    // for its body) and the IDE sideload times out. Real Rokus answer the
    // challenge from headers alone — so do we.
    const auth = req.headers['authorization'];
    const password = this.callbacks.getPassword();
    if (!password) {
      // Relay password not configured — reject clearly rather than accept-all.
      req.resume(); // drain any bytes so the socket closes cleanly
      res.writeHead(500, { Connection: 'close' });
      res.end('Sideload Relay password is not configured.');
      return;
    }
    const check = validateDigestAuthorization({ authorization: auth, method, password });
    if (!check.ok) {
      req.resume(); // drain any partial body before challenging
      this.sendChallenge(res);
      return;
    }

    // `HEAD /plugin_install` is roku-deploy's password probe
    // (`validateDeveloperPassword`, used by the VS Code extension BEFORE launch):
    // 200 = password OK, 401 = bad password, anything else = "device unreachable".
    // The Digest above already proved the password, so ACK 200 — no body, no
    // fan-out, and no allow-prompt (it's just a credential check, run repeatedly).
    if (method === 'HEAD') {
      req.resume();
      res.writeHead(200, { 'Content-Type': 'text/html', Connection: 'close' });
      res.end();
      return;
    }

    // Authenticated: read the full upload body the client is now sending.
    let body: Buffer;
    try {
      body = await this.readBody(req);
    } catch (e) {
      mainWarn('[SideloadRelay] failed reading upload body:', (e as Error)?.message || e);
      res.writeHead(413, { Connection: 'close' });
      res.end('Payload too large');
      return;
    }

    // For a remote machine, hold the upload until the RDS host approves it
    // (same-machine proceeds silently).
    if (!(await this.authorizeRequest(req))) {
      res.writeHead(403, { 'Content-Type': 'text/html', Connection: 'close' });
      res.end('<html><body><font color="red">Install Failure: source not authorized on the Roku Dev Studio host.</font></body></html>');
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

    if (!this.saveAndDispatch(file, parsed)) {
      res.writeHead(500, { 'Content-Type': 'text/html', Connection: 'close' });
      res.end('<html><body><font color="red">Install Failure: could not save package.</font></body></html>');
      return;
    }

    // Fast ACK — reply exactly what roku-deploy expects; fan-out runs async.
    res.writeHead(200, { 'Content-Type': 'text/html', Connection: 'close' });
    res.end(INSTALL_SUCCESS_BODY);
  }

  /** Validate the Dev Password for a remote device and grant a session cookie. */
  private async handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body: Buffer;
    try {
      body = await this.readBody(req);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json', Connection: 'close' });
      res.end(JSON.stringify({ ok: false, error: 'Bad request.' }));
      return;
    }
    const parsed = parseMultipart(body, req.headers['content-type']);
    const relayPassword = this.callbacks.getPassword();
    const supplied = (parsed && getField(parsed, 'password')) || '';
    if (!relayPassword || supplied !== relayPassword) {
      res.writeHead(401, { 'Content-Type': 'application/json', Connection: 'close' });
      res.end(JSON.stringify({ ok: false, error: 'Incorrect password.' }));
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': this.createSession(),
      Connection: 'close'
    });
    res.end(JSON.stringify({ ok: true }));
  }

  /** Handle a multipart upload from the browser page (JSON response). */
  private async handleBrowserUpload(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const json = (status: number, payload: Record<string, unknown>) => {
      res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' });
      res.end(JSON.stringify(payload));
    };

    let body: Buffer;
    try {
      body = await this.readBody(req);
    } catch {
      json(413, { success: false, error: 'Upload too large.' });
      return;
    }

    const parsed = parseMultipart(body, req.headers['content-type']);

    // Same machine (same IP as RDS) proceeds. A remote device must have logged in
    // (valid session) AND clear the allow-prompt on the RDS host.
    if (!this.isSameMachine(req)) {
      if (!this.hasValidSession(req)) {
        json(401, { success: false, error: 'Session expired — reload the page and sign in again.' });
        return;
      }
      if (!(await this.authorizeRequest(req))) {
        json(403, { success: false, error: 'The Roku Dev Studio host denied this device.' });
        return;
      }
    }

    const file = parsed ? getFirstFile(parsed) : undefined;
    if (!file || !file.data || file.data.length === 0) {
      json(400, { success: false, error: 'No .zip or .pkg received.' });
      return;
    }
    if (!this.saveAndDispatch(file, parsed)) {
      json(500, { success: false, error: 'Could not save the package.' });
      return;
    }
    const targetCount = (this.callbacks.getTargets?.() || []).length;
    json(200, {
      success: true,
      message: `Install Success — fanning out to ${targetCount} device${targetCount === 1 ? '' : 's'}.`
    });
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
