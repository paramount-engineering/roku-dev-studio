#!/usr/bin/env npx tsx
/**
 * Regression guard for the pure decision logic behind the main-window file
 * drop-zone (renderer/modules/utils/main-window-file-drop.ts): which
 * supported/unsupported/mixed state a drag resolves to, what the overlay
 * says, and what the post-drop toast says. None of this touches the DOM, so
 * it's plain-Node testable without jsdom.
 *
 * Run from apps/roku-dev-studio: npx tsx scripts/verify-main-window-file-drop.ts
 */
import { classifyDragNames, overlayText, describeDropResult } from '../renderer/modules/utils/main-window-file-drop-logic';

let failed = false;
const check = (name: string, actual: unknown, expected: unknown): void => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${name} → ${JSON.stringify(actual)}`);
  if (!ok) {
    console.error(`     expected ${JSON.stringify(expected)}`);
    failed = true;
  }
};

// classifyDragNames
check('classify: no names (pre-drop name unreadable)', classifyDragNames([]), 'unknown');
check('classify: one log file', classifyDragNames(['a.txt']), 'supported');
check('classify: one network session file (compound extension)', classifyDragNames(['a.rds-network-inspector.json']), 'supported');
check('classify: one unsupported file', classifyDragNames(['a.pdf']), 'unsupported');
check('classify: two supported (log + network) files', classifyDragNames(['a.txt', 'b.har']), 'supported');
check('classify: supported + unsupported is mixed', classifyDragNames(['a.txt', 'b.pdf']), 'mixed');
check('classify: two unsupported files', classifyDragNames(['a.pdf', 'b.png']), 'unsupported');
check(
  'classify: a plain .json file (NOT the compound network-session extension) is unsupported',
  classifyDragNames(['plain.json']),
  'unsupported'
);

// overlayText
check('overlay: unsupported state', overlayText('unsupported', ['a.pdf']), 'Unsupported file type');
check('overlay: mixed state', overlayText('mixed', ['a.txt', 'b.pdf']), 'Drop files to open');
check('overlay: unknown state (name unreadable pre-drop)', overlayText('unknown', []), 'Drop files to open');
check('overlay: one supported log file names the viewer', overlayText('supported', ['a.txt']), 'Drop to open in Log Viewer');
check(
  'overlay: one supported network-session file names the viewer',
  overlayText('supported', ['a.har']),
  'Drop to open in Network Session Viewer'
);
check('overlay: multiple supported files stays generic (could span both viewers)', overlayText('supported', ['a.txt', 'b.har']), 'Drop to open');

// describeDropResult
check('result: nothing dropped → no toast', describeDropResult({ opened: [], unsupported: [] }), null);
check('result: undefined result → no toast', describeDropResult(undefined), null);
check(
  'result: one log file opened',
  describeDropResult({ opened: [{ name: 'a.txt', kind: 'log' }], unsupported: [] }),
  { message: 'Opened "a.txt" in Log Viewer', tone: 'success' }
);
check(
  'result: one network-session file opened',
  describeDropResult({ opened: [{ name: 'a.har', kind: 'network-session' }], unsupported: [] }),
  { message: 'Opened "a.har" in Network Session Viewer', tone: 'success' }
);
check(
  'result: multiple opened, none unsupported',
  describeDropResult({ opened: [{ name: 'a.txt', kind: 'log' }, { name: 'b.har', kind: 'network-session' }], unsupported: [] }),
  { message: 'Opened 2 files', tone: 'success' }
);
check(
  'result: some opened, some unsupported (the recommended multi-file behavior)',
  describeDropResult({ opened: [{ name: 'a.txt', kind: 'log' }], unsupported: ['b.pdf'] }),
  { message: 'Opened 1 file, skipped 1 unsupported', tone: 'success' }
);
check(
  'result: one unsupported, nothing opened',
  describeDropResult({ opened: [], unsupported: ['a.pdf'] }),
  { message: '"a.pdf" is not a supported file type', tone: 'warning' }
);
check(
  'result: multiple unsupported, nothing opened',
  describeDropResult({ opened: [], unsupported: ['a.pdf', 'b.png'] }),
  { message: '2 unsupported files — nothing opened', tone: 'warning' }
);

if (failed) {
  console.error('FAIL: one or more cases did not match.');
  process.exit(1);
}
console.log('OK: main-window file-drop decision logic behaves correctly.');
