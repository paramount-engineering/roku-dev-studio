/**
 * Latin American Spanish (neutral) translation of the BrightScript Fiddle window
 * strings. Sibling of ../fiddle.ts — same `fiddle` shape, keys, order, and
 * function signatures. Only literal display text is translated.
 */
export const fiddle = {
  // Device dropdown
  selectDevice: 'Seleccione un dispositivo',
  noDevices: 'No se encontraron dispositivos con Modo dev habilitado',
  deviceFallbackName: 'Roku',
  remotePrefix: '[Remoto] ',

  // Diagnostics status chip (bottom of the editor)
  noIssues: 'Sin problemas',
  diagWarnings: (warnCount: number): string => `${warnCount} Advertencia${warnCount === 1 ? '' : 's'}`,
  diagErrors: (errCount: number, warnCount: number): string =>
    `${errCount} Error${errCount === 1 ? '' : 'es'}${warnCount ? `, ${warnCount} Advertencia${warnCount === 1 ? '' : 's'}` : ''}`,

  // Password modal
  passwordRequired: 'La contraseña es obligatoria.',

  // Run / Stop status line
  selectDeviceFirst: 'Primero seleccione un dispositivo.',
  deviceUnavailable: 'El dispositivo seleccionado ya no está disponible.',
  runCancelledPassword: 'Ejecución cancelada — se requiere contraseña.',
  running: 'Ejecutando...',
  runFailed: 'La ejecución falló.',
  runFailedWith: (msg: string): string => `La ejecución falló: ${msg}`,
  sideloadWaiting: 'Sideload completado — esperando salida…',
  runningOnDevice: 'Ejecutando en el dispositivo…',
  runComplete: 'Ejecución completada.',
  editorReset: 'Editor restablecido al Snippet predeterminado.',
  uninstalling: 'Desinstalando...',
  channelRemoved: 'Canal de BrightScript Fiddle eliminado.',
  stopFailed: 'Error al detener.',
  ready: 'Listo.',

  // Reset-code confirm
  resetConfirm: '¿Restablecer el editor al Snippet predeterminado? Se perderán los cambios no guardados.',

  // Editor bootstrap status
  loadingEditor: 'Cargando editor...',
  editorFailedToLoad: (msg: string): string => `Error al cargar el editor: ${msg}`,

  // Monaco command-palette / context-menu action
  runOnDevice: 'Ejecutar en el dispositivo',

  // Static fiddle.html shell — header, device picker, panes, status row
  heading: 'BrightScript Fiddle',
  subtitle: 'Ejecute un snippet rápido de BrightScript en cualquier dispositivo conectado.',
  deviceLabel: 'Dispositivo',
  scanForDevices: 'Buscar dispositivos',
  runBtn: 'Ejecutar',
  runBtnTitle: 'Ejecutar (⌘/Ctrl+Enter)',
  stopBtn: 'Detener',
  stopBtnTitle: 'Desinstalar el canal de Fiddle',
  codeLabel: 'Código',
  resetSnippetTitle: 'Restablecer al Snippet predeterminado',
  resetSnippetAria: 'Restablecer el editor al Snippet predeterminado',
  terminalLabel: 'Terminal',
  clearTerminal: 'Limpiar terminal',
  statusRowCaption: 'Ejecutar reemplaza el canal actualmente cargado con sideload en el dispositivo seleccionado.',

  // Developer-password modal
  passwordModalTitle: 'Se requiere la contraseña de desarrollador',
  passwordModalHint:
    'El sideload requiere la contraseña de desarrollador del dispositivo, la que estableció al habilitar el Modo de desarrollador.',
  passwordLabel: 'Contraseña',
  passwordPlaceholder: 'Ingrese la contraseña de desarrollador',
  passwordModalHintMuted:
    'Esta contraseña se usa solo para esta sesión. Para guardarla para uso futuro, verifique el Modo de desarrollador en la ventana principal.',
  passwordSubmitBtn: 'Guardar y ejecutar',

  /**
   * Monaco editor's initial value + the target of "Reset to default Snippet".
   * The two leading `'` comment lines are user-facing guidance; the BrightScript
   * keywords/identifiers (`Sub`, `End Sub`, `print`, `userFiddle`, `init`) and the
   * example `print` output are code tokens kept verbatim. Composed via the same
   * newline join as the source so the editor value is byte-for-byte identical.
   */
  defaultSnippet: [
    "' `userFiddle` es el punto de entrada que Fiddle ejecuta después de que el canal está en pantalla.",
    "' Coloque su snippet aquí — también puede definir subs/funciones auxiliares abajo y llamarlos desde userFiddle. NO defina un sub llamado `init` — ese identificador está reservado por la escena de Fiddle.",
    'Sub userFiddle()',
    '    print "Hello from Roku Dev Studio Fiddle"',
    'End Sub',
    ''
  ].join('\n'),

  // ── Main-process diagnostics + run/stop errors (main/ipc/bs-fiddle-handlers.ts) ──
  // Surfaced in the Fiddle UI (Monaco markers or the status line). Code literals
  // (`init`, `userFiddle`) are kept verbatim.
  lintReservedInit:
    'El nombre `init` está reservado por la escena de Fiddle. Cambie el nombre de este sub a `userFiddle` — Fiddle llamará a `userFiddle()` automáticamente una vez que la escena esté en pantalla.',
  errWindowUnavailable: 'La ventana de Fiddle ya no está disponible.',
  errDeviceDisconnected: 'El dispositivo seleccionado ya no está conectado.',
  errNoPasswordProvided: 'No se proporcionó ninguna contraseña de desarrollador.',
  errNoPasswordAvailable: 'No hay ninguna contraseña de desarrollador disponible para este dispositivo.',
  errPackageFailed: (detail: string): string => `Error al empaquetar el snippet: ${detail}`,
  errRemoteMissingServerUrl: 'Al dispositivo remoto le falta la URL de su servidor relay — no se pueden transmitir los registros de telnet.',
  errSideloadFailed: 'El sideload falló',
  errDeviceNotFound: 'Dispositivo no encontrado.',
  errNotFiddleChannel:
    'El canal dev actualmente instalado no es un canal de Fiddle — se dejó intacto para no eliminar su propia app.',

  // humanizeRemoteUploadError prose (remote relay upload failures)
  errRemoteUnknown: 'Error desconocido del servidor relay remoto.',
  errRemoteNetworkBlip:
    'Fallo de red entre el servidor relay y el Roku (conexión interrumpida). ' +
    'Esto suele resolverse al reintentar — si sigue ocurriendo, verifique que el ' +
    'host del relay pueda comunicarse con el dispositivo por la LAN y que el Roku no esté ocupado.',
  errRemoteCurl: (detail: string): string => `Error de curl del relay remoto: ${detail}`,
};
