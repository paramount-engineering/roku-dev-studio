/**
 * Pure helper for recognizing a file passed as a launch argument — Windows/
 * Linux "Open With" a registered file, or a second launch's argv relayed via
 * Electron's `second-instance` event (`main.ts`). No Electron dependency, so
 * it's plain-Node testable (see `scripts/verify-launch-file-argv.ts`).
 *
 * Extension lists + suffix matching live in `../shared/file-associations` —
 * shared with the renderer's drag-and-drop-onto-the-main-window handling.
 */
import * as path from 'path';
import * as fs from 'fs';

import {
  LOG_VIEWER_ASSOCIATED_EXTENSIONS,
  NETWORK_SESSION_ASSOCIATED_EXTENSIONS,
  fileMatchesSuffixes,
  classifyAssociatedFile,
  type AssociatedFileKind
} from '../shared/file-associations';

export {
  LOG_VIEWER_ASSOCIATED_EXTENSIONS,
  NETWORK_SESSION_ASSOCIATED_EXTENSIONS,
  fileMatchesSuffixes,
  classifyAssociatedFile,
  type AssociatedFileKind
};

/**
 * Find a file path in a launch's argv matching one of `suffixes`. Scans from
 * the end since Electron/user flags come first (`[execPath, ...flags,
 * filePath]` in a packaged launch); skips argv[0] (the executable). Ignores
 * anything that isn't a real file on disk.
 */
export function extractFilePathFromArgv(argv: string[], suffixes: string[]): string | null {
  for (let i = argv.length - 1; i >= 1; i--) {
    const arg = argv[i];
    if (!arg || arg.startsWith('-')) continue;
    if (!fileMatchesSuffixes(arg, suffixes)) continue;
    try {
      if (fs.statSync(arg).isFile()) return path.resolve(arg);
    } catch {
      /* not a real, readable file */
    }
  }
  return null;
}
