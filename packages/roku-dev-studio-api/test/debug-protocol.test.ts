/**
 * Regression tests for the in-house BrightScript debug protocol
 * (lib/debugger/protocol/*). Self-contained — NO `roku-debug` dependency.
 *
 * The golden fixtures below were captured from RokuCommunity `roku-debug`'s own
 * serializers at the time the in-house implementation was cross-validated against
 * it (14 request encoders byte-for-byte identical; response/update decoders field-
 * verified). They freeze the wire format: any accidental change to the encoders or
 * decoders breaks these tests.
 *
 * Run: `npm test -w roku-dev-studio-api`
 */
import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

const { StepTypeCode } = require('../lib/debugger/protocol/constants');
const {
  encodeAddBreakpoints,
  encodeContinue,
  encodeExecute,
  encodeHandshake,
  encodeListBreakpoints,
  encodeRemoveBreakpoints,
  encodeSetExceptionBreakpoints,
  encodeStackTrace,
  encodeStep,
  encodeStop,
  encodeThreads,
  encodeVariables
} = require('../lib/debugger/protocol/encode');
const {
  parseBreakpoints,
  parseGeneric,
  parseHandshakeV3,
  parseSetExceptionBreakpoints,
  parseStackTrace,
  parseThreads,
  parseUpdate,
  parseVariables,
  versionGte
} = require('../lib/debugger/protocol/decode');

// ---------------------------------------------------------------------------
// Golden fixtures (captured from roku-debug — see file header).
// ---------------------------------------------------------------------------
const EXPECTED_ENCODERS: Record<string, string> = {
  continue7: '0c0000000700000002000000',
  stop7: '0c0000000700000001000000',
  listBreakpoints7: '0c0000000700000008000000',
  stepOver9: '1100000009000000060000000000000003',
  stepLine9: '1100000009000000060000000200000001',
  threads3: '0c0000000300000003000000',
  stackTrace4: '10000000040000000400000001000000',
  execute10: '200000000a0000000a00000000000000020000007072696e74206d2e746f7000',
  removeBps9: '1c000000090000000900000003000000010000000200000003000000',
  addBps7: '4a000000070000000700000002000000706b673a2f736f757263652f6d61696e2e627273000c00000000000000706b673a2f736f757263652f7574696c2e627273000300000002000000',
  varsEmpty5: '19000000050000000500000001000000000000000000000000',
  varsPath6: '230000000600000005000000030000000000000000020000006d006d794b6579000100',
  handshake: '6273646562756700',
  setExceptionBreakpoints11: '150000000b0000000c000000010000000200000000'
};

const DECODER_FIXTURES: Record<string, string> = {
  handshakeV3: '62736465627567000300000002000000000000000c0000000068e5cf8b010000',
  // Same fixture with the version bytes overwritten to 3.0.0 — used to drive legacy (<3.1.0)
  // capability-gated behavior (thread-hopping workaround, variables lower-case retry).
  handshakeV3_300: '62736465627567000300000000000000000000000c0000000068e5cf8b010000',
  variables: '5f0000000500000000000000060000001c016d00020000000d03000000390d746f700005000000726f534753637265656e002907636f756e74002a0000002905726174696f000000c03f1c016700010000000d010000002907780007000000',
  stackTrace: '4e0000000400000000000000020000000a0000006d61696e00706b673a2f736f757263652f6d61696e2e6272730019000000646f576f726b00706b673a2f736f757263652f7574696c2e62727300',
  threads: '52000000030000000000000001000000010300000053544f50006a00000070726f6365737300706b673a2f636f6d706f6e656e74732f53637265656e732f486f6d6553637265656e2e6272730053544f5000',
  // Same shape as `threads` but 2 entries where index 1 (not 0) carries isPrimary.
  threadsIsPrimaryIdx1: '5c0000000100000000000000020000000003000000000a0000006d61696e00706b673a2f736f757263652f6d61696e2e627273000001030000000014000000646f576f726b00706b673a2f736f757263652f7574696c2e6272730000',
  breakpoints: '240000000700000000000000020000000100000000000000000000000000000005000000',
  genericError: '0c0000000b00000004000000',
  allThreadsStopped: '1e000000000000000000000002000000000000000353544f502068697400',
  ioPortOpened: '14000000000000000000000001000000951f0000',
  setExceptionBreakpointsResponse: '180000000900000000000000010000000200000000000000',
  exceptionBreakpointError: '3d00000000000000000000000800000000000000020000000000000000000000000000002a000000706b673a2f736f757263652f6d61696e2e62727300',
  // VARIABLES error response (requestId=1, errorCode=INVALID_ARGS) — the retry trigger.
  variablesError1: '10000000010000000500000000000000',
  // VARIABLES success response (requestId=2) — what the lowercased retry gets back.
  variablesSuccess2: '1c000000020000000000000001000000280d726573756c74006f6b00'
};

