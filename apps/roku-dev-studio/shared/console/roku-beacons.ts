/**
 * Roku channel performance beacon pairing — turns the `[beacon.signal]` / `[beacon.report] |<Name>`
 * lines a real Roku telnet console prints (developer.roku.com/dev/docs/measuring-channel-performance)
 * into Initiate→Complete durations for the Console Monitor's Performance section.
 *
 * Real-device line shape (confirmed on-device, `sdkl` emitter — see `SYS_TS_RE` in
 * `renderer/components/fiddle/fiddle.ts` for the shared timestamp-prefix format):
 *   `09-10 15:27:49.549 sdkl [beacon.signal] |VODStartInitiate ----------> TimeBase(295512 ms)`
 *   `09-10 15:27:49.549 sdkl [beacon.signal] |VODStartComplete ----------> Duration(5724 ms)`
 *
 * IMPORTANT — the Complete beacon carries its own precomputed `Duration(<n> ms)` and that is the
 * authoritative value, NOT a diff of the two lines' leading timestamps: Roku's console output is
 * buffered, so an Initiate and its Complete can print with the SAME wall-clock timestamp (as in the
 * real capture above, 0ms apart on paper) despite the actual measured gap being thousands of ms. The
 * leading timestamp is only trustworthy for a gap between two DIFFERENT beacons' own print moments
 * (used below for the EPG 5s cert-window check), never for one beacon's own Initiate→Complete span.
 * `TimeBase(<n> ms)` (ms since AppLaunchInitiate, printed on Initiate) is not currently used.
 *
 * `AppLaunchComplete` specifically has been observed firing TWICE on-device for a single launch:
 *   `09-10 16:23:48.807 sdkl [beacon.signal] |AppLaunchInitiate ---------> TimeBase(0 ms)`
 *   `09-10 16:24:00.077 sdkl [beacon.signal] |AppLaunchComplete ---------> Pending Render Pass`
 *   `09-10 16:24:00.257 sdkl [beacon.signal] |AppLaunchComplete ---------> Duration(11450 ms : 11213 ms)`
 * — an interim "Pending Render Pass" completion with no duration, then the real one ~180ms later. The
 * interim line is ignored entirely (see `PENDING_RENDER_RE`) rather than treated as the terminal
 * Complete, so the Initiate stays pending for the real one. `Duration(...)` can also carry a second
 * `: <n> ms` figure of undocumented meaning; only the first number is used (see `DURATION_RE`) — the raw
 * line (both numbers) is still shown verbatim in the Performance section for inspection.
 */

/**
 * One Initiate/Complete beacon pair the Roku OS (or `signalBeacon()`) emits around a lifecycle event —
 * one row of the doc's "Performance Metrics Reference" table (developer.roku.com/dev/docs/
 * measuring-channel-performance#performance-metrics-reference), which defines exactly these 8 metric
 * types. `label` uses the doc's own category name for the pair, NOT the beacon token itself, where they
 * differ (e.g. the reference table calls the `VODStart*` pair "Video start", `LiveChannelChange*` is
 * "Channel change", `AppExit*` is "Channel exit", and `AppDialog*` is "Dialog launch").
 */
export interface BeaconFlow {
  id: string;
  /** English fallback label; the modal prefers `S.consoleLog.beaconFlows[id]` when present. */
  label: string;
  initiate: string;
  complete: string;
}

export const BEACON_FLOWS: readonly BeaconFlow[] = [
  { id: 'appCompile', label: 'App Compile', initiate: 'AppCompileInitiate', complete: 'AppCompileComplete' },
  { id: 'appLaunch', label: 'App Launch', initiate: 'AppLaunchInitiate', complete: 'AppLaunchComplete' },
  { id: 'appDialog', label: 'Dialog Launch', initiate: 'AppDialogInitiate', complete: 'AppDialogComplete' },
  { id: 'epgLaunch', label: 'EPG Launch', initiate: 'EPGLaunchInitiate', complete: 'EPGLaunchComplete' },
  { id: 'vodStart', label: 'Video Start', initiate: 'VODStartInitiate', complete: 'VODStartComplete' },
  { id: 'liveStart', label: 'Live Start', initiate: 'LiveStartInitiate', complete: 'LiveStartComplete' },
  {
    id: 'liveChannelChange',
    label: 'Channel Change',
    initiate: 'LiveChannelChangeInitiate',
    complete: 'LiveChannelChangeComplete'
  },
  { id: 'appExit', label: 'Channel Exit', initiate: 'AppExitInitiated', complete: 'AppExitComplete' }
];

/** Per the cert doc: an EPG launch only qualifies for measurement within this many ms of AppLaunchComplete. */
export const EPG_CERT_WINDOW_MS = 5000;

const BEACON_LINE_RE = /\[beacon\.(?:signal|report)\]\s*\|(\w+)/i;
/** The Complete beacon's own precomputed duration, e.g. `----------> Duration(5724 ms)` or the
 *  two-number `----------> Duration(11450 ms : 11213 ms)` form — only the first number is captured. */
const DURATION_RE = /duration\(\s*(\d+)\s*ms(?:\s*:\s*\d+\s*ms)?\s*\)/i;
/** An interim, non-terminal `AppLaunchComplete` observed on-device before the real Duration(...) one —
 *  not a completion at all, so it must not consume the pending Initiate or produce a timing. */
const PENDING_RENDER_RE = /pending render pass/i;
const TIMESTAMP_RE = /^(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})/;

