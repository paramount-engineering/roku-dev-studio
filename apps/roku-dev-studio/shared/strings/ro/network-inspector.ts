/**
 * Romanian (ro) translation of the Network Inspector strings — the live capture
 * tab, its modals (traffic rules, find-in-content, hotspot setup, port conflict,
 * large-body info, filter help), and the detail renderers shared with the
 * standalone Session Viewer. Sibling of ../network-inspector.ts — same
 * `networkInspector` shape, keys, order, and function signatures.
 *
 * Some values intentionally embed HTML markup (<strong>, <code>, <kbd>, <em>)
 * because they're injected via innerHTML. Only literal display text is translated;
 * product / feature names, tech tokens, code literals, and placeholders are kept
 * verbatim. Count-based functions follow Romanian plural rules: singular for
 * n === 1, plural otherwise, and the preposition "de" before the noun when n === 0
 * or when (n % 100) is 0 or falls in 20..99.
 */
export const networkInspector = {
  // Section identity (used as a title prefix for the shared URL / structured viewers).
  titlePrefix: 'Inspector de rețea',

  // ── Shared detail pane chrome (network-detail-view.ts) ──────────────────────────────
  emptyDetail: 'Selectați o sesiune pentru a inspecta cererea și răspunsul.',
  request: 'Cerere',
  response: 'Răspuns',
  tabOverview: 'Prezentare generală',
  tabBody: 'Corp',
  tabHeaders: 'Antete',
  copyRequestBody: 'Copiază corpul cererii',
  copyResponseBody: 'Copiază corpul răspunsului',
  moreCopyOptions: 'Mai multe opțiuni de copiere',
  copyBody: 'Copiază corpul',
  copyAsCurl: 'Copiază ca cURL',
  copyAsHar: 'Copiază ca HAR',
  bodyTruncated: 'Corp trunchiat',
  bodyTruncatedRequestTitle:
    'Copia capturată a acestui corp a depășit limita de afișare a inspectorului, așa că ceea ce este afișat aici este incomplet. Corpul complet a fost totuși livrat în amonte. Folosiți Copiază pentru porțiunea capturată.',
  bodyTruncatedResponseTitle:
    'Copia capturată a acestui corp a depășit limita de afișare a inspectorului, așa că ceea ce este afișat aici este incomplet. Corpul complet a fost totuși livrat către Roku. Folosiți Copiază pentru porțiunea capturată.',
  disableWordWrap: 'Dezactivează încadrarea textului',
  enableWordWrap: 'Activează încadrarea textului',
  toggleWordWrap: 'Comută încadrarea textului',
  formatLabel: 'Format',
  formatAuto: 'Auto',
  formatJson: 'JSON',
  formatXml: 'XML',
  formatRaw: 'Brut',
  whyRawText: 'De ce este afișat ca text brut?',

  // ── Session list rows (network-session-view.ts) ─────────────────────────────────────
  noMatchingSessions: 'Nicio sesiune potrivită.',
  noHostsYet: 'Încă niciun host. Structura grupează traficul după numele hostului.',
  sslDecryptedTitle: 'Decriptat (MITM)',
  sslEncryptedTitle: 'HTTPS (criptat)',
  sessionNumber: (n: number): string => `Sesiune #${n}`,
  requestNumber: (n: number): string => `Cerere #${n}`,
  expandAllGroups: 'Extinde toate grupurile',
  collapseAllGroups: 'Restrânge toate grupurile',

  // ── Session-list derived tokens (network-sessions.ts) ───────────────────────────────
  // Duration column value while a transaction is still open (distinct from statusPending
  // below — has a trailing ellipsis and is the duration cell, not the status pill).
  durationPending: 'În curs…',
  // Status-pill tokens for the session list. Kept SEPARATE from the overview statusPending:
  // statusClass()/the status filter compare against session.status, so these must stay
  // byte-identical to the values eventToSession() assigns (kept verbatim, not translated).
  listStatusPending: 'Pending',
  listStatusQuery: 'Query',
  listStatusOk: 'OK',
  listStatusOpen: 'Open',
  // DNS structure-tree leaf / sidebar path labels.
  dnsQueryLabel: 'Interogare DNS',
  dnsResponseLabel: 'Răspuns DNS',

  // ── Detail renderers (network-detail.ts) ────────────────────────────────────────────
  // Synthetic first-row header of the response Headers table (HTTP/RFC start-line term).
  statusLine: 'Linie de stare',
  noHeaders: '(fără antete)',
  noRequestBody: '(fără corp de cerere)',
  noResponseBody: '(fără corp de răspuns)',
  emptyResponseBody: '(corp de răspuns gol)',
  waitingForResponse: '(se așteaptă răspunsul…)',
  encryptedNoHeaders: '(criptat — fără antete)',
  dnsNoHeaders: '(DNS — fără antete HTTP)',
  dnsAnswerEmpty: '(gol)',
  dnsPending: '(în așteptare)',
  noResponseBodyCaptured: '(niciun corp de răspuns capturat)',
  httpsResponseEncrypted: 'Corpul răspunsului HTTPS este criptat. Activați proxy-ul MITM pentru a inspecta corpurile aici.',
  // Media-preview fallbacks + captions.
  mimeContent: 'conținut',
  mimeBinary: 'binar',
  mimeUnknownType: 'tip necunoscut',
  responseImageAlt: 'Previzualizare imagine răspuns',
  binaryTruncatedNote: (mime: string): string =>
    `Fișierul binar ${mime} a fost trunchiat în timpul capturii — previzualizarea nu este disponibilă. Folosiți Copiază pentru base64-ul capturat.`,
  binaryNotPreviewable: (mime: string, size: string): string =>
    `Conținut binar (${mime}, ~${size}) — nu poate fi previzualizat. Folosiți Copiază pentru base64-ul capturat.`,
  // Overview: request Status row values (display-only; distinct from the session-list status tokens).
  statusPending: 'În așteptare',
  statusComplete: 'Finalizat',
  statusFailed: 'Eșuat',
  // Overview: row + section labels.
  ovType: 'Tip',
  ovTime: 'Oră',
  ovDevice: 'Dispozitiv',
  ovHost: 'Gazdă',
  ovDestination: 'Destinație',
  ovUrl: 'URL',
  ovStatus: 'Stare',
  ovResponseCode: 'Cod de răspuns',
  ovProtocol: 'Protocol',
  ovMethod: 'Metodă',
  requestContentType: 'Content-Type al cererii',
  responseContentType: 'Content-Type al răspunsului',
  ovClientAddress: 'Adresă client',
  ovRemoteAddress: 'Adresă la distanță',
  ovTags: 'Etichete',
  ovDns: 'DNS',
  ovNotes: 'Note',
  ovRequestStart: 'Începutul cererii',
  ovTotal: 'Total',
  secTls: 'TLS',
  secTiming: 'Cronometrare',
  secSize: 'Dimensiune',
  viewUrlTitle: 'Vizualizează URL-ul și parametrii de interogare',
  tagsMitmDecrypted: 'MITM · decriptat',
  protocolHttpsDecrypted: 'HTTPS (decriptat prin proxy-ul MITM Roku Dev Studio)',
  protocolHttpsEncrypted: 'HTTPS (criptat)',
  notesProxied: 'Cerere prin proxy — TLS-ul din amonte s-a terminat la Roku Dev Studio',
  notesHotspot: 'Captură hotspot — corpurile nu sunt disponibile fără MITM',
  typeHttpsTlsHandshake: 'HTTPS (handshake TLS)',
  unknownHost: 'unknown-host',
  dnsQueryValue: (host: string): string => `Interogare ${host}`,
  dnsBody: (isQuery: boolean, host: string): string => `DNS ${isQuery ? 'Interogare' : 'Răspuns'}: ${host}`,
  httpsRequestFallback: (host: string, port: string): string =>
    `CONNECT ${host}${port} (HTTPS — criptat)\n\nCaptura hotspot vede doar handshake-ul TLS (SNI + IP), nu și corpurile JSON.\n\nActivați MITM în Setări și direcționați canalul prin Roku Dev Studio pentru a inspecta corpurile.`,

  // ── Embedded JSON/XML fragment highlight (network-embedded-structured.ts) ────────────
  embeddedViewTitle: (label: string): string => `Faceți clic pentru a vizualiza ${label} formatat (se deschide într-o fereastră modală)`,

  // ── Hotspot Capture Setup modal (hotspot-setup-modal.ts) ─────────────────────────────
  setupPacketCapture: 'Configurează captura de pachete',
  requestingCaptureAccess: 'Se solicită accesul pentru captură…',
  captureAccessGranted: 'Acces pentru captură acordat.',
  setupCancelled: 'Configurarea a fost anulată.',
  setupFailed: 'Configurarea a eșuat.',
  setupFailedRetry: 'Configurarea a eșuat — încercați din nou.',

  // ── Filter-syntax help modal (network-filter-help.ts) ────────────────────────────────
  filterHelpHeading: 'Filtrarea sesiunilor',
  filterHelpAria: 'Ajutor pentru filtrare',
  addToFilter: 'Adaugă la filtru',
  filterDescHost: 'Potrivește numele hostului (subșir).',
  filterDescMethod: 'Metodă HTTP.',
  filterDescStatus: 'Cod de stare sau o clasă precum 4xx / 5xx.',
  filterDescType: 'Content-Type al răspunsului (alias content-type:).',
  filterDescKind: 'Tipul sesiunii.',
  filterDescPath: 'Calea URL (subșir; alias url:).',
  filterHelpIntro:
    'Tastați text liber pentru a potrivi hostul, calea, metoda, starea, tipul sau Content-Type. Folosiți <code>field:value</code> pentru potriviri precise și separați termenii cu <strong>virgule</strong> pentru a potrivi <strong>oricare</strong> dintre ei (OR).',
  filterHelpNoteLead: 'Exemplu: ',
  filterHelpNoteExplain:
    ' afișează orice sesiune pe roku.com <em>sau</em> cu o stare 4xx <em>sau</em> care folosește POST. Faceți clic pe orice exemplu pentru a-l adăuga.',

  // ── Port-conflict modal (port-conflict-modal.ts) ─────────────────────────────────────
  holderAnotherApp: 'Altă aplicație',
  holderWithPid: (name: string, pid: number): string => `${name} (PID ${pid})`,
  holderPidOnly: (pid: number): string => `PID ${pid}`,
  portResolvedTitle: 'Port proxy disponibil',
  portResolvedMsg:
    'Portul proxy este din nou liber — Inspector de rețea poate captura trafic. Acest mesaj se închide automat.',
  recheckStatus: 'Reverifică starea',
  openNetworkInspectorSettings: 'Deschide setările Inspector de rețea',

  // ── Traffic-rules modal (traffic-rules-modal.ts) ─────────────────────────────────────
  trafficRules: 'Reguli de trafic',
  deviceFallbackName: 'Dispozitiv Roku',
  serialTitle: (serial: string): string => `Serie ${serial}`,
  rulesNote:
    'Se aplică doar traficului pe care acest dispozitiv îl direcționează prin proxy-ul Roku Dev Studio — restul traficului său (fără proxy) nu este afectat. Modificările intră în vigoare imediat.',
  deviceTrafficTitle: 'Traficul dispozitivului',
  blockAllTitle: 'Blochează tot traficul prin proxy',
  blockAllDesc: 'Respinge fiecare cerere direcționată prin proxy.',
  bandwidthLimit: 'Limită de lățime de bandă',
  addedLatency: 'Latență adăugată',
  addedLatencyMsTitle: 'Latență adăugată (ms)',
  hostsBlockedNote: 'Regulile per host nu se aplică atât timp cât tot traficul prin proxy este blocat.',
  perHostRules: 'Reguli per host',
  addHostTitle:
    'Host sau host/path. Folosiți * ca metacaracter (de ex. *.example.com potrivește prod + staging, /v1/* potrivește orice cale sub /v1/).',
  noRulesYet: 'Încă nicio regulă — adăugați un host sau o cale mai sus pentru a-i suprascrie comportamentul.',
  saveChanges: 'Salvează modificările',
  restartToSave: 'Reporniți Roku Dev Studio pentru a permite salvarea Regulilor de trafic.',
  failedSaveRules: 'Salvarea Regulilor de trafic a eșuat.',
  // Rewrite op type labels (dropdown options).
  rwRedirectHost: 'Redirecționează hostul',
  rwSetPath: 'Setează calea',
  rwSetQuery: 'Setează parametrul de interogare',
  rwRemoveQuery: 'Elimină parametrul de interogare',
  rwSetHeader: 'Setează antetul',
  rwRemoveHeader: 'Elimină antetul',
  rwBodyReplace: 'Înlocuiește în corp',
  rwSetStatus: 'Setează starea',
  // Rewrite op field placeholders.
  rwHeaderName: 'Nume antet',
  rwValue: 'Valoare',
  rwStatusCode: 'Cod de stare (de ex. 503)',
  rwHostOrHostPort: 'host sau host:port',
  rwNewPath: '/new/path',
  rwParamName: 'Nume parametru',
  rwFind: 'Găsește',
  rwReplaceWith: 'Înlocuiește cu',
  // Rewrite op row chrome.
  rewriteTargetAria: 'Țintă rescriere',
  rewriteTypeAria: 'Tip rescriere',
  regexTreatTitle: 'Tratează Găsește ca expresie regulată',
  regexLabel: 'regex',
  removeRewrite: 'Elimină rescrierea',
  rewriteTitle: 'Rescriere',
  rewriteHint: 'Se aplică la redirecționare (nu cu Blochează / Resetează / Simulează)',
  addRewrite: '+ Adaugă rescriere',
  // Per-host rule scope badges.
  scopeWildcardPath: 'Cale cu metacaracter',
  scopeSinglePath: 'Cale unică',
  scopeWildcardHost: 'Host cu metacaracter',
  scopeAllRequests: 'Toate cererile',
  // Per-host rule controls.
  collapseExpandRule: 'Restrânge / extinde regula',
  editUrl: 'Editează URL-ul',
  editInterceptUrlAria: 'Editează URL-ul de interceptare',
  deleteRule: 'Șterge regula',
  block: 'Blochează',
  resetTitle: 'Întrerupe conexiunea (simulează o eroare de rețea)',
  mock: 'Simulează',
  mockTitle: 'Returnează un răspuns predefinit în loc să redirecționeze în amonte',
  latencyPlaceholder: 'Latență',
  mockFieldStatus: 'Stare',
  mockFieldContentType: 'Content-Type',
  mockFieldDelay: 'Întârziere',
  httpStatusCodeTitle: 'Cod de stare HTTP',
  delayTitle: 'Întârziere înainte de a răspunde (ms)',
  mockBodyPlaceholder: 'Corpul răspunsului (de ex. {&quot;error&quot;:&quot;forced&quot;})',
  // Bandwidth preset/label/placeholder for the "no cap" option (kbps 0). The other presets
  // ('8 Mbps', '512 kbps', …) are units and stay verbatim in BW_OPTIONS. NOTE: parseBandwidth()
  // treats any non-numeric text as 0, so this translated word still round-trips to "no cap".
  bandwidthUnlimited: 'Nelimitat',
  bwCustomTitle: 'Alegeți o presetare sau introduceți o limită personalizată (de ex. 3 Mbps sau 1500 kbps)',
  bwPresetsAria: 'Afișează presetările de lățime de bandă',
  throttleCapSpeed: (limit: string): string => `viteza este limitată la Limita dispozitivului (${limit})`,
  throttleFloorLatency: (ms: number): string => `latența este ridicată la Latența dispozitivului (${ms} ms)`,
  throttleNote: (parts: string[]): string => `Per host, ${parts.join(' și ')}.`,

  // ── Find-in-content modal (network-find-modal.ts) ────────────────────────────────────
  chipUrl: 'URL',
  chipRequest: 'Corpul cererii',
  chipResponse: 'Corpul răspunsului',
  chipHeaders: 'Antete',
  chipUrlTitle: 'URL-ul cererii, numele hostului și SNI',
  chipRequestTitle: 'Sarcina utilă a cererii',
  chipResponseTitle: 'Sarcina utilă a răspunsului',
  chipHeadersTitle: 'Antetele cererii și răspunsului',
  noMatches: 'Nicio potrivire',
  requestCount: (n: number): string => {
    const de = n === 0 || n % 100 === 0 || (n % 100 >= 20 && n % 100 <= 99);
    return `${n} ${de ? 'de ' : ''}${n === 1 ? 'cerere' : 'cereri'}`;
  },
  hitCount: (n: number): string => {
    const de = n === 0 || n % 100 === 0 || (n % 100 >= 20 && n % 100 <= 99);
    return ` · ${n} ${de ? 'de ' : ''}${n === 1 ? 'potrivire' : 'potriviri'}`;
  },
  setColorAria: (c: string): string => `Setează culoarea ${c}`,
  customColorTitle: 'Culoare personalizată…',
  customColorAria: 'Culoare personalizată',
  hexColorAria: 'Culoare hex',
  changeColorTitle: 'Schimbă culoarea',
  changeColorAria: 'Schimbă culoarea termenului',
  findPlaceholder: 'Găsește',
  searchTermAria: 'Termen de căutare',
  clearText: 'Șterge textul',
  matchCase: 'Potrivește majuscule',
  useRegexTitle: 'Folosește expresie regulată',
  deleteSearchEntry: 'Șterge intrarea de căutare',
  regexLikeHint: 'Aceasta pare a fi o expresie regulată.',
  useRegexBtn: 'Folosește regex',
  findAriaLabel: 'Găsește în traficul de rețea',
  findTitle: 'Găsește în trafic',
  closeEsc: 'Închide (Esc)',
  addSearchEntryTitle: 'Adaugă altă intrare de căutare',
  addSearchEntry: '+ Caută mai mult…',
  noteColor: 'Fiecare termen primește o culoare; o cerere afișează culoarea fiecărui termen care se potrivește.',
  noteWhitespace: 'Spațiile albe sunt ignorate — atât corpurile minificate, cât și cele formatate se potrivesc.',
  noteBinary: 'Corpurile binare (base64) nu sunt căutate.',
  noteEnter: 'Apăsați <kbd>Enter</kbd> pentru a sări la prima potrivire și a închide.',
  noteShiftEnter: (max: number): string =>
    `<kbd>Shift</kbd>+<kbd>Enter</kbd> adaugă alt termen (până la ${max}).`,
  noteArrows: '<kbd>Shift</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> (sau săgețile din antet) navighează între potriviri.',

  // ── Live tab (network-tab.ts) ────────────────────────────────────────────────────────
  capNotice: (shown: number, total: number): string => {
    const de = total === 0 || total % 100 === 0 || (total % 100 >= 20 && total % 100 <= 99);
    return `Se afișează cele mai recente ${shown} din ${total} ${de ? 'de ' : ''}sesiuni — folosiți filtrul pentru a restrânge rezultatele.`;
  },
  loadingData: 'Se încarcă datele capturate…',
  // Large-body "shown as raw text" explainer modal.
  shownAsRawText: 'Afișat ca text brut',
  thisBody: 'Acest corp',
  largeBodyIntro: (sizeLabel: string, limitKb: string): string =>
    `Acest corp are <strong>${sizeLabel}</strong> — mai mult decât limita de ${limitKb} KB pentru a reda un arbore JSON/XML pliabil, cu evidențierea sintaxei. Pentru a menține inspectorul receptiv, <strong>întregul</strong> corp este afișat în schimb ca text brut. Nimic nu este trunchiat sau ascuns.`,
  largeBodyNote:
    'Copiază, Salvează și Găsește funcționează în continuare pe întregul corp. Fragmentele JSON/XML încorporate rămân accesibile prin clic. Selectați un răspuns mai mic pentru a vedea arborele formatat.',
  // Empty-state hints.
  noProxiedSessions: 'Încă nicio sesiune prin proxy.',
  noSessions: 'Încă nicio sesiune.',
  proxyAddrFallback: 'machine-ip:8888',
  gatewayAddrFallback: 'gateway:8888',
  anotherApp: 'altă aplicație',
  mitmActiveLine: (addr: string): string =>
    `Proxy-ul MITM este activ la <strong>${addr}</strong> — direcționați prin el cererile canalului Dev pentru a le captura.`,
  mitmPortConflictLine: (port: number, who: string): string =>
    `Proxy-ul MITM nu poate folosi portul ${port} — ${who} îl folosește. Faceți clic pe <strong>Port proxy indisponibil</strong> de mai sus pentru a-l închide sau a schimba portul.`,
  mitmFailedLine: (err: string): string => `Proxy-ul MITM nu a putut porni: ${err}.`,
  mitmStarting: 'Proxy-ul MITM pornește — relansați Roku Dev Studio dacă persistă.',
  enableMitmSettings: 'Activați <strong>proxy-ul MITM</strong> în Setări → Inspector de rețea.',
  hotspotBlockedMitmLine: (addr: string): string =>
    `Captura hotspot este blocată, dar proxy-ul MITM de la <strong>${addr}</strong> poate în continuare înregistra cererile prin proxy. Folosiți <code>host:port</code> doar în BrightScript (de ex. <code>192.168.2.1:8888</code>), nu IP-ul dispozitivului și nu <code>http://</code>.`,
  mitmActiveNoCaptureLine: (addr: string): string =>
    `Proxy-ul MITM este activ la <code class="ni-hint-code">${addr}</code>. Direcționați canalul dev prin el pentru a captura cererile de rețea.`,
  mitmDecryptingHint: ' Proxy-ul MITM decriptează HTTPS-ul canalului dev direcționat prin Roku Dev Studio.',
  hotspotEncryptedHint: ' Corpurile HTTPS sunt criptate în modul de captură hotspot — activați MITM în Setări pentru canalele Dev.',
  capturingOnHotspot: 'Se capturează pe hotspot. Navigați sau redați conținut pe Roku.',
  connectWifiHint:
    'Conectați Roku la aceeași rețea Wi‑Fi (sau la hotspotul mașinii dvs.), apoi activați <strong>proxy-ul MITM</strong> în Setări → Inspector de rețea pentru a captura HTTPS-ul canalului dev.',
  sessionListAria: 'Lista sesiunilor de rețea. Folosiți tastele săgeți pentru a naviga.',
  // Layout toggle.
  layoutToggleTitle: (stacked: boolean): string =>
    `Panourile de cerere și răspuns - ${stacked ? 'Unul lângă altul' : 'Stivuite vertical'}`,
  // "Proxied" filter tooltips.
  proxiedLockedTitle:
    'Tot traficul este direcționat prin proxy prin Roku Dev Studio în acest mod, așa că este mereu activ. Acest control va fi activat când dispozitivul Roku este conectat prin hotspot.',
  proxiedUnlockedTitle:
    'Afișează doar cererile direcționate prin proxy prin Roku Dev Studio (antete complete + corp), ascunzând metadatele SNI/DNS din captura hotspot',
  // Media context menu + save dialogs.
  copyImage: 'Copiază imaginea',
  saveImageAs: 'Salvează imaginea ca…',
  saveFile: 'Salvează fișierul…',
  saveImageDialog: 'Salvează imaginea',
  saveFileDialog: 'Salvează fișierul',
  // Export toasts + dialogs.
  fileFallback: 'fișier',
  savedPackets: (n: number, path: string): string => {
    const de = n === 0 || n % 100 === 0 || (n % 100 >= 20 && n % 100 <= 99);
    return `${n === 1 ? 'S-a salvat' : 'S-au salvat'} ${n} ${de ? 'de ' : ''}${n === 1 ? 'pachet' : 'pachete'} în ${path}.`;
  },
  failedSavePcap: 'Salvarea capturii de pachete a eșuat.',
  noRequestsToExport: 'Nicio cerere de exportat.',
  noHttpToExport: 'Nicio tranzacție HTTP de exportat ca HAR.',
  exportHarDialog: 'Exportă sesiunile ca HAR',
  exportSessionDialog: 'Exportă sesiunea de rețea',
  // Native save-dialog titles + filter names (main/ipc/network-inspector-handlers.ts).
  exportDialogTitles: {
    savePcap: 'Salvează captura de pachete',
    pcapFilter: 'Wireshark PCAP',
    caPem: 'Exportă certificatul CA RDS (PEM)',
    pemFilter: 'Certificat PEM',
    caCrt: 'Exportă certificatul CA RDS (CRT)',
    certFilter: 'Certificat'
  },
  exportedRequests: (n: number, path: string): string => {
    const de = n === 0 || n % 100 === 0 || (n % 100 >= 20 && n % 100 <= 99);
    return `${n === 1 ? 'S-a exportat' : 'S-au exportat'} ${n} ${de ? 'de ' : ''}${n === 1 ? 'cerere' : 'cereri'} în ${path}.`;
  },
  failedExportSession: 'Exportarea sesiunii a eșuat.',
  // Session count tooltips.
  countMatchingTitle: (visible: number, captured: number): string => {
    const de = captured === 0 || captured % 100 === 0 || (captured % 100 >= 20 && captured % 100 <= 99);
    return `${visible} potrivite din ${captured} ${de ? 'de ' : ''}sesiuni capturate`;
  },
  capturedSessionsTitle: (n: number): string =>
    n === 1
      ? '1 sesiune capturată'
      : `${n} ${n % 100 === 0 || (n % 100 >= 20 && n % 100 <= 99) ? 'de ' : ''}sesiuni capturate`,
  // Capture-button "blocked" tooltips.
  issuePortInUse: (port: number, who: string): string =>
    `Inspector de rețea indisponibil — portul ${port} este în uz${who}.`,
  issueMitm: (err: string): string => `Problemă Inspector de rețea — proxy MITM: ${err}`,
  captureErrorFallback: 'Eroare Inspector de rețea',
  stopCapturing: 'Oprește captura',
  startCapturing: 'Începe captura',
  setupNotAvailable: 'Configurarea nu este disponibilă în această versiune.',
  // Header setup badge.
  captureBlocked: 'Captură blocată',
  captureSetup: 'Configurare captură',
  setupBadgeTitlePrereq: (title: string): string => `${title} — faceți clic pentru instrucțiunile de configurare`,
  setupBadgeTitle: 'Configurare captură hotspot — faceți clic pentru instrucțiuni',
  // Header port badge.
  portBadgeTitle: (title: string): string => `${title} — faceți clic pentru detalii`,

  // ══ Network Inspector additions ═══════════════════════════════════════════════
  // Copy URL action (network-detail-view.ts copy menu).
  copyUrl: 'Copiază URL-ul',

  // Traffic-rule presets — device-wide toggles (traffic-rules-modal.ts).
  noCachingTitle: 'Fără cache',
  noCachingDesc: 'Elimină antetele de cache și forțează Cache-Control: no-store în răspunsuri.',
  blockCookiesTitle: 'Blochează cookie-urile',
  blockCookiesDesc: 'Elimină Cookie din cereri și Set-Cookie din răspunsuri.',

  // Parsed detail viewers — Cookies tabs (network-detail.ts, network-parsed-tables.ts).
  tabCookies: 'Cookie-uri',
  colName: 'Nume',
  colValue: 'Valoare',
  colAttributes: 'Atribute',
  noResponseCookies: 'Niciun cookie setat de acest răspuns.',

  // Editable per-request note (network-detail.ts Overview + list marker).
  secNote: 'Notă',
  notePlaceholder: 'Adăugați o notă…',
  noteAriaLabel: 'Notă pentru această cerere',
  noteMarkerAria: 'Are o notă',

  // Map Local — file-backed mock response (traffic-rules-modal.ts + proxy).
  mockFieldFile: 'Fișier local',
  mockChooseFile: 'Alegeți fișierul…',
  mockFilePlaceholder: 'Niciun fișier ales',
  mockFileClearAria: 'Șterge fișierul mapat',
  mockFileServingBody: 'Corpul răspunsului este servit din fișierul mapat.',
  mapLocalHint:
    'Servește un fișier local drept corpul răspunsului. Content-Type este dedus din extensia fișierului dacă nu este setat mai sus.',
  mapLocalDialogTitle: 'Alegeți un fișier de servit',
  mapLocalAllFilesFilter: 'Toate fișierele',

  // Focus hosts (network-session-view.ts + sidebar toggles).
  focusHost: (host: string): string => `Focalizează ${host}`,
  unfocusHost: (host: string): string => `Anulează focalizarea ${host}`,
  clearFocusedHosts: 'Șterge hosturile focalizate',

  // Replay / Compose (network-detail-view.ts action + network-compose-modal.ts).
  replay: 'Reia',
  replayTitle: 'Reia această cerere de la host',
  replayAria: 'Reia cererea',
  moreReplayOptions: 'Mai multe opțiuni de reluare',
  replayNow: 'Reia acum',
  composeItem: 'Editează și retrimite…',
  composeTitle: 'Editează și retrimite',
  composeNote: 'Reemite această cerere de la host. Editați metoda, URL-ul, antetele sau corpul înainte de trimitere.',
  composeMethodLabel: 'Metodă',
  composeUrlLabel: 'URL',
  composeParamsLabel: 'Parametri de interogare',
  composeAddRow: '+ Adaugă',
  composeRowEnabledAria: 'Include această intrare',
  composeSelectAllAria: 'Comută toate intrările',
  composeHeadersLabel: 'Antete',
  composeBodyLabel: 'Corp',
  composeBodyPlaceholder: 'Corpul cererii',
  composeBinaryBodyNote:
    'Corpul capturat al cererii este binar și este trimis neschimbat; nu poate fi editat aici.',
  composeApplyRules: 'Aplică regulile de trafic active',
  composeApplyRulesTitle: 'Rulează reluarea prin regulile de blocare, rescriere și limitare ale acestui dispozitiv',
  composeSend: 'Trimite',
  composeSending: 'Se trimite…',
  replayAddedToList: 'Răspuns adăugat la lista de sesiuni.',
  replayFailed: (err: string): string => `Reluarea a eșuat: ${err}`,
  replayInvalidUrl: 'Introduceți un URL http:// sau https:// valid.',
  replayUnavailable: 'Reluarea nu este disponibilă în această versiune.',
  replayStarting: 'Se reia…',
  tagsReplayed: 'Reluat',
  replayedBadgeTitle: 'Acest răspuns a fost produs prin reluarea unei cereri capturate de la host',

  // Timing waterfall (network-detail.ts Overview timing section).
  ovDuration: 'Durată',
  wfDns: 'DNS',
  wfConnect: 'Conectare',
  wfTls: 'TLS',
  wfSend: 'Trimitere',
  wfWait: 'Așteptare (TTFB)',
  wfReceive: 'Descărcare',
  wfMs: (n: number): string => `${n} ms`,
  wfSeconds: (s: number): string => `${s.toFixed(2)} s`,
  wfSegmentTitle: (label: string, value: string): string => `${label}: ${value}`,
  wfAria: 'Defalcarea cronometrării cererii'
};
