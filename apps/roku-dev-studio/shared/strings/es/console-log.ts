/**
 * Latin American Spanish (neutral) translation of the Console log surface
 * strings (find/filter bar, JSON/XML/URL viewer modals, Console Monitor, and
 * fold controls). Sibling of ../console-log.ts — same `consoleLog` shape, keys,
 * order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. Only literal
 * display text is translated; format tokens and code literals stay verbatim.
 */
export const consoleLog = {
  // ── Shared viewer modal chrome (console-modal-title.ts, structured + URL modals) ──────
  /** Default title prefix for the JSON/XML/URL viewer modals ("Console: JSON"). */
  titlePrefix: 'Consola',
  jsonLabel: 'JSON',
  xmlLabel: 'XML',
  jsonPlusLabel: 'JSON+',
  urlLabel: 'URL',
  /** Transient button feedback after copying (plain text, no glyph — distinct from common.copied). */
  copied: 'Copiado',

  // ── Fold twisty (console-structured-syntax.ts) ────────────────────────────────────────
  collapse: 'Contraer',
  expand: 'Expandir',

  // ── Structured JSON/XML viewer modal (console-structured-view-modal.ts) ───────────────
  copyFormattedTitle: 'Copiar texto con formato',
  hintJsonFullNested: 'Haga clic para ver el JSON completo de esta línea. Use JSON+ solo para fragmentos anidados.',
  hintJsonFormatted: 'Haga clic para ver el JSON con formato (se abre en un cuadro modal)',
  hintXmlFull: 'Haga clic para ver el XML completo de esta línea.',
  hintXmlFormatted: 'Haga clic para ver el XML con formato (se abre en un cuadro modal)',
  hintPillNestedJson: 'Solo JSON anidado (de una cadena con escape). No abre el JSON externo completo.',
  hintPillFullJson: 'JSON completo de esta línea (haga clic en el texto de la línea para lo mismo).',

  // ── URL viewer modal (console-url-modal.ts) ───────────────────────────────────────────
  openInBrowser: 'Abrir en el navegador',
  openInBrowserTitle: 'Abrir en el navegador predeterminado',
  copyUrlTitle: 'Copiar URL',
  fullUrlAria: 'URL completa',
  queryParamsAria: 'Parámetros de consulta',
  colKey: 'Clave',
  colValue: 'Valor',
  couldNotParseParams: 'No se pudieron analizar los parámetros.',
  noQueryParams: 'No hay parámetros de consulta.',
  parameterSet: (n: number): string => `Conjunto de parámetros ${n}`,

  // ── Inline URL span (console-url-detect.ts) ───────────────────────────────────────────
  urlSpanTitle: 'Haga clic para previsualizar en un cuadro modal · ⌘ o Ctrl+clic para abrir en el navegador',

  // ── Find/filter bar markup (console-find-bar-markup.ts) ───────────────────────────────
  modeSelectAria: 'Modo de búsqueda o filtro',
  modeFind: 'Buscar',
  modeFilter: 'Filtrar',
  queryPlaceholder: 'Buscar...',
  queryAria: 'Consulta de búsqueda o filtro',
  // Option-button tooltips: `alt` appends the (Alt+…) shortcut hint the main window binds.
  // The aria-label reuses the same text with `alt=false` (no shortcut suffix).
  optMatchCaseTitle: (alt: boolean): string => `Coincidir mayúsculas/minúsculas${alt ? ' (Alt+C)' : ''}`,
  optWholeWordTitle: (alt: boolean): string => `Coincidir palabra completa${alt ? ' (Alt+W)' : ''}`,
  optRegexTitle: (alt: boolean): string => `Usar expresión regular${alt ? ' (Alt+R)' : ''}`,
  prevTitle: 'Anterior (Shift+Enter)',
  prevAria: 'Coincidencia anterior',
  nextTitle: 'Siguiente (Enter)',
  nextAria: 'Coincidencia siguiente',
  clearAria: 'Limpiar búsqueda',

  // ── Find/filter bar runtime (console-find-bar.ts) ─────────────────────────────────────
  regexSuggestTitle: 'Esto parece una expresión regular — haga clic para buscar por regex',
  searchingPct: (pct: number): string => `Buscando... ${pct}%`,
  noResults: 'Sin resultados',
  matchPosition: (current: number, total: number): string => `${current} de ${total}`,
  firstMatchesNote: ' (Primeras coincidencias)',
  highlightsCappedNote: ' (Resaltados limitados)',
  searchingSuffix: (pct: number): string => ` (buscando ${pct}%)`,
  searchingRemote: 'Buscando…',
  filteringRemote: 'Filtrando…',
  searchFailed: 'La búsqueda falló',
  filterFailed: 'El filtro falló',
  linesMatched: (n: number, capped: boolean): string =>
    `${n.toLocaleString()} línea${n === 1 ? '' : 's'}${capped ? ' (limitado)' : ''}`,

  // ── Console Monitor / analytics modal (console-analytics-modal.ts) ────────────────────
  monitorTitle: 'Monitor de consola',
  noRecognizedIssues: 'No hay problemas de BrightScript reconocidos. 🎉',
  sectionCrashes: 'Fallos',
  sectionIssues: 'Problemas',
  labelWhat: 'Qué',
  labelCause: 'Causa',
  labelFix: 'Solución',
  docsLink: 'docs ↗',
  copyMessageTitle: 'Copiar mensaje',
  copyMessageAria: 'Copiar mensaje de error',
  goToLineTitle: 'Ir a esta línea en el registro',
  goToCrashTitle: 'Ir a este fallo en el registro',
  copyCrashTitle: 'Copiar fallo + rastreo',
  copyCrashAria: 'Copiar fallo y rastreo',
  backtraceHead: 'Rastreo',
  noBacktrace:
    'El canal se cerró por un fallo de BrightScript; no se capturó ningún rastreo en esta salida de consola.',
  crashKindLabel: 'Fallo',
  // Crash severity badge (rendered uppercase via CSS; kept lowercase to mirror the data-driven
  // severity tokens on the non-crash issue badges).
  severityCrash: 'fallo',
  // Crash card annotations: "exited" badge and inline "runtime error <code>" (both lowercase; the
  // badge is uppercased by CSS, the code annotation reads inline).
  exitedLabel: 'finalizado',
  exitedTitle: 'El proceso del canal finalizó',
  runtimeErrorLabel: 'error de ejecución',
  crashCount: (n: number): string => `${n.toLocaleString()} fallo${n === 1 ? '' : 's'}`,
  issuesAcrossLines: (issues: number, lines: number): string =>
    `${issues.toLocaleString()} problema${issues === 1 ? '' : 's'} en ${lines.toLocaleString()} línea${lines === 1 ? '' : 's'}`,
  spillNote: (total: number): string =>
    `(de ${total.toLocaleString()} capturadas — las líneas más antiguas volcadas al disco no se analizan)`,
  occurrences: (n: number): string => `Ocurrencia${n === 1 ? '' : 's'}`,
  moreUniqueLines: (n: number): string =>
    `+${n.toLocaleString()} línea${n === 1 ? '' : 's'} única${n === 1 ? '' : 's'} más`,

  // ── BrightScript error catalog (brightscript-error-catalog.ts) ────────────────────────
  // Copia localizable de cada entrada del catálogo, indexada por el `id` de la entrada.
  // Los tokens técnicos de BrightScript/Roku se mantienen tal cual.
  errors: {
    'type-mismatch': {
      title: 'Discrepancia de tipos',
      meaning: 'Se aplicó un operador a valores de tipos incompatibles.',
      cause: 'Comparar o combinar tipos que no coinciden (por ejemplo, String vs Integer), o tratar una variable sin inicializar como el tipo equivocado.',
      fix: 'Convierta con Str()/Val()/ToStr() para que ambos operandos compartan un tipo. Roku OS 10.5+ nombra el operador y ambos tipos en el mensaje.',
    },
    'dot-on-invalid': {
      title: 'Operador "punto" en un objeto invalid',
      meaning: 'Se usó `.` para leer un miembro/campo en un valor que es invalid o que no es un componente/interfaz.',
      cause: 'El objeto nunca se creó o una búsqueda devolvió invalid — por ejemplo, `m.top.findNode("x").text` donde findNode devolvió invalid.',
      fix: 'Verifique que no sea nulo antes de aplicar el punto (`if node <> invalid`); confirme que el objeto existe y que el nombre del miembro es correcto.',
    },
    'for-each-non-enumerable': {
      title: 'FOR EACH en un valor no enumerable',
      meaning: 'Se ejecutó `for each` sobre un valor que es invalid o que no es un objeto enumerable.',
      cause: 'Iterar el resultado de una función que devolvió invalid (una clave de AA faltante, un GetChildElements()/GetBody() vacío), o un escalar/nodo.',
      fix: 'Verifique nulo/tipo antes del bucle; solo enumere roArray, roList, roAssociativeArray o roMessagePort (tipos con ifEnum).',
    },
    'call-on-non-function': {
      title: 'Operador de llamada ( ) en algo que no es una función',
      meaning: 'El código intentó invocar `()` en un valor que no es una función.',
      cause: 'Una variable ocultó una función, el nombre está mal escrito/no declarado, o el valor es invalid/datos en lugar de una función.',
      fix: 'Verifique que el identificador sea una función definida; revise colisiones de nombres y valores invalid antes de llamar.',
    },
    'uninitialized-variable': {
      title: 'Uso de una variable sin inicializar',
      meaning: 'Se leyó una variable antes de asignarle un valor.',
      cause: 'Un nombre de variable mal escrito, una variable declarada solo en otro ámbito, o una ruta condicional que omitió la asignación.',
      fix: 'Inicialice antes de usar; revise la ortografía y el ámbito; el depurador muestra estas variables locales como `<uninitialized>`.',
    },
    'uninitialized-function-ref': {
      title: 'Referencia de función sin inicializar',
      meaning: 'Se llamó a través de una variable de función que no contiene ninguna función.',
      cause: 'Un puntero de función nunca se asignó, o se estableció en invalid.',
      fix: 'Asigne una referencia de función válida antes de invocarla.',
    },
    'invalid-left-side': {
      title: 'Lado izquierdo de expresión no válido',
      meaning: 'El destino de una asignación no es algo a lo que se pueda asignar.',
      cause: 'Asignar a un literal o expresión en lugar de a una variable o campo de objeto.',
      fix: 'Asigne solo a una variable o a un campo de objeto.',
    },
    'divide-by-zero': {
      title: 'División por cero',
      meaning: 'Una división o MOD usó un denominador cero en tiempo de ejecución.',
      cause: 'Una variable divisor evaluó a 0 (o a invalid, forzada a 0).',
      fix: 'Proteja los denominadores antes de dividir (`if d <> 0`).',
    },
    'array-out-of-bounds': {
      title: 'Subíndice de arreglo fuera de límites',
      meaning: 'Se leyó o escribió más allá del final de (o con un índice negativo en) un arreglo.',
      cause: 'Límites de bucle con error de uno; indexar un arreglo vacío o más corto.',
      fix: 'Verifique `arr.count()` antes de indexar; valide los límites del bucle.',
    },
    'array-not-dimd': {
      title: "Operación de arreglo en una variable sin DIM",
      meaning: 'Se indexó una variable que nunca se creó como arreglo.',
      cause: 'Usar `[]` en un escalar o en invalid.',
      fix: 'Inicialice el arreglo (`arr = []`) antes de indexarlo.',
    },
    'non-numeric-array-index': {
      title: 'Índice de arreglo no numérico',
      meaning: 'Se usó una cadena/objeto como índice en un roArray.',
      cause: 'Confundir un roArray con un roAssociativeArray.',
      fix: 'Use un AA para claves de cadena, o un índice numérico para arreglos.',
    },
    'invalid-num-array-indexes': {
      title: 'Número de índices de arreglo no válido',
      meaning: 'Se usó una dimensionalidad incorrecta para indexar un arreglo.',
      cause: 'Usar `a[i,j]` en un arreglo de 1 dimensión (o viceversa).',
      fix: 'Haga coincidir la cantidad de índices con las dimensiones declaradas del arreglo.',
    },
    'wrong-num-params': {
      title: 'Número incorrecto de parámetros de función',
      meaning: 'Se llamó a una función con muy pocos o demasiados argumentos.',
      cause: 'Una firma modificada, o un parámetro opcional sin valor predeterminado.',
      fix: 'Haga coincidir la llamada con la firma; dé valores predeterminados a los parámetros opcionales.',
    },
    'bad-throw': {
      title: 'Argumento de throw no válido',
      meaning: 'A un `throw` se le pasó algo que no es una cadena ni un AA de error válido.',
      cause: 'Lanzar un número/objeto que carece de campos `number`/`message` válidos.',
      fix: 'Lance una cadena, o un AA con campos `number` Integer y `message` String.',
    },
    'user-thrown-exception': {
      title: 'Excepción de usuario no capturada (THROW)',
      meaning: 'Un `throw` se propagó hasta el nivel superior sin ser capturado, terminando el script.',
      cause: 'Un `throw "…"` (o `throw {message: …}`) sin un `try/catch` que lo maneje.',
      fix: 'Envuelva la llamada que lanza en `try/catch` (Roku OS 9.4+) e inspeccione `e.number`/`e.message`/`e.backtrace`.',
    },
    'invalid-format-specifier': {
      title: 'Especificador de formato no válido',
      meaning: 'Se pasó un especificador incorrecto a una función de formato.',
      cause: 'Un token con formato incorrecto estilo Format()/printf.',
      fix: 'Corrija la cadena de formato.',
    },
    'invalid-param': {
      title: 'Parámetro no válido pasado a función/arreglo',
      meaning: 'Una función integrada recibió un argumento fuera de dominio (por ejemplo, sqrt de un negativo, una dimensión negativa).',
      cause: 'Un dominio matemático incorrecto o una dimensión de arreglo negativa.',
      fix: 'Valide los argumentos antes de la llamada.',
    },
    'member-fn-not-found': {
      title: 'Función miembro no encontrada',
      meaning: 'Se llamó a un método que el componente o la interfaz no expone.',
      cause: 'Un nombre de método mal escrito, llamar sobre invalid, el tipo de componente equivocado, o un método ausente en esa versión de firmware.',
      fix: 'Confirme que el método existe para ese objeto/OS; proteja los objetos invalid antes de llamar.',
    },
    'interface-not-member': {
      title: 'La interfaz no es miembro del componente',
      meaning: 'Se solicitó una interfaz que el componente no implementa.',
      cause: 'Una llamada a GetInterface() para una interfaz que el objeto no tiene, o el nombre de interfaz equivocado.',
      fix: 'Use una interfaz que el componente realmente exponga.',
    },
    'component-class-not-found': {
      title: 'Clase de componente / nodo no encontrada',
      meaning: 'CreateObject / createChild usó una clase o tipo de nodo que no existe.',
      cause: 'Una cadena de tipo mal escrita o con mayúsculas/minúsculas incorrectas, o un componente no declarado/registrado en el paquete.',
      fix: 'Corrija la cadena de tipo (distingue mayúsculas/minúsculas); asegúrese de que el XML del componente esté incluido en el canal.',
    },
    'sg-field-type-mismatch': {
      title: 'Discrepancia de tipo de campo de SceneGraph',
      meaning: 'Un valor asignado a un campo de nodo no coincidió con el tipo declarado del campo.',
      cause: 'Asignar, por ejemplo, un String a un campo int/uri, o un Array a un campo assocarray mediante setField/addReplace.',
      fix: 'Asigne un valor que coincida con el tipo de interfaz declarado del campo, o corrija el tipo del campo en el XML del componente.',
    },
    'sg-nonexistent-field': {
      title: 'Establecer un campo de SceneGraph inexistente',
      meaning: 'Se asignó a un campo de nodo que el tipo de nodo no declara (se ignora silenciosamente).',
      cause: 'Un nombre de campo mal escrito, o un campo no definido en el `<interface>` del XML del componente.',
      fix: 'Use un nombre de campo declarado (distingue mayúsculas/minúsculas), o agregue el campo a la interfaz del XML del componente.',
    },
    'component-call-arg-count': {
      title: 'La llamada al componente tiene un número de parámetros incorrecto',
      meaning: 'Se llamó a un método integrado de componente con un número incorrecto de argumentos.',
      cause: 'Una cantidad de argumentos que no coincide con la firma del método ifXXX.',
      fix: 'Haga coincidir con la firma documentada del método.',
    },
    'rendezvous-aborted': {
      title: 'Rendezvous abortado',
      meaning: 'Un acceso a nodo entre hilos falló porque el nodo objetivo era invalid o ya no existía.',
      cause: 'Acceder a un nodo propiedad de otro hilo que fue destruido o quedó bloqueado (por ejemplo, un nodo global perdido tras una reproducción larga).',
      fix: 'Evite el trasiego de nodos entre hilos; verifique nulo antes de acceder; perfile con `logrendezvous` / `sgperf`.',
    },
    'rendezvous-block': {
      title: 'Rendezvous de SceneGraph (bloqueo de hilos)',
      meaning: 'Un punto de sincronización entre el hilo de renderizado y el hilo de tarea; los frecuentes bloquean el hilo de renderizado.',
      cause: 'Un hilo Task que lee/escribe campos de nodo del hilo de renderizado uno a la vez.',
      fix: 'Agrupe el acceso a campos con getFields/setFields; minimice el acceso a nodos entre hilos.',
    },
    'execution-timeout': {
      title: 'Tiempo de ejecución agotado (el script tardó demasiado)',
      meaning: 'El código se ejecutó demasiado tiempo en un hilo (el hilo de renderizado tiene un límite de varios segundos).',
      cause: 'Bucles pesados, análisis de JSON grandes, o E/S síncrona en el hilo de renderizado o en un hilo Task.',
      fix: 'Mueva el trabajo pesado a un nodo Task; divida en fragmentos o haga asíncrono el trabajo.',
    },
    'too-many-task-threads': {
      title: 'Demasiados hilos de tarea',
      meaning: 'Se superó el límite de hilos Task concurrentes.',
      cause: 'Crear nodos Task en un bucle sin reutilización ni limpieza.',
      fix: 'Reutilice/agrupe nodos Task; limite la concurrencia; deje que las tareas terminen.',
    },
    'wait-on-non-port': {
      title: 'Esperar en un objeto sin puerto de mensajes',
      meaning: 'Se llamó a `wait()` en un objeto que carece de ifMessagePort.',
      cause: 'Esperar en el objeto equivocado en lugar de en un roMessagePort.',
      fix: 'Espere solo en un roMessagePort.',
    },
    'formatjson-nested': {
      title: 'Referencia anidada/cíclica en FormatJSON',
      meaning: 'FormatJSON falló por una referencia circular o un anidamiento de más de 256 niveles.',
      cause: 'Un grafo de objetos cíclico, o un tipo de valor no admitido (por ejemplo, un roList) en el árbol.',
      fix: 'Rompa los ciclos de referencia; mantenga el anidamiento por debajo de 256; serialice solo tipos admitidos (AA, array, string, number, boolean).',
    },
    'parsejson-failed': {
      title: 'ParseJSON falló',
      meaning: 'ParseJSON no pudo analizar la cadena de entrada (devuelve invalid).',
      cause: 'Entrada vacía/en blanco (por ejemplo, un cuerpo de respuesta HTTP vacío), JSON con formato incorrecto, o un argumento que no es cadena.',
      fix: 'Proteja contra entrada vacía/no válida antes de ParseJSON; verifique la fuente (revise primero el cuerpo/longitud HTTP).',
    },
    'file-write-failed': {
      title: 'Falló la escritura del archivo',
      meaning: 'No se pudo abrir un archivo para escritura (WriteAsciiFile / roCreateFile).',
      cause: 'Escribir fuera de una ubicación con permiso de escritura — solo `tmp:/` y `cachefs:/` son escribibles (`pkg:/` es de solo lectura) — o un directorio faltante / disco lleno.',
      fix: 'Escriba solo en `tmp:/` o `cachefs:/`; asegúrese de que la ruta principal exista.',
    },
    'stack-overflow': {
      title: 'Desbordamiento de pila',
      meaning: 'Se agotó la pila de llamadas.',
      cause: 'Recursión sin límite o muy profunda (Roku se desborda tras ~31 llamadas anidadas).',
      fix: 'Agregue un caso base; convierta la recursión profunda en iteración.',
    },
    'out-of-memory': {
      title: 'Sin memoria',
      meaning: 'Falló una asignación de memoria; el montón (heap) está agotado.',
      cause: 'Estructuras de datos grandes, fugas, o nodos/texturas retenidos; construcción de cadenas enormes en un bucle.',
      fix: 'Libere referencias, reduzca el tamaño de los datos, reutilice nodos; transmita/divida en fragmentos el trabajo con cadenas grandes.',
    },
    'string-too-long': {
      title: 'Cadena demasiado larga',
      meaning: 'Una cadena superó la longitud máxima.',
      cause: 'Concatenar entrada sin límite.',
      fix: 'Limite o divida la longitud de la cadena.',
    },
    'syntax-error': {
      title: 'Error de sintaxis',
      meaning: 'El código fuente no se pudo compilar.',
      cause: 'Errores tipográficos, bloques sin equilibrar, o tokens incorrectos.',
      fix: 'Corrija la sintaxis en la línea/columna reportada; compile localmente antes de hacer sideload.',
    },
    'compile-error-generic': {
      title: 'Error de compilación',
      meaning: 'El compilador rechazó una o más líneas antes de que la app se ejecutara.',
      cause: 'Un error tipográfico, una palabra clave faltante, o una expresión con formato incorrecto.',
      fix: 'Corrija cada `line N:` reportada en el archivo indicado.',
    },
    'unterminated-block': {
      title: 'Bloque sin terminar',
      meaning: 'A un bloque de control (FOR/NEXT, IF/ENDIF, WHILE/ENDWHILE) le falta su palabra clave de cierre.',
      cause: 'Un `end if` / `next` / `end while` faltante o descoordinado.',
      fix: 'Equilibre cada palabra clave de apertura de bloque con su cierre correspondiente.',
    },
    'xml-parse-error': {
      title: 'Error de análisis de componente XML',
      meaning: 'Un archivo de componente XML de SceneGraph no se pudo analizar o tiene un defecto.',
      cause: 'Marcado con formato incorrecto, una etiqueta incorrecta, o una referencia incorrecta de campo/interfaz/script en el componente.',
      fix: 'Valide el marcado .xml y corrija la definición del componente.',
    },
    'no-manifest': {
      title: 'Sin manifest — paquete no válido',
      meaning: 'El zip cargado por sideload carece de un manifest válido.',
      cause: 'El manifest falta o no está en la raíz del archivo comprimido.',
      fix: 'Coloque un archivo `manifest` válido en la raíz del zip.',
    },
    'unused-variable': {
      title: 'Variable sin usar',
      meaning: 'Una variable declarada — a menudo un parámetro de función o de manejador de eventos — nunca se usa.',
      cause: "Un parámetro de manejador (`msg`/`event`/`field`) o una variable local que el cuerpo de la función nunca referencia.",
      fix: 'Elimínela si realmente no se usa; es inofensiva para publicar. Los parámetros requeridos por la firma del callback pueden dejarse como están.',
    },
    'brightscript-warning': {
      title: 'Advertencia de BrightScript',
      meaning: 'El compilador de BrightScript emitió una advertencia no fatal.',
      cause: 'Un problema de nivel lint (código sin usar, un patrón obsoleto) que no detiene la ejecución.',
      fix: 'Revise la función/archivo indicado — las advertencias son seguras de ejecutar, pero a menudo señalan código muerto o errores.',
    },
    'http-unsupported-protocol': {
      title: 'Protocolo no admitido (-1)',
      meaning: 'El esquema de la URL no es compatible con la transferencia.',
      cause: 'Una URL con formato incorrecto o un esquema equivocado.',
      fix: 'Use una URL http(s):// compatible.',
    },
    'http-resolve-host': {
      title: 'No se pudo resolver el host (-6)',
      meaning: 'Falló la resolución DNS del host de la solicitud.',
      cause: 'Un nombre de host incorrecto, sin red, o una caída de DNS.',
      fix: 'Verifique la URL/host y la conectividad de red.',
    },
    'http-connect': {
      title: 'No se pudo conectar (-7)',
      meaning: 'Falló la conexión TCP con el host/proxy.',
      cause: 'Servidor caído, puerto equivocado, o un firewall.',
      fix: 'Verifique la disponibilidad del endpoint/puerto.',
    },
    'http-timeout': {
      title: 'La solicitud HTTP agotó el tiempo de espera (-28)',
      meaning: 'La solicitud superó su tiempo de espera.',
      cause: 'Un servidor lento o inalcanzable, o un tiempo de espera demasiado corto.',
      fix: 'Aumente el tiempo de espera; reintente; verifique el servidor.',
    },
    'http-ssl-peer': {
      title: 'Falló la verificación del par SSL (-51)',
      meaning: 'El certificado TLS del servidor no se validó.',
      cause: 'Un certificado expirado, autofirmado, o que no coincide.',
      fix: 'Corrija la cadena de certificados; solo desactive EnablePeerVerification(false) para pruebas.',
    },
    'http-ca-cert': {
      title: 'Archivo de certificado CA incorrecto/faltante (-77)',
      meaning: 'No se pudo cargar el paquete de CA.',
      cause: 'Una ruta de SetCertificatesFile faltante o incorrecta.',
      fix: 'Establezca `common:/certs/ca-bundle.crt` y llame a InitClientCertificates().',
    },
    'deploy-update-check-required': {
      title: 'El dispositivo necesita buscar actualizaciones',
      meaning: 'El dispositivo rechaza conexiones hasta que busque una actualización del sistema.',
      cause: 'Búsqueda de actualización de firmware de Roku pendiente.',
      fix: 'En el dispositivo: Settings → System → System update → Check now.',
    },
    'deploy-unauthorized': {
      title: 'No autorizado (contraseña de desarrollador incorrecta)',
      meaning: 'El servidor de desarrollo rechazó las credenciales.',
      cause: 'Una contraseña de desarrollador incorrecta, o el modo de desarrollador está desactivado.',
      fix: 'Establezca la contraseña correcta; active el modo de desarrollador en el dispositivo.',
    },
    'deploy-connection-reset': {
      title: 'Conexión restablecida durante el despliegue',
      meaning: 'El dispositivo cerró el socket a mitad del despliegue.',
      cause: 'El dispositivo está ocupado o necesita una actualización, o una caída de red.',
      fix: 'Reintente; busque actualizaciones; verifique la red.',
    },
    'stop-statement': {
      title: 'Se alcanzó una instrucción STOP',
      meaning: 'La ejecución se pausó porque una instrucción `stop` llevó la app al Micro Debugger.',
      cause: 'Una instrucción de depuración `stop` olvidada en el código.',
      fix: 'Elimine `stop` antes de la publicación; use `continue`/`step` para reanudar.',
    },
    'cant-continue': {
      title: 'No se puede continuar',
      meaning: 'El depurador no puede reanudar — el hilo murió en un error fatal.',
      cause: 'Un error de ejecución irrecuperable, o el hilo finalizó.',
      fix: 'Reinicie el canal y corrija la línea que falla (vea el rastreo arriba).',
    },
    'console-in-use': {
      title: 'La conexión de consola ya está en uso',
      meaning: 'El puerto de depuración telnet (8085) ya está ocupado por otro cliente.',
      cause: 'Hay una segunda sesión de depurador/telnet abierta al dispositivo.',
      fix: 'Cierre otras sesiones de telnet/VS Code hacia el dispositivo.',
    },
    'app-crash-exit': {
      title: 'El canal se cerró por un fallo de BrightScript',
      meaning: 'El proceso del canal terminó porque un hilo de BrightScript falló (un error de ejecución no capturado).',
      cause: 'Un error de ejecución no capturado en un hilo sin manejador.',
      fix: 'Vea el fallo + rastreo en el Monitor de consola; proteja la llamada que falla con try/catch o corrija la línea que falla.',
    },
  },

  // Valores de categoría distintos del catálogo (BrsErrorCategory). Etiquetas cortas traducidas.
  errorCategories: {
    'Type/Runtime': 'Tipo/Ejecución',
    'SceneGraph/Component': 'SceneGraph/Componente',
    'Threading/Rendezvous': 'Hilos/Rendezvous',
    'JSON': 'JSON',
    'Memory': 'Memoria',
    'Syntax/Compile': 'Sintaxis/Compilación',
    'Network/HTTP': 'Red/HTTP',
    'Deploy': 'Despliegue',
    'Debugger': 'Depurador',
    'Other': 'Otro',
  },
};
