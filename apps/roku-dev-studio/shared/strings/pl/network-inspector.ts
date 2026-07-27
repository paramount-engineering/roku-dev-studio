/**
 * Polish (pl) translation of the Network Inspector strings — the live capture
 * tab, its modals (traffic rules, find-in-content, hotspot setup, port conflict,
 * large-body info, filter help), and the detail renderers shared with the
 * standalone Session Viewer. Sibling of ../network-inspector.ts — same
 * `networkInspector` shape, keys, order, and function signatures.
 *
 * Some values intentionally embed HTML markup (<strong>, <code>, <kbd>, <em>)
 * because they're injected via innerHTML. Only literal display text is translated;
 * product / feature names, tech tokens, code literals, and placeholders are kept
 * verbatim. Count-based functions apply Polish (Slavic) 3-form plural logic.
 */
export const networkInspector = {
  // Section identity (used as a title prefix for the shared URL / structured viewers).
  titlePrefix: 'Inspektor sieci',

  // ── Shared detail pane chrome (network-detail-view.ts) ──────────────────────────────
  emptyDetail: 'Wybierz sesję, aby przejrzeć żądanie i odpowiedź.',
  request: 'Żądanie',
  response: 'Odpowiedź',
  tabOverview: 'Przegląd',
  tabBody: 'Treść',
  tabHeaders: 'Nagłówki',
  copyRequestBody: 'Kopiuj treść żądania',
  copyResponseBody: 'Kopiuj treść odpowiedzi',
  moreCopyOptions: 'Więcej opcji kopiowania',
  copyBody: 'Kopiuj treść',
  copyAsCurl: 'Kopiuj jako cURL',
  copyAsHar: 'Kopiuj jako HAR',
  bodyTruncated: 'Treść skrócona',
  bodyTruncatedRequestTitle:
    'Przechwycona kopia tej treści przekroczyła limit wyświetlania inspektora, więc to, co jest tu pokazane, jest niekompletne. Pełna treść została mimo to dostarczona do serwera nadrzędnego. Użyj opcji Kopiuj dla przechwyconej części.',
  bodyTruncatedResponseTitle:
    'Przechwycona kopia tej treści przekroczyła limit wyświetlania inspektora, więc to, co jest tu pokazane, jest niekompletne. Pełna treść została mimo to dostarczona do Roku. Użyj opcji Kopiuj dla przechwyconej części.',
  disableWordWrap: 'Wyłącz zawijanie wierszy',
  enableWordWrap: 'Włącz zawijanie wierszy',
  toggleWordWrap: 'Przełącz zawijanie wierszy',
  formatLabel: 'Format',
  formatAuto: 'Auto',
  formatJson: 'JSON',
  formatXml: 'XML',
  formatRaw: 'Surowy',
  whyRawText: 'Dlaczego jest to wyświetlane jako surowy tekst?',

  // ── Session list rows (network-session-view.ts) ─────────────────────────────────────
  noMatchingSessions: 'Brak pasujących sesji.',
  noHostsYet: 'Brak hostów. Struktura grupuje ruch według nazwy hosta.',
  sslDecryptedTitle: 'Odszyfrowane (MITM)',
  sslEncryptedTitle: 'HTTPS (zaszyfrowane)',
  sessionNumber: (n: number): string => `Sesja #${n}`,
  requestNumber: (n: number): string => `Żądanie #${n}`,
  expandAllGroups: 'Rozwiń wszystkie grupy',
  collapseAllGroups: 'Zwiń wszystkie grupy',

  // ── Session-list derived tokens (network-sessions.ts) ───────────────────────────────
  // Duration column value while a transaction is still open (distinct from the
  // status pill — has a trailing ellipsis and is the duration cell).
  durationPending: 'Oczekiwanie…',
  // Status-pill tokens for the session list. eventToSession() assigns session.status
  // FROM these constants and statusClass()/the status filter compare against the raw
  // English literals ('Pending', …), so these MUST stay byte-identical to English —
  // do not translate them or the status styling/filtering breaks.
  listStatusPending: 'Pending',
  listStatusQuery: 'Query',
  listStatusOk: 'OK',
  listStatusOpen: 'Open',
  // DNS structure-tree leaf / sidebar path labels.
  dnsQueryLabel: 'Zapytanie DNS',
  dnsResponseLabel: 'Odpowiedź DNS',

  // ── Detail renderers (network-detail.ts) ────────────────────────────────────────────
  // Synthetic first-row header of the response Headers table (HTTP/RFC start-line term — verbatim).
  statusLine: 'Status-Line',
  noHeaders: '(brak nagłówków)',
  noRequestBody: '(brak treści żądania)',
  noResponseBody: '(brak treści odpowiedzi)',
  emptyResponseBody: '(pusta treść odpowiedzi)',
  waitingForResponse: '(oczekiwanie na odpowiedź…)',
  encryptedNoHeaders: '(zaszyfrowane — brak nagłówków)',
  dnsNoHeaders: '(DNS — brak nagłówków HTTP)',
  dnsAnswerEmpty: '(puste)',
  dnsPending: '(oczekiwanie)',
  noResponseBodyCaptured: '(nie przechwycono treści odpowiedzi)',
  httpsResponseEncrypted: 'Treść odpowiedzi HTTPS jest zaszyfrowana. Włącz serwer proxy MITM, aby przeglądać treści tutaj.',
  // Media-preview fallbacks + captions.
  mimeContent: 'zawartość',
  mimeBinary: 'binarna',
  mimeUnknownType: 'nieznany typ',
  responseImageAlt: 'Podgląd obrazu odpowiedzi',
  binaryTruncatedNote: (mime: string): string =>
    `Dane binarne ${mime} zostały skrócone podczas przechwytywania — podgląd niedostępny. Użyj opcji Kopiuj dla przechwyconego base64.`,
  binaryNotPreviewable: (mime: string, size: string): string =>
    `Zawartość binarna (${mime}, ~${size}) — brak podglądu. Użyj opcji Kopiuj dla przechwyconego base64.`,
  // Overview: request Status row values (display-only; distinct from the session-list status tokens).
  statusPending: 'Oczekiwanie',
  statusComplete: 'Zakończone',
  statusFailed: 'Niepowodzenie',
  // Overview: row + section labels.
  ovType: 'Typ',
  ovTime: 'Czas',
  ovDevice: 'Urządzenie',
  ovHost: 'Host',
  ovDestination: 'Miejsce docelowe',
  ovUrl: 'URL',
  ovStatus: 'Status',
  ovResponseCode: 'Kod odpowiedzi',
  ovProtocol: 'Protokół',
  ovMethod: 'Metoda',
  requestContentType: 'Content-Type żądania',
  responseContentType: 'Content-Type odpowiedzi',
  ovClientAddress: 'Adres klienta',
  ovRemoteAddress: 'Adres zdalny',
  ovTags: 'Tagi',
  ovDns: 'DNS',
  ovNotes: 'Notatki',
  ovRequestStart: 'Początek żądania',
  ovTotal: 'Łącznie',
  secTls: 'TLS',
  secTiming: 'Pomiary czasu',
  secSize: 'Rozmiar',
  viewUrlTitle: 'Wyświetl URL i parametry zapytania',
  tagsMitmDecrypted: 'MITM · Odszyfrowane',
  protocolHttpsDecrypted: 'HTTPS (odszyfrowane przez serwer proxy MITM Roku Dev Studio)',
  protocolHttpsEncrypted: 'HTTPS (zaszyfrowane)',
  notesProxied: 'Żądanie przez proxy — nadrzędne TLS zakończone w Roku Dev Studio',
  notesHotspot: 'Przechwytywanie hotspotu — treści niedostępne bez MITM',
  typeHttpsTlsHandshake: 'HTTPS (uzgadnianie TLS)',
  unknownHost: 'nieznany-host',
  dnsQueryValue: (host: string): string => `Zapytanie ${host}`,
  dnsBody: (isQuery: boolean, host: string): string => `DNS ${isQuery ? 'zapytanie' : 'odpowiedź'}: ${host}`,
  httpsRequestFallback: (host: string, port: string): string =>
    `CONNECT ${host}${port} (HTTPS — zaszyfrowane)\n\nPrzechwytywanie hotspotu widzi tylko uzgadnianie TLS (SNI + IP), a nie treści JSON.\n\nWłącz MITM w Ustawieniach i skieruj kanał przez Roku Dev Studio, aby przeglądać treści.`,

  // ── Embedded JSON/XML fragment highlight (network-embedded-structured.ts) ────────────
  embeddedViewTitle: (label: string): string => `Kliknij, aby wyświetlić sformatowany ${label} (otwiera się w oknie modalnym)`,

  // ── Hotspot Capture Setup modal (hotspot-setup-modal.ts) ─────────────────────────────
  setupPacketCapture: 'Skonfiguruj przechwytywanie pakietów',
  requestingCaptureAccess: 'Żądanie dostępu do przechwytywania…',
  captureAccessGranted: 'Przyznano dostęp do przechwytywania.',
  setupCancelled: 'Konfiguracja została anulowana.',
  setupFailed: 'Konfiguracja nie powiodła się.',
  setupFailedRetry: 'Konfiguracja nie powiodła się — spróbuj ponownie.',

  // ── Filter-syntax help modal (network-filter-help.ts) ────────────────────────────────
  filterHelpHeading: 'Filtrowanie sesji',
  filterHelpAria: 'Pomoc dotycząca filtrowania',
  addToFilter: 'Dodaj do filtra',
  filterDescHost: 'Dopasuj nazwę hosta (podciąg).',
  filterDescMethod: 'Metoda HTTP.',
  filterDescStatus: 'Kod statusu lub klasa, np. 4xx / 5xx.',
  filterDescType: 'Content-Type odpowiedzi (alias content-type:).',
  filterDescKind: 'Rodzaj sesji.',
  filterDescPath: 'Ścieżka URL (podciąg; alias url:).',
  filterHelpIntro:
    'Wpisz dowolny tekst, aby dopasować host, ścieżkę, metodę, status, rodzaj lub Content-Type. Użyj <code>field:value</code> do precyzyjnych dopasowań i oddzielaj terminy <strong>przecinkami</strong>, aby dopasować <strong>dowolny</strong> z nich (OR).',
  filterHelpNoteLead: 'Przykład: ',
  filterHelpNoteExplain:
    ' pokazuje dowolną sesję na roku.com <em>lub</em> ze statusem 4xx <em>lub</em> używającą POST. Kliknij dowolny przykład, aby go dodać.',

  // ── Port-conflict modal (port-conflict-modal.ts) ─────────────────────────────────────
  holderAnotherApp: 'Inna aplikacja',
  holderWithPid: (name: string, pid: number): string => `${name} (PID ${pid})`,
  holderPidOnly: (pid: number): string => `PID ${pid}`,
  portResolvedTitle: 'Port proxy dostępny',
  portResolvedMsg:
    'Port proxy jest znów wolny — Inspektor sieci może przechwytywać ruch. Ten komunikat zamknie się automatycznie.',
  recheckStatus: 'Sprawdź status ponownie',
  openNetworkInspectorSettings: 'Otwórz ustawienia Inspektor sieci',

  // ── Traffic-rules modal (traffic-rules-modal.ts) ─────────────────────────────────────
  trafficRules: 'Reguły ruchu',
  deviceFallbackName: 'Urządzenie Roku',
  serialTitle: (serial: string): string => `Numer seryjny ${serial}`,
  rulesNote:
    'Dotyczy tylko ruchu, który to urządzenie kieruje przez serwer proxy Roku Dev Studio — pozostały ruch (bez proxy) pozostaje bez zmian. Zmiany obowiązują natychmiast.',
  deviceTrafficTitle: 'Ruch urządzenia',
  blockAllTitle: 'Blokuj cały ruch przez proxy',
  blockAllDesc: 'Odrzucaj każde żądanie kierowane przez proxy.',
  bandwidthLimit: 'Limit przepustowości',
  addedLatency: 'Dodane opóźnienie',
  addedLatencyMsTitle: 'Dodane opóźnienie (ms)',
  hostsBlockedNote: 'Reguły dla poszczególnych hostów nie obowiązują, gdy cały ruch przez proxy jest zablokowany.',
  perHostRules: 'Reguły dla poszczególnych hostów',
  addHostTitle:
    'Host lub host/ścieżka. Użyj * jako symbolu wieloznacznego (np. *.example.com pasuje do prod + staging, /v1/* pasuje do dowolnej ścieżki w /v1/).',
  noRulesYet: 'Brak reguł — dodaj host lub ścieżkę powyżej, aby zmienić jego zachowanie.',
  saveChanges: 'Zapisz zmiany',
  restartToSave: 'Uruchom ponownie Roku Dev Studio, aby włączyć zapisywanie Reguł ruchu.',
  failedSaveRules: 'Nie udało się zapisać Reguł ruchu.',
  // Rewrite op type labels (dropdown options).
  rwRedirectHost: 'Przekieruj host',
  rwSetPath: 'Ustaw ścieżkę',
  rwSetQuery: 'Ustaw parametr zapytania',
  rwRemoveQuery: 'Usuń parametr zapytania',
  rwSetHeader: 'Ustaw nagłówek',
  rwRemoveHeader: 'Usuń nagłówek',
  rwBodyReplace: 'Zamień w treści',
  rwSetStatus: 'Ustaw status',
  // Rewrite op field placeholders.
  rwHeaderName: 'Nazwa nagłówka',
  rwValue: 'Wartość',
  rwStatusCode: 'Kod statusu (np. 503)',
  rwHostOrHostPort: 'host lub host:port',
  rwNewPath: '/new/path',
  rwParamName: 'Nazwa parametru',
  rwFind: 'Znajdź',
  rwReplaceWith: 'Zamień na',
  // Rewrite op row chrome.
  rewriteTargetAria: 'Cel przepisywania',
  rewriteTypeAria: 'Typ przepisywania',
  regexTreatTitle: 'Traktuj pole „Znajdź” jako wyrażenie regularne',
  regexLabel: 'Regex',
  removeRewrite: 'Usuń przepisywanie',
  rewriteTitle: 'Przepisywanie',
  rewriteHint: 'Stosowane podczas przekazywania (nie z Blokuj / Resetuj / Symuluj)',
  addRewrite: '+ Dodaj przepisywanie',
  // Per-host rule scope badges.
  scopeWildcardPath: 'Ścieżka wieloznaczna',
  scopeSinglePath: 'Pojedyncza ścieżka',
  scopeWildcardHost: 'Host wieloznaczny',
  scopeAllRequests: 'Wszystkie żądania',
  // Per-host rule controls.
  collapseExpandRule: 'Zwiń / rozwiń regułę',
  editUrl: 'Edytuj URL',
  editInterceptUrlAria: 'Edytuj URL przechwytywania',
  deleteRule: 'Usuń regułę',
  block: 'Blokuj',
  resetTitle: 'Przerwij połączenie (symuluj awarię sieci)',
  mock: 'Symuluj',
  mockTitle: 'Zwróć gotową odpowiedź zamiast przekazywać do serwera nadrzędnego',
  latencyPlaceholder: 'Opóźnienie',
  mockFieldStatus: 'Status',
  mockFieldContentType: 'Content-Type',
  mockFieldDelay: 'Opóźnienie',
  httpStatusCodeTitle: 'Kod statusu HTTP',
  delayTitle: 'Opóźnienie przed odpowiedzią (ms)',
  mockBodyPlaceholder: 'Treść odpowiedzi (np. {&quot;error&quot;:&quot;forced&quot;})',
  // parseBandwidth() matches the lowercased literal 'unlimited', so this word must
  // stay round-trippable — keep it byte-identical to English (do not translate).
  bandwidthUnlimited: 'Bez limitu',
  bwCustomTitle: 'Wybierz predefiniowaną wartość lub wpisz własny limit (np. 3 Mbps lub 1500 kbps)',
  bwPresetsAria: 'Pokaż predefiniowane wartości przepustowości',
  throttleCapSpeed: (limit: string): string => `prędkość jest ograniczona do Limitu urządzenia (${limit})`,
  throttleFloorLatency: (ms: number): string => `opóźnienie nie jest mniejsze niż Opóźnienie urządzenia (${ms} ms)`,
  throttleNote: (parts: string[]): string => `Dla hosta ${parts.join(', a także ')}.`,

  // ── Find-in-content modal (network-find-modal.ts) ────────────────────────────────────
  chipUrl: 'URL',
  chipRequest: 'Treść żądania',
  chipResponse: 'Treść odpowiedzi',
  chipHeaders: 'Nagłówki',
  chipUrlTitle: 'URL żądania, nazwa hosta i SNI',
  chipRequestTitle: 'Ładunek żądania',
  chipResponseTitle: 'Ładunek odpowiedzi',
  chipHeadersTitle: 'Nagłówki żądania i odpowiedzi',
  noMatches: 'Brak dopasowań',
  requestCount: (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      n === 1
        ? 'żądanie'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'żądania'
          : 'żądań';
    return `${n} ${word}`;
  },
  hitCount: (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      n === 1
        ? 'trafienie'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'trafienia'
          : 'trafień';
    return ` · ${n} ${word}`;
  },
  setColorAria: (c: string): string => `Ustaw kolor ${c}`,
  customColorTitle: 'Własny kolor…',
  customColorAria: 'Własny kolor',
  hexColorAria: 'Kolor szesnastkowy',
  changeColorTitle: 'Zmień kolor',
  changeColorAria: 'Zmień kolor terminu',
  findPlaceholder: 'Znajdź',
  searchTermAria: 'Szukany termin',
  clearText: 'Wyczyść tekst',
  matchCase: 'Uwzględnij wielkość liter',
  useRegexTitle: 'Użyj wyrażenia regularnego',
  deleteSearchEntry: 'Usuń wpis wyszukiwania',
  regexLikeHint: 'To wygląda na wyrażenie regularne.',
  useRegexBtn: 'Użyj regex',
  findAriaLabel: 'Znajdź w ruchu sieciowym',
  findTitle: 'Znajdź w ruchu',
  closeEsc: 'Zamknij (Esc)',
  addSearchEntryTitle: 'Dodaj kolejny wpis wyszukiwania',
  addSearchEntry: '+ Szukaj więcej…',
  noteColor: 'Każdy termin otrzymuje kolor; żądanie pokazuje kolor każdego pasującego terminu.',
  noteWhitespace: 'Białe znaki są ignorowane — dopasowywane są zarówno zminimalizowane, jak i sformatowane treści.',
  noteBinary: 'Treści binarne (base64) nie są przeszukiwane.',
  noteEnter: 'Naciśnij <kbd>Enter</kbd>, aby przejść do pierwszego dopasowania i zamknąć.',
  noteShiftEnter: (max: number): string =>
    `<kbd>Shift</kbd>+<kbd>Enter</kbd> dodaje kolejny termin (maksymalnie ${max}).`,
  noteArrows: '<kbd>Shift</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> (lub strzałki w nagłówku) przechodzą między dopasowaniami.',

  // ── Live tab (network-tab.ts) ────────────────────────────────────────────────────────
  capNotice: (shown: number, total: number): string =>
    `Wyświetlanie ${shown} najnowszych z ${total} sesji — użyj filtra, aby zawęzić wyniki.`,
  loadingData: 'Ładowanie przechwyconych danych…',
  // Large-body "shown as raw text" explainer modal.
  shownAsRawText: 'Pokazane jako surowy tekst',
  thisBody: 'Ta treść',
  largeBodyIntro: (sizeLabel: string, limitKb: string): string =>
    `Ta treść ma <strong>${sizeLabel}</strong> — więcej niż limit ${limitKb} KB dla renderowania zwijanego drzewa JSON/XML z podświetlaniem składni. Aby inspektor pozostał responsywny, zamiast tego <strong>cała</strong> treść jest pokazywana jako surowy tekst. Nic nie jest skracane ani ukrywane.`,
  largeBodyNote:
    'Kopiuj, Zapisz i Znajdź nadal działają na pełnej treści. Osadzone fragmenty JSON/XML pozostają klikalne. Wybierz mniejszą odpowiedź, aby zobaczyć sformatowane drzewo.',
  // Empty-state hints.
  noProxiedSessions: 'Brak sesji przez proxy.',
  noSessions: 'Brak sesji.',
  proxyAddrFallback: 'machine-ip:8888',
  gatewayAddrFallback: 'gateway:8888',
  anotherApp: 'inna aplikacja',
  mitmActiveLine: (addr: string): string =>
    `Serwer proxy MITM jest aktywny pod adresem <strong>${addr}</strong> — kieruj przez niego żądania swojego kanału Dev, aby je przechwytywać.`,
  mitmPortConflictLine: (port: number, who: string): string =>
    `Serwer proxy MITM nie może użyć portu ${port} — używa go ${who}. Kliknij <strong>Port proxy niedostępny</strong> powyżej, aby go zamknąć lub zmienić port.`,
  mitmFailedLine: (err: string): string => `Nie udało się uruchomić serwera proxy MITM: ${err}.`,
  mitmStarting: 'Serwer proxy MITM się uruchamia — uruchom ponownie Roku Dev Studio, jeśli to się utrzymuje.',
  enableMitmSettings: 'Włącz <strong>serwer proxy MITM</strong> w Ustawienia → Inspektor sieci.',
  hotspotBlockedMitmLine: (addr: string): string =>
    `Przechwytywanie hotspotu jest zablokowane, ale serwer proxy MITM pod adresem <strong>${addr}</strong> nadal może rejestrować żądania przez proxy. Używaj <code>host:port</code> tylko w BrightScript (np. <code>192.168.2.1:8888</code>), a nie IP urządzenia i nie <code>http://</code>.`,
  mitmActiveNoCaptureLine: (addr: string): string =>
    `Serwer proxy MITM jest aktywny pod adresem <code class="ni-hint-code">${addr}</code>. Skieruj przez niego swój kanał dev, aby przechwytywać żądania sieciowe.`,
  mitmDecryptingHint: ' Serwer proxy MITM odszyfrowuje HTTPS kanału dev kierowany przez Roku Dev Studio.',
  hotspotEncryptedHint: ' Treści HTTPS są zaszyfrowane w trybie przechwytywania hotspotu — włącz MITM w Ustawieniach dla kanałów Dev.',
  capturingOnHotspot: 'Przechwytywanie na hotspocie. Przeglądaj lub odtwarzaj zawartość na Roku.',
  connectWifiHint:
    'Podłącz Roku do tej samej sieci Wi‑Fi (lub hotspotu swojego komputera), a następnie włącz <strong>serwer proxy MITM</strong> w Ustawienia → Inspektor sieci, aby przechwytywać HTTPS kanału dev.',
  sessionListAria: 'Lista sesji sieciowych. Użyj klawiszy strzałek do nawigacji.',
  // Layout toggle.
  layoutToggleTitle: (stacked: boolean): string =>
    `Panele żądania i odpowiedzi - ${stacked ? 'Obok siebie' : 'Ułóż pionowo'}`,
  // "Proxied" filter tooltips.
  proxiedLockedTitle:
    'W tym trybie cały ruch przechodzi przez proxy Roku Dev Studio, więc to jest zawsze włączone. Ten element sterujący zostanie włączony, gdy urządzenie Roku będzie podłączone przez hotspot.',
  proxiedUnlockedTitle:
    'Pokaż tylko żądania przez proxy Roku Dev Studio (pełne nagłówki + treść), ukrywając metadane SNI/DNS z przechwytywania hotspotu',
  // Media context menu + save dialogs.
  copyImage: 'Kopiuj obraz',
  saveImageAs: 'Zapisz obraz jako…',
  saveFile: 'Zapisz plik…',
  saveImageDialog: 'Zapisz obraz',
  saveFileDialog: 'Zapisz plik',
  // Export toasts + dialogs.
  fileFallback: 'plik',
  savedPackets: (n: number, path: string): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      n === 1
        ? 'pakiet'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'pakiety'
          : 'pakietów';
    return `Zapisano ${n} ${word} do ${path}.`;
  },
  failedSavePcap: 'Nie udało się zapisać przechwyconych pakietów.',
  noRequestsToExport: 'Brak żądań do wyeksportowania.',
  noHttpToExport: 'Brak transakcji HTTP do wyeksportowania jako HAR.',
  exportHarDialog: 'Eksportuj sesje jako HAR',
  exportSessionDialog: 'Eksportuj sesję sieciową',
  // Native save-dialog titles + filter names (main/ipc/network-inspector-handlers.ts).
  exportDialogTitles: {
    savePcap: 'Zapisz przechwycone pakiety',
    pcapFilter: 'Wireshark PCAP',
    caPem: 'Eksportuj certyfikat CA RDS (PEM)',
    pemFilter: 'Certyfikat PEM',
    caCrt: 'Eksportuj certyfikat CA RDS (CRT)',
    certFilter: 'Certyfikat'
  },
  exportedRequests: (n: number, path: string): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      n === 1
        ? 'żądanie'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'żądania'
          : 'żądań';
    return `Wyeksportowano ${n} ${word} do ${path}.`;
  },
  failedExportSession: 'Nie udało się wyeksportować sesji.',
  // Session count tooltips.
  countMatchingTitle: (visible: number, captured: number): string =>
    `${visible} pasujących z ${captured} przechwyconych sesji`,
  capturedSessionsTitle: (n: number): string => {
    if (n === 1) return '1 przechwycona sesja';
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'przechwycone sesje'
        : 'przechwyconych sesji';
    return `${n} ${word}`;
  },
  // Capture-button "blocked" tooltips.
  issuePortInUse: (port: number, who: string): string =>
    `Inspektor sieci niedostępny — port ${port} jest używany${who}.`,
  issueMitm: (err: string): string => `Problem z Inspektor sieci — serwer proxy MITM: ${err}`,
  captureErrorFallback: 'Błąd Inspektor sieci',
  stopCapturing: 'Zatrzymaj przechwytywanie',
  startCapturing: 'Rozpocznij przechwytywanie',
  setupNotAvailable: 'Konfiguracja jest niedostępna w tej kompilacji.',
  // Header setup badge.
  captureBlocked: 'Przechwytywanie zablokowane',
  captureSetup: 'Konfiguracja przechwytywania',
  setupBadgeTitlePrereq: (title: string): string => `${title} — kliknij, aby uzyskać instrukcje konfiguracji`,
  setupBadgeTitle: 'Konfiguracja przechwytywania hotspotu — kliknij, aby uzyskać instrukcje',
  // Header port badge.
  portBadgeTitle: (title: string): string => `${title} — kliknij, aby uzyskać szczegóły`,

  // ══ Network Inspector additions ═══════════════════════════════════════════════
  // Copy URL action (network-detail-view.ts copy menu).
  copyUrl: 'Kopiuj URL',

  // Traffic-rule presets — device-wide toggles (traffic-rules-modal.ts).
  noCachingTitle: 'Bez buforowania',
  noCachingDesc: 'Usuń nagłówki buforowania i wymuś Cache-Control: no-store w odpowiedziach.',
  blockCookiesTitle: 'Blokuj pliki cookie',
  blockCookiesDesc: 'Usuń Cookie z żądań i Set-Cookie z odpowiedzi.',

  // Parsed detail viewers — Cookies tabs (network-detail.ts, network-parsed-tables.ts).
  tabCookies: 'Cookies',
  colName: 'Nazwa',
  colValue: 'Wartość',
  colAttributes: 'Atrybuty',
  noResponseCookies: 'Ta odpowiedź nie ustawia plików cookie.',

  // Editable per-request note (network-detail.ts Overview + list marker).
  secNote: 'Notatka',
  notePlaceholder: 'Dodaj notatkę…',
  noteAriaLabel: 'Notatka do tego żądania',
  noteMarkerAria: 'Ma notatkę',

  // Map Local — file-backed mock response (traffic-rules-modal.ts + proxy).
  mockFieldFile: 'Plik lokalny',
  mockChooseFile: 'Wybierz plik…',
  mockFilePlaceholder: 'Nie wybrano pliku',
  mockFileClearAria: 'Wyczyść zmapowany plik',
  mockFileServingBody: 'Treść odpowiedzi jest serwowana ze zmapowanego pliku.',
  mapLocalHint:
    'Serwuj plik lokalny jako treść odpowiedzi. Content-Type jest wywnioskowany z rozszerzenia pliku, chyba że ustawiono go powyżej.',
  mapLocalDialogTitle: 'Wybierz plik do serwowania',
  mapLocalAllFilesFilter: 'Wszystkie pliki',

  // Focus hosts (network-session-view.ts + sidebar toggles).
  focusHost: (host: string): string => `Wyróżnij ${host}`,
  unfocusHost: (host: string): string => `Usuń wyróżnienie ${host}`,
  clearFocusedHosts: 'Wyczyść wyróżnione hosty',

  // Replay / Compose (network-detail-view.ts action + network-compose-modal.ts).
  replay: 'Odtwórz',
  replayTitle: 'Odtwórz to żądanie z hosta',
  replayAria: 'Odtwórz żądanie',
  moreReplayOptions: 'Więcej opcji odtwarzania',
  replayNow: 'Odtwórz teraz',
  composeItem: 'Edytuj i wyślij ponownie…',
  composeTitle: 'Edytuj i wyślij ponownie',
  composeNote: 'Wyślij to żądanie ponownie z hosta. Edytuj metodę, URL, nagłówki lub treść przed wysłaniem.',
  composeMethodLabel: 'Metoda',
  composeUrlLabel: 'URL',
  composeParamsLabel: 'Parametry zapytania',
  composeAddRow: '+ Dodaj',
  composeRowEnabledAria: 'Uwzględnij ten wpis',
  composeSelectAllAria: 'Przełącz wszystkie wpisy',
  composeHeadersLabel: 'Nagłówki',
  composeBodyLabel: 'Treść',
  composeBodyPlaceholder: 'Treść żądania',
  composeBinaryBodyNote:
    'Przechwycona treść żądania jest binarna i zostanie wysłana bez zmian; nie można jej tutaj edytować.',
  composeApplyRules: 'Zastosuj aktywne reguły ruchu',
  composeApplyRulesTitle: 'Przepuść odtwarzane żądanie przez reguły blokowania, przepisywania i ograniczania tego urządzenia',
  composeSend: 'Wyślij',
  composeSending: 'Wysyłanie…',
  replayAddedToList: 'Odpowiedź dodano do listy sesji.',
  replayFailed: (err: string): string => `Odtwarzanie nie powiodło się: ${err}`,
  replayInvalidUrl: 'Wpisz prawidłowy adres URL http:// lub https://.',
  replayUnavailable: 'Odtwarzanie jest niedostępne w tej kompilacji.',
  replayStarting: 'Odtwarzanie…',
  tagsReplayed: 'Odtworzone',
  replayedBadgeTitle: 'Ta odpowiedź powstała przez odtworzenie przechwyconego żądania z hosta',

  // Timing waterfall (network-detail.ts Overview timing section).
  ovDuration: 'Czas trwania',
  wfDns: 'DNS',
  wfConnect: 'Połączenie',
  wfTls: 'TLS',
  wfSend: 'Wysyłanie',
  wfWait: 'Oczekiwanie (TTFB)',
  wfReceive: 'Pobieranie',
  wfMs: (n: number): string => `${n} ms`,
  wfSeconds: (s: number): string => `${s.toFixed(2)} s`,
  wfSegmentTitle: (label: string, value: string): string => `${label}: ${value}`,
  wfAria: 'Rozkład czasów żądania'
};
