/**
 * UI strings for the SceneGraph / node Inspector (App Connector / RALE tab):
 * connection status, the Response card, the Execute Function dropdown, the
 * Update Node modal, and the roRegistry builtin param editors.
 *
 * Parametrized strings are functions returning the composed text — the standard
 * way to keep interpolation translatable without a runtime format library.
 * Protocol identifiers (RALE command names, node/field types) are passed in as
 * arguments rather than baked into the catalog.
 */
export const inspector = {
  // Reused generic status / errors (Inspector-scoped variants)
  notConnected: 'Not connected',
  commandFailed: 'Command failed',
  noResponseFromDevice: 'No response from device',

  // Connection flow (Connect/Disconnect, status line, Dev App preflight)
  connectingBtn: 'Connecting...',
  connectingStatus: '🟡 Connecting...',
  reconnectingStatus: '🟡 Reconnecting...',
  connectedBang: 'Connected!',
  checkingDevApp: 'Checking if Dev App is active...',
  couldNotVerifyDevAppQuery:
    'Could not verify Dev App status. The active-app query failed (network / ECP / developer mode?).',
  couldNotVerifyDevApp: 'Could not verify Dev App status.',
  checkConnectionHint: 'Check the device connection and developer mode, then try Connect again.',
  statusCheckFailed: 'Status Check Failed',
  devAppNotRunning:
    'Dev App is not running on the Roku device. Please launch the sideloaded Dev App first.',
  launchDevAppHint: 'Go to the Dev App tab and click "Launch" to start your sideloaded channel.',
  devAppNotActive: 'Dev App Not Active',
  wakingUpTrackerTask: (port: number): string => `Waking up TrackerTask on port ${port}...`,
  failedToConnect: 'Failed to connect',

  // Response card (index.ts)
  findInResponse: 'Find in Response',
  saveResponseTitle: 'Save Response',
  failedAutoFetchFunctions: 'Failed to auto-fetch functions. Click Refresh to try again.',
  refreshing: (command: string): string => `Refreshing ${command}…`,

  // Function selector / dropdown (function-selector.ts)
  connectToLoadFunctions: '-- Connect to load functions --',
  selectAFunction: '-- Select a function --',
  selectFunctionForParamDetails: 'Select a function to see parameter details',
  appConnectorFunctions: 'App Connector Functions',
  raleFunctions: 'RALE Functions',
  noFunctionsImplement: 'No functions — implement GetExternalControlFunctions',
  readyToExecute: 'Ready to execute',
  functionCounts: (appCount: number, raleCount: number): string =>
    `${appCount} App Function(s), ${raleCount} RALE command(s)`,

  // Function execution (function-execution.ts)
  sending: (command: string): string => `Sending ${command}...`,
  executing: (selection: string): string => `Executing ${selection}...`,
  fetchingFunctions: 'Fetching available functions...',
  foundFunctions: (n: number): string => `Found ${n} function(s)`,
  noFunctionsReturned: 'No functions returned',
  getExternalControlFunctionsReturnedFalse:
    'getExternalControlFunctions returned false — make sure the SceneGraph scene implements this function',
  failedToFetchFunctions: 'Failed to fetch functions',
  selectFunctionToExecute: 'Please select a function to execute',
  functionExecutionFailed: 'Function execution failed',
  unknownRaleBuiltin: 'Unknown RALE Builtin',
  unhandledRaleBuiltin: (command: string): string => `Unhandled RALE builtin: ${command}`,

  // RALE path parsing (node-lookup.ts)
  pathMustBeJsonArray: 'Path must be a JSON array (e.g. [] or [{"child":0}])',
  invalidPathJson: (detail: string): string => `Invalid path JSON: ${detail}`,

  // Update Node modal (node-update-panel.ts)
  noNodeContext: 'No node context — run Get Node by ID first.',
  fieldNameRequired: 'Field name is required.',
  selectingNode: 'Selecting node…',
  removingField: 'Removing field…',
  addingField: 'Adding field…',
  updatingField: 'Updating field…',
  removedField: (name: string): string => `Removed field "${name}".`,
  addedField: (name: string): string => `Added field "${name}".`,
  updatedField: (name: string): string => `Updated field "${name}".`,
  removeFieldBtn: 'Remove Field',
  addFieldBtn: 'Add Field',
  updateFieldBtn: 'Update Field',
  valueLabel: 'Value',
  newValueLabel: 'New Value',
  addValuePlaceholder:
    'Initial Value for the New Field (Scalars, true/false, JSON for Arrays / Object)',
  updateValuePlaceholder: 'Scalars, true/false, JSON for Arrays / Vectors / Objects',

  // Update Node — value parse errors (parseValueForRaleFieldType)
  parseBoolean: 'boolean: use true or false',
  parseInteger: 'integer: invalid number',
  parseFloat: 'float: invalid number',
  parseColor: 'color: use integer (e.g. -16777216)',
  parseVector2d: 'vector2d: at least two elements, e.g. [0,0]',
  parseRect2d: 'rect2d: four elements, e.g. [0,0,100,100]',
  parseArray: 'array: invalid JSON array',
  parseAssocArray: 'assocarray: JSON object required',
  jsonArrayRequired: (type: string): string => `${type}: JSON array required`,
  invalidJsonArray: (type: string): string => `${type}: invalid JSON array`,

  // Registry builtin param editors (registry-params-ui.ts)
  unexpectedRegistryResponse: 'Unexpected registry response',
  loadingRegistry: 'Loading registry…',
  selectSection: '— Select section —',
  noSections: '(no sections)',
  selectKey: '— Select key —',
  noKeys: '(no keys)',
  ariaSectionToRemove: 'Section to remove',
  ariaSection: 'Section',
  ariaKey: 'Key',
  ariaKeyToReplace: 'Key to replace',
  removeSectionHint: 'Sections loaded from the device. Execute removes the selected section.',
  fieldKeyPlaceholder: 'Field Key',
  stringValuePlaceholder: 'String Value',
  newKeyPlaceholder: 'New Key',
  newValuePlaceholder: 'New Value',

  // Registry client-side validation (registry-validation.ts)
  sectionNameRequired: 'Section name is required.',
  sectionMustBeJsonObject: 'Section must be a JSON object (not an array).',
  sectionKeysNotEmpty: 'Section object keys cannot be empty or whitespace-only.',
  eachValueMustBeString: (key: string): string =>
    `Each value must be a string (roRegistry stores strings). Key "${key}" is not a string — use quoted strings in JSON.`,
  selectSectionFromList: 'Select a section from the list.',
  selectKeyFromList: 'Select a key from the list.',
  enterFieldKey: 'Enter a field key.',

  // Parameter inputs (parameter-inputs.ts)
  noParamsRequired: '✓ No parameters required',
  selectFunctionForParams: 'Select a function to see parameters',
  booleanPlaceholder: 'true or false',
  stringPlaceholder: 'Enter text...',

  // Execute Function dropdown — RALE builtin labels (rale-builtins.ts)
  getNodeByIdLabel: 'Get Node by ID',
  getNodeByNameLabel: 'Get Node by SubType (component class)',
  getRegistrySectionsLabel: '[Registry] Get All Sections',
  clearRegistryLabel: '[Registry] Clear All Sections',
  addRegistrySectionLabel: '[Registry] Add/Update Section',
  removeRegistrySectionLabel: '[Registry] Remove Section',
  addRegistryFieldLabel: '[Registry] Set Section Key',
  removeRegistryFieldLabel: '[Registry] Remove Section Key',
  editRegistryFieldLabel: '[Registry] Edit Section Key',

  // Execute Function dropdown — RALE builtin descriptions (hint text)
  getNodeByIdDesc:
    'RALE getNodeById — depth-first search under path; id matches the node id field. Path [] = scene root.',
  getNodeByNameDesc:
    'RALE getNodeByName — name is node.subtype() (XML component class), e.g. Label, RowList. Path [] = scene root.',
  getRegistrySectionsDesc:
    'RALE getRegistrySections — read all roRegistry sections and keys (returns nested object by section name).',
  clearRegistryDesc:
    'RALE clearRegistry — deletes every registry section on the device (destructive).',
  addRegistrySectionDesc:
    'RALE addRegistrySection — args.name = section name; args.section = JSON object of string key/value pairs.',
  removeRegistrySectionDesc:
    'RALE removeRegistrySection — deletes one section. Sections load from the device; after success, registry is refreshed.',
  addRegistryFieldDesc:
    'RALE addRegistryField — set a string value for a key under a section. Section list loads from the device.',
  removeRegistryFieldDesc:
    'RALE removeRegistryField — delete one key. Pick section and key from lists loaded from the device.',
  editRegistryFieldDesc:
    'RALE editRegistryField — pick section and key, then enter newKey and newValue. Lists load from the device.',
} as const;
