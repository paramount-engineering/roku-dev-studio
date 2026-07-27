/**
 * UI strings for the About window (renderer/components/about/about.ts). Latin American Spanish.
 *
 * The `copy*` functions compose the clipboard block the "Copy" button produces;
 * the static field labels themselves live in about.html.
 */
export const about = {
  // App version line under the logo
  versionLabel: (v: string): string => `Versión ${v}`,

  // "Copy" button transient feedback (plain text — no ✓ prefix, unlike common.copied)
  copied: '¡Copiado!',

  // Clipboard block assembled by "Copy"
  copyAppVersion: (v: string): string => `Versión de Roku Dev Studio: ${v}`,
  copyApiVersion: (v: string): string => `Versión de la API de Roku Dev Studio: ${v}`,
  copyElectronVersion: (v: string): string => `Versión de Electron: ${v}`,
  copyNodeVersion: (v: string): string => `Versión de Node.js: ${v}`,
  copyChromiumVersion: (v: string): string => `Versión de Chromium: ${v}`,
  copyV8Version: (v: string): string => `Versión de V8: ${v}`,
  copyOperatingSystem: (v: string): string => `Sistema operativo: ${v}`,

  // Fatal load fallbacks (replace the whole body)
  apiUnavailable: 'API de Acerca de no disponible.',
  failedToLoad: (err: string): string => `No se pudo cargar: ${err}`,

  // Window document title + logo image alt text
  windowTitle: 'Acerca de Roku Dev Studio',
  logoAlt: 'Roku Dev Studio',

  // Main-process dialog.showErrorBox when the About window fails to load
  loadFailedMessage: 'No se pudo cargar el cuadro de diálogo Acerca de. Inténtelo de nuevo.',

  // Static about.html shell — app name header, version field labels, credit line.
  // (The version *values* beside these labels are filled by JS; only the labels are localized.)
  appName: 'Roku Dev Studio',
  apiVersionLabel: 'Versión de roku-dev-studio-api:',
  electronVersionLabel: 'Versión de Electron:',
  nodeVersionLabel: 'Versión de Node.js:',
  chromiumVersionLabel: 'Versión de Chromium:',
  v8VersionLabel: 'Versión de V8:',
  osLabel: 'Sistema operativo:',
  builtBy: 'Desarrollado por',
};
