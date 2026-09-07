/**
 * Latin American Spanish (neutral) translation of the Settings window strings
 * (General, MCP, Network Inspector, timing/validation, …). Sibling of
 * ../settings.ts — same `settings` shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. Only literal
 * display text is translated; product/feature names and tech tokens are verbatim.
 */
export const settings = {
  // Bootstrap / fatal
  apiUnavailable: 'API de configuración no disponible.',
  loadFailedMessage: 'No se pudo abrir Configuración. Inténtelo de nuevo.',

  // General section
  noFolderSet: 'No se estableció una carpeta',
  logFilePath: (path: string): string => `Archivo de registro: ${path}`,

  // Password storage / keychain
  keychainUnencryptedConfirm:
    'Su sistema no proporciona un llavero de cifrado real. Al habilitar esto, las contraseñas se almacenan como texto plano codificado en el disco, sin cifrar. ¿Continuar?',
  keychainOff: 'El interruptor de cifrado está desactivado — las contraseñas recordadas se almacenan como texto plano en el disco.',
  keychainDefaultBackend: 'Llavero del sistema',
  keychainEncrypted: (backend: string): string => `Almacenamiento: cifrado mediante ${backend}.`,
  keychainUnencrypted:
    'Advertencia: el interruptor está activado pero este sistema usa texto básico — las contraseñas son texto plano codificado en Base64 en el disco. Use un llavero de Linux (Secret Service/KWallet) para un cifrado real.',
  keychainUnavailable:
    'Advertencia: el interruptor está activado pero el llavero del sistema operativo no está disponible — las contraseñas permanecen en memoria solo durante esta sesión.',
  keychainStatus: (status: string, backend: string): string =>
    `Estado del almacenamiento: ${status}${backend ? ` (${backend})` : ''}.`,

  // MCP Server section
  // Client row labels (product/brand names — same across locales, but sourced here so the
  // catalog is the single place UI text lives). Keys match main's McpClientId union.
  mcpClientLabels: {
    chatgpt: 'ChatGPT Desktop',
    claude: 'Claude Desktop',
    cursor: 'Cursor',
    vscode: 'Visual Studio Code',
    'vscode-insiders': 'VS Code Insiders',
    vscodium: 'VSCodium',
    windsurf: 'Windsurf',
  },
  // MCP panel help blurb — contains <a>/<code>, rendered via data-i18n-html.
  mcpServerBlurbHtml: `Exponga Roku Dev Studio a agentes de IA mediante el <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" class="mcp-link">Model Context Protocol</a>. Active o desactive un cliente para agregar o quitar su entrada de servidor MCP <code class="mcp-inline-code">roku-dev-studio</code>; las demás entradas permanecen intactas.`,
  mcpNoClients: 'No se detectaron clientes MCP compatibles en este sistema.',
  mcpInstalled: 'Instalado',
  mcpNotDetected: 'No detectado',
  mcpOpenConfigTitle: (path: string): string => `Abrir ${path}`,
  mcpOpenConfigAria: (label: string): string => `Abrir el archivo de configuración de MCP para ${label}`,
  mcpOpenConfigFile: 'Abrir archivo de configuración',
  mcpInstallToEnable: (label: string): string => `Instale ${label} para habilitar.`,
  mcpEnableAria: (label: string): string => `Habilitar MCP para ${label}`,

  // Network Inspector — status line
  niStatusDisabled: 'Estado: deshabilitado — guarde después de habilitar para comenzar a monitorear los clientes del hotspot.',
  niPlatformMac: 'bridge100 en macOS',
  niPlatformWin: 'adaptador virtual en Windows',
  niPlatformLinux: 'interfaz de hotspot en Linux',
  niStatusEnabled: (platformHint: string): string =>
    `Estado: habilitado — esperando la interfaz de hotspot (${platformHint}).`,
  niMitmSuffix: (port: number): string => ` · proxy MITM en el puerto ${port}`,

  // Network Inspector — capture setup (BPF)
  captureAccessEnabled: 'Acceso de captura habilitado',
  setupNeeded: 'Se requiere configuración',
  // Static default for the setup modal <h2>; JS replaces it with a platform-suffixed title.
  hotspotCaptureSetupModalTitle: 'Configuración de captura por hotspot',
  niSetupRowDescOk: 'Opcional — solo para la captura de DNS/SNI del hotspot. El proxy no requiere configuración.',
  niSetupRowDescNeeds: 'La captura del hotspot requiere configuración — ábrala para habilitarla. (El proxy sigue funcionando.)',
  niSetupPacketCapture: 'Configurar captura de paquetes',
  bpfWaitingApproval: 'Esperando la aprobación del administrador…',
  bpfInstalled: 'Acceso de captura de paquetes instalado.',
  bpfInstalledHint: 'Instalado — regrese a la pestaña de Inspector de red.',
  bpfCancelled: 'Cancelado.',
  bpfSetupFailed: 'La configuración falló.',

  niSetupGuide: {
    titlePrefix: `Configuración de captura por hotspot`,
    darwin: {
      intro: `<strong>Opcional — solo para la captura por hotspot.</strong> El descifrado de su canal de desarrollador cargado con sideload funciona en cualquier red sin esta configuración. Estos pasos añaden la captura por hotspot de DNS/TLS SNI de <em>todo</em> el tráfico de un Roku a través del hotspot de Compartir Internet de su Mac (<code class="mcp-inline-code">bridge100</code>). Solo dispositivos locales.`,
      enableSharing: `<strong>Active Compartir Internet</strong> — RDS captura en <code class="mcp-inline-code">bridge100</code> en cuanto esté activado:`,
      sharingSteps: [
        `Abra <strong>Ajustes del Sistema → General → Compartir</strong>`,
        `Active <strong>Compartir Internet</strong>, compartiendo <strong>por Wi-Fi</strong>`,
        `Conecte su Roku a la red Wi-Fi compartida del Mac`
      ],
      captureHead: `Acceso a la captura de paquetes`,
      captureBody: `macOS crea <code class="mcp-inline-code">/dev/bpf*</code> con acceso solo para root. Ejecute la configuración única que aparece a continuación para restaurar el acceso tras cada reinicio (se requiere la contraseña de administrador, como el ChmodBPF de Wireshark). O instale <a href="https://www.wireshark.org/download.html" target="_blank" rel="noopener noreferrer" class="mcp-link">Wireshark</a> y ejecute su instalador de ChmodBPF.`
    },
    win32: {
      intro: `<strong>Opcional — solo para la captura por hotspot.</strong> El descifrado de su canal de desarrollador cargado con sideload funciona en cualquier red sin esta configuración (el proxy MITM gestiona tanto la misma red Wi-Fi como el hotspot). Estos pasos añaden la captura por hotspot de DNS/TLS SNI de <em>todo</em> el tráfico de un Roku cuando está conectado a través del hotspot de este PC. Solo dispositivos locales.`,
      enableHotspot: `<strong>Active un hotspot usted mismo (opcional)</strong> — RDS no activa ni desactiva la red de Windows; usted la controla:`,
      hotspotSteps: [
        `Abra <strong>Configuración → Red &amp; Internet → Zona con cobertura inalámbrica móvil</strong>`,
        `Active la <strong>Zona con cobertura inalámbrica móvil</strong> (compartir por Wi-Fi)`,
        `Conecte su Roku a ese hotspot — RDS detecta automáticamente el adaptador virtual`
      ],
      npcapHead: `Acceso a la captura por hotspot (Npcap)`,
      npcapBody: `La captura por hotspot (DNS/TLS SNI de todo el tráfico del Roku) necesita el controlador <a href="https://npcap.com/" target="_blank" rel="noopener noreferrer" class="mcp-link">Npcap</a>. Esto es opcional — omítalo y el proxy MITM seguirá registrando su canal de desarrollador cargado con sideload.`,
      npcapSteps: [
        `Descargue y ejecute el instalador desde <a href="https://npcap.com/" target="_blank" rel="noopener noreferrer" class="mcp-link">npcap.com</a>`,
        `Durante la instalación, active <strong>“Install Npcap in WinPcap API-compatible Mode”</strong>`,
        `<strong>Reinicie Roku Dev Studio</strong> después de instalarlo para que se cargue el módulo de captura incluido`
      ],
      npcapNote: `¿Ya tiene Npcap pero la captura sigue sin iniciarse? Reinstale Roku Dev Studio para que su módulo de captura nativo coincida con esta compilación.`
    },
    linux: {
      intro: `<strong>Opcional — solo para la captura por hotspot.</strong> El descifrado de su canal de desarrollador cargado con sideload funciona en cualquier red sin esta configuración. Estos pasos añaden la captura por hotspot de DNS/TLS SNI de <em>todo</em> el tráfico de un Roku compartiendo la conexión de esta máquina. Solo dispositivos locales.`,
      shareConnection: `<strong>Comparta su conexión</strong> para que el Roku enrute el tráfico a través de esta máquina:`,
      shareSteps: [
        `Use NetworkManager → <strong>“Compartida con otros equipos”</strong> en una conexión Wi-Fi/Ethernet (puerta de enlace <code class="mcp-inline-code">10.42.0.1</code>), o ejecute un hotspot con hostapd`,
        `Conecte su Roku a esa red compartida — RDS detecta automáticamente la interfaz de la puerta de enlace`
      ],
      captureHead: `Acceso a la captura de paquetes`,
      captureBody: `Linux captura mediante <code class="mcp-inline-code">tcpdump</code>, que necesita privilegios de socket de bajo nivel. Ejecute la configuración única que aparece a continuación (solicita permisos de administrador) para otorgar las capacidades <code class="mcp-inline-code">cap_net_raw</code>/<code class="mcp-inline-code">cap_net_admin</code> — o manualmente: <code class="mcp-inline-code">sudo setcap cap_net_raw,cap_net_admin=eip $(which tcpdump)</code>.`
    }
  },
  // Network Inspector — place selector + Remote Locations
  placeLocal: 'Local (esta máquina)',
  placeRemoteFallback: 'Remoto',
  niRemoteRequiresRoot:
    'Esta ubicación requiere que el servidor remoto se ejecute como root para habilitar Inspector de red.',
  niRemoteUnsupported:
    'Esta ubicación no admite Inspector de red. Actualice este servidor remoto para la funcionalidad de Inspector de red.',
  niDisabled: 'Inspector de red está deshabilitado.',
  niEditingRemote: 'Editando la configuración de la ubicación remota. La captura se ejecuta en el servidor remoto.',
  niPortConflictTitle: 'Puerto de proxy no disponible',
  niRemoteUnavailable: 'Inspector de red remoto no está disponible en esta compilación.',
  niCheckingRemote: 'Verificando la ubicación remota…',
  niCouldNotReachRemote: 'No se pudo comunicar con la ubicación remota.',

  // Network Inspector — enable confirm + save status
  niConfirmEnable:
    'Inspector de red capturará el tráfico de Roku y lo almacenará localmente en esta máquina — a través del proxy MITM y, si está configurada, la captura de hotspot/red compartida. ¿Continuar?',
  niSaved: 'Configuración de Inspector de red guardada.',
  niSavedRemote: 'Guardado en la ubicación remota.',
  niRemoteSaveFailed: 'Error al guardar en remoto',

  // Timing bounds + validation
  timingLabels: {
    DEFAULT_RALE_PORT: { title: 'RALE / App Connector Port', hint: 'TCP Port (predeterminado 49200).' },
    SCREENSHOT_DEBOUNCE_DELAY: { title: 'Antirrebote de captura de pantalla (ms)', hint: 'Retraso tras pulsar una tecla antes de la captura automática.' },
    SCREENSHOT_AFTER_LAUNCH_DELAY: { title: 'Captura de pantalla tras el inicio (ms)', hint: 'Espera tras iniciar la Dev App antes de la captura.' },
    TELNET_TIMEOUT: { title: 'Tiempo de espera de conexión Telnet (ms)', hint: 'Consola de depuración / Telnet del sistema.' },
    CONNECTION_CHECK_INTERVAL: { title: 'Comprobación de dispositivo activo (ms)', hint: 'Con qué frecuencia se sondean los dispositivos conectados: información del dispositivo, estado ECP y si el canal de la Dev App está en primer plano.' },
    DEVICE_METRICS_SAMPLE_INTERVAL_MS: { title: 'Frecuencia de muestreo (ms)', hint: 'Cadencia de sondeo de Chanperf y conteo de objetos. Menor = datos más recientes, más tráfico ECP; requiere Modo de desarrollador y Control por aplicaciones móviles.' },
    DEVICE_METRICS_CHART_HISTORY_MS: { title: 'Tiempo de historial del gráfico (minutos)', hint: 'Cuánto tiempo atrás muestran los gráficos de CPU y System Memory' },
    TOAST_DISPLAY_DURATION: { title: 'Duración del toast (s)', hint: 'Visibilidad del toast de éxito/error.' },
    STATUS_MESSAGE_DURATION: { title: 'Duración del mensaje de estado (s)', hint: 'Visibilidad de la línea de estado del encabezado.' },
  },
  timingValueFallback: 'Valor',
  timingBoundMin: (value: string | number): string => `Mín: ${value}`,
  timingBoundMax: (value: string | number): string => `Máx: ${value}`,
  timingMustBeWholeNumber: (label: string): string => `${label} debe ser un número entero.`,
  timingMustBeAtLeast: (label: string, bound: string): string => `${label} debe ser al menos ${bound}.`,
  timingMustBeAtMost: (label: string, bound: string): string => `${label} debe ser como máximo ${bound}.`,
  timingMoreOutOfRange: (n: number): string => ` (${n} más fuera de rango)`,
  timingClamped: (label: string, value: string, which: string): string =>
    `${label} ajustado a ${value} (${which}).`,
  timingClampMinimum: 'mínimo',
  timingClampMaximum: 'máximo',

  // Save status messages
  generalSaved: 'Configuración general guardada.',
  actionScriptsSaved: 'Configuración de Action Scripts guardada.',
  devicePerfSaved: 'Configuración de rendimiento del dispositivo guardada.',
  timingSaved: 'Configuración de tiempos y red guardada.',
  mcpSaved: 'Configuración del servidor MCP guardada.',
  saveFailed: 'Error al guardar',
  saveWriteFailedError: 'No se pudo escribir el archivo de configuración.',
  mcpConfigUpdateWarning: (summary: string): string =>
    `La actualización de la configuración del cliente MCP tuvo errores: ${summary}`,

  // ── Static settings.html shell ──────────────────────────────────────────
  // Header + nav
  windowTitle: 'Configuración — Roku Dev Studio',
  heading: 'Configuración',
  navAria: 'Secciones de configuración',
  tabGeneral: 'General',
  tabActionScripts: 'Scripts de acción',
  tabDevicePerformance: 'Rendimiento del dispositivo',
  tabTiming: 'Tiempos y red',
  tabNetworkInspector: 'Inspector de red',
  tabSideloadRelay: 'Sideload Relay',
  tabMcpServer: 'Servidor MCP',
  // Shared across every section's save dock
  resetToDefaults: 'Restablecer predeterminados',

  // General section — toggle labels, descriptions, and (screen-reader) aria labels
  language: 'Idioma',
  languageDesc: 'Idioma de la interfaz de la aplicación.',
  languageAria: 'Idioma de visualización',
  languageSystemDefault: (name: string): string => `Predeterminado del sistema (${name})`,
  developerMode: 'Modo de desarrollador',
  developerModeDesc: 'Registro adicional en la ventana principal (igual que Archivo → Modo de desarrollador).',
  developerModeAria: 'Modo de desarrollador',
  privacyMode: 'Modo de privacidad',
  privacyModeDesc: 'Enmascara las IP y los números de serie en la interfaz (igual que Archivo → Modo de privacidad).',
  privacyModeAria: 'Modo de privacidad',
  debugLogging: 'Registro de depuración en archivo',
  debugLogHint: 'Escribe en el archivo de registro dentro de los datos de usuario de la aplicación cuando está habilitado.',
  debugLoggingAria: 'Registro de depuración en archivo',
  useKeyboardRemote: 'Usar el teclado para el control remoto de Roku',
  useKeyboardRemoteDesc:
    'Cuando está activado, puede usar el teclado para controlar el Roku. Los atajos de teclado se enumeran en el cuadro de ayuda del control remoto.',
  useKeyboardRemoteAria: 'Control remoto de Roku - Usar el teclado ',
  tryDemoAppToggle: 'Mostrar Botón de Probar App de Demostración',
  tryDemoAppToggleDesc:
    'Cuando está activado, aparece un botón Probar App de Demostración en la barra de título para cargar el canal de demostración Roku Dev Studio Showcase incluido en un dispositivo.',
  tryDemoAppToggleAria: 'Mostrar botón de probar app de demostración',
  tryDemoAppOpenBtn: 'Abrir App de Demostración',
  tryDemoAppOpenBtnAria: 'Abrir el selector de probar app de demostración',
  // Placeholder: reuse the English Crash Reporting toggle strings until a translation exists.
  crashReportingToggle: 'Show Crash Reports',
  crashReportingToggleDesc:
    'When On, an uncaught error shows a report modal with details you can file as a GitHub issue.',
  crashReportingToggleAria: 'Show crash reports',
  autoConnect: 'Conectar automáticamente a los dispositivos',
  autoConnectDesc:
    'Cuando está activado, la aplicación se conectará automáticamente a los dispositivos que permanecían conectados al cerrar la aplicación en la sesión anterior.',
  autoHideSidebar: 'Ocultar la barra lateral automáticamente',
  autoHideSidebarDesc:
    'Cuando está activado, la barra lateral, que muestra la lista de dispositivos, se alternará automáticamente si estaba oculta en la sesión anterior.',
  encryptPasswords: 'Cifrar las contraseñas guardadas con el llavero del sistema',
  encryptPasswordsDesc:
    'Cifra la contraseña recordada de cada dispositivo mediante el llavero del sistema operativo. Cuando está desactivado, persiste pero se almacena sin cifrar en el disco.',
  encryptPasswordsAria: 'Conservar las contraseñas guardadas en el llavero del sistema',

  // Action Scripts section
  actionScriptsBlurb:
    'Carpeta predeterminada para capturas de pantalla y registros cuando un script necesita guardarlos. Aún puede elegir otra carpeta en cada ejecución.',
  chooseFolder: 'Elegir carpeta…',

  // Device Performance section
  devicePerfIntroHtml: `Se aplica mientras <strong>Mostrar rendimiento del dispositivo</strong> está activado, el Roku tiene el Modo de desarrollador y la Dev App está en primer plano. Cuando <strong>Recordar 'Mostrar rendimiento del dispositivo'</strong> está activado más abajo, la sección del control remoto restaura la disposición cuádruple por dispositivo.`,
  rememberDevicePerf: "Recordar 'Mostrar rendimiento del dispositivo'",
  rememberDevicePerfAria: 'Recordar mostrar u ocultar el rendimiento del dispositivo por dispositivo',
  // Row description — contains <strong>, rendered via data-i18n-html.
  rememberDevicePerfDescHtml: `Restaura si <strong>Mostrar rendimiento del dispositivo</strong> estaba activado para cada dispositivo. Desactívelo para empezar siempre solo con la sección Remoto hasta que vuelva a activarlo.`,

  // Network Inspector section — place selector + field labels
  location: 'Ubicación',
  niPlaceAria: 'Ubicación de Inspector de red',
  enableNetworkInspector: 'Habilitar Inspector de red',
  enableNetworkInspectorDesc:
    'Inspeccione el tráfico de red de un dispositivo. Descifra el HTTPS de su canal de desarrollador mediante el proxy local (cualquier red); un hotspot también captura DNS/SNI. Se almacena solo localmente.',
  mitmProxyPort: 'Puerto del proxy MITM',
  mitmProxyPortDesc:
    'Puerto en el que escucha el proxy local de descifrado. Enrute su canal de desarrollador cargado con sideload a través de él — los canales de fábrica no se pueden interceptar.',
  mitmProxyPortAria: 'Puerto del proxy MITM',
  packetLimit: 'Límite de paquetes por dispositivo',
  packetLimitDesc:
    'Tramas conservadas por dispositivo para la exportación PCAP. Mayor = más historial y memoria.',
  packetLimitAria: 'Límite de paquetes por dispositivo',
  maxBodySize: 'Tamaño máximo del cuerpo (KB)',
  maxBodySizeDesc:
    'Cuánto del cuerpo de cada solicitud/respuesta se conserva para verlo. Por encima del límite, se muestra una insignia "Body Truncated" (el dispositivo no se ve afectado). Se aplica solo al tráfico nuevo.',
  maxBodySizeAria: 'Tamaño máximo del cuerpo conservado en KB',
  hotspotCaptureSetup: 'Configuración de hotspot y captura',
  viewSetup: 'Ver configuración',

  // Sideload Relay section — intro bullets. The first bullet has inline markup (<span>/<code>,
  // whose #srRelayUrlWrap/#srRelayUrl are populated at runtime) so it's rendered via data-i18n-html.
  srIntro1Html: `Apunte su herramienta de sideload (VS Code con la extensión de BrightScript, Eclipse o la CLI de roku-deploy)<span id="srRelayUrlWrap" hidden> — o un navegador en <code id="srRelayUrl">http://…/</code></span> — aquí en lugar de a un solo Roku.`,
  srIntro2: 'RDS acepta el sideload una vez, luego lo instala en cada destino habilitado, inicia la Dev App y abre cada consola.',
  srIntro3: 'Los sideloads desde esta máquina proceden automáticamente.',
  srIntro4: 'Un sideload desde otro dispositivo de la LAN necesita la contraseña de dev y le pide que lo permita.',

  // ── Network Inspector — Certificate Authority card (surface the CA) ──
  caSectionTitle: 'Autoridad de certificación',
  caRowDesc: 'La autoridad de certificación local que el proxy usa para descifrar HTTPS.',
  caRowDescRemote: 'La autoridad de certificación de esta ubicación, usada por su proxy para descifrar HTTPS.',
  caViewCert: 'Ver certificado',
  caSectionDesc:
    'Inspector de red firma el HTTPS descifrado con una autoridad de certificación local. Confíe en ella o impórtela en el dispositivo para que su canal de desarrollador acepte el proxy. La clave privada nunca sale de esta máquina.',
  caSectionDescRemote:
    'Inspector de red firma el HTTPS descifrado con la autoridad de certificación de esta ubicación. Confíe en ella o impórtela en el dispositivo para que su canal de desarrollador acepte el proxy. La clave privada nunca sale de ese servidor.',
  caSubject: 'Sujeto',
  caFingerprint: 'Huella SHA-256',
  caValidity: 'Validez',
  caProxyAddress: 'Dirección del proxy',
  caValidityRange: (from: string, to: string): string => `${from} – ${to}`,
  caLoading: 'Cargando los detalles del certificado…',
  caUnavailable: 'Los detalles del certificado no están disponibles.',
  caExportAction: 'Exportar',
  exportCaPem: 'Exportar .pem',
  exportCaCrt: 'Exportar .crt',
  caExportedPem: 'CA exportada como .pem.',
  caExportedCrt: 'CA exportada como .crt.',
  caExportFailed: 'La exportación falló.',
};
