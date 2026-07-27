/**
 * Romanian (ro) translation of the global modals catalog.
 * Mirrors the exact shape of shared/strings/modals.ts — same keys, order, and
 * function signatures/placeholders. Only literal display text is translated.
 */
export const modals = {
  // Release Notes modal
  releaseNotes: 'Note de lansare',
  versionedReleaseNotes: (title: string): string => `${title} · Note de lansare`,
  openReleasePage: 'Deschide pagina lansării',
  loadingReleaseNotes: 'Se încarcă notele de lansare…',
  noReleaseNotes: 'Nu există note de lansare pentru această versiune.',
  couldNotLoadReleaseNotes: 'Notele de lansare nu au putut fi încărcate acum.',
  latestRelease: 'Cea mai recentă lansare',
  unknownError: 'Eroare necunoscută',

  // Update banner — update available
  updateAvailableTitle: (version?: string): string =>
    `Roku Dev Studio ${version ? `v${version}` : 'actualizare'} disponibilă`,
  newVersionReady: 'O nouă versiune este gata de descărcat.',
  dismissUpdateNotification: 'Închide notificarea de actualizare',
  later: 'Mai târziu',
  download: 'Descarcă',

  // Update banner — downloading
  downloadingUpdate: 'Se descarcă actualizarea…',
  pleaseWaitDownloading: 'Așteptați cât timp se descarcă actualizarea.',

  // Update banner — ready to install
  updateReadyTitle: (version?: string): string =>
    `Roku Dev Studio ${version ? `v${version}` : 'actualizare'} gata`,
  installedOnRestart: 'Se va instala la repornire.',
  restartAndInstall: 'Repornește și instalează',

  // Update banner — manual download / error
  newUpdateAvailable: 'Actualizare nouă disponibilă',
  pleaseDownloadLatest: 'Descărcați cea mai recentă versiune pentru a actualiza.',
  dismiss: 'Închide',
  updateError: 'Eroare de actualizare',
  updateCheckFailed: 'Verificarea actualizărilor a eșuat.',

  // "Check for Updates" — no update found toast
  upToDate: (version?: string): string => `Sunteți la zi${version ? ` (v${version})` : ''}.`,

  // Welcome-screen feature detail modals — longer blurb + capability bullets per tile.
  // (Keyed by the feature title so the component can look each up by the tile's live title.)
  features: {
    deviceDiscovery: {
      blurb:
        'Roku Dev Studio scanează continuu rețeaua locală cu SSDP, astfel încât fiecare Roku din aceeași subrețea apare automat — fără să fie nevoie să introduceți vreun IP.',
      points: [
        'Detectează automat modelele, numele și adresele IP ale dispozitivelor Roku',
        'Semnalează ce dispozitive au Modul dezvoltator activat',
        'Se actualizează pe măsură ce dispozitivele se conectează la rețea sau o părăsesc',
        'Un singur clic pentru a vă conecta și a începe lucrul',
      ],
    },
    appsDeepLinking: {
      blurb:
        'Răsfoiți fiecare canal instalat pe dispozitivul Roku conectat, lansați oricare dintre ele instantaneu și testați Deep-Links cu parametri personalizați de conținut și tip de media.',
      points: [
        'Grilă cu aplicațiile instalate (plus intrările TV pe televizoarele Roku TV)',
        'Lansare din grilă sau după ID-ul aplicației',
        'Deep-link cu contentId / mediaType pentru testarea lansării de conținut',
        'Copiați o listă brută de ID-uri + versiuni pentru tot ce este instalat',
      ],
    },
    devApp: {
      blurb:
        'Încărcați (sideload), controlați și inspectați canalul de dezvoltare de la un capăt la altul — de la încărcarea unui zip până la capturi de ecran în timp real ale conținutului afișat.',
      points: [
        'Încărcați (sideload) un canal de dezvoltare .zip cu parola de dezvoltator',
        'Lansați sau ștergeți aplicația încărcată',
        'Faceți capturi de ecran la cerere sau automat',
        'Copiați, descărcați sau ștergeți imaginile capturate',
      ],
    },
    appConnector: {
      blurb:
        'Apelați de la distanță funcții BrightScript din canalul încărcat și vedeți valorile returnate — testați căi de cod fără să atingeți telecomanda.',
      points: [
        'Invocați funcțiile exportate după nume, cu argumente',
        'Inspectați valorile returnate direct pe loc',
        'Rulează pe canalul de dezvoltare activ',
      ],
    },
    fiddle: {
      blurb:
        'Un spațiu de lucru pentru BrightScript: scrieți fragmente de cod într-un editor Monaco complet și rulați-le pe un dispozitiv conectat, cu linting în timp real.',
      points: [
        'Editor Monaco cu evidențierea sintaxei',
        'Feedback de linting în timp real pe măsură ce scrieți',
        'Rulare cu un singur clic pe dispozitivul Roku conectat',
        'Se deschide în propria fereastră dedicată',
      ],
    },
    mcpServer: {
      blurb:
        'Expuneți Roku Dev Studio agenților IA prin Model Context Protocol, astfel încât asistenții să vă poată controla dispozitivul în bucla de dezvoltare.',
      points: [
        'Lansați aplicații, apăsați taste și faceți capturi de ecran prin instrumentele MCP',
        'Interogați starea dispozitivului programatic',
        'Aduceți agenți IA în fluxul de testare și depanare',
      ],
    },
    deviceRemote: {
      blurb:
        'O telecomandă Roku completă pe ecran — fiecare buton al telecomenzii fizice, plus control de la tastatură și introducere de text.',
      points: [
        'D-pad, OK, Înapoi, Acasă, Opțiuni și Reluare',
        'Control media: redare/pauză, derulare înapoi, derulare rapidă înainte',
        'Volum, mut și pornire',
        'Introduceți text direct în câmpurile de pe dispozitiv',
      ],
    },
    query: {
      blurb:
        'Citiți starea în timp real de la dispozitivul Roku prin ECP (External Control Protocol) — informații despre dispozitiv, starea player-ului media, aplicațiile instalate și registrul.',
      points: [
        'Informații despre dispozitiv: model, versiune și rețea',
        'Aplicația activă și starea de redare a player-ului media',
        'Lista aplicațiilor instalate',
        'Conținutul registrului',
      ],
    },
    console: {
      blurb:
        'Transmiteți în timp real BrightScript Debug Output de la Roku prin Telnet, cu filtrare și căutare pentru a scoate la iveală exact ce contează.',
      points: [
        'Flux de jurnal Telnet în timp real',
        'Filtrare și căutare în tot textul',
        'Faceți clic pe URL-uri sau JSON pentru a le inspecta într-o fereastră modală',
        'Salvați jurnalul într-un fișier',
      ],
    },
    actionScripts: {
      blurb:
        'Automatizați fluxuri repetabile pe dispozitiv prin înlănțuirea apăsărilor de taste, a lansărilor de aplicații și a apelurilor RALE într-un singur script executabil.',
      points: [
        'Secvențiați apăsări de taste, lansări și așteptări',
        'Includeți apeluri RALE în flux',
        'Rerulați fluxuri pentru testarea de regresie',
      ],
    },
    networkInspector: {
      blurb:
        'Capturați și inspectați traficul HTTP/HTTPS al Dev App printr-un proxy MITM încorporat — ca fila de rețea a unui browser, dar pentru canalul dvs.',
      points: [
        'Vedeți fiecare cerere și răspuns pe care le face canalul',
        'Inspectați anteturile, corpurile și temporizarea',
        'Decriptați HTTPS prin proxy-ul MITM',
        'Grupați după gazdă sau vizualizați sesiunile prin proxy',
      ],
    },
    remoteLocations: {
      blurb:
        'Conectați-vă la dispozitive Roku care nu se află în rețeaua locală, direcționând traficul prin servere releu.',
      points: [
        'Ajungeți la dispozitive de oriunde printr-un server releu',
        'Gestionați mai multe locații la distanță',
        'Aceleași instrumente ca pentru dispozitivele locale',
      ],
    },
  },

  // ── Global modal fragments (renderer/components/modals/fragments/*.html) ──
  // One sub-group per fragment. Only elements whose visible text is a single
  // text node (pure text, icon + label, or a pure-text child span) are keyed —
  // applyI18n's mixed-content path replaces just the first text node, so prose
  // with inline <strong>/<code>/<em>/<a>/kbd markup is intentionally NOT keyed
  // and keeps its inline English. Generic buttons reuse common.* (cancel, save,
  // add, clear, close).

  addLocation: {
    title: '🌐 Adaugă locație la distanță',
    intro:
      'Conectați-vă la dispozitive Roku dintr-o locație la distanță prin Roku Relay Server care rulează pe un Mac Mini sau alt computer.',
    nameLabel: 'Nume locație',
    namePlaceholder: 'ex.: Laborator birou, Studio B',
    nameHint: 'Un nume prietenos pentru a identifica această locație',
    hostLabel: 'Adresă server',
    hostPlaceholder: '192.168.1.50 sau mac-mini.local',
    hostHint: 'Adresa IP sau numele de gazdă al Relay Server',
    portLabel: 'Port',
    portHint: 'Portul implicit este 4951',
    addBtn: 'Adaugă locație',
  },

  actionScriptsImport: {
    title: 'Importă script de acțiune',
    uploadJsonLabel: 'Încarcă JSON',
    chooseFileBtn: 'Alege fișier',
    pasteJsonLabel: 'Lipește sau editează JSON',
    outputFolderLabel: 'Folder de ieșire',
    noFolderSelected: 'Niciun folder selectat',
    chooseFolderBtn: 'Alege folder',
    outputWarning:
      'Dacă nu este selectat niciun folder, artefactele (ex.: capturile de ecran) nu vor fi salvate când rulați scriptul.',
    devPasswordRequiredMsg: 'Acest script necesită o parolă de dezvoltator. Introduceți-o mai jos.',
    devPasswordLabel: 'Parolă de dezvoltator',
    devPasswordPlaceholder: 'Introduceți parola de dezvoltator pentru pașii de captură de ecran / sideload',
    rememberPasswordTitle: 'Salvează parola pentru acest dispozitiv (la fel ca stocarea parolei în Dev App)',
    rememberPasswordLabel: 'Reține parola pentru acest dispozitiv',
    devPasswordHintHtml:
      'Necesar când scriptul are pași de captură de ecran sau sideload și nu include un câmp <code>devPassword</code>.',
    validateImportBtn: 'Validează și importă',
  },

  deeplinkDeleteMediaType: {
    title: 'Șterge tipul de media',
    confirmHint: 'Ștergeți tipul de media și aceste Deep-Links salvate?',
    deleteAllBtn: 'Șterge tot',
  },

  deeplinkMediaTypes: {
    title: 'Gestionează tipurile de media',
    hint: 'Tipurile de media încorporate sunt întotdeauna disponibile. Intrările personalizate sunt salvate global și apar în fiecare filă de dispozitiv.',
    builtinTitle: 'Încorporate',
    builtinMovie: 'Film',
    builtinSeries: 'Serial',
    builtinEpisode: 'Episod',
    builtinLive: 'În direct',
    customTitle: 'Personalizat',
    addTitle: 'Adaugă tip de media',
    displayNameLabel: 'Nume afișat',
    displayNamePlaceholder: 'ex.: Scurtmetraj',
    ecpValueLabel: 'Valoare ECP',
    ecpValuePlaceholder: 'ex.: short-film',
  },

  deeplinkSavePreset: {
    title: 'Salvează Deep-Link',
    hint: 'Dați acestui Deep-Link un nume pentru a-l putea alege din lista salvată pe orice dispozitiv.',
    nameLabel: 'Nume',
    namePlaceholder: 'ex.: Netflix · Episodul 12',
  },

  devMode: {
    title: 'Activați Modul dezvoltator pe Roku',
    whatIsHeading: 'Ce este Modul dezvoltator?',
    whatIsBody:
      'Modul dezvoltator vă permite să încărcați (sideload) și să testați propriile canale Roku direct pe dispozitiv. Activarea este gratuită și vă oferă acces la instrumente puternice de dezvoltare.',
    stepsHeading: 'Pași pentru activarea Modului dezvoltator',
    pressSequenceHtml:
      'Pe telecomanda Roku, apăsați: <span class="help-kbd">Home</span> <span class="help-kbd">Home</span> <span class="help-kbd">Home</span> <span class="help-kbd">↑</span> <span class="help-kbd">↑</span> <span class="help-kbd">→</span> <span class="help-kbd">←</span> <span class="help-kbd">→</span> <span class="help-kbd">←</span> <span class="help-kbd">→</span>',
    step2: 'Pe televizor va apărea o casetă de dialog Setări dezvoltator',
    step3Html: 'Selectați <strong>„Activează programul de instalare și repornește”</strong>',
    step4: 'Acceptați Acordul de licență Developer SDK',
    step5Html: `Setați o <strong>parolă pentru serverul web</strong> (veți avea nevoie de ea pentru sideloading)`,
    step6: 'Dispozitivul Roku va reporni cu Modul dezvoltator activat',
    afterHeading: 'După activare',
    afterIntro: 'După ce Modul dezvoltator este activat:',
    afterBadgeHtml:
      'Dispozitivul dvs. va afișa o insignă <span class="dev-badge enabled" style="font-size: 11px;"><span class="icon icon-xs"><svg><use href="#icon-wrench"/></svg></span> Dev</span> în lista de dispozitive',
    afterSideloadHtml: 'Puteți încărca (sideload) pachete de canal .zip prin fila <strong>Dev App</strong>',
    afterAppConnectorHtml: 'Folosiți <strong>App Connector</strong> pentru a comunica cu codul canalului dvs.',
    afterQueryHtml: 'Accesați interogări ECP suplimentare în fila <strong>Interogare</strong>',
    moreHeading: 'Mai multe informații',
    moreBody: 'Pentru documentație detaliată, vizitați documentația oficială Roku Developer:',
  },

  ecpMode: {
    title: 'Control prin aplicații mobile pe Roku',
    whyHeading: 'De ce este necesar acest lucru?',
    whyBodyHtml:
      'Funcționalitatea telecomenzii (apăsare de taste, aplicații, telecomandă rapidă, Trimite text) folosește External Control Protocol (ECP) al Roku. Setarea dispozitivului <strong>Control by Mobile Apps → Network Access</strong> poate fi setată la unul dintre cele patru moduri:',
    modeDisabledHtml: '<strong>Disabled</strong> – Controlul prin aplicații mobile este dezactivat.',
    modeLimitedHtml:
      '<strong>Limited</strong> – Doar introducere de text, lansări de aplicații și interogarea aplicației active; activat pe adresele de rețea privată.',
    modePermissiveHtml:
      '<strong>Permissive</strong> – Control complet; acceptă comenzi doar din rețeaua privată sau din aceeași subrețea.',
    modeEnabledHtml: '<strong>Enabled</strong> – Control complet; activat pe adresele de rețea privată.',
    howHeading: 'Cum să modificați setarea',
    step1Html: 'Pe dispozitivul Roku, mergeți la <strong>Setări</strong> → <strong>Sistem</strong>',
    step2Html: 'Deschideți <strong>Setări avansate de sistem</strong>',
    step3Html: 'Selectați <strong>Control by Mobile Apps</strong>',
    step4Html: 'Selectați <strong>Network Access</strong>',
    step5Html:
      'Alegeți <strong>Limited</strong>, <strong>Permissive</strong> sau <strong>Enabled</strong> (această aplicație se adaptează modului)',
    afterHeading: 'După modificare',
    afterBodyHtml:
      'Cu <strong>Limited</strong>, Trimite text, lansarea aplicațiilor și interogarea aplicațiilor funcționează; apăsarea completă a tastelor de pe telecomandă s-ar putea să nu. Cu <strong>Permissive</strong> sau <strong>Enabled</strong>, controlul complet al telecomenzii funcționează. Pentru Permissive, asigurați-vă că acest computer se află în aceeași subrețea ca Roku dacă comenzile eșuează. Nu este necesară nicio repornire după modificarea setării.',
  },

  keyboardRemoteHelp: {
    title: 'Telecomandă de la tastatură',
    introHtml:
      'Scurtăturile se aplică doar cât timp această filă de dispozitiv este pe fila <strong>Telecomandă</strong> sau pe fila <strong>Dev App</strong>.',
    tableCaption: 'Scurtături mapate pe telecomanda Roku',
    colKey: 'Tastă',
    colAction: 'Acțiune telecomandă',
    actionNavigate: 'Navigare (sus, jos, stânga, dreapta)',
    actionSelect: 'Selectare / OK',
    actionBack: 'Înapoi',
    actionHome: 'Acasă',
    actionPlayPause: 'Redare / Pauză',
    actionRewind: 'Derulare înapoi',
    actionForward: 'Derulare înainte',
    actionOptions: 'Opțiuni (Info)',
    actionReplay: 'Reluare instantanee',
    actionVolumeUp: 'Creștere volum',
    actionVolumeDown: 'Scădere volum',
    actionMute: 'Mut',
    actionPower: 'Pornire',
    footnote:
      'Dezactivați Telecomanda de la tastatură din Setări dacă nu doriți ca tastele săgeți și alte taste mapate să trimită apăsări de taste către Roku.',
  },

  secretScreens: {
    title: 'Ecrane secrete Roku',
    introHtml: `
            Dispozitivele Roku au meniuri de diagnosticare și de dezvoltare încorporate, accesibile prin secvențe de butoane de pe telecomandă.
            Din ecranul Roku <strong>Acasă</strong>, apăsați butoanele afișate pe fiecare rând folosind o
            <strong>telecomandă fizică</strong> (IR sau vocală).
          `,
    ecpLimitationTitle: 'Limitare ECP',
    ecpLimitationBodyHtml: `
              Roku nu interpretează în mod fiabil toate secvențele pentru ecrane secrete trimise prin ECP. Dacă o
              secvență nu se deschide prin <strong>Rulează secvența</strong>, folosiți <strong>telecomanda fizică</strong>.
            `,
    sectionTitle: 'Ecrane secrete',
  },

  integrationGuide: {
    title: 'Ghid de integrare',
    whatIsHeading: 'Ce este TrackerTask?',
    whatIsBodyHtml: `
            <strong>TrackerTask</strong> este o componentă BrightScript creată inițial pentru <strong>RALE (Roku Advanced
              Layout Editor)</strong> -
            instrumentul oficial de dezvoltare al Roku pentru inspectarea și depanarea aplicațiilor SceneGraph în timp real.
          `,
    trackerTaskEnabling:
      'TrackerTask stabilește o conexiune de tip socket între aplicația Roku și instrumentele externe, permițând:',
    enablingPoint1: 'Inspecția și modificarea nodurilor în timp real',
    enablingPoint2: 'Vizualizare în timp real a limitelor elementelor UI',
    enablingPoint3: 'Gestionarea registrului',
    enablingPoint4: 'Jurnalizare și depanare',
    extendsBody:
      'App Connector extinde această funcționalitate cu două funcții personalizate care vă permit să expuneți și să executați funcțiile BrightScript personalizate ale aplicației din acest instrument desktop.',
    customFunctionsHeading: 'Funcții personalizate pentru App Connector',
    customFunctionsBody:
      'Au fost adăugate două funcții la TrackerTask pentru a activa funcționalitatea App Connector:',
    implementingHeading: 'Implementarea în scena dvs.',
    implementingBodyHtml: `
            <strong>MainScene.xml</strong> al aplicației dvs. trebuie să declare două funcții de interfață pe care le va
            apela TrackerTask:
          `,
    getExternalHeading: 'Implementarea GetExternalControlFunctions',
    getExternalBodyHtml: `
            Această funcție trebuie să returneze un <strong>roArray</strong> de tablouri asociative, unde fiecare element descrie o
            funcție:
          `,
    supportedParamsBodyHtml: `
              <strong>Boolean</strong> · <strong>Integer</strong> · <strong>LongInteger</strong> ·
              <strong>Float</strong> ·
              <strong>Double</strong> · <strong>String</strong> · <strong>roAssociativeArray</strong> ·
              <strong>roArray</strong> · <strong>roList</strong>
            `,
    supportedParamsTitle: '📝 Tipuri de parametri acceptate',
    executeFunctionHeading: 'Implementarea ExecuteFunction',
    executeFunctionBody:
      'Această funcție primește numele funcției și tabloul de parametri, apoi le direcționează către handlerul corespunzător:',
    setupHeading: 'Configurarea TrackerTask',
    setupBody: 'Adăugați componenta TrackerTask în proiect și creați o instanță în MainScene:',
    setupPlaceHtml: `
            Plasați fișierul <code>TrackerTask.xml</code> în directorul <code>components/</code> al aplicației dvs.
          `,
    saveBtn: 'Salvează TrackerTask.xml',
    copyBtn: 'Copiază informațiile de integrare',
  },

  helpModal: {
    title: 'Ajutor și ghid de utilizare',
    navAriaLabel: 'Secțiuni de ajutor',
    navDeviceDiscovery: 'Descoperire dispozitive',
    navRemoteControl: 'Telecomandă',
    navApps: 'Aplicații',
    navQuery: 'Interogare',
    navDevApp: 'Dev App',
    navConsole: 'Consolă',
    navAppConnector: 'App Connector',
    navActionScripts: 'Scripturi de acțiune',
    navDevicePerformance: 'Performanța dispozitivului',
    navNetworkInspector: 'Inspector de rețea',
    navAiAgents: 'Agenți IA (MCP)',
    navFiddle: 'BrightScript Fiddle',
    navLogViewer: 'Vizualizator fișiere jurnal',
    navSecretScreens: 'Ecrane secrete',
    navSettings: 'Setări',
    navRemoteLocations: 'Locații la distanță',
    navSideloadRelay: 'Sideload Relay',
    navTips: 'Sfaturi',

    deviceDiscoveryHeading: 'Descoperire dispozitive',
    deviceDiscoveryScanHtml: `Faceți clic pe <strong>Scanare</strong> pentru a descoperi automat dispozitivele Roku din rețea. Dispozitivele cu Modul dezvoltator activat vor afișa o insignă verde „Dev”.`,
    deviceDiscoveryNoScanHtml: `<strong>Scanarea nu găsește nimic?</strong> Multicastul SSDP (portul UDP 1900) poate fi blocat de VPN, de o rețea Wi‑Fi corporativă sau de reguli de firewall — încercați Conectare manuală cu adresa IP a dispozitivului. PC-ul și dispozitivul Roku trebuie să fie în aceeași rețea accesibilă.`,
    deviceDiscoveryManual:
      'Vă puteți conecta și manual introducând o adresă IP în secțiunea „Conectare manuală” din partea de jos a barei laterale.',

    remoteControlHeading: 'Telecomandă',
    remoteControlIntroHtml: `Folosiți telecomanda virtuală pentru a controla dispozitivul Roku. Comenzile rapide de la tastatură opționale sunt disponibile când activați <strong>Setări → General → Telecomandă Roku - folosește tastatura </strong> (dezactivat implicit). Se aplică pe fila <strong>Telecomandă</strong> (individual sau în aspectul cvadruplu de performanță a dispozitivului) sau pe fila <strong>Dev App</strong>, doar pentru fila de dispozitiv pe care o aveți deschisă — nu în alte secțiuni, câmpuri de text sau ferestre modale.`,
    remoteControlTabHtml: `Pe fila <strong>Telecomandă</strong> sau <strong>Dev App</strong>, apăsați <span class="help-kbd">Tab</span> din controalele telecomenzii (nu din filele de secțiune sau din alt câmp de text) pentru a sări la câmpul <strong>Trimite text</strong>. <span class="help-kbd">Enter</span> trimite din acel câmp.`,
    remoteControlMediaHtml: `Controalele media (Derulare înapoi, Redare/Pauză, Derulare înainte) și butoanele de volum sunt disponibile și pe telecomanda virtuală. Folosiți <strong>Trimite text</strong> din partea de jos pentru a introduce text direct în câmpul de text activ al dispozitivului.`,
    scNavigation: 'Navigare',
    scForward: 'Derulare înainte',
    scSelect: 'Selectare / OK',
    scRewind: 'Derulare înapoi',
    scBack: 'Înapoi',
    scReplay: 'Reluare instantanee',
    scHome: 'Acasă',
    scVolume: 'Creștere / scădere volum',
    scPlayPause: 'Redare / Pauză',
    scMute: 'Mut',
    scOptions: 'Meniu opțiuni',
    scPower: 'Pornire',

    appsHeading: 'Aplicații',
    appsListHtml: `
            <li><strong>Lansare personalizată</strong> - Lansați orice aplicație după ID, inclusiv intrările TV (HDMI 1-4)</li>
            <li><strong>Deep Link</strong> - Lansați aplicații cu conținut specific folosind deep linking (App ID, Content ID, Media Type)</li>
            <li><strong>Listă brută de aplicații</strong> - Vizualizați lista XML brută a tuturor aplicațiilor instalate</li>
          `,
    appsBody:
      'Vizualizați toate aplicațiile instalate pe dispozitivul Roku. Faceți clic pe orice aplicație pentru a o lansa. Folosiți căutarea pentru a filtra aplicațiile după nume.',

    queryHeading: 'Interogare',
    queryListHtml: `
            <li><strong>Interogări dispozitiv</strong> - Presetări pentru interogări obișnuite precum Device Info, Apps, Active App, Media Player și altele</li>
            <li><strong>Interogări dezvoltator</strong> - Interogări avansate pentru dispozitivele cu modul dezvoltator (SG Nodes, Plugins, Frame Rate, Channel Perf, App State, Registry)</li>
            <li><strong>Interogare personalizată</strong> - Introduceți orice punct final ECP personalizat</li>
          `,
    queryIntro: 'Interogați informațiile despre dispozitiv folosind punctele finale ECP ale Roku:',
    queryResults:
      'Rezultatele sunt afișate în panoul Rezultate de mai jos. Sunt disponibile și puncte finale POST (urmărire SGRendezvous, FW Beacons).',

    devAppHeading: 'Dev App',
    devAppListHtml: `
            <li><strong>Autentificare</strong> - Introduceți și validați parola de dezvoltator Roku. Activați „Reține” pentru a o păstra între sesiuni</li>
            <li><strong>Sideload</strong> - Instalați pachete de canal .zip sau .pkg</li>
            <li><strong>Telecomandă</strong> - Vizualizați pagina web de instalare a dispozitivului pentru opțiuni de dezvoltare suplimentare</li>
            <li><strong>Captură de ecran</strong> - Faceți capturi de ecran din Dev App în execuție</li>
            <li><strong>Șterge</strong> - Eliminați canalul încărcat (sideload)</li>
          `,
    devAppIntro: 'Pentru dispozitivele cu Modul dezvoltator activat:',
    devAppNote: 'Veți avea nevoie de parola de dezvoltator Roku (setată în timpul configurării Modului dezvoltator).',

    consoleHeading: 'Consolă',
    consoleListHtml: `
            <li><strong>Conectare / Deconectare</strong> - Stabiliți sau închideți conexiunea telnet</li>
            <li><strong>Găsire / Filtrare</strong> - Căutați în jurnale cu opțiuni pentru potrivire sensibilă la majuscule, cuvânt întreg și regex</li>
            <li><strong>Derulare automată</strong> - Derulați automat până la cea mai recentă ieșire</li>
            <li><strong>Copiere / Salvare</strong> - Copiați toate jurnalele în clipboard sau salvați-le într-un fișier</li>
            <li><strong>Golire</strong> - Goliți ieșirea consolei</li>
          `,
    consoleIntro: 'Conectați-vă la consola de depanare BrightScript prin Telnet (portul 8085):',
    consoleNote:
      'Necesită Modul dezvoltator activat. Pe fiecare dispozitiv poate fi activă o singură conexiune Telnet la un moment dat.',

    appConnectorHeading: 'App Connector',
    appConnectorListHtml: `
            <li><strong>Conectare</strong> - Stabilește o conexiune de tip socket cu Dev App în execuție (port implicit <code>49200</code>)</li>
            <li><strong>Execută funcția</strong> - Apelați funcții personalizate expuse de <code>GetExternalControlFunctions</code> al scenei dvs.</li>
            <li><strong>Răspuns</strong> - Vizualizați valorile returnate și ieșirea de depanare</li>
            <li><strong>Actualizează nodul</strong> - După rularea <em>Get Node by ID</em>, panoul de răspuns oferă o fereastră modală de actualizare a nodului în care puteți efectua <code>selectNode</code>, <code>setField</code> sau <code>removeField</code> pe nodul găsit</li>
            <li><strong>Funcții RALE încorporate</strong> - Meniul derulant de funcții listează și comenzi RALE încorporate: <em>Get Node by ID</em>, <em>Get Node by SubType</em> și un editor de registru (<em>Get All Sections</em>, <em>Add/Update Section</em>, <em>Remove Section</em>, <em>Set / Edit / Remove Section Key</em>, <em>Clear All Sections</em>)</li>
          `,
    appConnectorFooterHtml: `Aplicația dvs. Roku trebuie să aibă TrackerTask integrat. Faceți clic pe <strong>Ghid de integrare</strong> în fila App Connector pentru fragmentele BrightScript și tipurile de parametri acceptate. Folosiți <strong>Salvează TrackerTask.xml</strong> din aceeași fereastră modală pentru a plasa o copie gata de livrare în canalul dvs.`,
    appConnectorIntro:
      'Conectați-vă la aplicații Roku care implementează componenta TrackerTask pentru comunicare bidirecțională:',

    actionScriptsHeading: 'Scripturi de acțiune',
    actionScriptsBuilderHtml: `<strong>Constructor</strong> - Creați vizual scripturi de acțiune, acțiune cu acțiune:`,
    actionScriptsBuilderListHtml: `
            <li><strong>Tipuri de acțiuni</strong> - Keypress, Send Text, Launch App, Device Query, POST, Sideload, Delete Sideload, Screenshot, App Function, RALE Command, captură Device Performance, Wait, If</li>
            <li><strong>Variabile (script v2)</strong> - Folosiți un pas <em>Set Variable</em> sau <code>assignToVar</code> pe Device Query / App Function / RALE Command pentru a reține valori, apoi referiți-le ca <code>\${name}</code> în câmpurile pașilor ulteriori (text, parametri, conținut deep-link etc.)</li>
            <li><strong>If / Else if / Else (script v2)</strong> - Ramificați în funcție de condiții provenite din starea <code>media-player</code>, aplicația activă, un câmp de nod RALE sau o variabilă stocată; imbricați pași <em>If</em> pentru ramuri cu mai mulți pași</li>
            <li><strong>Condiții de așteptare</strong> - <em>Wait</em> poate fi un <code>delayMs</code> fix sau poate aștepta până când o condiție devine adevărată: starea <em>media-player</em> sau <em>câmp de nod RALE</em> (interoghează <code>getNodeById</code> și compară un câmp cu operatori precum <code>equals</code>, <code>contains</code>, <code>matches</code>, <code>hasAnyValue</code>) cu <code>timeoutMs</code> și <code>pollIntervalMs</code> opționale</li>
            <li><strong>Pas Device Performance</strong> - Capturați graficele <em>CPU</em>, <em>memorie</em>, <em>obiecte</em> sau <em>toate</em> pentru dispozitivul pe care rulează acest script; imaginile PNG capturate sunt incluse în rezultatele rulării / exportul PDF</li>
            <li><strong>Ajutor per pas</strong> - Controlul <em>?</em> de pe fiecare rând al constructorului deschide o fereastră de ajutor contextuală pentru acel tip de acțiune</li>
            <li><strong>Gestionarea acțiunilor</strong> - Adăugați, ștergeți, reordonați (glisare și fixare), copiați și lipiți acțiuni</li>
            <li><strong>Copiere / Lipire</strong> - Copiați o acțiune cu controlul de copiere de pe fiecare rând. După copiere, folosiți <strong>Lipește pasul</strong> lângă orice rând <strong>Adaugă pas</strong> pentru a insera în acea poziție sau <span class="help-kbd">Ctrl</span>+<span class="help-kbd">V</span> pentru a adăuga la sfârșitul scriptului</li>
            <li><strong>Import</strong> - Încărcați un script existent dintr-un fișier JSON</li>
            <li><strong>Anulare / Refacere</strong> - <span class="help-kbd">Ctrl</span>+<span class="help-kbd">Z</span> pentru anulare, <span class="help-kbd">Ctrl</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">Z</span> pentru refacere</li>
            <li><strong>Previzualizare JSON</strong> - Previzualizare în timp real a scriptului generat. Copiați sau salvați scriptul într-un fișier</li>
            <li><strong>Copiază în Executor</strong> - Trimiteți scriptul construit direct în Executor pentru rulare</li>
          `,
    actionScriptsExecutorHtml: `<strong>Executor</strong> - Importați, validați și rulați scripturi de acțiune:`,
    actionScriptsExecutorListHtml: `
            <li><strong>Import</strong> - Încărcați un fișier de script JSON sau lipiți JSON-ul scriptului, apoi validați</li>
            <li><strong>Rulare / Pauză / Oprire</strong> - Controlați execuția cu acțiunile de redare, pauză și oprire</li>
            <li><strong>Omite / Reactivează</strong> - Comutați acțiuni individuale pentru a fi omise în timpul execuției</li>
            <li><strong>Reordonare</strong> - Glisați și fixați pentru a reordona acțiunile înainte de rulare</li>
            <li><strong>Rezultate</strong> - Vizualizați rezultate detaliate pentru fiecare acțiune, inclusiv capturi de ecran incorporate și grafice de performanță capturate</li>
            <li><strong>Copiază / Salvează rezultatele</strong> - Copiați rezultatele în clipboard sau salvați-le ca PDF (PDF-ul include capturi de ecran și carduri de grafice)</li>
            <li><strong>Conectare la consolă</strong> - Opțional, conectați-vă automat la consola de depanare în timpul rulărilor</li>
          `,
    actionScriptsDevPasswordHtml: `<strong>Parolă de dezvoltator</strong> - Acțiuni precum Screenshot, Sideload și Delete Sideload necesită o parolă de dezvoltator. Parola este rezolvată în ordine: <code>"password"</code> la nivel de acțiune → <code>"devPassword"</code> la nivel de script → parola din secțiunea de autentificare Dev App. Dacă nu se găsește niciuna, vi se va cere în timpul validării.`,
    actionScriptsSaveFolderHtml: `<strong>Folder de salvare</strong> - Folderul de salvare implicit se află la <strong>Setări → Scripturi de acțiune → Folder implicit</strong>. La fiecare rulare puteți alege alt folder. Artefactele (capturi de ecran, imagini PNG cu grafice de performanță, PDF-uri exportate) ajung într-un subfolder cu marcaj temporal, creat doar când se produce efectiv ceva.`,
    actionScriptsAiAgentsHtml: `<strong>Agenți IA</strong> - Scripturile de acțiune pe care le construiți în Constructor pot fi create și de agenți IA prin serverul MCP (vezi secțiunea <em>Agenți IA (MCP)</em> de mai jos); scriptul agentului ajunge întotdeauna în Constructor pentru revizuire umană înainte de rulare.`,
    actionScriptsIntro:
      'Automatizați secvențe de acțiuni ale dispozitivului folosind scripturi bazate pe JSON. Sunt disponibile două vizualizări:',

    devicePerformanceHeading: 'Performanța dispozitivului (secțiunea telecomenzii)',
    devicePerformanceIntroHtml: `Comutați <strong>Afișează performanța dispozitivului</strong> în secțiunea telecomenzii pentru a extinde un cadru cvadruplu cu grafice în timp real:`,
    devicePerformanceListHtml: `
            <li>Grafice pentru <strong>utilizarea CPU</strong>, <strong>memoria sistemului</strong> și <strong>obiectele BrightScript</strong> (vizualizare după număr sau memorie, unde este disponibilă)</li>
            <li>Graficele reflectă aplicația în execuție — pentru citiri reprezentative, dispozitivul ar trebui să aibă <strong>Modul dezvoltator</strong> activat și <strong>canalul de dezvoltare încărcat (sideload)</strong> în prim-plan</li>
            <li><strong>Setări → Performanța dispozitivului</strong> reglează intervalul de eșantionare al graficelor și fereastra de istoric; activați <strong>Reține „Afișează performanța dispozitivului”</strong> pentru a restaura aspectul cvadruplu pentru fiecare dispozitiv între sesiuni</li>
            <li>În Scripturi de acțiune, pașii <strong>Device Performance</strong> capturează carduri de grafice în rezultatele rulării (și în exportul PDF)</li>
          `,

    networkInspectorHeading: 'Inspector de rețea',
    networkInspectorIntroHtml: `Inspectați traficul HTTP(S) generat de canalul dvs. de dezvoltare. Roku Dev Studio rulează un <strong>proxy MITM</strong> local care decriptează traficul HTTPS al canalului de dezvoltare direcționat prin el, astfel încât să puteți vedea anteturile și corpurile complete de cerere/răspuns.`,
    networkInspectorGettingStartedHtml: `<strong>Primii pași</strong>`,
    networkInspectorGettingStartedListHtml: `
            <li>Activați <strong>proxy-ul MITM</strong> în <strong>Setări → Inspector de rețea</strong>, apoi faceți ca acel canal de dezvoltare să își direcționeze cererile prin adresa de proxy afișată — folosiți <code>host:port</code> (ex. <code>192.168.1.50:8888</code>). Modul în care canalul aplică acel proxy depinde de codul de rețea al aplicației dvs.</li>
            <li><strong>Captura prin hotspot</strong> opțională înregistrează metadate SNI/DNS pentru tot traficul dispozitivului; necesită acces la captura de pachete a sistemului de operare (BPF pe macOS, Npcap pe Windows). Setări → Inspector de rețea prezintă configurarea pentru fiecare platformă.</li>
          `,
    networkInspectorToolbarHtml: `<strong>Bara de instrumente</strong> (în dreapta sus a panoului): <strong>Pornește/Oprește captura</strong>, <strong>Aspect panouri</strong> (stivuit față de cerere/răspuns unul lângă altul) și <strong>Configurează regulile de trafic</strong>.`,
    networkInspectorToolbarListHtml: `
            <li><strong>Lista de sesiuni</strong> - Filtrați cu <code>host:</code>, <code>method:</code>, <code>status:</code>, <code>type:</code>, <code>kind:</code>, <code>path:</code> (separați termenii cu virgule pentru OR); grupați după gazdă; comutați <em>Proxied</em> pentru a ascunde metadatele exclusiv de hotspot. Scurtăturile de salt la eroare și de derulare la cea mai recentă apar când sunt relevante.</li>
            <li><strong>Inspectare</strong> - Vizualizați prezentarea generală a cererii / răspunsului, anteturile și corpurile (JSON / XML / brut). <strong>Copiați</strong> un corp sau exportați tranzacția ca <strong>cURL</strong> sau <strong>HAR</strong>.</li>
            <li><strong>Salvează .pcap</strong> - Exportați pachetele capturate ale dispozitivului; <strong>Golire</strong> golește lista de sesiuni.</li>
          `,
    networkInspectorTrafficRulesHtml: `<strong>Regulile de trafic</strong> (roata dințată din bara de instrumente) modelează traficul prin proxy al acestui dispozitiv; modificările intră în vigoare imediat:`,
    networkInspectorTrafficRulesListHtml: `
            <li><strong>Blochează tot traficul prin proxy</strong> - Respinge fiecare cerere prin proxy. Aceasta are prioritate față de regulile per gazdă și limitarea dispozitivului.</li>
            <li><strong>Limitare dispozitiv</strong> - Limitați lățimea de bandă și/sau adăugați latență pentru fiecare cerere prin proxy. Alegeți o presetare sau introduceți o valoare personalizată (ex. <code>3 Mbps</code>, <code>1500 kbps</code>).</li>
            <li><strong>Reguli per gazdă</strong> - Adăugați un <strong>nume de gazdă</strong> pentru a viza fiecare cerere către acea gazdă sau o combinație <strong>gazdă + cale</strong> (ex. <code>api.example.com/v1/play</code>) pentru a viza doar acea cale. Fiecare regulă poate <em>Bloca</em>, <em>Reseta</em> conexiunea (simulează o eroare de rețea), <em>Simula</em> un răspuns predefinit (stare / Content-Type / întârziere / corp) și/sau limita traficul.</li>
            <li><strong>Metacaractere</strong> - Folosiți <code>*</code> în gazdă sau cale pentru a potrivi mai multe ținte. <code>*.example.com</code> acoperă fiecare subdomeniu (ex. mediile inferioare <em>și</em> de producție într-o singură regulă), iar <code>/v1/*/play</code> potrivește orice cale sub <code>/v1</code>. Un tipar fără <code>*</code> păstrează comportamentul vechi (o gazdă simplă potrivește și subdomeniile sale).</li>
            <li><strong>Editează o regulă</strong> - Faceți clic pe creion la o regulă pentru a-i modifica pe loc URL-ul de interceptare (gazdă sau gazdă/cale); apăsați Enter pentru a aplica sau Escape pentru a anula.</li>
            <li><strong>Rescriere</strong> - Spre deosebire de Blocare / Resetare / Simulare (care opresc cererea), regulile de rescriere lasă cererea să treacă cu modificările aplicate. Adăugați operații pe <em>cerere</em> (redirecționați gazda — „map remote” al unui URL de producție către staging/localhost, setați calea, adăugați/eliminați parametri de interogare sau anteturi, găsire/înlocuire în corp) și/sau pe <em>răspuns</em> (suprascrieți starea, adăugați/eliminați anteturi, găsire/înlocuire în corp — răspunsurile gzip/br sunt decodate, editate și retrimise). Găsirea/înlocuirea în corp acceptă text simplu sau regex și se aplică doar corpurilor textuale.</li>
            <li><strong>Limite</strong> - O gazdă nu poate fi mai rapidă decât plafonul lățimii de bandă al dispozitivului, iar latența sa nu poate coborî sub pragul minim de latență al dispozitivului.</li>
          `,
    networkInspectorLocalOnly: 'Inspector de rețea este disponibil pentru dispozitivele conectate local.',

    aiAgentsHeading: 'Agenți IA (MCP)',
    aiAgentsIntroHtml: `Roku Dev Studio include un server <strong>MCP (Model Context Protocol)</strong> astfel încât agenții IA din Cursor, Claude Desktop sau VS Code pot controla un dispozitiv real prin această aplicație:`,
    aiAgentsListHtml: `
            <li><strong>Setări → Server MCP</strong> - Comutați un client pentru a adăuga sau elimina intrarea sa MCP <code>roku-dev-studio</code>; celelalte intrări din configurația MCP a acelui client rămân neatinse</li>
            <li><strong>Două suprafețe</strong> - Operații directe pe dispozitiv pentru acțiuni unice (<code>keypress</code>, <code>launch_app</code>, <code>screenshot</code>, <code>app_function</code>, <code>rale_command</code>, telnet …) și <strong>Scripturi de acțiune</strong> pentru fluxuri cu mai mulți pași / condiționale care ajung în Constructor pentru revizuire</li>
            <li><strong>Notificări toast</strong> - Acțiunile distructive ale agentului (lansare, sideload, ștergere sideload, captură de ecran, comenzi RALE distructive) afișează o notificare toast neblocantă în aplicație, astfel încât să vedeți întotdeauna ce a făcut agentul</li>
            <li><strong>Parolele rămân locale</strong> - Sideload / captură de ecran / ștergere sideload refolosesc parola memorată de panoul dispozitivului; agentul nu trebuie să trimită niciodată una</li>
          `,
    aiAgentsBridge:
      'Puntea pornește automat când aplicația este deschisă și se oprește la închiderea acesteia. Dacă un agent raportează că puntea este offline, aduceți pur și simplu această aplicație în prim-plan.',

    fiddleHeading: 'BrightScript Fiddle',
    fiddleIntroHtml: `Deschideți prin <strong>Fișier → Deschide Fiddle</strong> (<span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">B</span>) sau butonul <em>Deschide Fiddle</em> din fila Interogare.`,
    fiddleListHtml: `
            <li><strong>Editor</strong> - Editor Monaco cu evidențierea sintaxei BrightScript și linting <em>BrighterScript</em> în timp real; butonul Rulează este dezactivat cât timp există erori</li>
            <li><strong>Rulează</strong> - Încapsulează fragmentul dvs. într-un canal SceneGraph minimal, îl încarcă (sideload) pe dispozitivul selectat și transmite consola de depanare BrightScript (8085) în terminalul ferestrei Fiddle</li>
            <li><strong>Oprire / închidere fereastră</strong> - Elimină automat canalul Fiddle de pe dispozitiv</li>
          `,
    fiddleNote:
      'Necesită un dispozitiv cu Modul dezvoltator activat și o parolă de dezvoltator cunoscută (folosiți o dată fila Dev App pentru a o reține sau vi se va cere în Fiddle).',

    logViewerHeading: 'Vizualizator fișiere jurnal',
    logViewerBodyHtml: `<strong>Fișier → Deschide fișier jurnal</strong> (<span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">Shift</span>+<span class="help-kbd">O</span>) deschide un fișier de consolă / jurnal salvat într-o fereastră dedicată, cu aceleași instrumente de găsire / jurnal structurat / detectare a URL-urilor ca fila Consolă activă. Util pentru revizuirea jurnalelor dintr-o sesiune anterioară sau de la un coleg.`,

    secretScreensHeading: 'Ecrane secrete',
    secretScreensBodyHtml: `Linkul <em>Ecrane secrete</em> (secțiunea telecomenzii și subsolul filei Interogare) deschide o fereastră modală care listează secvențele standard de taste Roku pentru setări ascunse — <strong>Developer Settings</strong>, <strong>Secret Screen 1/2/3</strong>, <strong>Wi-Fi Info</strong>, <strong>Channel Info</strong>, <strong>Reboot</strong> etc. Faceți clic pe o secvență pentru a trimite apăsările de taste către dispozitivul conectat.`,

    settingsHeading: 'Setări',
    settingsIntroHtml: `Deschideți cu <span class="help-kbd">Ctrl</span>/<span class="help-kbd">Cmd</span>+<span class="help-kbd">,</span> sau <em>Roku Dev Studio → Setări</em> (macOS) / <em>Fișier → Setări</em> (Windows / Linux). Cinci secțiuni:`,
    settingsListHtml: `
            <li><strong>General</strong> - Mod dezvoltator, Mod confidențialitate (maschează adresele IP / numerele de serie), Jurnalizare de depanare în fișier, Telecomandă Roku - folosește tastatura, Conectare automată la dispozitive, Ascunde automat bara laterală, Criptează parolele salvate (linia de stare arată dacă brelocul de chei al sistemului de operare criptează cu adevărat — pe unele configurații Linux nu o face)</li>
            <li><strong>Scripturi de acțiune</strong> - Folderul implicit pentru artefactele rulării (capturi de ecran, PDF-uri exportate)</li>
            <li><strong>Performanța dispozitivului</strong> - Intervalul de eșantionare al graficelor, fereastra de istoric al graficelor, Reține „Afișează performanța dispozitivului” pentru fiecare dispozitiv</li>
            <li><strong>Temporizare &amp; rețea</strong> - Expirări de conectare / interogare / telnet și alte reglaje de rețea (cu Resetare la valorile implicite)</li>
            <li><strong>Server MCP</strong> - Comutați <code>roku-dev-studio</code> în clientul/clienții IA, astfel încât agenții să poată controla dispozitivul prin această aplicație</li>
          `,

    remoteLocationsHeading: 'Locații la distanță',
    remoteLocationsListHtml: `
            <li><strong>Configurare</strong> - Rulați Roku Relay Server pe un Mac Mini la locația la distanță</li>
            <li><strong>Adaugă locație</strong> - Faceți clic pe „Adaugă” în secțiunea Locații la distanță pentru a configura o conexiune</li>
            <li><strong>Adresă server</strong> - Introduceți adresa IP sau numele de gazdă al serverului releu</li>
            <li><strong>Port implicit</strong> - Serverul releu rulează implicit pe portul <code>4951</code></li>
          `,
    remoteLocationsServerHtml: `Serverul releu poate fi găsit în folderul <code>remote-server</code>. Consultați README pentru instrucțiuni de configurare (LaunchAgent pe macOS, systemd pe Linux, Task Scheduler pe Windows).`,
    remoteLocationsTroubleshootHtml: `<strong>Sideload-ul sau captura de ecran eșuează prin releu, dar ECP funcționează?</strong> Actualizați gazda releu la aceeași versiune <code>roku-dev-studio-api</code> ca această aplicație. Verificați <code>GET /health</code> pe releu (câmpul <code>apiVersion</code>) și asigurați-vă că portul <code>4951</code> este accesibil prin firewalluri.`,
    remoteLocationsIntro: 'Controlați dispozitive Roku din locații la distanță prin intermediul unui Relay Server:',

    sideloadRelayHeading: 'Sideload Relay',
    sideloadRelayIntroHtml: `Încărcați (sideload) o singură versiune pe <strong>mai multe dispozitive deodată</strong>. Când releul este activat, Roku Dev Studio se anunță ca un Roku în rețeaua dvs.: îndreptați IDE-ul (VS Code BrightScript / roku-deploy / Eclipse) sau un browser către acest computer, încărcați o singură dată, iar RDS distribuie versiunea — <em>instalare → lansare → consolă</em> — către fiecare dispozitiv vizat, local sau dintr-o locație la distanță.`,
    sideloadRelayEnableHtml: `<strong>Activați-l</strong> în <strong>Setări → Sideload Relay</strong> (dezactivat implicit). Două condiții prealabile controlează comutatorul:`,
    sideloadRelayEnableListHtml: `
            <li><strong>Parolă de dezvoltator releu</strong> - Parola cu care IDE-ul dvs. se autentifică la RDS (utilizator <code>rokudev</code>), exact ca parola de dezvoltator a unui Roku real. Aceasta este separată de parola de dezvoltator proprie a fiecărui dispozitiv vizat.</li>
            <li><strong>Configurează dispozitivele</strong> - Deschideți fereastra modală de configurare a dispozitivelor și activați cel puțin un dispozitiv accesibil, cu Modul dezvoltator activat. Aceasta listează dispozitive locale și la distanță (din locația releu); activați-le pe cele care ar trebui să primească fiecare versiune. Dispozitivele fără o parolă de dezvoltator salvată afișează <strong>🔒 Setează parola</strong> pentru a valida una pe loc. Dispozitivele vizate anterior care se deconectează rămân listate (dezactivate) și se realătură automat când devin din nou accesibile.</li>
          `,
    sideloadRelayPointHtml: `<strong>Îndreptați IDE-ul către RDS.</strong> Cu releul activat, RDS este descoperibil prin SSDP ca <em>„Roku Dev Studio Relay”</em> sau puteți seta gazda de build direct la adresa IP a acestui computer. La <em>Sideload</em> / <em>Debug: Launch</em>, IDE-ul încarcă în RDS pe portul <code>80</code>, iar RDS gestionează distribuția. La adresa releului este servită și o pagină web de încărcare tematizată (<code>http://&lt;this-machine&gt;/</code>) pentru încărcări <code>.zip</code> prin glisare și fixare dintr-un browser.`,
    sideloadRelayAutoConnectHtml: `<strong>Conectare automată.</strong> Când o versiune ajunge cu succes pe o țintă, RDS deschide acel dispozitiv ca o filă conectată și atașează automat consola sa de depanare, astfel încât să vedeți ieșirea pentru fiecare dispozitiv fără clicuri suplimentare. Progresul distribuției în timp real este transmis și ca o consolă de stare pe portul telnet <code>8085</code>.`,
    sideloadRelaySourceApprovalHtml: `<strong>Aprobarea sursei.</strong> Un sideload provenit de la acest computer se desfășoară automat. Un sideload de la un alt computer reține încărcarea și afișează o solicitare de permitere/refuzare pe gazda RDS (refuză automat după 30 s); încărcările din browser de la un computer la distanță necesită în plus autentificarea cu Parola de dezvoltator releu.`,
    sideloadRelayFooterHtml: `Necesită ca dispozitivele vizate să aibă Modul dezvoltator activat. Consultați <strong>Locații la distanță</strong> de mai sus pentru a viza dispozitive dintr-un alt sediu printr-un server releu.`,

    tipsHeading: 'Sfaturi',
    tipDeveloperModeHtml: `Activați Modul dezvoltator pe Roku: Mergeți la Acasă, apăsați <span class="help-kbd">Home</span> de 3x, <span class="help-kbd">↑</span> de 2x, <span class="help-kbd">→</span> <span class="help-kbd">←</span> <span class="help-kbd">→</span> <span class="help-kbd">←</span> <span class="help-kbd">→</span>`,
    tipMacosHtml: `<strong>macOS:</strong> închiderea ferestrei principale închide aplicația (sesiunile telnet și MCP sunt oprite). Folosiți <em>Roku Dev Studio → Ieșire</em> sau <span class="help-kbd">Cmd</span>+<span class="help-kbd">Q</span> — aplicația nu rămâne în dock fără ferestre.`,
    tipWindowsLinuxHtml: `<strong>Windows / Linux:</strong> folosiți meniul din bara de titlu (☰) pentru Setări, Mod confidențialitate și Despre; butoanele de minimizare/maximizare/închidere a ferestrei se află pe marginea dreaptă a barei de titlu.`,
    tipMultipleDevices: 'Mai multe dispozitive pot fi conectate simultan — fiecare primește propria filă',
    tipClickCard: 'Faceți clic pe cardul unui dispozitiv conectat pentru a comuta la fila acestuia',
    tipRightClick: 'Faceți clic dreapta pe cardurile dispozitivelor pentru a copia informațiile despre dispozitiv',
    tipRemoteLocations: 'Locațiile la distanță vă permit să controlați dispozitive fără acces fizic',
  },
};
