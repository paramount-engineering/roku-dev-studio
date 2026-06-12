/**
 * Deferred drain for "heavy" telnet log lines (>= `DEFER_HEAVY_LINE_CHARS`).
 *
 * Heavy lines (multi-KB JSON / XML / URL blobs) skip URL detection +
 * structured-payload detection at ingest time so the streaming flush stays
 * smooth. They're queued here and drained on idle ticks, time-sliced to ~14ms
 * per slice and paused entirely while a JSON/XML / URL viewer modal is open
 * (the modal's expensive layout shouldn't compete with background drain).
 *
 * Extracted from `telnet-console-panel.ts` so the panel's main file stops
 * owning a ~50-line piece of orthogonal scheduling logic. The drain has no
 * cross-cutting state with connection lifecycle / find bar / virtualizer —
 * just `(entry, lineEl, contentEl)` jobs in, URL/structured pills painted
 * onto those elements out.
 */

import {
  detectStructuredConsoleLine,
  type StructuredConsolePayload
} from './structured-log-detect.js';
import { populateConsoleLineContentWithUrls } from './console-url-detect.js';
import { paintJsonPlusRangesForLine } from './console-json-plus-highlight.js';
import { attachStructuredPillsToLine } from './console-structured-view-modal.js';

export type ConsoleDeferredHeavyLineEntry = {
  text: string;
  structuredTargets?: StructuredConsolePayload[];
};

export type ConsoleDeferredHeavyLineJob = {
  entry: ConsoleDeferredHeavyLineEntry;
  lineEl: HTMLElement;
  contentEl: HTMLElement;
};

export type ConsoleDeferredHeavyDrainOpts = {
  /**
   * Returns true when a content modal (JSON/XML / URL viewer) is open. The
   * drain pauses while a modal is up so the modal's expensive layout
   * (DOMParser, syntax highlight, fold scaffold) doesn't compete with
   * background URL/structured detection on the same main thread.
   */
  isModalOpen: () => boolean;
};

export type ConsoleDeferredHeavyDrainHandle = {
  /** Push a job and (re)schedule a drain. */
  enqueue: (job: ConsoleDeferredHeavyLineJob) => void;
  /** Drop all queued jobs and cancel the pending drain timer. Used on
   *  Connect (clean slate for a new session) and on panel teardown. */
  clear: () => void;
  /**
   * Re-arm a drain pass — useful after a modal closes (the drain paused itself
   * by returning early; this nudges it to resume). No-op when the queue is
   * empty.
   */
  schedule: () => void;
};

/** Per-tick budget (ms). 14 ms keeps a 60 Hz frame's worth of headroom. */
const DRAIN_SLICE_MS = 14;

/** Setup the timer between drain slices. 1 ms is "next tick" — small enough
 *  that catching up on a 100-job backlog completes in ~7 frames, large enough
 *  that the macrotask queue isn't choked. */
const DRAIN_TICK_DELAY_MS = 1;

export function createConsoleDeferredHeavyDrain(
  opts: ConsoleDeferredHeavyDrainOpts
): ConsoleDeferredHeavyDrainHandle {
  const queue: ConsoleDeferredHeavyLineJob[] = [];
  let drainTimer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (): void => {
    if (drainTimer != null) return;
    if (queue.length === 0) return;

    drainTimer = setTimeout(() => {
      drainTimer = null;
      const sliceStart = performance.now();

      while (queue.length > 0) {
        if (opts.isModalOpen()) {
          // Bail; caller will re-schedule via `schedule()` once the modal
          // closes (`onTelnetViewerClosedResume` in the panel listens for the
          // viewer-closed event). Don't reschedule here — that would spin
          // wakeups against an open modal.
          return;
        }
        if (performance.now() - sliceStart > DRAIN_SLICE_MS) {
          schedule();
          return;
        }

        const job = queue.shift()!;
        if (!job.lineEl.isConnected) continue;

        populateConsoleLineContentWithUrls(job.contentEl, job.entry.text);

        if (!job.entry.structuredTargets?.length) {
          const detected = detectStructuredConsoleLine(job.entry.text);
          if (detected.length) {
            job.entry.structuredTargets = detected;
            attachStructuredPillsToLine(job.lineEl, job.contentEl, detected);
          }
        } else if (!job.lineEl.querySelector('.telnet-structured-view-pills')) {
          attachStructuredPillsToLine(job.lineEl, job.contentEl, job.entry.structuredTargets);
        }

        if (job.entry.structuredTargets?.length) {
          paintJsonPlusRangesForLine(job.lineEl, job.contentEl, job.entry.structuredTargets);
        }
      }
    }, DRAIN_TICK_DELAY_MS);
  };

  return {
    enqueue(job): void {
      queue.push(job);
      schedule();
    },
    clear(): void {
      queue.length = 0;
      if (drainTimer != null) {
        clearTimeout(drainTimer);
        drainTimer = null;
      }
    },
    schedule
  };
}
