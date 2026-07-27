/**
 * Ukrainian (uk) translation of the Deep-Link panel, saved-preset picker, and
 * media-types manager strings. Sibling of ../deeplink.ts — same `deeplink`
 * shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. "Deep-Link"
 * stays verbatim; only literal display text is translated.
 */
export const deeplink = {
  // Launch validation + status (deeplink-panel.ts)
  enterAppId: 'Введіть App ID',
  launchedSuccess: '✓ Deep-Link успішно запущено',
  savedAndLaunched: '✓ Deep-Link збережено та запущено',
  failedToSave: 'Не вдалося зберегти Deep-Link',
  savedNotFound: 'Збережений Deep-Link не знайдено.',
  savedDeleted: 'Збережений Deep-Link видалено.',

  // Deep-link error formatting (deeplink-panel.ts)
  devAppNotSideloaded:
    'Dev App не завантажено на цей пристрій. Відкрийте вкладку Dev App, завантажте свій канал, потім спробуйте знову.',
  channelNotFound: (appId: string): string =>
    `Канал «${appId}» не знайдено на цьому пристрої. Спочатку завантажте або встановіть застосунок, або виберіть дійсний App ID зі списку застосунків.`,
  ecpAccessDenied: 'Доступ ECP на цьому пристрої заборонено.',
  deepLinkFailed: 'Не вдалося виконати Deep-Link.',
  deepLinkFailedDetail: (detail: string): string => `Не вдалося виконати Deep-Link: ${detail}`,

  // Saved-preset picker + save modal (deeplink-presets.ts)
  savedPresetPlaceholder: '-- Виберіть збережений Deep-Link --',
  enterPresetName: 'Введіть назву для цього збереженого Deep-Link.',
  appIdRequired: 'App ID є обовʼязковим.',

  // Built-in media-type display labels (deeplink-media-types.ts).
  // Paired in code with their protocol values ('movie', 'series', …) which stay put.
  mediaTypeMovie: 'Фільм',
  mediaTypeSeries: 'Серіал',
  mediaTypeEpisode: 'Епізод',
  mediaTypeLive: 'Наживо',

  // Media-types manager (deeplink-media-types.ts)
  mediaTypePlaceholder: '-- Виберіть --',
  noCustomMediaTypes: 'Власних типів медіа ще немає.',
  editDisplayNameLabel: 'Відображуване імʼя',
  editEcpValueLabel: 'Значення ECP',
  editAria: (label: string): string => `Редагувати ${label}`,
  deleteAria: (label: string): string => `Видалити ${label}`,

  // Media-type validation errors
  enterDisplayName: 'Введіть відображуване імʼя.',
  enterEcpValue: 'Введіть значення ECP.',
  valueFormat: 'Значення має починатися з літери й містити лише літери, цифри, дефіси або підкреслення.',
  builtInConflict: (label: string): string => `«${label}» уже є вбудованим типом медіа.`,
  valueExists: 'Тип медіа з таким значенням уже існує.',
  nameExists: 'Тип медіа з такою назвою вже існує.',

  // Delete-media-type-with-linked-presets confirmation lead
  mediaTypeInUse: (label: string, count: number): string =>
    count === 1
      ? `«${label}» використовується 1 збереженим Deep-Link, і його не можна вилучити, доки ви не вирішите, що з ним робити.`
      : `«${label}» використовується ${count} збереженими Deep-Link, і його не можна вилучити, доки ви не вирішите, що з ними робити.`,
};
