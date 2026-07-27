/**
 * UI strings for the per-device Deep-Link panel, the saved-preset picker, and the
 * global Deep-Link media-types manager (renderer/modules/deeplink/*).
 *
 * Parametrized strings are functions returning the composed text — the standard way
 * to keep interpolation translatable without a runtime format library.
 *
 * NOTE: Roku ECP media-type *values* ('movie', 'series', …) and preset parameter
 * tokens (appId / contentId / mediaType) are PROTOCOL/DATA and intentionally live in
 * code, not here. Only the human-readable display labels/descriptions are catalogued.
 */
export const deeplink = {
  // Launch validation + status (deeplink-panel.ts)
  enterAppId: 'Insira um App ID',
  launchedSuccess: '✓ Deep-Link iniciado com sucesso',
  savedAndLaunched: '✓ Deep-Link salvo e iniciado',
  failedToSave: 'Falha ao salvar o Deep-Link',
  savedNotFound: 'O Deep-Link salvo não foi encontrado.',
  savedDeleted: 'Deep-Link salvo excluído.',

  // Deep-link error formatting (deeplink-panel.ts)
  devAppNotSideloaded:
    'O Dev App não foi carregado via sideload neste dispositivo. Abra a aba Dev App, faça o sideload do seu canal e tente novamente.',
  channelNotFound: (appId: string): string =>
    `O canal "${appId}" não foi encontrado neste dispositivo. Faça o sideload ou instale o app primeiro, ou escolha um App ID válido em Listar apps.`,
  ecpAccessDenied: 'O acesso ECP foi negado neste dispositivo.',
  deepLinkFailed: 'Falha no Deep-Link.',
  deepLinkFailedDetail: (detail: string): string => `Falha no Deep-Link: ${detail}`,

  // Saved-preset picker + save modal (deeplink-presets.ts)
  savedPresetPlaceholder: '-- Selecionar Deep-Link salvo --',
  enterPresetName: 'Insira um nome para este Deep-Link salvo.',
  appIdRequired: 'O App ID é obrigatório.',

  // Built-in media-type display labels (deeplink-media-types.ts).
  // Paired in code with their protocol values ('movie', 'series', …) which stay put.
  mediaTypeMovie: 'Filme',
  mediaTypeSeries: 'Série',
  mediaTypeEpisode: 'Episódio',
  mediaTypeLive: 'Ao vivo',

  // Media-types manager (deeplink-media-types.ts)
  mediaTypePlaceholder: '-- Selecionar --',
  noCustomMediaTypes: 'Nenhum tipo de mídia personalizado ainda.',
  editDisplayNameLabel: 'Nome de exibição',
  editEcpValueLabel: 'Valor ECP',
  editAria: (label: string): string => `Editar ${label}`,
  deleteAria: (label: string): string => `Excluir ${label}`,

  // Media-type validation errors
  enterDisplayName: 'Insira um nome de exibição.',
  enterEcpValue: 'Insira um valor ECP.',
  valueFormat: 'O valor deve começar com uma letra e usar apenas letras, números, hifens ou sublinhados.',
  builtInConflict: (label: string): string => `"${label}" já é um tipo de mídia integrado.`,
  valueExists: 'Já existe um tipo de mídia com este valor.',
  nameExists: 'Já existe um tipo de mídia com este nome.',

  // Delete-media-type-with-linked-presets confirmation lead
  mediaTypeInUse: (label: string, count: number): string =>
    count === 1
      ? `"${label}" é usado por 1 Deep-Link salvo e não pode ser removido até você decidir o que fazer com ele.`
      : `"${label}" é usado por ${count} Deep-Links salvos e não pode ser removido até você decidir o que fazer com eles.`,
};
