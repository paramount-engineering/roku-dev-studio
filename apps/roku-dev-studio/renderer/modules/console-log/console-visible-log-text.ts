/**
 * Shared "what would the user see if they hit Copy / Save / Cmd+A right now?"
 * helper. Both the live Console panel (`telnet-console-panel.ts`) and the
 * standalone Log Viewer (`log-file-viewer.ts`) need this:
 *
 *  - When the find bar is in **filter mode** with a non-empty query, the
 *    user sees only matching entries; export should match.
 *  - When the find bar is in **find mode** (or there is no query), every
 *    entry is visible; export contains everything.
 *
 * Earlier each surface inlined this logic with a slightly different shape
 * (`getVisibleLogLines` vs. `buildVisibleLogText`). Folding both onto this
 * helper means a future filter rule (e.g. "Filter mode hides ANSI-only
 * lines") lands in exactly one place.
 *
 * The shape `ReadonlyArray<{ text: string }>` is intentionally minimal so
 * both `TelnetLogLine` (live Console) and `ConsoleLogFileEntry` (file
 * viewer) satisfy it without extra adaptation.
 */

import type { ConsoleFindBarHandle } from './console-find-bar.js';

export type LogEntryWithText = { text: string };

/**
 * Filter `entries` against the find bar's *active filter* (no-op in find
 * mode or with an empty query).
 */
export function selectVisibleLogEntries<T extends LogEntryWithText>(
  entries: ReadonlyArray<T>,
  findBarHandle: ConsoleFindBarHandle | null
): ReadonlyArray<T> {
  if (!findBarHandle) return entries;
  if (findBarHandle.getMode() !== 'filter') return entries;
  if (!findBarHandle.getQuery()) return entries;
  return entries.filter((e) => !findBarHandle.shouldFilterOut(e.text));
}

/**
 * Build the body text for export: visible entries' `.text`, joined by `\n`.
 * No trailing newline (callers can append a header block / footer if they
 * want one).
 */
export function buildVisibleLogText<T extends LogEntryWithText>(
  entries: ReadonlyArray<T>,
  findBarHandle: ConsoleFindBarHandle | null
): string {
  return selectVisibleLogEntries(entries, findBarHandle)
    .map((e) => e.text)
    .join('\n');
}
