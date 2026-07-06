/**
 * P4 — transparent TCP proxies for the binary debug protocol (8081) and telnet
 * console (8085), relayed to the designated primary/debug device.
 *
 * These are opaque socket streams, so RDS forwards bytes without parsing the
 * debug protocol — the VS Code debugger attaches to the primary and breakpoints
 * / stepping / variables work there. They only make sense with a reachable
 * primary, so they're gated on the debug-proxy toggle + a selected primary.
 *
 * The ECP surface (8060) and SSDP discovery are handled separately by
 * {@link RokuEmulator} / {@link SsdpResponder} and run whenever the relay is
 * enabled, so RDS is discoverable in VS Code without also needing a primary.
 */

import type { Server as NetServer, Socket } from 'net';

const net = require('net');
const { mainLog, mainWarn } = require('../log');
const { DEBUG_CONTROL_PORT, DEBUG_CONSOLE_PORT } = require('../../shared/sideload-relay/types');

export interface DebugProxyCallbacks {
  /** ip of the current primary/debug device, or null when none is set. */
  getPrimaryIp: () => string | null;
}

export class DebugProxy {
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
      this.controlServer = await this.startTcpProxy(DEBUG_CONTROL_PORT, 'debug-control');
      this.consoleServer = await this.startTcpProxy(DEBUG_CONSOLE_PORT, 'debug-console');
      this.listening = true;
      mainLog(`[SideloadRelay] debug TCP proxies up (control :${DEBUG_CONTROL_PORT}, console :${DEBUG_CONSOLE_PORT} → primary)`);
    } catch (e) {
      this.lastError = (e as Error)?.message || String(e);
      mainWarn('[SideloadRelay] debug TCP proxies failed to start:', this.lastError);
      await this.stop();
      throw e;
    }
  }

  async stop(): Promise<void> {
    this.listening = false;
    const close = (srv: NetServer | null) =>
      new Promise<void>((resolve) => {
        if (!srv) return resolve();
        srv.close(() => resolve());
      });
    await Promise.all([close(this.controlServer), close(this.consoleServer)]);
    this.controlServer = null;
    this.consoleServer = null;
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
