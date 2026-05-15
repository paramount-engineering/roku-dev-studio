/**
 * Tunables shared between the live Console (`telnet-console-panel.ts`) and the
 * standalone Log Viewer (`console-log-file-view.ts`). Anything in here is read
 * from *both* surfaces; surface-specific tunables (e.g. the live Console's
 * stream-flush pacing, scrollback cap) stay local to that surface so they
 * can change independently.
 *
 * Pinning these in one module prevents the silent drift we already saw once:
 * the file viewer had `MAX_LINE_CHARS = 120_000` and `DEFER_HEAVY_LINE_CHARS
 * = 6000`, the Console panel had `TELNET_MAX_LINE_CHARS = 120_000` and
 * `TELNET_DEFER_HEAVY_LINE_CHARS = 6000` — same values, two source-of-truths.
 * The next time someone tuned one for a perf incident, the other would have
 * stayed wrong on the other surface.
 */

/**
 * Cap a single log line at this many characters. Multi-megabyte single lines
 * (think a stringified Adobe Marketing API blob with no newlines) freeze
 * `pre-wrap` text layout for seconds. At cap we slice and append a
 * `… [truncated N chars]` marker so the user can see something happened.
 *
 * Tuned at 120_000 because the Adobe / FreeWheel response payloads we
 * routinely see in the field land around 50–80 KB; the 120 KB ceiling absorbs
 * outliers without leaving common cases truncated.
 */
export const MAX_LOG_LINE_CHARS = 120_000;

/**
 * Lines this size or larger skip structured-payload detection (JSON / XML
 * pill scan) at parse / append time. They're queued for a deferred drain
 * (`scheduleDeferredTelnetDrain` on the live Console) or detected on first
 * mount (file viewer's `buildLogLineElement`) — either way, the work doesn't
 * happen on the bursty ingest path or the initial parse pass.
 *
 * Tuned at 6000 because under that threshold the synchronous detect cost is
 * negligible (<1 ms in the 99th percentile on our test corpora). Above it
 * the cost grows superlinearly and starts to dominate flush time when many
 * heavy lines arrive in one batch.
 */
export const DEFER_HEAVY_LINE_CHARS = 6000;

/**
 * Initial row-height estimate fed to the virtualizer. Real heights are
 * measured per row once mounted (`measureElement` + the pendingMeasure pass
 * in `console-virtualizer.ts`), so this only affects (1) the very first paint
 * before any row has measured, and (2) the spacer height for not-yet-mounted
 * rows.
 *
 * 18 ≈ a single visual line at the configured monospace stack at 12 px /
 * line-height 1.6 + 2 px padding. A wrapped multi-line entry resolves to its
 * true height on its first frame.
 */
export const ROW_HEIGHT_ESTIMATE_PX = 18;
