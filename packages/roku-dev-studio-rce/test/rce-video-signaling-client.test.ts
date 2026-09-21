/**
 * Unit tests for RceVideoSignalingClient against a fake Janus WebSocket server — no live RCE
 * instance needed. The fake server implements just enough of the real Janus streaming-plugin
 * protocol (create/attach/message-watch/message-start/trickle/destroy/keepalive) to exercise the
 * client's request/response matching, transaction handling, and error surfacing.
 *
 * Run: `npm test -w roku-dev-studio-rce`
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { WebSocketServer, type WebSocket as WsSocket } from 'ws';

import { RceVideoSignalingClient } from '../rce-video-signaling-client';

interface FakeJanusOptions {
  /** Called for every parsed message; return a response object to send back, or undefined to send nothing. */
  onMessage: (message: any, ws: WsSocket) => any;
  /** Reject the WS upgrade outright (simulates an auth failure) — server never accepts. */
  rejectHandshake?: boolean;
}

function startFakeJanusServer(opts: FakeJanusOptions): Promise<{ url: string; wss: WebSocketServer; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const wss = new WebSocketServer({ port: 0, handleProtocols: () => 'janus-protocol' });
    wss.on('connection', (ws) => {
      if (opts.rejectHandshake) {
        ws.close(1008, 'rejected');
        return;
      }
      ws.on('message', (data) => {
        let message: any;
        try {
          message = JSON.parse(data.toString());
        } catch {
          return;
        }
        // Always ack async requests first, matching real Janus behavior — the client must ignore this.
        ws.send(JSON.stringify({ janus: 'ack', transaction: message.transaction }));
        const response = opts.onMessage(message, ws);
        if (response) ws.send(JSON.stringify({ ...response, transaction: message.transaction }));
      });
    });
    wss.on('listening', () => {
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

const FAKE_SDP_OFFER = { type: 'offer', sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n' };

/** Standard create → attach → watch flow every "happy path" test needs. */
function standardJanusFlow(message: any): any {
  if (message.janus === 'create') {
    return { janus: 'success', data: { id: 111 } };
  }
  if (message.janus === 'attach') {
    return { janus: 'success', data: { id: 222 } };
  }
  if (message.janus === 'message' && message.body?.request === 'watch') {
    return { janus: 'event', jsep: FAKE_SDP_OFFER, plugindata: { data: { streaming: 'preparing' } } };
  }
  if (message.janus === 'message' && message.body?.request === 'start') {
    return { janus: 'event', plugindata: { data: { streaming: 'started' } } };
  }
  return undefined;
}

describe('RceVideoSignalingClient', () => {
  it('negotiates create -> attach -> watch and resolves with the SDP offer + ICE servers', async () => {
    const { url, close } = await startFakeJanusServer({ onMessage: standardJanusFlow });
    try {
      const client = new RceVideoSignalingClient({
        websocketUrl: url,
        streamId: 1,
        apiToken: 'account-token',
        janusToken: 'janus-secret',
        iceServers: [{ urls: ['turn:ice.rce.roku.com:3478'], username: 'u', credential: 'c' }]
      });
      const result = await client.connect();
      assert.deepEqual(result.offer, FAKE_SDP_OFFER);
      assert.deepEqual(result.iceServers, [{ urls: ['turn:ice.rce.roku.com:3478'], username: 'u', credential: 'c' }]);
      client.stop();
    } finally {
      await close();
    }
  });

  it('sends the pin in the watch request body when configured', async () => {
    let sawPin: string | undefined;
    const { url, close } = await startFakeJanusServer({
      onMessage: (message) => {
        if (message.janus === 'message' && message.body?.request === 'watch') {
          sawPin = message.body.pin;
        }
        return standardJanusFlow(message);
      }
    });
    try {
      const client = new RceVideoSignalingClient({ websocketUrl: url, streamId: 1, apiToken: 'tok', pin: 'secret-pin' });
      await client.connect();
      assert.equal(sawPin, 'secret-pin');
      client.stop();
    } finally {
      await close();
    }
  });

  it('sends janusToken as apisecret on every request, not the account apiToken', async () => {
    const seenSecrets: unknown[] = [];
    const { url, close } = await startFakeJanusServer({
      onMessage: (message) => {
        seenSecrets.push(message.apisecret);
        return standardJanusFlow(message);
      }
    });
    try {
      const client = new RceVideoSignalingClient({ websocketUrl: url, streamId: 1, apiToken: 'account-bearer-token', janusToken: 'the-janus-secret' });
      await client.connect();
      assert.ok(seenSecrets.length > 0);
      assert.ok(seenSecrets.every((s) => s === 'the-janus-secret'));
      client.stop();
    } finally {
      await close();
    }
  });

  it('sendAnswer posts a start request with the jsep answer attached', async () => {
    let sawJsep: unknown;
    const { url, close } = await startFakeJanusServer({
      onMessage: (message) => {
        if (message.janus === 'message' && message.body?.request === 'start') {
          sawJsep = message.jsep;
        }
        return standardJanusFlow(message);
      }
    });
    try {
      const client = new RceVideoSignalingClient({ websocketUrl: url, streamId: 1, apiToken: 'tok' });
      await client.connect();
      const answer = { type: 'answer', sdp: 'v=0\r\n...' };
      await client.sendAnswer(answer);
      assert.deepEqual(sawJsep, answer);
      client.stop();
    } finally {
      await close();
    }
  });

  it('rejects connect() when the streaming plugin reports an error on watch (wrong pin)', async () => {
    const { url, close } = await startFakeJanusServer({
      onMessage: (message) => {
        if (message.janus === 'create') return { janus: 'success', data: { id: 1 } };
        if (message.janus === 'attach') return { janus: 'success', data: { id: 2 } };
        if (message.janus === 'message' && message.body?.request === 'watch') {
          // Plugin-level errors arrive as a normal 'event' with no jsep, per the real gateway.
          return { janus: 'event', plugindata: { data: { error: 'Unauthorized', error_code: 456 } } };
        }
        return undefined;
      }
    });
    try {
      const client = new RceVideoSignalingClient({ websocketUrl: url, streamId: 1, apiToken: 'tok', pin: 'wrong' });
      await assert.rejects(() => client.connect(), /Unauthorized/);
    } finally {
      await close();
    }
  });

  it('rejects connect() on a top-level Janus error', async () => {
    const { url, close } = await startFakeJanusServer({
      onMessage: (message) => {
        if (message.janus === 'create') return { janus: 'error', error: { code: 490, reason: 'Internal server error' } };
        return undefined;
      }
    });
    try {
      const client = new RceVideoSignalingClient({ websocketUrl: url, streamId: 1, apiToken: 'tok' });
      await assert.rejects(() => client.connect(), /Internal server error/);
    } finally {
      await close();
    }
  });

  it('rejects connect() if negotiation exceeds the timeout', async () => {
    const { url, close } = await startFakeJanusServer({ onMessage: () => undefined /* never answers */ });
    try {
      const client = new RceVideoSignalingClient({ websocketUrl: url, streamId: 1, apiToken: 'tok' }, { negotiationTimeoutMs: 200 });
      await assert.rejects(() => client.connect(), /Timed out negotiating/);
    } finally {
      await close();
    }
  });

  it('a second connect() while one is active rejects without stopping the first', async () => {
    const { url, close } = await startFakeJanusServer({ onMessage: standardJanusFlow });
    try {
      const client = new RceVideoSignalingClient({ websocketUrl: url, streamId: 1, apiToken: 'tok' });
      const first = client.connect();
      await assert.rejects(() => client.connect(), /already connected or connecting/);
      await first;
      client.stop();
    } finally {
      await close();
    }
  });

  it('stop() before connect() resolves is safe and cancels the negotiation', async () => {
    const { url, close } = await startFakeJanusServer({ onMessage: () => undefined });
    try {
      const client = new RceVideoSignalingClient({ websocketUrl: url, streamId: 1, apiToken: 'tok' });
      const pending = client.connect();
      client.stop();
      await assert.rejects(() => pending);
    } finally {
      await close();
    }
  });

  it('emits close when the server drops the connection after negotiation', async () => {
    let serverSocket: WsSocket | undefined;
    const { url, close } = await startFakeJanusServer({
      onMessage: (message, ws) => {
        serverSocket = ws;
        return standardJanusFlow(message);
      }
    });
    try {
      const client = new RceVideoSignalingClient({ websocketUrl: url, streamId: 1, apiToken: 'tok' });
      await client.connect();
      const closed = new Promise<void>((resolve) => client.on('close', resolve));
      // `wss.close()` only stops accepting new connections — it doesn't touch already-open
      // sockets, so the client would never see a close event. Close the specific connection
      // instead, same as `rce-socket.test.ts`'s equivalent test.
      serverSocket?.close();
      await closed;
    } finally {
      await close();
    }
  });
});
