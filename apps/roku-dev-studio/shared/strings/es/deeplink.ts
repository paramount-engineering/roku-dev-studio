/**
 * Latin American Spanish (neutral) translation of the Deep-Link panel, saved-preset
 * picker, and media-types manager strings. Sibling of ../deeplink.ts — same
 * `deeplink` shape, keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. "Deep-Link"
 * stays verbatim; only literal display text is translated.
 */
export const deeplink = {
  // Launch validation + status (deeplink-panel.ts)
  enterAppId: 'Ingrese un App ID',
  launchedSuccess: '✓ Deep-Link iniciado correctamente',
  savedAndLaunched: '✓ Deep-Link guardado e iniciado',
  failedToSave: 'Error al guardar el Deep-Link',
  savedNotFound: 'No se encontró el Deep-Link guardado.',
  savedDeleted: 'Deep-Link guardado eliminado.',

  // Deep-link error formatting (deeplink-panel.ts)
  devAppNotSideloaded:
    'La Dev App no está cargada con sideload en este dispositivo. Abra la pestaña Dev App, haga sideload de su canal y luego intente de nuevo.',
  channelNotFound: (appId: string): string =>
    `No se encontró el canal "${appId}" en este dispositivo. Haga sideload o instale la app primero, o elija un App ID válido en Listar apps.`,
  ecpAccessDenied: 'Se denegó el acceso ECP en este dispositivo.',
  deepLinkFailed: 'El Deep-Link falló.',
  deepLinkFailedDetail: (detail: string): string => `El Deep-Link falló: ${detail}`,

  // Saved-preset picker + save modal (deeplink-presets.ts)
  savedPresetPlaceholder: '-- Seleccione un Deep-Link guardado --',
  enterPresetName: 'Ingrese un nombre para este Deep-Link guardado.',
  appIdRequired: 'El App ID es obligatorio.',

  // Built-in media-type display labels (deeplink-media-types.ts). Kept in English in every locale —
  // they name Roku ECP content types (paired with the protocol values 'movie'/'series'/… which also
  // stay put); only the placeholder below is localized. Same policy as the Roku query presets.
  mediaTypeMovie: 'Movie',
  mediaTypeSeries: 'Series',
  mediaTypeEpisode: 'Episode',
  mediaTypeLive: 'Live',

  // Media-types manager (deeplink-media-types.ts)
  mediaTypePlaceholder: '-- Seleccione --',
  noCustomMediaTypes: 'Aún no hay tipos de medios personalizados.',
  editDisplayNameLabel: 'Nombre para mostrar',
  editEcpValueLabel: 'Valor ECP',
  editAria: (label: string): string => `Editar ${label}`,
  deleteAria: (label: string): string => `Eliminar ${label}`,

  // Media-type validation errors
  enterDisplayName: 'Ingrese un nombre para mostrar.',
  enterEcpValue: 'Ingrese un valor ECP.',
  valueFormat: 'El valor debe comenzar con una letra y usar solo letras, números, guiones o guiones bajos.',
  builtInConflict: (label: string): string => `"${label}" ya es un tipo de medios integrado.`,
  valueExists: 'Ya existe un tipo de medios con este valor.',
  nameExists: 'Ya existe un tipo de medios con este nombre.',

  // Delete-media-type-with-linked-presets confirmation lead
  mediaTypeInUse: (label: string, count: number): string =>
    count === 1
      ? `"${label}" es usado por 1 Deep-Link guardado y no se puede eliminar hasta que decida qué hacer con él.`
      : `"${label}" es usado por ${count} Deep-Links guardados y no se puede eliminar hasta que decida qué hacer con ellos.`,
};
