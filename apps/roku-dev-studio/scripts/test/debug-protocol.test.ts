/**
 * Regression tests for the in-house BrightScript debug protocol
 * (main/debugger/protocol/*). Self-contained — NO `roku-debug` dependency.
 *
 * The golden fixtures below were captured from RokuCommunity `roku-debug`'s own
 * serializers at the time the in-house implementation was cross-validated against
 * it (14 request encoders byte-for-byte identical; response/update decoders field-
 * verified). They freeze the wire format: any accidental change to the encoders or
 * decoders breaks these tests.
 *
 * Run: `npm test` (or `tsx scripts/test/debug-protocol.test.ts`) from apps/roku-dev-studio.
 */
import { StepTypeCode } from '../../main/debugger/protocol/constants';
import {
  encodeAddBreakpoints,
  encodeContinue,
  encodeExecute,
  encodeExitChannel,
  encodeHandshake,
  encodeListBreakpoints,
  encodeRemoveBreakpoints,
  encodeStackTrace,
  encodeStep,
  encodeStop,
  encodeThreads,
  encodeVariables
} from '../../main/debugger/protocol/encode';
import {
  parseBreakpoints,
  parseGeneric,
  parseHandshakeV3,
  parseStackTrace,
  parseThreads,
  parseUpdate,
  parseVariables,
  versionGte
} from '../../main/debugger/protocol/decode';

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function eqHex(name: string, actual: Buffer, expectedHex: string): void {
  const a = actual.toString('hex');
  check(name, a === expectedHex, a === expectedHex ? undefined : `\n      got: ${a}\n      exp: ${expectedHex}`);
}

