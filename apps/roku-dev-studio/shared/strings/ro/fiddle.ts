/**
 * Romanian (ro) translation of the BrightScript Fiddle window strings.
 * Sibling of ../fiddle.ts — same `fiddle` shape, keys, order, and function
 * signatures. Count-driven text uses the Romanian singular/plural + "de" rule.
 * Only literal display text is translated.
 */
export const fiddle = {
  // Device dropdown
  selectDevice: 'Selectează un dispozitiv',
  noDevices: 'Nu s-au găsit dispozitive cu Dev Mode activat',
  deviceFallbackName: 'Roku',
  remotePrefix: '[La distanță] ',

  // Diagnostics status chip (bottom of the editor)
  noIssues: 'Fără probleme',
  diagWarnings: (warnCount: number): string => {
    const word =
      warnCount === 1 ? 'avertisment' :
      warnCount % 100 === 0 || warnCount % 100 >= 20 ? 'de avertismente' :
      'avertismente';
    return `${warnCount} ${word}`;
  },
  diagErrors: (errCount: number, warnCount: number): string => {
    const errWord =
      errCount === 1 ? 'eroare' :
      errCount % 100 === 0 || errCount % 100 >= 20 ? 'de erori' :
      'erori';
    const warnWord =
      warnCount === 1 ? 'avertisment' :
      warnCount % 100 === 0 || warnCount % 100 >= 20 ? 'de avertismente' :
      'avertismente';
    return `${errCount} ${errWord}${warnCount ? `, ${warnCount} ${warnWord}` : ''}`;
  },

  // Password modal
  passwordRequired: 'Parola este obligatorie.',

  // Run / Stop status line
  selectDeviceFirst: 'Selectează mai întâi un dispozitiv.',
  deviceUnavailable: 'Dispozitivul selectat nu mai este disponibil.',
  runCancelledPassword: 'Rulare anulată — parolă necesară.',
  running: 'Se rulează...',
  runFailed: 'Rulare eșuată.',
  runFailedWith: (msg: string): string => `Rulare eșuată: ${msg}`,
  sideloadWaiting: 'Încărcare finalizată — se așteaptă rezultatul…',
  runningOnDevice: 'Se rulează pe dispozitiv…',
  runComplete: 'Rulare finalizată.',
  editorReset: 'Editorul a fost resetat la Snippetul implicit.',
  uninstalling: 'Se dezinstalează...',
  channelRemoved: 'Canalul BrightScript Fiddle a fost eliminat.',
  stopFailed: 'Oprire eșuată.',
  ready: 'Gata.',

  // Reset-code confirm
  resetConfirm: 'Resetezi editorul la Snippetul implicit? Modificările nesalvate se vor pierde.',

  // Editor bootstrap status
  loadingEditor: 'Se încarcă editorul...',
  editorFailedToLoad: (msg: string): string => `Încărcarea editorului a eșuat: ${msg}`,

  // Monaco command-palette / context-menu action
  runOnDevice: 'Rulează pe dispozitiv',

  // Static fiddle.html shell — header, device picker, panes, status row
  heading: 'BrightScript Fiddle',
  subtitle: 'Rulează rapid un fragment BrightScript pe orice dispozitiv conectat.',
  deviceLabel: 'Dispozitiv',
  scanForDevices: 'Scanează dispozitivele',
  runBtn: 'Rulează',
  runBtnTitle: 'Rulează (⌘/Ctrl+Enter)',
  stopBtn: 'Oprește',
  stopBtnTitle: 'Dezinstalează canalul Fiddle',
  codeLabel: 'Cod',
  resetSnippetTitle: 'Resetează la Snippetul implicit',
  resetSnippetAria: 'Resetează editorul la Snippetul implicit',
  terminalLabel: 'Terminal',
  clearTerminal: 'Golește terminalul',
  statusRowCaption: 'Rularea înlocuiește canalul încărcat curent pe dispozitivul selectat.',

  // Developer-password modal
  passwordModalTitle: 'Parolă de dezvoltator necesară',
  passwordModalHint:
    'Încărcarea (sideload) necesită parola de dezvoltator a dispozitivului — cea pe care ai setat-o când ai activat Developer Mode.',
  passwordLabel: 'Parolă',
  passwordPlaceholder: 'Introdu parola de dezvoltator',
  passwordModalHintMuted:
    'Această parolă este folosită doar pentru această sesiune. Pentru a o salva pentru utilizări viitoare, verifică Developer Mode în fereastra principală.',
  passwordSubmitBtn: 'Salvează și rulează',

  /**
   * Monaco editor's initial value + the target of "Reset to default Snippet".
   * The two leading `'` comment lines are user-facing guidance; the BrightScript
   * keywords/identifiers (`Sub`, `End Sub`, `print`, `userFiddle`, `init`) and the
   * example `print` output are code tokens kept verbatim. Composed via the same
   * newline join as the source so the editor value is byte-for-byte identical.
   */
  defaultSnippet: [
    "' `userFiddle` este punctul de intrare pe care Fiddle îl rulează după ce canalul este pe ecran.",
    "' Pune fragmentul tău de cod aici — poți defini și subrutine/funcții ajutătoare mai jos și le poți apela din userFiddle. NU defini o subrutină numită `init` — acel identificator este rezervat de scena Fiddle.",
    'Sub userFiddle()',
    '    print "Hello from Roku Dev Studio Fiddle"',
    'End Sub',
    ''
  ].join('\n'),

  // ── Main-process diagnostics + run/stop errors (main/ipc/bs-fiddle-handlers.ts) ──
  // Surfaced in the Fiddle UI (Monaco markers or the status line). Code literals
  // (`init`, `userFiddle`) are kept verbatim.
  lintReservedInit:
    'Numele `init` este rezervat de scena Fiddle. Redenumește această subrutină în `userFiddle` — Fiddle va apela `userFiddle()` automat odată ce scena este pe ecran.',
  errWindowUnavailable: 'Fereastra Fiddle nu mai este disponibilă.',
  errDeviceDisconnected: 'Dispozitivul selectat nu mai este conectat.',
  errNoPasswordProvided: 'Nu a fost furnizată nicio parolă de dezvoltator.',
  errNoPasswordAvailable: 'Nu există nicio parolă de dezvoltator disponibilă pentru acest dispozitiv.',
  errPackageFailed: (detail: string): string => `Împachetarea fragmentului a eșuat: ${detail}`,
  errRemoteMissingServerUrl: 'Dispozitivului la distanță îi lipsește URL-ul serverului releu — nu se pot transmite jurnalele telnet.',
  errSideloadFailed: 'Încărcarea (sideload) a eșuat',
  errDeviceNotFound: 'Dispozitivul nu a fost găsit.',
  errNotFiddleChannel:
    'Canalul de dezvoltare instalat momentan nu este un canal Fiddle — a fost lăsat neatins pentru ca propria ta aplicație să nu fie eliminată.',

  // humanizeRemoteUploadError prose (remote relay upload failures)
  errRemoteUnknown: 'Eroare necunoscută de la serverul releu la distanță.',
  errRemoteNetworkBlip:
    'Scurtă întrerupere de rețea între serverul releu și Roku (broken pipe). ' +
    'De obicei se rezolvă la reîncercare — dacă persistă, verificați că gazda releu ' +
    'poate accesa dispozitivul prin LAN și că Roku nu este ocupat.',
  errRemoteCurl: (detail: string): string => `Eroare curl a releului la distanță: ${detail}`,
};
