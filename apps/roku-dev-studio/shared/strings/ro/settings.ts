/**
 * Romanian (ro) translation of the Settings window strings (General, MCP,
 * Network Inspector, timing/validation, …). Sibling of ../settings.ts — same
 * `settings` shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. Only literal
 * display text is translated; product/feature names and tech tokens are verbatim.
 */
export const settings = {
  // Bootstrap / fatal
  apiUnavailable: 'API-ul de setări este indisponibil.',
  loadFailedMessage: 'Deschiderea Setărilor a eșuat. Încercați din nou.',

  // General section
  noFolderSet: 'Niciun folder setat',
  logFilePath: (path: string): string => `Fișier jurnal: ${path}`,

  // Password storage / keychain
  keychainUnencryptedConfirm:
    'Sistemul dumneavoastră nu oferă un breloc de chei real pentru criptare. Activarea acestei opțiuni stochează parolele ca text simplu codificat pe disc, necriptate. Continuați?',
  keychainOff: 'Comutatorul de criptare este dezactivat — parolele memorate sunt stocate ca text simplu pe disc.',
  keychainDefaultBackend: 'Breloc de chei al sistemului',
  keychainEncrypted: (backend: string): string => `Stocare: criptată prin ${backend}.`,
  keychainUnencrypted:
    'Avertisment: comutatorul este activat, dar acest sistem folosește text simplu — parolele sunt text simplu codificat Base64 pe disc. Folosiți un breloc de chei Linux (Secret Service/KWallet) pentru criptare reală.',
  keychainUnavailable:
    'Avertisment: comutatorul este activat, dar brelocul de chei al sistemului de operare este indisponibil — parolele rămân în memorie doar pentru această sesiune.',
  keychainStatus: (status: string, backend: string): string =>
    `Stare stocare: ${status}${backend ? ` (${backend})` : ''}.`,

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
  mcpServerBlurbHtml: `Expune Roku Dev Studio agenților IA prin <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" class="mcp-link">Model Context Protocol</a>. Comută un client pentru a adăuga sau elimina intrarea sa de server MCP <code class="mcp-inline-code">roku-dev-studio</code>; celelalte intrări rămân neatinse.`,
  mcpNoClients: 'Nu s-au detectat clienți MCP acceptați pe acest sistem.',
  mcpInstalled: 'Instalat',
  mcpNotDetected: 'Nedetectat',
  mcpOpenConfigTitle: (path: string): string => `Deschide ${path}`,
  mcpOpenConfigAria: (label: string): string => `Deschide fișierul de configurare MCP pentru ${label}`,
  mcpOpenConfigFile: 'Deschide fișierul de configurare',
  mcpInstallToEnable: (label: string): string => `Instalați ${label} pentru a activa.`,
  mcpEnableAria: (label: string): string => `Activează MCP pentru ${label}`,
  mcpToolsButton: 'Vezi instrumentele MCP',
  mcpToolsModalTitle: 'Instrumente MCP',
  mcpToolsModalAria: 'Instrumente MCP expuse agenților AI',
  mcpToolsIntro: (count: number): string =>
    `Cele ${count} instrumente pe care Roku Dev Studio le expune agenților AI prin Model Context Protocol, grupate pe domenii.`,
  mcpToolCategories: {
    discovery: 'Conectare și descoperire dispozitive',
    remote: 'Control de la distanță și ECP',
    sideload: 'Sideload',
    telnet: 'Telnet și consolă',
    appConnector: 'App Connector și RALE',
    debugger: 'Depanator',
    networkInspector: 'Inspector de rețea',
    actionScripts: 'Scripturi de acțiune',
  },
  mcpToolDescriptions: {
    probe_bridge: 'Verifică dacă Roku Dev Studio însuși este pornit și accesibil.',
    scan_devices: 'Descoperă dispozitivele Roku din rețeaua locală (SSDP + scanare opțională a subrețelei).',
    list_devices: 'Listează toate dispozitivele pe care Dev Studio le cunoaște deja — conectate, descoperite sau reținute.',
    connect_device: 'Deschide sau focalizează o filă Dev Studio pentru un dispozitiv dat.',
    test_connection: 'Testează accesibilitatea ECP pentru un IP de dispozitiv.',
    get_selected_device: 'Returnează fila de dispozitiv focalizată curent în Dev Studio.',
    keypress: 'Trimite o tastă de la distanță ECP (Sus / Jos / Selectează / Acasă / Redă / …).',
    input_text: 'Introduce text literal în câmpul de introducere focalizat curent.',
    launch_app: 'Lansează un canal pe ecranul său principal.',
    deep_link: 'Lansează un canal direct pe un conținut specific printr-un link direct ECP.',
    ecp_query: 'Execută un GET ECP doar-citire — informații despre dispozitiv, aplicații instalate, aplicație activă, stare player, …',
    ecp_post: 'Trimite un POST către un endpoint ECP arbitrar (cu efecte secundare).',
    screenshot: 'Capturează ecranul curent al dispozitivului, returnat direct ca imagine.',
    get_app_icon: 'Obține pictograma unui canal.',
    sideload: 'Încarcă și instalează un pachet .zip al canalului, înlocuind Dev App-ul curent.',
    delete_sideload: 'Elimină Dev App-ul instalat momentan prin sideload.',
    telnet_connect: 'Deschide consola de depanare BrightScript (portul 8085).',
    telnet_disconnect: 'Închide consola de depanare BrightScript.',
    get_telnet_log: 'Citește liniile din consolă acumulate din momentul conectării.',
    console_monitor_findings: 'Analizează bufferul consolei pentru probleme și erori BrightScript recunoscute.',
    app_connector_connect: 'Deschide o sesiune RALE / App Connector pentru Dev App-ul în execuție.',
    app_connector_disconnect: 'Închide sesiunea RALE / App Connector.',
    app_function: 'Invocă o funcție expusă de canal prin App Connector.',
    list_app_connector_functions: 'Listează funcțiile RALE disponibile ale canalului în execuție și parametrii acestora.',
    rale_command: 'Execută orice comandă RALE predefinită, inclusiv operații distructive asupra registrului.',
    rale_get_node_by_id: 'Obținere doar-citire a unui nod SceneGraph după id.',
    debugger_attach: 'Deschide o sesiune de depanare BrightScript (canalul trebuie lansat cu depanare activată).',
    debugger_status: 'Returnează starea sesiunii fără blocare.',
    debugger_set_breakpoints: 'Adaugă puncte de întrerupere — se înregistrează imediat dacă execuția e oprită.',
    debugger_list_breakpoints: 'Listează punctele de întrerupere urmărite și starea lor (verificat / în așteptare).',
    debugger_remove_breakpoints: 'Elimină punctele de întrerupere după fișier și linie.',
    debugger_pause: 'Solicită oprirea unui canal în execuție.',
    debugger_continue: 'Reia execuția dintr-o stare oprită.',
    debugger_step: 'Execută pas cu pas thread-ul oprit (over / in / out).',
    debugger_wait_for_stop: 'Blochează până la următoarea oprire, returnând o captură completă a stării.',
    debugger_get_callstack: 'Returnează cadrele stivei de apeluri pentru thread-ul oprit.',
    debugger_get_variables: 'Returnează variabilele din domeniul unui cadru al stivei.',
    debugger_evaluate: 'Execută o expresie BrightScript în cadrul oprit (REPL).',
    debugger_detach: 'Închide sesiunea de depanare.',
    network_inspector_status: 'Raportează starea capturii / MITM și cerințele preliminare de configurare.',
    network_inspector_list_events: 'Listează evenimentele de rețea capturate ca rezumate ușoare, filtrabile.',
    network_inspector_get_event_detail: 'Obține headerele și corpul complet pentru un eveniment capturat.',
    network_inspector_find: 'Căutare în text integral în URL-urile, headerele și corpurile capturate.',
    network_inspector_analyze: 'Agregă bufferul în hotspoturi și rezumate — status, hosturi, tipuri de conținut.',
    network_inspector_get_ca_info: 'Returnează amprenta CA MITM și informațiile proxy pentru decriptarea HTTPS.',
    list_action_types: 'Listează toate tipurile de pași Action Script acceptate.',
    get_action_schema: 'Returnează schema de autorizare pentru un tip de pas.',
    get_capability_bundle: 'Un singur payload cu toate capacitățile statice — acțiuni, vocabular, presetări, contractul de autorizare.',
    validate_script: 'Validează un Action Script cu mai mulți pași înainte de a-l trimite către builder.',
    send_script_to_builder: 'Trimite un Action Script validat în Dev Studio Builder pentru revizuire.',
  },

  // Network Inspector — status line
  niStatusDisabled: 'Stare: dezactivat — salvați după activare pentru a începe monitorizarea clienților hotspot.',
  niPlatformMac: 'bridge100 pe macOS',
  niPlatformWin: 'adaptor virtual pe Windows',
  niPlatformLinux: 'interfață hotspot pe Linux',
  niStatusEnabled: (platformHint: string): string =>
    `Stare: activat — se așteaptă interfața hotspot (${platformHint}).`,
  niMitmSuffix: (port: number): string => ` · proxy MITM pe portul ${port}`,

  // Network Inspector — capture setup (BPF)
  captureAccessEnabled: 'Acces la captură activat',
  setupNeeded: 'Configurare necesară',
  // Static default for the setup modal <h2>; JS replaces it with a platform-suffixed title.
  hotspotCaptureSetupModalTitle: 'Configurare captură hotspot',
  niSetupRowDescOk: 'Opțional — doar pentru captura DNS/SNI prin hotspot. Utilizarea proxy nu necesită configurare.',
  niSetupRowDescNeeds: 'Captura prin hotspot necesită configurare — deschideți pentru a o activa. (Proxy funcționează în continuare.)',
  niSetupPacketCapture: 'Configurează captura de pachete',
  bpfWaitingApproval: 'Se așteaptă aprobarea administratorului…',
  bpfInstalled: 'Acces la captura de pachete instalat.',
  bpfInstalledHint: 'Instalat — reveniți la fila Inspector de rețea.',
  bpfCancelled: 'Anulat.',
  bpfSetupFailed: 'Configurarea a eșuat.',

  niSetupGuide: {
    titlePrefix: `Configurare captură hotspot`,
    darwin: {
      intro: `<strong>Opțional — doar pentru captura prin hotspot.</strong> Decriptarea canalului dumneavoastră de dezvoltare încărcat local funcționează pe orice rețea fără această configurare. Acești pași adaugă captura DNS/TLS SNI prin hotspot din <em>tot</em> traficul unui Roku, folosind hotspotul Internet Sharing al Mac-ului dumneavoastră (<code class="mcp-inline-code">bridge100</code>). Doar dispozitive locale.`,
      enableSharing: `<strong>Activați Internet Sharing</strong> — RDS captează pe <code class="mcp-inline-code">bridge100</code> imediat ce este activat:`,
      sharingSteps: [
        `Deschideți <strong>System Settings → General → Sharing</strong>`,
        `Activați <strong>Internet Sharing</strong>, partajând <strong>către Wi-Fi</strong>`,
        `Conectați dispozitivul Roku la rețeaua Wi-Fi partajată de Mac`
      ],
      captureHead: `Acces la captura de pachete`,
      captureBody: `macOS creează <code class="mcp-inline-code">/dev/bpf*</code> accesibil doar pentru root. Rulați configurarea unică de mai jos pentru a restabili accesul după fiecare repornire (necesită parola de administrator, la fel ca ChmodBPF din Wireshark). Sau instalați <a href="https://www.wireshark.org/download.html" target="_blank" rel="noopener noreferrer" class="mcp-link">Wireshark</a> și rulați programul său de instalare ChmodBPF.`
    },
    win32: {
      intro: `<strong>Opțional — doar pentru captura prin hotspot.</strong> Decriptarea canalului dumneavoastră de dezvoltare încărcat local funcționează pe orice rețea fără această configurare (proxy-ul MITM gestionează atât aceeași rețea Wi-Fi, cât și hotspotul). Acești pași adaugă captura DNS/TLS SNI prin hotspot din <em>tot</em> traficul unui Roku, atunci când acesta este conectat prin hotspotul acestui PC. Doar dispozitive locale.`,
      enableHotspot: `<strong>Activați singur un hotspot (opțional)</strong> — RDS nu comută rețeaua din Windows; o controlați dumneavoastră:`,
      hotspotSteps: [
        `Deschideți <strong>Setări → Rețea &amp; internet → Hotspot mobil</strong>`,
        `Activați <strong>Hotspot mobil</strong> (partajați prin Wi-Fi)`,
        `Conectați dispozitivul Roku la acel hotspot — RDS detectează automat adaptorul virtual`
      ],
      npcapHead: `Acces la captura prin hotspot (Npcap)`,
      npcapBody: `Captura prin hotspot (DNS/TLS SNI din tot traficul Roku-ului) necesită driverul <a href="https://npcap.com/" target="_blank" rel="noopener noreferrer" class="mcp-link">Npcap</a>. Acest lucru este opțional — chiar dacă îl omiteți, proxy-ul MITM tot înregistrează canalul dumneavoastră de dezvoltare încărcat local.`,
      npcapSteps: [
        `Descărcați și rulați programul de instalare de la <a href="https://npcap.com/" target="_blank" rel="noopener noreferrer" class="mcp-link">npcap.com</a>`,
        `În timpul instalării, activați <strong>“Install Npcap in WinPcap API-compatible Mode”</strong>`,
        `<strong>Reporniți Roku Dev Studio</strong> după instalare, pentru ca modulul de captură inclus să se încarce`
      ],
      npcapNote: `Aveți deja Npcap, dar captura tot nu pornește? Reinstalați Roku Dev Studio pentru ca modulul său nativ de captură să corespundă acestei versiuni.`
    },
    linux: {
      intro: `<strong>Opțional — doar pentru captura prin hotspot.</strong> Decriptarea canalului dumneavoastră de dezvoltare încărcat local funcționează pe orice rețea fără această configurare. Acești pași adaugă captura DNS/TLS SNI prin hotspot din <em>tot</em> traficul unui Roku, partajând conexiunea acestui computer. Doar dispozitive locale.`,
      shareConnection: `<strong>Partajați conexiunea</strong> astfel încât Roku-ul să fie direcționat prin acest computer:`,
      shareSteps: [
        `Folosiți NetworkManager → <strong>“Partajat cu alte computere”</strong> pentru o conexiune Wi-Fi/Ethernet (gateway <code class="mcp-inline-code">10.42.0.1</code>) sau rulați un hotspot hostapd`,
        `Conectați dispozitivul Roku la acea rețea partajată — RDS detectează automat interfața gateway-ului`
      ],
      captureHead: `Acces la captura de pachete`,
      captureBody: `Linux captează prin <code class="mcp-inline-code">tcpdump</code>, care necesită privilegii de raw-socket. Rulați configurarea unică de mai jos (solicitare a administratorului) pentru a acorda capabilitățile <code class="mcp-inline-code">cap_net_raw</code>/<code class="mcp-inline-code">cap_net_admin</code> — sau manual: <code class="mcp-inline-code">sudo setcap cap_net_raw,cap_net_admin=eip $(which tcpdump)</code>.`
    }
  },
  // Network Inspector — place selector + Remote Locations
  placeLocal: 'Local (acest computer)',
  placeRemoteFallback: 'La distanță',
  niRemoteRequiresRoot:
    'Această locație necesită ca serverul la distanță să ruleze ca root pentru a activa Inspector de rețea.',
  niRemoteUnsupported:
    'Această locație nu acceptă Inspector de rețea. Actualizați acest server la distanță pentru funcționalitatea Inspector de rețea.',
  niDisabled: 'Inspector de rețea este dezactivat.',
  niEditingRemote: 'Se editează setările locației la distanță. Captura rulează pe serverul la distanță.',
  niPortConflictTitle: 'Port proxy indisponibil',
  niRemoteUnavailable: 'Inspector de rețea la distanță nu este disponibil în această versiune.',
  niCheckingRemote: 'Se verifică locația la distanță…',
  niCouldNotReachRemote: 'Nu s-a putut contacta locația la distanță.',

  // Network Inspector — enable confirm + save status
  niConfirmEnable:
    'Inspector de rețea va captura traficul Roku și îl va stoca local pe acest computer — prin proxy MITM și, dacă este configurată, prin captura hotspot/rețea partajată. Continuați?',
  niSaved: 'Setările Inspector de rețea au fost salvate.',
  niSavedRemote: 'Salvat în locația la distanță.',
  niRemoteSaveFailed: 'Salvarea la distanță a eșuat',

  // Etichete de rând pentru Temporizare și rețea (titlu + indiciu per cheie de temporizare),
  // localizate aici pentru ca interfața de setări să le afișeze în limba activă. Limitele
  // numerice min/max vin în continuare din procesul principal prin `timingMeta`.
  timingLabels: {
    DEFAULT_RALE_PORT: { title: 'Port RALE / App Connector', hint: 'Port TCP (implicit 49200).' },
    SCREENSHOT_DEBOUNCE_DELAY: { title: 'Debounce captură de ecran (ms)', hint: 'Întârziere după apăsarea unei taste înainte de captura automată de ecran.' },
    SCREENSHOT_AFTER_LAUNCH_DELAY: { title: 'Captură de ecran după lansare (ms)', hint: 'Așteptare după lansarea Dev App înainte de captura de ecran.' },
    TELNET_TIMEOUT: { title: 'Expirare conectare Telnet (ms)', hint: 'Consolă de depanare / Telnet de sistem.' },
    CONNECTION_CHECK_INTERVAL: { title: 'Verificare activitate dispozitiv (ms)', hint: 'Cât de des sunt interogate dispozitivele conectate: informații despre dispozitiv, starea ECP și dacă canalul Dev App este în prim-plan.' },
    DEVICE_METRICS_SAMPLE_INTERVAL_MS: { title: 'Rată de eșantionare (ms)', hint: 'Cadența interogării Chanperf + numărul de obiecte. Mai mic = date mai proaspete, mai mult trafic ECP; necesită Mod dezvoltator și Control by Mobile Apps.' },
    DEVICE_METRICS_CHART_HISTORY_MS: { title: 'Durată istoric grafic (minute)', hint: 'Cât de departe în trecut afișează graficele CPU și System Memory' },
    TOAST_DISPLAY_DURATION: { title: 'Durată toast (s)', hint: 'Vizibilitate toast de succes/eroare.' },
    STATUS_MESSAGE_DURATION: { title: 'Durată mesaj de stare (s)', hint: 'Vizibilitate linie de stare din antet.' },
  },

  // Timing bounds + validation
  timingValueFallback: 'Valoare',
  timingBoundMin: (value: string | number): string => `Min: ${value}`,
  timingBoundMax: (value: string | number): string => `Max: ${value}`,
  timingMustBeWholeNumber: (label: string): string => `${label} trebuie să fie un număr întreg.`,
  timingMustBeAtLeast: (label: string, bound: string): string => `${label} trebuie să fie cel puțin ${bound}.`,
  timingMustBeAtMost: (label: string, bound: string): string => `${label} trebuie să fie cel mult ${bound}.`,
  timingMoreOutOfRange: (n: number): string => ` (încă ${n} în afara intervalului)`,
  timingClamped: (label: string, value: string, which: string): string =>
    `${label} ajustat la ${value} (${which}).`,
  timingClampMinimum: 'minim',
  timingClampMaximum: 'maxim',

  // Save status messages
  generalSaved: 'Setările generale au fost salvate.',
  actionScriptsSaved: 'Setările Action Scripts au fost salvate.',
  devicePerfSaved: 'Setările de performanță a dispozitivului au fost salvate.',
  timingSaved: 'Setările de temporizare și rețea au fost salvate.',
  mcpSaved: 'Setările serverului MCP au fost salvate.',
  saveFailed: 'Salvarea a eșuat',
  saveWriteFailedError: 'Nu s-a putut scrie fișierul de setări.',
  mcpConfigUpdateWarning: (summary: string): string =>
    `Actualizarea configurației clientului MCP a avut erori: ${summary}`,

  // ── Static settings.html shell ──────────────────────────────────────────
  // Header + nav
  windowTitle: 'Setări — Roku Dev Studio',
  heading: 'Setări',
  navAria: 'Secțiuni de setări',
  tabGeneral: 'General',
  tabActionScripts: 'Scripturi de acțiune',
  tabDevicePerformance: 'Performanța dispozitivului',
  tabTiming: 'Temporizare și rețea',
  tabNetworkInspector: 'Inspector de rețea',
  tabSideloadRelay: 'Sideload Relay',
  tabMcpServer: 'Server MCP',
  // Shared across every section's save dock
  resetToDefaults: 'Resetează la valorile implicite',

  // General section — toggle labels, descriptions, and (screen-reader) aria labels
  language: 'Limbă',
  languageDesc: 'Limba de afișare a interfeței aplicației.',
  languageAria: 'Limba de afișare',
  languageSystemDefault: (name: string): string => `Implicit de sistem (${name})`,
  developerMode: 'Mod dezvoltator',
  developerModeDesc: 'Jurnalizare suplimentară în fereastra principală (la fel ca Fișier → Mod dezvoltator).',
  developerModeAria: 'Mod dezvoltator',
  privacyMode: 'Mod confidențialitate',
  privacyModeDesc: 'Maschează adresele IP și numerele de serie în interfață (la fel ca Fișier → Mod confidențialitate).',
  privacyModeAria: 'Mod confidențialitate',
  debugLogging: 'Jurnalizare de depanare în fișier',
  debugLogHint: 'Când este activat, scrie în fișierul de jurnal din datele de utilizator ale aplicației.',
  debugLoggingAria: 'Jurnalizare de depanare în fișier',
  useKeyboardRemote: 'Folosește tastatura pentru telecomanda Roku',
  useKeyboardRemoteDesc:
    'Când este activat, puteți folosi tastatura pentru a controla dispozitivul Roku. Comenzile rapide de la tastatură sunt listate în fereastra de ajutor pentru telecomandă.',
  useKeyboardRemoteAria: 'Telecomandă Roku - folosește tastatura ',
  tryDemoAppToggle: 'Afișează Butonul Încearcă Aplicația Demo',
  tryDemoAppToggleDesc:
    'Când este activat, apare un buton Încearcă Aplicația Demo în bara de titlu pentru a încărca canalul demonstrativ inclus Roku Dev Studio Showcase pe un dispozitiv.',
  tryDemoAppToggleAria: 'Afișează butonul încearcă aplicația demo',
  tryDemoAppOpenBtn: 'Deschide Aplicația Demo',
  tryDemoAppOpenBtnAria: 'Deschide selectorul încearcă aplicația demo',
  // Placeholder: reuse the English Crash Reporting toggle strings until a translation exists.
  crashReportingToggle: 'Show Crash Reports',
  crashReportingToggleDesc:
    'When On, an uncaught error shows a report modal with details you can file as a GitHub issue.',
  crashReportingToggleAria: 'Show crash reports',
  autoConnect: 'Conectare automată la dispozitive',
  autoConnectDesc:
    'Când este activat, aplicația se va conecta automat la dispozitivele care au rămas conectate la închiderea aplicației în sesiunea anterioară.',
  autoHideSidebar: 'Ascunde automat bara laterală',
  autoHideSidebarDesc:
    'Când este activat, bara laterală, care afișează lista de dispozitive, se va comuta automat dacă a fost ascunsă în sesiunea anterioară.',
  encryptPasswords: 'Criptează parolele salvate cu brelocul de chei al sistemului',
  encryptPasswordsDesc:
    'Criptează parola memorată a fiecărui dispozitiv prin brelocul de chei al sistemului de operare. Când este dezactivat, aceasta persistă, dar este stocată necriptată pe disc.',
  encryptPasswordsAria: 'Păstrează parolele salvate în brelocul de chei al sistemului',

  // Action Scripts section
  actionScriptsBlurb:
    'Folderul implicit pentru capturi de ecran și jurnale când un script trebuie să salveze. Puteți alege oricând alt folder la fiecare rulare.',
  chooseFolder: 'Alege folderul…',

  // Device Performance section
  devicePerfIntroHtml: `Se aplică cât timp <strong>Afișează performanța dispozitivului</strong> este activat, dispozitivul Roku are Modul dezvoltator, iar Dev App este în prim-plan. Când <strong>Reține „Afișează performanța dispozitivului”</strong> este activat mai jos, secțiunea telecomenzii restaurează aspectul cvadruplu pentru fiecare dispozitiv.`,
  rememberDevicePerf: 'Reține „Afișează performanța dispozitivului”',
  rememberDevicePerfAria: 'Reține afișarea sau ascunderea performanței dispozitivului pentru fiecare dispozitiv',
  // Row description — contains <strong>, rendered via data-i18n-html.
  rememberDevicePerfDescHtml: `Restaurează dacă <strong>Afișează performanța dispozitivului</strong> a fost activat pentru fiecare dispozitiv. Dezactivează pentru a începe întotdeauna doar cu secțiunea telecomenzii până când îl activezi din nou.`,

  // Network Inspector section — place selector + field labels
  location: 'Locație',
  niPlaceAria: 'Locația Inspector de rețea',
  enableNetworkInspector: 'Activează Inspector de rețea',
  enableNetworkInspectorDesc:
    'Inspectează traficul de rețea al unui dispozitiv. Decriptează traficul HTTPS al canalului dumneavoastră de dezvoltare prin proxy-ul local (orice rețea); un hotspot captează și DNS/SNI. Stocat doar local.',
  mitmProxyPort: 'Port proxy MITM',
  mitmProxyPortDesc:
    'Portul pe care ascultă proxy-ul local de decriptare. Direcționați prin el canalul de dezvoltare încărcat local — canalele standard nu pot fi interceptate.',
  mitmProxyPortAria: 'Port proxy MITM',
  packetLimit: 'Limită de pachete per dispozitiv',
  packetLimitDesc:
    'Cadre păstrate per dispozitiv pentru exportul PCAP. Mai mare = mai mult istoric și memorie.',
  packetLimitAria: 'Limită de pachete per dispozitiv',
  maxBodySize: 'Dimensiune maximă a corpului (KB)',
  maxBodySizeDesc:
    'Cât de mult din corpul fiecărei cereri/răspuns este păstrat pentru vizualizare. Peste limită, se afișează o insignă „Corp trunchiat” (dispozitivul nu este afectat). Se aplică doar traficului nou.',
  maxBodySizeAria: 'Dimensiune maximă a corpului păstrat în KB',
  hotspotCaptureSetup: 'Configurare hotspot și captură',
  viewSetup: 'Vezi configurarea',

  // Sideload Relay section — intro bullets. The first bullet has inline markup (<span>/<code>,
  // whose #srRelayUrlWrap/#srRelayUrl are populated at runtime) so it's rendered via data-i18n-html.
  srIntro1Html: `Îndreptați instrumentul de sideload (VS Code cu extensia BrightScript, Eclipse sau CLI-ul roku-deploy)<span id="srRelayUrlWrap" hidden> — sau un browser către <code id="srRelayUrl">http://…/</code></span> — aici, în locul unui singur Roku.`,
  srIntro2: 'RDS acceptă încărcarea o singură dată, apoi o instalează pe fiecare țintă activată, lansează Dev App și deschide fiecare consolă.',
  srIntro3: 'Încărcările de pe acest computer se desfășoară automat.',
  srIntro4: 'O încărcare de pe alt dispozitiv din rețeaua LAN necesită parola de dezvoltator și vă solicită să o permiteți.',

  // ── Network Inspector — Certificate Authority card (surface the CA) ──
  caSectionTitle: 'Autoritate de certificare',
  caRowDesc: 'Autoritatea de certificare locală pe care proxy-ul o folosește pentru a decripta traficul HTTPS.',
  caRowDescRemote: 'Autoritatea de certificare a acestei locații, folosită de proxy-ul ei pentru a decripta traficul HTTPS.',
  caViewCert: 'Vezi certificatul',
  caSectionDesc:
    'Inspector de rețea semnează traficul HTTPS decriptat cu o autoritate de certificare locală. Acordați-i încredere sau importați-o pe dispozitiv, astfel încât canalul dvs. de dezvoltare să accepte proxy-ul. Cheia privată nu părăsește niciodată acest computer.',
  caSectionDescRemote:
    'Inspector de rețea semnează traficul HTTPS decriptat cu autoritatea de certificare a acestei locații. Acordați-i încredere sau importați-o pe dispozitiv, astfel încât canalul dvs. de dezvoltare să accepte proxy-ul. Cheia privată nu părăsește niciodată acel server.',
  caSubject: 'Subiect',
  caFingerprint: 'Amprentă SHA-256',
  caValidity: 'Valabilitate',
  caProxyAddress: 'Adresă proxy',
  caValidityRange: (from: string, to: string): string => `${from} – ${to}`,
  caLoading: 'Se încarcă detaliile certificatului…',
  caUnavailable: 'Detaliile certificatului nu sunt disponibile.',
  caExportAction: 'Exportă',
  exportCaPem: 'Exportă .pem',
  exportCaCrt: 'Exportă .crt',
  caExportedPem: 'CA exportat ca .pem.',
  caExportedCrt: 'CA exportat ca .crt.',
  caExportFailed: 'Exportul a eșuat.',
};
