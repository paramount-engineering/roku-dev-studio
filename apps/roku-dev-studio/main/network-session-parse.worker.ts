/**
 * Worker entry for `parseSessionBuffer` — see `.discussion-docs/worker-pool-threading-design.md`
 * (Wiring §1). Runs the PCAP/HAR/bundle parse off the main process so a large capture import
 * doesn't freeze every window while it parses. Built as its own standalone bundle by
 * `transpile-main-process.ts` (a worker_threads entry needs a real file, not a symbol inside
 * `main.bundled.cjs`).
 */
import { runWorkerLoop } from 'roku-dev-studio-platform/worker-pool';
import { parseSessionBuffer, type ParsedSession } from './network-session-parse';

export interface SessionParseInput {
  filePath: string;
  buf: Buffer;
}

runWorkerLoop<SessionParseInput, ParsedSession>((input) => {
  // A Buffer sent across `postMessage` arrives here as a plain Uint8Array, not a Buffer instance
  // (Node's structured clone doesn't preserve the Buffer subclass) — `Uint8Array.prototype.toString`
  // has different semantics (comma-joins byte values instead of UTF-8 decoding), so re-wrap before
  // handing it to a function that calls `.toString('utf-8')` on it. `Buffer.from()` accepts any
  // ArrayBufferView and wraps it correctly either way.
  return parseSessionBuffer(input.filePath, Buffer.from(input.buf));
});
