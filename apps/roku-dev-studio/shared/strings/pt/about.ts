/**
 * UI strings for the About window (renderer/components/about/about.ts).
 *
 * The `copy*` functions compose the clipboard block the "Copy" button produces;
 * the static field labels themselves live in about.html. Parametrized strings are
 * functions returning the composed text (interpolation preserved verbatim).
 */
export const about = {
  // App version line under the logo
  versionLabel: (v: string): string => `Versão ${v}`,

  // "Copy" button transient feedback (plain text — no ✓ prefix, unlike common.copied)
  copied: 'Copiado!',

  // Clipboard block assembled by "Copy"
  copyAppVersion: (v: string): string => `Versão do Roku Dev Studio: ${v}`,
  copyApiVersion: (v: string): string => `Versão da API do Roku Dev Studio: ${v}`,
  copyElectronVersion: (v: string): string => `Versão do Electron: ${v}`,
  copyNodeVersion: (v: string): string => `Versão do Node.js: ${v}`,
  copyChromiumVersion: (v: string): string => `Versão do Chromium: ${v}`,
  copyV8Version: (v: string): string => `Versão do V8: ${v}`,
  copyOperatingSystem: (v: string): string => `Sistema operacional: ${v}`,

  // Fatal load fallbacks (replace the whole body)
  apiUnavailable: 'API do Sobre indisponível.',
  failedToLoad: (err: string): string => `Falha ao carregar: ${err}`,

  // Window document title + logo image alt text
  windowTitle: 'Sobre o Roku Dev Studio',
  logoAlt: 'Roku Dev Studio',

  // Main-process dialog.showErrorBox when the About window fails to load
  loadFailedMessage: 'Falha ao carregar a caixa de diálogo Sobre. Tente novamente.',

  // Static about.html shell — app name header, version field labels, credit line.
  // (The version *values* beside these labels are filled by JS; only the labels are localized.)
  appName: 'Roku Dev Studio',
  apiVersionLabel: 'Versão do roku-dev-studio-api:',
  electronVersionLabel: 'Versão do Electron:',
  nodeVersionLabel: 'Versão do Node.js:',
  chromiumVersionLabel: 'Versão do Chromium:',
  v8VersionLabel: 'Versão do V8:',
  osLabel: 'Sistema operacional:',
  builtBy: 'Desenvolvido por',
};