const fx = (name: keyof typeof DECODER_FIXTURES): Buffer => Buffer.from(DECODER_FIXTURES[name], 'hex');

describe('debug protocol encoders (golden wire bytes)', () => {
  it('continue', () => assert.equal(encodeContinue(7).toString('hex'), EXPECTED_ENCODERS.continue7));
  it('stop', () => assert.equal(encodeStop(7).toString('hex'), EXPECTED_ENCODERS.stop7));
  it('listBreakpoints', () => assert.equal(encodeListBreakpoints(7).toString('hex'), EXPECTED_ENCODERS.listBreakpoints7));
  it('step(Over)', () => assert.equal(encodeStep(9, 0, StepTypeCode.Over).toString('hex'), EXPECTED_ENCODERS.stepOver9));
  it('step(Line)', () => assert.equal(encodeStep(9, 2, StepTypeCode.Line).toString('hex'), EXPECTED_ENCODERS.stepLine9));
  it('threads', () => assert.equal(encodeThreads(3).toString('hex'), EXPECTED_ENCODERS.threads3));
  it('stackTrace', () => assert.equal(encodeStackTrace(4, 1).toString('hex'), EXPECTED_ENCODERS.stackTrace4));
  it('execute', () => assert.equal(encodeExecute(10, 0, 2, 'print m.top').toString('hex'), EXPECTED_ENCODERS.execute10));
  it('removeBreakpoints', () => assert.equal(encodeRemoveBreakpoints(9, [1, 2, 3]).toString('hex'), EXPECTED_ENCODERS.removeBps9));
  it('addBreakpoints', () => {
    const buf = encodeAddBreakpoints(7, [
      { filePath: 'pkg:/source/main.brs', lineNumber: 12 },
      { filePath: 'pkg:/source/util.brs', lineNumber: 3, ignoreCount: 2 }
    ]);
    assert.equal(buf.toString('hex'), EXPECTED_ENCODERS.addBps7);
  });
  it('variables(empty path)', () => {
    const buf = encodeVariables(5, { threadIndex: 0, stackFrameIndex: 0, variablePath: [], enableForceCaseInsensitivity: false, getVirtualKeys: false });
    assert.equal(buf.toString('hex'), EXPECTED_ENCODERS.varsEmpty5);
  });
  it('variables(path, case-insensitive)', () => {
    const buf = encodeVariables(6, { threadIndex: 0, stackFrameIndex: 0, variablePath: ['m', '"myKey"'], enableForceCaseInsensitivity: true, getVirtualKeys: false });
    assert.equal(buf.toString('hex'), EXPECTED_ENCODERS.varsPath6);
  });
  it('handshake', () => assert.equal(encodeHandshake().toString('hex'), EXPECTED_ENCODERS.handshake));
  it('setExceptionBreakpoints', () => {
    const buf = encodeSetExceptionBreakpoints(11, [{ filter: 'uncaught' }]);
    assert.equal(buf.toString('hex'), EXPECTED_ENCODERS.setExceptionBreakpoints11);
  });
});

