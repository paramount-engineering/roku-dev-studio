/**
 * P4 — "BrightScript Debug: Launch" support.
 *
 * With `host = <RDS-ip>`, VS Code's roku-debug sends ECP (8060), the debug
 * protocol control socket (8081), and the telnet console (8085) to RDS instead
 * of a device. RDS designates one target as the **primary/debug device** and:
 *
 *   - **8060 (ECP)** — reverse-proxied to the primary. device-info returns the
 *     primary's real `developerEnabled=true` XML (so roku-debug's pre-flight
 *     passes); Home-press / deep-link are forwarded to the primary and
 *     optionally replayed to the rest of the fleet.
 *   - **8081 / 8085** — transparent TCP relays to the primary. Because both are
 *     opaque socket streams, RDS forwards bytes without parsing the debug
 *     protocol; the debugger attaches to the primary and breakpoints work there.
 *
 * The sideload itself (port 80) is handled by the ingest server + fan-out; this
 * module only covers the three fixed Roku ports the debugger assumes.
 */

import type { IncomingMessage, ServerResponse, Server } from 'http';
import type { Server as NetServer, Socket } from 'net';

const http = require('http');
const net = require('net');
const { mainLog, mainWarn } = require('../log');
const {
  ECP_PORT,
  DEBUG_CONTROL_PORT,
  DEBUG_CONSOLE_PORT
} = require('../../shared/sideload-relay/types');
const { syntheticDeviceInfoXml } = require('./fake-device-info');

export interface DebugProxyCallbacks {
  /** ip of the current primary/debug device, or null when none is set. */
  getPrimaryIp: () => string | null;
  /** Other enabled target IPs to optionally replay keypress/launch to (best-effort). */
  getReplayIps: () => string[];
}

export class DebugProxy {
  private ecpServer: Server | null = null;
  private controlServer: NetServer | null = null;
  private consoleServer: NetServer | null = null;
  private listening = false;
  private lastError: string | undefined;
  private readonly cb: DebugProxyCallbacks;

  constructor(cb: DebugProxyCallbacks) {
    this.cb = cb;
  }

  isListening(): boolean {
    return this.listening;
  }
  getLastError(): string | undefined {
    return this.lastError;
  }

  async start(): Promise<void> {
    if (this.listening) return;
    this.lastError = undefined;
    try {
      this.ecpServer = await this.startEcp();
      this.controlServer = await this.startTcpProxy(DEBUG_CONTROL_PORT, 'debug-control');
      this.consoleServer = await this.startTcpProxy(DEBUG_CONSOLE_PORT, 'debug-console');
      this.listening = true;
      mainLog(`[SideloadRelay] debug proxy up (ECP :${ECP_PORT}, control :${DEBUG_CONTROL_PORT}, console :${DEBUG_CONSOLE_PORT})`);
    } catch (e) {
      this.lastError = (e as Error)?.message || String(e);
      mainWarn('[SideloadRelay] debug proxy failed to start:', this.lastError);
      await this.stop();
      throw e;
    }
  }

  async stop(): Promise<void> {
    this.listening = false;
    const close = (srv: Server | NetServer | null) =>
      new Promise<void>((resolve) => {
        if (!srv) return resolve();
        srv.close(() => resolve());
      });
    await Promise.all([close(this.ecpServer), close(this.controlServer), close(this.consoleServer)]);
    this.ecpServer = null;
    this.controlServer = null;
    this.consoleServer = null;
  }

  private startEcp(): Promise<Server> {
    return new Promise((resolve, reject) => {
      const srv: Server = http.createServer((req: IncomingMessage, res: ServerResponse) =>
        this.handleEcp(req, res)
      );
      srv.on('error', reject);
      srv.listen(ECP_PORT, () => resolve(srv));
    });
  }

  private handleEcp(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url || '/';

    // Answer device-info ourselves with a synthetic developer-enabled Roku so
    // roku-debug's pre-flight passes even when no primary is reachable, and so
    // RDS presents as a Roku when a discoverer follows the SSDP LOCATION.
    if ((req.method || 'GET').toUpperCase() === 'GET' && /^\/query\/device-info\b/.test(url)) {
      const xml = syntheticDeviceInfoXml();
      res.writeHead(200, {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(xml),
        Connection: 'close'
      });
      res.end(xml);
      return;
    }

    const primary = this.cb.getPrimaryIp();
    if (!primary) {
      res.writeHead(503, { Connection: 'close' });
      res.end('No primary/debug device selected in Roku Dev Studio.');
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('error', () => {
      try {
        res.writeHead(502, { Connection: 'close' });
        res.end('proxy error');
      } catch {
        /* ignore */
      }
    });
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const headers = { ...req.headers, host: `${primary}:${ECP_PORT}` };
      const proxied = http.request(
        { host: primary, port: ECP_PORT, path: url, method: req.method, headers },
        (pres: IncomingMessage) => {
          res.writeHead(pres.statusCode || 502, pres.headers as Record<string, string>);
          pres.pipe(res);
        }
      );
      proxied.on('error', (e: Error) => {
        mainWarn('[SideloadRelay] ECP proxy error:', e.message);
        try {
          res.writeHead(502, { Connection: 'close' });
          res.end('proxy error');
        } catch {
          /* ignore */
        }
      });
      if (body.length) proxied.write(body);
      proxied.end();

      // Optionally replay side-effecting keypress/launch to the rest of the fleet
      // so the whole set follows the debugger's navigation. Best-effort, fire-and-forget.
      if (req.method === 'POST' && /^\/(keypress|launch)\//i.test(url)) {
        for (const ip of this.cb.getReplayIps()) {
          if (ip === primary) continue;
          this.replay(ip, url, req.method, body);
        }
      }
    });
  }

  private replay(ip: string, url: string, method: string | undefined, body: Buffer): void {
    try {
      const r = http.request(
        { host: ip, port: ECP_PORT, path: url, method: method || 'POST', timeout: 4000 },
        (pr: IncomingMessage) => pr.resume()
      );
      r.on('error', () => undefined);
      r.on('timeout', () => r.destroy());
      if (body.length) r.write(body);
      r.end();
    } catch {
      /* best-effort */
    }
  }

  private startTcpProxy(port: number, label: string): Promise<NetServer> {
    return new Promise((resolve, reject) => {
      const srv: NetServer = net.createServer((client: Socket) => {
        const primary = this.cb.getPrimaryIp();
        if (!primary) {
          client.destroy();
          return;
        }
        const upstream: Socket = net.connect(port, primary);
        const teardown = () => {
          client.destroy();
          upstream.destroy();
        };
        client.on('error', teardown);
        upstream.on('error', (e: Error) => {
          mainWarn(`[SideloadRelay] ${label} upstream error (${primary}:${port}):`, e.message);
          teardown();
        });
        client.on('close', () => upstream.destroy());
        upstream.on('close', () => client.destroy());
        client.pipe(upstream);
        upstream.pipe(client);
      });
      srv.on('error', reject);
      srv.listen(port, () => resolve(srv));
    });
  }
}
