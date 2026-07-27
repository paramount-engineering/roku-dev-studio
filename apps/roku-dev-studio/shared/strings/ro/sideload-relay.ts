/**
 * Romanian (ro) translation of the Sideload Relay settings section +
 * device-setup modal strings. Sibling of ../sideload-relay.ts — same
 * `sideloadRelay` shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. Romanian
 * count-driven text uses the singular/plural + "de" rule. Only literal display
 * text is translated.
 */
export const sideloadRelay = {
  // Enable gate
  gateTitle: 'Pentru a activa Sideload Relay:',
  gateNeedPassword: 'Setează o parolă dev Relay pentru ca IDE-ul tău să se poată autentifica cu RDS.',
  gateNeedDevice: 'Vizează cel puțin un dispozitiv accesibil — deschide „Configurează dispozitive” și activează un dispozitiv care este online.',

  // Targeted Devices summary row
  targetSummaryEmpty: 'Niciun dispozitiv vizat încă. Apasă „Configurează dispozitive” pentru a alege ce dispozitive Roku primesc fiecare build.',
  targetSummaryChecking: (n: number): string => {
    const word =
      n === 1 ? 'dispozitiv vizat' :
      n % 100 === 0 || n % 100 >= 20 ? 'de dispozitive vizate' :
      'dispozitive vizate';
    return `${n} ${word} · se verifică accesibilitatea…`;
  },
  targetSummaryReachable: (reachable: number): string =>
    `${reachable} ${reachable === 1 ? 'activat și accesibil' : 'activate și accesibile'}`,
  targetSummaryOfflineSuffix: (offline: number): string =>
    ` · ${offline} offline (${offline === 1 ? 'ignorat până devine accesibil' : 'ignorate până devin accesibile'})`,

  // Toggle rows + password field
  enableTitle: 'Activează Sideload Relay',
  enableDesc: 'Anunță RDS ca dispozitiv Roku prin SSDP și acceptă încărcări (sideload). Dezactivat implicit.',
  passwordTitle: 'Parolă dev Relay',
  passwordDesc: 'Parola cu care se autentifică IDE-ul tău (utilizator rokudev). Necompletat păstrează parola salvată.',
  autoConsoleTitle: 'Conectează automat consola',
  autoConsoleDesc: 'Deschide consola telnet 8085 pe fiecare dispozitiv după instalare.',
  retryTitle: 'Reîncearcă o dată la eșec',
  retryDesc: 'Reîncearcă o dată o instalare eșuată înainte de a o raporta.',
  targetedDevicesTitle: 'Dispozitive vizate',
  setupDevicesBtn: 'Configurează dispozitive',
  targetSummaryLoading: 'Se încarcă…',

  // Setup modal
  modalTitle: 'Configurează dispozitivele Sideload Relay',
  modalSubtitle:
    'Dispozitivele activate și accesibile primesc fiecare build pe care îl încarci prin RDS. Dispozitivele vizate anterior care sunt offline rămân în listă (dezactivate) și se realătură automat când redevin accesibile.',
  scanBtn: 'Scanează dispozitivele',
  scanning: 'Se scanează…',
  colLocation: 'Locație',
  colDevice: 'Dispozitiv',
  colIpSerial: 'IP și serie',
  colEnabled: 'Activat',
  colReachable: 'Accesibil',
  emptyDevices: 'Nu s-au găsit dispozitive. Asigură-te că dispozitivele Roku sunt pornite și în dev mode, apoi rescanează.',
  locRemote: 'La distanță',
  locLocal: 'Local',

  // Per-device password affordance
  setPasswordBtn: '🔒 Setează parola',
  setPasswordTitle: 'Introdu și validează parola dev pentru a activa acest dispozitiv',
  enableAriaLabel: (name: string): string => `Activează ${name}`,
  reachableNow: 'Accesibil acum',
  reachableOk: '✓',
  reachableOff: '○ offline',
  reachableOffTitle: 'Inaccesibil — ignorat până revine online',

  // Inline password editor
  pwInputPlaceholder: 'Parolă dev',
  pwInputAriaLabel: (name: string): string => `Parolă dev pentru ${name}`,
  pwValidateTitle: (name: string): string => `Validează și activează ${name}`,
  pwValidateAriaLabel: 'Validează parola',
  pwValidateChar: '✓',
  pwEnterPassword: 'Introdu o parolă',
  pwWrong: 'Parolă greșită',
  pwUnreachable: 'Inaccesibil',

  // Modal summary
  modalSummary: (enabledReachable: number, reachableTotal: number): string =>
    `${enabledReachable} ${enabledReachable === 1 ? 'activat și accesibil' : 'activate și accesibile'} din ${reachableTotal} online`,
  modalSummaryOfflineSuffix: (offline: number): string =>
    ` · ${offline} offline ${offline === 1 ? 'păstrat' : 'păstrate'}`,

  // Scan status
  scanFound: (local: number, remote: number, total: number): string => {
    const word = total === 1 ? 'dispozitiv dev' : 'dispozitive dev';
    const verb = total === 1 ? 'S-a găsit' : 'S-au găsit';
    return `${verb} ${local} local${remote ? ` · ${remote} remote` : ''} ${word}.`;
  },
  scanFailed: 'Scanare eșuată.',

  // Save status
  saved: 'Setările Sideload Relay au fost salvate.',
  saveFailed: 'Salvare eșuată',
  fixBeforeEnable: 'Corectează elementele de mai sus înainte de a activa Sideload Relay.',

  // Password reveal aria/title
  showPassword: 'Afișează parola',
  hidePassword: 'Ascunde parola',

  // Saved-password placeholder hint
  savedPasswordPlaceholder: '•••••••• (salvată)',

  // ── Native allow/deny prompt on the host (main/sideload-relay/index.ts) ──
  authorizeTitle: 'Sideload Relay',
  authorizeAllow: 'Permite',
  authorizeDeny: 'Refuză',
  authorizeMessage: (who: string): string => `Permiteți o încărcare (sideload) de la ${who}?`,
  authorizeDetail:
    'Un alt dispozitiv din rețeaua dvs. încearcă să instaleze un build prin Roku Dev Studio. ' +
    'Permiteți doar dacă recunoașteți acest dispozitiv.',

  // ── Relay dev-password validate / reveal + settings-save errors (main/ipc/relay-handlers.ts) ──
  errDeviceIpPasswordRequired: 'Adresa IP a dispozitivului și parola sunt obligatorii.',
  errIncorrectPassword: 'Parolă de dezvoltator incorectă.',
  errValidationFailed: 'Validarea a eșuat.',
  errCouldNotReadPassword: 'Nu s-a putut citi parola salvată.',
  errCouldNotWriteSettings: 'Nu s-a putut scrie fișierul de setări.',
};
