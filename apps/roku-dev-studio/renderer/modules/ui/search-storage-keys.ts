/**
 * Central naming scheme for the per-search-box persistence keys (saved width +
 * term history). These strings are the storage contract — a typo silently
 * orphans a user's saved width/history — so every call site builds them here
 * rather than inlining `rds.*` template literals.
 *
 * Scoping: keys are namespaced per surface, and most are further scoped by
 * device IP (or another caller token) so history + width don't bleed across
 * device tabs. Standalone windows pass no scope and use sessionStorage, giving
 * them per-window state that clears when the window closes.
 */

/** Optional per-device (or per-window) scope token; falsy → an unscoped key. */
type Scope = string | null | undefined;

const withScope = (base: string, scope: Scope): string => (scope ? `${base}.${scope}` : base);

/**
 * Term-history key for the shared find/filter bars keyed by their highlight id
 * (`ecp-find`, the console's id, …). Used by both find engines
 * (`find-bar.ts`, `console-find-bar.ts`).
 */
export const findHistoryKey = (highlightId: string, scope?: Scope): string =>
  withScope(`rds.find.${highlightId}.history`, scope);

/** Saved-width key for a centered, resizable header search box. */
export const searchWidthKey = (surface: string, scope?: Scope): string =>
  withScope(`rds.${surface}.findWidth`, scope);

/** Saved-width key for surfaces that call their box a "filter" (Network views). */
export const filterWidthKey = (surface: string, scope?: Scope): string =>
  withScope(`rds.${surface}.filterWidth`, scope);

/** Term-history key for filter inputs that manage their own history (Network views). */
export const filterHistoryKey = (surface: string, scope?: Scope): string =>
  withScope(`rds.${surface}.filterHistory`, scope);
