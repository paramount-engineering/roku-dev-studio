/**
 * Roku ECP emulator (TCP :8060) for the Sideload Relay.
 *
 * Presents a *complete* Roku External Control Protocol surface so that with
 * `host = <RDS-ip>` the whole VS Code "BrightScript Debug: Launch" pre-flight
 * (and roku-deploy's discovery/`getDeviceInfo`) succeeds against RDS itself,
 * independent of any real device being reachable:
 *
 *   GET  /                     → UPnP root device description (the SSDP LOCATION)
 *   GET  /query/device-info    → developer-enabled Roku device-info XML
 *   GET  /query/apps           → app list (includes the "dev" channel)
 *   GET  /query/active-app     → active app
 *   GET  /query/icon/<id>      → 1x1 PNG
 *   POST /keypress|keydown|keyup|launch|install|input|search|exit-app → 200 ack
 *   other /query/*             → 200 <status>OK</status>;  else 404
 *
 * Every response carries a `Server: Roku ...` header (roku-deploy sniffs it).
 * Side-effecting commands (keypress/launch/…) are ACKed but NOT propagated to
 * the real devices: once a build is handed over, the IDE's debug session talks
 * only to RDS's fake Roku and must not drive (or kill) the fleet — the devices
 * run under RDS's own control. In particular VS Code's Stop/disconnect presses
 * Home on the host; forwarding that used to exit the channel on every device.
 * A Home press is instead used only to end the emulated debug session (see
 * `onHomePress`). The binary debug protocol (8081) and telnet console (8085)
 * are emulated by `debug-endpoints` (a handshake stub + live status console).
 *
 * Modeled on a standalone Python Roku emulator proven to be discovered/listed
 * by the RokuCommunity BrightScript VS Code extension.
 */

import type { IncomingMessage, ServerResponse } from 'http';

const http = require('http');
const { mainWarn } = require('../log');
const { ECP_PORT } = require('../../shared/sideload-relay/types');
const {
  syntheticDeviceInfoXml,
  RELAY_FAKE_SERIAL,
  RELAY_FAKE_MODEL_NAME,
  RELAY_FAKE_DEVICE_NAME,
  RELAY_FAKE_UUID
} = require('./fake-device-info');

const SERVER_HEADER = 'Roku UPnP/1.0 MiniUPnPd/1.4';

/** 1x1 transparent PNG so `/query/icon/*` requests succeed. */
const ONE_PX_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d' +
    '49444154789c6360000002000001e221bc330000000049454e44ae426082',
  'hex'
);

const APPS_XML =
  '<?xml version="1.0" encoding="UTF-8" ?>\n<apps>\n' +
  '    <app id="dev" type="appl" version="1.0.0">Sideloaded Dev Channel</app>\n' +
  '</apps>';

const ACTIVE_APP_XML =
  '<?xml version="1.0" encoding="UTF-8" ?>\n<active-app>\n' +
  '    <app id="dev">Sideloaded Dev Channel</app>\n</active-app>';

function rootDescriptionXml(location: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" ?>',
    '<root xmlns="urn:schemas-upnp-org:device-1-0">',
    '  <specVersion><major>1</major><minor>0</minor></specVersion>',
    `  <URLBase>${location}</URLBase>`,
    '  <device>',
    '    <deviceType>urn:roku-com:device:player:1-0</deviceType>',
    `    <friendlyName>${RELAY_FAKE_DEVICE_NAME}</friendlyName>`,
    '    <manufacturer>Roku</manufacturer>',
    `    <modelName>${RELAY_FAKE_MODEL_NAME}</modelName>`,
    `    <serialNumber>${RELAY_FAKE_SERIAL}</serialNumber>`,
    `    <UDN>${RELAY_FAKE_UUID}</UDN>`,
    '    <serviceList>',
    '      <service>',
    '        <serviceType>urn:roku-com:service:ecp:1</serviceType>',
    '        <serviceId>urn:roku-com:serviceId:ecp1-0</serviceId>',
    '        <controlURL/>',
    '        <eventSubURL/>',
    '        <SCPDURL>ecp_SCPD.xml</SCPDURL>',
    '      </service>',
    '    </serviceList>',
    '  </device>',
    '</root>'
  ].join('\n');
}

