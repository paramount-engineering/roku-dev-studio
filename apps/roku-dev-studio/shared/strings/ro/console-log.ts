/**
 * Romanian (ro) translation of the Console log surface strings (find/filter
 * bar, JSON/XML/URL viewer modals, Console Monitor, and fold controls). Sibling
 * of ../console-log.ts — same `consoleLog` shape, keys, order, and function
 * signatures.
 *
 * Parametrized strings are functions returning the composed text. Only literal
 * display text is translated; format tokens and code literals stay verbatim.
 * Count-based functions apply Romanian plural logic (singular for n===1; "de"
 * before the noun when n===0 or the last two digits are 0 or fall in 20–99).
 */
export const consoleLog = {
  // ── Shared viewer modal chrome (console-modal-title.ts, structured + URL modals) ──────
  /** Default title prefix for the JSON/XML/URL viewer modals ("Console: JSON"). */
  titlePrefix: 'Consolă',
  jsonLabel: 'JSON',
  xmlLabel: 'XML',
  jsonPlusLabel: 'JSON+',
  urlLabel: 'URL',
  /** Transient button feedback after copying (plain text, no glyph — distinct from common.copied). */
  copied: 'Copiat',

  // ── Fold twisty (console-structured-syntax.ts) ────────────────────────────────────────
  collapse: 'Restrânge',
  expand: 'Extinde',

  // ── Structured JSON/XML viewer modal (console-structured-view-modal.ts) ───────────────
  copyFormattedTitle: 'Copiază textul formatat',
  hintJsonFullNested: 'Faceți clic pentru a vedea JSON-ul complet pentru această linie. Folosiți JSON+ doar pentru fragmentele imbricate.',
  hintJsonFormatted: 'Faceți clic pentru a vedea JSON-ul formatat (se deschide într-o fereastră modală)',
  hintXmlFull: 'Faceți clic pentru a vedea XML-ul complet pentru această linie.',
  hintXmlFormatted: 'Faceți clic pentru a vedea XML-ul formatat (se deschide într-o fereastră modală)',
  hintPillNestedJson: 'Doar JSON imbricat (dintr-un șir cu caractere de evadare). Nu deschide JSON-ul exterior complet.',
  hintPillFullJson: 'JSON complet pentru această linie (faceți clic pe textul liniei pentru același rezultat).',

  // ── URL viewer modal (console-url-modal.ts) ───────────────────────────────────────────
  openInBrowser: 'Deschide în browser',
  openInBrowserTitle: 'Deschide în browserul implicit',
  copyUrlTitle: 'Copiază URL',
  fullUrlAria: 'URL complet',
  queryParamsAria: 'Parametri de interogare',
  colKey: 'Cheie',
  colValue: 'Valoare',
  couldNotParseParams: 'Nu s-au putut analiza parametrii.',
  noQueryParams: 'Niciun parametru de interogare.',
  parameterSet: (n: number): string => `Set de parametri ${n}`,

  // ── Inline URL span (console-url-detect.ts) ───────────────────────────────────────────
  urlSpanTitle: 'Faceți clic pentru previzualizare într-o fereastră modală · ⌘ sau Ctrl+clic pentru a deschide în browser',

  // ── Find/filter bar markup (console-find-bar-markup.ts) ───────────────────────────────
  modeSelectAria: 'Mod de căutare sau filtrare',
  modeFind: 'Caută',
  modeFilter: 'Filtrează',
  queryPlaceholder: 'Caută...',
  queryAria: 'Interogare de căutare sau filtrare',
  // Option-button tooltips: `alt` appends the (Alt+…) shortcut hint the main window binds.
  // The aria-label reuses the same text with `alt=false` (no shortcut suffix).
  optMatchCaseTitle: (alt: boolean): string => `Potrivește majuscule/minuscule${alt ? ' (Alt+C)' : ''}`,
  optWholeWordTitle: (alt: boolean): string => `Potrivește cuvântul întreg${alt ? ' (Alt+W)' : ''}`,
  optRegexTitle: (alt: boolean): string => `Folosește expresie regulată${alt ? ' (Alt+R)' : ''}`,
  prevTitle: 'Anterior (Shift+Enter)',
  prevAria: 'Potrivirea anterioară',
  nextTitle: 'Următorul (Enter)',
  nextAria: 'Potrivirea următoare',
  clearAria: 'Șterge căutarea',

  // ── Find/filter bar runtime (console-find-bar.ts) ─────────────────────────────────────
  regexSuggestTitle: 'Aceasta pare o expresie regulată — faceți clic pentru a căuta cu regex',
  searchingPct: (pct: number): string => `Se caută... ${pct}%`,
  noResults: 'Niciun rezultat',
  matchPosition: (current: number, total: number): string => `${current} din ${total}`,
  firstMatchesNote: ' (primele potriviri)',
  highlightsCappedNote: ' (evidențieri limitate)',
  searchingSuffix: (pct: number): string => ` (se caută ${pct}%)`,
  searchingRemote: 'Se caută…',
  filteringRemote: 'Se filtrează…',
  searchFailed: 'Căutarea a eșuat',
  filterFailed: 'Filtrarea a eșuat',
  linesMatched: (n: number, capped: boolean): string => {
    const mod100 = n % 100;
    const useDe = mod100 === 0 || (mod100 >= 20 && mod100 <= 99);
    const word = n === 1 ? 'linie' : 'linii';
    return `${n.toLocaleString()} ${useDe ? 'de ' : ''}${word}${capped ? ' (limitat)' : ''}`;
  },

  // ── Console Monitor / analytics modal (console-analytics-modal.ts) ────────────────────
  monitorTitle: 'Monitor consolă',
  noRecognizedIssues: 'Nicio problemă BrightScript recunoscută. 🎉',
  sectionCrashes: 'Blocări',
  sectionIssues: 'Probleme',
  labelWhat: 'Ce',
  labelCause: 'Cauză',
  labelFix: 'Soluție',
  docsLink: 'documentație ↗',
  copyMessageTitle: 'Copiază mesajul',
  copyMessageAria: 'Copiază mesajul de eroare',
  goToLineTitle: 'Mergi la această linie în jurnal',
  goToCrashTitle: 'Mergi la această blocare în jurnal',
  copyCrashTitle: 'Copiază blocarea + urma stivei',
  copyCrashAria: 'Copiază blocarea și urma stivei',
  backtraceHead: 'Urma stivei',
  noBacktrace:
    'Canalul a ieșit în urma unei blocări BrightScript; nu a fost capturată nicio urmă a stivei în acest rezultat al consolei.',
  crashKindLabel: 'Blocare',
  // Crash severity badge (rendered uppercase via CSS; kept lowercase to mirror the data-driven
  // severity tokens on the non-crash issue badges).
  severityCrash: 'blocare',
  // Crash card annotations: "exited" badge and inline "runtime error <code>" (both lowercase; the
  // badge is uppercased by CSS, the code annotation reads inline).
  exitedLabel: 'ieșit',
  exitedTitle: 'Procesul canalului a ieșit',
  runtimeErrorLabel: 'eroare de execuție',
  crashCount: (n: number): string => {
    const mod100 = n % 100;
    const useDe = mod100 === 0 || (mod100 >= 20 && mod100 <= 99);
    const word = n === 1 ? 'blocare' : 'blocări';
    return `${n.toLocaleString()} ${useDe ? 'de ' : ''}${word}`;
  },
  issuesAcrossLines: (issues: number, lines: number): string => {
    const iMod100 = issues % 100;
    const iDe = iMod100 === 0 || (iMod100 >= 20 && iMod100 <= 99);
    const issueWord = issues === 1 ? 'problemă' : 'probleme';
    const lMod100 = lines % 100;
    const lDe = lMod100 === 0 || (lMod100 >= 20 && lMod100 <= 99);
    const lineWord = lines === 1 ? 'linie' : 'linii';
    return `${issues.toLocaleString()} ${iDe ? 'de ' : ''}${issueWord} în ${lines.toLocaleString()} ${lDe ? 'de ' : ''}${lineWord}`;
  },
  spillNote: (total: number): string =>
    `(din ${total.toLocaleString()} capturate — liniile mai vechi trecute pe disc nu sunt scanate)`,
  occurrences: (n: number): string => (n === 1 ? 'Apariție' : 'Apariții'),
  moreUniqueLines: (n: number): string => {
    const mod100 = n % 100;
    const useDe = mod100 === 0 || (mod100 >= 20 && mod100 <= 99);
    const word = n === 1 ? 'linie unică' : 'linii unice';
    return `+${n.toLocaleString()} ${useDe ? 'de ' : ''}${word} în plus`;
  },

  // ── BrightScript error catalog (brightscript-error-catalog.ts) ────────────────────────
  // Romanian copy for each catalog entry, keyed by the entry `id` (same ids/shape as the
  // English catalog). BrightScript/Roku technical tokens, code literals, API/type names and
  // message signatures are kept verbatim; only the surrounding prose is translated.
  errors: {
    'type-mismatch': {
      title: 'Nepotrivire de tip',
      meaning: 'Un operator a fost aplicat unor valori de tipuri incompatibile.',
      cause: 'Compararea sau combinarea unor tipuri nepotrivite (de ex. String față de Integer) sau o variabilă neinițializată tratată ca tip greșit.',
      fix: 'Convertiți cu Str()/Val()/ToStr() astfel încât ambii operanzi să aibă același tip. Roku OS 10.5+ numește operatorul și ambele tipuri în mesaj.',
    },
    'dot-on-invalid': {
      title: 'Operatorul "Dot" pe un obiect invalid',
      meaning: 'S-a folosit `.` pentru a citi un membru/câmp al unei valori care este invalid sau nu este o componentă/interfață.',
      cause: 'Obiectul nu a fost creat niciodată sau o căutare a returnat invalid — de ex. `m.top.findNode("x").text` unde findNode a returnat invalid.',
      fix: 'Verificați dacă nu este invalid înainte de a folosi punctul (`if node <> invalid`); confirmați că obiectul există și că numele membrului este corect.',
    },
    'for-each-non-enumerable': {
      title: 'FOR EACH pe o valoare neenumerabilă',
      meaning: '`for each` a fost executat pe o valoare care este invalid sau nu este un obiect enumerabil.',
      cause: 'Iterarea rezultatului unei funcții care a returnat invalid (o cheie AA lipsă, un GetChildElements()/GetBody() gol) sau a unui scalar/nod.',
      fix: 'Verificați valoarea invalid/tipul înainte de buclă; enumerați doar roArray, roList, roAssociativeArray sau roMessagePort (tipuri cu ifEnum).',
    },
    'call-on-non-function': {
      title: 'Operatorul de apel ( ) pe o non-funcție',
      meaning: 'Codul a încercat să invoce `()` pe o valoare care nu este o funcție.',
      cause: 'O variabilă a umbrit o funcție, numele este scris greșit/nedeclarat sau valoarea este invalid/date în loc de funcție.',
      fix: 'Verificați că identificatorul este o funcție definită; căutați coliziuni de nume și valori invalid înainte de apel.',
    },
    'uninitialized-variable': {
      title: 'Utilizarea unei variabile neinițializate',
      meaning: 'O variabilă a fost citită înainte de a i se atribui vreodată o valoare.',
      cause: 'Un nume de variabilă scris greșit, o variabilă declarată doar în alt domeniu (scope) sau o ramură condițională care a sărit peste atribuire.',
      fix: 'Inițializați înainte de utilizare; verificați ortografia și domeniul; depanatorul afișează astfel de variabile locale ca `<uninitialized>`.',
    },
    'uninitialized-function-ref': {
      title: 'Referință de funcție neinițializată',
      meaning: 'Apel prin intermediul unei variabile de funcție care nu conține nicio funcție.',
      cause: 'Un pointer de funcție nu a fost atribuit niciodată sau a fost setat la invalid.',
      fix: 'Atribuiți o referință de funcție validă înainte de a o invoca.',
    },
    'invalid-left-side': {
      title: 'Parte stângă invalidă a expresiei',
      meaning: 'Ținta unei atribuiri nu este ceva căruia i se poate atribui o valoare.',
      cause: 'Atribuirea către un literal sau o expresie în loc de o variabilă sau un câmp de obiect.',
      fix: 'Atribuiți doar unei variabile sau unui câmp de obiect.',
    },
    'divide-by-zero': {
      title: 'Împărțire la zero',
      meaning: 'O împărțire sau MOD a folosit un numitor zero în timpul execuției.',
      cause: 'O variabilă divizor a fost evaluată la 0 (sau la invalid, convertită la 0).',
      fix: 'Protejați numitorii înainte de împărțire (`if d <> 0`).',
    },
    'array-out-of-bounds': {
      title: 'Indice de tablou în afara limitelor',
      meaning: 'Citire sau scriere dincolo de sfârșitul (sau cu un indice negativ în) un tablou.',
      cause: 'Limite de buclă greșite cu o unitate (off-by-one); indexarea unui tablou gol sau mai scurt.',
      fix: 'Verificați `arr.count()` înainte de indexare; validați limitele buclei.',
    },
    'array-not-dimd': {
      title: 'Operație de tablou pe o variabilă fără DIM',
      meaning: 'Indexarea unei variabile care nu a fost creată niciodată ca tablou.',
      cause: 'Utilizarea `[]` pe un scalar sau pe invalid.',
      fix: 'Inițializați tabloul (`arr = []`) înainte de a-l indexa.',
    },
    'non-numeric-array-index': {
      title: 'Indice de tablou nenumeric',
      meaning: 'S-a folosit un string/obiect ca indice într-un roArray.',
      cause: 'Confundarea unui roArray cu un roAssociativeArray.',
      fix: 'Folosiți un AA pentru chei de tip string sau un indice numeric pentru tablouri.',
    },
    'invalid-num-array-indexes': {
      title: 'Număr invalid de indici de tablou',
      meaning: 'S-a folosit o dimensionalitate greșită pentru a indexa un tablou.',
      cause: 'Utilizarea `a[i,j]` pe un tablou unidimensional (sau invers).',
      fix: 'Potriviți numărul de indici cu dimensiunile declarate ale tabloului.',
    },
    'wrong-num-params': {
      title: 'Număr greșit de parametri de funcție',
      meaning: 'O funcție a fost apelată cu prea puține sau prea multe argumente.',
      cause: 'O semnătură modificată sau un parametru opțional fără valoare implicită.',
      fix: 'Potriviți apelul cu semnătura; oferiți valori implicite parametrilor opționali.',
    },
    'bad-throw': {
      title: 'Argument throw invalid',
      meaning: 'Unui `throw` i s-a dat altceva decât un string sau un AA de eroare valid.',
      cause: 'Aruncarea unui număr/obiect care nu are câmpurile `number`/`message` valide.',
      fix: 'Aruncați un string sau un AA cu câmpurile `number` de tip Integer și `message` de tip String.',
    },
    'user-thrown-exception': {
      title: 'Excepție de utilizator neprinsă (THROW)',
      meaning: 'Un `throw` s-a propagat până la vârf fără a fi prins, încheind scriptul.',
      cause: 'Un `throw "…"` (sau `throw {message: …}`) fără un `try/catch` înconjurător care să îl trateze.',
      fix: 'Încadrați apelul care aruncă excepția într-un `try/catch` (Roku OS 9.4+) și inspectați `e.number`/`e.message`/`e.backtrace`.',
    },
    'invalid-format-specifier': {
      title: 'Specificator de format invalid',
      meaning: 'Un specificator greșit a fost transmis unei funcții de formatare.',
      cause: 'Un token Format()/în stil printf malformat.',
      fix: 'Corectați șirul de format.',
    },
    'invalid-param': {
      title: 'Parametru invalid transmis funcției/tabloului',
      meaning: 'O funcție încorporată a primit un argument în afara domeniului (de ex. sqrt dintr-un număr negativ, o dimensiune negativă).',
      cause: 'Un domeniu matematic greșit sau o dimensiune negativă de tablou.',
      fix: 'Validați argumentele înainte de apel.',
    },
    'member-fn-not-found': {
      title: 'Funcție membru negăsită',
      meaning: 'S-a apelat o metodă pe care componenta sau interfața nu o expune.',
      cause: 'Un nume de metodă scris greșit, apelul pe invalid, tipul greșit de componentă sau o metodă lipsă pe acea versiune de firmware.',
      fix: 'Confirmați că metoda există pentru acel obiect/OS; protejați obiectele invalid înainte de apel.',
    },
    'interface-not-member': {
      title: 'Interfața nu este membru al componentei',
      meaning: 'S-a solicitat o interfață pe care componenta nu o implementează.',
      cause: 'Un apel GetInterface() pentru o interfață pe care obiectul nu o are sau un nume greșit de interfață.',
      fix: 'Folosiți o interfață pe care componenta o expune efectiv.',
    },
    'component-class-not-found': {
      title: 'Clasă de componentă/nod negăsită',
      meaning: 'CreateObject / createChild a folosit o clasă sau un tip de nod care nu există.',
      cause: 'Un șir de tip scris greșit sau cu majuscule/minuscule greșite, sau o componentă nedeclarată/neînregistrată în pachet.',
      fix: 'Corectați șirul de tip (sensibil la majuscule/minuscule); asigurați-vă că XML-ul componentei este inclus în canal.',
    },
    'sg-field-type-mismatch': {
      title: 'Nepotrivire de tip pentru câmpul SceneGraph',
      meaning: 'O valoare atribuită unui câmp de nod nu a corespuns tipului declarat al câmpului.',
      cause: 'Atribuirea, de ex., a unui String unui câmp int/uri sau a unui Array unui câmp assocarray prin setField/addReplace.',
      fix: 'Atribuiți o valoare care corespunde tipului de interfață declarat al câmpului sau corectați tipul câmpului în XML-ul componentei.',
    },
    'sg-nonexistent-field': {
      title: 'Setarea unui câmp SceneGraph inexistent',
      meaning: 'Atribuire către un câmp de nod pe care tipul de nod nu îl declară (ignorat în tăcere).',
      cause: 'Un nume de câmp scris greșit sau un câmp nedefinit în `<interface>` din XML-ul componentei.',
      fix: 'Folosiți un nume de câmp declarat (sensibil la majuscule/minuscule) sau adăugați câmpul în interfața XML a componentei.',
    },
    'component-call-arg-count': {
      title: 'Apelul de componentă are un număr greșit de parametri',
      meaning: 'O metodă de componentă încorporată a fost apelată cu un număr greșit de argumente.',
      cause: 'Un număr de argumente care nu corespunde semnăturii metodei ifXXX.',
      fix: 'Potriviți semnătura documentată a metodei.',
    },
    'rendezvous-aborted': {
      title: 'Rendezvous anulat',
      meaning: 'Un acces la nod între fire de execuție a eșuat deoarece nodul țintă era invalid sau dispărut.',
      cause: 'Accesarea unui nod deținut de un alt fir de execuție care a fost distrus sau blocat (de ex. un nod global pierdut după o redare îndelungată).',
      fix: 'Evitați accesul frecvent la noduri între fire de execuție; verificați valoarea invalid înainte de acces; profilați cu `logrendezvous` / `sgperf`.',
    },
    'rendezvous-block': {
      title: 'Rendezvous SceneGraph (blocarea firului de execuție)',
      meaning: 'Un punct de sincronizare între firul de randare ↔ firul de task; cele frecvente blochează firul de randare.',
      cause: 'Un fir Task care citește/scrie câmpurile de nod ale firului de randare pe rând, câte unul.',
      fix: 'Grupați accesul la câmpuri cu getFields/setFields; minimizați accesul la noduri între fire de execuție.',
    },
    'execution-timeout': {
      title: 'Timp de execuție depășit (scriptul a rulat prea mult)',
      meaning: 'Codul a rulat prea mult pe un fir de execuție (firul de randare are o limită de câteva secunde).',
      cause: 'Bucle grele, analiza unor JSON mari sau I/O sincron pe firul de randare sau pe un fir Task.',
      fix: 'Mutați munca grea într-un nod Task; împărțiți munca în bucăți sau faceți-o asincronă.',
    },
    'too-many-task-threads': {
      title: 'Prea multe fire Task',
      meaning: 'S-a depășit limita de fire Task concurente.',
      cause: 'Crearea de noduri Task într-o buclă fără reutilizare sau curățare.',
      fix: 'Reutilizați/grupați nodurile Task; limitați concurența; lăsați task-urile să se termine.',
    },
    'wait-on-non-port': {
      title: 'Așteptare pe un obiect fără port de mesaje',
      meaning: '`wait()` a fost apelat pe un obiect care nu are ifMessagePort.',
      cause: 'Așteptarea pe obiectul greșit în loc de un roMessagePort.',
      fix: 'Așteptați doar pe un roMessagePort.',
    },
    'formatjson-nested': {
      title: 'Referință imbricată/ciclică în FormatJSON',
      meaning: 'FormatJSON a eșuat din cauza unei referințe circulare sau a unei imbricări mai adânci de 256 de niveluri.',
      cause: 'Un graf de obiecte ciclic sau un tip de valoare neacceptat (de ex. un roList) în arbore.',
      fix: 'Rupeți ciclurile de referință; păstrați imbricarea sub 256; serializați doar tipurile acceptate (AA, array, string, number, boolean).',
    },
    'parsejson-failed': {
      title: 'ParseJSON a eșuat',
      meaning: 'ParseJSON nu a putut analiza șirul de intrare (returnează invalid).',
      cause: 'Intrare goală/spații albe (de ex. un corp de răspuns HTTP gol), JSON malformat sau un argument care nu este string.',
      fix: 'Protejați împotriva intrării goale/invalide înainte de ParseJSON; verificați sursa (verificați mai întâi corpul/lungimea HTTP).',
    },
    'file-write-failed': {
      title: 'Scrierea în fișier a eșuat',
      meaning: 'Un fișier nu a putut fi deschis pentru scriere (WriteAsciiFile / roCreateFile).',
      cause: 'Scrierea în afara unei locații cu permisiune de scriere — doar `tmp:/` și `cachefs:/` permit scrierea (`pkg:/` este doar-citire) — sau un director lipsă / disc plin.',
      fix: 'Scrieți doar în `tmp:/` sau `cachefs:/`; asigurați-vă că calea părinte există.',
    },
    'stack-overflow': {
      title: 'Depășire de stivă',
      meaning: 'Stiva de apeluri a fost epuizată.',
      cause: 'Recursivitate nelimitată sau foarte adâncă (Roku depășește după ~31 de apeluri imbricate).',
      fix: 'Adăugați un caz de bază; convertiți recursivitatea adâncă în iterație.',
    },
    'out-of-memory': {
      title: 'Memorie insuficientă',
      meaning: 'O alocare de memorie a eșuat; heap-ul este epuizat.',
      cause: 'Structuri de date mari, scurgeri de memorie sau noduri/texturi reținute; construirea unor șiruri uriașe într-o buclă.',
      fix: 'Eliberați referințele, reduceți dimensiunea datelor, reutilizați nodurile; transmiteți/împărțiți în bucăți munca cu șiruri mari.',
    },
    'string-too-long': {
      title: 'Șir prea lung',
      meaning: 'Un șir a depășit lungimea maximă.',
      cause: 'Concatenarea unei intrări nelimitate.',
      fix: 'Limitați sau divizați lungimea șirului.',
    },
    'syntax-error': {
      title: 'Eroare de sintaxă',
      meaning: 'Sursa nu a putut fi compilată.',
      cause: 'Greșeli de scriere, blocuri neechilibrate sau tokenuri greșite.',
      fix: 'Corectați sintaxa la linia/coloana raportată; compilați local înainte de sideloading.',
    },
    'compile-error-generic': {
      title: 'Eroare de compilare',
      meaning: 'Compilatorul a respins una sau mai multe linii înainte ca aplicația să ruleze.',
      cause: 'O greșeală de scriere, un cuvânt-cheie lipsă sau o expresie malformată.',
      fix: 'Corectați fiecare `line N:` raportat în fișierul indicat.',
    },
    'unterminated-block': {
      title: 'Bloc neterminat',
      meaning: 'Unui bloc de control (FOR/NEXT, IF/ENDIF, WHILE/ENDWHILE) îi lipsește cuvântul-cheie de închidere.',
      cause: 'Un `end if` / `next` / `end while` lipsă sau nepotrivit.',
      fix: 'Echilibrați fiecare cuvânt-cheie de deschidere a blocului cu închiderea corespunzătoare.',
    },
    'xml-parse-error': {
      title: 'Eroare de analiză a componentei XML',
      meaning: 'Un fișier de componentă XML SceneGraph nu a putut fi analizat sau are un defect.',
      cause: 'Marcaj malformat, o etichetă greșită sau o referință greșită de câmp/interfață/script în componentă.',
      fix: 'Validați marcajul .xml și corectați definiția componentei.',
    },
    'no-manifest': {
      title: 'Fără manifest — pachet invalid',
      meaning: 'Arhiva zip încărcată prin sideload nu conține un manifest valid.',
      cause: 'Manifestul lipsește sau nu se află în rădăcina arhivei.',
      fix: 'Puneți un fișier `manifest` valid în rădăcina arhivei zip.',
    },
    'unused-variable': {
      title: 'Variabilă neutilizată',
      meaning: 'O variabilă declarată — adesea un parametru de funcție sau de handler de evenimente — nu este niciodată utilizată.',
      cause: 'Un parametru de handler (`msg`/`event`/`field`) sau o variabilă locală pe care corpul funcției nu o referențiază niciodată.',
      fix: 'Eliminați-o dacă este cu adevărat neutilizată; este inofensivă la livrare. Parametrii obligatorii din semnătura callback-ului pot fi lăsați așa cum sunt.',
    },
    'brightscript-warning': {
      title: 'Avertisment BrightScript',
      meaning: 'Compilatorul BrightScript a emis un avertisment non-fatal.',
      cause: 'O problemă la nivel de lint (cod neutilizat, un tipar depreciat) care nu oprește execuția.',
      fix: 'Examinați funcția/fișierul indicat — avertismentele pot rula în siguranță, dar semnalează adesea cod mort sau greșeli.',
    },
    'http-unsupported-protocol': {
      title: 'Protocol neacceptat (-1)',
      meaning: 'Schema URL nu este acceptată de transfer.',
      cause: 'Un URL malformat sau o schemă greșită.',
      fix: 'Folosiți un URL http(s):// acceptat.',
    },
    'http-resolve-host': {
      title: 'Nu s-a putut rezolva gazda (-6)',
      meaning: 'Rezolvarea DNS a gazdei cererii a eșuat.',
      cause: 'Un nume de gazdă greșit, lipsa rețelei sau o pană DNS.',
      fix: 'Verificați URL-ul/gazda și conectivitatea la rețea.',
    },
    'http-connect': {
      title: 'Nu s-a putut conecta (-7)',
      meaning: 'Conexiunea TCP la gazdă/proxy a eșuat.',
      cause: 'Server picat, port greșit sau un firewall.',
      fix: 'Verificați disponibilitatea endpoint-ului/portului.',
    },
    'http-timeout': {
      title: 'Cererea HTTP a expirat (-28)',
      meaning: 'Cererea a depășit timpul limită.',
      cause: 'Un server lent sau inaccesibil sau un timp limită prea mic.',
      fix: 'Măriți timpul limită; reîncercați; verificați serverul.',
    },
    'http-ssl-peer': {
      title: 'Verificarea partenerului SSL a eșuat (-51)',
      meaning: 'Certificatul TLS al serverului nu a fost validat.',
      cause: 'Un certificat expirat, autosemnat sau nepotrivit.',
      fix: 'Reparați lanțul de certificate; dezactivați EnablePeerVerification(false) doar pentru testare.',
    },
    'http-ca-cert': {
      title: 'Fișierul de certificat CA este greșit/lipsă (-77)',
      meaning: 'Pachetul CA nu a putut fi încărcat.',
      cause: 'O cale SetCertificatesFile lipsă sau incorectă.',
      fix: 'Setați `common:/certs/ca-bundle.crt` și apelați InitClientCertificates().',
    },
    'deploy-update-check-required': {
      title: 'Dispozitivul trebuie să verifice actualizările',
      meaning: 'Dispozitivul refuză conexiunile până când verifică o actualizare de sistem.',
      cause: 'Verificare de actualizare de firmware Roku în așteptare.',
      fix: 'Pe dispozitiv: Settings → System → System update → Check now.',
    },
    'deploy-unauthorized': {
      title: 'Neautorizat (parolă de dezvoltator greșită)',
      meaning: 'Serverul de dezvoltare a respins acreditările.',
      cause: 'O parolă de dezvoltator greșită sau modul dezvoltator este dezactivat.',
      fix: 'Setați parola corectă; activați modul dezvoltator pe dispozitiv.',
    },
    'deploy-connection-reset': {
      title: 'Conexiune resetată în timpul implementării',
      meaning: 'Dispozitivul a întrerupt socketul în timpul implementării.',
      cause: 'Dispozitivul este ocupat sau necesită o actualizare, sau o întrerupere de rețea.',
      fix: 'Reîncercați; verificați actualizările; verificați rețeaua.',
    },
    'stop-statement': {
      title: 'Instrucțiune STOP întâlnită',
      meaning: 'Execuția s-a oprit deoarece o instrucțiune `stop` a introdus aplicația în Micro Debugger.',
      cause: 'O instrucțiune de depanare `stop` rămasă în cod.',
      fix: 'Eliminați `stop` înainte de lansare; folosiți `continue`/`step` pentru a relua.',
    },
    'cant-continue': {
      title: 'Nu se poate continua',
      meaning: 'Depanatorul nu poate relua — firul de execuție a murit la o eroare fatală.',
      cause: 'O eroare de execuție irecuperabilă sau firul de execuție a ieșit.',
      fix: 'Reporniți canalul și corectați linia care blochează (vedeți urma stivei de mai sus).',
    },
    'console-in-use': {
      title: 'Conexiunea la consolă este deja în uz',
      meaning: 'Portul de depanare telnet (8085) este deja ocupat de un alt client.',
      cause: 'O a doua sesiune de depanator/telnet este deschisă către dispozitiv.',
      fix: 'Închideți celelalte sesiuni telnet/VS Code către dispozitiv.',
    },
    'app-crash-exit': {
      title: 'Canalul a ieșit în urma unei blocări BrightScript',
      meaning: 'Procesul canalului s-a terminat deoarece un fir BrightScript s-a blocat (o eroare de execuție neprinsă).',
      cause: 'O eroare de execuție neprinsă pe un fir fără handler.',
      fix: 'Vedeți blocarea + urma stivei în Monitor consolă; protejați apelul defectuos cu try/catch sau corectați linia defectuoasă.',
    },
  },

  // Distinct catalog category values (BrsErrorCategory). Keys match the English category
  // string verbatim; values are a natural short Romanian label.
  errorCategories: {
    'Type/Runtime': 'Tip/Execuție',
    'SceneGraph/Component': 'SceneGraph/Componentă',
    'Threading/Rendezvous': 'Fire de execuție/Rendezvous',
    'JSON': 'JSON',
    'Memory': 'Memorie',
    'Syntax/Compile': 'Sintaxă/Compilare',
    'Network/HTTP': 'Rețea/HTTP',
    'Deploy': 'Implementare',
    'Debugger': 'Depanator',
    'Other': 'Altele',
  },
};
