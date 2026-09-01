#!/usr/bin/env npx tsx
/**
 * Regression guard: `buildLineIndex` used to scan a file fully synchronously,
 * blocking the main process — and therefore every other IPC handler,
 * including already-connected device/console panels — for as long as the scan
 * took. Reported as a ~1 minute freeze with no loading indicator when opening
 * a ~100k-line log file in the Log Viewer. It must now yield to the event loop
 * between chunks (same discipline as `streamFileLines`) and still produce a
 * correct index.
 *
 * Run from apps/roku-dev-studio: npx tsx scripts/verify-log-file-index-yields.ts
 */
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildLineIndex, readLineRange } from '../main/log-file-index';

function lineText(i: number): string {
  return `line ${i} some sample console output text`;
}

async function main() {
  const LINE_COUNT = 200_000;
  const lines: string[] = [];
  for (let i = 0; i < LINE_COUNT; i++) lines.push(lineText(i));
  const content = lines.join('\n') + '\n';
  const filePath = join(tmpdir(), `verify-log-file-index-${Date.now()}.txt`);
  writeFileSync(filePath, content, 'utf8');

  try {
    let immediateFiredAt = -1;
    const start = Date.now();
    // Scheduled before buildLineIndex runs. If buildLineIndex never yields,
    // this can't fire until the whole scan is done — proving the freeze.
    setImmediate(() => {
      immediateFiredAt = Date.now() - start;
    });

    const index = await buildLineIndex(filePath);
    const totalMs = Date.now() - start;

    console.log(
      `Indexed ${index.lineCount} lines (${(content.length / 1024 / 1024).toFixed(1)} MB) in ${totalMs}ms; ` +
        `a concurrently-scheduled setImmediate fired at +${immediateFiredAt}ms.`
    );

    if (index.lineCount !== LINE_COUNT) {
      console.error(`FAIL: expected ${LINE_COUNT} lines, got ${index.lineCount}.`);
      process.exit(1);
    }
    if (immediateFiredAt < 0) {
      console.error('FAIL: the setImmediate callback never fired — event loop starved.');
      process.exit(1);
    }
    if (immediateFiredAt >= totalMs) {
      console.error(
        `FAIL: setImmediate fired at +${immediateFiredAt}ms but indexing took ${totalMs}ms total — ` +
          'buildLineIndex never yielded control back to the event loop (the freeze regression is back).'
      );
      process.exit(1);
    }

    // Spot-check correctness at the start, middle, and end of the file.
    const checks: Array<[number, string]> = [
      [0, lineText(0)],
      [Math.floor(LINE_COUNT / 2), lineText(Math.floor(LINE_COUNT / 2))],
      [LINE_COUNT - 1, lineText(LINE_COUNT - 1)]
    ];
    for (const [lineNo, expected] of checks) {
      const [actual] = readLineRange(index, lineNo, lineNo + 1);
      if (actual !== expected) {
        console.error(`FAIL: line ${lineNo} mismatch — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
        process.exit(1);
      }
    }

    console.log('OK: buildLineIndex yields to the event loop and still indexes correctly.');
  } finally {
    unlinkSync(filePath);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
