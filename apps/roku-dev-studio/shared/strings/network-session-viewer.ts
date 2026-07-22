/**
 * UI strings for the standalone Network Session Viewer window
 * (renderer/components/network-session-viewer/network-session-viewer.ts).
 */
export const networkSessionViewer = {
  /** Window title + modal title prefix (used when no file name is known). */
  networkSession: 'Network Session',
  /** Window title once a capture file name is known. */
  windowTitleWithFile: (fileName: string): string => `Network Session — ${fileName}`,
  /** Empty-state shown when the capture can't be loaded. */
  failedToLoadSession: 'Failed to load session.',

  // Static network-session-viewer.html header controls (mirrors the live Network Inspector).
  // Find controls
  findBtnTitle: 'Find in Traffic — URL, Payloads, Headers, Response Bodies (⌘/Ctrl+F)',
  findBtnAria: 'Find in Traffic',
  findPrevTitle: 'Previous Match (Shift+↑)',
  findPrevAria: 'Previous Match',
  findNextTitle: 'Next Match (Shift+↓)',
  findNextAria: 'Next Match',
  findClear: 'Clear Find results',
  // Filter controls
  filterPlaceholder: 'Filter Traffic…',
  filterTitle: 'Filter Traffic — click the info icon for supported syntax.',
  clearFilter: 'Clear filter',
  filterHelpTitle: 'Filtering Help & Supported Syntax',
  filterHelpAria: 'Filtering help',
  filterResizeTitle: 'Drag to resize the filter (double-click to reset)',
  // Layout toggle + sidebar options
  layoutToggleTitle: 'Stack Request and Response Vertically',
  layoutToggleAria: 'Toggle Detail Layout',
  collapseGroups: 'Collapse all groups',
  groupByHostTitle: 'Group Sessions by Hostname',
  groupByHost: 'Group by Host',
} as const;
