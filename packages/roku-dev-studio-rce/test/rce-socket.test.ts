/**
 * Unit tests for RceSocket against a real local WebSocket server (no live RCE instance needed —
 * `urlOverride` points at localhost instead of `device.rce.roku.com`). Covers the properties that
 * matter for telnet/debugger/RALE to work unmodified behind this socket: writes reach the far
 * end, far-end messages arrive as readable `data`, and a server-initiated close surfaces as a
 * clean `end` (not an error) — see design doc §2/§10 on this being the shared tunnel for all three.
 *
 * Run: `npm test -w roku-dev-studio-rce`
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { WebSocketServer } from 'ws';

import { RceSocket, buildPortBridgeUrl, connectRceSocket } from '../rce-socket';

function startEchoServer(): Promise<{ url: string; wss: WebSocketServer; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const wss = new WebSocketServer({ port: 0 }, () => {
      const address = wss.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        url: `ws://127.0.0.1:${port}`,
        wss,
        close: () => new Promise((res) => wss.close(() => res()))
      });
    });
  });
}

describe('buildPortBridgeUrl', () => {
  // Same confirmed-live bug as rce-ecp.test.ts's regression test: a protocol-prefixed
  // instanceApiUrl must not produce a doubled-protocol (unreachable) URL.
  it('does not double the protocol when instanceApiUrl already includes one', () => {
    assert.equal(
      buildPortBridgeUrl('https://device.rce.roku.com/instance/abc', 8085),
      'wss://device.rce.roku.com/instance/abc/api/v0/ports/8085'
    );
  });

  it('works with a bare host+path (no protocol)', () => {
    assert.equal(
      buildPortBridgeUrl('device.rce.roku.com/instance/abc', 8085),
      'wss://device.rce.roku.com/instance/abc/api/v0/ports/8085'
    );
  });
});

describe('RceSocket', () => {
  it('delivers writes to the server and server sends back as readable data', async () => {
    const { url, wss, close } = await startEchoServer();
    try {
      wss.on('connection', (ws) => {
        ws.on('message', (data) => ws.send(data));
      });

      const socket = new RceSocket({ instanceApiUrl: 'unused', token: 'tok', port: 8085, urlOverride: url });
      const received = await new Promise<Buffer>((resolve, reject) => {
        socket.on('data', resolve);
        socket.on('error', reject);
        socket.write(Buffer.from('hello'));
      });

      assert.equal(received.toString('utf8'), 'hello');
      socket.destroy();
    } finally {
      await close();
    }
  });

  it('buffers writes made before the WebSocket handshake completes', async () => {
    const { url, wss, close } = await startEchoServer();
    try {
      wss.on('connection', (ws) => {
        ws.on('message', (data) => ws.send(data));
      });

      const socket = new RceSocket({ instanceApiUrl: 'unused', token: 'tok', port: 8085, urlOverride: url });
      // Written synchronously, before the 'open' handshake can possibly have completed.
      socket.write(Buffer.from('queued'));

      const received = await new Promise<Buffer>((resolve, reject) => {
        socket.on('data', resolve);
        socket.on('error', reject);
      });

      assert.equal(received.toString('utf8'), 'queued');
      socket.destroy();
    } finally {
      await close();
    }
  });

  it('surfaces a server-initiated close as a clean end, not an error', async () => {
    const { url, wss, close } = await startEchoServer();
    try {
      wss.on('connection', (ws) => {
        ws.close();
      });

      const socket = new RceSocket({ instanceApiUrl: 'unused', token: 'tok', port: 8085, urlOverride: url });
      let errored = false;
      socket.on('error', () => {
        errored = true;
      });
      // A Readable with only an 'end' listener stays paused and never emits 'end' — resume()
      // (or a 'data' listener) is required to put it in flowing mode.
      socket.resume();
      await new Promise<void>((resolve) => socket.on('end', resolve));

      assert.equal(errored, false);
      socket.destroy();
    } finally {
      await close();
    }
  });
});

describe('connectRceSocket', () => {
  it('resolves success once the tunnel is open', async () => {
    const { url, wss, close } = await startEchoServer();
    try {
      const result = await connectRceSocket({ instanceApiUrl: 'unused', token: 'tok', port: 8080, urlOverride: url });
      assert.equal(result.success, true);
      if (result.success) result.socket.destroy();
    } finally {
      await close();
    }
  });

  it('resolves failure when the server refuses the connection', async () => {
    // Nothing listening on this port — the WebSocket handshake fails fast with an error.
    const result = await connectRceSocket({
      instanceApiUrl: 'unused',
      token: 'tok',
      port: 8080,
      urlOverride: 'ws://127.0.0.1:1',
      connectTimeoutMs: 2000
    });
    assert.equal(result.success, false);
  });
});
