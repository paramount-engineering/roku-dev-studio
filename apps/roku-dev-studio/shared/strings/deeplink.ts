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
  enterAppId: 'Please enter an App ID',
  launchedSuccess: '✓ Deep-Link launched successfully',
  savedAndLaunched: '✓ Saved and launched Deep-Link',
  failedToSave: 'Failed to save Deep-Link',
  savedNotFound: 'Saved Deep-Link was not found.',
  savedDeleted: 'Saved Deep-Link deleted.',

  // Deep-link error formatting (deeplink-panel.ts)
  devAppNotSideloaded:
    'Dev App is not sideloaded on this device. Open the Dev App tab, sideload your channel, then try again.',
  channelNotFound: (appId: string): string =>
    `Channel "${appId}" was not found on this device. Sideload or install the app first, or pick a valid App ID from List apps.`,
  ecpAccessDenied: 'ECP access was denied on this device.',
  deepLinkFailed: 'Deep-Link failed.',
  deepLinkFailedDetail: (detail: string): string => `Deep-Link failed: ${detail}`,

  // Saved-preset picker + save modal (deeplink-presets.ts)
  savedPresetPlaceholder: '-- Select Saved Deep-Link --',
  enterPresetName: 'Enter a name for this saved Deep-Link.',
  appIdRequired: 'App ID is required.',

  // Built-in media-type display labels (deeplink-media-types.ts).
  // Paired in code with their protocol values ('movie', 'series', …) which stay put.
  mediaTypeMovie: 'Movie',
  mediaTypeSeries: 'Series',
  mediaTypeEpisode: 'Episode',
  mediaTypeLive: 'Live',

  // Media-types manager (deeplink-media-types.ts)
  mediaTypePlaceholder: '-- Select --',
  noCustomMediaTypes: 'No custom media types yet.',
  editDisplayNameLabel: 'Display Name',
  editEcpValueLabel: 'ECP Value',
  editAria: (label: string): string => `Edit ${label}`,
  deleteAria: (label: string): string => `Delete ${label}`,

  // Media-type validation errors
  enterDisplayName: 'Enter a display name.',
  enterEcpValue: 'Enter an ECP value.',
  valueFormat: 'Value must start with a letter and use only letters, numbers, hyphens, or underscores.',
  builtInConflict: (label: string): string => `"${label}" is already a built-in media type.`,
  valueExists: 'A media type with this value already exists.',
  nameExists: 'A media type with this name already exists.',

  // Delete-media-type-with-linked-presets confirmation lead
  mediaTypeInUse: (label: string, count: number): string =>
    count === 1
      ? `"${label}" is used by 1 saved Deep-Link and cannot be removed until you decide what to do with it.`
      : `"${label}" is used by ${count} saved Deep-Links and cannot be removed until you decide what to do with them.`,
} as const;
