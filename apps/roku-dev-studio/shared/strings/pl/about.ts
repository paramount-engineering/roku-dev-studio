/**
 * Polish (pl) translation of the About window strings
 * (renderer/components/about/about.ts).
 *
 * The `copy*` functions compose the clipboard block the "Copy" button produces;
 * the static field labels themselves live in about.html.
 */
export const about = {
  // App version line under the logo
  versionLabel: (v: string): string => `Wersja ${v}`,

  // "Copy" button transient feedback (plain text — no ✓ prefix, unlike common.copied)
  copied: 'Skopiowano!',

  // Clipboard block assembled by "Copy"
  copyAppVersion: (v: string): string => `Wersja Roku Dev Studio: ${v}`,
  copyApiVersion: (v: string): string => `Wersja API Roku Dev Studio: ${v}`,
  copyElectronVersion: (v: string): string => `Wersja Electron: ${v}`,
  copyNodeVersion: (v: string): string => `Wersja Node.js: ${v}`,
  copyChromiumVersion: (v: string): string => `Wersja Chromium: ${v}`,
  copyV8Version: (v: string): string => `Wersja V8: ${v}`,
  copyOperatingSystem: (v: string): string => `System operacyjny: ${v}`,

  // Fatal load fallbacks (replace the whole body)
  apiUnavailable: 'API okna „O programie” niedostępne.',
  failedToLoad: (err: string): string => `Nie udało się załadować: ${err}`,

  // Window document title + logo image alt text
  windowTitle: 'O programie Roku Dev Studio',
  logoAlt: 'Roku Dev Studio',

  // Main-process dialog.showErrorBox when the About window fails to load
  loadFailedMessage: 'Nie udało się załadować okna „O programie”. Spróbuj ponownie.',

  // Static about.html shell — app name header, version field labels, credit line.
  // (The version *values* beside these labels are filled by JS; only the labels are localized.)
  appName: 'Roku Dev Studio',
  apiVersionLabel: 'Wersja roku-dev-studio-api:',
  electronVersionLabel: 'Wersja Electron:',
  nodeVersionLabel: 'Wersja Node.js:',
  chromiumVersionLabel: 'Wersja Chromium:',
  v8VersionLabel: 'Wersja V8:',
  osLabel: 'System operacyjny:',
  builtBy: 'Zbudowane przez',
};