describe('debug protocol decoders (parse reference bytes)', () => {
  it('handshake magic/version', () => {
    const hs = parseHandshakeV3(fx('handshakeV3'));
    assert.deepEqual([hs.success, hs.data.magic, hs.data.protocolVersion], [true, 'bsdebug', '3.2.0']);
  });

  it('variables', () => {
    const vars = parseVariables(fx('variables'), true);
    assert.deepEqual(vars.data.variables.map((v: { name?: string }) => v.name), ['m', 'g']);
    assert.equal(vars.data.variables[0].type, 'AssociativeArray');
    assert.deepEqual(vars.data.variables[0].children!.map((c: { name?: string }) => c.name), ['top', 'count', 'ratio']);
    assert.deepEqual(
      [
        vars.data.variables[0].children![0].value,
        vars.data.variables[0].children![1].value,
        vars.data.variables[0].children![2].value
      ],
      ['roSGScreen', 42, 1.5]
    );
    assert.equal(vars.data.variables[1].children![0].value, 7);
  });

  it('stackTrace', () => {
    const st = parseStackTrace(fx('stackTrace'), true);
    assert.deepEqual(
      st.data.entries.map((e: { functionName: string; filePath: string; lineNumber: number }) => `${e.functionName}@${e.filePath}:${e.lineNumber}`),
      ['main@pkg:/source/main.brs:10', 'doWork@pkg:/source/util.brs:25']
    );
  });

  it('threads', () => {
    const th = parseThreads(fx('threads'), true);
    assert.deepEqual(
      [th.data.threads[0].isPrimary, th.data.threads[0].stopReason, th.data.threads[0].functionName, th.data.threads[0].lineNumber],
      [true, 'StopStatement', 'process', 106]
    );
  });

  it('breakpoints', () => {
    const bp = parseBreakpoints(fx('breakpoints'), true);
    assert.deepEqual(bp.data.breakpoints.map((b: { id: number }) => b.id), [1, 0]);
    assert.equal(bp.data.breakpoints[1].errorCode, 5);
  });

  it('generic error header', () => {
    const gen = parseGeneric(fx('genericError'), true);
    assert.deepEqual([gen.data.requestId, gen.data.errorCode], [11, 4]);
  });

  it('AllThreadsStopped update', () => {
    const ats = parseUpdate(fx('allThreadsStopped'), true);
    assert.deepEqual(
      [ats.data.updateType, ats.data.stopReason, ats.data.threadIndex, ats.data.stopReasonDetail],
      ['AllThreadsStopped', 'StopStatement', 0, 'STOP hit']
    );
  });

  it('IOPortOpened update', () => {
    const io = parseUpdate(fx('ioPortOpened'), true);
    assert.deepEqual([io.data.updateType, io.data.port], ['IOPortOpened', 8085]);
  });

  it('setExceptionBreakpoints response', () => {
    const res = parseSetExceptionBreakpoints(fx('setExceptionBreakpointsResponse'), true);
    assert.deepEqual(res.data.breakpoints, [{ filter: 2, errorCode: 0 }]);
  });

  it('ExceptionBreakpointError update', () => {
    const err = parseUpdate(fx('exceptionBreakpointError'), true);
    assert.deepEqual(
      [err.data.updateType, err.data.filterId, err.data.lineNumber, err.data.filePath],
      ['ExceptionBreakpointError', 2, 42, 'pkg:/source/main.brs']
    );
  });
});

