/**
 * UI strings for the crash/exception report modal (renderer/modules/errors/).
 * Shown when an uncaught error/rejection fires in any window or the main process.
 */
export const crashReport = {
  title: 'An Error Occurred',
  description: 'Description',
  errorSection: 'Stack Trace',
  environmentSection: 'Environment',
  stepsToReproduce: 'Steps to Reproduce',
  stepsToReproducePlaceholder: 'Add steps here',
  reportOnGithub: 'Report on GitHub',
  copyCrashInfo: 'Copy Crash Info',
  copyAsMarkdown: 'Copy as Markdown',
  moreCopyOptions: 'More Copy Options',
  appVersionLabel: 'App version',
  platformLabel: 'OS / Platform',
  windowLabel: 'Window',
  issueTitle: (errorType: string, message: string): string => `[Crash] ${errorType}: ${message}`
} as const;
