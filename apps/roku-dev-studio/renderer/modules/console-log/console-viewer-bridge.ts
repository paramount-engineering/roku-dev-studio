/** Fired when JSON/XML/URL telnet viewer overlays close so streaming can resume heavy work. */
export const CONSOLE_VIEWER_CLOSED_EVENT = 'rds:telnet-viewer-closed';

export function notifyConsoleViewerClosed(): void {
  document.dispatchEvent(new CustomEvent(CONSOLE_VIEWER_CLOSED_EVENT, { bubbles: true }));
}
