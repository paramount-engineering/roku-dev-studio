/**
 * Worker entry for telnet console line parsing — see
 * `.discussion-docs/worker-pool-threading-design.md` (Wiring §3). One dedicated instance per
 * connected device panel (created on connect, destroyed on disconnect) — NOT a task submitted to a
 * shared fungible pool. `parseConsoleLineBatch`'s state (`pendingLogPrefix`, a `[DEBUG]`-only line
 * whose continuation may arrive in the next batch) must see every chunk for one connection in order;
 * splitting it across interchangeable workers would corrupt that state.
 */
import { runWorkerLoop } from '../concurrency/worker-pool.js';
import { createConsoleLineParserState, parseConsoleLineBatch, type ParsedTelnetEntry } from '../console-log/console-line-parser.js';

const state = createConsoleLineParserState();

export interface TelnetParseResult {
  entries: ParsedTelnetEntry[];
  /** Mirrors `state.pendingLogPrefix` after this batch, so the main thread can flush a dangling
   *  `[DEBUG]`-only line on disconnect (its continuation will never arrive) — this worker's internal
   *  state isn't otherwise visible outside its own module scope. */
  pendingLogPrefix: string;
}

runWorkerLoop<string[], TelnetParseResult>((lines) => {
  const entries = parseConsoleLineBatch(state, lines);
  return { entries, pendingLogPrefix: state.pendingLogPrefix };
});
