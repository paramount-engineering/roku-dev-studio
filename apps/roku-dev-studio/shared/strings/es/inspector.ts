/**
 * Latin American Spanish (neutral) translation of the SceneGraph / node
 * Inspector strings (App Connector / RALE tab). Sibling of ../inspector.ts —
 * same `inspector` shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. Only literal
 * display text is translated; protocol identifiers, type names, code literals,
 * and example values are kept verbatim.
 */
export const inspector = {
  // Reused generic status / errors (Inspector-scoped variants)
  notConnected: 'No conectado',
  commandFailed: 'El comando falló',
  noResponseFromDevice: 'Sin respuesta del dispositivo',

  // Connection flow (Connect/Disconnect, status line, Dev App preflight)
  connectingBtn: 'Conectando...',
  connectionLost: 'Conexión perdida',
  reconnecting: 'Reconectando...',
  connectingStatus: '🟡 Conectando...',
  reconnectingStatus: '🟡 Reconectando...',
  connectedBang: '¡Conectado!',
  checkingDevApp: 'Comprobando si la Dev App está activa...',
  couldNotVerifyDevAppQuery:
    'No se pudo verificar el estado de la Dev App. La consulta de app activa falló (¿red / ECP / modo de desarrollador?).',
  couldNotVerifyDevApp: 'No se pudo verificar el estado de la Dev App.',
  checkConnectionHint: 'Verifique la conexión del dispositivo y el modo de desarrollador, luego intente Conectar de nuevo.',
  statusCheckFailed: 'Error en la comprobación de estado',
  devAppNotRunning:
    'La Dev App no se está ejecutando en el dispositivo Roku. Primero inicie la Dev App cargada con sideload.',
  launchDevAppHint: 'Vaya a la pestaña Dev App y haga clic en "Iniciar" para arrancar su canal cargado con sideload.',
  devAppNotActive: 'Dev App no activa',
  wakingUpTrackerTask: (port: number): string => `Activando TrackerTask en el puerto ${port}...`,
  failedToConnect: 'No se pudo conectar',
  failedToWakeTrackerTask: 'No se pudo activar TrackerTask',
  connectingToSocket: 'Conectando al socket...',
  connectingToSocketRetry: (attempt: number): string =>
    `Conectando al socket (reintento ${attempt})...`,
  initializing: 'Inicializando...',
  connectionClosedByDevice: 'Conexión cerrada por el dispositivo',

  // Response card (index.ts)
  findInResponse: 'Buscar en la respuesta',
  saveResponseTitle: 'Guardar respuesta',
  failedAutoFetchFunctions: 'No se pudieron obtener las funciones automáticamente. Haga clic en Actualizar para intentar de nuevo.',
  refreshing: (command: string): string => `Actualizando ${command}…`,

  // Function selector / dropdown (function-selector.ts)
  connectToLoadFunctions: '-- Conéctese para cargar las funciones --',
  selectAFunction: '-- Seleccione una función --',
  selectFunctionForParamDetails: 'Seleccione una función para ver los detalles de los parámetros',
  appConnectorFunctions: 'Funciones de App Connector',
  raleFunctions: 'Funciones de RALE',
  noFunctionsImplement: 'No hay funciones — implemente GetExternalControlFunctions',
  readyToExecute: 'Listo para ejecutar',
  unknownFunctionName: 'desconocido',
  functionCounts: (appCount: number, raleCount: number): string =>
    `${appCount} función(es) de App, ${raleCount} comando(s) de RALE`,

  // Function execution (function-execution.ts)
  sending: (command: string): string => `Enviando ${command}...`,
  executing: (selection: string): string => `Ejecutando ${selection}...`,
  fetchingFunctions: 'Obteniendo las funciones disponibles...',
  foundFunctions: (n: number): string => `Se encontraron ${n} función(es)`,
  noFunctionsReturned: 'No se devolvieron funciones',
  getExternalControlFunctionsReturnedFalse:
    'getExternalControlFunctions devolvió false — asegúrese de que la escena de SceneGraph implemente esta función',
  failedToFetchFunctions: 'No se pudieron obtener las funciones',
  selectFunctionToExecute: 'Seleccione una función para ejecutar',
  functionExecutionFailed: 'La ejecución de la función falló',
  unknownRaleBuiltin: 'Builtin de RALE desconocido',
  unhandledRaleBuiltin: (command: string): string => `Builtin de RALE no manejado: ${command}`,

  // RALE path parsing (node-lookup.ts)
  pathMustBeJsonArray: 'La ruta debe ser un arreglo JSON (p. ej. [] o [{"child":0}])',
  invalidPathJson: (detail: string): string => `JSON de ruta no válido: ${detail}`,

  // Update Node modal (node-update-panel.ts)
  noNodeContext: 'No hay contexto de nodo — ejecute primero Obtener nodo por ID.',
  fieldNameRequired: 'El nombre del campo es obligatorio.',
  selectNodeFailed: 'selectNode falló',
  selectingNode: 'Seleccionando nodo…',
  removingField: 'Quitando campo…',
  addingField: 'Agregando campo…',
  updatingField: 'Actualizando campo…',
  removedField: (name: string): string => `Se quitó el campo "${name}".`,
  addedField: (name: string): string => `Se agregó el campo "${name}".`,
  updatedField: (name: string): string => `Se actualizó el campo "${name}".`,
  removeFieldBtn: 'Quitar campo',
  addFieldBtn: 'Agregar campo',
  updateFieldBtn: 'Actualizar campo',
  valueLabel: 'Valor',
  newValueLabel: 'Nuevo valor',
  addValuePlaceholder:
    'Valor inicial para el nuevo campo (escalares, true/false, JSON para arreglos / objeto)',
  updateValuePlaceholder: 'Escalares, true/false, JSON para arreglos / vectores / objetos',

  // Update Node — value parse errors (parseValueForRaleFieldType)
  parseBoolean: 'boolean: use true o false',
  parseInteger: 'integer: número no válido',
  parseFloat: 'float: número no válido',
  parseColor: 'color: use un entero (p. ej. -16777216)',
  parseVector2d: 'vector2d: al menos dos elementos, p. ej. [0,0]',
  parseRect2d: 'rect2d: cuatro elementos, p. ej. [0,0,100,100]',
  parseArray: 'array: arreglo JSON no válido',
  parseAssocArray: 'assocarray: se requiere un objeto JSON',
  jsonArrayRequired: (type: string): string => `${type}: se requiere un arreglo JSON`,
  invalidJsonArray: (type: string): string => `${type}: arreglo JSON no válido`,

  // Registry builtin param editors (registry-params-ui.ts)
  unexpectedRegistryResponse: 'Respuesta del registro inesperada',
  loadingRegistry: 'Cargando registro…',
  selectSection: '— Seleccione una sección —',
  noSections: '(sin secciones)',
  selectKey: '— Seleccione una clave —',
  noKeys: '(sin claves)',
  ariaSectionToRemove: 'Sección para quitar',
  ariaSection: 'Sección',
  ariaKey: 'Clave',
  ariaKeyToReplace: 'Clave para reemplazar',
  removeSectionHint: 'Secciones cargadas desde el dispositivo. Ejecutar quita la sección seleccionada.',
  fieldKeyPlaceholder: 'Clave del campo',
  stringValuePlaceholder: 'Valor de cadena',
  newKeyPlaceholder: 'Nueva clave',
  newValuePlaceholder: 'Nuevo valor',

  // Registry client-side validation (registry-validation.ts)
  sectionNameRequired: 'El nombre de la sección es obligatorio.',
  sectionMustBeJsonObject: 'La sección debe ser un objeto JSON (no un arreglo).',
  sectionKeysNotEmpty: 'Las claves del objeto de sección no pueden estar vacías ni contener solo espacios en blanco.',
  eachValueMustBeString: (key: string): string =>
    `Cada valor debe ser una cadena (roRegistry almacena cadenas). La clave "${key}" no es una cadena — use cadenas entre comillas en JSON.`,
  selectSectionFromList: 'Seleccione una sección de la lista.',
  selectKeyFromList: 'Seleccione una clave de la lista.',
  enterFieldKey: 'Ingrese una clave de campo.',

  // Parameter inputs (parameter-inputs.ts)
  noParamsRequired: '✓ No se requieren parámetros',
  selectFunctionForParams: 'Seleccione una función para ver los parámetros',
  booleanPlaceholder: 'true o false',
  stringPlaceholder: 'Ingrese texto...',

  // Execute Function dropdown — RALE builtin labels (rale-builtins.ts)
  getNodeByIdLabel: 'Obtener nodo por ID',
  getNodeByNameLabel: 'Obtener nodo por SubType (clase de componente)',
  getRegistrySectionsLabel: '[Registro] Obtener todas las secciones',
  clearRegistryLabel: '[Registro] Borrar todas las secciones',
  addRegistrySectionLabel: '[Registro] Agregar/actualizar sección',
  removeRegistrySectionLabel: '[Registro] Quitar sección',
  addRegistryFieldLabel: '[Registro] Establecer clave de sección',
  removeRegistryFieldLabel: '[Registro] Quitar clave de sección',
  editRegistryFieldLabel: '[Registro] Editar clave de sección',

  // Execute Function dropdown — RALE builtin descriptions (hint text)
  getNodeByIdDesc:
    'RALE getNodeById — búsqueda en profundidad bajo la ruta; el id coincide con el campo id del nodo. Ruta [] = raíz de la escena.',
  getNodeByNameDesc:
    'RALE getNodeByName — name es node.subtype() (clase de componente XML), p. ej. Label, RowList. Ruta [] = raíz de la escena.',
  getRegistrySectionsDesc:
    'RALE getRegistrySections — lee todas las secciones y claves de roRegistry (devuelve un objeto anidado por nombre de sección).',
  clearRegistryDesc:
    'RALE clearRegistry — elimina todas las secciones del registro en el dispositivo (destructivo).',
  addRegistrySectionDesc:
    'RALE addRegistrySection — args.name = nombre de la sección; args.section = objeto JSON de pares clave/valor de cadena.',
  removeRegistrySectionDesc:
    'RALE removeRegistrySection — elimina una sección. Las secciones se cargan desde el dispositivo; tras el éxito, el registro se actualiza.',
  addRegistryFieldDesc:
    'RALE addRegistryField — establece un valor de cadena para una clave dentro de una sección. La lista de secciones se carga desde el dispositivo.',
  removeRegistryFieldDesc:
    'RALE removeRegistryField — elimina una clave. Elija la sección y la clave de las listas cargadas desde el dispositivo.',
  editRegistryFieldDesc:
    'RALE editRegistryField — elija la sección y la clave, luego ingrese newKey y newValue. Las listas se cargan desde el dispositivo.',
};
