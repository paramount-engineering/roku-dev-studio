/**
 * Romanian (ro) translation of the About window strings
 * (renderer/components/about/about.ts).
 *
 * The `copy*` functions compose the clipboard block the "Copy" button produces;
 * the static field labels themselves live in about.html.
 */
export const about = {
  // App version line under the logo
  versionLabel: (v: string): string => `Versiunea ${v}`,

  // "Copy" button transient feedback (plain text — no ✓ prefix, unlike common.copied)
  copied: 'Copiat!',

  // Clipboard block assembled by "Copy"
  copyAppVersion: (v: string): string => `Versiune Roku Dev Studio: ${v}`,
  copyApiVersion: (v: string): string => `Versiune API Roku Dev Studio: ${v}`,
  copyElectronVersion: (v: string): string => `Versiune Electron: ${v}`,
  copyNodeVersion: (v: string): string => `Versiune Node.js: ${v}`,
  copyChromiumVersion: (v: string): string => `Versiune Chromium: ${v}`,
  copyV8Version: (v: string): string => `Versiune V8: ${v}`,
  copyOperatingSystem: (v: string): string => `Sistem de operare: ${v}`,

  // Fatal load fallbacks (replace the whole body)
  apiUnavailable: 'API-ul ferestrei „Despre” indisponibil.',
  failedToLoad: (err: string): string => `Încărcarea a eșuat: ${err}`,

  // Window document title + logo image alt text
  windowTitle: 'Despre Roku Dev Studio',
  logoAlt: 'Roku Dev Studio',

  // Main-process dialog.showErrorBox when the About window fails to load
  loadFailedMessage: 'Încărcarea ferestrei „Despre” a eșuat. Încercați din nou.',

  // Static about.html shell — app name header, version field labels, credit line.
  // (The version *values* beside these labels are filled by JS; only the labels are localized.)
  appName: 'Roku Dev Studio',
  apiVersionLabel: 'Versiune roku-dev-studio-api:',
  electronVersionLabel: 'Versiune Electron:',
  nodeVersionLabel: 'Versiune Node.js:',
  chromiumVersionLabel: 'Versiune Chromium:',
  v8VersionLabel: 'Versiune V8:',
  osLabel: 'Sistem de operare:',
  builtBy: 'Realizat de',
};
