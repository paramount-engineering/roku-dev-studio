/**
 * Central resolver for the sideloaded Dev App's developer password.
 *
 * Different callers have different priority orders (and for good reason):
 *
 * - Action Script Executor (`components/action-scripts/executor-engine.ts`):
 *   `step.password > script.devPassword > UI input`. Scripts that declare a
 *   devPassword override the user's ambient UI entry; step-level password
 *   overrides the script for that one step.
 *
 * - Import modal (`components/action-scripts/import-modal.ts`):
 *   `stored (per-serial) > script.devPassword > modal input`. If we already
 *   know the device's password, we never try the script's embedded value
 *   (which is often stale / copied from another device).
 *
 * - Node script-runner (`packages/roku-dev-studio-api/lib/script-runner.ts`):
 *   `step.password > script.devPassword > CLI --password`. No storage.
 *
 * This helper lets each caller pass their relevant sources + their own
 * priority list, so the duplication is "same function, different policy"
 * rather than three copies of almost-the-same chain.
 */

/** All password sources this app knows about. Keys are optional so every
 *  caller only fills in what's relevant to its environment. */
export interface DevPasswordSources {
  /** Explicit password attached to a single Action Script step. */
  stepPassword?: string | null;
  /** `devPassword` field on the script root. */
  scriptDevPassword?: string | null;
  /** User-visible input (executor prompt or device panel `.dev-password`). */
  uiInput?: string | null;
  /** Password cached in `localStorage` for this device serial. */
  storedForSerial?: string | null;
  /** CLI / programmatic override (Node script-runner). */
  cliOverride?: string | null;
}

/** The first source in `priority` with a non-empty trimmed value wins. */
export function resolveDevPassword(
  sources: DevPasswordSources,
  priority: ReadonlyArray<keyof DevPasswordSources>
): string {
  for (const key of priority) {
    const raw = sources[key];
    if (raw == null) continue;
    const trimmed = String(raw).trim();
    if (trimmed) return trimmed;
  }
  return '';
}
