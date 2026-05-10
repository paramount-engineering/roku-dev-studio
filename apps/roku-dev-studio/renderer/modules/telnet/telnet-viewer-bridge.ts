/** Fired when JSON/XML/URL telnet viewer overlays close so streaming can resume heavy work. */
export const TELNET_VIEWER_CLOSED_EVENT = 'rds:telnet-viewer-closed';

export function notifyTelnetViewerClosed(): void {
  document.dispatchEvent(new CustomEvent(TELNET_VIEWER_CLOSED_EVENT, { bubbles: true }));
}
