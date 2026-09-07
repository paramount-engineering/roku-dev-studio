/**
 * Latin American Spanish (neutral) translation of the global modals catalog.
 * Mirrors the exact shape of shared/strings/modals.ts — same keys, order, and
 * function signatures/placeholders. Only literal display text is translated.
 */
export const modals = {
  // Release Notes modal
  releaseNotes: 'Notas de la versión',
  versionedReleaseNotes: (title: string): string => `${title} · Notas de la versión`,
  openReleasePage: 'Abrir página de la versión',
  loadingReleaseNotes: 'Cargando notas de la versión…',
  noReleaseNotes: 'No se proporcionaron notas para esta versión.',
  couldNotLoadReleaseNotes: 'No se pudieron cargar las notas de la versión en este momento.',
  latestRelease: 'Última versión',
  unknownError: 'Error desconocido',

  // Update banner — update available
  updateAvailableTitle: (version?: string): string =>
    `Roku Dev Studio ${version ? `v${version}` : 'actualización'} disponible`,
  newVersionReady: 'Hay una nueva versión lista para descargar.',
  dismissUpdateNotification: 'Descartar notificación de actualización',
  later: 'Más tarde',
  download: 'Descargar',

  // Update banner — downloading
  downloadingUpdate: 'Descargando actualización…',
  pleaseWaitDownloading: 'Espere mientras se descarga la actualización.',

  // Update banner — ready to install
  updateReadyTitle: (version?: string): string =>
    `Roku Dev Studio ${version ? `v${version}` : 'actualización'} lista`,
  installedOnRestart: 'Se instalará al reiniciar.',
  restartAndInstall: 'Reiniciar e instalar',

  // Update banner — manual download / error
  newUpdateAvailable: 'Nueva actualización disponible',
  pleaseDownloadLatest: 'Descargue la última versión para actualizar.',
  dismiss: 'Descartar',
  updateError: 'Error de actualización',
  updateCheckFailed: 'Falló la búsqueda de actualizaciones.',

  // "Check for Updates" — no update found toast
  upToDate: (version?: string): string => `Está actualizado${version ? ` (v${version})` : ''}.`,

  // Welcome-screen feature detail modals — longer blurb + capability bullets per tile.
  // (Keyed by the feature title so the component can look each up by the tile's live title.)
  features: {
    deviceDiscovery: {
      blurb:
        'Roku Dev Studio analiza continuamente su red local con SSDP para que cada Roku en la misma subred aparezca automáticamente, sin necesidad de escribir la IP.',
      points: [
        'Detecta automáticamente modelos, nombres y direcciones IP de Roku',
        'Indica qué dispositivos tienen el Modo de desarrollador activado',
        'Se actualiza a medida que los dispositivos entran o salen de la red',
        'Un clic para conectarse y empezar a trabajar',
      ],
    },
    appsDeepLinking: {
      blurb:
        'Explore cada canal instalado en el Roku conectado, inicie cualquiera de ellos al instante y pruebe Deep-Links con parámetros personalizados de contenido y tipo de medio.',
      points: [
        'Cuadrícula de apps instaladas (más entradas de TV en Roku TVs)',
        'Inicie desde la cuadrícula o por ID de app',
        'Deep-link con contentId / mediaType para probar el inicio de contenido',
        'Copie una lista sin procesar de ID + versión de todo lo instalado',
      ],
    },
    devApp: {
      blurb:
        'Realice sideload, controle e inspeccione su canal de desarrollo de principio a fin, desde la subida de un zip hasta capturas de pantalla en vivo de lo que está en pantalla.',
      points: [
        'Realice sideload de un canal de desarrollo .zip con su contraseña de desarrollador',
        'Inicie o elimine la app cargada por sideload',
        'Capture pantallas a demanda o de forma automática',
        'Copie, descargue o borre las imágenes capturadas',
      ],
    },
    appConnector: {
      blurb:
        'Llame funciones de BrightScript en su canal cargado por sideload de forma remota y vea sus valores de retorno; ejercite rutas de código sin tocar el control remoto.',
      points: [
        'Invoque funciones exportadas por nombre con argumentos',
        'Inspeccione los valores devueltos en línea',
        'Se ejecuta contra el canal de desarrollo en vivo',
      ],
    },
    fiddle: {
      blurb:
        'Un bloc de pruebas para BrightScript: escriba fragmentos en un editor Monaco completo y ejecútelos en un dispositivo conectado con linting en vivo.',
      points: [
        'Editor Monaco con resaltado de sintaxis',
        'Comentarios de lint en vivo mientras escribe',
        'Ejecución con un clic en el Roku conectado',
        'Se abre en su propia ventana dedicada',
      ],
    },
    mcpServer: {
      blurb:
        'Exponga Roku Dev Studio a agentes de IA a través del Model Context Protocol, para que los asistentes puedan controlar su dispositivo dentro de su ciclo de desarrollo.',
      points: [
        'Inicie apps, presione teclas y capture pantallas mediante las herramientas MCP',
        'Consulte el estado del dispositivo mediante programación',
        'Integre agentes de IA en su flujo de prueba y depuración',
      ],
    },
    deviceRemote: {
      blurb:
        'Un control remoto Roku completo en pantalla: cada botón del control remoto físico, más control por teclado y entrada de texto.',
      points: [
        'D-pad, OK, Atrás, Inicio, Opciones y Repetición',
        'Transporte de medios: reproducir/pausar, retroceder, avanzar',
        'Volumen, silencio y encendido',
        'Escriba texto directamente en los campos del dispositivo',
      ],
    },
    query: {
      blurb:
        'Lea el estado en vivo del Roku a través de ECP (External Control Protocol): información del dispositivo, estado del reproductor de medios, apps instaladas y el registro.',
      points: [
        'Información del dispositivo: modelo, versión y red',
        'App activa y estado de reproducción del reproductor de medios',
        'Lista de apps instaladas',
        'Contenido del registro',
      ],
    },
    console: {
      blurb:
        'Transmita en vivo la salida de depuración de BrightScript del Roku a través de Telnet, con filtrado y búsqueda para mostrar exactamente lo que importa, y adjunte un depurador completo de BrightScript cuando necesite recorrer el código paso a paso.',
      points: [
        'Flujo de registro en vivo por Telnet',
        'Filtro y búsqueda de texto completo',
        'Haga clic en URL/JSON/XML para verlos con formato en una ventana modal',
        'Guarde el registro en un archivo',
        'Adjunte un depurador: puntos de interrupción, variables, pila de llamadas y REPL',
      ],
    },
    actionScripts: {
      blurb:
        'Automatice flujos repetibles del dispositivo encadenando pulsaciones de teclas, inicios de apps y llamadas RALE en un único script ejecutable.',
      points: [
        'Secuencie pulsaciones de teclas, inicios y esperas',
        'Incluya llamadas RALE en el flujo',
        'Vuelva a ejecutar flujos para pruebas de regresión',
      ],
    },
    networkInspector: {
      blurb:
        'Capture e inspeccione el tráfico HTTP/HTTPS de la Dev App a través de un proxy MITM integrado, como la pestaña de red de un navegador para su canal.',
      points: [
        'Vea cada solicitud y respuesta que hace el canal',
        'Inspeccione encabezados, cuerpos y tiempos',
        'Descifre HTTPS mediante el proxy MITM',
        'Agrupe por host o vea las sesiones a través del proxy',
      ],
    },
    remoteLocations: {
      blurb:
        'Conéctese a dispositivos Roku que no están en su red local enrutando a través de servidores de relé.',
      points: [
        'Alcance dispositivos en cualquier lugar mediante un servidor de relé',
        'Administre varias ubicaciones remotas',
        'Las mismas herramientas que para los dispositivos locales',
      ],
    },
  },

  // ── Global modal fragments (renderer/components/modals/fragments/*.html) ──
  // One sub-group per fragment. Only elements whose visible text is a single
  // text node (pure text, icon + label, or a pure-text child span) are keyed —
  // applyI18n's mixed-content path replaces just the first text node, so prose
  // with inline <strong>/<code>/<em>/<a>/kbd markup is intentionally NOT keyed
  // and keeps its inline English. Generic buttons reuse common.* (cancel, save,
  // add, clear, close).

  addLocation: {
    title: '🌐 Agregar ubicación remota',
    intro:
      'Conéctese a dispositivos Roku en una ubicación remota a través del Roku Relay Server que se ejecuta en una Mac Mini u otra computadora.',
    nameLabel: 'Nombre de la ubicación',
    namePlaceholder: 'p. ej., Laboratorio de oficina, Estudio B',
    nameHint: 'Un nombre descriptivo para identificar esta ubicación',
    hostLabel: 'Dirección del servidor',
    hostPlaceholder: '192.168.1.50 o mac-mini.local',
    hostHint: 'Dirección IP o nombre de host del Relay Server',
    portLabel: 'Puerto',
    portHint: 'El puerto predeterminado es 4951',
    addBtn: 'Agregar ubicación',
  },

  actionScriptsImport: {
    title: 'Importar Action Script',
    uploadJsonLabel: 'Subir JSON',
    chooseFileBtn: 'Elegir archivo',
    savedScriptLabel: 'Scripts guardados',
    savedSelectPlaceholder: 'Seleccione un Action Script guardado',
    savedSelectEmpty: 'No hay scripts guardados',
    pasteJsonLabel: 'Pegar o editar JSON',
    outputFolderLabel: 'Carpeta de salida',
    noFolderSelected: 'Ninguna carpeta seleccionada',
    chooseFolderBtn: 'Elegir carpeta',
    outputWarning:
      'Si no se selecciona ninguna carpeta, los artefactos (p. ej., capturas de pantalla) no se guardarán al ejecutar el script.',
    devPasswordRequiredMsg: 'Este script requiere una contraseña de desarrollador. Ingrésela a continuación.',
    devPasswordLabel: 'Contraseña de desarrollador',
    devPasswordPlaceholder: 'Ingrese la contraseña de desarrollador para los pasos de captura / sideload',
    rememberPasswordTitle: 'Guardar la contraseña de este dispositivo (igual que el almacenamiento de contraseñas de la Dev App)',
    rememberPasswordLabel: 'Recordar la contraseña de este dispositivo',
    devPasswordHintHtml:
      'Obligatoria cuando el script tiene pasos de captura de pantalla o sideload y no incluye un campo <code>devPassword</code>.',
    validateImportBtn: 'Validar e importar',
  },

  deeplinkDeleteMediaType: {
    title: 'Eliminar tipo de medio',
    confirmHint: '¿Eliminar el tipo de medio y estos Deep-Links guardados?',
    deleteAllBtn: 'Eliminar todo',
  },

  deeplinkMediaTypes: {
    title: 'Administrar tipos de medio',
    hint: 'Los tipos de medio integrados siempre están disponibles. Las entradas personalizadas se guardan globalmente y aparecen en la pestaña de cada dispositivo.',
    builtinTitle: 'Integrados',
    builtinMovie: 'Película',
    builtinSeries: 'Serie',
    builtinEpisode: 'Episodio',
    builtinLive: 'En vivo',
    customTitle: 'Personalizado',
    addTitle: 'Agregar tipo de medio',
    displayNameLabel: 'Nombre para mostrar',
    displayNamePlaceholder: 'p. ej., Cortometraje',
    ecpValueLabel: 'Valor ECP',
    ecpValuePlaceholder: 'p. ej., short-film',
  },

  deeplinkSavePreset: {
    title: 'Guardar Deep-Link',
    hint: 'Asigne un nombre a este Deep-Link para poder elegirlo de la lista guardada en cualquier dispositivo.',
    nameLabel: 'Nombre',
    namePlaceholder: 'p. ej., Netflix · Episodio 12',
  },

  devMode: {
    title: 'Activar el Modo de desarrollador en Roku',
    whatIsHeading: '¿Qué es el Modo de desarrollador?',
    whatIsBody:
      'El Modo de desarrollador le permite hacer sideload y probar sus propios canales de Roku directamente en su dispositivo. Su activación es gratuita y le da acceso a potentes herramientas de desarrollo.',
    stepsHeading: 'Pasos para activar el Modo de desarrollador',
    pressSequenceHtml:
      'En su control remoto de Roku, presione: <span class="help-kbd">Home</span> <span class="help-kbd">Home</span> <span class="help-kbd">Home</span> <span class="help-kbd">Up</span> <span class="help-kbd">Up</span> <span class="help-kbd">Right</span> <span class="help-kbd">Left</span> <span class="help-kbd">Right</span> <span class="help-kbd">Left</span> <span class="help-kbd">Right</span>',
    step2: 'Aparecerá un cuadro de diálogo de Configuración de desarrollador en su TV',
    step3Html: 'Seleccione <strong>"Enable installer and restart"</strong>',
    step4: 'Acepte el Acuerdo de licencia del SDK para desarrolladores',
    step5Html: `Establezca una <strong>contraseña del servidor web</strong> (la necesitará para el sideload)`,
    step6: 'Su Roku se reiniciará con el Modo de desarrollador activado',
    afterHeading: 'Después de activarlo',
    afterIntro: 'Una vez que el Modo de desarrollador esté activado:',
    afterBadgeHtml:
      'Su dispositivo mostrará una insignia <span class="dev-badge enabled" style="font-size: 11px;"><span class="icon icon-xs"><svg><use href="#icon-wrench"/></svg></span> Dev</span> en la lista de dispositivos',
    afterSideloadHtml: 'Puede hacer sideload de paquetes de canal .zip mediante la pestaña <strong>Dev App</strong>',
    afterAppConnectorHtml: 'Use el <strong>App Connector</strong> para comunicarse con el código de su canal',
    afterQueryHtml: 'Acceda a consultas ECP adicionales en la pestaña <strong>Consulta</strong>',
    moreHeading: 'Más información',
    moreBody: 'Para documentación detallada, visite la documentación oficial para desarrolladores de Roku:',
  },

  ecpMode: {
    title: 'Control mediante apps móviles en Roku',
    whyHeading: '¿Por qué se necesita esto?',
    whyBodyHtml:
      'La funcionalidad del control remoto (pulsación de teclas, apps, Control remoto rápido, Enviar texto) usa el External Control Protocol (ECP) de Roku. La configuración del dispositivo <strong>Control by Mobile Apps → Network Access</strong> puede establecerse en uno de cuatro modos:',
    modeDisabledHtml: '<strong>Disabled</strong> – El control mediante apps móviles está desactivado.',
    modeLimitedHtml:
      '<strong>Limited</strong> – Solo entrada de texto, inicios de apps y consulta de la app activa; habilitado en direcciones de red privada.',
    modePermissiveHtml:
      '<strong>Permissive</strong> – Control completo; acepta comandos solo desde la red privada o la misma subred.',
    modeEnabledHtml: '<strong>Enabled</strong> – Control completo; habilitado en direcciones de red privada.',
    howHeading: 'Cómo cambiar la configuración',
    step1Html: 'En su dispositivo Roku, vaya a <strong>Settings</strong> → <strong>System</strong>',
    step2Html: 'Abra <strong>Advanced System Settings</strong>',
    step3Html: 'Seleccione <strong>Control by Mobile Apps</strong>',
    step4Html: 'Seleccione <strong>Network Access</strong>',
    step5Html:
      'Elija <strong>Limited</strong>, <strong>Permissive</strong> o <strong>Enabled</strong> (esta app se adapta al modo)',
    afterHeading: 'Después de cambiarla',
    afterBodyHtml:
      'Con <strong>Limited</strong>, Enviar texto, el inicio de apps y la consulta de apps funcionan; la pulsación completa de teclas del control remoto quizás no. Con <strong>Permissive</strong> o <strong>Enabled</strong>, el control remoto completo funciona. Para Permissive, asegúrese de que este equipo esté en la misma subred que el Roku si los comandos fallan. No se requiere reiniciar después de cambiar la configuración.',
  },

  keyboardRemoteHelp: {
    title: 'Control remoto por teclado',
    introHtml:
      'Los atajos se aplican solo mientras esta pestaña de dispositivo está en la pestaña <strong>Remoto</strong> o en la pestaña <strong>Dev App</strong>.',
    tableCaption: 'Atajos asignados al control remoto de Roku',
    colKey: 'Tecla',
    colAction: 'Acción del control remoto',
    actionNavigate: 'Navegar (arriba, abajo, izquierda, derecha)',
    actionSelect: 'Seleccionar / OK',
    actionBack: 'Atrás',
    actionHome: 'Inicio',
    actionPlayPause: 'Reproducir / pausar',
    actionRewind: 'Retroceder',
    actionForward: 'Avanzar',
    actionOptions: 'Opciones (información)',
    actionReplay: 'Repetición instantánea',
    actionVolumeUp: 'Subir volumen',
    actionVolumeDown: 'Bajar volumen',
    actionMute: 'Silenciar',
    actionPower: 'Encendido',
    footnote:
      'Desactive el Control remoto por teclado en <button type="button" class="help-settings-link" data-settings-section="general" data-settings-highlight="keyboardRemoteSettingsRow">Configuración</button> si no desea que las teclas de flecha y otras teclas asignadas envíen pulsaciones a Roku.',
  },

  secretScreens: {
    title: 'Pantallas secretas de Roku',
    introHtml: `
            Los dispositivos Roku tienen menús integrados de diagnóstico y desarrollo accesibles mediante secuencias de botones del control remoto.
            Desde la pantalla de <strong>Inicio</strong> de Roku, presione los botones que se muestran en cada fila con un
            <strong>control remoto físico</strong> (control remoto por IR o por voz).
          `,
    ecpLimitationTitle: 'Limitación de ECP',
    ecpLimitationBodyHtml: `
              Roku no interpreta de forma confiable todas las secuencias de pantallas secretas enviadas por ECP. Si una
              secuencia no se abre mediante <strong>Ejecutar secuencia</strong>, use el <strong>control remoto físico</strong>.
            `,
    sectionTitle: 'Pantallas secretas',
  },

  integrationGuide: {
    title: 'Guía de integración',
    whatIsHeading: '¿Qué es TrackerTask?',
    whatIsBodyHtml: `
            <strong>TrackerTask</strong> es un componente de BrightScript creado originalmente para <strong>RALE (Roku Advanced
              Layout Editor)</strong>:
            la herramienta oficial para desarrolladores de Roku que sirve para inspeccionar y depurar aplicaciones SceneGraph en tiempo real.
          `,
    trackerTaskEnabling:
      'El TrackerTask establece una conexión de socket entre su app de Roku y herramientas externas, lo que permite:',
    enablingPoint1: 'Inspección y modificación de nodos en tiempo real',
    enablingPoint2: 'Vista en vivo de los límites de los elementos de la interfaz',
    enablingPoint3: 'Administración del registro',
    enablingPoint4: 'Registro y depuración',
    extendsBody:
      'El App Connector amplía esta funcionalidad con dos funciones personalizadas que le permiten exponer y ejecutar las funciones personalizadas de BrightScript de su app desde esta herramienta de escritorio.',
    customFunctionsHeading: 'Funciones personalizadas para App Connector',
    customFunctionsBody:
      'Se agregaron dos funciones al TrackerTask para habilitar la funcionalidad de App Connector:',
    implementingHeading: 'Implementación en su Scene',
    implementingBodyHtml: `
            El <strong>MainScene.xml</strong> de su app debe declarar dos funciones de interfaz que el TrackerTask
            llamará:
          `,
    getExternalHeading: 'Implementación de GetExternalControlFunctions',
    getExternalBodyHtml: `
            Esta función debe devolver un <strong>roArray</strong> de arreglos asociativos, donde cada elemento describe una
            función:
          `,
    supportedParamsBodyHtml: `
              <strong>Boolean</strong> · <strong>Integer</strong> · <strong>LongInteger</strong> ·
              <strong>Float</strong> ·
              <strong>Double</strong> · <strong>String</strong> · <strong>roAssociativeArray</strong> ·
              <strong>roArray</strong> · <strong>roList</strong>
            `,
    supportedParamsTitle: '📝 Tipos de parámetro admitidos',
    executeFunctionHeading: 'Implementación de ExecuteFunction',
    executeFunctionBody:
      'Esta función recibe el nombre de la función y el arreglo de parámetros, y luego lo dirige al controlador correspondiente:',
    setupHeading: 'Configuración de TrackerTask',
    setupBody: 'Agregue el componente TrackerTask a su proyecto y cree una instancia en su MainScene:',
    setupPlaceHtml: `
            Coloque el archivo <code>TrackerTask.xml</code> en el directorio <code>components/</code> de su app.
          `,
    saveBtn: 'Guardar TrackerTask.xml',
    copyBtn: 'Copiar información de integración',
  },

  helpModal: {
    title: 'Ayuda y guía del usuario',
    navAriaLabel: 'Secciones de ayuda',
    navDeviceDiscovery: 'Descubrimiento de dispositivos',
    navRemoteControl: 'Control remoto',
    navApps: 'Apps',
    navQuery: 'Consulta',
    navDevApp: 'Dev App',
    navConsole: 'Consola',
    navAppConnector: 'App Connector',
    navActionScripts: 'Action Scripts',
    navDevicePerformance: 'Rendimiento del dispositivo',
    navNetworkInspector: 'Inspector de red',
    navAiAgents: 'Agentes de IA (MCP)',
    navFiddle: 'BrightScript Fiddle',
    navLogViewer: 'Visor de archivos de registro',
    navSecretScreens: 'Pantallas secretas',
    navSettings: 'Configuración',
    navRemoteLocations: 'Ubicaciones remotas',
    navSideloadRelay: 'Sideload Relay',
    navTips: 'Consejos',

    deviceDiscoveryHeading: 'Descubrimiento de dispositivos',
    deviceDiscoveryScanHtml: `Haga clic en <strong>Analizar</strong> para descubrir automáticamente dispositivos Roku en su red. Los dispositivos con el Modo de desarrollador activado mostrarán una insignia verde "Dev".`,
    deviceDiscoveryNoScanHtml: `<strong>¿El análisis no encuentra nada?</strong> El multicast SSDP (puerto UDP 1900) puede estar bloqueado por una VPN, el Wi‑Fi corporativo o reglas de firewall — pruebe la conexión manual con la IP del dispositivo. La PC y el Roku deben estar en la misma red accesible.`,
    deviceDiscoveryManual:
      'También puede conectarse manualmente ingresando una dirección IP en la sección "Conexión manual" en la parte inferior de la barra lateral.',

    remoteControlHeading: 'Control remoto',
    remoteControlIntroHtml: `Use el control remoto virtual para controlar su Roku. Los atajos de teclado opcionales están disponibles cuando activa <button type="button" class="help-settings-link" data-settings-section="general" data-settings-highlight="keyboardRemoteSettingsRow">Configuración → General → Control remoto de Roku - Usar el teclado </button> (desactivado de forma predeterminada). Se aplican en la pestaña <strong>Remoto</strong> (sola o en la disposición cuádruple de rendimiento del dispositivo) o en la pestaña <strong>Dev App</strong>, solo para la pestaña del dispositivo que tiene abierta — no en otras secciones, campos de texto ni ventanas modales.`,
    remoteControlTabHtml: `En la pestaña <strong>Remoto</strong> o <strong>Dev App</strong>, presione <span class="help-kbd">Tab</span> desde los controles del control remoto (no desde las pestañas de sección ni otro campo de texto) para saltar al campo <strong>Enviar texto</strong>. <span class="help-kbd">Enter</span> envía desde ese campo.`,
    remoteControlMediaHtml: `Los controles de medios (Retroceder, Reproducir/Pausar, Avanzar) y los botones de volumen también están disponibles en el control remoto virtual. Use <strong>Enviar texto</strong> en la parte inferior para escribir texto directamente en el campo de texto activo del dispositivo.`,
    scNavigation: 'Navegación',
    scForward: 'Avanzar',
    scSelect: 'Seleccionar / OK',
    scRewind: 'Retroceder',
    scBack: 'Atrás',
    scReplay: 'Repetición instantánea',
    scHome: 'Inicio',
    scVolume: 'Subir / bajar volumen',
    scPlayPause: 'Reproducir / pausar',
    scMute: 'Silenciar',
    scOptions: 'Menú de opciones',
    scPower: 'Encendido',

    appsHeading: 'Apps',
    appsListHtml: `
            <li><strong>Inicio personalizado</strong> - Inicie cualquier app por ID, incluidas las entradas de TV (HDMI 1-4)</li>
            <li><strong>Deep Link</strong> - Inicie apps con contenido específico mediante deep linking (App ID, Content ID, Media Type)</li>
            <li><strong>Lista sin procesar de apps</strong> - Vea la lista XML sin procesar de todas las apps instaladas</li>
          `,
    appsBody:
      'Vea todas las apps instaladas en su dispositivo Roku. Haga clic en cualquier app para iniciarla. Use la búsqueda para filtrar las apps por nombre.',

    queryHeading: 'Consulta',
    queryListHtml: `
            <li><strong>Consultas de dispositivo</strong> - Ajustes preestablecidos para consultas comunes como Device Info, Apps, Active App, Media Player y más</li>
            <li><strong>Consultas de desarrollador</strong> - Consultas avanzadas para dispositivos con el modo dev activado (SG Nodes, Plugins, Frame Rate, Channel Perf, App State, Registry)</li>
            <li><strong>Consulta personalizada</strong> - Ingrese cualquier endpoint ECP personalizado</li>
          `,
    queryIntro: 'Consulte la información del dispositivo mediante los endpoints ECP de Roku:',
    queryResults:
      'Los resultados se muestran en el panel de resultados a continuación. También están disponibles los endpoints POST (seguimiento de SGRendezvous, FW Beacons).',

    devAppHeading: 'Dev App',
    devAppListHtml: `
            <li><strong>Autenticación</strong> - Ingrese y valide su contraseña de desarrollador de Roku. Active "Recordar" para conservarla entre sesiones</li>
            <li><strong>Sideload</strong> - Instale paquetes de canal .zip o .pkg</li>
            <li><strong>Remoto</strong> - Vea la página del instalador web del dispositivo para opciones de desarrollo adicionales</li>
            <li><strong>Captura de pantalla</strong> - Capture pantallas de su Dev App en ejecución</li>
            <li><strong>Eliminar</strong> - Elimine el canal cargado por sideload</li>
          `,
    devAppIntro: 'Para dispositivos con el Modo de desarrollador activado:',
    devAppNote: 'Necesitará su contraseña de desarrollador de Roku (establecida durante la configuración del Modo de desarrollador).',

    consoleHeading: 'Consola',
    consoleListHtml: `
            <li><strong>Conectar / Desconectar</strong> - Establezca o cierre la conexión telnet</li>
            <li><strong>Buscar / Filtrar</strong> - Busque en los registros con opciones de coincidencia por mayúsculas y minúsculas, palabra completa y regex</li>
            <li><strong>Desplazamiento automático</strong> - Desplácese automáticamente hasta la salida más reciente</li>
            <li><strong>Copiar / Guardar</strong> - Copie todos los registros al portapapeles o guárdelos en un archivo</li>
            <li><strong>Borrar</strong> - Borre la salida de la consola</li>
          `,
    consoleIntro: 'Conéctese a la consola de depuración de BrightScript a través de Telnet (puerto 8085):',
    consoleNote:
      'Requiere el Modo de desarrollador activado. Solo puede haber una conexión telnet activa a la vez por dispositivo.',

    appConnectorHeading: 'App Connector',
    appConnectorListHtml: `
            <li><strong>Conectar</strong> - Establece una conexión de socket con su Dev App en ejecución (puerto predeterminado <code>49200</code>)</li>
            <li><strong>Ejecutar función</strong> - Llame funciones personalizadas expuestas por el <code>GetExternalControlFunctions</code> de su scene</li>
            <li><strong>Respuesta</strong> - Vea los valores de retorno y la salida de depuración</li>
            <li><strong>Actualizar nodo</strong> - Después de ejecutar <em>Get Node by ID</em>, el panel de respuesta ofrece una ventana modal de actualización de nodo donde puede usar <code>selectNode</code>, <code>setField</code> o <code>removeField</code> en el nodo coincidente</li>
            <li><strong>Integradas de RALE</strong> - El menú desplegable de funciones también lista comandos integrados de RALE: <em>Get Node by ID</em>, <em>Get Node by SubType</em> y un editor de registro (<em>Get All Sections</em>, <em>Add/Update Section</em>, <em>Remove Section</em>, <em>Set / Edit / Remove Section Key</em>, <em>Clear All Sections</em>)</li>
          `,
    appConnectorFooterHtml: `Su app de Roku debe tener TrackerTask integrado. Haga clic en <strong>Guía de integración</strong> en la pestaña de App Connector para obtener los fragmentos de BrightScript y los tipos de parámetro admitidos. Use <strong>Guardar TrackerTask.xml</strong> desde la misma ventana modal para colocar una copia lista para distribuir en su canal.`,
    appConnectorIntro:
      'Conéctese a apps de Roku que implementan el componente TrackerTask para comunicación bidireccional:',

    actionScriptsHeading: 'Action Scripts',
    actionScriptsBuilderHtml: `<strong>Constructor</strong> - Cree action scripts visualmente acción por acción:`,
    actionScriptsBuilderListHtml: `
            <li><strong>Tipos de acción</strong> - Pulsación de tecla, Enviar texto, Iniciar app, Consulta de dispositivo, POST, Sideload, Eliminar sideload, Captura de pantalla, Función de app, Comando RALE, Captura de rendimiento del dispositivo, Espera, If</li>
            <li><strong>Variables (script v2)</strong> - Use un paso <em>Establecer variable</em> o <code>assignToVar</code> en Consulta de dispositivo / Función de app / Comando RALE para recordar valores, luego referéncielos como <code>\${name}</code> en campos de pasos posteriores (texto, parámetros, contenido de deep-link, etc.)</li>
            <li><strong>If / Else if / Else (script v2)</strong> - Ramifique según condiciones basadas en el estado de <code>media-player</code>, la app activa, un campo de nodo RALE o una variable almacenada; anide pasos <em>If</em> para ramas de varios pasos</li>
            <li><strong>Condiciones de espera</strong> - <em>Espera</em> puede ser un <code>delayMs</code> fijo, o esperar hasta que una condición sea verdadera: estado de <em>media-player</em> o <em>campo de nodo RALE</em> (sondee <code>getNodeById</code> y compare un campo con operadores como <code>equals</code>, <code>contains</code>, <code>matches</code>, <code>hasAnyValue</code>) con <code>timeoutMs</code> y <code>pollIntervalMs</code> opcionales</li>
            <li><strong>Paso de rendimiento del dispositivo</strong> - Capture gráficos de <em>CPU</em>, <em>memoria</em>, <em>objetos</em> o <em>todos</em> para el dispositivo en el que se ejecuta este script; los PNG capturados se incluyen en los resultados de la ejecución / exportación a PDF</li>
            <li><strong>Ayuda por paso</strong> - El control <em>?</em> en cada fila del constructor abre un cuadro de ayuda contextual para ese tipo de acción</li>
            <li><strong>Administración de acciones</strong> - Agregue, elimine, reordene (arrastrar y soltar), copie y pegue acciones</li>
            <li><strong>Copiar / Pegar</strong> - Copie una acción con el control de copiar en cada fila. Después de copiar, use <strong>Pegar paso</strong> junto a cualquier fila <strong>Agregar paso</strong> para insertar en esa posición, o <span class="help-kbd">Ctrl</span>+<span class="help-kbd">V</span> para agregar al final del script</li>
            <li><strong>Importar</strong> - Cargue un script existente desde un archivo JSON</li>
            <li><strong>Deshacer / Rehacer</strong> - <span class="help-kbd">Ctrl</span>+<span class="help-kbd">Z</span> para deshacer, <span class="help-kbd">Ctrl</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">Z</span> para rehacer</li>
            <li><strong>Vista previa de JSON</strong> - Vista previa en vivo del script generado. Copie o guarde el script en un archivo</li>
            <li><strong>Copiar al Ejecutor</strong> - Envíe el script construido directamente al Ejecutor para ejecutarlo</li>
          `,
    actionScriptsExecutorHtml: `<strong>Ejecutor</strong> - Importe, valide y ejecute action scripts:`,
    actionScriptsExecutorListHtml: `
            <li><strong>Importar</strong> - Suba un archivo de script JSON o pegue el JSON del script, luego valídelo</li>
            <li><strong>Ejecutar / Pausar / Detener</strong> - Controle la ejecución con las acciones de reproducir, pausar y detener</li>
            <li><strong>Omitir / No omitir</strong> - Alterne acciones individuales para omitirlas durante la ejecución</li>
            <li><strong>Reordenar</strong> - Arrastre y suelte para reordenar las acciones antes de ejecutarlas</li>
            <li><strong>Resultados</strong> - Vea resultados detallados de cada acción, incluidas capturas de pantalla en línea y gráficos de rendimiento capturados</li>
            <li><strong>Copiar / Guardar resultados</strong> - Copie los resultados al portapapeles o guárdelos como PDF (el PDF incorpora capturas de pantalla y tarjetas de gráficos)</li>
            <li><strong>Conectar a la consola</strong> - Conéctese automáticamente a la consola de depuración durante las ejecuciones, de forma opcional</li>
          `,
    actionScriptsDevPasswordHtml: `<strong>Contraseña de desarrollador</strong> - Acciones como Captura de pantalla, Sideload y Eliminar sideload requieren una contraseña de desarrollador. La contraseña se resuelve en orden: <code>"password"</code> a nivel de acción → <code>"devPassword"</code> a nivel de script → la contraseña de la sección Autenticación de la Dev App. Si no se encuentra ninguna, se le solicitará durante la validación.`,
    actionScriptsSaveFolderHtml: `<strong>Carpeta de guardado</strong> - La carpeta de guardado predeterminada se encuentra en <button type="button" class="help-settings-link" data-settings-section="action-scripts" data-settings-highlight="actionScriptsDefaultFolderSettingsRow">Configuración → Action Scripts → Carpeta predeterminada</button>. En cada ejecución puede elegir otra carpeta. Los artefactos (capturas de pantalla, PNG de gráficos de rendimiento, PDF exportados) se colocan en una subcarpeta con marca de tiempo, creada solo cuando realmente se produce algo.`,
    actionScriptsAiAgentsHtml: `<strong>Agentes de IA</strong> - Los Action Scripts que crea en el Constructor también pueden ser creados por agentes de IA a través del servidor MCP (consulte la sección <em>Agentes de IA (MCP)</em> a continuación); el script del agente siempre llega al Constructor para su revisión humana antes de ejecutarse.`,
    actionScriptsIntro:
      'Automatice secuencias de acciones del dispositivo mediante scripts basados en JSON. Hay dos vistas disponibles:',

    devicePerformanceHeading: 'Rendimiento del dispositivo (sección del control remoto)',
    devicePerformanceIntroHtml: `Active <strong>Mostrar rendimiento del dispositivo</strong> en la sección del control remoto para expandir una vista cuádruple con gráficos en vivo:`,
    devicePerformanceListHtml: `
            <li>Gráficos de <strong>uso de CPU</strong>, <strong>memoria del sistema</strong> y <strong>objetos de BrightScript</strong> (vista de conteo o de memoria donde esté disponible)</li>
            <li>Los gráficos reflejan la app en ejecución — para lecturas representativas, el dispositivo debe tener el <strong>Modo de desarrollador</strong> activado y su <strong>canal de desarrollo cargado por sideload</strong> en primer plano</li>
            <li><button type="button" class="help-settings-link" data-settings-section="device-performance" data-settings-highlight="devicePerfRows">Configuración → Rendimiento del dispositivo</button> ajusta el intervalo de muestreo del gráfico y la ventana de historial; active <strong>Recordar 'Mostrar rendimiento del dispositivo'</strong> para restaurar la disposición cuádruple por dispositivo entre sesiones</li>
            <li>Dentro de Action Scripts, los pasos de <strong>Rendimiento del dispositivo</strong> capturan tarjetas de gráficos en los resultados de la ejecución (y la exportación a PDF)</li>
          `,

    networkInspectorHeading: 'Inspector de red',
    networkInspectorIntroHtml: `Inspeccione el tráfico HTTP(S) que genera su canal de desarrollo. Roku Dev Studio ejecuta un <strong>proxy MITM</strong> local que descifra el HTTPS del canal de desarrollo enrutado a través de él, para que pueda ver los encabezados y cuerpos completos de solicitud/respuesta.`,
    networkInspectorGettingStartedHtml: `<strong>Primeros pasos</strong>`,
    networkInspectorGettingStartedListHtml: `
            <li>Habilite el <strong>proxy MITM</strong> en <button type="button" class="help-settings-link" data-settings-section="network-inspector" data-settings-highlight="networkInspectorEnableSettingsRow">Configuración → Inspector de red</button>, luego haga que su canal de desarrollo enrute sus solicitudes a través de la dirección del proxy que se muestra — use <code>host:port</code> (p. ej. <code>192.168.1.50:8888</code>). Cómo aplica el canal ese proxy depende del código de red de su app.</li>
            <li>La <strong>captura de hotspot</strong> opcional registra metadatos de SNI/DNS de todo el tráfico del dispositivo; necesita acceso de captura de paquetes del sistema operativo (BPF en macOS, Npcap en Windows). <button type="button" class="help-settings-link" data-settings-section="network-inspector" data-settings-highlight="niSetupRow">Configuración → Inspector de red</button> explica la configuración por plataforma.</li>
          `,
    networkInspectorToolbarHtml: `<strong>Barra de herramientas</strong> (parte superior derecha del panel): <strong>Iniciar/Detener captura</strong>, <strong>Disposición de paneles</strong> (apilados o lado a lado solicitud/respuesta) y <strong>Configurar reglas de tráfico</strong>.`,
    networkInspectorToolbarListHtml: `
            <li><strong>Lista de sesiones</strong> - Filtre con <code>host:</code>, <code>method:</code>, <code>status:</code>, <code>type:</code>, <code>kind:</code>, <code>path:</code> (separe los términos con comas para OR); agrupe por host; alterne <em>Proxied</em> para ocultar los metadatos solo de hotspot. Los atajos para saltar al error y desplazarse al más reciente aparecen cuando corresponde.</li>
            <li><strong>Inspeccionar</strong> - Vea el resumen de solicitud / respuesta, los encabezados y los cuerpos (JSON / XML / sin procesar). <strong>Copie</strong> un cuerpo o exporte la transacción como <strong>cURL</strong> o <strong>HAR</strong>.</li>
            <li><strong>Guardar .pcap</strong> - Exporte los paquetes capturados del dispositivo; <strong>Borrar</strong> vacía la lista de sesiones.</li>
          `,
    networkInspectorTrafficRulesHtml: `<strong>Reglas de tráfico</strong> (el engranaje en la barra de herramientas) moldean el tráfico de este dispositivo a través del proxy; los cambios surten efecto de inmediato:`,
    networkInspectorTrafficRulesListHtml: `
            <li><strong>Bloquear todo el tráfico a través del proxy</strong> - Rechace cada solicitud a través del proxy. Esto prevalece sobre las reglas por host y la limitación del dispositivo.</li>
            <li><strong>Limitación del dispositivo</strong> - Limite el ancho de banda o agregue latencia a cada solicitud a través del proxy. Elija un ajuste preestablecido o escriba un valor personalizado (p. ej. <code>3 Mbps</code>, <code>1500 kbps</code>).</li>
            <li><strong>Reglas por host</strong> - Agregue un <strong>nombre de host</strong> para apuntar a cada solicitud a ese host, o un <strong>host + ruta</strong> (p. ej. <code>api.example.com/v1/play</code>) para apuntar solo a esa ruta. Cada regla puede <em>Bloquear</em>, <em>Restablecer</em> la conexión (simular una falla de red), <em>Simular</em> una respuesta predefinida (estado / Content-Type / retraso / cuerpo) o limitar.</li>
            <li><strong>Comodines</strong> - Use <code>*</code> en el host o la ruta para coincidir con más de un destino. <code>*.example.com</code> cubre cada subdominio (p. ej. entornos lower <em>y</em> prod en una sola regla), y <code>/v1/*/play</code> coincide con cualquier ruta bajo <code>/v1</code>. Un patrón sin <code>*</code> mantiene el comportamiento anterior (un host simple también coincide con sus subdominios).</li>
            <li><strong>Editar una regla</strong> - Haga clic en el lápiz de una regla para cambiar su URL de intercepción en el lugar (host o host/ruta); presione Enter para aplicar o Escape para cancelar.</li>
            <li><strong>Reescritura</strong> - A diferencia de Bloquear / Restablecer / Simular (que detienen la solicitud), las reglas de reescritura permiten que la solicitud continúe con las ediciones aplicadas. Agregue operaciones en la <em>solicitud</em> (redirigir host — "map remote" una URL de prod a staging/localhost, establecer ruta, agregar/quitar parámetros de consulta o encabezados, buscar/reemplazar en el cuerpo) o en la <em>respuesta</em> (anular el estado, agregar/quitar encabezados, buscar/reemplazar en el cuerpo — las respuestas gzip/br se decodifican, editan y reenvían). Buscar/reemplazar en el cuerpo admite texto plano o una regex, y se aplica solo a cuerpos de texto.</li>
            <li><strong>Límites</strong> - Un host no puede ser más rápido que el límite de ancho de banda del dispositivo, y su latencia no puede caer por debajo del piso de latencia del dispositivo.</li>
          `,
    networkInspectorLocalOnly: 'Inspector de red está disponible para dispositivos conectados localmente.',

    aiAgentsHeading: 'Agentes de IA (MCP)',
    aiAgentsIntroHtml: `Roku Dev Studio incluye un servidor <strong>MCP (Model Context Protocol)</strong> para que los agentes de IA en Cursor, Claude Desktop o VS Code puedan controlar un dispositivo real a través de esta app:`,
    aiAgentsListHtml: `
            <li><button type="button" class="help-settings-link" data-settings-section="mcp-server">Configuración → Servidor MCP</button> - Active o desactive un cliente para agregar o quitar su entrada MCP <code>roku-dev-studio</code>; las demás entradas de la configuración MCP de ese cliente permanecen intactas</li>
            <li><strong>Dos superficies</strong> - Operaciones directas del dispositivo para acciones puntuales (<code>keypress</code>, <code>launch_app</code>, <code>screenshot</code>, <code>app_function</code>, <code>rale_command</code>, telnet …) y <strong>Action Scripts</strong> para flujos condicionales / de varios pasos que llegan al Constructor para su revisión</li>
            <li><strong>Toasts</strong> - Las acciones destructivas del agente (iniciar, sideload, eliminar sideload, captura de pantalla, comandos RALE destructivos) muestran un toast no bloqueante en la app para que siempre vea lo que hizo el agente</li>
            <li><strong>Las contraseñas permanecen locales</strong> - Sideload / captura de pantalla / eliminar sideload reutilizan la contraseña que recordó el panel del dispositivo; el agente nunca tiene que enviar una</li>
          `,
    aiAgentsBridge:
      'El puente se inicia automáticamente cuando la app está abierta y se cierra al salir. Si un agente informa que el puente está sin conexión, solo traiga esta app al primer plano.',

    fiddleHeading: 'BrightScript Fiddle',
    fiddleIntroHtml: `Ábralo mediante <strong>Archivo → Abrir Fiddle</strong> (<span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">B</span>) o el botón <em>Abrir Fiddle</em> en la pestaña Consulta.`,
    fiddleListHtml: `
            <li><strong>Editor</strong> - Editor Monaco con resaltado de BrightScript y linting de <em>BrighterScript</em> en vivo; el botón Ejecutar se deshabilita mientras hay errores presentes</li>
            <li><strong>Ejecutar</strong> - Envuelve su fragmento en un canal SceneGraph mínimo, lo carga por sideload en el dispositivo seleccionado y transmite la consola de depuración de BrightScript (8085) al terminal de la ventana de Fiddle</li>
            <li><strong>Detener / cerrar ventana</strong> - Elimina el canal de Fiddle del dispositivo automáticamente</li>
          `,
    fiddleNote:
      'Requiere un dispositivo con el Modo de desarrollador activado y una contraseña de desarrollador conocida (use la pestaña Dev App una vez para recordarla, o se le solicitará en Fiddle).',

    logViewerHeading: 'Visor de archivos de registro',
    logViewerBodyHtml: `<strong>Archivo → Abrir archivo de registro</strong> (<span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">O</span>) abre un archivo de consola / registro guardado en una ventana dedicada con las mismas herramientas de búsqueda / registro estructurado / detección de URL que la pestaña Consola en vivo. Útil para revisar registros de una sesión anterior o de un compañero de equipo.`,

    secretScreensHeading: 'Pantallas secretas',
    secretScreensBodyHtml: `El enlace <em>Pantallas secretas</em> (sección del control remoto y el pie de la pestaña Consulta) abre una ventana modal que lista las secuencias de teclas estándar de Roku para configuraciones ocultas — <strong>Developer Settings</strong>, <strong>Secret Screen 1/2/3</strong>, <strong>Wi-Fi Info</strong>, <strong>Channel Info</strong>, <strong>Reboot</strong>, etc. Haga clic en una secuencia para enviar las pulsaciones de teclas al dispositivo conectado.`,

    settingsHeading: 'Configuración',
    settingsIntroHtml: `Ábrala con <span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">,</span> o <em>Roku Dev Studio → Configuración</em> (macOS) / <em>Archivo → Configuración</em> (Windows / Linux). Cinco secciones:`,
    settingsListHtml: `
            <li><strong>General</strong> - Modo de desarrollador, Modo de privacidad (enmascarar IP / seriales), Registro de depuración en archivo, Control remoto de Roku - Usar el teclado, Conectar automáticamente a los dispositivos, Ocultar la barra lateral automáticamente, Cifrar las contraseñas guardadas (la línea de estado muestra si el llavero del sistema operativo realmente está cifrando — en algunas configuraciones de Linux no lo está)</li>
            <li><strong>Action Scripts</strong> - Carpeta predeterminada para los artefactos de la ejecución (capturas de pantalla, PDF exportados)</li>
            <li><strong>Rendimiento del dispositivo</strong> - Intervalo de muestreo del gráfico, ventana de historial del gráfico, Recordar 'Mostrar rendimiento del dispositivo' por dispositivo</li>
            <li><strong>Tiempos &amp; red</strong> - Tiempos de espera de conexión / consulta / telnet y otros ajustes de red (con Restablecer valores predeterminados)</li>
            <li><strong>Servidor MCP</strong> - Active <code>roku-dev-studio</code> en su(s) cliente(s) de IA para que los agentes puedan controlar el dispositivo a través de esta app</li>
          `,

    remoteLocationsHeading: 'Ubicaciones remotas',
    remoteLocationsListHtml: `
            <li><strong>Configuración</strong> - Ejecute el Roku Relay Server en una Mac Mini en la ubicación remota</li>
            <li><strong>Agregar ubicación</strong> - Haga clic en "Agregar" en la sección de Ubicaciones remotas para configurar una conexión</li>
            <li><strong>Dirección del servidor</strong> - Ingrese la dirección IP o el nombre de host del servidor de relé</li>
            <li><strong>Puerto predeterminado</strong> - El servidor de relé se ejecuta en el puerto <code>4951</code> de forma predeterminada</li>
          `,
    remoteLocationsServerHtml: `El servidor de relé se encuentra en la carpeta <code>remote-server</code>. Consulte el README para las instrucciones de configuración (LaunchAgent en macOS, systemd en Linux, Task Scheduler en Windows).`,
    remoteLocationsTroubleshootHtml: `<strong>¿El sideload o la captura de pantalla fallan a través del relé pero ECP funciona?</strong> Actualice el host del relé a la misma versión de <code>roku-dev-studio-api</code> que esta app. Verifique <code>GET /health</code> en el relé (campo <code>apiVersion</code>) y asegúrese de que el puerto <code>4951</code> sea accesible a través de los firewalls.`,
    remoteLocationsIntro: 'Controle dispositivos Roku en ubicaciones remotas a través de un Relay Server:',

    sideloadRelayHeading: 'Sideload Relay',
    sideloadRelayIntroHtml: `Haga sideload de una compilación a <strong>muchos dispositivos a la vez</strong>. Cuando el relé está activado, Roku Dev Studio se anuncia como un Roku en su red: apunte su IDE (VS Code BrightScript / roku-deploy / Eclipse) o un navegador a esta máquina, suba una vez y RDS distribuye la compilación — <em>instalar → iniciar → consola</em> — a cada dispositivo de destino, local o en una ubicación remota.`,
    sideloadRelayEnableHtml: `<strong>Actívelo</strong> en <button type="button" class="help-settings-link" data-settings-section="sideload-relay" data-settings-highlight="optSideloadRelay-row">Configuración → Sideload Relay</button> (desactivado de forma predeterminada). Dos requisitos previos condicionan el interruptor:`,
    sideloadRelayEnableListHtml: `
            <li><strong>Contraseña de dev del relé</strong> - La contraseña con la que su IDE se autentica ante RDS (usuario <code>rokudev</code>), exactamente como la contraseña de desarrollador de un Roku real. Es independiente de la contraseña de dev propia de cada dispositivo de destino.</li>
            <li><strong>Configurar dispositivos</strong> - Abra la ventana modal de configuración de dispositivos y habilite al menos un dispositivo accesible con el Modo de desarrollador activado. Lista los dispositivos locales y remotos (de ubicación de relé); habilite los que deben recibir cada compilación. Los dispositivos sin una contraseña de dev guardada muestran <strong>🔒 Establecer contraseña</strong> para validar una en línea. Los dispositivos previamente seleccionados que se desconectan permanecen en la lista (deshabilitados) y se reincorporan automáticamente cuando vuelven a estar accesibles.</li>
          `,
    sideloadRelayPointHtml: `<strong>Apunte su IDE a RDS.</strong> Con el relé habilitado, RDS es detectable por SSDP como <em>"Roku Dev Studio Relay"</em>, o puede establecer su host de compilación directamente en la IP de esta máquina. En <em>Sideload</em> / <em>Debug: Launch</em>, el IDE sube a RDS en el puerto <code>80</code> y RDS gestiona la distribución. También se sirve una página web de subida con tema en la dirección del relé (<code>http://&lt;this-machine&gt;/</code>) para hacer sideload de archivos <code>.zip</code> arrastrando y soltando desde un navegador.`,
    sideloadRelayAutoConnectHtml: `<strong>Conexión automática.</strong> Cuando una compilación llega correctamente a un destino, RDS abre ese dispositivo como una pestaña conectada y adjunta su consola de depuración automáticamente, para que vea la salida por dispositivo sin clics adicionales. El progreso de distribución en vivo también se transmite como una consola de estado en el puerto telnet <code>8085</code>.`,
    sideloadRelaySourceApprovalHtml: `<strong>Aprobación de origen.</strong> Un sideload que se origina en esta máquina procede automáticamente. Un sideload desde una máquina diferente retiene la subida y muestra un mensaje de permitir/denegar en el host de RDS (deniega automáticamente después de 30 s); las subidas desde el navegador de una máquina remota requieren además iniciar sesión con la contraseña de dev del relé.`,
    sideloadRelayFooterHtml: `Requiere que los dispositivos de destino tengan el Modo de desarrollador activado. Consulte <strong>Ubicaciones remotas</strong> más arriba para apuntar a dispositivos en otro sitio a través de un servidor de relé.`,

    tipsHeading: 'Consejos',
    tipDeveloperModeHtml: `Active el Modo de desarrollador en su Roku: Vaya a Inicio, presione <span class="help-kbd">Home</span> 3 veces, <span class="help-kbd">↑</span> 2 veces, <span class="help-kbd">→</span> <span class="help-kbd">←</span> <span class="help-kbd">→</span> <span class="help-kbd">←</span> <span class="help-kbd">→</span>`,
    tipMacosHtml: `<strong>macOS:</strong> cerrar la ventana principal cierra la app (las sesiones de telnet y MCP se terminan). Use <em>Roku Dev Studio → Salir</em> o <span class="help-kbd">Cmd</span>+<span class="help-kbd">Q</span> — la app no permanece en el dock sin ventanas.`,
    tipWindowsLinuxHtml: `<strong>Windows / Linux:</strong> use el menú de la barra de título (☰) para Configuración, Modo de privacidad y Acerca de; los botones de minimizar/maximizar/cerrar de la ventana están en el borde derecho de la barra de título.`,
    tipMultipleDevices: 'Se pueden conectar varios dispositivos simultáneamente; cada uno obtiene su propia pestaña',
    tipClickCard: 'Haga clic en la tarjeta de un dispositivo conectado para cambiar a su pestaña',
    tipRightClick: 'Haga clic derecho en las tarjetas de dispositivo para copiar la información del dispositivo',
    tipRemoteLocations: 'Las ubicaciones remotas le permiten controlar dispositivos sin acceso físico',
  },
};