describe('DebugProtocolClient connectSocket injection', () => {
  const { EventEmitter } = require('node:events');
  const { DebugProtocolClient } = require('../lib/debugger/protocol/debug-protocol-client');

  /** Minimal `DebugSocketLike` fake — replies to a write with `reply` (if set) on next tick,
   *  mirroring a real device answering the handshake/a command over the socket. */
  class FakeSocket extends EventEmitter {
    written: Buffer[] = [];
    destroyed = false;
    reply: Buffer | null = null;
    write(data: Buffer): boolean {
      this.written.push(data);
      if (this.reply) {
        const r = this.reply;
        this.reply = null;
        process.nextTick(() => this.emit('data', r));
      }
      return true;
    }
    destroy(): void {
      this.destroyed = true;
    }
  }

  it('opens the control socket through the injected factory (not net.Socket) and completes the handshake through it', async () => {
    const requestedPorts: number[] = [];
    const sockets: FakeSocket[] = [];
    const connectSocket = async (port: number): Promise<FakeSocket> => {
      requestedPorts.push(port);
      const s = new FakeSocket();
      s.reply = fx('handshakeV3');
      sockets.push(s);
      return s;
    };

    const client = new DebugProtocolClient({ host: 'XY0200WN2DN4', connectSocket });
    const ok = await client.connect(true);
    assert.equal(ok, true);
    assert.equal(client.protocolVersion, '3.2.0');
    assert.deepEqual(requestedPorts, [8081]);
    assert.equal(sockets[0].destroyed, false);

    // A device-pushed IOPortOpened update should reconnect the IO channel through the SAME
    // factory, using the port the device negotiated (8085 in this fixture) — not a hardcoded one.
    sockets[0].emit('data', fx('ioPortOpened'));
    await new Promise((resolve) => process.nextTick(resolve));
    assert.deepEqual(requestedPorts, [8081, 8085]);

    await client.destroy();
  });

  it('does not end the session when the IO-port connect fails — only console-output streaming is lost', async () => {
    const requestedPorts: number[] = [];
    const sockets: FakeSocket[] = [];
    const connectSocket = async (port: number): Promise<FakeSocket> => {
      requestedPorts.push(port);
      if (port === 8085) throw new Error('ECONNREFUSED');
      const s = new FakeSocket();
      s.reply = fx('handshakeV3');
      sockets.push(s);
      return s;
    };

    const client = new DebugProtocolClient({ host: 'XY0200WN2DN4', connectSocket });
    const ok = await client.connect(true);
    assert.equal(ok, true);

    let appExitEmitted = false;
    client.on('app-exit', () => {
      appExitEmitted = true;
    });

    // Device pushes IOPortOpened for 8085 — the injected factory above refuses that one port.
    sockets[0].emit('data', fx('ioPortOpened'));
    await new Promise((resolve) => process.nextTick(resolve));
    await new Promise((resolve) => process.nextTick(resolve));

    assert.deepEqual(requestedPorts, [8081, 8085]);
    assert.equal(appExitEmitted, false);
    assert.equal(sockets[0].destroyed, false);

    await client.destroy();
  });

  it('ignores the device isPrimary flag on protocol <3.1.0 (thread-hopping workaround)', async () => {
    const socket = new FakeSocket();
    const connectSocket = async () => socket;

    const client = new DebugProtocolClient({ host: 'XY0200WN2DN4', connectSocket });
    socket.reply = fx('handshakeV3_300');
    await client.connect(true);
    assert.equal(client.protocolVersion, '3.0.0');

    // Drive the client into a stopped state at thread 0 (mirrors a real AllThreadsStopped).
    socket.emit('data', fx('allThreadsStopped'));

    // The device's THREADS response claims thread 1 is primary — on <3.1.0 firmware that
    // flag is buggy, so it must NOT override the primaryThread the stop update already set.
    socket.reply = fx('threadsIsPrimaryIdx1');
    await client.threads();
    assert.equal(client.primaryThread, 0);

    await client.destroy();
  });

  it('trusts the device isPrimary flag on protocol >=3.1.0', async () => {
    const socket = new FakeSocket();
    const connectSocket = async () => socket;

    const client = new DebugProtocolClient({ host: 'XY0200WN2DN4', connectSocket });
    socket.reply = fx('handshakeV3'); // 3.2.0
    await client.connect(true);

    socket.emit('data', fx('allThreadsStopped')); // sets primaryThread = 0
    socket.reply = fx('threadsIsPrimaryIdx1'); // device says thread 1 is primary
    await client.threads();
    assert.equal(client.primaryThread, 1);

    await client.destroy();
  });

  it('retries a variable path lowercased on protocol <3.1.0 casing errors', async () => {
    const socket = new FakeSocket();
    const connectSocket = async () => socket;

    const client = new DebugProtocolClient({ host: 'XY0200WN2DN4', connectSocket });
    socket.reply = fx('handshakeV3_300'); // 3.0.0 — predates per-entry case-insensitivity
    await client.connect(true);
    socket.emit('data', fx('allThreadsStopped'));

    // From here, drive replies manually (no auto-responder): pre-arming `socket.reply`
    // before the retry's own write would race this test's "queue the next reply" against
    // the write it's supposed to answer.
    const written: Buffer[] = [];
    socket.write = (data: Buffer) => {
      written.push(data);
      return true;
    };
    const NUL = String.fromCharCode(0);

    const pending = client.getVariables(['SomeVar', 'Child']);
    await new Promise((resolve) => process.nextTick(resolve));
    assert.equal(written.length, 1);
    // First attempt: only the root segment lowercased ("somevar", "Child").
    assert.match(written[0].toString('latin1'), new RegExp(`somevar${NUL}Child${NUL}`));

    socket.emit('data', fx('variablesError1'));
    await new Promise((resolve) => process.nextTick(resolve));
    assert.equal(written.length, 2);
    // Retry: the WHOLE path lowercased ("somevar", "child").
    assert.match(written[1].toString('latin1'), new RegExp(`somevar${NUL}child${NUL}`));

    socket.emit('data', fx('variablesSuccess2'));
    const result = await pending;
    assert.equal(result.data.errorCode, 0);

    await client.destroy();
  });
});

describe('versionGte', () => {
  it('gates protocol-version-specific request fields', () => {
    assert.equal(versionGte('3.2.0', 3, 1, 0), true);
    assert.equal(versionGte('3.0.0', 3, 1, 0), false);
    assert.equal(versionGte('3.2.0', 3, 3, 0), false);
    assert.equal(versionGte('15.3.4', 3, 0, 0), true);
    assert.equal(versionGte('2.1.0', 3, 0, 0), false);
  });
});
