/**
 * Default `Console:`; log file viewer sets this to the opened file basename (separate window = own module state).
 */
let viewerModalTitlePrefix: string | null = null;

/** Call from log file viewer after a file loads; pass `null` to use the default `Console` prefix. */
export function setConsoleViewerModalTitlePrefix(prefix: string | null): void {
  viewerModalTitlePrefix = prefix?.trim() || null;
}

/**
 * Unified title for telnet viewer modals (JSON, XML, URL).
 * Pattern: `{prefix}: {Label}` with prefix `Console` or the log file name.
 */
export function consoleViewerModalTitle(typeLabel: string): string {
  const t = typeLabel.trim();
  const base = viewerModalTitlePrefix || 'Console';
  return t ? `${base}: ${t}` : base;
}