/** ECP paths whose POST is a side effect we forward to real devices. */
const COMMAND_PREFIXES = ['/keypress/', '/keydown/', '/keyup/', '/launch/', '/install/', '/input', '/search', '/exit-app'];

export interface RokuEmulatorCallbacks {
  /**
   * A Home keypress was received on the ECP surface. Used to mimic a real
   * Roku's "press Home → app exits → debugger disconnects" flow by signalling
   * an app exit on the 8085 console. Best-effort. NOT forwarded to devices.
   */
  onHomePress?: () => void;
}

export class RokuEmulator {
  private readonly cb: RokuEmulatorCallbacks;

  constructor(cb: RokuEmulatorCallbacks) {
    this.cb = cb;
  }

  private send(res: ServerResponse, body: string | Buffer, status = 200, contentType = 'text/xml; charset=utf-8'): void {
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
    res.writeHead(status, {
      'Content-Type': contentType,
      'Content-Length': payload.length,
      Server: SERVER_HEADER,
      Connection: 'close'
    });
    res.end(payload);
  }

  /** The requestListener to mount on the 8060 http server. */
  handle = (req: IncomingMessage, res: ServerResponse): void => {
    const method = (req.method || 'GET').toUpperCase();
    const fullPath = req.url || '/';
    const path = fullPath.split('?', 1)[0]!.replace(/\/+$/, '');
    const host = (req.headers.host || `127.0.0.1:${ECP_PORT}`).split(':')[0];
    const location = `http://${host}:${ECP_PORT}/`;

    // Drain any request body so the socket can close cleanly (we don't relay it).
    req.on('data', () => undefined);
    req.on('error', () => undefined);
    req.on('end', () => {
      try {
        this.route(res, method, path, location);
      } catch (e) {
        mainWarn('[SideloadRelay] emulator route error:', (e as Error)?.message || e);
        try {
          this.send(res, 'error', 500, 'text/plain');
        } catch {
          /* ignore */
        }
      }
    });
  };

  private route(
    res: ServerResponse,
    method: string,
    path: string,
    location: string
  ): void {
    // Read-only queries — answered entirely by the emulator.
    if (path === '' || path === '/') return this.send(res, rootDescriptionXml(location));
    if (path === '/query/device-info') return this.send(res, syntheticDeviceInfoXml());
    if (path === '/query/apps') return this.send(res, APPS_XML);
    if (path === '/query/active-app') return this.send(res, ACTIVE_APP_XML);
    if (path.startsWith('/query/icon/')) return this.send(res, ONE_PX_PNG, 200, 'image/png');

    // Side-effecting commands: ACK like a real Roku, but do NOT drive the real
    // devices — the IDE must not control the fleet once a build is handed over.
    if (COMMAND_PREFIXES.some((p) => path === p.replace(/\/$/, '') || path.startsWith(p))) {
      if (method !== 'GET' && method !== 'HEAD') {
        // A Home press (e.g. VS Code Stop/disconnect) ends the emulated debug
        // session cleanly — but is intentionally not forwarded to any device.
        if (path.toLowerCase() === '/keypress/home') {
          try {
            this.cb.onHomePress?.();
          } catch {
            /* best-effort */
          }
        }
      }
      return this.send(res, '', 200, 'text/plain');
    }

    // Unknown query paths behave like a real Roku (200, not 404); everything else 404.
    if (path.startsWith('/query/')) return this.send(res, '<?xml version="1.0"?>\n<status>OK</status>');
    return this.send(res, 'Not Found', 404, 'text/plain');
  }

  /** Create + return an http.Server bound to 8060 running this emulator. */
  listen(): Promise<import('http').Server> {
    return new Promise((resolve, reject) => {
      const srv = http.createServer(this.handle);
      srv.on('error', reject);
      srv.listen(ECP_PORT, () => resolve(srv));
    });
  }
}
