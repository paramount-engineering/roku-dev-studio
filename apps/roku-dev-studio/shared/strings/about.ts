/**
 * UI strings for the About window (renderer/components/about/about.ts).
 *
 * The `copy*` functions compose the clipboard block the "Copy" button produces;
 * the static field labels themselves live in about.html. Parametrized strings are
 * functions returning the composed text (interpolation preserved verbatim).
 */
export const about = {
  // App version line under the logo
  versionLabel: (v: string): string => `Version ${v}`,

  // "Copy" button transient feedback (plain text — no ✓ prefix, unlike common.copied)
  copied: 'Copied!',

  // Clipboard block assembled by "Copy"
  copyAppVersion: (v: string): string => `Roku Dev Studio Version: ${v}`,
  copyApiVersion: (v: string): string => `Roku Dev Studio API Version: ${v}`,
  copyElectronVersion: (v: string): string => `Electron Version: ${v}`,
  copyNodeVersion: (v: string): string => `Node.js Version: ${v}`,
  copyChromiumVersion: (v: string): string => `Chromium Version: ${v}`,
  copyV8Version: (v: string): string => `V8 Version: ${v}`,
  copyOperatingSystem: (v: string): string => `Operating System: ${v}`,

  // Fatal load fallbacks (replace the whole body)
  apiUnavailable: 'About API unavailable.',
  failedToLoad: (err: string): string => `Failed to load: ${err}`,

  // Window document title + logo image alt text
  windowTitle: 'About Roku Dev Studio',
  logoAlt: 'Roku Dev Studio',

  // Main-process dialog.showErrorBox when the About window fails to load
  loadFailedMessage: 'Failed to load About dialog. Please try again.',

  // Static about.html shell — app name header, version field labels, credit line.
  // (The version *values* beside these labels are filled by JS; only the labels are localized.)
  appName: 'Roku Dev Studio',
  apiVersionLabel: 'roku-dev-studio-api Version:',
  electronVersionLabel: 'Electron Version:',
  nodeVersionLabel: 'Node.js Version:',
  chromiumVersionLabel: 'Chromium Version:',
  v8VersionLabel: 'V8 Version:',
  osLabel: 'Operating System:',
  builtBy: 'Built by',
  appDetails: 'App Details',
  submitIssue: 'Submit an Issue',
  checkingForUpdates: 'Checking…',
  /** Prefilled GitHub issue title; the user completes it after the colon. */
  issueTitle: (v: string): string => `Roku Dev Studio v${v}: `,
  /** Prefilled GitHub issue body — the App Details table in a code fence plus a prompt to describe the problem. */
  issueBody: (details: string): string =>
    `### App Details\n\n\`\`\`\n${details}\n\`\`\`\n\n### What happened\n\n_Describe the problem and how to reproduce it._\n`,
} as const;