function eq(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(name, ok, ok ? undefined : `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

// ---------------------------------------------------------------------------
// Golden fixtures (captured from roku-debug — see file header).
// ---------------------------------------------------------------------------
const EXPECTED_ENCODERS: Record<string, string> = {
  continue7: '0c0000000700000002000000',
  stop7: '0c0000000700000001000000',
  exitChannel7: '0c000000070000007a000000',
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
  handshake: '6273646562756700'
};

const DECODER_FIXTURES: Record<string, string> = {
  handshakeV3: '62736465627567000300000002000000000000000c0000000068e5cf8b010000',
  variables: '5f0000000500000000000000060000001c016d00020000000d03000000390d746f700005000000726f534753637265656e002907636f756e74002a0000002905726174696f000000c03f1c016700010000000d010000002907780007000000',
  stackTrace: '4e0000000400000000000000020000000a0000006d61696e00706b673a2f736f757263652f6d61696e2e6272730019000000646f576f726b00706b673a2f736f757263652f7574696c2e62727300',
  threads: '52000000030000000000000001000000010300000053544f50006a00000070726f6365737300706b673a2f636f6d706f6e656e74732f53637265656e732f486f6d6553637265656e2e6272730053544f5000',
  breakpoints: '240000000700000000000000020000000100000000000000000000000000000005000000',
  genericError: '0c0000000b00000004000000',
  allThreadsStopped: '1e000000000000000000000002000000000000000353544f502068697400',
  ioPortOpened: '14000000000000000000000001000000951f0000'
};

const fx = (name: keyof typeof DECODER_FIXTURES): Buffer => Buffer.from(DECODER_FIXTURES[name], 'hex');

// ---------------------------------------------------------------------------
// Encoders — byte-for-byte against the golden wire format.
// ---------------------------------------------------------------------------
console.log('Encoders (golden wire bytes):');
eqHex('continue', encodeContinue(7), EXPECTED_ENCODERS.continue7);
eqHex('stop', encodeStop(7), EXPECTED_ENCODERS.stop7);
eqHex('exitChannel', encodeExitChannel(7), EXPECTED_ENCODERS.exitChannel7);
eqHex('listBreakpoints', encodeListBreakpoints(7), EXPECTED_ENCODERS.listBreakpoints7);
eqHex('step(Over)', encodeStep(9, 0, StepTypeCode.Over), EXPECTED_ENCODERS.stepOver9);
eqHex('step(Line)', encodeStep(9, 2, StepTypeCode.Line), EXPECTED_ENCODERS.stepLine9);
eqHex('threads', encodeThreads(3), EXPECTED_ENCODERS.threads3);
eqHex('stackTrace', encodeStackTrace(4, 1), EXPECTED_ENCODERS.stackTrace4);
eqHex('execute', encodeExecute(10, 0, 2, 'print m.top'), EXPECTED_ENCODERS.execute10);
eqHex('removeBreakpoints', encodeRemoveBreakpoints(9, [1, 2, 3]), EXPECTED_ENCODERS.removeBps9);
eqHex(
  'addBreakpoints',
  encodeAddBreakpoints(7, [
    { filePath: 'pkg:/source/main.brs', lineNumber: 12 },
    { filePath: 'pkg:/source/util.brs', lineNumber: 3, ignoreCount: 2 }
  ]),
  EXPECTED_ENCODERS.addBps7
);
eqHex(
  'variables(empty path)',
  encodeVariables(5, { threadIndex: 0, stackFrameIndex: 0, variablePath: [], enableForceCaseInsensitivity: false, getVirtualKeys: false }),
  EXPECTED_ENCODERS.varsEmpty5
);
eqHex(
  'variables(path, case-insensitive)',
  encodeVariables(6, { threadIndex: 0, stackFrameIndex: 0, variablePath: ['m', '"myKey"'], enableForceCaseInsensitivity: true, getVirtualKeys: false }),
  EXPECTED_ENCODERS.varsPath6
);
eqHex('handshake', encodeHandshake(), EXPECTED_ENCODERS.handshake);

// ---------------------------------------------------------------------------
// Decoders — parse real reference bytes, verify fields.
// ---------------------------------------------------------------------------
console.log('Decoders (parse reference bytes):');

const hs = parseHandshakeV3(fx('handshakeV3'));
eq('handshake magic/version', [hs.success, hs.data.magic, hs.data.protocolVersion], [true, 'bsdebug', '3.2.0']);

const vars = parseVariables(fx('variables'), true);
eq('variables roots', vars.data.variables.map((v) => v.name), ['m', 'g']);
eq('variables[0].type', vars.data.variables[0].type, 'AssociativeArray');
eq('variables[0].children', vars.data.variables[0].children!.map((c) => c.name), ['top', 'count', 'ratio']);
eq('variables[0].children values', [
  vars.data.variables[0].children![0].value,
  vars.data.variables[0].children![1].value,
  vars.data.variables[0].children![2].value
], ['roSGScreen', 42, 1.5]);
eq('variables[1].child value', vars.data.variables[1].children![0].value, 7);

const st = parseStackTrace(fx('stackTrace'), true);
eq('stackTrace entries', st.data.entries.map((e) => `${e.functionName}@${e.filePath}:${e.lineNumber}`), [
  'main@pkg:/source/main.brs:10',
  'doWork@pkg:/source/util.brs:25'
]);

const th = parseThreads(fx('threads'), true);
eq('threads[0]', [th.data.threads[0].isPrimary, th.data.threads[0].stopReason, th.data.threads[0].functionName, th.data.threads[0].lineNumber], [
  true,
  'StopStatement',
  'process',
  106
]);

const bp = parseBreakpoints(fx('breakpoints'), true);
eq('breakpoint ids', bp.data.breakpoints.map((b) => b.id), [1, 0]);
eq('breakpoint[1].errorCode', bp.data.breakpoints[1].errorCode, 5);

const gen = parseGeneric(fx('genericError'), true);
eq('generic error header', [gen.data.requestId, gen.data.errorCode], [11, 4]);

const ats = parseUpdate(fx('allThreadsStopped'), true);
eq('AllThreadsStopped', [ats.data.updateType, ats.data.stopReason, ats.data.threadIndex, ats.data.stopReasonDetail], [
  'AllThreadsStopped',
  'StopStatement',
  0,
  'STOP hit'
]);

const io = parseUpdate(fx('ioPortOpened'), true);
eq('IOPortOpened', [io.data.updateType, io.data.port], ['IOPortOpened', 8085]);

// ---------------------------------------------------------------------------
// versionGte helper (gates protocol-version-specific request fields).
// ---------------------------------------------------------------------------
console.log('versionGte:');
eq('3.2.0 >= 3.1.0', versionGte('3.2.0', 3, 1, 0), true);
eq('3.0.0 >= 3.1.0', versionGte('3.0.0', 3, 1, 0), false);
eq('3.2.0 >= 3.3.0', versionGte('3.2.0', 3, 3, 0), false);
eq('15.3.4 >= 3.0.0', versionGte('15.3.4', 3, 0, 0), true);
eq('2.1.0 >= 3.0.0', versionGte('2.1.0', 3, 0, 0), false);

// ---------------------------------------------------------------------------
console.log(`\n${failed === 0 ? '✅ PASS' : '❌ FAIL'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
