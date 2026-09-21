/**
 * Regression check for main/ipc/telnet-handlers.ts's 8085 connect bookkeeping.
 *
 * Roku's 8085 debug console is single-client. Two concurrent connects for one device (the Sideload
 * Relay fan-out's console step racing the debug sidebar's auto-connect) used to both dial; Roku
 * rejected the loser and the loser's `close` wiped the winner's map entry + holders, orphaning a
 * live socket that held the port until the app quit ("Console connection is already in use." on
 * every retry). Asserts: concurrent ensures share ONE dial, a healthy socket is reused, a bounce
 * swaps sockets transparently (no disconnect event, holders kept, the old socket's late `close`
 * never tears down its replacement), and a bounce whose re-dial fails DOES surface a disconnect.
 *
 * Runs outside Electron: `electron` is stubbed and the api's TCP dial is replaced with an
 * in-memory fake, so nothing binds a real port. `npm run verify:telnet-single-flight`.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

const Module = require('module');
const origLoad = Module._load;
const electronStub = {
  app: { getPath: () => '/tmp', isPackaged: false, on() {}, getVersion: () => '0.0.0' },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { handle() {}, on() {} },
  safeStorage: { isEncryptionAvailable: () => false },
  net: {},
  powerMonitor: { on() {} },
  dialog: {},
  shell: {}
};
Module._load = function (request: string, ...rest: unknown[]) {
  if (request === 'electron') return electronStub;
  return origLoad.call(this, request, ...rest);
};

class FakeSocket extends EventEmitter {
  destroyed = false;
  readyState = 'open';
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.readyState = 'closed';
    process.nextTick(() => this.emit('close', false)); // net.Socket emits 'close' asynchronously
  }
}

let dials = 0;
let failNextDial = false;
const sockets: FakeSocket[] = [];
const api = require('roku-dev-studio-api');
api.connectRokuDebugTelnet = async () => {
  dials++;
  await new Promise((r) => setTimeout(r, 20)); // real TCP connect takes a beat — this is the race window
  if (failNextDial) {
    failNextDial = false;
    return { success: false, error: 'ECONNREFUSED (fake)' };
  }
  const socket = new FakeSocket();
  sockets.push(socket);
  return { success: true, socket };
};

const sent: Array<{ channel: string; data: unknown }> = [];
const th = require('../main/ipc/telnet-handlers') as typeof import('../main/ipc/telnet-handlers');
th.setupTelnetHandlers(undefined, (channel, data) => {
  sent.push({ channel, data });
  return true;
});

const IP = '10.0.0.1';
async function main(): Promise<void> {
  // 1. Two concurrent callers (relay fan-out + sidebar auto-connect) → one dial, both succeed.
  const [a, b] = await Promise.all([
    th.ensureDebugTelnetConnected(IP, { holder: 'sideload-relay' }),
    th.ensureDebugTelnetConnected(IP, { holder: 'main-ui' })
  ]);
  assert.equal(a.success, true);
  assert.equal(b.success, true);
  assert.equal(dials, 1, 'concurrent ensures must share a single dial');

  // 2. A later caller reuses the healthy socket — no new dial.
  assert.equal((await th.ensureDebugTelnetConnected(IP)).success, true);
  assert.equal(dials, 1, 'healthy socket must be reused');

  // 3. Bounce replaces the socket transparently: no disconnect event, holders kept, and the OLD
  //    socket's async close must not tear down the new one.
  const old = sockets[0]!;
  assert.equal((await th.bounceDebugTelnet(IP)).success, true);
  assert.equal(dials, 2);
  assert.equal(old.destroyed, true);
  await new Promise((r) => setImmediate(r)); // let the old socket's queued 'close' fire
  old.emit('close', false); // and a duplicate late close, just to be adversarial
  assert.equal((await th.ensureDebugTelnetConnected(IP)).success, true);
  assert.equal(dials, 2, "a superseded socket's close must not evict its replacement");
  const disconnectEvents = () => sent.filter((e) => e.channel === 'telnet:disconnected').length;
  assert.equal(disconnectEvents(), 0, 'a successful bounce must be invisible to the renderer');
  await th.disconnectDebugTelnetIfUnheld(IP); // holders from step 1 must have survived the bounce
  assert.equal((await th.ensureDebugTelnetConnected(IP)).success, true);
  assert.equal(dials, 2, 'bounce must keep the lease holders, so the socket is still held');

  // 4. A bounce whose re-dial fails leaves no socket — the renderer MUST be told.
  failNextDial = true;
  assert.equal((await th.bounceDebugTelnet(IP)).success, false);
  assert.equal(disconnectEvents(), 1, 'a failed bounce must surface as a disconnect');

  // 5. With nothing open any more, a failed bounce is just a failed dial (the panel was never
  //    connected — no disconnect), and `onlyIfOpen` must not dial at all.
  failNextDial = true;
  assert.equal((await th.bounceDebugTelnet(IP)).success, false);
  assert.equal(disconnectEvents(), 1, 'no socket existed → nothing to disconnect');
  const dialsBefore = dials;
  assert.equal((await th.bounceDebugTelnet(IP, { onlyIfOpen: true })).success, true);
  assert.equal(dials, dialsBefore, 'onlyIfOpen must not dial when nothing is open');
  const disconnects = disconnectEvents();

  console.log('verify-telnet-single-flight: OK (dials=%d, disconnect events=%d)', dials, disconnects);
  process.exit(0);
}
main().catch((e) => {
  console.error('verify-telnet-single-flight: FAILED');
  console.error(e);
  process.exit(1);
});
