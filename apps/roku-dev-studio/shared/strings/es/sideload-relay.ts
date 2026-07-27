/**
 * Latin American Spanish (neutral) translation of the Sideload Relay settings
 * section + device-setup modal strings. Sibling of ../sideload-relay.ts — same
 * `sideloadRelay` shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. Only literal
 * display text is translated.
 */
export const sideloadRelay = {
  // Enable gate
  gateTitle: 'Para habilitar Sideload Relay:',
  gateNeedPassword: 'Establezca una contraseña de dev del relay para que su IDE pueda autenticarse con RDS.',
  gateNeedDevice: 'Elija al menos un dispositivo accesible — abra “Configurar dispositivos” y habilite un dispositivo que esté en línea.',

  // Targeted Devices summary row
  targetSummaryEmpty: 'Aún no hay dispositivos seleccionados. Haga clic en “Configurar dispositivos” para elegir qué Rokus reciben cada compilación.',
  targetSummaryChecking: (n: number): string =>
    `${n} dispositivo${n === 1 ? '' : 's'} seleccionado${n === 1 ? '' : 's'} · verificando accesibilidad…`,
  targetSummaryReachable: (reachable: number): string => `${reachable} habilitado${reachable === 1 ? '' : 's'} y accesible${reachable === 1 ? '' : 's'}`,
  targetSummaryOfflineSuffix: (offline: number): string => ` · ${offline} sin conexión (omitido${offline === 1 ? '' : 's'} hasta que sean accesibles)`,

  // Toggle rows + password field
  enableTitle: 'Habilitar Sideload Relay',
  enableDesc: 'Anuncia RDS como un Roku por SSDP y acepta sideloads. Desactivado de forma predeterminada.',
  passwordTitle: 'Contraseña de dev del relay',
  passwordDesc: 'Contraseña con la que se autentica su IDE (usuario rokudev). En blanco conserva la guardada.',
  autoConsoleTitle: 'Conectar consola automáticamente',
  autoConsoleDesc: 'Abre la consola telnet 8085 en cada dispositivo después de instalar.',
  retryTitle: 'Reintentar una vez ante un fallo',
  retryDesc: 'Reintenta una instalación fallida una vez antes de informarla.',
  targetedDevicesTitle: 'Dispositivos seleccionados',
  setupDevicesBtn: 'Configurar dispositivos',
  targetSummaryLoading: 'Cargando…',

  // Setup modal
  modalTitle: 'Configurar dispositivos de Sideload Relay',
  modalSubtitle:
    'Los dispositivos habilitados y accesibles reciben cada compilación que carga con sideload mediante RDS. Los dispositivos seleccionados previamente que estén sin conexión permanecen en la lista (deshabilitados) y se reincorporan automáticamente cuando vuelven a ser accesibles.',
  scanBtn: 'Escanear dispositivos',
  scanning: 'Escaneando…',
  colLocation: 'Ubicación',
  colDevice: 'Dispositivo',
  colIpSerial: 'IP y serial',
  colEnabled: 'Habilitado',
  colReachable: 'Accesible',
  emptyDevices: 'No se encontraron dispositivos. Asegúrese de que sus Rokus estén encendidos y en modo dev, luego vuelva a escanear.',
  locRemote: 'Remoto',
  locLocal: 'Local',

  // Per-device password affordance
  setPasswordBtn: '🔒 Establecer contraseña',
  setPasswordTitle: 'Ingrese y valide la contraseña de dev para habilitar este dispositivo',
  enableAriaLabel: (name: string): string => `Habilitar ${name}`,
  reachableNow: 'Accesible ahora',
  reachableOk: '✓',
  reachableOff: '○ sin conexión',
  reachableOffTitle: 'No accesible — omitido hasta que vuelva a estar en línea',

  // Inline password editor
  pwInputPlaceholder: 'Contraseña de dev',
  pwInputAriaLabel: (name: string): string => `Contraseña de dev para ${name}`,
  pwValidateTitle: (name: string): string => `Validar y habilitar ${name}`,
  pwValidateAriaLabel: 'Validar contraseña',
  pwValidateChar: '✓',
  pwEnterPassword: 'Ingrese una contraseña',
  pwWrong: 'Contraseña incorrecta',
  pwUnreachable: 'No accesible',

  // Modal summary
  modalSummary: (enabledReachable: number, reachableTotal: number): string =>
    `${enabledReachable} habilitado${enabledReachable === 1 ? '' : 's'} y accesible${enabledReachable === 1 ? '' : 's'} de ${reachableTotal} en línea`,
  modalSummaryOfflineSuffix: (offline: number): string => ` · ${offline} sin conexión conservado${offline === 1 ? '' : 's'}`,

  // Scan status
  scanFound: (local: number, remote: number, total: number): string =>
    `${total === 1 ? 'Se encontró' : 'Se encontraron'} ${local} dispositivo${total === 1 ? '' : 's'} de dev local${local === 1 ? '' : 'es'}${remote ? ` · ${remote} remoto${remote === 1 ? '' : 's'}` : ''}.`,
  scanFailed: 'El escaneo falló.',

  // Save status
  saved: 'Configuración de Sideload Relay guardada.',
  saveFailed: 'Error al guardar',
  fixBeforeEnable: 'Corrija los elementos anteriores antes de habilitar Sideload Relay.',

  // Password reveal aria/title
  showPassword: 'Mostrar contraseña',
  hidePassword: 'Ocultar contraseña',

  // Saved-password placeholder hint
  savedPasswordPlaceholder: '•••••••• (guardada)',

  // ── Native allow/deny prompt on the host (main/sideload-relay/index.ts) ──
  authorizeTitle: 'Sideload Relay',
  authorizeAllow: 'Permitir',
  authorizeDeny: 'Denegar',
  authorizeMessage: (who: string): string => `¿Permitir un sideload desde ${who}?`,
  authorizeDetail:
    'Otro dispositivo en su red está intentando instalar una compilación a través de Roku Dev Studio. ' +
    'Permítalo solo si reconoce este dispositivo.',

  // ── Relay dev-password validate / reveal + settings-save errors (main/ipc/relay-handlers.ts) ──
  errDeviceIpPasswordRequired: 'Se requieren la IP y la contraseña del dispositivo.',
  errIncorrectPassword: 'Contraseña de desarrollador incorrecta.',
  errValidationFailed: 'La validación falló.',
  errCouldNotReadPassword: 'No se pudo leer la contraseña guardada.',
  errCouldNotWriteSettings: 'No se pudo escribir el archivo de configuración.',
};
