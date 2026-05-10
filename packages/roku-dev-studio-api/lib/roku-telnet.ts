/**
 * Raw TCP to Roku telnet ports (BrightScript debug + system shell).
 * Used by Roku Dev Studio main process and remote relay server — single implementation.
 */

'use strict';

import type { Socket } from 'net';

const net = require('net');
const { DEFAULT_TELNET_CONNECT_TIMEOUT_MS } = require('./shared-constants');

const ROKU_DEBUG_TELNET_PORT = 8085;
const ROKU_SYSTEM_TELNET_PORT = 8080;

/**
 * @param {string} ip
 * @param {number} port
 * @param {{ connectTimeoutMs?: number }} [opts]
 * @returns {Promise<{ success: true, socket: import('net').Socket } | { success: false, error: string }>}
 */
function connectRokuTcp(
  ip: string,
  port: number,
  opts: { connectTimeoutMs?: number } = {}
): Promise<{ success: true; socket: Socket } | { success: false; error: string }> {
  const connectTimeoutMs =
    typeof opts.connectTimeoutMs === 'number' && opts.connectTimeoutMs > 0
      ? opts.connectTimeoutMs
      : DEFAULT_TELNET_CONNECT_TIMEOUT_MS;

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let connected = false;
    let resolved = false;

    socket.setTimeout(connectTimeoutMs);

    socket.on('connect', () => {
      connected = true;
      socket.setTimeout(0);
      if (!resolved) {
        resolved = true;
        resolve({ success: true, socket });
      }
    });

    socket.on('error', (err: Error) => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: err.message });
      }
    });

    socket.on('timeout', () => {
      if (!connected && !resolved) {
        resolved = true;
        socket.destroy();
        resolve({ success: false, error: 'Connection timed out' });
      }
    });

    socket.connect(port, ip);
  });
}

function connectRokuDebugTelnet(ip: string, opts?: { connectTimeoutMs?: number }) {
  return connectRokuTcp(ip, ROKU_DEBUG_TELNET_PORT, opts ?? {});
}

function connectRokuSystemTelnet(ip: string, opts?: { connectTimeoutMs?: number }) {
  return connectRokuTcp(ip, ROKU_SYSTEM_TELNET_PORT, opts ?? {});
}

/**
 * @param {import('net').Socket} socket
 * @param {string} command
 * @param {{ lineEnding?: '\r\n' | '\n' }} [opts] — system console (8080) typically uses \n
 */
function writeRokuTelnetLine(
  socket: Socket,
  command: string,
  opts: { lineEnding?: '\r\n' | '\n' } = {}
): { success: true } | { success: false; error: string } {
  const eol = opts.lineEnding === '\n' ? '\n' : '\r\n';
  if (!socket || socket.destroyed) {
    return { success: false, error: 'Not connected' };
  }
  try {
    socket.write(String(command) + eol);
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

module.exports = {
  ROKU_DEBUG_TELNET_PORT,
  ROKU_SYSTEM_TELNET_PORT,
  DEFAULT_TELNET_CONNECT_TIMEOUT_MS,
  connectRokuTcp,
  connectRokuDebugTelnet,
  connectRokuSystemTelnet,
  writeRokuTelnetLine
};
