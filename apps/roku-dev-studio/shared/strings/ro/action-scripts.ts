/**
 * Romanian (ro) translation of the Action Scripts UI strings (Builder, step
 * fields, Executor, Import modal, shared actions list, and the per-step Help
 * modal).
 *
 * Same structure/keys/order as ../action-scripts.ts. Parametrized strings are
 * functions returning the composed text. Help-modal body values contain inline
 * HTML (assigned via `setSafeHTML`); dynamic values are HTML-escaped at the call
 * site before being passed in.
 */
export const actionScripts = {
  // ── Builder: step-type option (legacy) ──
  legacyPluginsMemoryOption: 'Plugins / Memorie (JSON vechi)',

  // ── Builder: per-step field labels / placeholders / prompts ──
  labelQuery: 'Interogare',
  labelEndpoint: 'Endpoint',
  optionCustom: 'Personalizat...',
  labelSystemTelnetCommand: 'Comandă (tip vechi — folosiți Interogare dispozitiv pentru pași noi)',
  labelKey: 'Tastă',
  optionSelectKey: '-- Selectați tasta --',
  labelText: 'Text',
  placeholderTextToSend: 'Text de trimis',
  labelAppId: 'App ID',
  labelParamsOptional: 'Parametri (opțional)',
  labelFilePath: 'Cale fișier',
  placeholderPastePathOrChoose: 'Lipiți calea sau alegeți fișierul',
  titleFilePathZip: 'Calea către pachetul .zip. Lipiți aici sau folosiți Alege fișierul.',
  chooseFileTitle: 'Alege fișierul (.zip)',
  chooseFileAria: 'Alege fișierul',
  chooseFileBtn: 'Alege fișierul',
  labelPassword: 'Parolă',
  placeholderDevPassword: 'Parolă dev',
  optionConnectAppConnectorFirst: 'Conectați mai întâi App Connector',
  labelFunction: 'Funcție',
  labelSetVarOptional: 'Setează variabila (opțional)',
  placeholderVarExample: 'ex. varX',
  titleVarNameRules: 'Litere, cifre, underscore; începeți cu literă sau _',
  noParameters: 'Fără parametri',
  selectAFunction: 'Selectați o funcție',
  labelCommand: 'Comandă',
  labelParameters: 'Parametri',
  labelLabelOptional: 'Etichetă (opțional)',
  placeholderScreenshotLabel: 'ex. După autentificare',
  labelWaitBeforeMs: 'Așteaptă înainte (ms)',
  labelWaitAfterMs: 'Așteaptă după (ms)',
  placeholderWaitAfterDefault: '1500 (implicit)',
  titleWaitAfter:
    'Timpul de așteptare după declanșarea capturii înainte de prima descărcare. Măriți dacă imaginea este trunchiată sau UI este lent (ex. HUD).',
  optionChooseChart: 'Alege graficul…',
  labelChart: 'Grafic',
  placeholderPerfLabel: 'ex. După navigare',
  waitModeFixedDelay: 'Întârziere fixă (ms)',
  waitModeUntilCondition: 'Până la condiție',
  labelWaitType: 'Tip de așteptare',
  labelDelayMs: 'Întârziere (ms)',
  labelSource: 'Sursă',
  labelState: 'Stare',
  optionSelectState: '-- Selectați starea --',
  labelTimeoutMs: 'Timp limită (ms)',
  labelPollIntervalMs: 'Interval de interogare (ms)',
  labelPathJsonArray: 'Cale (matrice JSON)',
  labelNodeId: 'ID nod',
  labelFieldName: 'Nume câmp',
  labelOperator: 'Operator',
  placeholderFieldInFieldList: 'Câmp în FieldList',
  placeholderCompareString: 'Șir de comparat',
  placeholderCompareValue: 'Valoare de comparat',
  caseInsensitive: 'Insensibil la majuscule',
  labelConditionSource: 'Sursa condiției',
  labelAttribute: 'Atribut',
  placeholderActiveAppValue: 'ex. dev, 837, YouTube',
  labelVariablePath: 'Cale variabilă',
  labelPost: 'POST',
  optionSelectPost: '-- Selectați POST --',
  noExtraFields: 'Fără câmpuri suplimentare pentru acest tip.',

  // Chart option labels (shared: Builder dropdown, list Details, Executor descriptions)
  chartObjects: 'Obiecte BrightScript',
  chartCpu: 'Utilizare CPU',
  chartMemory: 'Memorie de sistem',
  chartAboveAll: 'Toate împreună',

  // Condition / wait source labels (shared)
  sourceMediaPlayer: 'Player media',
  sourceActiveApp: 'Aplicație activă',
  sourceRaleNodeField: 'Câmp nod RALE',
  sourceVariables: 'Variabile',

  // Value-with-operator label (Builder compare cells)
  valueWithOperator: (op: string): string => `Valoare (${op})`,

  // ── Shared actions list view (Builder + Executor) ──
  branchThen: 'Atunci',
  branchElse: 'Altfel',
  dragToReorder: 'Trageți pentru a reordona',
  columnType: 'Tip',
  columnDetails: 'Detalii',
  addStep: 'Adaugă pas',
  pasteStepBtn: 'Lipește pasul',
  pasteActionTooltip: 'Lipiți aici acțiunea copiată',
  ariaThenBranchPrefix: 'Ramura Atunci. ',
  ariaElseBranchPrefix: 'Ramura Altfel. ',
  copyActionTooltip: 'Copiază acțiunea',
  removeActionTooltip: 'Elimină acțiunea',
  skipBtn: 'Omite',
  skipActionTooltip: 'Omiteți această acțiune',
  skipActionAria: 'Omite acțiunea',
  unskipBtn: 'Nu omite',
  runActionTooltip: 'Rulați această acțiune',
  unskipActionAria: 'Nu omite acțiunea',
  emptyNoScript:
    'Niciun script încărcat. Faceți clic pe <strong>Importă Action Script</strong> de mai sus pentru a importa un script sau folosiți fila <strong>Constructor</strong> pentru a crea unul.',
  stepRowAria: (num: string, type: string, details: string): string =>
    `Acțiune ${num}: ${type}${details ? ', ' + details : ''}. Faceți clic pentru a edita.`,

  /** Row header / error line: "Action <id>: <text>" */
  actionLabel: (id: string, text: string): string => `Acțiune ${id}: ${text}`,

  // ── Builder chrome + toasts + import messages ──
  helpTooltip: (label: string, detail: string): string => `Ajutor: ${label}${detail}`,
  addActionBtn: 'Adaugă acțiune',
  updateStepHeading: (n: number): string => `Actualizează pasul ${n}`,
  updateActionBtn: 'Actualizează acțiunea',
  toastActionPasted: 'Acțiune lipită',
  toastCannotMoveIntoOwnBranch: 'Nu se poate muta un pas în propria ramură If.',
  toastActionCopied: 'Acțiune copiată',
  toastChooseChartType: 'Alegeți un tip de grafic pentru Performanță dispozitiv.',
  toastUpdatedAction: (n: number): string => `Acțiune actualizată #${n}`,
  copiedFeedback: 'Copiat!',
  copyActionScriptBtn: 'Copiază Action Script',
  savedFeedback: 'Salvat!',
  saveActionScriptBtn: 'Salvează Action Script',
  msgNoScriptJson: 'Niciun JSON de script de încărcat.',
  invalidJson: (detail: string): string => `JSON nevalid: ${detail}`,
  msgStepsArray: 'Scriptul trebuie să conțină o matrice "steps".',
  msgValidation: (lines: string): string => `Validare:\n${lines}`,

  // ── index.ts toasts (user-visible; MCP-bridge/agent error strings are left in place) ──
  toastBuilderNotAvailable: 'Constructorul nu este disponibil în această filă.',
  toastLoadedInBuilder: 'Încărcat în Constructor',
  toastAiAgentLoaded: 'Agentul IA a încărcat un script în Constructor',
  toastCouldNotLoadScript: 'Scriptul nu a putut fi încărcat',
  toastNoScriptInExecutor: 'Niciun JSON de script în Executor de încărcat.',
  toastAddNonEmptySteps: 'Adăugați mai întâi o matrice "steps" nevidă în JSON-ul scriptului.',
  toastOpenedInBuilder: 'Deschis în Constructor',

  // ── Shared RALE preflight errors (Executor + Import) ──
  errDevAppRequired:
    'Roku Developer Application trebuie lansată pentru a stabili o conexiune App Connector. Deschideți Developer Application pe dispozitivul Roku (sau lansați canalul sideload din fila Dev App), apoi încercați din nou.',
  errRaleConnection:
    'Instrumentul nu a putut stabili o conexiune App Connector. Asigurați-vă că Dev App rulează cu Modul dezvoltator activat și că portul corect este setat în fila App Connector, apoi încercați din nou. Scriptul nu poate fi executat până când o conexiune nu este disponibilă.',

  // ── Executor engine: full-sentence user-facing errors ──
  errScreenshotPassword:
    'Parola de dezvoltator este necesară pentru Captura de ecran. Specificați-o în script (devPassword) sau introduceți-o în timpul validării.',
  errScreenshotDevApp:
    'Captura de ecran necesită ca Developer App să fie activă. Lansați mai întâi canalul sideload din fila Dev App.',
  errDevicePerformanceInRds:
    'Performanță dispozitiv este disponibilă doar la rularea Action Scripts în Roku Dev Studio.',

  // ── Executor UI ──
  runBtnPause: 'Întrerupe execuția',
  runBtnResume: 'Reia execuția',
  runBtnRun: 'Rulează Action Script',
  emptyNoActions:
    '<strong>Nicio acțiune încărcată</strong><br><br>Folosiți <strong>Importă Action Script</strong> de mai sus pentru a lipi sau încărca un script JSON, apoi faceți clic pe <strong>Validează și importă</strong> în fereastra modală pentru a încărca aici acțiunile.',
  noFolderSelected: 'Niciun folder selectat',
  resultsPlaceholder: 'Validați și rulați pentru a vedea rezultatele.',
  waiting: 'Se așteaptă…',
  statusOk: '✓ OK',
  statusFailed: '✗ Eșuat',
  statusFailedPlain: 'Eșuat',
  statusSkipped: 'Omis',
  altScreenshot: 'Captură de ecran',
  altDevicePerformanceChart: 'Grafic de performanță a dispozitivului',
  validating: 'Se validează…',
  errPasteOrUpload: 'Lipiți sau încărcați un script (JSON).',
  errMissingAppFunctions: (list: string): string =>
    `Următoarele funcții de aplicație (App Function) nu sunt disponibile din aplicație: ${list}. Asigurați-vă că acest canal expune aceste funcții (sau eliminați acești pași din script), apoi încercați din nou.`,
  expectedSuffix: (values: string): string => `\n   așteptat: ${values}`,
  errFileNotFound: (path: string): string => `Fișier negăsit: ${path}`,
  statusValid: '✓ Valid',
  usingDevPasswordFromAuth: '(se folosește parola dev din Auth)',
  switchedTabRunPaused:
    'Filă schimbată — execuția este întreruptă. Reveniți la Action Scripts pentru a relua (dacă JSON este neschimbat) sau folosiți Importă → Validează și importă.',
  scriptChangedNeedsValidation:
    'Scriptul s-a schimbat sau necesită validare — folosiți Importă Action Script → Validează și importă, sau modificați JSON și validați.',
  scriptChangedClickValidate: 'Scriptul s-a schimbat — faceți clic pe Validează.',
  connectingToAppConnector: 'Se conectează la App Connector...',
  runStarted: (runId: string, count: number): string => {
    const mod100 = count % 100;
    const word =
      count === 1
        ? 'acțiune'
        : count === 0 || mod100 === 0 || (mod100 >= 20 && mod100 <= 99)
          ? 'de acțiuni'
          : 'acțiuni';
    return `Execuție începută (${runId}) — ${count} ${word}`;
  },
  errDevicePerformanceUnavailable:
    'Performanța dispozitivului nu este disponibilă pentru acest dispozitiv. Deschideți Remote Section (cu metrici) sau reconectați dispozitivul.',
  errorLine: (message: string): string => `Eroare: ${message}`,
  runStopped: 'Execuție oprită.',
  runCompleted: 'Execuție finalizată.',
  copyResultsTitle: 'Copiază rezultatele',
  saveResultsTitle: 'Salvează rezultatele ca PDF',

  // ── validator.ts parse errors ──
  noScriptContent: 'Niciun conținut de script',
  scriptEmpty: 'Scriptul este gol',
  invalidJsonShort: 'JSON nevalid',

  // ── Import modal ──
  msgStepsArrayNoDot: 'Scriptul trebuie să conțină o matrice "steps"',
  errInvalidScriptObject: 'Script nevalid: trebuie să fie un obiect',
  importModalTitle: 'Importă Action Script',
  importIntoBuilderTitle: 'Importă scriptul în Constructor',
  validateAndLoadBtn: 'Validează și încarcă',
  validateAndImportBtn: 'Validează și importă',
  errCannotVerifyPassword: 'Parola nu poate fi verificată: conexiunea la dispozitiv nu este disponibilă.',
  errVerificationFailed: 'Verificarea a eșuat',
  errCouldNotDetermineDevice:
    'Dispozitivul pentru import nu a putut fi determinat. Închideți fereastra modală și deschideți din nou Import din această filă de dispozitiv.',
  errInvalidScript: 'Script nevalid',
  errSaveFolderRequired:
    'Un folder de salvare este necesar pentru acest script (ex. pasul Captură de ecran). Alegeți un folder de salvare.',
  errDevPasswordRequired: 'Parola de dezvoltator este necesară și nu se află în cache sau în script. Introduceți-o mai jos.',
  verifyingPassword: 'Se verifică parola…',
  errAuthFailed: 'Autentificarea a eșuat. Verificați parola și încercați din nou.',
  errPasswordVerificationFailed: 'Verificarea parolei a eșuat.',
  errValidationFailed: 'Validarea a eșuat',
  errVerificationOrValidationFailed: 'Verificarea sau validarea a eșuat',
  errFailedToReadFile: 'Citirea fișierului a eșuat',

  // ── Step Help modal: subtitles + title ──
  helpSubCustomEndpoint: 'Endpoint personalizat',
  helpSubSelectPost: 'Selectați un POST',
  helpSubFixedDelay: 'Întârziere fixă',
  helpUntilCondition: (srcLabel: string): string => `Până la condiție · ${srcLabel}`,
  helpSubSelectCommand: 'Selectați o comandă',
  helpSubSelectKey: 'Selectați o tastă',
  helpSubSelectCommandShort: 'Selectați comanda',
  helpSystemTelnetTitle: 'Plugins / Memorie (vechi)',
  helpNoText: (type: string): string => `Niciun text de ajutor pentru „${type}”.`,

  // ── Step Help modal: variant bodies (inline HTML) ──
  helpBodyQueryCustom: `
    <p>
      <strong>Personalizat</strong> vă permite să introduceți singur orice cale de Interogare dispozitiv: un <code>/query/…</code> ECP GET normal sau
      valori în stil dev, precum <code>telnet:plugins</code> / <code>telnet:free</code>.
    </p>
    <p>Folosiți aceasta când nu există o presetare pentru endpointul de care aveți nevoie. Valoarea este trimisă ca atare aceluiași mecanism de interogare ca presetările.</p>
  `,
  helpBodyQueryTelnetPlugins: `
    <p>
      Rulează comanda telnet de dezvoltator <strong>plugins</strong> (lista de canale împachetate / rezumatul pluginurilor). Acestea sunt
      aceleași date ca la alegerea presetării Plugins în fluxurile mai vechi, exprimate ca o presetare de interogare.
    </p>
    <p>Necesită acces de dezvoltator la dispozitiv (la fel ca alte interogări dev-plugin).</p>
  `,
  helpBodyQueryTelnetFree: `
    <p>
      Rulează comanda telnet de dezvoltator <strong>free</strong> (instantaneu de tip memorie / heap). Folosiți-o când aveți nevoie de
      o citire rapidă a memoriei în timpul unui script.
    </p>
  `,
  helpBodyPostNone: `
    <p>Alegeți una dintre presetările <strong>POST</strong> (SGRendezvous, FW Beacons etc.). Fiecare opțiune corespunde unei căi fixe de pe dispozitiv.</p>
  `,
  helpBodyWaitDelay: `
    <p>
      Întrerupe scriptul pentru numărul dat de <strong>milisecunde</strong> fără interogare. Folosiți după animații,
      lansări sau orice pas unde aveți nevoie doar de o pauză fixă.
    </p>
  `,
  helpBodyWaitMediaPlayer: `
    <p>
      Interoghează <code>/query/media-player</code> până când <strong>starea</strong> playerului corespunde selecției dvs. (play,
      pause, buffer, …) sau expiră <strong>timpul limită</strong>.
    </p>
    <p>
      Ajustați <strong>intervalul de interogare</strong> pentru a echilibra reactivitatea și încărcarea. Dacă condiția nu devine niciodată adevărată,
      pasul eșuează când se atinge timpul limită.
    </p>
  `,
  helpBodyWaitRale: `
    <p>
      Interoghează prin <strong>RALE</strong> până când un câmp al unui nod de scenă corespunde comparației (operator + valoare). Trebuie
      să furnizați calea (matrice JSON), id-ul nodului, numele câmpului și câmpurile de temporizare.
    </p>
    <p>
      Necesită o conexiune App Connector la momentul rulării. Operatori precum <code>exists</code> / <code>notExists</code> pot
      ascunde câmpul de valoare — consultați etichetele formularului pentru modul activ.
    </p>
  `,
  helpBodyIfMediaPlayer: `
    <p>
      Evaluează o singură dată starea curentă a <strong>playerului media</strong> și rulează fie ramura <strong>atunci</strong>, fie
      ramura <strong>altfel</strong>. Alegeți starea așteptată (play, pause, …) pe care să se ramifice.
    </p>
    <p>Spre deosebire de <strong>Așteptare</strong>, nu există interogare: condiția este verificată o singură dată când rulează pasul.</p>
  `,
  helpBodyIfActiveApp: `
    <p>
      Compară un atribut din <code>/query/active-app</code> (app id, tip, versiune, nume) folosind operatorul și
      valoarea pe care le setați. Util pentru ramificare când un anumit canal este în prim-plan.
    </p>
  `,
  helpBodyIfRale: `
    <p>
      Verificare unică a unui <strong>câmp de nod RALE</strong> (cale, id nod, câmp, operator, valoare). Aceeași structură ca
      latura RALE a unei condiții de Așteptare, dar evaluată o singură dată pentru ramificare.
    </p>
  `,
  helpBodyIfVariables: `
    <p>
      Compară o valoare stocată într-o <strong>variabilă de script</strong> (dintr-o comandă RALE anterioară sau o atribuire de funcție de aplicație)
      folosind calea variabilei și operatorul pe care le configurați.
    </p>
    <p>Necesită versiunea de script 2 și pași anteriori care populează variabila.</p>
  `,
  helpBodyRaleNone: `
    <p>Selectați o <strong>comandă RALE</strong> din listă. Parametrii și opționalul „Setează variabila” apar după ce este aleasă o comandă.</p>
  `,
  helpBodyAppFunctionNone: `
    <p>
      Conectați <strong>App Connector</strong> pentru ca funcțiile exportate ale canalului dvs. să apară în listă, apoi alegeți o
      funcție pentru a-i vedea parametrii.
    </p>
  `,
  helpBodyKeypressNone: `
    <p>Alegeți o <strong>tastă de telecomandă</strong> din lista grupată. Scriptul trimite acea tastă prin ECP când rulează pasul.</p>
  `,
  helpBodySystemTelnetNone: `
    <p>Alegeți <strong>Plugins</strong> sau <strong>Memorie</strong> pentru acest pas vechi sau migrați la Interogare dispozitiv cu presetările telnet corespunzătoare.</p>
  `,
  helpBodySystemTelnetPlugins: `
    <p>Comandă telnet <strong>plugins</strong> veche. Pentru scripturi noi, preferați <strong>Interogare dispozitiv</strong> cu presetarea <code>telnet:plugins</code>.</p>
  `,
  helpBodySystemTelnetFree: `
    <p>Comandă telnet <strong>free</strong> (memorie) veche. Pentru scripturi noi, preferați <strong>Interogare dispozitiv</strong> cu presetarea <code>telnet:free</code>.</p>
  `,

  // ── Step Help modal: per-action fallback bodies (inline HTML) ──
  helpFallbackQuery: `
    <p>
      Rulează o citire de pe dispozitiv: fie un <strong>ECP GET</strong> normal pe o cale <code>/query/…</code>, fie
      un endpoint în stil dev, precum <code>telnet:plugins</code> / <code>telnet:free</code>.
    </p>
    <p>Alegeți o presetare pentru endpointuri comune sau <strong>Personalizat</strong> pentru a-l introduce pe al dvs.</p>
  `,
  helpFallbackPost: `
    <p>
      Trimite un <strong>HTTP POST</strong> către Roku pe o cale fixă de analiză / beacon. Fiecare presetare corespunde unui
      endpoint specific folosit în fluxurile de dezvoltare.
    </p>
  `,
  helpFallbackKeypress: `
    <p>
      Trimite o <strong>tastă de telecomandă</strong> prin ECP. Titlul de ajutor reflectă tasta selectată în prezent când
      deschideți acest dialog.
    </p>
  `,
  helpFallbackInputText: `
    <p>
      Trimite <strong>text în stil tastatură</strong> către dispozitiv (introducere de text ECP). Câmpul focalizat sau tastatura
      de pe ecran primește caracterele.
    </p>
  `,
  helpFallbackLaunch: `
    <p>
      Lansează un canal după <strong>app ID</strong>. <strong>Parametrii</strong> opționali pot furniza un Deep-Link sau argumente
      de lansare, în funcție de canal.
    </p>
  `,
  helpFallbackSideload: `
    <p>
      Încarcă un pachet din <strong>calea fișierului</strong> și îl instalează ca fiind canalul de dezvoltator sideload. Furnizați o
      parolă de dezvoltator pe pas sau prin <code>devPassword</code> în script atunci când este necesar.
    </p>
  `,
  helpFallbackDeleteSideload: `
    <p>Elimină canalul de dezvoltator sideload. Parola opțională corespunde setărilor de securitate dev ale dispozitivului dvs.</p>
  `,
  helpFallbackAppFunction: `
    <p>
      Apelează o <strong>funcție BrightScript</strong> prin App Connector. Subtitlul arată <strong>funcția
      selectată</strong>. Parametrii corespund semnăturii exportate a canalului; folosiți <strong>Setează variabila</strong> pentru a captura o
      valoare returnată pentru pași ulteriori.
    </p>
  `,
  helpFallbackRaleCommand: `
    <p>
      Rulează o <strong>comandă RALE încorporată</strong>. Subtitlul arată comanda selectată; textul extins provine
      din descrierea încorporată a comenzii, când este disponibilă.
    </p>
  `,
  helpFallbackDevicePerformance: `
    <p>
      Realizează un instantaneu al graficelor de <strong>Performanță dispozitiv</strong> pentru <strong>același dispozitiv</strong> pe care rulează acest script (aceeași
      conexiune ca Interogare dispozitiv și apăsarea tastelor). Valorile respectă setările de istoric ale Remote Section când interogarea în timp real a
      umplut graficele; altfel, pasul așteaptă scurt o probă nouă când este necesar.
    </p>
    <h4>Grafic</h4>
    <p>
      <strong>Obiecte BrightScript</strong>, <strong>Utilizare CPU</strong>, <strong>Memorie de sistem</strong> sau
      <strong>Toate împreună</strong> (un singur rezultat combinat: CPU, apoi memorie, apoi obiecte). CPU și memoria provin din
      aceeași interogare de performanță a canalului.
    </p>
    <h4>Etichetă opțională</h4>
    <p>Afișată în antetul rezultatelor, similar cu pasul de captură de ecran.</p>
  `,
  helpFallbackScreenshot: `
    <p>
      Capturează imaginea televizorului prin <strong>Developer App</strong>. Developer App ar trebui să fie activă; o
      parolă de dezvoltator trebuie să fie disponibilă pe pas, în script sau la promptul de validare.
    </p>
    <h4>Așteaptă înainte (ms)</h4>
    <p>
      Pauză în Executor <strong>înainte</strong> de începerea capturii, pentru ca UI să se stabilizeze (implicit 100 ms când adăugați
      pasul).
    </p>
    <h4>Așteaptă după (ms)</h4>
    <p>
      După declanșarea capturii, Executor așteaptă înainte de a descărca <code>dev.jpg</code>. Măriți dacă imaginile sunt
      trunchiate; gol folosește implicit <strong>1500 ms</strong>.
    </p>
    <h4>Etichetă opțională</h4>
    <p>Ajută la identificarea acestei capturi în rezultatul rulării când un script face mai multe capturi de ecran.</p>
  `,
  helpFallbackWait: `
    <p>
      Fie o <strong>întârziere fixă</strong>, fie <strong>până când o condiție</strong> este îndeplinită. Subtitlul reflectă
      tipul de așteptare curent și, pentru condiții, sursa de date (player media sau câmp de nod RALE).
    </p>
  `,
  helpFallbackIf: `
    <p>
      Se ramifică în liste de pași <strong>atunci</strong> / <strong>altfel</strong> folosind o condiție unică. Subtitlul
      reflectă sursa condiției selectate (player media, aplicație activă, câmp RALE sau variabile). Necesită versiunea de
      script 2.
    </p>
  `,
  helpFallbackSystemTelnet: `
    <p>
      Pas <strong>vechi</strong> doar pentru telnet. Pentru scripturi noi, preferați <strong>Interogare dispozitiv</strong> cu <code>telnet:plugins</code> sau
      <code>telnet:free</code>.
    </p>
  `,

  // ── Step Help modal: composed / interpolated body fragments (dynamic values pre-escaped) ──
  helpQueryPresetBody: (label: string, endpoint: string): string => `
    <p>
      Rulează o <strong>Interogare dispozitiv</strong> pentru <strong>${label}</strong> folosind endpointul
      <code>${endpoint}</code>.
    </p>
    <p>
      Ca toate interogările, aceasta folosește ECP (sau calea dev-plugin a aplicației pentru presetări în stil telnet). Dispozitivul trebuie să fie
      accesibil în rețea.
    </p>
  `,
  helpPostPresetBody: (label: string, endpoint: string): string => `
    <p>
      Trimite un <strong>POST</strong> HTTP către <code>${endpoint}</code> (<strong>${label}</strong>).
    </p>
    <p>Folosiți aceasta pentru fluxuri de analiză / beacon care așteaptă POST în loc de GET.</p>
  `,
  helpSelectedFunction: (fn: string): string =>
    `<p><strong>Funcție selectată:</strong> <code>${fn}</code></p>`,
  helpAppFunctionDescription: (desc: string): string =>
    `<p><strong>Descriere funcție de aplicație:</strong> ${desc}</p>`,
  helpAppFunctionArgs:
    '<p>Rândurile de argumente respectă metadatele App Connector pentru această funcție; tipurile complexe folosesc JSON în câmp.</p>',
  helpCurrentKey: (nice: string, key: string): string => `
        <p>
          <strong>Tastă curentă:</strong> ${nice} (<code>${key}</code>) — trimisă ca o apăsare de tastă
          ECP standard când rulează pasul.
        </p>
      `,

  // ── Builder: additional field placeholders / option fallbacks ──
  placeholderQueryEndpoint: '/query/… sau telnet:plugins / telnet:free',
  placeholderVariablePathExample: 'myVar sau data.items.0.id',
  optionUnknownFunction: 'necunoscut',

  // ── Executor: step descriptions (stepDescription; result-card header + list rows) ──
  descQuery: (endpoint: string): string => `Interogare ${endpoint}`,
  descKeypress: (key: string): string => `Apăsare tastă ${key}`,
  descSendText: (text: string): string => `Trimite text "${text}"`,
  descLaunchApp: (appId: string): string => `Lansează aplicația ${appId}`,
  descSideload: (filename: string): string => `Sideload ${filename}`,
  descDeleteSideload: 'Șterge sideload',
  descAppFunction: (fn: string): string => `Funcție de aplicație ${fn}`,
  descScreenshot: 'Captură de ecran',
  descScreenshotLabel: (label: string): string => `Captură de ecran (${label})`,
  descScreenshotWaitAfter: (ms: number): string => `Captură de ecran (așteptare după: ${ms}ms)`,
  descDevicePerformance: (chart: string): string => `Performanță dispozitiv — ${chart}`,
  descDevicePerformanceLabel: (label: string, chart: string): string =>
    `Performanță dispozitiv (${label}) — ${chart}`,
  descWait: 'Așteptare',
  descWaitWithDetails: (details: string): string => `Așteptare · ${details}`,
  descIf: 'Dacă (…)',
  descIfWithDetails: (details: string): string => `Dacă · ${details}`,

  // ── Executor: wait-step Details column (formatWaitStepListDetails) ──
  waitDetailFixedDelay: (delayMs: number): string => `Întârziere fixă ${delayMs} ms`,
  waitDetailTiming: (maxSec: number, pollMs: number): string =>
    ` · max ${maxSec}s · interogare ${pollMs}ms`,
  waitDetailMediaPlayerState: (state: string): string => `Player media · până la starea "${state}"`,
  waitDetailMediaPlayerCheck: (check: string): string => `Player media · până la ${check}`,
  waitDetailRale: (line: string): string => `Câmp nod RALE · ${line}`,
  waitDetailRaleIncomplete: 'Câmp nod RALE · (incomplet)',
  waitDetailGenericSource: (src: string): string => `Așteptare · sursă ${src}`,

  // ── Executor: if-step Details column (formatIfStepListDetails) ──
  ifDetailMediaPlayerState: (state: string): string => `Player media · stare "${state}"`,
  ifDetailMediaPlayerCheck: (check: string): string => `Player media · ${check}`,
  ifDetailRale: (line: string): string => `Câmp nod RALE · ${line}`,
  ifDetailRaleEmpty: 'Câmp nod RALE · …',
  ifDetailVariable: (path: string): string => `Variabilă · $${path}`,
  ifDetailVariableEmpty: 'Variabilă · …',
  ifDetailActiveApp: (attr: string): string => `Aplicație activă · ${attr}`,
  ifDetailActiveAppEmpty: 'Aplicație activă · …',

  // ── Executor: results-panel progress log lines (onLog) ──
  logWaitingMs: (ms: number): string => `Se așteaptă ${ms} ms...`,
  logWaitingBeforeCapture: (ms: number): string => `Se așteaptă ${ms} ms înainte de captură...`,
  logPollingFieldMet: (elapsed: number, field: string): string =>
    `Se interoghează... (${elapsed}s) — câmpul "${field}" — condiție îndeplinită`,
  logPollingField: (elapsed: number, field: string, value: string): string =>
    `Se interoghează... (${elapsed}s) — câmpul "${field}": ${value}`,
  logPollingStatusMet: (elapsed: number, status: string): string =>
    `Se interoghează... (${elapsed}s) — ${status} — condiție îndeplinită`,
  logPollingStatus: (elapsed: number, status: string): string =>
    `Se interoghează... (${elapsed}s) — ${status}`,
  pollValueEmpty: '(gol)',
  pollValueReconnecting: '(se reconectează...)',
  pollValueNoResponse: '(niciun răspuns)',
  pollStateValue: (state: unknown): string => `stare: ${state}`,
  pollStateNone: 'stare: (niciuna)',
  pollInvalidMediaPlayer: 'Răspuns media-player nevalid',
  pollQueryFailed: (err: string): string => `Interogare eșuată: ${err}`,
  pollNoResponse: 'Niciun răspuns',
  logConnectingTelnet: 'Se conectează la Telnet (port 8080)...',
  logQueryUsesDevTelnet: (ep: string, cmd: string): string =>
    `Interogarea dispozitiv "${ep}" folosește Telnet dev "${cmd}" (la fel ca fila Interogare).`,
  logPartialPerformance: 'Unele secțiuni de performanță nu au fost disponibile; instantaneu parțial.',

  // ── Executor: step result summaries (onLog) ──
  stepSummaryChars: (n: number): string => `→ ${n} caractere`,
  stepSummaryOk: '→ OK',
  stepSummarySentKey: (key: string): string => `→ trimis ${key}`,
  stepSummarySent: '→ trimis',
  stepSummaryLaunched: (appId: string): string => `→ lansat ${appId}`,
  stepSummarySideloadComplete: '→ sideload finalizat',
  stepSummaryDeleted: '→ șters',
  stepSummarySaveFailed: (err: string): string => `→ salvare eșuată: ${err}`,
  stepSummarySavedAs: (filename: string): string => `→ salvat ca ${filename}`,
  stepSummaryCapturedNoFolder: '→ capturat (fără folder de salvare)',
  stepSummaryChartImages: (n: number): string => `→ ${n} imagine/imagini grafic`,
  stepSummaryCaptured: '→ capturat',
  stepSummarySkipped: (reason: string): string => `→ omis (${reason})`,

  // ── Executor: step errors / skip reasons (result.error / skippedReason) ──
  errWaitTimeout: 'Timp de așteptare expirat',
  errStopped: 'Oprit',
  skipReasonNoAppConnector: 'App Connector nu este disponibil',
  errNoAppConnectorRaleWait: 'App Connector nu este disponibil pentru așteptarea nodului RALE',
  errUnknownActionType: (type: string): string => `Tip de acțiune necunoscut: ${type}`,
  errInvalidRaleCommand: 'Comandă RALE nevalidă',
  errTelnetNotAvailable: 'Comenzile de sistem Telnet nu sunt disponibile în acest context',
  errSaveNotAvailable: 'Salvarea nu este disponibilă',
  errCouldNotVerifyDevApp: (err: string): string =>
    `Starea Dev App nu a putut fi verificată înainte de captură: ${err}`,
  errInvalidPath: 'Cale nevalidă',
  errStepPreorderMismatch: 'Eroare internă: nepotrivire de preordine a pașilor',

  // ── Settings: Action Script default-folder picker (main process) ──
  pickDefaultFolderTitle: 'Folder implicit pentru rezultatul Action Script'
};