/** Milliseconds since local midnight, for the cross-beacon EPG cert-window check only (see file header
 *  for why it's unsuitable for a single beacon's own Initiate→Complete span). ponytail: ignores
 *  month/day rollover — a session spanning midnight mispairs by ~1 day of ms; a single sideload/telnet
 *  session never does, revisit if needed. */
function timestampMs(line: string): number | null {
  const m = TIMESTAMP_RE.exec(line);
  if (!m) return null;
  const [, , , hh, mm, ss, ms] = m;
  return ((Number(hh) * 60 + Number(mm)) * 60 + Number(ss)) * 1000 + Number(ms);
}

/** One recognized Initiate→Complete beacon duration. */
export interface BeaconTiming {
  flow: string;
  label: string;
  durationMs: number;
  /** The Complete beacon's own line, verbatim (trimmed) — the "entry" text shown per-row, so the raw
   *  `TimeBase`/`Duration` annotation (or its absence) is visible instead of just the computed number. */
  raw: string;
  /** Position of the Complete line (buffer index / file line number) — for jump-to. */
  index: number;
  /** The matching Initiate line, verbatim (trimmed) — absent when it wasn't captured in this scan (e.g.
   *  the console was connected mid-session, after the app had already launched). */
  openingRaw?: string;
  /** Position of the Initiate line — for jump-to. Absent exactly when `openingRaw` is. */
  openingIndex?: number;
  /** Set only for `appLaunch` when an `appDialog` pair fell inside its window — the cert doc's guidance
   *  to subtract user-wait time from the launch metric. */
  adjustedMs?: number;
  /** Set only for `epgLaunch`: whether it completed within {@link EPG_CERT_WINDOW_MS} of the launch. */
  withinCertWindow?: boolean;
}

/**
 * Stateful, streaming beacon-pairing scanner — same shape as `createCrashScanner` so the Log Viewer's
 * whole-file main-process scan and the live Console's buffer scan share one implementation.
 *
 * Duration comes from the Complete beacon's own `Duration(<n> ms)` annotation when present (the
 * authoritative, Roku-computed value); a same-flow Initiate is tracked only as a fallback for a Complete
 * line that lacks that annotation (e.g. an older firmware, or the Sideload Relay's synthetic
 * `AppCompileComplete`, which never carries real timing). An unmatched trailing Initiate (session still
 * running, or a non-interactive dialog that correctly never fires its beacons) is simply dropped.
 */
export function createBeaconScanner(): {
  push(text: string, index: number): void;
  finish(): BeaconTiming[];
} {
  /** flow.id -> the pending Initiate line (`ms` is null when the timestamp prefix didn't parse — the
   *  raw text + index are always kept regardless, for the Opening Log row). */
  const pendingInitiate = new Map<string, { ms: number | null; raw: string; index: number }>();
  const timings: BeaconTiming[] = [];
  let launchCompleteAt: number | null = null;
  /** The most recent `appDialog` Complete's duration since the CURRENT launch's Initiate — reset there,
   *  consumed (and cleared) by the next `appLaunch` Complete. Sequence-based, not timestamp-based, so
   *  it's unaffected by the console's print-buffering quirk described in the file header. */
  let pendingDialogMs: number | null = null;

  return {
    push(text, index) {
      const m = BEACON_LINE_RE.exec(text);
      if (!m) return;
      const name = m[1]!;
      for (const flow of BEACON_FLOWS) {
        if (name === flow.initiate) {
          pendingInitiate.set(flow.id, { ms: timestampMs(text), raw: text.trim(), index });
          if (flow.id === 'appLaunch') pendingDialogMs = null; // a fresh launch forgets any stale dialog
          return;
        }
        if (name === flow.complete) {
          if (PENDING_RENDER_RE.test(text)) return; // interim, not the real completion — keep waiting
          const start = pendingInitiate.get(flow.id);
          const explicit = DURATION_RE.exec(text);
          let durationMs: number | undefined = explicit ? Number(explicit[1]) : undefined;
          if (durationMs === undefined && start?.ms !== null && start?.ms !== undefined) {
            const t = timestampMs(text);
            if (t !== null) durationMs = t - start.ms;
          }
          pendingInitiate.delete(flow.id);
          if (durationMs === undefined) return; // nothing usable for this occurrence

          const timing: BeaconTiming = {
            flow: flow.id,
            label: flow.label,
            durationMs,
            raw: text.trim(),
            index,
            ...(start ? { openingRaw: start.raw, openingIndex: start.index } : {})
          };
          if (flow.id === 'appDialog') pendingDialogMs = durationMs;
          if (flow.id === 'appLaunch') {
            const t = timestampMs(text);
            if (t !== null) launchCompleteAt = t;
            if (pendingDialogMs !== null) {
              timing.adjustedMs = Math.max(0, durationMs - pendingDialogMs);
              pendingDialogMs = null;
            }
          }
          if (flow.id === 'epgLaunch') {
            const t = timestampMs(text);
            timing.withinCertWindow =
              launchCompleteAt !== null && t !== null && t - launchCompleteAt <= EPG_CERT_WINDOW_MS;
          }
          timings.push(timing);
          return;
        }
      }
    },
    finish() {
      return timings;
    }
  };
}

/** Batch convenience over {@link createBeaconScanner} — the live Console feeds its resident buffer here. */
export function detectBeaconTimings(lines: readonly string[]): BeaconTiming[] {
  const scanner = createBeaconScanner();
  lines.forEach((text, i) => scanner.push(text, i));
  return scanner.finish();
}
