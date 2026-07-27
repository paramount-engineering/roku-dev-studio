/**
 * Polish (pl) translation of the Console log surface strings (find/filter
 * bar, JSON/XML/URL viewer modals, Console Monitor, and fold controls). Sibling
 * of ../console-log.ts — same `consoleLog` shape, keys, order, and function
 * signatures.
 *
 * Parametrized strings are functions returning the composed text. Only literal
 * display text is translated; format tokens and code literals stay verbatim.
 * Count-based functions apply Polish (Slavic) 3-form plural logic.
 */
export const consoleLog = {
  // ── Shared viewer modal chrome (console-modal-title.ts, structured + URL modals) ──────
  /** Default title prefix for the JSON/XML/URL viewer modals ("Console: JSON"). */
  titlePrefix: 'Konsola',
  jsonLabel: 'JSON',
  xmlLabel: 'XML',
  jsonPlusLabel: 'JSON+',
  urlLabel: 'URL',
  /** Transient button feedback after copying (plain text, no glyph — distinct from common.copied). */
  copied: 'Skopiowano',

  // ── Fold twisty (console-structured-syntax.ts) ────────────────────────────────────────
  collapse: 'Zwiń',
  expand: 'Rozwiń',

  // ── Structured JSON/XML viewer modal (console-structured-view-modal.ts) ───────────────
  copyFormattedTitle: 'Kopiuj sformatowany tekst',
  hintJsonFullNested: 'Kliknij, aby wyświetlić pełny JSON dla tego wiersza. Używaj JSON+ tylko dla zagnieżdżonych fragmentów.',
  hintJsonFormatted: 'Kliknij, aby wyświetlić sformatowany JSON (otwiera się w oknie modalnym)',
  hintXmlFull: 'Kliknij, aby wyświetlić pełny XML dla tego wiersza.',
  hintXmlFormatted: 'Kliknij, aby wyświetlić sformatowany XML (otwiera się w oknie modalnym)',
  hintPillNestedJson: 'Tylko zagnieżdżony JSON (z ciągu ze znakami ucieczki). Nie otwiera pełnego zewnętrznego JSON.',
  hintPillFullJson: 'Pełny JSON dla tego wiersza (kliknij tekst wiersza, aby uzyskać to samo).',

  // ── URL viewer modal (console-url-modal.ts) ───────────────────────────────────────────
  openInBrowser: 'Otwórz w przeglądarce',
  openInBrowserTitle: 'Otwórz w domyślnej przeglądarce',
  copyUrlTitle: 'Kopiuj URL',
  fullUrlAria: 'Pełny URL',
  queryParamsAria: 'Parametry zapytania',
  colKey: 'Klucz',
  colValue: 'Wartość',
  couldNotParseParams: 'Nie można przeanalizować parametrów.',
  noQueryParams: 'Brak parametrów zapytania.',
  parameterSet: (n: number): string => `Zestaw parametrów ${n}`,

  // ── Inline URL span (console-url-detect.ts) ───────────────────────────────────────────
  urlSpanTitle: 'Kliknij, aby wyświetlić podgląd w oknie modalnym · ⌘ lub Ctrl+kliknięcie, aby otworzyć w przeglądarce',

  // ── Find/filter bar markup (console-find-bar-markup.ts) ───────────────────────────────
  modeSelectAria: 'Tryb znajdowania lub filtrowania',
  modeFind: 'Znajdź',
  modeFilter: 'Filtruj',
  queryPlaceholder: 'Znajdź...',
  queryAria: 'Zapytanie znajdowania lub filtrowania',
  // Option-button tooltips: `alt` appends the (Alt+…) shortcut hint the main window binds.
  // The aria-label reuses the same text with `alt=false` (no shortcut suffix).
  optMatchCaseTitle: (alt: boolean): string => `Uwzględnij wielkość liter${alt ? ' (Alt+C)' : ''}`,
  optWholeWordTitle: (alt: boolean): string => `Całe słowo${alt ? ' (Alt+W)' : ''}`,
  optRegexTitle: (alt: boolean): string => `Użyj wyrażenia regularnego${alt ? ' (Alt+R)' : ''}`,
  prevTitle: 'Poprzednie (Shift+Enter)',
  prevAria: 'Poprzednie dopasowanie',
  nextTitle: 'Następne (Enter)',
  nextAria: 'Następne dopasowanie',
  clearAria: 'Wyczyść znajdowanie',

  // ── Find/filter bar runtime (console-find-bar.ts) ─────────────────────────────────────
  regexSuggestTitle: 'To wygląda jak wyrażenie regularne — kliknij, aby wyszukać za pomocą regex',
  searchingPct: (pct: number): string => `Wyszukiwanie... ${pct}%`,
  noResults: 'Brak wyników',
  matchPosition: (current: number, total: number): string => `${current} z ${total}`,
  firstMatchesNote: ' (Pierwsze dopasowania)',
  highlightsCappedNote: ' (Podświetlenia ograniczone)',
  searchingSuffix: (pct: number): string => ` (wyszukiwanie ${pct}%)`,
  searchingRemote: 'Wyszukiwanie…',
  filteringRemote: 'Filtrowanie…',
  searchFailed: 'Wyszukiwanie nie powiodło się',
  filterFailed: 'Filtrowanie nie powiodło się',
  linesMatched: (n: number, capped: boolean): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      n === 1
        ? 'wiersz'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'wiersze'
          : 'wierszy';
    return `${n.toLocaleString()} ${word}${capped ? ' (ograniczono)' : ''}`;
  },

  // ── Console Monitor / analytics modal (console-analytics-modal.ts) ────────────────────
  monitorTitle: 'Monitor konsoli',
  noRecognizedIssues: 'Brak rozpoznanych problemów BrightScript. 🎉',
  sectionCrashes: 'Awarie',
  sectionIssues: 'Problemy',
  labelWhat: 'Co',
  labelCause: 'Przyczyna',
  labelFix: 'Rozwiązanie',
  docsLink: 'dokumentacja ↗',
  copyMessageTitle: 'Kopiuj wiadomość',
  copyMessageAria: 'Kopiuj komunikat o błędzie',
  goToLineTitle: 'Przejdź do tego wiersza w dzienniku',
  goToCrashTitle: 'Przejdź do tej awarii w dzienniku',
  copyCrashTitle: 'Kopiuj awarię + ślad stosu',
  copyCrashAria: 'Kopiuj awarię i ślad stosu',
  backtraceHead: 'Ślad stosu',
  noBacktrace:
    'Kanał zakończył działanie z powodu awarii BrightScript; w tym wyniku konsoli nie przechwycono śladu stosu.',
  crashKindLabel: 'Awaria',
  // Crash severity badge (rendered uppercase via CSS; kept lowercase to mirror the data-driven
  // severity tokens on the non-crash issue badges).
  severityCrash: 'awaria',
  // Crash card annotations: "exited" badge and inline "runtime error <code>" (both lowercase; the
  // badge is uppercased by CSS, the code annotation reads inline).
  exitedLabel: 'zakończono',
  exitedTitle: 'Proces kanału zakończył działanie',
  runtimeErrorLabel: 'błąd wykonania',
  crashCount: (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      n === 1
        ? 'awaria'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'awarie'
          : 'awarii';
    return `${n.toLocaleString()} ${word}`;
  },
  issuesAcrossLines: (issues: number, lines: number): string => {
    const iMod10 = issues % 10;
    const iMod100 = issues % 100;
    const issueWord =
      issues === 1
        ? 'problem'
        : iMod10 >= 2 && iMod10 <= 4 && (iMod100 < 12 || iMod100 > 14)
          ? 'problemy'
          : 'problemów';
    const lMod100 = lines % 100;
    const lineWord = lines % 10 === 1 && lMod100 !== 11 ? 'wierszu' : 'wierszach';
    return `${issues.toLocaleString()} ${issueWord} w ${lines.toLocaleString()} ${lineWord}`;
  },
  spillNote: (total: number): string =>
    `(z ${total.toLocaleString()} przechwyconych — starsze wiersze wysłane na dysk nie są skanowane)`,
  occurrences: (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    return n === 1
      ? 'Wystąpienie'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'Wystąpienia'
        : 'Wystąpień';
  },
  moreUniqueLines: (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const phrase =
      n === 1
        ? 'unikalny wiersz'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'unikalne wiersze'
          : 'unikalnych wierszy';
    return `+${n.toLocaleString()} ${phrase}`;
  },

  // ── BrightScript error catalog (brightscript-error-catalog.ts) ────────────────────────
  // Localizable copy for each catalog entry, keyed by the entry `id`. Prose translated to
  // Polish; BrightScript/Roku technical tokens, code literals, and message signatures are
  // kept verbatim.
  errors: {
    'type-mismatch': {
      title: 'Niezgodność typów',
      meaning: 'Operator został zastosowany do wartości o niezgodnych typach.',
      cause: 'Porównywanie lub łączenie niezgodnych typów (np. String vs Integer) albo niezainicjowana zmienna traktowana jako niewłaściwy typ.',
      fix: 'Przekonwertuj za pomocą Str()/Val()/ToStr(), aby oba operandy miały wspólny typ. Roku OS 10.5+ podaje w komunikacie operator i oba typy.',
    },
    'dot-on-invalid': {
      title: 'Operator „kropki” na obiekcie invalid',
      meaning: 'Użyto `.` do odczytu składowej/pola wartości, która jest invalid lub nie jest komponentem/interfejsem.',
      cause: 'Obiekt nigdy nie został utworzony lub wyszukiwanie zwróciło invalid — np. `m.top.findNode("x").text`, gdzie findNode zwróciło invalid.',
      fix: 'Sprawdź wartość null przed użyciem kropki (`if node <> invalid`); potwierdź, że obiekt istnieje i nazwa składowej jest poprawna.',
    },
    'for-each-non-enumerable': {
      title: 'FOR EACH na wartości nieiterowalnej',
      meaning: '`for each` wykonano na wartości, która jest invalid lub nie jest obiektem iterowalnym.',
      cause: 'Iterowanie po wyniku funkcji, która zwróciła invalid (brakujący klucz AA, puste GetChildElements()/GetBody()), albo po wartości skalarnej/węźle.',
      fix: 'Sprawdź wartość null/typ przed pętlą; iteruj tylko po roArray, roList, roAssociativeArray lub roMessagePort (typy z ifEnum).',
    },
    'call-on-non-function': {
      title: 'Operator wywołania ( ) na wartości niebędącej funkcją',
      meaning: 'Kod próbował wywołać `()` na wartości, która nie jest funkcją.',
      cause: 'Zmienna przesłoniła funkcję, nazwa jest błędnie zapisana/niezadeklarowana albo wartość jest invalid/danymi zamiast funkcją.',
      fix: 'Sprawdź, czy identyfikator jest zdefiniowaną funkcją; sprawdź kolizje nazw i wartości invalid przed wywołaniem.',
    },
    'uninitialized-variable': {
      title: 'Użycie niezainicjowanej zmiennej',
      meaning: 'Zmienna została odczytana, zanim przypisano jej jakąkolwiek wartość.',
      cause: 'Błędnie zapisana nazwa zmiennej, zmienna zadeklarowana tylko w innym zakresie albo ścieżka warunkowa, która pominęła przypisanie.',
      fix: 'Zainicjuj przed użyciem; sprawdź pisownię i zakres; debugger pokazuje takie zmienne lokalne jako `<uninitialized>`.',
    },
    'uninitialized-function-ref': {
      title: 'Niezainicjowane odwołanie do funkcji',
      meaning: 'Wywołanie przez zmienną funkcyjną, która nie przechowuje żadnej funkcji.',
      cause: 'Wskaźnik funkcji nigdy nie został przypisany lub został ustawiony na invalid.',
      fix: 'Przypisz prawidłowe odwołanie do funkcji przed jej wywołaniem.',
    },
    'invalid-left-side': {
      title: 'Nieprawidłowa lewa strona wyrażenia',
      meaning: 'Cel przypisania nie jest czymś, do czego można przypisać wartość.',
      cause: 'Przypisywanie do literału lub wyrażenia zamiast do zmiennej lub pola obiektu.',
      fix: 'Przypisuj tylko do zmiennej lub pola obiektu.',
    },
    'divide-by-zero': {
      title: 'Dzielenie przez zero',
      meaning: 'Operacja dzielenia lub MOD użyła zerowego mianownika w czasie wykonania.',
      cause: 'Zmienna dzielnika przyjęła wartość 0 (lub invalid, skonwertowaną na 0).',
      fix: 'Zabezpiecz mianowniki przed dzieleniem (`if d <> 0`).',
    },
    'array-out-of-bounds': {
      title: 'Indeks tablicy poza zakresem',
      meaning: 'Odczyt lub zapis poza końcem tablicy (lub ujemny indeks do tablicy).',
      cause: 'Błąd o jeden w granicach pętli; indeksowanie pustej lub krótszej tablicy.',
      fix: 'Sprawdź `arr.count()` przed indeksowaniem; zweryfikuj granice pętli.',
    },
    'array-not-dimd': {
      title: 'Operacja tablicowa na zmiennej bez DIM',
      meaning: 'Zindeksowano zmienną, która nigdy nie została utworzona jako tablica.',
      cause: 'Użycie `[]` na wartości skalarnej lub na invalid.',
      fix: 'Zainicjuj tablicę (`arr = []`) przed jej indeksowaniem.',
    },
    'non-numeric-array-index': {
      title: 'Nienumeryczny indeks tablicy',
      meaning: 'Użyto ciągu/obiektu jako indeksu do roArray.',
      cause: 'Mylenie roArray z roAssociativeArray.',
      fix: 'Użyj AA dla kluczy tekstowych lub indeksu numerycznego dla tablic.',
    },
    'invalid-num-array-indexes': {
      title: 'Nieprawidłowa liczba indeksów tablicy',
      meaning: 'Użyto niewłaściwej wymiarowości do indeksowania tablicy.',
      cause: 'Użycie `a[i,j]` na tablicy 1-wymiarowej (lub odwrotnie).',
      fix: 'Dopasuj liczbę indeksów do zadeklarowanych wymiarów tablicy.',
    },
    'wrong-num-params': {
      title: 'Nieprawidłowa liczba parametrów funkcji',
      meaning: 'Funkcja została wywołana ze zbyt małą lub zbyt dużą liczbą argumentów.',
      cause: 'Zmieniona sygnatura lub parametr opcjonalny bez wartości domyślnej.',
      fix: 'Dopasuj wywołanie do sygnatury; nadaj parametrom opcjonalnym wartości domyślne.',
    },
    'bad-throw': {
      title: 'Nieprawidłowy argument throw',
      meaning: 'Do `throw` przekazano coś innego niż ciąg lub prawidłowe AA błędu.',
      cause: 'Rzucenie liczby/obiektu bez prawidłowych pól `number`/`message`.',
      fix: 'Rzuć ciąg albo AA z polami `number` typu Integer i `message` typu String.',
    },
    'user-thrown-exception': {
      title: 'Nieprzechwycony wyjątek użytkownika (THROW)',
      meaning: '`throw` rozpropagował się do samej góry bez przechwycenia, kończąc skrypt.',
      cause: '`throw "…"` (lub `throw {message: …}`) bez otaczającego `try/catch` do jego obsługi.',
      fix: 'Otocz wywołanie rzucające `try/catch` (Roku OS 9.4+) i sprawdź `e.number`/`e.message`/`e.backtrace`.',
    },
    'invalid-format-specifier': {
      title: 'Nieprawidłowy specyfikator formatu',
      meaning: 'Do funkcji formatującej przekazano nieprawidłowy specyfikator.',
      cause: 'Nieprawidłowo sformułowany token Format()/w stylu printf.',
      fix: 'Popraw ciąg formatu.',
    },
    'invalid-param': {
      title: 'Nieprawidłowy parametr przekazany do funkcji/tablicy',
      meaning: 'Wbudowana funkcja otrzymała argument spoza dziedziny (np. sqrt z liczby ujemnej, ujemny wymiar).',
      cause: 'Nieprawidłowa dziedzina matematyczna lub ujemny wymiar tablicy.',
      fix: 'Zweryfikuj argumenty przed wywołaniem.',
    },
    'member-fn-not-found': {
      title: 'Nie znaleziono funkcji składowej',
      meaning: 'Wywołano metodę, której komponent lub interfejs nie udostępnia.',
      cause: 'Błędnie zapisana nazwa metody, wywołanie na invalid, niewłaściwy typ komponentu albo metoda niedostępna w tej wersji oprogramowania układowego.',
      fix: 'Potwierdź, że metoda istnieje dla tego obiektu/OS; zabezpiecz obiekty invalid przed wywołaniem.',
    },
    'interface-not-member': {
      title: 'Interfejs nie jest składową komponentu',
      meaning: 'Zażądano interfejsu, którego komponent nie implementuje.',
      cause: 'Wywołanie GetInterface() dla interfejsu, którego obiekt nie posiada, albo nieprawidłowa nazwa interfejsu.',
      fix: 'Użyj interfejsu, który komponent rzeczywiście udostępnia.',
    },
    'component-class-not-found': {
      title: 'Nie znaleziono klasy komponentu / węzła',
      meaning: 'CreateObject / createChild użyło nieistniejącej klasy lub typu węzła.',
      cause: 'Błędnie zapisany ciąg typu lub o niewłaściwej wielkości liter albo komponent niezadeklarowany/niezarejestrowany w pakiecie.',
      fix: 'Popraw ciąg typu (rozróżnia wielkość liter); upewnij się, że plik XML komponentu jest dołączony do kanału.',
    },
    'sg-field-type-mismatch': {
      title: 'Niezgodność typu pola SceneGraph',
      meaning: 'Wartość przypisana do pola węzła nie odpowiadała zadeklarowanemu typowi pola.',
      cause: 'Przypisanie np. String do pola int/uri albo Array do pola assocarray za pomocą setField/addReplace.',
      fix: 'Przypisz wartość zgodną z zadeklarowanym typem interfejsu pola albo popraw typ pola w pliku XML komponentu.',
    },
    'sg-nonexistent-field': {
      title: 'Ustawienie nieistniejącego pola SceneGraph',
      meaning: 'Przypisano do pola węzła, którego typ węzła nie deklaruje (ciche zignorowanie).',
      cause: 'Błędnie zapisana nazwa pola albo pole niezdefiniowane w `<interface>` pliku XML komponentu.',
      fix: 'Użyj zadeklarowanej nazwy pola (rozróżnia wielkość liter) albo dodaj pole do interfejsu w pliku XML komponentu.',
    },
    'component-call-arg-count': {
      title: 'Wywołanie komponentu ma nieprawidłową liczbę parametrów',
      meaning: 'Wbudowana metoda komponentu została wywołana z nieprawidłową liczbą argumentów.',
      cause: 'Liczba argumentów niezgodna z sygnaturą metody ifXXX.',
      fix: 'Dopasuj do udokumentowanej sygnatury metody.',
    },
    'rendezvous-aborted': {
      title: 'Przerwano rendezvous',
      meaning: 'Międzywątkowy dostęp do węzła nie powiódł się, ponieważ docelowy węzeł był invalid lub zniknął.',
      cause: 'Dostęp do węzła należącego do innego wątku, który został zniszczony lub zawieszony (np. globalny węzeł utracony po długim odtwarzaniu).',
      fix: 'Unikaj międzywątkowego przetwarzania węzłów; sprawdzaj wartość null przed dostępem; profiluj za pomocą `logrendezvous` / `sgperf`.',
    },
    'rendezvous-block': {
      title: 'SceneGraph rendezvous (blokowanie wątku)',
      meaning: 'Punkt synchronizacji wątku renderowania ↔ wątku zadania; częste blokują wątek renderowania.',
      cause: 'Wątek Task odczytujący/zapisujący pola węzła wątku renderowania pojedynczo.',
      fix: 'Grupuj dostęp do pól za pomocą getFields/setFields; ograniczaj międzywątkowy dostęp do węzłów.',
    },
    'execution-timeout': {
      title: 'Przekroczenie czasu wykonania (skrypt działał zbyt długo)',
      meaning: 'Kod działał zbyt długo w wątku (wątek renderowania ma limit kilku sekund).',
      cause: 'Ciężkie pętle, parsowanie dużego JSON lub synchroniczne operacje we/wy w wątku renderowania lub wątku Task.',
      fix: 'Przenieś ciężką pracę do węzła Task; podziel pracę na fragmenty lub wykonuj ją asynchronicznie.',
    },
    'too-many-task-threads': {
      title: 'Zbyt wiele wątków zadań',
      meaning: 'Przekroczono limit równoczesnych wątków Task.',
      cause: 'Tworzenie węzłów Task w pętli bez ponownego użycia lub czyszczenia.',
      fix: 'Wykorzystuj ponownie/buforuj węzły Task; ograniczaj współbieżność; pozwól zadaniom się zakończyć.',
    },
    'wait-on-non-port': {
      title: 'Oczekiwanie na obiekt bez portu wiadomości',
      meaning: '`wait()` zostało wywołane na obiekcie, który nie posiada ifMessagePort.',
      cause: 'Oczekiwanie na niewłaściwy obiekt zamiast na roMessagePort.',
      fix: 'Oczekuj tylko na roMessagePort.',
    },
    'formatjson-nested': {
      title: 'FormatJSON zagnieżdżone/cykliczne odwołanie',
      meaning: 'FormatJSON nie powiodło się z powodu odwołania cyklicznego lub zagnieżdżenia głębszego niż 256 poziomów.',
      cause: 'Cykliczny graf obiektów lub nieobsługiwany typ wartości (np. roList) w drzewie.',
      fix: 'Zlikwiduj cykle odwołań; utrzymuj zagnieżdżenie poniżej 256; serializuj tylko obsługiwane typy (AA, array, string, number, boolean).',
    },
    'parsejson-failed': {
      title: 'ParseJSON nie powiodło się',
      meaning: 'ParseJSON nie mogło przeanalizować ciągu wejściowego (zwraca invalid).',
      cause: 'Puste wejście/białe znaki (np. puste ciało odpowiedzi HTTP), nieprawidłowy JSON lub argument niebędący ciągiem.',
      fix: 'Zabezpiecz się przed pustym/nieprawidłowym wejściem przed ParseJSON; zweryfikuj źródło (najpierw sprawdź ciało/długość HTTP).',
    },
    'file-write-failed': {
      title: 'Zapis pliku nie powiódł się',
      meaning: 'Nie można było otworzyć pliku do zapisu (WriteAsciiFile / roCreateFile).',
      cause: 'Zapis poza lokalizacją zapisywalną — tylko `tmp:/` i `cachefs:/` są zapisywalne (`pkg:/` jest tylko do odczytu) — albo brakujący katalog / pełny dysk.',
      fix: 'Zapisuj tylko do `tmp:/` lub `cachefs:/`; upewnij się, że ścieżka nadrzędna istnieje.',
    },
    'stack-overflow': {
      title: 'Przepełnienie stosu',
      meaning: 'Stos wywołań został wyczerpany.',
      cause: 'Nieograniczona lub bardzo głęboka rekurencja (Roku przepełnia się po ok. 31 zagnieżdżonych wywołaniach).',
      fix: 'Dodaj przypadek bazowy; zamień głęboką rekurencję na iterację.',
    },
    'out-of-memory': {
      title: 'Brak pamięci',
      meaning: 'Alokacja pamięci nie powiodła się; sterta jest wyczerpana.',
      cause: 'Duże struktury danych, wycieki lub zatrzymane węzły/tekstury; ogromne budowanie ciągów w pętli.',
      fix: 'Zwalniaj odwołania, zmniejsz rozmiar danych, wykorzystuj ponownie węzły; strumieniuj/dziel na fragmenty dużą pracę na ciągach.',
    },
    'string-too-long': {
      title: 'Ciąg zbyt długi',
      meaning: 'Ciąg przekroczył maksymalną długość.',
      cause: 'Łączenie nieograniczonego wejścia.',
      fix: 'Ogranicz lub podziel długość ciągu.',
    },
    'syntax-error': {
      title: 'Błąd składni',
      meaning: 'Kod źródłowy nie skompilował się.',
      cause: 'Literówki, niezrównoważone bloki lub nieprawidłowe tokeny.',
      fix: 'Popraw składnię w zgłoszonym wierszu/kolumnie; skompiluj lokalnie przed sideloadingiem.',
    },
    'compile-error-generic': {
      title: 'Błąd kompilacji',
      meaning: 'Kompilator odrzucił jeden lub więcej wierszy przed uruchomieniem aplikacji.',
      cause: 'Literówka, brakujące słowo kluczowe lub nieprawidłowe wyrażenie.',
      fix: 'Popraw każdy zgłoszony `line N:` we wskazanym pliku.',
    },
    'unterminated-block': {
      title: 'Niezakończony blok',
      meaning: 'Blokowi sterującemu (FOR/NEXT, IF/ENDIF, WHILE/ENDWHILE) brakuje słowa kluczowego zamykającego.',
      cause: 'Brakujące lub niedopasowane `end if` / `next` / `end while`.',
      fix: 'Zrównoważ każde słowo kluczowe otwierające blok z pasującym zamknięciem.',
    },
    'xml-parse-error': {
      title: 'Błąd analizy komponentu XML',
      meaning: 'Plik komponentu XML SceneGraph nie sparsował się lub ma wadę.',
      cause: 'Nieprawidłowy znacznik, zły tag albo złe odwołanie do pola/interfejsu/skryptu w komponencie.',
      fix: 'Zweryfikuj znaczniki .xml i popraw definicję komponentu.',
    },
    'no-manifest': {
      title: 'Brak manifestu — nieprawidłowy pakiet',
      meaning: 'Załadowany plik zip nie zawiera prawidłowego manifestu.',
      cause: 'Manifest jest brakujący lub nie znajduje się w katalogu głównym archiwum.',
      fix: 'Umieść prawidłowy plik `manifest` w katalogu głównym pliku zip.',
    },
    'unused-variable': {
      title: 'Nieużywana zmienna',
      meaning: 'Zadeklarowana zmienna — często parametr funkcji lub procedury obsługi zdarzeń — nigdy nie jest używana.',
      cause: 'Parametr procedury obsługi (`msg`/`event`/`field`) lub zmienna lokalna, do której ciało funkcji nigdy się nie odwołuje.',
      fix: 'Usuń ją, jeśli faktycznie jest nieużywana; jej pozostawienie jest nieszkodliwe. Wymagane parametry sygnatury wywołania zwrotnego można pozostawić bez zmian.',
    },
    'brightscript-warning': {
      title: 'Ostrzeżenie BrightScript',
      meaning: 'Kompilator BrightScript wyemitował ostrzeżenie niekrytyczne.',
      cause: 'Problem na poziomie lintera (nieużywany kod, przestarzały wzorzec), który nie zatrzymuje wykonania.',
      fix: 'Przejrzyj wskazaną funkcję/plik — ostrzeżenia można bezpiecznie uruchamiać, ale często wskazują martwy kod lub błędy.',
    },
    'http-unsupported-protocol': {
      title: 'Nieobsługiwany protokół (-1)',
      meaning: 'Schemat URL nie jest obsługiwany przez transfer.',
      cause: 'Nieprawidłowy URL lub zły schemat.',
      fix: 'Użyj obsługiwanego adresu URL http(s)://.',
    },
    'http-resolve-host': {
      title: 'Nie można rozpoznać hosta (-6)',
      meaning: 'Rozpoznawanie DNS hosta żądania nie powiodło się.',
      cause: 'Nieprawidłowa nazwa hosta, brak sieci lub awaria DNS.',
      fix: 'Zweryfikuj URL/host i łączność sieciową.',
    },
    'http-connect': {
      title: 'Nie można połączyć (-7)',
      meaning: 'Połączenie TCP z hostem/proxy nie powiodło się.',
      cause: 'Serwer wyłączony, zły port lub zapora sieciowa.',
      fix: 'Sprawdź dostępność punktu końcowego/portu.',
    },
    'http-timeout': {
      title: 'Przekroczono limit czasu żądania HTTP (-28)',
      meaning: 'Żądanie przekroczyło swój limit czasu.',
      cause: 'Wolny lub nieosiągalny serwer albo zbyt mały limit czasu.',
      fix: 'Zwiększ limit czasu; ponów próbę; sprawdź serwer.',
    },
    'http-ssl-peer': {
      title: 'Weryfikacja peera SSL nie powiodła się (-51)',
      meaning: 'Certyfikat TLS serwera nie przeszedł walidacji.',
      cause: 'Wygasły, samopodpisany lub niezgodny certyfikat.',
      fix: 'Popraw łańcuch certyfikatów; wyłączaj EnablePeerVerification(false) tylko do testów.',
    },
    'http-ca-cert': {
      title: 'Plik certyfikatu CA nieprawidłowy/brakujący (-77)',
      meaning: 'Nie można było załadować pakietu CA.',
      cause: 'Brakująca lub nieprawidłowa ścieżka SetCertificatesFile.',
      fix: 'Ustaw `common:/certs/ca-bundle.crt` i wywołaj InitClientCertificates().',
    },
    'deploy-update-check-required': {
      title: 'Urządzenie musi sprawdzić dostępność aktualizacji',
      meaning: 'Urządzenie odrzuca połączenia, dopóki nie sprawdzi aktualizacji systemu.',
      cause: 'Oczekujące sprawdzenie aktualizacji oprogramowania układowego Roku.',
      fix: 'Na urządzeniu: Settings → System → System update → Check now.',
    },
    'deploy-unauthorized': {
      title: 'Brak autoryzacji (nieprawidłowe hasło deweloperskie)',
      meaning: 'Serwer deweloperski odrzucił poświadczenia.',
      cause: 'Nieprawidłowe hasło dewelopera albo wyłączony tryb dewelopera.',
      fix: 'Ustaw prawidłowe hasło; włącz tryb dewelopera na urządzeniu.',
    },
    'deploy-connection-reset': {
      title: 'Zresetowano połączenie podczas wdrażania',
      meaning: 'Urządzenie porzuciło gniazdo w trakcie wdrażania.',
      cause: 'Urządzenie jest zajęte lub wymaga aktualizacji albo nastąpiło zerwanie sieci.',
      fix: 'Ponów próbę; sprawdź aktualizacje; zweryfikuj sieć.',
    },
    'stop-statement': {
      title: 'Napotkano instrukcję STOP',
      meaning: 'Wykonanie wstrzymano, ponieważ instrukcja `stop` przełączyła aplikację do Micro Debuggera.',
      cause: 'Pozostawiona instrukcja debugowania `stop` w kodzie.',
      fix: 'Usuń `stop` przed wydaniem; użyj `continue`/`step`, aby wznowić.',
    },
    'cant-continue': {
      title: 'Nie można kontynuować',
      meaning: 'Debugger nie może wznowić — wątek zakończył się na błędzie krytycznym.',
      cause: 'Nieodwracalny błąd wykonania lub wątek zakończył działanie.',
      fix: 'Uruchom ponownie kanał i popraw wiersz powodujący awarię (zobacz ślad stosu powyżej).',
    },
    'console-in-use': {
      title: 'Połączenie konsoli jest już używane',
      meaning: 'Port debugowania telnet (8085) jest już zajęty przez innego klienta.',
      cause: 'Do urządzenia otwarta jest druga sesja debuggera/telnet.',
      fix: 'Zamknij inne sesje telnet/VS Code z urządzeniem.',
    },
    'app-crash-exit': {
      title: 'Kanał zakończył działanie z powodu awarii BrightScript',
      meaning: 'Proces kanału zakończył działanie, ponieważ wątek BrightScript uległ awarii (nieprzechwycony błąd wykonania).',
      cause: 'Nieprzechwycony błąd wykonania w wątku bez procedury obsługi.',
      fix: 'Zobacz awarię + ślad stosu w Monitorze konsoli; zabezpiecz wadliwe wywołanie za pomocą try/catch lub popraw wadliwy wiersz.',
    },
  },

  // Distinct catalog category values (BrsErrorCategory). Short natural Polish labels.
  errorCategories: {
    'Type/Runtime': 'Typ/Wykonanie',
    'SceneGraph/Component': 'SceneGraph/Komponent',
    'Threading/Rendezvous': 'Wątki/Rendezvous',
    'JSON': 'JSON',
    'Memory': 'Pamięć',
    'Syntax/Compile': 'Składnia/Kompilacja',
    'Network/HTTP': 'Sieć/HTTP',
    'Deploy': 'Wdrażanie',
    'Debugger': 'Debugger',
    'Other': 'Inne',
  },
};
