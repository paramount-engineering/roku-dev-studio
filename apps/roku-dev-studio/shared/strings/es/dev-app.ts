/**
 * Latin American Spanish (neutral) translation of the Dev App panel strings.
 * Sibling of ../dev-app.ts — same `devApp` shape, keys, order, and function
 * signatures. Only literal display text is translated.
 */
export const devApp = {
  // ── Password auth (password-auth.ts) ──────────────────────────────────────
  authenticated: 'Autenticado',
  notAuthenticated: 'No autenticado',
  verify: 'Verificar',
  enterDeveloperPassword: 'Ingrese una contraseña de desarrollador.',
  verificationNoResponse: 'La verificación falló — no hubo respuesta de la Dev App.',

  // ── Quick remote (quick-remote.ts) ────────────────────────────────────────
  sendText: 'Enviar texto',
  sending: 'Enviando...',

  // ── Screenshots (screenshots.ts) ──────────────────────────────────────────
  captureDisabledTitle: 'Inicie la Dev App cargada con sideload en el dispositivo para tomar una captura de pantalla.',
  launchBeforeCapture: 'Inicie la Dev App en el dispositivo antes de tomar una captura de pantalla.',
  capturing: 'Capturando...',
  capture: 'Capturar',
  copiedTitle: '¡Copiado!',
  copyScreenshot: 'Copiar captura de pantalla',
  saveScreenshotAs: 'Guardar captura de pantalla como…',
  clearScreenshot: 'Borrar captura de pantalla',
  copiedToClipboard: '✓ Copiado al portapapeles',
  savedTo: (filePath: string): string => `✓ Guardado en: ${filePath}`,
  failedToCopy: (detail: string): string => `Error al copiar: ${detail}`,
  couldNotGetCanvasContext: 'No se pudo obtener el contexto del canvas',
  couldNotEncodeScreenshot: 'No se pudo codificar la captura de pantalla',

  // ── Sideloaded app card (sideloaded-app.ts) ───────────────────────────────
  versionLabel: 'Versión:',
  unknown: 'Desconocido',
  noChannelSideloaded: 'Actualmente no hay ningún canal cargado con sideload',
  launching: 'Iniciando',
  launch: 'Iniciar',

  // ── Sideloading (sideloading.ts) ──────────────────────────────────────────
  dragDropUnavailable: 'Arrastrar y soltar no está disponible en esta compilación',
  selectFileAndPassword: 'Seleccione un archivo e ingrese su contraseña de desarrollador',
  installing: 'Instalando...',
  install: 'Instalar',
  unknownError: 'Error desconocido',
  deleteSideloadedChannelConfirm: '¿Eliminar el canal cargado con sideload?',

  // Shared between screenshots + sideloading
  pleaseEnterDeveloperPassword: 'Ingrese su contraseña de desarrollador',

  // ── Channel performance parse messages (remote-metrics-charts.ts) ─────────
  channelPerfUnavailable: (err: string): string => `Rendimiento del canal no disponible: ${err}`,
  channelPerfUnavailableFailed: 'Rendimiento del canal no disponible (estado fallido).',
  chartAxisNow: 'ahora',

  // ── Device Performance Action Script capture (device-metrics-performance-step.ts) ──
  captionCpuGraph: 'Uso de CPU (gráfico)',
  captionCpuProcess: 'Uso de CPU (proceso)',
  captionSystemMemory: 'Memoria del sistema',
  captionObjectsCount: 'Objetos de BrightScript (cantidad)',
  captionObjectsMemory: 'Objetos de BrightScript (memoria)',
  invalidChartType: 'Tipo de gráfico de rendimiento del dispositivo no válido.',
  developerModeRequired: 'El Modo de desarrollador debe estar habilitado en este dispositivo para capturar métricas de rendimiento.',
  remoteMetricsRootNotFound: 'No se encontró la raíz de métricas remotas para esta pestaña de dispositivo.',
  performanceCardNotFound: (selector: string): string => `Tarjeta de rendimiento no encontrada: ${selector}`,
  performanceCardNoVisibleBounds:
    'La tarjeta de rendimiento no tiene límites visibles. Active “Mostrar rendimiento del dispositivo” (diseño cuádruple) en la sección Remoto.',
  chartRasterizeFailed: 'La rasterización del gráfico falló (URL de datos vacía o no válida).',
  canvasUnavailable: 'Canvas no disponible',
  couldNotDecodeCaptureForScaling: 'No se pudo decodificar la captura para el escalado de exportación',
  devicePerfHidden:
    'Las tarjetas de rendimiento del dispositivo están ocultas. En la sección Remoto, active “Mostrar rendimiento del dispositivo” (diseño cuádruple) y luego ejecute este paso de nuevo.',
  couldNotShowDevicePerf:
    'No se pudo mostrar el rendimiento del dispositivo automáticamente. En la sección Remoto, active “Mostrar rendimiento del dispositivo” (diseño cuádruple) y luego ejecute este paso de nuevo.',
  stopped: 'Detenido',
  couldNotCaptureDevicePerf:
    'No se pudieron capturar las tarjetas de rendimiento del dispositivo. Asegúrese de que el cuádruple sea visible y que la ventana no esté minimizada.',
  devicePerfAutoEnabledSummary:
    'Se activó automáticamente “Mostrar rendimiento del dispositivo” (diseño cuádruple) para este paso.',
  skippedNoProcStat: (caption: string): string =>
    `Se omitió la captura de "${caption}" — el dispositivo aún no ha producido <proc-stat> (requiere Roku OS 15.2+).`,

  // ── Device metrics: process-state labels (device-metrics.ts) ──────────────
  stateRunning: 'En ejecución',
  stateSleeping: 'En reposo',
  stateIdle: 'Inactivo',
  stateTracingStop: 'Parada de rastreo',
  stateDiskWait: 'Espera de disco',
  stateStopped: 'Detenido',
  stateZombie: 'Zombi',
  stateDead: 'Muerto',

  // ── Device metrics: objects resource monitor ──────────────────────────────
  updatedAt: (time: string): string => `Actualizado: ${time}`,
  memoryEstimatedHint:
    'La memoria se estima a partir de las cantidades de objetos y la memoria de chanperf (“usada”) cuando el dispositivo no envía bytes por tipo.',
  totalBrightScriptObjects: 'Total de objetos de BrightScript',

  // ── Device metrics: header perf strip ─────────────────────────────────────
  latestDevicePerfTitle: 'Último rendimiento del dispositivo (clic para abrir el remoto)',

  // ── Device metrics: CPU process table ─────────────────────────────────────
  processLabel: 'Proceso',
  waitingForProcStat: 'Esperando muestra de proc-stat…',
  stateFieldLabel: 'Estado',
  channelUptime: 'Tiempo de actividad del canal',
  sinceFirstObserved: 'Desde la primera observación',
  userCpuTime: 'Tiempo de CPU de usuario',
  kernelCpuTime: 'Tiempo de CPU de kernel',
  childCpuTime: 'Tiempo de CPU de procesos hijos',
  childFaults: 'Fallos de procesos hijos',
  minorMajor: 'Menores/Mayores',
  clockTickRate: 'Frecuencia de ticks de reloj',
  minorFaults: 'Fallos menores',
  majorFaults: 'Fallos mayores',
  stableFor: (duration: string): string => `Estable durante ${duration}`,
  childCpuTimeSecondary: (user: string, kernel: string): string => `Usuario ${user} · Kernel ${kernel}`,

  // ── Device metrics: chart hover series labels ─────────────────────────────
  hoverTotal: 'Total',
  hoverUser: 'Usuario',
  hoverKernel: 'Kernel',
  hoverUsed: 'Usada',
  hoverResident: 'Residente',
  hoverAnonymous: 'Anónima',
  hoverShared: 'Compartida',
  hoverLimit: 'Límite',

  // ── Device metrics: error toasts ──────────────────────────────────────────
  chanperfRequestFailed: 'La solicitud de chanperf falló',
  couldNotParseChanperf: 'No se pudo analizar el rendimiento del canal (Modo dev / ECP / chanperf).',
  objectCountsFailed: 'Fallaron las cantidades de objetos',
  deviceMetricsUnavailable: 'Métricas del dispositivo no disponibles',

  // ── Device metrics: objects empty states ──────────────────────────────────
  objectsEmptyBackground:
    'No hay desglose de objetos de BrightScript mientras la Dev App está en segundo plano. Inicie o cambie a la Dev App en el dispositivo — las métricas y las cantidades de objetos se actualizan solo cuando está en primer plano.',
  objectsEmptyNoForeground:
    'Aún no hay desglose de objetos de BrightScript. Después de que la conexión informe el canal en primer plano, inicie la Dev App si necesita las cantidades de objetos de la Dev App cargada con sideload.',
  objectsEmptyNoCounts:
    'Aún no hay desglose de objetos de BrightScript. Asegúrese de que el control por apps móviles (acceso a la red) esté habilitado y que el canal en primer plano exponga las cantidades de objetos.',

  // ── Device metrics: launch + paused nav ───────────────────────────────────
  launchingProgress: 'Iniciando…',
  launchFailed: 'Error al iniciar',
  pausedSideloadFull: 'Rendimiento del dispositivo en pausa — haga sideload de la Dev App para reanudar',
  pausedSideloadShort: 'Haga sideload para reanudar',
  pausedLaunchFull: 'Rendimiento del dispositivo en pausa — inicie la Dev App para reanudar',
  pausedLaunchShort: 'Inicie para reanudar',
  pausedUnknownFull: 'Rendimiento del dispositivo en pausa — traiga la Dev App al primer plano para reanudar.',
  pausedUnknownShort: 'Rendimiento del dispositivo en pausa',
  bringDevAppToForegroundTitle:
    'Traiga la Dev App al primer plano en el dispositivo para habilitar el rendimiento del dispositivo.',
  showDevicePerfAutoOnToast:
    'Se activó “Mostrar rendimiento del dispositivo” para que un Action Script pudiera capturar gráficos.',

  // ── Native dialogs + IPC results (main: dev-app-handlers.ts) ──────────────
  selectRokuChannelPackageTitle: 'Seleccionar paquete de canal de Roku',
  rokuChannelPackageFilter: 'Paquete de canal de Roku',
  saveScreenshotDialogTitle: 'Guardar captura de pantalla',
  imagesFilter: 'Imágenes',
  screenshotCapturedToast: '¡Captura de pantalla tomada!',
  sideloadWrongTypeError: 'Seleccione un paquete de canal de Roku .zip o .pkg',
  failedToSaveScreenshot: (detail: string): string => `Error al guardar la captura de pantalla: ${detail}`,
};
