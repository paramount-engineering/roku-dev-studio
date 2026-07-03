/**
 * Direct TCP RALE (App Connector) session — same wire protocol as roku-dev-studio-remote-server.
 */

'use strict';

import type { Socket } from 'net';

const net = require('net');
const crypto = require('crypto');
const { ecpRequest } = require('../ecp');
const { DEFAULT_RALE_PORT } = require('./shared-constants');
const { errorMessage } = require('roku-dev-studio-platform');

const connections = new Map<string, Socket>();
// Per-connection serial queue: concurrent raleCommand() calls on the same socket
// would attach multiple 'data' listeners with separate buffers and race on '[end]',
// cross-contaminating responses. A chain-per-connection keeps commands sequential.
const commandChains = new Map<string, Promise<unknown>>();
// Bytes received after a command's `[end]` (e.g. a second framed message the device pushed
// in the same TCP chunk). The old code discarded these on listener removal, so a following
// frame was lost and the next command hung until timeout. We stash the tail here and seed
// the next runOne with it. Commands are serialized (commandChains), so this can't interleave.
const recvBuffers = new Map<string, string>();

function randomUUID() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
}

/**
 * Wake TrackerTask via ECP.
 * @param {string} ip
 * @param {number} [port=49200]
 */
function raleWake(ip: string, port = DEFAULT_RALE_PORT) {
  return ecpRequest(
    ip,
    {
      path: `/input?rale=true&port=${port}`,
      method: 'POST',
      timeout: 5000
    },
    { timeout: 5000 }
  );
}

/**
 * @param {string} ip
 * @param {number} [port=49200]
 * @param {{ onClose?: (connectionId: string) => void }} [connectOpts] — invoked after socket closes (e.g. notify UI)
 * @returns {Promise<{ success: boolean, connectionId?: string, error?: string }>}
 */
function raleConnect(
  ip: string,
  port = DEFAULT_RALE_PORT,
  connectOpts: { onClose?: (connectionId: string) => void } = {}
) {
  const onClose =
    connectOpts && typeof connectOpts.onClose === 'function' ? connectOpts.onClose : null;
  const connectionId = `${ip}:${port}`;

  if (connections.has(connectionId)) {
    const old = connections.get(connectionId);
    if (old) {
      try {
        old.destroy();
      } catch (_) {}
    }
    connections.delete(connectionId);
  }

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let connected = false;
    let resolved = false;

    socket.setKeepAlive(true, 5000);

    socket.on('connect', () => {
      connected = true;
      socket.setTimeout(0);
      connections.set(connectionId, socket);
      if (!resolved) {
        resolved = true;
        resolve({ success: true, connectionId });
      }
    });

    socket.on('error', (error: Error) => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: error.message });
      }
    });

    socket.on('timeout', () => {
      if (!connected && !resolved) {
        resolved = true;
        socket.destroy();
        resolve({ success: false, error: 'Connection timed out' });
      }
    });

    socket.on('close', () => {
      connections.delete(connectionId);
      commandChains.delete(connectionId);
      recvBuffers.delete(connectionId);
      if (onClose) {
        try {
          onClose(connectionId);
        } catch (_) {}
      }
    });

    socket.setTimeout(10000);
    socket.connect(port, ip);
  });
}

/**
 * @param {string} connectionId
 * @param {string} command
 * @param {object} [args]
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<object>}
 */
function raleCommand(
  connectionId: string,
  command: string,
  args: unknown,
  opts: { timeoutMs?: number } = {}
) {
  const timeoutMs =
    typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0 ? opts.timeoutMs : 30000;

  const socket = connections.get(connectionId);
  if (!socket || socket.destroyed) {
    return Promise.resolve({ success: false, error: 'Not connected' });
  }

  const prev = commandChains.get(connectionId) ?? Promise.resolve();
  const runner = prev.then(() => runOne(socket, connectionId, command, args, timeoutMs));
  commandChains.set(
    connectionId,
    runner.finally(() => {
      if (commandChains.get(connectionId) === runner) commandChains.delete(connectionId);
    })
  );
  return runner;
}

function runOne(
  socket: Socket,
  connectionId: string,
  command: string,
  args: unknown,
  timeoutMs: number
) {
  if (socket.destroyed || connections.get(connectionId) !== socket) {
    return Promise.resolve({ success: false, error: 'Not connected' });
  }

  return new Promise((resolve) => {
    const uuid = randomUUID();
    const payload = JSON.stringify({ command, args: args || {}, uuid });
    const message = `[start]${payload}[end]`;

    let responseData = '';
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let resolved = false;

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      socket.removeListener('data', onData);
    };

    const onData = (data: Buffer) => {
      if (resolved) return;
      responseData += data.toString();

      // Consume exactly the FIRST complete frame. Using lastIndexOf (old behavior) would
      // merge two back-to-back frames into one and parse across them; indexOf takes one.
      const endIdx = responseData.indexOf('[end]');
      if (endIdx === -1) return;

      resolved = true;
      cleanup();

      const frame = responseData.slice(0, endIdx);
      // Preserve any bytes after this frame for the next serialized command.
      const leftover = responseData.slice(endIdx + '[end]'.length);
      if (leftover.length > 0) recvBuffers.set(connectionId, leftover);

      try {
        const startIdx = frame.indexOf('[start]');
        if (startIdx !== -1) {
          let content = frame.substring(startIdx + 7);

          const uuidPrefixMatch = content.match(/^\[uuid:(\d+)\]/);
          if (uuidPrefixMatch) {
            const uuidLen = parseInt(uuidPrefixMatch[1], 10);
            const prefixLen = uuidPrefixMatch[0].length;
            content = content.substring(prefixLen + uuidLen);
          }

          try {
            const result = JSON.parse(content);
            resolve({ success: true, data: result, uuid });
          } catch {
            resolve({ success: true, data: content, uuid, raw: true });
          }
        } else {
          resolve({ success: true, data: frame, uuid, raw: true });
        }
      } catch (e: unknown) {
        resolve({ success: true, data: frame, uuid, parseError: errorMessage(e) });
      }
    };

    socket.on('data', onData);

    timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({ success: false, error: 'Command timed out', uuid, partial: responseData });
      }
    }, timeoutMs);

    // Always send the command FIRST (never skip the write), then feed any tail left over
    // from the previous command's frame. Feeding after the write means a response that was
    // split right after a previous `[end]` completes here instead of being lost.
    socket.write(message);
    const seeded = recvBuffers.get(connectionId);
    if (seeded) {
      recvBuffers.delete(connectionId);
      onData(Buffer.from(seeded));
    }
  });
}

function raleDisconnect(connectionId: string) {
  const socket = connections.get(connectionId);
  if (socket) {
    try {
      socket.destroy();
    } catch (_) {}
    connections.delete(connectionId);
  }
  commandChains.delete(connectionId);
  recvBuffers.delete(connectionId);
  return { success: true };
}

function raleDisconnectAll() {
  for (const id of [...connections.keys()]) {
    raleDisconnect(id);
  }
}

/** Whether a RALE TCP session is still open (same connectionId as raleConnect). */
function raleConnectionStatus(connectionId: string) {
  const socket = connections.get(connectionId);
  return { success: true, connected: !!(socket && !socket.destroyed) };
}

module.exports = {
  DEFAULT_RALE_PORT,
  raleWake,
  raleConnect,
  raleCommand,
  raleDisconnect,
  raleDisconnectAll,
  raleConnectionStatus
};
