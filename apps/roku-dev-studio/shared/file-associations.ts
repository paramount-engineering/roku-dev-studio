/**
 * Which file extensions open in which standalone viewer window. Shared
 * between main (electron-builder `fileAssociations` config in package.json,
 * plus "Open With" launch handling in main.ts) and renderer (drag-and-drop
 * onto the main window) so both recognize exactly the same file types.
 *
 * Matching is by literal filename *suffix*, not `path.extname` — the Network
 * Session Viewer's native export uses a compound extension
 * (`rds-network-inspector.json`), and `path.extname` only ever returns the
 * last dot-separated segment (`.json`), which would also match every
 * unrelated `.json` file on the system.
 */

/** Kept in sync manually with package.json's `build.fileAssociations` — that
 *  file is plain JSON, so it can't import this. */
export const LOG_VIEWER_ASSOCIATED_EXTENSIONS = ['log', 'txt', 'text', 'out', 'err', 'trace'];

/** Same, for the Network Session Viewer. `rds-network-inspector.json` (not
 *  bare `json`) is deliberate — see the module doc above. */
export const NETWORK_SESSION_ASSOCIATED_EXTENSIONS = ['rds-network-inspector.json', 'har', 'pcap', 'pcapng'];

/** True if `filePath`'s (or bare filename's) name ends with one of `suffixes`
 *  (each given without a leading dot; may be a simple extension or a
 *  compound one). Case-insensitive. */
export function fileMatchesSuffixes(filePath: string, suffixes: string[]): boolean {
  const lower = filePath.toLowerCase();
  return suffixes.some((s) => lower.endsWith(`.${s.toLowerCase()}`));
}

export type AssociatedFileKind = 'log' | 'network-session';

/** Classify a file by name into which viewer it belongs to, or `null` if it
 *  isn't a recognized type. */
export function classifyAssociatedFile(filePath: string): AssociatedFileKind | null {
  if (fileMatchesSuffixes(filePath, LOG_VIEWER_ASSOCIATED_EXTENSIONS)) return 'log';
  if (fileMatchesSuffixes(filePath, NETWORK_SESSION_ASSOCIATED_EXTENSIONS)) return 'network-session';
  return null;
}
