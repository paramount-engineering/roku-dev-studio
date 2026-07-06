/**
 * SSDP responder — makes RDS discoverable as a Roku by VS Code's BrightScript
 * extension (and roku-deploy's `discover()`), so `"host": "${promptForHost}"`
 * lists the relay without the dev hand-typing the machine IP.
 *
 * SSDP is fixed to UDP multicast group 239.255.255.250:1900 (that's where
 * clients send `M-SEARCH` and every Roku listens), so this binds there. On an
 * `M-SEARCH` for `roku:ecp` (or `ssdp:all`) it unicasts a Roku-shaped 200 OK
 * whose LOCATION points at the relay's own ECP proxy (:8060); the follow-up
 * `/query/device-info` is answered by the debug proxy with the synthetic Roku
 * identity. Advertises the fake serial/USN so RDS can filter itself back out of
 * discovery.
 *
 * Fail-soft: if port 1900 is already held (e.g. Windows "SSDP Discovery"
 * service), it logs and stays off — manual `host=<RDS-ip>` still works.
 */

import type { Socket, RemoteInfo } from 'dgram';

const dgram = require('dgram');
const os = require('os');
const { mainLog, mainWarn } = require('../log');
const { ECP_PORT } = require('../../shared/sideload-relay/types');
const { RELAY_FAKE_UDN, RELAY_FAKE_SOFTWARE_VERSION } = require('./fake-device-info');

const SSDP_ADDR = '239.255.255.250';
const SSDP_PORT = 1900;
const ST_ROKU = 'roku:ecp';

function firstLanIpv4(): string | null {
  try {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const info of ifaces[name] || []) {
        if (info && info.family === 'IPv4' && !info.internal) return info.address;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export class SsdpResponder {
  private socket: Socket | null = null;
  private listening = false;

  isListening(): boolean {
    return this.listening;
  }

  private buildResponse(location: string): Buffer {
    return Buffer.from(
      [
        'HTTP/1.1 200 OK',
        'Cache-Control: max-age=3600',
        'Ext:',
        `Location: ${location}`,
        'ST: roku:ecp',
        `USN: ${RELAY_FAKE_UDN}`,
        `Server: Roku/${RELAY_FAKE_SOFTWARE_VERSION} UPnP/1.0 Roku/${RELAY_FAKE_SOFTWARE_VERSION}`,
        '',
        ''
      ].join('\r\n')
    );
  }

  private buildNotify(location: string, alive: boolean): Buffer {
    const lines = [
      'NOTIFY * HTTP/1.1',
      `HOST: ${SSDP_ADDR}:${SSDP_PORT}`,
      `NT: ${ST_ROKU}`,
      `NTS: ${alive ? 'ssdp:alive' : 'ssdp:byebye'}`,
      `USN: ${RELAY_FAKE_UDN}`
    ];
    if (alive) {
      lines.push('Cache-Control: max-age=3600', `Location: ${location}`, `Server: Roku/${RELAY_FAKE_SOFTWARE_VERSION} UPnP/1.0`);
    }
    lines.push('', '');
    return Buffer.from(lines.join('\r\n'));
  }

  private currentLocation(): string | null {
    const ip = firstLanIpv4();
    return ip ? `http://${ip}:${ECP_PORT}/` : null;
  }

  start(): Promise<void> {
    if (this.listening) return Promise.resolve();
    return new Promise((resolve) => {
      const socket: Socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      socket.on('error', (err: NodeJS.ErrnoException) => {
        // A busy 1900 (Windows SSDP service, another UPnP tool) is non-fatal:
        // the relay still works via a manually-configured host.
        mainWarn(`[SideloadRelay] SSDP responder disabled (${err.code || err.message}); manual host still works.`);
        try {
          socket.close();
        } catch {
          /* ignore */
        }
        this.socket = null;
        this.listening = false;
        resolve();
      });

      socket.on('message', (msg: Buffer, rinfo: RemoteInfo) => {
        const text = msg.toString('utf8');
        if (!/^M-SEARCH\s/i.test(text)) return;
        // A real Roku only answers a proper discovery request.
        if (!/\bMAN:\s*"?ssdp:discover"?/i.test(text)) return;
        const stMatch = /\bST:\s*([^\r\n]+)/i.exec(text);
        const st = stMatch ? stMatch[1]!.trim().toLowerCase() : '';
        // Answer Roku-targeted and wildcard searches; ignore unrelated device queries.
        if (st && !(st === ST_ROKU || st === 'ssdp:all' || st === 'upnp:rootdevice')) return;
        const location = this.currentLocation();
        if (!location) return;
        const resp = this.buildResponse(location);
        socket.send(resp, rinfo.port, rinfo.address);
      });

      socket.bind(SSDP_PORT, () => {
        // Join the group on the specific LAN interface (multi-homed machines
        // otherwise join the wrong NIC and never see the M-SEARCH), and cap the
        // multicast TTL like a LAN device.
        const iface = firstLanIpv4();
        try {
          socket.addMembership(SSDP_ADDR, iface || undefined);
        } catch (e) {
          // Fall back to the default interface if the scoped join fails.
          try {
            socket.addMembership(SSDP_ADDR);
          } catch (e2) {
            mainWarn('[SideloadRelay] SSDP addMembership failed:', (e2 as Error)?.message || e2);
          }
        }
        try {
          socket.setMulticastTTL(4);
        } catch {
          /* ignore */
        }
        this.socket = socket;
        this.listening = true;
        mainLog('[SideloadRelay] SSDP responder listening on :1900 (advertising as a Roku for VS Code discovery)');
        // Proactively announce presence so passive listeners see us without an explicit search.
        const location = this.currentLocation();
        if (location) {
          try {
            socket.send(this.buildNotify(location, true), SSDP_PORT, SSDP_ADDR);
          } catch {
            /* best-effort */
          }
        }
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    this.listening = false;
    if (!socket) return;
    // Politely retract the advertisement.
    const location = this.currentLocation();
    if (location) {
      try {
        socket.send(this.buildNotify(location, false), SSDP_PORT, SSDP_ADDR);
      } catch {
        /* best-effort */
      }
    }
    await new Promise<void>((resolve) => {
      try {
        socket.close(() => resolve());
      } catch {
        resolve();
      }
    });
  }
}
