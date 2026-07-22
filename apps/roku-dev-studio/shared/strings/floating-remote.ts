/**
 * UI strings for the body-level Floating Remote singleton
 * (renderer/components/floating-remote/floating-remote.ts).
 *
 * Short leaves are button/title/aria labels (Title Case); the compact Dev App
 * footer reuses the same wording the full Dev App tab uses for its controls.
 */
export const floatingRemote = {
  // Shell chrome
  dialogAriaLabel: 'Floating Remote',
  shellTitle: 'Remote',
  hide: 'Hide Floating Remote',

  // Compact Dev App footer
  sideloadTitle: 'Sideload a Dev Channel',
  sideloadDevApp: 'Sideload Dev App',
  devAppFallbackName: 'Dev App',
  launchDevApp: 'Launch Dev App',
  deleteDevApp: 'Delete Dev App',
} as const;
