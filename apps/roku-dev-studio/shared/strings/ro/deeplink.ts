/**
 * Romanian (ro) translation of the Deep-Link panel, saved-preset picker, and
 * media-types manager strings. Sibling of ../deeplink.ts — same `deeplink`
 * shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. "Deep-Link"
 * stays verbatim; count-driven text uses the Romanian singular/plural + "de"
 * rule. Only literal display text is translated.
 */
export const deeplink = {
  // Launch validation + status (deeplink-panel.ts)
  enterAppId: 'Introdu un App ID',
  launchedSuccess: '✓ Deep-Link lansat cu succes',
  savedAndLaunched: '✓ Deep-Link salvat și lansat',
  failedToSave: 'Salvarea Deep-Link-ului a eșuat',
  savedNotFound: 'Deep-Link-ul salvat nu a fost găsit.',
  savedDeleted: 'Deep-Link-ul salvat a fost șters.',

  // Deep-link error formatting (deeplink-panel.ts)
  devAppNotSideloaded:
    'Dev App nu este încărcat pe acest dispozitiv. Deschide fila Dev App, încarcă-ți canalul, apoi încearcă din nou.',
  channelNotFound: (appId: string): string =>
    `Canalul „${appId}” nu a fost găsit pe acest dispozitiv. Încarcă sau instalează mai întâi aplicația ori alege un App ID valid din lista de aplicații.`,
  ecpAccessDenied: 'Accesul ECP a fost refuzat pe acest dispozitiv.',
  deepLinkFailed: 'Deep-Link eșuat.',
  deepLinkFailedDetail: (detail: string): string => `Deep-Link eșuat: ${detail}`,

  // Saved-preset picker + save modal (deeplink-presets.ts)
  savedPresetPlaceholder: '-- Selectează un Deep-Link salvat --',
  enterPresetName: 'Introdu un nume pentru acest Deep-Link salvat.',
  appIdRequired: 'App ID este obligatoriu.',

  // Built-in media-type display labels (deeplink-media-types.ts).
  // Paired in code with their protocol values ('movie', 'series', …) which stay put.
  mediaTypeMovie: 'Film',
  mediaTypeSeries: 'Serial',
  mediaTypeEpisode: 'Episod',
  mediaTypeLive: 'În direct',

  // Media-types manager (deeplink-media-types.ts)
  mediaTypePlaceholder: '-- Selectează --',
  noCustomMediaTypes: 'Încă nu există tipuri media personalizate.',
  editDisplayNameLabel: 'Nume afișat',
  editEcpValueLabel: 'Valoare ECP',
  editAria: (label: string): string => `Editează ${label}`,
  deleteAria: (label: string): string => `Șterge ${label}`,

  // Media-type validation errors
  enterDisplayName: 'Introdu un nume afișat.',
  enterEcpValue: 'Introdu o valoare ECP.',
  valueFormat: 'Valoarea trebuie să înceapă cu o literă și să folosească doar litere, cifre, cratime sau liniuțe de subliniere.',
  builtInConflict: (label: string): string => `„${label}” este deja un tip media integrat.`,
  valueExists: 'Există deja un tip media cu această valoare.',
  nameExists: 'Există deja un tip media cu acest nume.',

  // Delete-media-type-with-linked-presets confirmation lead
  mediaTypeInUse: (label: string, count: number): string =>
    count === 1
      ? `„${label}” este folosit de 1 Deep-Link salvat și nu poate fi eliminat până nu decizi ce să faci cu el.`
      : `„${label}” este folosit de ${count}${count % 100 === 0 || count % 100 >= 20 ? ' de' : ''} Deep-Link-uri salvate și nu poate fi eliminat până nu decizi ce să faci cu ele.`,
};
