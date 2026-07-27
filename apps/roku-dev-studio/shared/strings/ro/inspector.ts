/**
 * Romanian (ro) translation of the SceneGraph / node Inspector strings
 * (App Connector / RALE tab). Sibling of ../inspector.ts — same `inspector`
 * shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. Only literal
 * display text is translated; protocol identifiers, type names, code literals,
 * and example values are kept verbatim. Count-based functions apply Romanian
 * plural logic (singular for n===1; "de" before the noun when n===0 or the last
 * two digits are 0 or fall in 20–99).
 */
export const inspector = {
  // Reused generic status / errors (Inspector-scoped variants)
  notConnected: 'Neconectat',
  commandFailed: 'Comanda a eșuat',
  noResponseFromDevice: 'Niciun răspuns de la dispozitiv',

  // Connection flow (Connect/Disconnect, status line, Dev App preflight)
  connectingBtn: 'Se conectează...',
  connectionLost: 'Conexiune pierdută',
  reconnecting: 'Reconectare...',
  connectingStatus: '🟡 Se conectează...',
  reconnectingStatus: '🟡 Se reconectează...',
  connectedBang: 'Conectat!',
  checkingDevApp: 'Se verifică dacă Dev App este activă...',
  couldNotVerifyDevAppQuery:
    'Nu s-a putut verifica starea Dev App. Interogarea aplicației active a eșuat (rețea / ECP / mod dezvoltator?).',
  couldNotVerifyDevApp: 'Nu s-a putut verifica starea Dev App.',
  checkConnectionHint: 'Verificați conexiunea dispozitivului și modul dezvoltator, apoi încercați din nou Conectare.',
  statusCheckFailed: 'Verificarea stării a eșuat',
  devAppNotRunning:
    'Dev App nu rulează pe dispozitivul Roku. Vă rugăm să lansați mai întâi Dev App încărcată local.',
  launchDevAppHint: 'Accesați fila Dev App și faceți clic pe „Lansare” pentru a porni canalul încărcat local.',
  devAppNotActive: 'Dev App inactivă',
  wakingUpTrackerTask: (port: number): string => `Se activează TrackerTask pe portul ${port}...`,
  failedToConnect: 'Conectarea a eșuat',
  failedToWakeTrackerTask: 'Activarea TrackerTask a eșuat',
  connectingToSocket: 'Se conectează la socket...',
  connectingToSocketRetry: (attempt: number): string =>
    `Se conectează la socket (reîncercarea ${attempt})...`,
  initializing: 'Se inițializează...',
  connectionClosedByDevice: 'Conexiune închisă de dispozitiv',

  // Response card (index.ts)
  findInResponse: 'Caută în răspuns',
  saveResponseTitle: 'Salvează răspunsul',
  failedAutoFetchFunctions: 'Preluarea automată a funcțiilor a eșuat. Faceți clic pe Reîmprospătare pentru a încerca din nou.',
  refreshing: (command: string): string => `Se reîmprospătează ${command}…`,

  // Function selector / dropdown (function-selector.ts)
  connectToLoadFunctions: '-- Conectați-vă pentru a încărca funcțiile --',
  selectAFunction: '-- Selectați o funcție --',
  selectFunctionForParamDetails: 'Selectați o funcție pentru a vedea detaliile parametrilor',
  appConnectorFunctions: 'Funcții App Connector',
  raleFunctions: 'Funcții RALE',
  noFunctionsImplement: 'Nicio funcție — implementați GetExternalControlFunctions',
  readyToExecute: 'Gata de execuție',
  unknownFunctionName: 'necunoscut',
  functionCounts: (appCount: number, raleCount: number): string => {
    const appMod100 = appCount % 100;
    const appDe = appMod100 === 0 || (appMod100 >= 20 && appMod100 <= 99);
    const appWord = appCount === 1 ? 'funcție App' : 'funcții App';
    const raleMod100 = raleCount % 100;
    const raleDe = raleMod100 === 0 || (raleMod100 >= 20 && raleMod100 <= 99);
    const raleWord = raleCount === 1 ? 'comandă RALE' : 'comenzi RALE';
    return `${appCount} ${appDe ? 'de ' : ''}${appWord}, ${raleCount} ${raleDe ? 'de ' : ''}${raleWord}`;
  },

  // Function execution (function-execution.ts)
  sending: (command: string): string => `Se trimite ${command}...`,
  executing: (selection: string): string => `Se execută ${selection}...`,
  fetchingFunctions: 'Se preiau funcțiile disponibile...',
  foundFunctions: (n: number): string => {
    const mod100 = n % 100;
    const useDe = mod100 === 0 || (mod100 >= 20 && mod100 <= 99);
    const word = n === 1 ? 'funcție' : 'funcții';
    const verb = n === 1 ? 'S-a găsit' : 'S-au găsit';
    return `${verb} ${n} ${useDe ? 'de ' : ''}${word}`;
  },
  noFunctionsReturned: 'Nu s-a returnat nicio funcție',
  getExternalControlFunctionsReturnedFalse:
    'getExternalControlFunctions a returnat false — asigurați-vă că scena SceneGraph implementează această funcție',
  failedToFetchFunctions: 'Preluarea funcțiilor a eșuat',
  selectFunctionToExecute: 'Vă rugăm să selectați o funcție de executat',
  functionExecutionFailed: 'Execuția funcției a eșuat',
  unknownRaleBuiltin: 'Comandă RALE integrată necunoscută',
  unhandledRaleBuiltin: (command: string): string => `Comandă RALE integrată negestionată: ${command}`,

  // RALE path parsing (node-lookup.ts)
  pathMustBeJsonArray: 'Calea trebuie să fie un tablou JSON (de ex. [] sau [{"child":0}])',
  invalidPathJson: (detail: string): string => `JSON de cale nevalid: ${detail}`,

  // Update Node modal (node-update-panel.ts)
  noNodeContext: 'Niciun context de nod — rulați mai întâi „Obține nod după ID”.',
  fieldNameRequired: 'Numele câmpului este obligatoriu.',
  selectNodeFailed: 'selectNode a eșuat',
  selectingNode: 'Se selectează nodul…',
  removingField: 'Se elimină câmpul…',
  addingField: 'Se adaugă câmpul…',
  updatingField: 'Se actualizează câmpul…',
  removedField: (name: string): string => `Câmpul "${name}" a fost eliminat.`,
  addedField: (name: string): string => `Câmpul "${name}" a fost adăugat.`,
  updatedField: (name: string): string => `Câmpul "${name}" a fost actualizat.`,
  removeFieldBtn: 'Elimină câmpul',
  addFieldBtn: 'Adaugă câmp',
  updateFieldBtn: 'Actualizează câmpul',
  valueLabel: 'Valoare',
  newValueLabel: 'Valoare nouă',
  addValuePlaceholder:
    'Valoare inițială pentru câmpul nou (scalari, true/false, JSON pentru tablouri / obiect)',
  updateValuePlaceholder: 'Scalari, true/false, JSON pentru tablouri / vectori / obiecte',

  // Update Node — value parse errors (parseValueForRaleFieldType)
  parseBoolean: 'boolean: folosiți true sau false',
  parseInteger: 'integer: număr nevalid',
  parseFloat: 'float: număr nevalid',
  parseColor: 'color: folosiți un întreg (de ex. -16777216)',
  parseVector2d: 'vector2d: cel puțin două elemente, de ex. [0,0]',
  parseRect2d: 'rect2d: patru elemente, de ex. [0,0,100,100]',
  parseArray: 'array: tablou JSON nevalid',
  parseAssocArray: 'assocarray: este necesar un obiect JSON',
  jsonArrayRequired: (type: string): string => `${type}: este necesar un tablou JSON`,
  invalidJsonArray: (type: string): string => `${type}: tablou JSON nevalid`,

  // Registry builtin param editors (registry-params-ui.ts)
  unexpectedRegistryResponse: 'Răspuns neașteptat al registrului',
  loadingRegistry: 'Se încarcă registrul…',
  selectSection: '— Selectați secțiunea —',
  noSections: '(nicio secțiune)',
  selectKey: '— Selectați cheia —',
  noKeys: '(nicio cheie)',
  ariaSectionToRemove: 'Secțiune de eliminat',
  ariaSection: 'Secțiune',
  ariaKey: 'Cheie',
  ariaKeyToReplace: 'Cheie de înlocuit',
  removeSectionHint: 'Secțiuni încărcate de pe dispozitiv. Executarea elimină secțiunea selectată.',
  fieldKeyPlaceholder: 'Cheia câmpului',
  stringValuePlaceholder: 'Valoare șir',
  newKeyPlaceholder: 'Cheie nouă',
  newValuePlaceholder: 'Valoare nouă',

  // Registry client-side validation (registry-validation.ts)
  sectionNameRequired: 'Numele secțiunii este obligatoriu.',
  sectionMustBeJsonObject: 'Secțiunea trebuie să fie un obiect JSON (nu un tablou).',
  sectionKeysNotEmpty: 'Cheile obiectului secțiune nu pot fi goale sau formate doar din spații.',
  eachValueMustBeString: (key: string): string =>
    `Fiecare valoare trebuie să fie un șir (roRegistry stochează șiruri). Cheia "${key}" nu este un șir — folosiți șiruri între ghilimele în JSON.`,
  selectSectionFromList: 'Selectați o secțiune din listă.',
  selectKeyFromList: 'Selectați o cheie din listă.',
  enterFieldKey: 'Introduceți o cheie de câmp.',

  // Parameter inputs (parameter-inputs.ts)
  noParamsRequired: '✓ Niciun parametru necesar',
  selectFunctionForParams: 'Selectați o funcție pentru a vedea parametrii',
  booleanPlaceholder: 'true sau false',
  stringPlaceholder: 'Introduceți text...',

  // Execute Function dropdown — RALE builtin labels (rale-builtins.ts)
  getNodeByIdLabel: 'Obține nod după ID',
  getNodeByNameLabel: 'Obține nod după SubType (clasă de componentă)',
  getRegistrySectionsLabel: '[Registru] Obține toate secțiunile',
  clearRegistryLabel: '[Registru] Șterge toate secțiunile',
  addRegistrySectionLabel: '[Registru] Adaugă/actualizează secțiune',
  removeRegistrySectionLabel: '[Registru] Elimină secțiune',
  addRegistryFieldLabel: '[Registru] Setează cheia secțiunii',
  removeRegistryFieldLabel: '[Registru] Elimină cheia secțiunii',
  editRegistryFieldLabel: '[Registru] Editează cheia secțiunii',

  // Execute Function dropdown — RALE builtin descriptions (hint text)
  getNodeByIdDesc:
    'RALE getNodeById — căutare în adâncime sub cale; id se potrivește cu câmpul id al nodului. Calea [] = rădăcina scenei.',
  getNodeByNameDesc:
    'RALE getNodeByName — name este node.subtype() (clasa de componentă XML), de ex. Label, RowList. Calea [] = rădăcina scenei.',
  getRegistrySectionsDesc:
    'RALE getRegistrySections — citește toate secțiunile și cheile roRegistry (returnează un obiect imbricat după numele secțiunii).',
  clearRegistryDesc:
    'RALE clearRegistry — șterge fiecare secțiune de registru de pe dispozitiv (operațiune distructivă).',
  addRegistrySectionDesc:
    'RALE addRegistrySection — args.name = numele secțiunii; args.section = obiect JSON cu perechi cheie/valoare de tip șir.',
  removeRegistrySectionDesc:
    'RALE removeRegistrySection — șterge o secțiune. Secțiunile se încarcă de pe dispozitiv; după succes, registrul este reîmprospătat.',
  addRegistryFieldDesc:
    'RALE addRegistryField — setează o valoare de tip șir pentru o cheie dintr-o secțiune. Lista de secțiuni se încarcă de pe dispozitiv.',
  removeRegistryFieldDesc:
    'RALE removeRegistryField — șterge o cheie. Alegeți secțiunea și cheia din listele încărcate de pe dispozitiv.',
  editRegistryFieldDesc:
    'RALE editRegistryField — alegeți secțiunea și cheia, apoi introduceți newKey și newValue. Listele se încarcă de pe dispozitiv.',
};
