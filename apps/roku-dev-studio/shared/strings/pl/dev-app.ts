/**
 * Polish (pl) translation of the Dev App panel strings.
 * Sibling of ../dev-app.ts — same `devApp` shape, keys, order, and function
 * signatures. Only literal display text is translated.
 */
export const devApp = {
  // ── Password auth (password-auth.ts) ──────────────────────────────────────
  authenticated: 'Uwierzytelniono',
  notAuthenticated: 'Nie uwierzytelniono',
  verify: 'Zweryfikuj',
  enterDeveloperPassword: 'Wprowadź hasło programisty.',
  verificationNoResponse: 'Weryfikacja nie powiodła się — brak odpowiedzi od Dev App.',

  // ── Quick remote (quick-remote.ts) ────────────────────────────────────────
  sendText: 'Wyślij tekst',
  sending: 'Wysyłanie...',

  // ── Screenshots (screenshots.ts) ──────────────────────────────────────────
  captureDisabledTitle: 'Uruchom wgraną Dev App na urządzeniu, aby zrobić zrzut ekranu.',
  launchBeforeCapture: 'Uruchom Dev App na urządzeniu przed zrobieniem zrzutu ekranu.',
  capturing: 'Przechwytywanie...',
  capture: 'Przechwyć',
  copiedTitle: 'Skopiowano!',
  copyScreenshot: 'Kopiuj zrzut ekranu',
  saveScreenshotAs: 'Zapisz zrzut ekranu jako…',
  clearScreenshot: 'Wyczyść zrzut ekranu',
  copiedToClipboard: '✓ Skopiowano do schowka',
  savedTo: (filePath: string): string => `✓ Zapisano w: ${filePath}`,
  failedToCopy: (detail: string): string => `Nie udało się skopiować: ${detail}`,
  couldNotGetCanvasContext: 'Nie udało się uzyskać kontekstu canvas',
  couldNotEncodeScreenshot: 'Nie udało się zakodować zrzutu ekranu',

  // ── Sideloaded app card (sideloaded-app.ts) ───────────────────────────────
  versionLabel: 'Wersja:',
  unknown: 'Nieznane',
  noChannelSideloaded: 'Obecnie nie wgrano żadnego kanału',
  launching: 'Uruchamianie',
  launch: 'Uruchom',

  // ── Sideloading (sideloading.ts) ──────────────────────────────────────────
  dragDropUnavailable: 'Przeciąganie i upuszczanie nie jest dostępne w tej kompilacji',
  selectFileAndPassword: 'Wybierz plik i wprowadź hasło programisty',
  installing: 'Instalowanie...',
  install: 'Zainstaluj',
  unknownError: 'Nieznany błąd',
  deleteSideloadedChannelConfirm: 'Usunąć wgrany kanał?',

  // Shared between screenshots + sideloading
  pleaseEnterDeveloperPassword: 'Wprowadź hasło programisty',

  // ── Channel performance parse messages (remote-metrics-charts.ts) ─────────
  channelPerfUnavailable: (err: string): string => `Wydajność kanału niedostępna: ${err}`,
  channelPerfUnavailableFailed: 'Wydajność kanału niedostępna (status: niepowodzenie).',
  chartAxisNow: 'teraz',

  // ── Device Performance Action Script capture (device-metrics-performance-step.ts) ──
  captionCpuGraph: 'Użycie CPU (wykres)',
  captionCpuProcess: 'Użycie CPU (proces)',
  captionSystemMemory: 'Pamięć systemowa',
  captionObjectsCount: 'Obiekty BrightScript (liczba)',
  captionObjectsMemory: 'Obiekty BrightScript (pamięć)',
  invalidChartType: 'Nieprawidłowy typ wykresu wydajności urządzenia.',
  developerModeRequired: 'Aby przechwytywać metryki wydajności, na tym urządzeniu musi być włączony Tryb programisty.',
  remoteMetricsRootNotFound: 'Nie znaleziono elementu głównego metryk zdalnych dla tej karty urządzenia.',
  performanceCardNotFound: (selector: string): string => `Nie znaleziono karty wydajności: ${selector}`,
  performanceCardNoVisibleBounds:
    'Karta wydajności nie ma widocznych granic. Włącz „Pokaż wydajność urządzenia” (układ poczwórny) w Remote Section.',
  chartRasterizeFailed: 'Rasteryzacja wykresu nie powiodła się (pusty lub nieprawidłowy adres data URL).',
  canvasUnavailable: 'Canvas niedostępny',
  couldNotDecodeCaptureForScaling: 'Nie udało się zdekodować przechwyconego obrazu do skalowania eksportu',
  devicePerfHidden:
    'Karty wydajności urządzenia są ukryte. W Remote Section włącz „Pokaż wydajność urządzenia” (układ poczwórny), a następnie uruchom ten krok ponownie.',
  couldNotShowDevicePerf:
    'Nie udało się automatycznie pokazać wydajności urządzenia. W Remote Section włącz „Pokaż wydajność urządzenia” (układ poczwórny), a następnie uruchom ten krok ponownie.',
  stopped: 'Zatrzymano',
  couldNotCaptureDevicePerf:
    'Nie udało się przechwycić kart wydajności urządzenia. Upewnij się, że układ poczwórny jest widoczny, a okno nie jest zminimalizowane.',
  devicePerfAutoEnabledSummary:
    'Opcja „Pokaż wydajność urządzenia” (układ poczwórny) została włączona automatycznie dla tego kroku.',
  skippedNoProcStat: (caption: string): string =>
    `Pominięto przechwytywanie „${caption}” — urządzenie nie utworzyło jeszcze <proc-stat> (wymaga Roku OS 15.2+).`,

  // ── Device metrics: process-state labels (device-metrics.ts) ──────────────
  stateRunning: 'Działa',
  stateSleeping: 'Uśpiony',
  stateIdle: 'Bezczynny',
  stateTracingStop: 'Zatrzymanie śledzenia',
  stateDiskWait: 'Oczekiwanie na dysk',
  stateStopped: 'Zatrzymany',
  stateZombie: 'Zombie',
  stateDead: 'Martwy',

  // ── Device metrics: objects resource monitor ──────────────────────────────
  updatedAt: (time: string): string => `Zaktualizowano: ${time}`,
  memoryEstimatedHint:
    'Pamięć jest szacowana na podstawie liczby obiektów i pamięci chanperf („used”), gdy urządzenie nie wysyła bajtów w podziale na typy.',
  totalBrightScriptObjects: 'Łączna liczba obiektów BrightScript',

  // ── Device metrics: header perf strip ─────────────────────────────────────
  latestDevicePerfTitle: 'Najnowsza wydajność urządzenia (kliknij, aby otworzyć pilota)',

  // ── Device metrics: CPU process table ─────────────────────────────────────
  processLabel: 'Proces',
  waitingForProcStat: 'Oczekiwanie na próbkę proc-stat…',
  stateFieldLabel: 'Stan',
  channelUptime: 'Czas działania kanału',
  sinceFirstObserved: 'Od pierwszej obserwacji',
  userCpuTime: 'Czas CPU użytkownika',
  kernelCpuTime: 'Czas CPU jądra',
  childCpuTime: 'Czas CPU procesów potomnych',
  childFaults: 'Błędy procesów potomnych',
  minorMajor: 'Drobne/Poważne',
  clockTickRate: 'Częstotliwość taktów zegara',
  minorFaults: 'Drobne błędy',
  majorFaults: 'Poważne błędy',
  stableFor: (duration: string): string => `Stabilne od ${duration}`,
  childCpuTimeSecondary: (user: string, kernel: string): string => `Użytkownik ${user} · Jądro ${kernel}`,

  // ── Device metrics: chart hover series labels ─────────────────────────────
  hoverTotal: 'Łącznie',
  hoverUser: 'Użytkownik',
  hoverKernel: 'Jądro',
  hoverUsed: 'Użyte',
  hoverResident: 'Rezydentna',
  hoverAnonymous: 'Anonimowa',
  hoverShared: 'Współdzielona',
  hoverLimit: 'Limit',

  // ── Device metrics: error toasts ──────────────────────────────────────────
  chanperfRequestFailed: 'Żądanie chanperf nie powiodło się',
  couldNotParseChanperf: 'Nie udało się przeanalizować wydajności kanału (Tryb programisty / ECP / chanperf).',
  objectCountsFailed: 'Nie udało się pobrać liczby obiektów',
  deviceMetricsUnavailable: 'Metryki urządzenia niedostępne',

  // ── Device metrics: objects empty states ──────────────────────────────────
  objectsEmptyBackground:
    'Brak podziału obiektów BrightScript, gdy Dev App działa w tle. Uruchom Dev App na urządzeniu lub przełącz się na nią — metryki i liczby obiektów aktualizują się tylko wtedy, gdy jest na pierwszym planie.',
  objectsEmptyNoForeground:
    'Brak jeszcze podziału obiektów BrightScript. Gdy połączenie zgłosi kanał na pierwszym planie, uruchom Dev App, jeśli potrzebujesz liczby obiektów wgranej Dev App.',
  objectsEmptyNoCounts:
    'Brak jeszcze podziału obiektów BrightScript. Upewnij się, że opcja Control by Mobile Apps (Network Access) jest włączona, a kanał na pierwszym planie udostępnia liczby obiektów.',

  // ── Device metrics: launch + paused nav ───────────────────────────────────
  launchingProgress: 'Uruchamianie…',
  launchFailed: 'Uruchomienie nie powiodło się',
  pausedSideloadFull: 'Wydajność urządzenia wstrzymana — wgraj Dev App, aby wznowić',
  pausedSideloadShort: 'Wgraj, aby wznowić',
  pausedLaunchFull: 'Wydajność urządzenia wstrzymana — uruchom Dev App, aby wznowić',
  pausedLaunchShort: 'Uruchom, aby wznowić',
  pausedUnknownFull: 'Wydajność urządzenia wstrzymana — przełącz Dev App na pierwszy plan, aby wznowić.',
  pausedUnknownShort: 'Wydajność urządzenia wstrzymana',
  bringDevAppToForegroundTitle:
    'Przełącz Dev App na pierwszy plan na urządzeniu, aby włączyć wydajność urządzenia.',
  showDevicePerfAutoOnToast:
    'Opcja „Pokaż wydajność urządzenia” została włączona, aby Action Script mógł przechwycić wykresy.',

  // ── Native dialogs + IPC results (main: dev-app-handlers.ts) ──────────────
  selectRokuChannelPackageTitle: 'Wybierz pakiet kanału Roku',
  rokuChannelPackageFilter: 'Pakiet kanału Roku',
  saveScreenshotDialogTitle: 'Zapisz zrzut ekranu',
  imagesFilter: 'Obrazy',
  screenshotCapturedToast: 'Zrzut ekranu przechwycony!',
  sideloadWrongTypeError: 'Wybierz pakiet kanału Roku .zip lub .pkg',
  failedToSaveScreenshot: (detail: string): string => `Nie udało się zapisać zrzutu ekranu: ${detail}`,
};
