/**
 * Polish (pl) translation of the SceneGraph / node Inspector strings
 * (App Connector / RALE tab). Sibling of ../inspector.ts — same `inspector`
 * shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. Only literal
 * display text is translated; protocol identifiers, type names, code literals,
 * and example values are kept verbatim. Count-based functions apply Polish
 * (Slavic) 3-form plural logic.
 */
export const inspector = {
  // Reused generic status / errors (Inspector-scoped variants)
  notConnected: 'Nie połączono',
  commandFailed: 'Polecenie nie powiodło się',
  noResponseFromDevice: 'Brak odpowiedzi z urządzenia',

  // Connection flow (Connect/Disconnect, status line, Dev App preflight)
  connectingBtn: 'Łączenie...',
  connectionLost: 'Utracono połączenie',
  reconnecting: 'Ponowne łączenie...',
  connectingStatus: '🟡 Łączenie...',
  reconnectingStatus: '🟡 Ponowne łączenie...',
  connectedBang: 'Połączono!',
  checkingDevApp: 'Sprawdzanie, czy Dev App jest aktywna...',
  couldNotVerifyDevAppQuery:
    'Nie można zweryfikować stanu Dev App. Zapytanie o aktywną aplikację nie powiodło się (sieć / ECP / tryb dewelopera?).',
  couldNotVerifyDevApp: 'Nie można zweryfikować stanu Dev App.',
  checkConnectionHint: 'Sprawdź połączenie z urządzeniem i tryb dewelopera, a następnie spróbuj połączyć ponownie.',
  statusCheckFailed: 'Sprawdzenie stanu nie powiodło się',
  devAppNotRunning:
    'Dev App nie jest uruchomiona na urządzeniu Roku. Najpierw uruchom wgraną Dev App.',
  launchDevAppHint: 'Przejdź do karty Dev App i kliknij „Uruchom”, aby uruchomić swój wgrany kanał.',
  devAppNotActive: 'Dev App nieaktywna',
  wakingUpTrackerTask: (port: number): string => `Wybudzanie TrackerTask na porcie ${port}...`,
  failedToConnect: 'Nie udało się połączyć',
  failedToWakeTrackerTask: 'Nie udało się wybudzić TrackerTask',
  connectingToSocket: 'Łączenie z gniazdem...',
  connectingToSocketRetry: (attempt: number): string =>
    `Łączenie z gniazdem (próba ${attempt})...`,
  initializing: 'Inicjowanie...',
  connectionClosedByDevice: 'Połączenie zamknięte przez urządzenie',

  // Response card (index.ts)
  findInResponse: 'Znajdź w odpowiedzi',
  saveResponseTitle: 'Zapisz odpowiedź',
  failedAutoFetchFunctions: 'Nie udało się automatycznie pobrać funkcji. Kliknij Odśwież, aby spróbować ponownie.',
  refreshing: (command: string): string => `Odświeżanie ${command}…`,

  // Function selector / dropdown (function-selector.ts)
  connectToLoadFunctions: '-- Połącz, aby wczytać funkcje --',
  selectAFunction: '-- Wybierz funkcję --',
  selectFunctionForParamDetails: 'Wybierz funkcję, aby zobaczyć szczegóły parametrów',
  functionDetailsTitle: 'Szczegóły funkcji',
  openFunctionDetails: 'Pokaż szczegóły funkcji',
  noFunctionDetails: 'Brak dostępnych szczegółów dla tej funkcji.',
  appConnectorFunctions: 'Funkcje App Connector',
  raleFunctions: 'Funkcje RALE',
  noFunctionsImplement: 'Brak funkcji — zaimplementuj GetExternalControlFunctions',
  readyToExecute: 'Gotowe do wykonania',
  unknownFunctionName: 'nieznana',
  functionCounts: (appCount: number, raleCount: number): string => {
    const appMod10 = appCount % 10;
    const appMod100 = appCount % 100;
    const appWord =
      appCount === 1
        ? 'funkcja App'
        : appMod10 >= 2 && appMod10 <= 4 && (appMod100 < 12 || appMod100 > 14)
          ? 'funkcje App'
          : 'funkcji App';
    const raleMod10 = raleCount % 10;
    const raleMod100 = raleCount % 100;
    const raleWord =
      raleCount === 1
        ? 'polecenie RALE'
        : raleMod10 >= 2 && raleMod10 <= 4 && (raleMod100 < 12 || raleMod100 > 14)
          ? 'polecenia RALE'
          : 'poleceń RALE';
    return `${appCount} ${appWord}, ${raleCount} ${raleWord}`;
  },

  // Function execution (function-execution.ts)
  sending: (command: string): string => `Wysyłanie ${command}...`,
  executing: (selection: string): string => `Wykonywanie ${selection}...`,
  fetchingFunctions: 'Pobieranie dostępnych funkcji...',
  foundFunctions: (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      n === 1
        ? 'funkcję'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'funkcje'
          : 'funkcji';
    return `Znaleziono ${n} ${word}`;
  },
  noFunctionsReturned: 'Nie zwrócono żadnych funkcji',
  getExternalControlFunctionsReturnedFalse:
    'getExternalControlFunctions zwróciło false — upewnij się, że scena SceneGraph implementuje tę funkcję',
  failedToFetchFunctions: 'Nie udało się pobrać funkcji',
  selectFunctionToExecute: 'Wybierz funkcję do wykonania',
  functionExecutionFailed: 'Wykonanie funkcji nie powiodło się',
  unknownRaleBuiltin: 'Nieznane wbudowane polecenie RALE',
  unhandledRaleBuiltin: (command: string): string => `Nieobsługiwane wbudowane polecenie RALE: ${command}`,

  // RALE path parsing (node-lookup.ts)
  pathMustBeJsonArray: 'Ścieżka musi być tablicą JSON (np. [] lub [{"child":0}])',
  invalidPathJson: (detail: string): string => `Nieprawidłowy JSON ścieżki: ${detail}`,

  // Update Node modal (node-update-panel.ts)
  noNodeContext: 'Brak kontekstu węzła — najpierw wykonaj „Pobierz węzeł wg ID”.',
  fieldNameRequired: 'Nazwa pola jest wymagana.',
  selectNodeFailed: 'selectNode nie powiodło się',
  selectingNode: 'Wybieranie węzła…',
  removingField: 'Usuwanie pola…',
  addingField: 'Dodawanie pola…',
  updatingField: 'Aktualizowanie pola…',
  removedField: (name: string): string => `Usunięto pole "${name}".`,
  addedField: (name: string): string => `Dodano pole "${name}".`,
  updatedField: (name: string): string => `Zaktualizowano pole "${name}".`,
  removeFieldBtn: 'Usuń pole',
  addFieldBtn: 'Dodaj pole',
  updateFieldBtn: 'Aktualizuj pole',
  valueLabel: 'Wartość',
  newValueLabel: 'Nowa wartość',
  addValuePlaceholder:
    'Wartość początkowa dla nowego pola (skalary, true/false, JSON dla tablic / obiektu)',
  updateValuePlaceholder: 'Skalary, true/false, JSON dla tablic / wektorów / obiektów',

  // Update Node — value parse errors (parseValueForRaleFieldType)
  parseBoolean: 'boolean: użyj true lub false',
  parseInteger: 'integer: nieprawidłowa liczba',
  parseFloat: 'float: nieprawidłowa liczba',
  parseColor: 'color: użyj liczby całkowitej (np. -16777216)',
  parseVector2d: 'vector2d: co najmniej dwa elementy, np. [0,0]',
  parseRect2d: 'rect2d: cztery elementy, np. [0,0,100,100]',
  parseArray: 'array: nieprawidłowa tablica JSON',
  parseAssocArray: 'assocarray: wymagany obiekt JSON',
  jsonArrayRequired: (type: string): string => `${type}: wymagana tablica JSON`,
  invalidJsonArray: (type: string): string => `${type}: nieprawidłowa tablica JSON`,

  // Registry builtin param editors (registry-params-ui.ts)
  unexpectedRegistryResponse: 'Nieoczekiwana odpowiedź rejestru',
  loadingRegistry: 'Wczytywanie rejestru…',
  selectSection: '— Wybierz sekcję —',
  noSections: '(brak sekcji)',
  selectKey: '— Wybierz klucz —',
  noKeys: '(brak kluczy)',
  ariaSectionToRemove: 'Sekcja do usunięcia',
  ariaSection: 'Sekcja',
  ariaKey: 'Klucz',
  ariaKeyToReplace: 'Klucz do zastąpienia',
  removeSectionHint: 'Sekcje wczytane z urządzenia. Wykonanie usuwa wybraną sekcję.',
  fieldKeyPlaceholder: 'Klucz pola',
  stringValuePlaceholder: 'Wartość tekstowa',
  newKeyPlaceholder: 'Nowy klucz',
  newValuePlaceholder: 'Nowa wartość',

  // Registry client-side validation (registry-validation.ts)
  sectionNameRequired: 'Nazwa sekcji jest wymagana.',
  sectionMustBeJsonObject: 'Sekcja musi być obiektem JSON (nie tablicą).',
  sectionKeysNotEmpty: 'Klucze obiektu sekcji nie mogą być puste ani składać się wyłącznie z białych znaków.',
  eachValueMustBeString: (key: string): string =>
    `Każda wartość musi być ciągiem znaków (roRegistry przechowuje ciągi). Klucz "${key}" nie jest ciągiem — użyj ciągów w cudzysłowach w JSON.`,
  selectSectionFromList: 'Wybierz sekcję z listy.',
  selectKeyFromList: 'Wybierz klucz z listy.',
  enterFieldKey: 'Wprowadź klucz pola.',

  // Parameter inputs (parameter-inputs.ts)
  noParamsRequired: '✓ Nie są wymagane żadne parametry',
  selectFunctionForParams: 'Wybierz funkcję, aby zobaczyć parametry',
  booleanPlaceholder: 'true lub false',
  stringPlaceholder: 'Wprowadź tekst...',

  // Execute Function dropdown — RALE builtin labels (rale-builtins.ts)
  getNodeByIdLabel: 'Pobierz węzeł wg ID',
  getNodeByNameLabel: 'Pobierz węzeł wg SubType (klasa komponentu)',
  getRegistrySectionsLabel: '[Rejestr] Pobierz wszystkie sekcje',
  clearRegistryLabel: '[Rejestr] Wyczyść wszystkie sekcje',
  addRegistrySectionLabel: '[Rejestr] Dodaj/aktualizuj sekcję',
  removeRegistrySectionLabel: '[Rejestr] Usuń sekcję',
  addRegistryFieldLabel: '[Rejestr] Ustaw klucz sekcji',
  removeRegistryFieldLabel: '[Rejestr] Usuń klucz sekcji',
  editRegistryFieldLabel: '[Rejestr] Edytuj klucz sekcji',

  // Execute Function dropdown — RALE builtin descriptions (hint text)
  getNodeByIdDesc:
    'RALE getNodeById — przeszukiwanie w głąb według ścieżki; id odpowiada polu id węzła. Ścieżka [] = korzeń sceny.',
  getNodeByNameDesc:
    'RALE getNodeByName — name to node.subtype() (klasa komponentu XML), np. Label, RowList. Ścieżka [] = korzeń sceny.',
  getRegistrySectionsDesc:
    'RALE getRegistrySections — odczytuje wszystkie sekcje i klucze roRegistry (zwraca zagnieżdżony obiekt według nazwy sekcji).',
  clearRegistryDesc:
    'RALE clearRegistry — usuwa każdą sekcję rejestru na urządzeniu (operacja destrukcyjna).',
  addRegistrySectionDesc:
    'RALE addRegistrySection — args.name = nazwa sekcji; args.section = obiekt JSON z tekstowych par klucz/wartość.',
  removeRegistrySectionDesc:
    'RALE removeRegistrySection — usuwa jedną sekcję. Sekcje wczytywane są z urządzenia; po sukcesie rejestr jest odświeżany.',
  addRegistryFieldDesc:
    'RALE addRegistryField — ustawia wartość tekstową dla klucza w sekcji. Lista sekcji wczytywana jest z urządzenia.',
  removeRegistryFieldDesc:
    'RALE removeRegistryField — usuwa jeden klucz. Wybierz sekcję i klucz z list wczytanych z urządzenia.',
  editRegistryFieldDesc:
    'RALE editRegistryField — wybierz sekcję i klucz, a następnie wprowadź newKey i newValue. Listy wczytywane są z urządzenia.',
};
