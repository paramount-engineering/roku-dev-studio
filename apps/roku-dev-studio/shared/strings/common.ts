/**
 * Common UI strings reused across windows/components (buttons, generic labels,
 * status words). Area-specific strings live in their own module (settings.ts, …).
 *
 * Casing follows the app convention (see the ui-text-casing rule): short
 * labels/buttons → Title Case; full sentences → Sentence case.
 */
export const common = {
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  ok: 'OK',
  apply: 'Apply',
  retry: 'Retry',
  remove: 'Remove',
  delete: 'Delete',
  copy: 'Copy',
  copied: '✓ Copied!',
  clear: 'Clear',
  reset: 'Reset',
  edit: 'Edit',
  add: 'Add',
  collapse: 'Collapse',
  expand: 'Expand',
  done: 'Done',
  yes: 'Yes',
  no: 'No',
  loading: 'Loading…',
  scanning: 'Scanning…',
  saving: 'Saving…',
  connect: 'Connect',
  disconnect: 'Disconnect',
  connected: 'Connected',
  disconnected: 'Disconnected',
  refresh: 'Refresh',
  search: 'Search',

  // Shared error copy
  error: 'Error',
  couldNotOpenFile: 'Could not open the selected file.',
} as const;
