/**
 * Ukrainian (uk) translation of the About window strings
 * (renderer/components/about/about.ts).
 *
 * The `copy*` functions compose the clipboard block the "Copy" button produces;
 * the static field labels themselves live in about.html.
 */
export const about = {
  // App version line under the logo
  versionLabel: (v: string): string => `Версія ${v}`,

  // "Copy" button transient feedback (plain text — no ✓ prefix, unlike common.copied)
  copied: 'Скопійовано!',

  // Clipboard block assembled by "Copy"
  copyAppVersion: (v: string): string => `Версія Roku Dev Studio: ${v}`,
  copyApiVersion: (v: string): string => `Версія API Roku Dev Studio: ${v}`,
  copyElectronVersion: (v: string): string => `Версія Electron: ${v}`,
  copyNodeVersion: (v: string): string => `Версія Node.js: ${v}`,
  copyChromiumVersion: (v: string): string => `Версія Chromium: ${v}`,
  copyV8Version: (v: string): string => `Версія V8: ${v}`,
  copyOperatingSystem: (v: string): string => `Операційна система: ${v}`,

  // Fatal load fallbacks (replace the whole body)
  apiUnavailable: 'API вікна «Про програму» недоступний.',
  failedToLoad: (err: string): string => `Не вдалося завантажити: ${err}`,

  // Window document title + logo image alt text
  windowTitle: 'Про Roku Dev Studio',
  logoAlt: 'Roku Dev Studio',

  // Main-process dialog.showErrorBox when the About window fails to load
  loadFailedMessage: 'Не вдалося завантажити вікно «Про програму». Спробуйте ще раз.',

  // Static about.html shell — app name header, version field labels, credit line.
  // (The version *values* beside these labels are filled by JS; only the labels are localized.)
  appName: 'Roku Dev Studio',
  apiVersionLabel: 'Версія roku-dev-studio-api:',
  electronVersionLabel: 'Версія Electron:',
  nodeVersionLabel: 'Версія Node.js:',
  chromiumVersionLabel: 'Версія Chromium:',
  v8VersionLabel: 'Версія V8:',
  osLabel: 'Операційна система:',
  builtBy: 'Розроблено',
};
