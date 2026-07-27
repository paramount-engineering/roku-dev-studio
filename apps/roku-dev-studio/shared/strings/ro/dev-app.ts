/**
 * Romanian (ro) translation of the Dev App panel strings.
 * Sibling of ../dev-app.ts — same `devApp` shape, keys, order, and function
 * signatures. Only literal display text is translated.
 */
export const devApp = {
  // ── Password auth (password-auth.ts) ──────────────────────────────────────
  authenticated: 'Autentificat',
  notAuthenticated: 'Neautentificat',
  verify: 'Verifică',
  enterDeveloperPassword: 'Introdu o parolă de dezvoltator.',
  verificationNoResponse: 'Verificare eșuată — niciun răspuns de la Dev App.',

  // ── Quick remote (quick-remote.ts) ────────────────────────────────────────
  sendText: 'Trimite text',
  sending: 'Se trimite...',

  // ── Screenshots (screenshots.ts) ──────────────────────────────────────────
  captureDisabledTitle: 'Lansează Dev App încărcat pe dispozitiv pentru a face o captură de ecran.',
  launchBeforeCapture: 'Lansează Dev App pe dispozitiv înainte de a face o captură de ecran.',
  capturing: 'Se capturează...',
  capture: 'Capturează',
  copiedTitle: 'Copiat!',
  copyScreenshot: 'Copiază captura de ecran',
  saveScreenshotAs: 'Salvează captura de ecran ca…',
  clearScreenshot: 'Golește captura de ecran',
  copiedToClipboard: '✓ Copiat în clipboard',
  savedTo: (filePath: string): string => `✓ Salvat în: ${filePath}`,
  failedToCopy: (detail: string): string => `Copierea a eșuat: ${detail}`,
  couldNotGetCanvasContext: 'Nu s-a putut obține contextul canvas',
  couldNotEncodeScreenshot: 'Nu s-a putut codifica captura de ecran',

  // ── Sideloaded app card (sideloaded-app.ts) ───────────────────────────────
  versionLabel: 'Versiune:',
  unknown: 'Necunoscut',
  noChannelSideloaded: 'Niciun canal încărcat momentan',
  launching: 'Se lansează',
  launch: 'Lansează',

  // ── Sideloading (sideloading.ts) ──────────────────────────────────────────
  dragDropUnavailable: 'Drag and drop nu este disponibil în această versiune',
  selectFileAndPassword: 'Selectează un fișier și introdu parola de dezvoltator',
  installing: 'Se instalează...',
  install: 'Instalează',
  unknownError: 'Eroare necunoscută',
  deleteSideloadedChannelConfirm: 'Ștergi canalul încărcat?',

  // Shared between screenshots + sideloading
  pleaseEnterDeveloperPassword: 'Introdu parola de dezvoltator',

  // ── Channel performance parse messages (remote-metrics-charts.ts) ─────────
  channelPerfUnavailable: (err: string): string => `Performanța canalului indisponibilă: ${err}`,
  channelPerfUnavailableFailed: 'Performanța canalului indisponibilă (stare eșuată).',
  chartAxisNow: 'acum',

  // ── Device Performance Action Script capture (device-metrics-performance-step.ts) ──
  captionCpuGraph: 'Utilizare CPU (grafic)',
  captionCpuProcess: 'Utilizare CPU (proces)',
  captionSystemMemory: 'Memorie sistem',
  captionObjectsCount: 'Obiecte BrightScript (număr)',
  captionObjectsMemory: 'Obiecte BrightScript (memorie)',
  invalidChartType: 'Tip de grafic nevalid pentru performanța dispozitivului.',
  developerModeRequired: 'Developer Mode trebuie activat pe acest dispozitiv pentru a captura metrici de performanță.',
  remoteMetricsRootNotFound: 'Rădăcina metricilor de la distanță nu a fost găsită pentru fila acestui dispozitiv.',
  performanceCardNotFound: (selector: string): string => `Cardul de performanță nu a fost găsit: ${selector}`,
  performanceCardNoVisibleBounds:
    'Cardul de performanță nu are limite vizibile. Activați „Afișează performanța dispozitivului” (aspect cvadruplu) în Remote Section.',
  chartRasterizeFailed: 'Rasterizarea graficului a eșuat (URL de date gol sau nevalid).',
  canvasUnavailable: 'Canvas indisponibil',
  couldNotDecodeCaptureForScaling: 'Nu s-a putut decoda captura pentru scalarea la export',
  devicePerfHidden:
    'Cardurile de performanță a dispozitivului sunt ascunse. În Remote Section, activează „Afișează performanța dispozitivului” (aspect cvadruplu), apoi rulează din nou acest pas.',
  couldNotShowDevicePerf:
    'Nu s-a putut afișa automat performanța dispozitivului. În Remote Section, activează „Afișează performanța dispozitivului” (aspect cvadruplu), apoi rulează din nou acest pas.',
  stopped: 'Oprit',
  couldNotCaptureDevicePerf:
    'Nu s-au putut captura cardurile de performanță a dispozitivului. Asigură-te că aspectul cvadruplu este vizibil și că fereastra nu este minimizată.',
  devicePerfAutoEnabledSummary:
    'Afișarea performanței dispozitivului (aspect cvadruplu) a fost activată automat pentru acest pas.',
  skippedNoProcStat: (caption: string): string =>
    `Captura „${caption}” a fost omisă — dispozitivul nu a produs încă <proc-stat> (necesită Roku OS 15.2+).`,

  // ── Device metrics: process-state labels (device-metrics.ts) ──────────────
  stateRunning: 'În execuție',
  stateSleeping: 'În repaus',
  stateIdle: 'Inactiv',
  stateTracingStop: 'Oprire pentru urmărire',
  stateDiskWait: 'Așteptare disc',
  stateStopped: 'Oprit',
  stateZombie: 'Zombie',
  stateDead: 'Terminat',

  // ── Device metrics: objects resource monitor ──────────────────────────────
  updatedAt: (time: string): string => `Actualizat: ${time}`,
  memoryEstimatedHint:
    'Memoria este estimată din numărul de obiecte și din memoria chanperf („used”) când dispozitivul nu trimite octeți pe tip.',
  totalBrightScriptObjects: 'Total obiecte BrightScript',

  // ── Device metrics: header perf strip ─────────────────────────────────────
  latestDevicePerfTitle: 'Ultima performanță a dispozitivului (apasă pentru a deschide telecomanda)',

  // ── Device metrics: CPU process table ─────────────────────────────────────
  processLabel: 'Proces',
  waitingForProcStat: 'Se așteaptă un eșantion proc-stat…',
  stateFieldLabel: 'Stare',
  channelUptime: 'Timp de funcționare a canalului',
  sinceFirstObserved: 'De la prima observare',
  userCpuTime: 'Timp CPU utilizator',
  kernelCpuTime: 'Timp CPU kernel',
  childCpuTime: 'Timp CPU proces-copil',
  childFaults: 'Erori proces-copil',
  minorMajor: 'Minore/Majore',
  clockTickRate: 'Frecvența tacturilor de ceas',
  minorFaults: 'Erori minore',
  majorFaults: 'Erori majore',
  stableFor: (duration: string): string => `Stabil de ${duration}`,
  childCpuTimeSecondary: (user: string, kernel: string): string => `Utilizator ${user} · Kernel ${kernel}`,

  // ── Device metrics: chart hover series labels ─────────────────────────────
  hoverTotal: 'Total',
  hoverUser: 'Utilizator',
  hoverKernel: 'Kernel',
  hoverUsed: 'Utilizată',
  hoverResident: 'Rezidentă',
  hoverAnonymous: 'Anonimă',
  hoverShared: 'Partajată',
  hoverLimit: 'Limită',

  // ── Device metrics: error toasts ──────────────────────────────────────────
  chanperfRequestFailed: 'Cererea chanperf a eșuat',
  couldNotParseChanperf: 'Nu s-a putut analiza performanța canalului (Dev Mode / ECP / chanperf).',
  objectCountsFailed: 'Numărarea obiectelor a eșuat',
  deviceMetricsUnavailable: 'Metrici dispozitiv indisponibile',

  // ── Device metrics: objects empty states ──────────────────────────────────
  objectsEmptyBackground:
    'Nicio defalcare a obiectelor BrightScript cât timp Dev App este în fundal. Lansează sau comută la Dev App pe dispozitiv — metricile și numărul de obiecte se actualizează doar când este în prim-plan.',
  objectsEmptyNoForeground:
    'Încă nicio defalcare a obiectelor BrightScript. După ce conexiunea raportează canalul din prim-plan, lansează Dev App dacă ai nevoie de numărul de obiecte ale Dev App încărcat.',
  objectsEmptyNoCounts:
    'Încă nicio defalcare a obiectelor BrightScript. Asigură-te că opțiunea Control by Mobile Apps (Network Access) este activată și că canalul din prim-plan expune numărul de obiecte.',

  // ── Device metrics: launch + paused nav ───────────────────────────────────
  launchingProgress: 'Se lansează…',
  launchFailed: 'Lansare eșuată',
  pausedSideloadFull: 'Performanța dispozitivului în pauză — încarcă Dev App pentru a relua',
  pausedSideloadShort: 'Încarcă pentru a relua',
  pausedLaunchFull: 'Performanța dispozitivului în pauză — lansează Dev App pentru a relua',
  pausedLaunchShort: 'Lansează pentru a relua',
  pausedUnknownFull: 'Performanța dispozitivului în pauză — adu Dev App în prim-plan pentru a relua.',
  pausedUnknownShort: 'Performanța dispozitivului în pauză',
  bringDevAppToForegroundTitle:
    'Adu Dev App în prim-plan pe dispozitiv pentru a activa performanța dispozitivului.',
  showDevicePerfAutoOnToast:
    'Afișarea performanței dispozitivului a fost activată pentru ca un Action Script să poată captura graficele.',

  // ── Native dialogs + IPC results (main: dev-app-handlers.ts) ──────────────
  selectRokuChannelPackageTitle: 'Selectează pachetul de canal Roku',
  rokuChannelPackageFilter: 'Pachet de canal Roku',
  saveScreenshotDialogTitle: 'Salvează captura de ecran',
  imagesFilter: 'Imagini',
  screenshotCapturedToast: 'Captură de ecran realizată!',
  sideloadWrongTypeError: 'Selectați un pachet de canal Roku .zip sau .pkg',
  failedToSaveScreenshot: (detail: string): string => `Salvarea capturii de ecran a eșuat: ${detail}`,
};
