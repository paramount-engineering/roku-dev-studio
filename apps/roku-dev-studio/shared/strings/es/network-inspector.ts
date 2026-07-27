/**
 * Latin American Spanish (neutral) translation of the Network Inspector strings —
 * the live capture tab, its modals (traffic rules, find-in-content, hotspot setup,
 * port conflict, large-body info, filter help), and the detail renderers shared with
 * the standalone Session Viewer. Sibling of ../network-inspector.ts — same
 * `networkInspector` shape, keys, order, and function signatures.
 *
 * Some values intentionally embed HTML markup (<strong>, <code>, <kbd>, <em>) because
 * they're injected via innerHTML. Only literal display text is translated; product /
 * feature names, tech tokens, code literals, and placeholders are kept verbatim.
 */
export const networkInspector = {
  // Section identity (used as a title prefix for the shared URL / structured viewers).
  titlePrefix: 'Inspector de red',

  // ── Shared detail pane chrome (network-detail-view.ts) ──────────────────────────────
  emptyDetail: 'Seleccione una sesión para inspeccionar la solicitud y la respuesta.',
  request: 'Solicitud',
  response: 'Respuesta',
  tabOverview: 'Resumen',
  tabBody: 'Cuerpo',
  tabHeaders: 'Encabezados',
  copyRequestBody: 'Copiar el cuerpo de la solicitud',
  copyResponseBody: 'Copiar el cuerpo de la respuesta',
  moreCopyOptions: 'Más opciones de copiado',
  copyBody: 'Copiar cuerpo',
  copyAsCurl: 'Copiar como cURL',
  copyAsHar: 'Copiar como HAR',
  bodyTruncated: 'Cuerpo truncado',
  bodyTruncatedRequestTitle:
    'La copia capturada de este cuerpo superó el límite de visualización del inspector, por lo que lo que se muestra aquí está incompleto. El cuerpo completo se entregó de todos modos al servidor de destino. Use Copiar para obtener la porción capturada.',
  bodyTruncatedResponseTitle:
    'La copia capturada de este cuerpo superó el límite de visualización del inspector, por lo que lo que se muestra aquí está incompleto. El cuerpo completo se entregó de todos modos al Roku. Use Copiar para obtener la porción capturada.',
  disableWordWrap: 'Desactivar el ajuste de línea',
  enableWordWrap: 'Activar el ajuste de línea',
  toggleWordWrap: 'Alternar el ajuste de línea',
  formatLabel: 'Formato',
  formatAuto: 'Auto',
  formatJson: 'JSON',
  formatXml: 'XML',
  formatRaw: 'Sin formato',
  whyRawText: '¿Por qué se muestra esto como texto sin formato?',

  // ── Session list rows (network-session-view.ts) ─────────────────────────────────────
  noMatchingSessions: 'No hay sesiones que coincidan.',
  noHostsYet: 'Aún no hay hosts. La vista Estructura agrupa el tráfico por nombre de host.',
  sslDecryptedTitle: 'Descifrado (MITM)',
  sslEncryptedTitle: 'HTTPS (cifrado)',
  sessionNumber: (n: number): string => `Sesión n.º ${n}`,
  requestNumber: (n: number): string => `Solicitud n.º ${n}`,
  expandAllGroups: 'Expandir todos los grupos',
  collapseAllGroups: 'Contraer todos los grupos',

  // ── Session-list derived tokens (network-sessions.ts) ───────────────────────────────
  // Duration column value while a transaction is still open (distinct from statusPending
  // below — has a trailing ellipsis and is the duration cell, not the status pill).
  durationPending: 'Pendiente…',
  // Status-pill tokens for the session list. Kept SEPARATE from the overview statusPending:
  // statusClass()/the status filter compare against session.status, so these must stay
  // byte-identical to the values eventToSession() assigns.
  listStatusPending: 'Pending',
  listStatusQuery: 'Query',
  listStatusOk: 'OK',
  listStatusOpen: 'Open',
  // DNS structure-tree leaf / sidebar path labels.
  dnsQueryLabel: 'Consulta DNS',
  dnsResponseLabel: 'Respuesta DNS',

  // ── Detail renderers (network-detail.ts) ────────────────────────────────────────────
  // Synthetic first-row header of the response Headers table (HTTP/RFC start-line term).
  statusLine: 'Status-Line',
  noHeaders: '(sin encabezados)',
  noRequestBody: '(sin cuerpo de solicitud)',
  noResponseBody: '(sin cuerpo de respuesta)',
  emptyResponseBody: '(cuerpo de respuesta vacío)',
  waitingForResponse: '(esperando la respuesta…)',
  encryptedNoHeaders: '(cifrado — sin encabezados)',
  dnsNoHeaders: '(DNS — sin encabezados HTTP)',
  dnsAnswerEmpty: '(vacío)',
  dnsPending: '(pendiente)',
  noResponseBodyCaptured: '(no se capturó el cuerpo de respuesta)',
  httpsResponseEncrypted: 'El cuerpo de respuesta HTTPS está cifrado. Habilite el proxy MITM para inspeccionar los cuerpos aquí.',
  // Media-preview fallbacks + captions.
  mimeContent: 'contenido',
  mimeBinary: 'binario',
  mimeUnknownType: 'tipo desconocido',
  responseImageAlt: 'Vista previa de la imagen de respuesta',
  binaryTruncatedNote: (mime: string): string =>
    `El ${mime} binario se truncó durante la captura — vista previa no disponible. Use Copiar para obtener el base64 capturado.`,
  binaryNotPreviewable: (mime: string, size: string): string =>
    `Contenido binario (${mime}, ~${size}) — sin vista previa. Use Copiar para obtener el base64 capturado.`,
  // Overview: request Status row values (display-only; distinct from the session-list status tokens).
  statusPending: 'Pendiente',
  statusComplete: 'Completo',
  statusFailed: 'Fallido',
  // Overview: row + section labels.
  ovType: 'Tipo',
  ovTime: 'Hora',
  ovDevice: 'Dispositivo',
  ovHost: 'Host',
  ovDestination: 'Destino',
  ovUrl: 'URL',
  ovStatus: 'Estado',
  ovResponseCode: 'Código de respuesta',
  ovProtocol: 'Protocolo',
  ovMethod: 'Método',
  requestContentType: 'Content-Type de la solicitud',
  responseContentType: 'Content-Type de la respuesta',
  ovClientAddress: 'Dirección del cliente',
  ovRemoteAddress: 'Dirección remota',
  ovTags: 'Etiquetas',
  ovDns: 'DNS',
  ovNotes: 'Notas',
  ovRequestStart: 'Inicio de la solicitud',
  ovTotal: 'Total',
  secTls: 'TLS',
  secTiming: 'Tiempos',
  secSize: 'Tamaño',
  viewUrlTitle: 'Ver URL y parámetros de consulta',
  tagsMitmDecrypted: 'MITM · Descifrado',
  protocolHttpsDecrypted: 'HTTPS (descifrado mediante el proxy MITM de Roku Dev Studio)',
  protocolHttpsEncrypted: 'HTTPS (cifrado)',
  notesProxied: 'Solicitud a través del proxy — TLS upstream terminado en Roku Dev Studio',
  notesHotspot: 'Captura por hotspot — cuerpos no disponibles sin MITM',
  typeHttpsTlsHandshake: 'HTTPS (negociación TLS)',
  unknownHost: 'host-desconocido',
  dnsQueryValue: (host: string): string => `Consulta ${host}`,
  dnsBody: (isQuery: boolean, host: string): string => `DNS ${isQuery ? 'Consulta' : 'Respuesta'}: ${host}`,
  httpsRequestFallback: (host: string, port: string): string =>
    `CONNECT ${host}${port} (HTTPS — cifrado)\n\nLa captura por hotspot solo ve la negociación TLS (SNI + IP), no los cuerpos JSON.\n\nHabilite MITM en Configuración y enrute el canal a través de Roku Dev Studio para inspeccionar los cuerpos.`,

  // ── Embedded JSON/XML fragment highlight (network-embedded-structured.ts) ────────────
  embeddedViewTitle: (label: string): string => `Haga clic para ver ${label} con formato (se abre en un modal)`,

  // ── Hotspot Capture Setup modal (hotspot-setup-modal.ts) ─────────────────────────────
  setupPacketCapture: 'Configurar la captura de paquetes',
  requestingCaptureAccess: 'Solicitando acceso de captura…',
  captureAccessGranted: 'Acceso de captura concedido.',
  setupCancelled: 'Se canceló la configuración.',
  setupFailed: 'La configuración falló.',
  setupFailedRetry: 'La configuración falló — inténtelo de nuevo.',

  // ── Filter-syntax help modal (network-filter-help.ts) ────────────────────────────────
  filterHelpHeading: 'Filtrado de sesiones',
  filterHelpAria: 'Ayuda de filtrado',
  addToFilter: 'Agregar al filtro',
  filterDescHost: 'Coincide con el nombre de host (subcadena).',
  filterDescMethod: 'Método HTTP.',
  filterDescStatus: 'Código de estado, o una clase como 4xx / 5xx.',
  filterDescType: 'Content-Type de la respuesta (alias content-type:).',
  filterDescKind: 'Tipo de sesión.',
  filterDescPath: 'Ruta de la URL (subcadena; alias url:).',
  filterHelpIntro:
    'Escriba texto libre para coincidir con host, ruta, método, estado, tipo o Content-Type. Use <code>field:value</code> para coincidencias precisas, y separe los términos con <strong>comas</strong> para coincidir con <strong>cualquiera</strong> de ellos (OR).',
  filterHelpNoteLead: 'Ejemplo: ',
  filterHelpNoteExplain:
    ' muestra cualquier sesión en roku.com <em>o</em> con estado 4xx <em>o</em> que use POST. Haga clic en cualquier ejemplo para agregarlo.',

  // ── Port-conflict modal (port-conflict-modal.ts) ─────────────────────────────────────
  holderAnotherApp: 'Otra aplicación',
  holderWithPid: (name: string, pid: number): string => `${name} (PID ${pid})`,
  holderPidOnly: (pid: number): string => `PID ${pid}`,
  portResolvedTitle: 'Puerto del proxy disponible',
  portResolvedMsg:
    'El puerto del proxy está libre de nuevo — Inspector de red puede capturar tráfico. Este mensaje se cierra automáticamente.',
  recheckStatus: 'Volver a verificar el estado',
  openNetworkInspectorSettings: 'Abrir la configuración de Inspector de red',

  // ── Traffic-rules modal (traffic-rules-modal.ts) ─────────────────────────────────────
  trafficRules: 'Reglas de tráfico',
  deviceFallbackName: 'Dispositivo Roku',
  serialTitle: (serial: string): string => `Serie ${serial}`,
  rulesNote:
    'Se aplica solo al tráfico que este dispositivo enruta a través del proxy de Roku Dev Studio — su otro tráfico (sin proxy) no se ve afectado. Los cambios surten efecto de inmediato.',
  deviceTrafficTitle: 'Tráfico del dispositivo',
  blockAllTitle: 'Bloquear todo el tráfico con proxy',
  blockAllDesc: 'Rechazar todas las solicitudes enrutadas a través del proxy.',
  bandwidthLimit: 'Límite de ancho de banda',
  addedLatency: 'Latencia añadida',
  addedLatencyMsTitle: 'Latencia añadida (ms)',
  hostsBlockedNote: 'Las reglas por host no se aplican mientras todo el tráfico con proxy está bloqueado.',
  perHostRules: 'Reglas por host',
  addHostTitle:
    'Host, o host/ruta. Use * como comodín (p. ej. *.example.com coincide con prod + staging, /v1/* coincide con cualquier ruta bajo /v1/).',
  noRulesYet: 'Aún no hay reglas — agregue un host o una ruta arriba para anular su comportamiento.',
  saveChanges: 'Guardar cambios',
  restartToSave: 'Reinicie Roku Dev Studio para habilitar el guardado de las Reglas de tráfico.',
  failedSaveRules: 'Error al guardar las Reglas de tráfico.',
  // Rewrite op type labels (dropdown options).
  rwRedirectHost: 'Redirigir host',
  rwSetPath: 'Establecer ruta',
  rwSetQuery: 'Establecer parámetro de consulta',
  rwRemoveQuery: 'Quitar parámetro de consulta',
  rwSetHeader: 'Establecer encabezado',
  rwRemoveHeader: 'Quitar encabezado',
  rwBodyReplace: 'Reemplazar en el cuerpo',
  rwSetStatus: 'Establecer estado',
  // Rewrite op field placeholders.
  rwHeaderName: 'Nombre del encabezado',
  rwValue: 'Valor',
  rwStatusCode: 'Código de estado (p. ej. 503)',
  rwHostOrHostPort: 'host o host:port',
  rwNewPath: '/new/path',
  rwParamName: 'Nombre del parámetro',
  rwFind: 'Buscar',
  rwReplaceWith: 'Reemplazar con',
  // Rewrite op row chrome.
  rewriteTargetAria: 'Destino de reescritura',
  rewriteTypeAria: 'Tipo de reescritura',
  regexTreatTitle: 'Tratar Buscar como expresión regular',
  regexLabel: 'regex',
  removeRewrite: 'Quitar reescritura',
  rewriteTitle: 'Reescritura',
  rewriteHint: 'Se aplica al reenviar (no con Bloquear / Restablecer / Simular)',
  addRewrite: '+ Agregar reescritura',
  // Per-host rule scope badges.
  scopeWildcardPath: 'Ruta con comodín',
  scopeSinglePath: 'Ruta única',
  scopeWildcardHost: 'Host con comodín',
  scopeAllRequests: 'Todas las solicitudes',
  // Per-host rule controls.
  collapseExpandRule: 'Contraer / expandir regla',
  editUrl: 'Editar URL',
  editInterceptUrlAria: 'Editar la URL de intercepción',
  deleteRule: 'Eliminar regla',
  block: 'Bloquear',
  resetTitle: 'Cortar la conexión (simular una falla de red)',
  mock: 'Simular',
  mockTitle: 'Devolver una respuesta predefinida en lugar de reenviarla al servidor de destino',
  latencyPlaceholder: 'Latencia',
  mockFieldStatus: 'Estado',
  mockFieldContentType: 'Content-Type',
  mockFieldDelay: 'Retraso',
  httpStatusCodeTitle: 'Código de estado HTTP',
  delayTitle: 'Retraso antes de responder (ms)',
  mockBodyPlaceholder: 'Cuerpo de respuesta (p. ej. {&quot;error&quot;:&quot;forced&quot;})',
  // Bandwidth preset/label/placeholder for the "no cap" option (kbps 0). The other presets
  // ('8 Mbps', '512 kbps', …) are units and stay verbatim in BW_OPTIONS. NOTE: parseBandwidth()
  // still matches the lowercased literal 'unlimited', so keep this word round-trippable.
  bandwidthUnlimited: 'Ilimitado',
  bwCustomTitle: 'Elija un ajuste predefinido o escriba un límite personalizado (p. ej. 3 Mbps o 1500 kbps)',
  bwPresetsAria: 'Mostrar ajustes predefinidos de ancho de banda',
  throttleCapSpeed: (limit: string): string => `la velocidad está limitada al Límite del dispositivo (${limit})`,
  throttleFloorLatency: (ms: number): string => `la latencia tiene un mínimo de la Latencia del dispositivo (${ms} ms)`,
  throttleNote: (parts: string[]): string => `Por host, ${parts.join(', y ')}.`,

  // ── Find-in-content modal (network-find-modal.ts) ────────────────────────────────────
  chipUrl: 'URL',
  chipRequest: 'Cuerpo de solicitud',
  chipResponse: 'Cuerpo de respuesta',
  chipHeaders: 'Encabezados',
  chipUrlTitle: 'URL de solicitud, nombre de host y SNI',
  chipRequestTitle: 'Carga útil de solicitud',
  chipResponseTitle: 'Carga útil de respuesta',
  chipHeadersTitle: 'Encabezados de solicitud y respuesta',
  noMatches: 'Sin coincidencias',
  requestCount: (n: number): string => `${n} solicitud${n === 1 ? '' : 'es'}`,
  hitCount: (n: number): string => ` · ${n} coincidencia${n === 1 ? '' : 's'}`,
  setColorAria: (c: string): string => `Establecer color ${c}`,
  customColorTitle: 'Color personalizado…',
  customColorAria: 'Color personalizado',
  hexColorAria: 'Color hexadecimal',
  changeColorTitle: 'Cambiar color',
  changeColorAria: 'Cambiar el color del término',
  findPlaceholder: 'Buscar',
  searchTermAria: 'Término de búsqueda',
  clearText: 'Borrar texto',
  matchCase: 'Coincidir mayúsculas',
  useRegexTitle: 'Usar expresión regular',
  deleteSearchEntry: 'Eliminar entrada de búsqueda',
  regexLikeHint: 'Esto parece una expresión regular.',
  useRegexBtn: 'Usar regex',
  findAriaLabel: 'Buscar en el tráfico de red',
  findTitle: 'Buscar en el tráfico',
  closeEsc: 'Cerrar (Esc)',
  addSearchEntryTitle: 'Agregar otra entrada de búsqueda',
  addSearchEntry: '+ Buscar más…',
  noteColor: 'Cada término recibe un color; una solicitud muestra el color de cada término que coincide.',
  noteWhitespace: 'Se ignoran los espacios en blanco — coinciden tanto los cuerpos minificados como los formateados.',
  noteBinary: 'Los cuerpos binarios (base64) no se buscan.',
  noteEnter: 'Presione <kbd>Enter</kbd> para saltar a la primera coincidencia y cerrar.',
  noteShiftEnter: (max: number): string =>
    `<kbd>Shift</kbd>+<kbd>Enter</kbd> agrega otro término (hasta ${max}).`,
  noteArrows: '<kbd>Shift</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> (o las flechas del encabezado) se desplazan entre coincidencias.',

  // ── Live tab (network-tab.ts) ────────────────────────────────────────────────────────
  capNotice: (shown: number, total: number): string =>
    `Mostrando las últimas ${shown} de ${total} sesiones — use el filtro para acotar los resultados.`,
  loadingData: 'Cargando datos capturados…',
  // Large-body "shown as raw text" explainer modal.
  shownAsRawText: 'Mostrado como texto sin formato',
  thisBody: 'Este cuerpo',
  largeBodyIntro: (sizeLabel: string, limitKb: string): string =>
    `Este cuerpo es <strong>${sizeLabel}</strong> — mayor que el límite de ${limitKb} KB para renderizar un árbol JSON/XML plegable y con resaltado de sintaxis. Para mantener el inspector con buena respuesta, se muestra el cuerpo <strong>completo</strong> como texto sin formato. No se trunca ni se oculta nada.`,
  largeBodyNote:
    'Copiar, Guardar y Buscar siguen operando sobre el cuerpo completo. Los fragmentos JSON/XML incrustados siguen siendo clicables. Seleccione una respuesta más pequeña para ver el árbol con formato.',
  // Empty-state hints.
  noProxiedSessions: 'Aún no hay sesiones con proxy.',
  noSessions: 'Aún no hay sesiones.',
  proxyAddrFallback: 'machine-ip:8888',
  gatewayAddrFallback: 'gateway:8888',
  anotherApp: 'otra aplicación',
  mitmActiveLine: (addr: string): string =>
    `El proxy MITM está activo en <strong>${addr}</strong> — enrute las solicitudes de su canal Dev a través de él para capturarlas.`,
  mitmPortConflictLine: (port: number, who: string): string =>
    `El proxy MITM no puede usar el puerto ${port} — ${who} lo está usando. Haga clic en <strong>Puerto del proxy no disponible</strong> arriba para cerrarlo o cambiar el puerto.`,
  mitmFailedLine: (err: string): string => `El proxy MITM no pudo iniciarse: ${err}.`,
  mitmStarting: 'El proxy MITM se está iniciando — reinicie Roku Dev Studio si esto persiste.',
  enableMitmSettings: 'Habilite el <strong>proxy MITM</strong> en Configuración → Inspector de red.',
  hotspotBlockedMitmLine: (addr: string): string =>
    `La captura por hotspot está bloqueada, pero el proxy MITM en <strong>${addr}</strong> aún puede registrar las solicitudes con proxy. Use <code>host:port</code> solo en BrightScript (p. ej. <code>192.168.2.1:8888</code>), no la IP del dispositivo ni <code>http://</code>.`,
  mitmActiveNoCaptureLine: (addr: string): string =>
    `El proxy MITM está activo en <code class="ni-hint-code">${addr}</code>. Enrute su canal dev a través de él para capturar las solicitudes de red.`,
  mitmDecryptingHint: ' El proxy MITM está descifrando el HTTPS del canal dev enrutado a través de Roku Dev Studio.',
  hotspotEncryptedHint: ' Los cuerpos HTTPS están cifrados en el modo de captura por hotspot — habilite MITM en Configuración para los canales Dev.',
  capturingOnHotspot: 'Capturando en el hotspot. Navegue o reproduzca contenido en el Roku.',
  connectWifiHint:
    'Conecte el Roku a la misma red Wi‑Fi (o al hotspot de su máquina), luego habilite el <strong>proxy MITM</strong> en Configuración → Inspector de red para capturar el HTTPS del canal dev.',
  sessionListAria: 'Lista de sesiones de red. Use las teclas de flecha para navegar.',
  // Layout toggle.
  layoutToggleTitle: (stacked: boolean): string =>
    `Paneles de solicitud y respuesta - ${stacked ? 'Lado a lado' : 'Apilar verticalmente'}`,
  // "Proxied" filter tooltips.
  proxiedLockedTitle:
    'Todo el tráfico pasa por el proxy de Roku Dev Studio en este modo, por lo que esto siempre está activado. Este control se habilitará cuando el dispositivo Roku esté conectado a través del hotspot.',
  proxiedUnlockedTitle:
    'Mostrar solo las solicitudes que pasan por el proxy de Roku Dev Studio (encabezados + cuerpo completos), ocultando los metadatos SNI/DNS de la captura por hotspot',
  // Media context menu + save dialogs.
  copyImage: 'Copiar imagen',
  saveImageAs: 'Guardar imagen como…',
  saveFile: 'Guardar archivo…',
  saveImageDialog: 'Guardar imagen',
  saveFileDialog: 'Guardar archivo',
  // Export toasts + dialogs.
  fileFallback: 'archivo',
  savedPackets: (n: number, path: string): string =>
    `Se guard${n === 1 ? 'ó' : 'aron'} ${n} paquete${n === 1 ? '' : 's'} en ${path}.`,
  failedSavePcap: 'Error al guardar la captura de paquetes.',
  noRequestsToExport: 'No hay solicitudes para exportar.',
  noHttpToExport: 'No hay transacciones HTTP para exportar como HAR.',
  exportHarDialog: 'Exportar sesiones como HAR',
  exportSessionDialog: 'Exportar sesión de red',
  // Native save-dialog titles + filter names (main/ipc/network-inspector-handlers.ts).
  exportDialogTitles: {
    savePcap: 'Guardar captura de paquetes',
    pcapFilter: 'Wireshark PCAP',
    caPem: 'Exportar certificado CA de RDS (PEM)',
    pemFilter: 'Certificado PEM',
    caCrt: 'Exportar certificado CA de RDS (CRT)',
    certFilter: 'Certificado'
  },
  exportedRequests: (n: number, path: string): string =>
    `Se export${n === 1 ? 'ó' : 'aron'} ${n} solicitud${n === 1 ? '' : 'es'} a ${path}.`,
  failedExportSession: 'Error al exportar la sesión.',
  // Session count tooltips.
  countMatchingTitle: (visible: number, captured: number): string =>
    `${visible} coincidentes de ${captured} sesiones capturadas`,
  capturedSessionsTitle: (n: number): string =>
    n === 1 ? '1 sesión capturada' : `${n} sesiones capturadas`,
  // Capture-button "blocked" tooltips.
  issuePortInUse: (port: number, who: string): string =>
    `Inspector de red no disponible — el puerto ${port} está en uso${who}.`,
  issueMitm: (err: string): string => `Problema de Inspector de red — proxy MITM: ${err}`,
  captureErrorFallback: 'Error de Inspector de red',
  stopCapturing: 'Detener captura',
  startCapturing: 'Iniciar captura',
  setupNotAvailable: 'La configuración no está disponible en esta compilación.',
  // Header setup badge.
  captureBlocked: 'Captura bloqueada',
  captureSetup: 'Configuración de captura',
  setupBadgeTitlePrereq: (title: string): string => `${title} — haga clic para ver las instrucciones de configuración`,
  setupBadgeTitle: 'Configuración de captura por hotspot — haga clic para ver las instrucciones',
  // Header port badge.
  portBadgeTitle: (title: string): string => `${title} — haga clic para ver los detalles`,

  // ══ Network Inspector additions ═══════════════════════════════════════════════
  // Copy URL action (network-detail-view.ts copy menu).
  copyUrl: 'Copiar URL',

  // Traffic-rule presets — device-wide toggles (traffic-rules-modal.ts).
  noCachingTitle: 'Sin caché',
  noCachingDesc: 'Elimina los encabezados de caché y fuerza Cache-Control: no-store en las respuestas.',
  blockCookiesTitle: 'Bloquear cookies',
  blockCookiesDesc: 'Elimina Cookie de las solicitudes y Set-Cookie de las respuestas.',

  // Parsed detail viewers — Cookies tabs (network-detail.ts, network-parsed-tables.ts).
  tabCookies: 'Cookies',
  colName: 'Nombre',
  colValue: 'Valor',
  colAttributes: 'Atributos',
  noResponseCookies: 'Esta respuesta no estableció cookies.',

  // Editable per-request note (network-detail.ts Overview + list marker).
  secNote: 'Nota',
  notePlaceholder: 'Agregar una nota…',
  noteAriaLabel: 'Nota para esta solicitud',
  noteMarkerAria: 'Tiene una nota',

  // Map Local — file-backed mock response (traffic-rules-modal.ts + proxy).
  mockFieldFile: 'Archivo local',
  mockChooseFile: 'Elegir archivo…',
  mockFilePlaceholder: 'No se eligió ningún archivo',
  mockFileClearAria: 'Borrar el archivo asignado',
  mockFileServingBody: 'El cuerpo de respuesta se sirve desde el archivo asignado.',
  mapLocalHint:
    'Sirve un archivo local como el cuerpo de respuesta. El Content-Type se infiere de la extensión del archivo a menos que se establezca arriba.',
  mapLocalDialogTitle: 'Elegir un archivo para servir',
  mapLocalAllFilesFilter: 'Todos los archivos',

  // Focus hosts (network-session-view.ts + sidebar toggles).
  focusHost: (host: string): string => `Enfocar ${host}`,
  unfocusHost: (host: string): string => `Desenfocar ${host}`,
  clearFocusedHosts: 'Borrar los hosts enfocados',

  // Replay / Compose (network-detail-view.ts action + network-compose-modal.ts).
  replay: 'Repetir',
  replayTitle: 'Repetir esta solicitud desde el host',
  replayAria: 'Repetir solicitud',
  moreReplayOptions: 'Más opciones de repetición',
  replayNow: 'Repetir ahora',
  composeItem: 'Editar y reenviar…',
  composeTitle: 'Editar y reenviar',
  composeNote: 'Vuelva a emitir esta solicitud desde el host. Edite el método, la URL, los encabezados o el cuerpo antes de enviar.',
  composeMethodLabel: 'Método',
  composeUrlLabel: 'URL',
  composeParamsLabel: 'Parámetros de consulta',
  composeAddRow: '+ Agregar',
  composeRowEnabledAria: 'Incluir esta entrada',
  composeSelectAllAria: 'Alternar todas las entradas',
  composeHeadersLabel: 'Encabezados',
  composeBodyLabel: 'Cuerpo',
  composeBodyPlaceholder: 'Cuerpo de solicitud',
  composeBinaryBodyNote:
    'El cuerpo de solicitud capturado es binario y se envía sin cambios; no se puede editar aquí.',
  composeApplyRules: 'Aplicar las reglas de tráfico activas',
  composeApplyRulesTitle: 'Ejecutar la repetición a través de las reglas de bloqueo, reescritura y limitación de este dispositivo',
  composeSend: 'Enviar',
  composeSending: 'Enviando…',
  replayAddedToList: 'Respuesta agregada a la lista de sesiones.',
  replayFailed: (err: string): string => `La repetición falló: ${err}`,
  replayInvalidUrl: 'Ingrese una URL http:// o https:// válida.',
  replayUnavailable: 'La repetición no está disponible en esta compilación.',
  replayStarting: 'Repitiendo…',
  tagsReplayed: 'Repetida',
  replayedBadgeTitle: 'Esta respuesta se produjo al repetir una solicitud capturada desde el host',

  // Timing waterfall (network-detail.ts Overview timing section).
  ovDuration: 'Duración',
  wfDns: 'DNS',
  wfConnect: 'Conexión',
  wfTls: 'TLS',
  wfSend: 'Envío',
  wfWait: 'Espera (TTFB)',
  wfReceive: 'Descarga',
  wfMs: (n: number): string => `${n} ms`,
  wfSeconds: (s: number): string => `${s.toFixed(2)} s`,
  wfSegmentTitle: (label: string, value: string): string => `${label}: ${value}`,
  wfAria: 'Desglose de tiempos de la solicitud'
};
