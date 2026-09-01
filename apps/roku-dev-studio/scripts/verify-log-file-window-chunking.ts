#!/usr/bin/env npx tsx
/**
 * Regression guard for `buildEntriesChunked` (renderer/components/log-file-viewer/
 * log-file-window-model.ts) — the helper that stopped a windowed Log Viewer load
 * from parsing an entire file synchronously in one multi-second block. For any
 * file under ~8MB (most single-session console-log exports), the "window" the
 * model loads is the whole file, so without chunking, opening a plain ~100k-line
 * log froze the renderer for the whole parse with no visible progress.
 *
 * Verifies: (1) correctness — every item still gets parsed into the right slot;
 * (2) it actually yields between chunks (a concurrently-scheduled callback fires
 * partway through, not only after everything finishes); (3) the supersede check
 * aborts mid-parse and resolves null, discarding partial work.
 *
 * Run from apps/roku-dev-studio: npx tsx scripts/verify-log-file-window-chunking.ts
 */
import { buildEntriesChunked, PARSE_CHUNK_SIZE } from '../renderer/components/log-file-viewer/log-file-window-model';

// requestAnimationFrame is a browser API — polyfill it the same way
// scripts/verify-console-filter-perf.ts does for a plain-Node run.
(globalThis as typeof globalThis & { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame = (
  cb: FrameRequestCallback
) => setTimeout(() => cb(0), 0) as unknown as number;

async function main() {
  let failed = false;
  const check = (name: string, cond: boolean, detail: string): void => {
    console.log(`${cond ? 'ok  ' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
    if (!cond) failed = true;
  };

  // 1) Correctness over several chunk boundaries (PARSE_CHUNK_SIZE * 3 + a remainder).
  const total = PARSE_CHUNK_SIZE * 3 + 137;
  const lines = Array.from({ length: total }, (_, i) => `line ${i}`);
  const result = await buildEntriesChunked(lines, (text, i) => [i, { text, timestamp: null, type: 'log' }], () => false);
  check('correctness: resolves a non-null map', result !== null, '');
  check('correctness: every item present', result?.size === total, `size=${result?.size}`);
  const midIdx = Math.floor(total / 2);
  check(
    'correctness: a mid-range entry has the right text',
    result?.get(midIdx)?.text === `line ${midIdx}`,
    String(result?.get(midIdx)?.text)
  );

  // 2) Yields between chunks — a callback scheduled before the call fires partway
  // through, not only once everything is done.
  {
    let sawMidCallback = false;
    let finished = false;
    const bigTotal = PARSE_CHUNK_SIZE * 6;
    const bigLines = Array.from({ length: bigTotal }, (_, i) => `x${i}`);
    setTimeout(() => {
      if (!finished) sawMidCallback = true;
    }, 0);
    await buildEntriesChunked(bigLines, (text, i) => [i, { text, timestamp: null, type: 'log' }], () => false);
    finished = true;
    // Give the setTimeout(0) above a tick to fire if it hadn't already.
    await new Promise((r) => setTimeout(r, 10));
    check('yields between chunks: a concurrently-scheduled callback ran before completion', sawMidCallback, '');
  }

  // 3) Supersede mid-parse resolves null and stops early (no work past the point of cancellation).
  {
    let calls = 0;
    const bigTotal = PARSE_CHUNK_SIZE * 6;
    const bigLines = Array.from({ length: bigTotal }, (_, i) => `x${i}`);
    let cancelled = false;
    setTimeout(() => {
      cancelled = true;
    }, 0);
    const supersededResult = await buildEntriesChunked(
      bigLines,
      (text, i) => {
        calls++;
        return [i, { text, timestamp: null, type: 'log' }];
      },
      () => cancelled
    );
    check('supersede: resolves null once cancelled mid-parse', supersededResult === null, '');
    check('supersede: stopped well before processing everything', calls < bigTotal, `calls=${calls} of ${bigTotal}`);
  }

  if (failed) {
    console.error('FAIL: one or more cases did not match.');
    process.exit(1);
  }
  console.log('OK: buildEntriesChunked parses correctly, yields between chunks, and aborts cleanly when superseded.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
