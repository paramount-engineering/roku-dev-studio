/**
 * Latin American Spanish (LatAm) translation of the Action Scripts UI strings
 * (Builder, step fields, Executor, Import modal, shared actions list, and the
 * per-step Help modal).
 *
 * Same structure/keys/order as ../action-scripts.ts. Parametrized strings are
 * functions returning the composed text. Help-modal body values contain inline
 * HTML (assigned via `setSafeHTML`); dynamic values are HTML-escaped at the call
 * site before being passed in.
 */
export const actionScripts = {
  // ── Builder: step-type option (legacy) ──
  legacyPluginsMemoryOption: 'Plugins / Memoria (JSON heredado)',

  // ── Builder: per-step field labels / placeholders / prompts ──
  labelQuery: 'Consulta',
  labelEndpoint: 'Endpoint',
  optionCustom: 'Personalizado...',
  labelSystemTelnetCommand: 'Comando (tipo heredado — use Consulta de dispositivo para pasos nuevos)',
  labelKey: 'Tecla',
  optionSelectKey: '-- Seleccionar tecla --',
  labelText: 'Texto',
  placeholderTextToSend: 'Texto para enviar',
  labelAppId: 'App ID',
  labelParamsOptional: 'Parámetros (opcional)',
  labelFilePath: 'Ruta del archivo',
  placeholderPastePathOrChoose: 'Pegar la ruta o elegir un archivo',
  titleFilePathZip: 'Ruta al paquete .zip. Péguela aquí o use Elegir archivo.',
  chooseFileTitle: 'Elegir archivo (.zip)',
  chooseFileAria: 'Elegir archivo',
  chooseFileBtn: 'Elegir archivo',
  labelPassword: 'Contraseña',
  placeholderDevPassword: 'Contraseña de desarrollador',
  optionConnectAppConnectorFirst: 'Conecte App Connector primero',
  labelFunction: 'Función',
  labelSetVarOptional: 'Asignar variable (opcional)',
  placeholderVarExample: 'p. ej. varX',
  titleVarNameRules: 'Letras, dígitos, guion bajo; comience con letra o _',
  noParameters: 'Sin parámetros',
  selectAFunction: 'Seleccione una función',
  labelCommand: 'Comando',
  labelParameters: 'Parámetros',
  labelLabelOptional: 'Etiqueta (opcional)',
  placeholderScreenshotLabel: 'p. ej. Después del inicio de sesión',
  labelWaitBeforeMs: 'Esperar antes (ms)',
  labelWaitAfterMs: 'Esperar después (ms)',
  placeholderWaitAfterDefault: '1500 (predeterminado)',
  titleWaitAfter:
    'Tiempo de espera después de iniciar la captura antes de la primera descarga. Auméntelo si la imagen queda truncada o la UI está lenta (p. ej. HUD).',
  optionChooseChart: 'Elegir gráfico…',
  labelChart: 'Gráfico',
  placeholderPerfLabel: 'p. ej. Después de navegar',
  waitModeFixedDelay: 'Retraso fijo (ms)',
  waitModeUntilCondition: 'Hasta condición',
  labelWaitType: 'Tipo de espera',
  labelDelayMs: 'Retraso (ms)',
  labelSource: 'Origen',
  labelState: 'Estado',
  optionSelectState: '-- Seleccionar estado --',
  labelTimeoutMs: 'Tiempo límite (ms)',
  labelPollIntervalMs: 'Intervalo de sondeo (ms)',
  labelPathJsonArray: 'Ruta (arreglo JSON)',
  labelNodeId: 'ID de nodo',
  labelFieldName: 'Nombre del campo',
  labelOperator: 'Operador',
  placeholderFieldInFieldList: 'Campo en FieldList',
  placeholderCompareString: 'Cadena de comparación',
  placeholderCompareValue: 'Valor de comparación',
  caseInsensitive: 'No distingue mayúsculas',
  labelConditionSource: 'Origen de la condición',
  labelAttribute: 'Atributo',
  placeholderActiveAppValue: 'p. ej. dev, 837, YouTube',
  labelVariablePath: 'Ruta de la variable',
  labelPost: 'POST',
  optionSelectPost: '-- Seleccionar POST --',
  noExtraFields: 'No hay campos adicionales para este tipo.',

  // Chart option labels (shared: Builder dropdown, list Details, Executor descriptions)
  chartObjects: 'Objetos BrightScript',
  chartCpu: 'Uso de CPU',
  chartMemory: 'Memoria del sistema',
  chartAboveAll: 'Todo combinado',

  // Condition / wait source labels (shared)
  sourceMediaPlayer: 'Reproductor multimedia',
  sourceActiveApp: 'App activa',
  sourceRaleNodeField: 'Campo de nodo RALE',
  sourceVariables: 'Variables',

  // Value-with-operator label (Builder compare cells)
  valueWithOperator: (op: string): string => `Valor (${op})`,

  // ── Shared actions list view (Builder + Executor) ──
  branchThen: 'Entonces',
  branchElse: 'Si no',
  dragToReorder: 'Arrastrar para reordenar',
  columnType: 'Tipo',
  columnDetails: 'Detalles',
  addStep: 'Agregar paso',
  pasteStepBtn: 'Pegar paso',
  pasteActionTooltip: 'Pegar aquí la acción copiada',
  ariaThenBranchPrefix: 'Rama Entonces. ',
  ariaElseBranchPrefix: 'Rama Si no. ',
  copyActionTooltip: 'Copiar acción',
  removeActionTooltip: 'Eliminar acción',
  skipBtn: 'Omitir',
  skipActionTooltip: 'Omitir esta acción',
  skipActionAria: 'Omitir acción',
  unskipBtn: 'No omitir',
  runActionTooltip: 'Ejecutar esta acción',
  unskipActionAria: 'No omitir acción',
  emptyNoScript:
    'No hay ningún script cargado. Haga clic en <strong>Importar Action Script</strong> arriba para importar un script, o use la pestaña <strong>Constructor</strong> para crear uno.',
  stepRowAria: (num: string, type: string, details: string): string =>
    `Acción ${num}: ${type}${details ? ', ' + details : ''}. Haga clic para editar.`,

  /** Row header / error line: "Action <id>: <text>" */
  actionLabel: (id: string, text: string): string => `Acción ${id}: ${text}`,

  // ── Builder chrome + toasts + import messages ──
  helpTooltip: (label: string, detail: string): string => `Ayuda: ${label}${detail}`,
  addActionBtn: 'Agregar acción',
  updateStepHeading: (n: number): string => `Actualizar paso ${n}`,
  updateActionBtn: 'Actualizar acción',
  toastActionPasted: 'Acción pegada',
  toastCannotMoveIntoOwnBranch: 'No se puede mover un paso a su propia rama If.',
  toastActionCopied: 'Acción copiada',
  toastChooseChartType: 'Elija un tipo de gráfico para Rendimiento del dispositivo.',
  toastUpdatedAction: (n: number): string => `Acción #${n} actualizada`,
  copiedFeedback: '¡Copiado!',
  copyActionScriptBtn: 'Copiar Action Script',
  savedFeedback: '¡Guardado!',
  saveActionScriptBtn: 'Guardar Action Script',
  saveModalNameLabel: 'Nombre',
  saveModalNamePlaceholder: 'p. ej. Iniciar y reproducir',
  saveModalNameRequired: 'Escriba un nombre.',
  saveModalOverwriteWarning: (name: string): string =>
    `Ya existe un script guardado con el nombre "${name}".`,
  saveModalOverwriteConfirm: 'Sobrescribir',
  saveModalSavedListLabel: 'Scripts guardados',
  saveModalNoSavedScripts: 'No hay scripts guardados',
  toastSaveFailed: 'No se pudo guardar el script.',
  viewerHeading: 'Ver y administrar Action Scripts',
  viewerSaveAs: 'Guardar como…',
  viewerApplyToDevice: 'Aplicar al dispositivo',
  viewerApply: 'Aplicar',
  viewerRescan: 'Volver a escanear',
  viewerNoDevices: 'No se encontraron dispositivos',
  viewerCopySuffix: 'copia',
  viewerDeleteConfirm: (name: string): string => `¿Eliminar el script guardado "${name}"?`,
  viewerNoDeviceNote: 'Conecte un dispositivo en la ventana principal para ver en vivo los nombres de funciones de App Connector y RALE.',
  viewerEmpty: 'Aún no hay scripts guardados: guarde uno desde el Builder de Action Scripts de una pestaña de dispositivo.',
  msgNoScriptJson: 'No hay JSON de script para cargar.',
  invalidJson: (detail: string): string => `JSON no válido: ${detail}`,
  msgStepsArray: 'El script debe tener un arreglo "steps".',
  msgValidation: (lines: string): string => `Validación:\n${lines}`,

  // ── index.ts toasts (user-visible; MCP-bridge/agent error strings are left in place) ──
  toastBuilderNotAvailable: 'El Constructor no está disponible en esta pestaña.',
  toastLoadedInBuilder: 'Cargado en el Constructor',
  toastAiAgentLoaded: 'El Agente de IA cargó un script en el Constructor',
  toastCouldNotLoadScript: 'No se pudo cargar el script',
  toastNoScriptInExecutor: 'No hay JSON de script en el Ejecutor para cargar.',
  toastAddNonEmptySteps: 'Primero agregue un arreglo "steps" no vacío al JSON del script.',
  toastOpenedInBuilder: 'Abierto en el Constructor',

  // ── Shared RALE preflight errors (Executor + Import) ──
  errDevAppRequired:
    'Se debe iniciar la Roku Developer Application para establecer una conexión con App Connector. Abra la Developer Application en su dispositivo Roku (o inicie su canal cargado con sideload desde la pestaña Dev App), luego intente de nuevo.',
  errRaleConnection:
    'La herramienta no pudo establecer una conexión con App Connector. Asegúrese de que su Dev App esté en ejecución con el Modo de desarrollador activado y de que el puerto correcto esté configurado en la pestaña App Connector, luego intente de nuevo. El script no se puede ejecutar hasta que haya una conexión disponible.',

  // ── Executor engine: full-sentence user-facing errors ──
  errScreenshotPassword:
    'Se requiere la contraseña de desarrollador para la captura de pantalla. Especifíquela en el script (devPassword) o ingrésela durante la validación.',
  errScreenshotDevApp:
    'La captura de pantalla requiere que la Developer App esté activa. Primero inicie su canal cargado con sideload desde la pestaña Dev App.',
  errDevicePerformanceInRds:
    'Rendimiento del dispositivo solo está disponible al ejecutar Action Scripts en Roku Dev Studio.',

  // ── Executor UI ──
  runBtnPause: 'Pausar ejecución',
  runBtnResume: 'Reanudar ejecución',
  runBtnRun: 'Ejecutar Action Script',
  emptyNoActions:
    '<strong>No hay acciones cargadas</strong><br><br>Use <strong>Importar Action Script</strong> arriba para pegar o subir un script JSON, luego haga clic en <strong>Validar e importar</strong> en el modal para cargar las acciones aquí.',
  noFolderSelected: 'Ninguna carpeta seleccionada',
  resultsPlaceholder: 'Valide y ejecute para ver los resultados.',
  waiting: 'Esperando…',
  statusOk: '✓ OK',
  statusFailed: '✗ Falló',
  statusFailedPlain: 'Falló',
  statusSkipped: 'Omitido',
  altScreenshot: 'Captura de pantalla',
  altDevicePerformanceChart: 'Gráfico de rendimiento del dispositivo',
  validating: 'Validando…',
  errPasteOrUpload: 'Pegue o suba un script (JSON).',
  errMissingAppFunctions: (list: string): string =>
    `Las siguientes funciones de app no están disponibles desde la app: ${list}. Asegúrese de que su canal exponga estas funciones (o elimine estos pasos del script), luego intente de nuevo.`,
  expectedSuffix: (values: string): string => `\n   esperado: ${values}`,
  errFileNotFound: (path: string): string => `Archivo no encontrado: ${path}`,
  statusValid: '✓ Válido',
  usingDevPasswordFromAuth: '(usando la contraseña de desarrollador de Auth)',
  switchedTabRunPaused:
    'Cambió de pestaña — la ejecución está en pausa. Vuelva a Action Scripts para reanudar (si el JSON no cambió), o use Importar → Validar e importar.',
  scriptChangedNeedsValidation:
    'El script cambió o necesita validación — use Importar Action Script → Validar e importar, o cambie el JSON y valide.',
  scriptChangedClickValidate: 'El script cambió — haga clic en Validar.',
  connectingToAppConnector: 'Conectando a App Connector...',
  runStarted: (runId: string, count: number): string =>
    `Ejecución iniciada (${runId}) — ${count} ${count === 1 ? 'acción' : 'acciones'}`,
  errDevicePerformanceUnavailable:
    'El rendimiento del dispositivo no está disponible para este dispositivo. Abra la Remote Section (con métricas) o reconecte el dispositivo.',
  errorLine: (message: string): string => `Error: ${message}`,
  runStopped: 'Ejecución detenida.',
  runCompleted: 'Ejecución completada.',
  copyResultsTitle: 'Copiar resultados',
  saveResultsTitle: 'Guardar resultados como PDF',

  // ── validator.ts parse errors ──
  noScriptContent: 'Sin contenido de script',
  scriptEmpty: 'El script está vacío',
  invalidJsonShort: 'JSON no válido',

  // ── Import modal ──
  msgStepsArrayNoDot: 'El script debe tener un arreglo "steps"',
  errInvalidScriptObject: 'Script no válido: debe ser un objeto',
  importModalTitle: 'Importar Action Script',
  importIntoBuilderTitle: 'Importar script al Constructor',
  validateAndLoadBtn: 'Validar y cargar',
  validateAndImportBtn: 'Validar e importar',
  errCannotVerifyPassword: 'No se puede verificar la contraseña: no hay conexión con el dispositivo disponible.',
  errVerificationFailed: 'Verificación fallida',
  errCouldNotDetermineDevice:
    'No se pudo determinar el dispositivo para la importación. Cierre el modal y abra Importar de nuevo desde esta pestaña de dispositivo.',
  errInvalidScript: 'Script no válido',
  errSaveFolderRequired:
    'Se requiere una carpeta de guardado para este script (p. ej. el paso de captura de pantalla). Elija una carpeta de guardado.',
  errDevPasswordRequired: 'Se requiere la contraseña de desarrollador y no está en la caché ni en el script. Ingrésela a continuación.',
  verifyingPassword: 'Verificando la contraseña…',
  errAuthFailed: 'La autenticación falló. Verifique su contraseña e intente de nuevo.',
  errPasswordVerificationFailed: 'La verificación de la contraseña falló.',
  errValidationFailed: 'La validación falló',
  errVerificationOrValidationFailed: 'La verificación o la validación falló',
  errFailedToReadFile: 'No se pudo leer el archivo',

  // ── Step Help modal: subtitles + title ──
  helpSubCustomEndpoint: 'Endpoint personalizado',
  helpSubSelectPost: 'Seleccionar un POST',
  helpSubFixedDelay: 'Retraso fijo',
  helpUntilCondition: (srcLabel: string): string => `Hasta condición · ${srcLabel}`,
  helpSubSelectCommand: 'Seleccionar un comando',
  helpSubSelectKey: 'Seleccionar una tecla',
  helpSubSelectCommandShort: 'Seleccionar comando',
  helpSystemTelnetTitle: 'Plugins / Memoria (heredado)',
  helpNoText: (type: string): string => `No hay texto de ayuda para “${type}”.`,

  // ── Step Help modal: variant bodies (inline HTML) ──
  helpBodyQueryCustom: `
    <p>
      <strong>Personalizado</strong> le permite escribir usted mismo cualquier ruta de Consulta de dispositivo: un GET de ECP normal en <code>/query/…</code>, o
      valores de tipo dev como <code>telnet:plugins</code> / <code>telnet:free</code>.
    </p>
    <p>Use esto cuando no haya un preajuste para el endpoint que necesita. El valor se envía tal cual al mismo mecanismo de consultas que los preajustes.</p>
  `,
  helpBodyQueryTelnetPlugins: `
    <p>
      Ejecuta el comando telnet de desarrollador <strong>plugins</strong> (lista de canales empaquetados / resumen de plugins). Son los
      mismos datos que al elegir el preajuste Plugins en flujos antiguos, expresados como un preajuste de consulta.
    </p>
    <p>Requiere acceso de desarrollador al dispositivo (igual que otras consultas de dev-plugin).</p>
  `,
  helpBodyQueryTelnetFree: `
    <p>
      Ejecuta el comando telnet de desarrollador <strong>free</strong> (instantánea de tipo memoria / heap). Úselo cuando necesite una
      lectura rápida de memoria durante un script.
    </p>
  `,
  helpBodyPostNone: `
    <p>Elija uno de los preajustes de <strong>POST</strong> (SGRendezvous, FW Beacons, etc.). Cada opción se asigna a una ruta fija en el dispositivo.</p>
  `,
  helpBodyWaitDelay: `
    <p>
      Pausa el script durante la cantidad indicada de <strong>milisegundos</strong> sin sondeo. Úselo después de animaciones,
      inicios de app, o cualquier paso donde solo necesite una pausa fija.
    </p>
  `,
  helpBodyWaitMediaPlayer: `
    <p>
      Sondea <code>/query/media-player</code> hasta que el <strong>estado</strong> del reproductor coincida con su selección (play,
      pause, buffer, …) o se agote el <strong>tiempo límite</strong>.
    </p>
    <p>
      Ajuste el <strong>intervalo de sondeo</strong> para equilibrar la capacidad de respuesta y la carga. Si la condición nunca se cumple, el
      paso falla cuando se alcanza el tiempo límite.
    </p>
  `,
  helpBodyWaitRale: `
    <p>
      Sondea a través de <strong>RALE</strong> hasta que un campo de un nodo de escena coincida con la comparación (operador + valor). Debe
      proporcionar la ruta (arreglo JSON), el id de nodo, el nombre del campo y los campos de temporización.
    </p>
    <p>
      Requiere una conexión con App Connector en tiempo de ejecución. Operadores como <code>exists</code> / <code>notExists</code> pueden
      ocultar el campo de valor; consulte las etiquetas del formulario para el modo activo.
    </p>
  `,
  helpBodyIfMediaPlayer: `
    <p>
      Evalúa una vez el estado actual del <strong>reproductor multimedia</strong> y ejecuta la rama <strong>entonces</strong> o
      <strong>si no</strong>. Elija el estado esperado (play, pause, …) para bifurcar.
    </p>
    <p>A diferencia de <strong>Esperar</strong>, no hay sondeo: la condición se comprueba una sola vez cuando se ejecuta el paso.</p>
  `,
  helpBodyIfActiveApp: `
    <p>
      Compara un atributo de <code>/query/active-app</code> (app id, tipo, versión, nombre) usando el operador y
      el valor que establezca. Útil para bifurcar cuando un canal específico está en primer plano.
    </p>
  `,
  helpBodyIfRale: `
    <p>
      Comprobación única de un <strong>campo de nodo RALE</strong> (ruta, id de nodo, campo, operador, valor). Con la misma estructura que el
      lado RALE de una condición de Esperar, pero evaluada una vez para bifurcar.
    </p>
  `,
  helpBodyIfVariables: `
    <p>
      Compara un valor almacenado en una <strong>variable de script</strong> (de un Comando RALE o una Función de app anterior)
      usando la ruta de la variable y el operador que configure.
    </p>
    <p>Requiere la versión 2 del script y pasos anteriores que rellenen la variable.</p>
  `,
  helpBodyRaleNone: `
    <p>Seleccione un <strong>comando RALE</strong> de la lista. Los parámetros y el opcional “Asignar variable” aparecen después de elegir un comando.</p>
  `,
  helpBodyAppFunctionNone: `
    <p>
      Conecte <strong>App Connector</strong> para que las funciones exportadas de su canal aparezcan en la lista, luego elija una
      función para ver sus parámetros.
    </p>
  `,
  helpBodyKeypressNone: `
    <p>Elija una <strong>tecla del control remoto</strong> de la lista agrupada. El script envía esa tecla por ECP cuando se ejecuta el paso.</p>
  `,
  helpBodySystemTelnetNone: `
    <p>Elija <strong>Plugins</strong> o <strong>Memoria</strong> para este paso heredado, o migre a Consulta de dispositivo con los preajustes de telnet correspondientes.</p>
  `,
  helpBodySystemTelnetPlugins: `
    <p>Comando telnet <strong>plugins</strong> heredado. Prefiera <strong>Consulta de dispositivo</strong> con el preajuste <code>telnet:plugins</code> para scripts nuevos.</p>
  `,
  helpBodySystemTelnetFree: `
    <p>Comando telnet <strong>free</strong> (memoria) heredado. Prefiera <strong>Consulta de dispositivo</strong> con el preajuste <code>telnet:free</code> para scripts nuevos.</p>
  `,

  // ── Step Help modal: per-action fallback bodies (inline HTML) ──
  helpFallbackQuery: `
    <p>
      Ejecuta una lectura en el dispositivo: un <strong>GET de ECP</strong> normal en una ruta <code>/query/…</code> o un
      endpoint de tipo dev como <code>telnet:plugins</code> / <code>telnet:free</code>.
    </p>
    <p>Elija un preajuste para endpoints comunes, o <strong>Personalizado</strong> para escribir el suyo.</p>
  `,
  helpFallbackPost: `
    <p>
      Envía un <strong>HTTP POST</strong> al Roku en una ruta fija de analíticas / beacon. Cada preajuste se asigna a un
      endpoint específico usado en flujos de trabajo de desarrollo.
    </p>
  `,
  helpFallbackKeypress: `
    <p>
      Envía una <strong>tecla del control remoto</strong> por ECP. El título de la ayuda refleja qué tecla está seleccionada actualmente cuando
      abre este cuadro de diálogo.
    </p>
  `,
  helpFallbackInputText: `
    <p>
      Envía <strong>texto de tipo teclado</strong> al dispositivo (entrada de texto de ECP). El campo enfocado o el teclado
      en pantalla recibe los caracteres.
    </p>
  `,
  helpFallbackLaunch: `
    <p>
      Inicia un canal por <strong>app ID</strong>. Los <strong>parámetros</strong> opcionales pueden proporcionar un Deep-Link o argumentos
      de inicio según el canal.
    </p>
  `,
  helpFallbackSideload: `
    <p>
      Sube un paquete desde la <strong>ruta del archivo</strong> y lo instala como el canal de desarrollador cargado con sideload. Proporcione una
      contraseña de desarrollador en el paso o mediante <code>devPassword</code> del script cuando sea necesario.
    </p>
  `,
  helpFallbackDeleteSideload: `
    <p>Elimina el canal de desarrollador cargado con sideload. La contraseña opcional coincide con la configuración de seguridad de dev de su dispositivo.</p>
  `,
  helpFallbackAppFunction: `
    <p>
      Llama a una <strong>función de BrightScript</strong> a través de App Connector. El subtítulo muestra la <strong>función
      seleccionada</strong>. Los parámetros coinciden con la firma exportada del canal; use <strong>Asignar variable</strong> para capturar un
      valor de retorno para pasos posteriores.
    </p>
  `,
  helpFallbackRaleCommand: `
    <p>
      Ejecuta un <strong>comando RALE integrado</strong>. El subtítulo muestra el comando seleccionado; el texto ampliado proviene
      de la descripción integrada del comando cuando está disponible.
    </p>
  `,
  helpFallbackDevicePerformance: `
    <p>
      Captura los gráficos de <strong>Rendimiento del dispositivo</strong> para el <strong>mismo dispositivo</strong> en el que se ejecuta este script (la
      misma conexión que Consulta de dispositivo y pulsación de tecla). Los valores siguen la configuración del historial de Remote Section cuando el sondeo en vivo ha
      llenado los gráficos; de lo contrario, el paso espera brevemente una muestra nueva cuando es necesario.
    </p>
    <h4>Gráfico</h4>
    <p>
      <strong>Objetos BrightScript</strong>, <strong>Uso de CPU</strong>, <strong>Memoria del sistema</strong>, o
      <strong>Todo combinado</strong> (un resultado combinado: CPU, luego memoria, luego objetos). La CPU y la memoria provienen del
      mismo sondeo de rendimiento del canal.
    </p>
    <h4>Etiqueta opcional</h4>
    <p>Se muestra en el encabezado de resultados, similar al paso de captura de pantalla.</p>
  `,
  helpFallbackScreenshot: `
    <p>
      Captura la imagen del televisor a través de la <strong>Developer App</strong>. La Developer App debe estar activa; una
      contraseña de desarrollador debe estar disponible en el paso, el script o el aviso de validación.
    </p>
    <h4>Esperar antes (ms)</h4>
    <p>
      Pausa en el ejecutor <strong>antes</strong> de que comience la captura para que la UI se estabilice (100 ms de forma predeterminada al agregar
      el paso).
    </p>
    <h4>Esperar después (ms)</h4>
    <p>
      Después de iniciar la captura, el ejecutor espera antes de descargar <code>dev.jpg</code>. Auméntelo si las imágenes quedan
      truncadas; vacío usa <strong>1500 ms</strong> de forma predeterminada.
    </p>
    <h4>Etiqueta opcional</h4>
    <p>Ayuda a identificar esta captura en la salida de la ejecución cuando un script toma varias capturas de pantalla.</p>
  `,
  helpFallbackWait: `
    <p>
      Ya sea un <strong>retraso fijo</strong> o <strong>hasta que se cumpla una condición</strong>. El subtítulo refleja el
      tipo de espera actual y, para las condiciones, el origen de datos (reproductor multimedia vs campo de nodo RALE).
    </p>
  `,
  helpFallbackIf: `
    <p>
      Se bifurca en listas de pasos <strong>entonces</strong> / <strong>si no</strong> usando una condición de una sola vez. El subtítulo
      refleja el origen de condición seleccionado (reproductor multimedia, app activa, campo RALE o variables). Requiere la versión
      2 del script.
    </p>
  `,
  helpFallbackSystemTelnet: `
    <p>
      Paso <strong>heredado</strong> solo de telnet. Prefiera <strong>Consulta de dispositivo</strong> con <code>telnet:plugins</code> o
      <code>telnet:free</code> para scripts nuevos.
    </p>
  `,

  // ── Step Help modal: composed / interpolated body fragments (dynamic values pre-escaped) ──
  helpQueryPresetBody: (label: string, endpoint: string): string => `
    <p>
      Ejecuta una <strong>Consulta de dispositivo</strong> para <strong>${label}</strong> usando el endpoint
      <code>${endpoint}</code>.
    </p>
    <p>
      Como todas las consultas, esta usa ECP (o la ruta de dev-plugin de la app para preajustes de tipo telnet). El dispositivo debe estar
      accesible en la red.
    </p>
  `,
  helpPostPresetBody: (label: string, endpoint: string): string => `
    <p>
      Envía un <strong>POST</strong> HTTP a <code>${endpoint}</code> (<strong>${label}</strong>).
    </p>
    <p>Use esto para flujos de analíticas / beacon que esperan POST en lugar de GET.</p>
  `,
  helpSelectedFunction: (fn: string): string =>
    `<p><strong>Función seleccionada:</strong> <code>${fn}</code></p>`,
  helpAppFunctionDescription: (desc: string): string =>
    `<p><strong>Descripción de la función de app:</strong> ${desc}</p>`,
  helpAppFunctionArgs:
    '<p>Las filas de argumentos siguen los metadatos de App Connector para esta función; los tipos complejos usan JSON en el campo.</p>',
  helpCurrentKey: (nice: string, key: string): string => `
        <p>
          <strong>Tecla actual:</strong> ${nice} (<code>${key}</code>) — se envía como una pulsación de tecla ECP
          estándar cuando se ejecuta el paso.
        </p>
      `,

  // ── Builder: additional field placeholders / option fallbacks ──
  placeholderQueryEndpoint: '/query/… o telnet:plugins / telnet:free',
  placeholderVariablePathExample: 'myVar o data.items.0.id',
  optionUnknownFunction: 'desconocida',

  // ── Executor: step descriptions (stepDescription; result-card header + list rows) ──
  descQuery: (endpoint: string): string => `Consulta ${endpoint}`,
  descKeypress: (key: string): string => `Pulsación de tecla ${key}`,
  descSendText: (text: string): string => `Enviar texto "${text}"`,
  descLaunchApp: (appId: string): string => `Iniciar app ${appId}`,
  descSideload: (filename: string): string => `Cargar con sideload ${filename}`,
  descDeleteSideload: 'Eliminar sideload',
  descAppFunction: (fn: string): string => `Función de app ${fn}`,
  descScreenshot: 'Captura de pantalla',
  descScreenshotLabel: (label: string): string => `Captura de pantalla (${label})`,
  descScreenshotWaitAfter: (ms: number): string => `Captura de pantalla (esperar después: ${ms}ms)`,
  descDevicePerformance: (chart: string): string => `Rendimiento del dispositivo — ${chart}`,
  descDevicePerformanceLabel: (label: string, chart: string): string =>
    `Rendimiento del dispositivo (${label}) — ${chart}`,
  descWait: 'Esperar',
  descWaitWithDetails: (details: string): string => `Esperar · ${details}`,
  descIf: 'If (…)',
  descIfWithDetails: (details: string): string => `If · ${details}`,

  // ── Executor: wait-step Details column (formatWaitStepListDetails) ──
  waitDetailFixedDelay: (delayMs: number): string => `Retraso fijo ${delayMs} ms`,
  waitDetailTiming: (maxSec: number, pollMs: number): string =>
    ` · máx ${maxSec}s · sondeo ${pollMs}ms`,
  waitDetailMediaPlayerState: (state: string): string => `Reproductor multimedia · hasta el estado "${state}"`,
  waitDetailMediaPlayerCheck: (check: string): string => `Reproductor multimedia · hasta ${check}`,
  waitDetailRale: (line: string): string => `Campo de nodo RALE · ${line}`,
  waitDetailRaleIncomplete: 'Campo de nodo RALE · (incompleto)',
  waitDetailGenericSource: (src: string): string => `Esperar · origen ${src}`,

  // ── Executor: if-step Details column (formatIfStepListDetails) ──
  ifDetailMediaPlayerState: (state: string): string => `Reproductor multimedia · estado "${state}"`,
  ifDetailMediaPlayerCheck: (check: string): string => `Reproductor multimedia · ${check}`,
  ifDetailRale: (line: string): string => `Campo de nodo RALE · ${line}`,
  ifDetailRaleEmpty: 'Campo de nodo RALE · …',
  ifDetailVariable: (path: string): string => `Variable · $${path}`,
  ifDetailVariableEmpty: 'Variable · …',
  ifDetailActiveApp: (attr: string): string => `App activa · ${attr}`,
  ifDetailActiveAppEmpty: 'App activa · …',

  // ── Executor: results-panel progress log lines (onLog) ──
  logWaitingMs: (ms: number): string => `Esperando ${ms} ms...`,
  logWaitingBeforeCapture: (ms: number): string => `Esperando ${ms} ms antes de la captura...`,
  logPollingFieldMet: (elapsed: number, field: string): string =>
    `Sondeando... (${elapsed}s) — campo "${field}" — condición cumplida`,
  logPollingField: (elapsed: number, field: string, value: string): string =>
    `Sondeando... (${elapsed}s) — campo "${field}": ${value}`,
  logPollingStatusMet: (elapsed: number, status: string): string =>
    `Sondeando... (${elapsed}s) — ${status} — condición cumplida`,
  logPollingStatus: (elapsed: number, status: string): string =>
    `Sondeando... (${elapsed}s) — ${status}`,
  pollValueEmpty: '(vacío)',
  pollValueReconnecting: '(reconectando...)',
  pollValueNoResponse: '(sin respuesta)',
  pollStateValue: (state: unknown): string => `estado: ${state}`,
  pollStateNone: 'estado: (ninguno)',
  pollInvalidMediaPlayer: 'Respuesta de media-player no válida',
  pollQueryFailed: (err: string): string => `La consulta falló: ${err}`,
  pollNoResponse: 'Sin respuesta',
  logConnectingTelnet: 'Conectando a Telnet (puerto 8080)...',
  logQueryUsesDevTelnet: (ep: string, cmd: string): string =>
    `La Consulta de dispositivo "${ep}" usa Telnet de dev "${cmd}" (igual que la pestaña Consulta).`,
  logPartialPerformance: 'Algunas secciones de rendimiento no estaban disponibles; instantánea parcial.',

  // ── Executor: step result summaries (onLog) ──
  stepSummaryChars: (n: number): string => `→ ${n} caracteres`,
  stepSummaryOk: '→ OK',
  stepSummarySentKey: (key: string): string => `→ se envió ${key}`,
  stepSummarySent: '→ enviado',
  stepSummaryLaunched: (appId: string): string => `→ se inició ${appId}`,
  stepSummarySideloadComplete: '→ sideload completo',
  stepSummaryDeleted: '→ eliminado',
  stepSummarySaveFailed: (err: string): string => `→ el guardado falló: ${err}`,
  stepSummarySavedAs: (filename: string): string => `→ guardado como ${filename}`,
  stepSummaryCapturedNoFolder: '→ capturado (sin carpeta de guardado)',
  stepSummaryChartImages: (n: number): string => `→ ${n} imagen(es) de gráfico`,
  stepSummaryCaptured: '→ capturado',
  stepSummarySkipped: (reason: string): string => `→ omitido (${reason})`,

  // ── Executor: step errors / skip reasons (result.error / skippedReason) ──
  errWaitTimeout: 'Tiempo de espera agotado',
  errStopped: 'Detenido',
  skipReasonNoAppConnector: 'App Connector no disponible',
  errNoAppConnectorRaleWait: 'App Connector no disponible para la espera de nodo RALE',
  errUnknownActionType: (type: string): string => `Tipo de acción desconocido: ${type}`,
  errInvalidRaleCommand: 'Comando RALE no válido',
  errTelnetNotAvailable: 'Los comandos de sistema de Telnet no están disponibles en este contexto',
  errSaveNotAvailable: 'Guardado no disponible',
  errCouldNotVerifyDevApp: (err: string): string =>
    `No se pudo verificar el estado de Dev App antes de la captura de pantalla: ${err}`,
  errInvalidPath: 'Ruta no válida',
  errStepPreorderMismatch: 'Error interno: discrepancia en el preorden de pasos',

  // ── Settings: Action Script default-folder picker (main process) ──
  pickDefaultFolderTitle: 'Carpeta predeterminada para la salida de Action Script'
};
