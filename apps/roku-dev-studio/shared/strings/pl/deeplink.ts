/**
 * Polish (pl) translation of the Deep-Link panel, saved-preset picker, and
 * media-types manager strings. Sibling of ../deeplink.ts — same `deeplink`
 * shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. "Deep-Link"
 * stays verbatim; count-driven text uses the Polish 3-form plural. Only literal
 * display text is translated.
 */
export const deeplink = {
  // Launch validation + status (deeplink-panel.ts)
  enterAppId: 'Wprowadź App ID',
  launchedSuccess: '✓ Pomyślnie uruchomiono Deep-Link',
  savedAndLaunched: '✓ Zapisano i uruchomiono Deep-Link',
  failedToSave: 'Nie udało się zapisać Deep-Link',
  savedNotFound: 'Nie znaleziono zapisanego Deep-Link.',
  savedDeleted: 'Usunięto zapisany Deep-Link.',

  // Deep-link error formatting (deeplink-panel.ts)
  devAppNotSideloaded:
    'Dev App nie jest wgrana na to urządzenie. Otwórz kartę Dev App, wgraj swój kanał, a następnie spróbuj ponownie.',
  channelNotFound: (appId: string): string =>
    `Nie znaleziono kanału „${appId}” na tym urządzeniu. Najpierw wgraj lub zainstaluj aplikację albo wybierz prawidłowy App ID z listy aplikacji.`,
  ecpAccessDenied: 'Odmówiono dostępu ECP na tym urządzeniu.',
  deepLinkFailed: 'Deep-Link nie powiódł się.',
  deepLinkFailedDetail: (detail: string): string => `Deep-Link nie powiódł się: ${detail}`,

  // Saved-preset picker + save modal (deeplink-presets.ts)
  savedPresetPlaceholder: '-- Wybierz zapisany Deep-Link --',
  enterPresetName: 'Wprowadź nazwę dla tego zapisanego Deep-Link.',
  appIdRequired: 'App ID jest wymagany.',

  // Built-in media-type display labels (deeplink-media-types.ts).
  // Paired in code with their protocol values ('movie', 'series', …) which stay put.
  mediaTypeMovie: 'Film',
  mediaTypeSeries: 'Serial',
  mediaTypeEpisode: 'Odcinek',
  mediaTypeLive: 'Na żywo',

  // Media-types manager (deeplink-media-types.ts)
  mediaTypePlaceholder: '-- Wybierz --',
  noCustomMediaTypes: 'Brak własnych typów multimediów.',
  editDisplayNameLabel: 'Wyświetlana nazwa',
  editEcpValueLabel: 'Wartość ECP',
  editAria: (label: string): string => `Edytuj ${label}`,
  deleteAria: (label: string): string => `Usuń ${label}`,

  // Media-type validation errors
  enterDisplayName: 'Wprowadź wyświetlaną nazwę.',
  enterEcpValue: 'Wprowadź wartość ECP.',
  valueFormat: 'Wartość musi zaczynać się od litery i zawierać tylko litery, cyfry, myślniki lub podkreślenia.',
  builtInConflict: (label: string): string => `„${label}” jest już wbudowanym typem multimediów.`,
  valueExists: 'Typ multimediów o tej wartości już istnieje.',
  nameExists: 'Typ multimediów o tej nazwie już istnieje.',

  // Delete-media-type-with-linked-presets confirmation lead
  mediaTypeInUse: (label: string, count: number): string =>
    count === 1
      ? `„${label}” jest używany przez 1 zapisany Deep-Link i nie można go usunąć, dopóki nie zdecydujesz, co z nim zrobić.`
      : count % 10 >= 2 && count % 10 <= 4 && !(count % 100 >= 12 && count % 100 <= 14)
      ? `„${label}” jest używany przez ${count} zapisane Deep-Link i nie można go usunąć, dopóki nie zdecydujesz, co z nimi zrobić.`
      : `„${label}” jest używany przez ${count} zapisanych Deep-Link i nie można go usunąć, dopóki nie zdecydujesz, co z nimi zrobić.`,
};
