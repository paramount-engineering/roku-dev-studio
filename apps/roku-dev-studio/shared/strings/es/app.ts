/**
 * Latin American Spanish (neutral) translation of the main app shell strings.
 * Sibling of ../app.ts — same `app` shape, keys, order, and function signatures.
 *
 * UI strings for the main app shell (renderer/app.ts): device sidebar cards,
 * device tabs, connect/scan flow, remote-location + server-info modals, device
 * hardware-image modal, Apps tab, ECP/Control-by-Mobile-Apps warnings, toasts,
 * and dialogs.
 *
 * Parametrized strings are functions returning the composed text — the standard
 * way to keep interpolation translatable without a runtime format library.
 */
export const app = {
  // Generic display fallbacks
  notAvailable: 'N/D',
  unknown: 'Desconocido',
  unknownError: 'Error desconocido',
  unknownRoku: 'Roku desconocido',
  rokuDevice: 'Dispositivo Roku',
  remote: 'Remoto',

  // Scan button (sidebar + title bar)
  scan: 'Escanear',

  // Remote locations — sidebar section
  statusOffline: 'Sin conexión',
  connecting: 'Conectando...',
  serverInfoTitle: 'Información del servidor',
  deviceCount: (n: number): string => `${n} dispositivo${n !== 1 ? 's' : ''}`,
  scanningForDevices: 'Buscando dispositivos...',
  connectingToRelayServer: 'Conectando al servidor relay...',
  serverOffline: 'Servidor sin conexión',
  noRokuDevicesFound: 'No se encontraron dispositivos Roku',
  confirmRemoveLocation: (name: string): string => `¿Quitar la ubicación "${name}"?`,

  // Add-location flow (errors surfaced via alert)
  locationHostExists: (host: string, name: string): string =>
    `Ya existe una ubicación con el host "${host}" ("${name}").`,
  locationServerExists: (name: string): string =>
    `Ya existe una ubicación con esta dirección de servidor ("${name}").`,
  unableToConnectRelay:
    'No se pudo conectar al servidor relay. Verifique la dirección y asegúrese de que el servidor esté en ejecución.',
  failedToConnectRelay: 'Error al conectar al servidor relay',
  addLocation: 'Agregar ubicación',

  // Server capabilities modal
  serverCapabilities: {
    remote: { label: 'Control remoto', desc: 'Comandos de pulsación de teclas y navegación' },
    apps: { label: 'Apps', desc: 'Listar e iniciar apps instaladas' },
    query: { label: 'Consulta', desc: 'Información del dispositivo, estado del reproductor' },
    devApp: { label: 'Dev App', desc: 'Sideload de canales de desarrollo' },
    screenshot: { label: 'Captura de pantalla', desc: 'Capturar la pantalla del dispositivo' },
    console: { label: 'Consola', desc: 'Salida de depuración de BrightScript' },
    debugger: { label: 'Depurador', desc: 'Puntos de interrupción, ejecución paso a paso, inspección de variables' },
    appConnector: { label: 'App Connector', desc: 'Integración de RALE TrackerTask' },
    deepLink: { label: 'Deep-Link', desc: 'Iniciar contenido con parámetros' },
    networkInspector: { label: 'Inspector de red', desc: 'Capturar DNS/SNI/HTTP + proxy MITM' }
  },
  capSupported: 'Compatible',
  capNeedsRoot: 'Requiere root',
  capNotSupported: 'No compatible',
  capabilitiesHeading: 'Capacidades',

  // Device cards + tabs
  devBadge: 'Dev',
  remoteOff: 'Remoto desactivado',
  ecpBadgeDisabledTitle: 'Control by Mobile Apps está desactivado',
  ecpLimited: 'ECP limitado',
  ecpBadgeLimitedTitle: 'ECP limitado: el texto, el inicio de apps y las consultas funcionan; la pulsación completa de teclas quizás no',
  deviceTypeTv: 'TV',
  deviceTypeStb: 'STB',
  labelType: 'Tipo',
  labelIp: 'IP',
  labelModel: 'Modelo',
  labelSerial: 'Serie',
  labelSw: 'SW',
  expand: 'Expandir',
  minimize: 'Minimizar',
  reconnect: 'Reconectar',
  atLocation: (value: string, location: string): string => `${value} @ ${location}`,

  // Device context menu
  copyDeviceName: 'Copiar nombre del dispositivo',
  copyIpAddress: 'Copiar dirección IP',
  copyModelNumber: 'Copiar número de modelo',
  copySerialNumber: 'Copiar número de serie',
  copyAllDetails: 'Copiar todos los detalles',
  deviceDetails: (d: {
    deviceName?: string;
    ip?: string;
    modelName?: string;
    modelNumber?: string;
    serialNumber?: string;
    softwareVersion?: string;
    deviceId?: string;
    networkType?: string;
    wifiMac?: string;
  }): string =>
    `Nombre del dispositivo: ${d.deviceName}
Dirección IP: ${d.ip}
Nombre del modelo: ${d.modelName}
Número de modelo: ${d.modelNumber}
Número de serie: ${d.serialNumber}
Versión de software: ${d.softwareVersion || 'N/D'}
ID del dispositivo: ${d.deviceId || 'N/D'}
Tipo de red: ${d.networkType || 'N/D'}
MAC de WiFi: ${d.wifiMac || 'N/D'}`,

  // Offline / connection state
  deviceOffline: 'Dispositivo sin conexión',
  unableToConnectDevice: 'No se pudo conectar a este dispositivo Roku.',
  retryConnection: 'Reintentar conexión',

  // Device hardware-image modal
  labelScreenSize: 'Tamaño de pantalla',
  labelOsVersionBuild: 'Versión y compilación del SO',
  checkForUpdates: 'Buscar actualizaciones',
  restartDevice: 'Reiniciar dispositivo',
  checkForUpdatesLabel: 'Buscar actualizaciones',
  restartDeviceLabel: 'Reiniciar dispositivo',
  deviceImageAria: (name: string): string => `${name} — imagen del dispositivo`,
  viewLargerImage: (name: string): string => `Ver imagen más grande: ${name}`,
  deviceIpUnavailable: 'La IP del dispositivo no está disponible.',
  setDevPasswordFirst: 'Primero establezca la contraseña de desarrollador de este dispositivo (pestaña Dev App).',
  actionSucceeded: (label: string): string => `${label} se completó correctamente.`,
  actionFailed: (label: string): string => `${label} falló.`,
  actionFailedWith: (label: string, err: string): string => `${label} falló: ${err}`,

  // Apps tab
  installedApps: 'Apps instaladas',
  installedAppsAndTvInputs: 'Apps instaladas y entradas de TV',
  rawListOfApps: 'Lista sin procesar de apps',
  appsAndInputsList: 'Lista de apps y entradas',
  appTileTitle: (name: string, id: string): string => `${name}\nID: ${id}\nHaga clic para iniciar`,
  switchToInput: (name: string): string => `Cambiar a ${name}`,
  failedToLoadApps: 'Error al cargar las apps:',
  errorPrefix: 'Error:',
  installedAppsHeader: 'APPS INSTALADAS',
  inputsHeader: 'ENTRADAS',
  copied: '¡Copiado!',
  copyList: 'Copiar lista',

  // Auto-connect toasts
  connectedAutomatically: (label: string): string => `Se conectó a ${label} automáticamente.`,
  connectedMultipleAutomatically: (count: number): string =>
    `Se conectó a ${count} dispositivos guardados automáticamente.`,

  // Manual connect
  couldNotConnectToIp: (ip: string): string =>
    `No se pudo conectar a ${ip}. Asegúrese de que el dispositivo Roku esté encendido y accesible.`,
  connectionError: (err: string): string => `Error de conexión: ${err}`,

  // Custom title bar
  windowControlsUnavailable: 'Los controles de la ventana no están disponibles. Cierre y reinicie Roku Dev Studio.',
  restoreDown: 'Restaurar',
  maximize: 'Maximizar',

  // Log file
  couldNotOpenLogFile: (err: string): string => `No se pudo abrir el archivo de registro: ${err}`,

  // File drag & drop onto the main window
  fileDropOverlayReadyOne: (viewerLabel: string): string => `Suelta para abrir en ${viewerLabel}`,
  fileDropOverlayReadyMany: 'Suelta para abrir',
  fileDropOverlayUnsupported: 'Tipo de archivo no compatible',
  fileDropOverlayGeneric: 'Suelta archivos para abrir',
  fileDropLogViewerLabel: 'Visor de registros',
  fileDropNetworkSessionViewerLabel: 'Visor de Sesión de Red',
  fileDropOpenedOne: (name: string, viewerLabel: string): string => `Se abrió "${name}" en ${viewerLabel}`,
  fileDropOpenedMany: (count: number): string => `Se abrieron ${count} archivos`,
  fileDropOpenedWithSkipped: (openedCount: number, unsupportedCount: number): string =>
    `Se ${openedCount === 1 ? 'abrió' : 'abrieron'} ${openedCount} archivo${openedCount === 1 ? '' : 's'}, se omitieron ${unsupportedCount} no compatibles`,
  fileDropUnsupportedOne: (name: string): string => `"${name}" no es un tipo de archivo compatible`,
  fileDropUnsupportedMany: (count: number): string => `${count} archivos no compatibles — no se abrió nada`,
  fileDropFailed: 'No se pudo abrir el o los archivo(s) soltado(s)',

  // Help modal
  searchHelpGuide: 'Buscar en ayuda y guía',

  // ECP / Control by Mobile Apps warnings
  ecpWarnDisabledTitle: 'Control by Mobile Apps desactivado',
  ecpWarnDisabledDesc:
    'El control remoto está desactivado. Habilite "Control by Mobile Apps" → Network Access en su dispositivo Roku para usar el control remoto, las apps y la entrada de texto.',
  ecpWarnLimitedTitle: 'Control by Mobile Apps: limitado',
  ecpWarnLimitedDesc:
    'La entrada de texto, el inicio de apps y las consultas de apps funcionan. La pulsación completa de teclas del control remoto quizás no esté disponible; configure Network Access en <strong>Permissive</strong> o <strong>Enabled</strong> para el control remoto completo.',
  ecpWarnSubnetTitle: 'Permissive: revise la red',
  ecpWarnSubnetDesc:
    'El modo Permissive solo acepta comandos de la misma subred. Su equipo podría estar en una subred diferente; si los comandos fallan, revise su red.',

  // App Connector / TrackerTask
  trackerTaskSaved: '¡TrackerTask.xml se guardó correctamente!',
  failedToSaveTrackerTask: 'Error al guardar TrackerTask.xml:',
  errorSavingTrackerTask: 'Error al guardar TrackerTask:',
  integrationInfoCopied: '¡Información de integración copiada al portapapeles!',
  failedToCopyClipboard: 'Error al copiar al portapapeles',

  // App init
  appInitFailed: 'Error al inicializar la app:',

  // ───────────────────────────────────────────────────────────────────────
  // Static index.html markup (filled by applyI18n). Inline English is kept as
  // the fallback; these mirror it (with ui-text-casing applied to labels).
  // ───────────────────────────────────────────────────────────────────────

  // Title bar
  titleBarToggleSidebar: 'Alternar barra lateral',
  titleBarScanTitle: 'Buscar dispositivos locales y remotos',
  titleBarScanAria: 'Buscar dispositivos',
  titleBarHelpTitle: 'Ayuda y guía del usuario',
  titleBarHelpAria: 'Ayuda y guía',
  helpAndGuide: 'Ayuda y guía',
  floatingRemoteToggleTitle: 'Alternar un control remoto flotante que lo sigue fuera de las pestañas Remoto y Dev App',
  floatingRemoteToggleAria: 'Alternar control remoto flotante',
  floatingRemote: 'Control remoto flotante',
  tryDemoAppTitle: 'Probar el canal de demostración incluido de Roku Dev Studio Showcase',
  tryDemoAppAria: 'Probar App de Demostración',
  tryDemoApp: 'Probar App de Demostración',
  appMenu: 'Menú de la app',
  zoomOut: 'Alejar',
  zoomIn: 'Acercar',
  resetZoom: 'Restablecer zoom al 100%',
  currentZoomAria: 'Zoom actual; haga clic para restablecer al 100%',

  // Sidebar — device discovery
  sidebarLocal: 'Local',
  manualConnect: 'Conexión manual',
  addRemoteLocation: 'Agregar ubicación remota',
  viewLogsTitle: 'Ver registros de depuración (Desktop/roku-connector-debug.log)',
  viewLogs: 'Ver registros',

  // Welcome panel
  welcomeSubtitle:
    'Descubra dispositivos Roku localmente o mediante relays remotos, haga sideload y deep-link de canales, depure BrightScript en vivo con una consola Telnet en streaming, automatice flujos de prueba de extremo a extremo e integre agentes de IA en su ciclo de desarrollo mediante MCP.',
  featureDeviceDiscovery: 'Descubrimiento de dispositivos',
  featureDeviceDiscoveryDesc: 'Descubra automáticamente dispositivos Roku en su red local mediante SSDP.',
  featureAppsDeepLinking: 'Apps y Deep-Linking',
  featureAppsDeepLinkingDesc: 'Explore, inicie apps y use Deep-Links con parámetros personalizados.',
  featureDevAppDesc: 'Haga sideload de canales de desarrollo y tome capturas de pantalla de Dev App automáticamente.',
  featureAppConnectorDesc: 'Ejecute funciones de BrightScript en una app cargada mediante sideload.',
  featureFiddle: 'Fiddle',
  featureFiddleDesc: 'Ejecute fragmentos de BrightScript en el dispositivo con un editor Monaco.',
  featureMcpServer: 'Servidor MCP',
  featureMcpServerDesc: 'Exponga Roku Dev Studio a agentes de IA usando el servidor MCP.',
  featureDeviceRemote: 'Control remoto del dispositivo',
  featureDeviceRemoteDesc: 'D-pad completo, controles multimedia y entrada de texto — como un control remoto real.',
  featureQueryDesc: 'Consulte información del dispositivo, estado del reproductor multimedia y registro mediante ECP.',
  featureConsoleDesc: 'Vea la salida de depuración de BrightScript mediante Telnet, filtre, busque y depure',
  featureActionScriptsDesc: 'Encadene pulsaciones de teclas, inicios y llamadas RALE en flujos automatizados.',
  featureNetworkInspectorDesc: 'Inspeccione el tráfico HTTP/HTTPS de Dev App mediante un proxy MITM.',
  featureRemoteLocations: 'Ubicaciones remotas',
  featureRemoteLocationsDesc: 'Conéctese a dispositivos Roku en cualquier lugar mediante servidores relay.',

  // Device-panel tabs
  tabRemote: 'Remoto',
  tabApps: 'Apps',
  tabQuery: 'Consulta',
  tabDevApp: 'Dev App',
  tabConsole: 'Consola',
  tabAppConnector: 'App Connector',
  tabActionScripts: 'Scripts de acción',
  tabNetwork: 'Red',

  // Device panel — performance strip & paused nav
  perfCpu: 'CPU',
  perfMem: 'Mem',
  perfObj: 'Obj',
  devicePerfPaused: 'Rendimiento del dispositivo en pausa — traiga Dev App al primer plano para reanudar.',
  devicePerfPausedShort: 'Rendimiento del dispositivo en pausa',
  launch: 'Iniciar',
  sideloadDevApp: 'Sideload de Dev App',
  sideload: 'Sideload',

  // Shared warnings (Developer Mode / Control by Mobile Apps)
  developerModeNotEnabled: 'Modo de desarrollador no habilitado',
  ecpNotEnabledTitle: 'Control by Mobile Apps no habilitado',
  howToEnable: 'Cómo habilitar',
  devAppDevModeDesc: 'El sideload de Dev App requiere que el Modo de desarrollador esté habilitado en su dispositivo Roku.',
  queryDevModeDesc: 'Algunas funciones de consulta pueden estar limitadas. Habilite el Modo de desarrollador para acceso completo.',
  inspectorDevModeDesc: 'App Connector requiere el Modo de desarrollador y un canal con sideload que tenga TrackerTask.',

  // Remote Section
  keyboardShortcutsRemoteTitle: 'Atajos de teclado para este control remoto',
  keyboardShortcutsQuickRemoteTitle: 'Atajos de teclado para el control remoto rápido',
  keyboardRemoteHelpAria: 'Ayuda de atajos de teclado del control remoto',
  showDevicePerformance: 'Mostrar rendimiento del dispositivo',
  remoteBack: 'Atrás',
  remoteHome: 'Inicio',
  remoteOptions: 'Opciones',
  remoteReplay: 'Repetir',
  remoteVolUp: 'Vol +',
  remoteMute: 'Silenciar',
  remoteVolDown: 'Vol -',
  remotePower: 'Encendido',
  remoteRewind: 'Retroceder',
  remotePlayPause: 'Reproducir/Pausar',
  remoteForward: 'Avanzar',
  sendTextPlaceholder: 'Escriba el texto para enviar a Roku...',
  sendText: 'Enviar texto',
  rokuSecretScreens: 'Pantallas secretas de Roku',
  secretScreensTitle: 'Secuencias de teclas del control remoto para las pantallas secretas y de diagnóstico de Roku',
  sectionRemoteControl: 'Control remoto',
  sectionObjectCounts: 'Conteo de objetos de BrightScript (Dev)',
  cpuUsage: 'Uso de CPU',
  sectionMemoryUsage: 'Uso de memoria',

  // Remote Section — metrics quadrants
  brightScriptObjects: 'Objetos de BrightScript',
  objectMetricsMode: 'Modo de métricas de objetos',
  objectsModeCount: 'Conteo',
  objectsModeMemory: 'Memoria',
  objectsTop10: 'Top 10',
  cpuMetricsMode: 'Modo de métricas de CPU',
  cpuModePercent: 'CPU %',
  cpuModeProcess: 'Proceso',
  systemMemory: 'Memoria del sistema',
  legendTotal: 'Total',
  legendUser: 'Usuario',
  legendKernel: 'Kernel',
  legendUsed: 'Usada',
  legendResident: 'Residente',
  legendAnonymous: 'Anónima',
  legendShared: 'Compartida',
  legendLimit: 'Límite',

  // Apps tab
  deepLink: 'Deep-Link',
  moreLaunchOptions: 'Más opciones de inicio',
  saveAndLaunch: 'Guardar e iniciar',
  deeplinkSaved: 'Guardado',
  selectSavedDeepLink: '-- Seleccionar Deep-Link guardado --',
  deleteSavedDeepLink: 'Eliminar Deep-Link guardado',
  appId: 'ID de app',
  deeplinkAppIdPlaceholder: 'p. ej., 31440',
  contentId: 'ID de contenido',
  contentIdPlaceholder: 'Identificador de contenido',
  mediaType: 'Tipo de medio',
  selectPlaceholder: '-- Seleccionar --',
  mediaTypeMovie: 'Película',
  mediaTypeSeries: 'Serie',
  mediaTypeEpisode: 'Episodio',
  mediaTypeLive: 'En vivo',
  manageMediaTypes: 'Administrar tipos de medios',
  addParameter: 'Agregar parámetro',
  deeplinkParamKeyPlaceholder: 'Clave',
  deeplinkParamValuePlaceholder: 'Valor',
  removeParameter: 'Eliminar parámetro',
  listApps: 'Listar',
  loadingApps: 'Cargando apps...',
  inputsSectionLabel: 'Entradas',
  noAppsFound: 'No se encontraron apps. Haga clic en Actualizar para cargar.',

  // Dev App tab
  auth: 'Autenticación',
  password: 'Contraseña',
  verify: 'Verificar',
  remember: 'Recordar',
  selectPackage: 'Seleccionar paquete',
  install: 'Instalar',
  typeTextShortPlaceholder: 'Escriba el texto...',
  send: 'Enviar',
  autoScreenshot: 'Captura automática',
  screenshot: 'Captura de pantalla',
  copyScreenshot: 'Copiar captura',
  downloadScreenshot: 'Descargar captura',
  clearScreenshot: 'Borrar captura',
  capture: 'Capturar',
  clickCapture: 'Clic para capturar',

  // Query tab
  deviceQueries: 'Consultas del dispositivo',
  queryDeviceInfo: 'Device Info',
  queryAllApps: 'All Apps',
  queryActiveApp: 'Active App',
  queryMediaPlayer: 'Media Player',
  queryPlugins: 'Plugins',
  queryMemory: 'Memory',
  developerQueries: 'Consultas de desarrollador',
  openFiddle: 'Abrir Fiddle',
  openFiddleTitle: 'Abrir BrightScript Fiddle con este dispositivo preseleccionado',
  openFiddleAria: 'Abrir BrightScript Fiddle para este dispositivo',
  qsSceneGraph: 'SceneGraph',
  qsSgRendezvous: 'SG Rendezvous',
  qsFwBeacons: 'FW Beacons',
  qsPerformance: 'Rendimiento',
  qsOther: 'Otros',
  qsCustom: 'Personalizado',
  queryAllNodes: 'All Nodes',
  queryRootNodes: 'Root Nodes',
  track: 'Track',
  events: 'Events',
  untrack: 'Untrack',
  queryFrameRate: 'Frame Rate',
  queryChannelPerf: 'Channel Perf',
  queryAppState: 'App State',
  queryRegistry: 'Registry',
  queryObjectCounts: 'Object Counts',
  run: 'Ejecutar',
  customQueryPlaceholder: 'p. ej. /query/device-info',
  results: 'Resultados',
  removePluginPlaceholder: 'ID de app (p. ej., 987654_cf9a)',
  removePlugin: 'Quitar plugin',

  // Console (Telnet) tab
  telnetConsole: 'Consola Telnet',
  copyAllLogs: 'Copiar todos los registros',
  saveLogsToFile: 'Guardar registros en archivo',
  clearConsole: 'Borrar consola',
  clearOptions: 'Opciones de borrado',
  clearRelayOnly: 'Borrar (solo en el servidor relay)',
  clearLocalAndRelay: 'Borrar (local y en el servidor relay)',
  findResizeTitle: 'Arrastre para ampliar la búsqueda (doble clic para restablecer)',
  consoleMonitor: 'Monitor de consola',
  telnetPortBadge: 'Puerto 8085',
  connectPullRelayTitle: 'Conectar y extraer el búfer del relay',
  connectOptions: 'Opciones de conexión',
  connectLiveOnly: 'Conectar (omitir el búfer de registros existente)',
  telnetPlaceholder: 'Conéctese para ver la salida de depuración de BrightScript',
  jumpToLatestLogs: 'Ir a los registros más recientes',

  // App Connector tab
  connection: 'Conexión',
  port: 'Puerto',
  logVerbosity: 'Verbosidad del registro',
  logVerbosityTitle: 'Nivel del registrador RALE aplicado al conectar',
  verbosityOff: 'Desactivado',
  verbosityError: 'Error',
  verbosityWarning: 'Advertencia',
  verbosityInfo: 'Info',
  verbosityDebug: 'Depuración',
  integrationGuide: 'Guía de integración',
  integrationGuideTitle: 'Cómo integrar TrackerTask con App Connector',
  executeFunction: 'Ejecutar función',
  functionLabel: 'Función',
  connectToLoadFunctions: '-- Conéctese para cargar funciones --',
  execute: 'Ejecutar',
  parameters: 'Parámetros',
  selectFunctionParams: 'Seleccione una función para ver los parámetros',
  response: 'Respuesta',
  updateNode: 'Actualizar nodo',
  updateNodeBtnTitle: 'Después de Get Node by ID: selectNode, luego setField, removeField o Agregar campo mediante setField',
  action: 'Acción',
  fieldAction: 'Acción de campo',
  updateField: 'Actualizar campo',
  addField: 'Agregar campo',
  removeField: 'Quitar campo',
  field: 'Campo',
  fieldName: 'Nombre del campo',
  fieldNamePlaceholder: 'p. ej. text, visible, width',
  fieldType: 'Tipo de campo',
  typeString: 'String',
  typeInteger: 'Integer',
  typeFloat: 'Float',
  typeBoolean: 'Boolean',
  typeColor: 'Color',
  typeArray: 'Array',
  typeAssocArray: 'AssocArray',
  value: 'Valor',
  fieldValuePlaceholder: 'Escalares, true/false, JSON para Arrays / Vectors / Objects',

  // Action Scripts tab
  builder: 'Constructor',
  executor: 'Ejecutor',
  copyToExecutor: 'Copiar al Ejecutor',
  copyActionScript: 'Copiar script de acción',
  saveActionScript: 'Guardar script de acción',
  saveToDirectory: 'Guardar en carpeta…',
  moreSaveOptions: 'Más opciones de guardado',
  addActionToEnable: 'Agregue al menos una acción para habilitar',
  connectToConsole: 'Conectar a la consola',
  editInBuilder: 'Editar en el Constructor',
  editInBuilderTitle: 'Abrir el script actual en la pestaña Constructor',
  importActionScript: 'Importar script de acción',
  importActionScriptTitle: 'Importar o actualizar el script de acción',
  actions: 'Acciones',
  builderImportTitle: 'Importar script desde un archivo o pegar JSON',
  undoTitle: 'Deshacer (Ctrl+Z)',
  redoTitle: 'Rehacer (Ctrl+Shift+Z)',
  clearAllActions: 'Borrar todas las acciones',
  helpForActionType: 'Ayuda para este tipo de acción',
  closeAddStep: 'Cerrar Agregar paso',
  actionType: 'Tipo de acción',
  addAction: 'Agregar acción',
  dragToResize: 'Arrastre para redimensionar',
  resizePanels: 'Redimensionar paneles',
  json: 'JSON',
  uploadJson: 'Subir JSON',
  orPasteBelow: 'O pegue abajo',
  validate: 'Validar',
  devPasswordRequired: 'Algunas acciones requieren la contraseña de desarrollador (captura de pantalla, sideload):',
  enterDevPassword: 'Ingrese la contraseña de desarrollador',
  clearActions: 'Borrar acciones',
  runActionScript: 'Ejecutar script de acción',
  stopExecution: 'Detener ejecución',
  copyResultsToClipboard: 'Copiar resultados al portapapeles',
  saveResultsAsPdf: 'Guardar resultados como PDF',
  clearResultsTitle: 'Borrar resultados y liberar memoria (no habrá nada que guardar hasta la próxima ejecución)',

  // Network Inspector tab
  networkInspector: 'Inspector de red',
  niFindTitle: 'Buscar en el tráfico — URL, cargas útiles, encabezados, cuerpos de respuesta (⌘/Ctrl+F)',
  niFindAria: 'Buscar en el tráfico',
  niFindPrevTitle: 'Coincidencia anterior (Shift+↑)',
  niFindPrev: 'Coincidencia anterior',
  niFindNextTitle: 'Coincidencia siguiente (Shift+↓)',
  niFindNext: 'Coincidencia siguiente',
  niFindClear: 'Borrar resultados de búsqueda',
  niDownloadTitle: 'Descargar sesión…',
  niDownloadAria: 'Descargar sesión',
  niExportHar: 'Exportar todo como HAR',
  niExportSession: 'Exportar sesión (.rds-network-inspector.json)',
  niSavePcap: 'Guardar captura de paquetes (.pcap)',
  niClearTitle: 'Borrar la lista de sesiones',
  niSetupBadgeTitle: 'Se necesita configurar la captura de hotspot — haga clic para ver instrucciones',
  niCaptureSetup: 'Configuración de captura',
  niPortBadgeTitle: 'Puerto del proxy no disponible — haga clic para ver detalles',
  niProxyPortUnavailable: 'Puerto del proxy no disponible',
  niFilterPlaceholder: 'Filtrar tráfico…',
  niFilterTitle: 'Filtrar tráfico — haga clic en el icono de información para ver la sintaxis compatible.',
  niClearFilter: 'Borrar filtro',
  niFilterHelpTitle: 'Ayuda de filtrado y sintaxis compatible',
  niFilterHelpAria: 'Ayuda de filtrado',
  niSessionCountTitle: 'Sesiones capturadas',
  niControls: 'Controles de Inspector de red',
  niToggleDetailLayout: 'Alternar diseño de detalle',
  niConfigureTitle: 'Configurar reglas de tráfico',
  niGroupByHostTitle: 'Agrupar sesiones por nombre de host',
  niGroupByHost: 'Agrupar por host',
  niProxiedTitle:
    'Mostrar solo las solicitudes que pasan por el proxy de RDS (encabezados completos + cuerpo), ocultando los metadatos SNI/DNS de la captura de hotspot',
  niProxied: 'Con proxy',
  niWaitingForTraffic: 'Esperando tráfico…',
  niScrollBottom: 'Desplazarse a las sesiones más recientes',

  // App menu (hamburger)
  developerMode: 'Modo de desarrollador',
  privacyMode: 'Modo de privacidad',
  debugLogging: 'Registro de depuración',
  openDiagnosticLogsFolder: 'Abrir la carpeta de registros de diagnóstico',
  openLogFile: 'Abrir el archivo de registro',
  settings: 'Configuración',
  clearCacheAndReload: 'Borrar caché y recargar',
  zoom: 'Zoom',
  aboutRokuDevStudio: 'Acerca de Roku Dev Studio',
  quitRokuDevStudio: 'Salir de Roku Dev Studio',

  // ───────────────────────────────────────────────────────────────────────
  // index.html localization pass — cloned-template defaults, empty-states,
  // attribute-only strings, and multi-element prose (data-i18n-html) blocks
  // that the earlier migration left inline.
  // ───────────────────────────────────────────────────────────────────────

  // Sidebar — local devices empty state (prose with <br>/<strong>)
  noDevicesFoundHtml: 'No se encontraron dispositivos.<br>Haga clic en <strong>Escanear</strong> para descubrir dispositivos Roku.',

  // Device panel header (cloned-template defaults, replaced by JS at runtime)
  deviceNamePlaceholder: 'Nombre del dispositivo',
  perfStripPausedPlaceholder: 'En pausa — inicie la Dev App para reanudar',

  // ECP / Control by Mobile Apps warning descriptions (prose with <strong>)
  ecpRemoteWarningDescHtml:
    'El control remoto (pulsación de teclas, apps, etc.) requiere que "Control by Mobile Apps" → Network Access esté configurado en <strong>Enabled</strong> en su dispositivo Roku.',
  ecpDevAppWarningDescHtml:
    'El control remoto rápido y las funciones de pulsación de teclas requieren que "Control by Mobile Apps" → Network Access esté <strong>Enabled</strong> en su dispositivo Roku.',

  // Dev App tab — sideloaded-app default + screenshot image alt text
  noChannelSideloaded: 'No hay ningún canal cargado con sideload',
  screenshotAlt: 'Captura de pantalla de Roku',

  // App Connector — Update Node modal intro (prose with <strong>/<code>) + response empty-state
  updateNodeModalIntroHtml:
    'Usa la <strong>ruta</strong> de su último Get Node by ID exitoso. Acciones: <code>removeField</code>, <code>setField</code> (agregar / actualizar).',
  responseWillAppearHere: 'La respuesta aparecerá aquí...',

  // Action Scripts — Executor nudge + password-prompt hint (prose with <strong>/<code>)
  executorBuilderNudgeHtml:
    'Use la pestaña <strong>Constructor</strong> para agregar y editar pasos con campos guiados. Use esta área para validar, importar o ejecutar JSON.',
  executorPasswordPromptHintHtml:
    'Ingrésela aquí y ejecute de nuevo, o agregue <code>"devPassword": "..."</code> al JSON de su script.'
};
