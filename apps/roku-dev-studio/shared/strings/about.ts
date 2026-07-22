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
} as const;
