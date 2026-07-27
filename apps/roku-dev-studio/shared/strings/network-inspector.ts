/**
 * UI strings for the Network Inspector — the live capture tab (network-tab.ts), its modals
 * (traffic rules, find-in-content, hotspot setup, port conflict, large-body info, filter help),
 * and the detail renderers shared with the standalone Session Viewer.
 *
 * Parametrized strings are functions returning the composed text (the standard way to keep
 * interpolation translatable without a runtime format library). Some values intentionally embed
 * HTML markup (<strong>, <code>, <kbd>, <em>, <button>) because they're injected via innerHTML.
 */
export const networkInspector = {
  // Section identity (used as a title prefix for the shared URL / structured viewers).
  titlePrefix: 'Network Inspector',

  // ── Shared detail pane chrome (network-detail-view.ts) ──────────────────────────────
  emptyDetail: 'Select a session to inspect request and response.',
  request: 'Request',
  response: 'Response',
  tabOverview: 'Overview',
  tabBody: 'Body',
  tabHeaders: 'Headers',
  copyRequestBody: 'Copy request body',
  copyResponseBody: 'Copy response body',
  moreCopyOptions: 'More copy options',
  copyBody: 'Copy Body',
  copyAsCurl: 'Copy as cURL',
  copyAsHar: 'Copy as HAR',
  bodyTruncated: 'Body Truncated',
  bodyTruncatedRequestTitle:
    "The captured copy of this body exceeded the inspector's display cap, so what's shown here is incomplete. The full body was still delivered upstream. Use Copy for the captured portion.",
  bodyTruncatedResponseTitle:
    "The captured copy of this body exceeded the inspector's display cap, so what's shown here is incomplete. The full body was still delivered to the Roku. Use Copy for the captured portion.",
  disableWordWrap: 'Disable word wrap',
  enableWordWrap: 'Enable word wrap',
  toggleWordWrap: 'Toggle word wrap',
  formatLabel: 'Format',
  formatAuto: 'Auto',
  formatJson: 'JSON',
  formatXml: 'XML',
  formatRaw: 'Raw',
  whyRawText: 'Why is this shown as raw text?',

  // ── Session list rows (network-session-view.ts) ─────────────────────────────────────
  noMatchingSessions: 'No matching sessions.',
  noHostsYet: 'No hosts yet. Structure groups traffic by hostname.',
  sslDecryptedTitle: 'Decrypted (MITM)',
  sslEncryptedTitle: 'HTTPS (Encrypted)',
  sessionNumber: (n: number): string => `Session #${n}`,
  requestNumber: (n: number): string => `Request #${n}`,
  expandAllGroups: 'Expand all groups',
  collapseAllGroups: 'Collapse all groups',

  // ── Session-list derived tokens (network-sessions.ts) ───────────────────────────────
  // Duration column value while a transaction is still open (distinct from statusPending
  // below — has a trailing ellipsis and is the duration cell, not the status pill).
  durationPending: 'Pending…',
  // Status-pill tokens for the session list. Kept SEPARATE from the overview statusPending:
  // statusClass()/the status filter compare against session.status, so these must stay
  // byte-identical to the values eventToSession() assigns.
  listStatusPending: 'Pending',
  listStatusQuery: 'Query',
  listStatusOk: 'OK',
  listStatusOpen: 'Open',
  // DNS structure-tree leaf / sidebar path labels.
  dnsQueryLabel: 'DNS Query',
  dnsResponseLabel: 'DNS Response',

  // ── Detail renderers (network-detail.ts) ────────────────────────────────────────────
  // Synthetic first-row header of the response Headers table (HTTP/RFC start-line term).
  statusLine: 'Status-Line',
  noHeaders: '(no headers)',
  noRequestBody: '(no request body)',
  noResponseBody: '(no response body)',
  emptyResponseBody: '(empty response body)',
  waitingForResponse: '(waiting for response…)',
  encryptedNoHeaders: '(encrypted — no headers)',
  dnsNoHeaders: '(DNS — no HTTP headers)',
  dnsAnswerEmpty: '(empty)',
  dnsPending: '(Pending)',
  noResponseBodyCaptured: '(no response body captured)',
  httpsResponseEncrypted: 'HTTPS response body is encrypted. Enable the MITM proxy to inspect bodies here.',
  // Media-preview fallbacks + captions.
  mimeContent: 'content',
  mimeBinary: 'binary',
  mimeUnknownType: 'unknown type',
  responseImageAlt: 'Response image preview',
  binaryTruncatedNote: (mime: string): string =>
    `Binary ${mime} was truncated during capture — preview unavailable. Use Copy for the captured base64.`,
  binaryNotPreviewable: (mime: string, size: string): string =>
    `Binary content (${mime}, ~${size}) — not previewable. Use Copy for the captured base64.`,
  // Overview: request Status row values (display-only; distinct from the session-list status tokens).
  statusPending: 'Pending',
  statusComplete: 'Complete',
  statusFailed: 'Failed',
  // Overview: row + section labels.
  ovType: 'Type',
  ovTime: 'Time',
  ovDevice: 'Device',
  ovHost: 'Host',
  ovDestination: 'Destination',
  ovUrl: 'URL',
  ovStatus: 'Status',
  ovResponseCode: 'Response Code',
  ovProtocol: 'Protocol',
  ovMethod: 'Method',
  requestContentType: 'Request Content-Type',
  responseContentType: 'Response Content-Type',
  ovClientAddress: 'Client Address',
  ovRemoteAddress: 'Remote Address',
  ovTags: 'Tags',
  ovDns: 'DNS',
  ovNotes: 'Notes',
  ovRequestStart: 'Request Start',
  ovTotal: 'Total',
  secTls: 'TLS',
  secTiming: 'Timing',
  secSize: 'Size',
  viewUrlTitle: 'View URL and Query Parameters',
  tagsMitmDecrypted: 'MITM · Decrypted',
  protocolHttpsDecrypted: 'HTTPS (decrypted via Roku Dev Studio MITM proxy)',
  protocolHttpsEncrypted: 'HTTPS (Encrypted)',
  notesProxied: 'Proxied request — upstream TLS terminated at Roku Dev Studio',
  notesHotspot: 'Hotspot capture — bodies not available without MITM',
  typeHttpsTlsHandshake: 'HTTPS (TLS handshake)',
  unknownHost: 'unknown-host',
  dnsQueryValue: (host: string): string => `Query ${host}`,
  dnsBody: (isQuery: boolean, host: string): string => `DNS ${isQuery ? 'Query' : 'Response'}: ${host}`,
  httpsRequestFallback: (host: string, port: string): string =>
    `CONNECT ${host}${port} (HTTPS — encrypted)\n\nHotspot capture only sees the TLS handshake (SNI + IP), not JSON bodies.\n\nEnable MITM in Settings and route the channel through Roku Dev Studio to inspect bodies.`,

  // ── Embedded JSON/XML fragment highlight (network-embedded-structured.ts) ────────────
  embeddedViewTitle: (label: string): string => `Click to view formatted ${label} (opens in a modal)`,

  // ── Hotspot Capture Setup modal (hotspot-setup-modal.ts) ─────────────────────────────
  setupPacketCapture: 'Setup Packet Capture',
  requestingCaptureAccess: 'Requesting capture access…',
  captureAccessGranted: 'Capture access granted.',
  setupCancelled: 'Setup was cancelled.',
  setupFailed: 'Setup failed.',
  setupFailedRetry: 'Setup failed — please try again.',

  // ── Filter-syntax help modal (network-filter-help.ts) ────────────────────────────────
  filterHelpHeading: 'Filtering Sessions',
  filterHelpAria: 'Filter Help',
  addToFilter: 'Add to Filter',
  filterDescHost: 'Match the hostname (substring).',
  filterDescMethod: 'HTTP method.',
  filterDescStatus: 'Status code, or a class like 4xx / 5xx.',
  filterDescType: 'Response Content-Type (alias content-type:).',
  filterDescKind: 'Session kind.',
  filterDescPath: 'URL path (substring; alias url:).',
  filterHelpIntro:
    'Type free text to match host, path, method, status, kind, or Content-Type. Use <code>field:value</code> for precise matches, and separate terms with <strong>commas</strong> to match <strong>any</strong> of them (OR).',
  filterHelpNoteLead: 'Example: ',
  filterHelpNoteExplain:
    ' shows any session on roku.com <em>or</em> with a 4xx status <em>or</em> using POST. Click any example to add it.',

  // ── Port-conflict modal (port-conflict-modal.ts) ─────────────────────────────────────
  holderAnotherApp: 'Another app',
  holderWithPid: (name: string, pid: number): string => `${name} (PID ${pid})`,
  holderPidOnly: (pid: number): string => `PID ${pid}`,
  portResolvedTitle: 'Proxy Port Available',
  portResolvedMsg:
    'The proxy port is free again — Network Inspector can capture traffic. This message closes automatically.',
  recheckStatus: 'Re-check Status',
  openNetworkInspectorSettings: 'Open Network Inspector Settings',

  // ── Traffic-rules modal (traffic-rules-modal.ts) ─────────────────────────────────────
  trafficRules: 'Traffic Rules',
  deviceFallbackName: 'Roku device',
  serialTitle: (serial: string): string => `Serial ${serial}`,
  rulesNote:
    'Applies only to traffic this device routes through the Roku Dev Studio proxy — its other (unproxied) traffic is unaffected. Changes take effect immediately.',
  deviceTrafficTitle: 'Device Traffic',
  blockAllTitle: 'Block All Proxied Traffic',
  blockAllDesc: 'Reject every request routed through the proxy.',
  bandwidthLimit: 'Bandwidth Limit',
  addedLatency: 'Added Latency',
  addedLatencyMsTitle: 'Added Latency (ms)',
  hostsBlockedNote: "Per-host rules don't apply while all proxied traffic is blocked.",
  perHostRules: 'Per-Host Rules',
  addHostTitle:
    'Host, or host/path. Use * as a wildcard (e.g. *.example.com matches prod + staging, /v1/* matches any path under /v1/).',
  noRulesYet: 'No rules yet — add a host or path above to override its behavior.',
  saveChanges: 'Save Changes',
  restartToSave: 'Restart Roku Dev Studio to enable saving Traffic Rules.',
  failedSaveRules: 'Failed to save Traffic Rules.',
  // Rewrite op type labels (dropdown options).
  rwRedirectHost: 'Redirect Host',
  rwSetPath: 'Set Path',
  rwSetQuery: 'Set Query Param',
  rwRemoveQuery: 'Remove Query Param',
  rwSetHeader: 'Set Header',
  rwRemoveHeader: 'Remove Header',
  rwBodyReplace: 'Replace in Body',
  rwSetStatus: 'Set Status',
  // Rewrite op field placeholders.
  rwHeaderName: 'Header Name',
  rwValue: 'Value',
  rwStatusCode: 'Status Code (e.g. 503)',
  rwHostOrHostPort: 'host or host:port',
  rwNewPath: '/new/path',
  rwParamName: 'Param Name',
  rwFind: 'Find',
  rwReplaceWith: 'Replace with',
  // Rewrite op row chrome.
  rewriteTargetAria: 'Rewrite target',
  rewriteTypeAria: 'Rewrite type',
  regexTreatTitle: 'Treat Find as a Regular Expression',
  regexLabel: 'Regex',
  removeRewrite: 'Remove rewrite',
  rewriteTitle: 'Rewrite',
  rewriteHint: 'Applied when forwarding (not with Block / Reset / Mock)',
  addRewrite: '+ Add Rewrite',
  // Per-host rule scope badges.
  scopeWildcardPath: 'Wildcard Path',
  scopeSinglePath: 'Single Path',
  scopeWildcardHost: 'Wildcard Host',
  scopeAllRequests: 'All Requests',
  // Per-host rule controls.
  collapseExpandRule: 'Collapse / expand rule',
  editUrl: 'Edit URL',
  editInterceptUrlAria: 'Edit intercept URL',
  deleteRule: 'Delete rule',
  block: 'Block',
  resetTitle: 'Drop the connection (simulate a network failure)',
  mock: 'Mock',
  mockTitle: 'Return a canned response instead of forwarding upstream',
  latencyPlaceholder: 'Latency',
  mockFieldStatus: 'Status',
  mockFieldContentType: 'Content-Type',
  mockFieldDelay: 'Delay',
  httpStatusCodeTitle: 'HTTP Status Code',
  delayTitle: 'Delay Before Responding (ms)',
  mockBodyPlaceholder: 'Response Body (e.g. {&quot;error&quot;:&quot;forced&quot;})',
  // Bandwidth preset/label/placeholder for the "no cap" option (kbps 0). The other presets
  // ('8 Mbps', '512 kbps', …) are units and stay verbatim in BW_OPTIONS. NOTE: parseBandwidth()
  // still matches the lowercased literal 'unlimited', so keep this word round-trippable.
  bandwidthUnlimited: 'Unlimited',
  bwCustomTitle: 'Pick a preset or type a custom limit (e.g. 3 Mbps or 1500 kbps)',
  bwPresetsAria: 'Show bandwidth presets',
  throttleCapSpeed: (limit: string): string => `speed is capped to the Device Limit (${limit})`,
  throttleFloorLatency: (ms: number): string => `latency is floored to the Device Latency (${ms} ms)`,
  throttleNote: (parts: string[]): string => `Per-Host ${parts.join(', and ')}.`,

  // ── Find-in-content modal (network-find-modal.ts) ────────────────────────────────────
  chipUrl: 'URL',
  chipRequest: 'Request Body',
  chipResponse: 'Response Body',
  chipHeaders: 'Headers',
  chipUrlTitle: 'Request URL, Hostname and SNI',
  chipRequestTitle: 'Request Payload',
  chipResponseTitle: 'Response Payload',
  chipHeadersTitle: 'Request and Response Headers',
  noMatches: 'No matches',
  requestCount: (n: number): string => `${n} request${n === 1 ? '' : 's'}`,
  hitCount: (n: number): string => ` · ${n} hit${n === 1 ? '' : 's'}`,
  setColorAria: (c: string): string => `Set color ${c}`,
  customColorTitle: 'Custom Color…',
  customColorAria: 'Custom color',
  hexColorAria: 'Hex color',
  changeColorTitle: 'Change Color',
  changeColorAria: 'Change term color',
  findPlaceholder: 'Find',
  searchTermAria: 'Search term',
  clearText: 'Clear text',
  matchCase: 'Match Case',
  useRegexTitle: 'Use Regular Expression',
  deleteSearchEntry: 'Delete search entry',
  regexLikeHint: 'This looks like a regular expression.',
  useRegexBtn: 'Use Regex',
  findAriaLabel: 'Find in Network Traffic',
  findTitle: 'Find in Traffic',
  closeEsc: 'Close (Esc)',
  addSearchEntryTitle: 'Add another Search entry',
  addSearchEntry: '+ Search More…',
  noteColor: "Each term gets a color; a request shows every matching term's color.",
  noteWhitespace: 'Whitespace is ignored — minified and pretty-printed bodies both match.',
  noteBinary: "Binary (base64) bodies aren't searched.",
  noteEnter: 'Press <kbd>Enter</kbd> to jump to the first match and close.',
  noteShiftEnter: (max: number): string =>
    `<kbd>Shift</kbd>+<kbd>Enter</kbd> adds another term (up to ${max}).`,
  noteArrows: '<kbd>Shift</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> (or the header arrows) move between matches.',

  // ── Live tab (network-tab.ts) ────────────────────────────────────────────────────────
  capNotice: (shown: number, total: number): string =>
    `Showing the latest ${shown} of ${total} sessions — use the filter to narrow results.`,
  loadingData: 'Loading captured data…',
  // Large-body "shown as raw text" explainer modal.
  shownAsRawText: 'Shown as Raw Text',
  thisBody: 'This body',
  largeBodyIntro: (sizeLabel: string, limitKb: string): string =>
    `This body is <strong>${sizeLabel}</strong> — larger than the ${limitKb} KB limit for rendering a collapsible, syntax-highlighted JSON/XML tree. To keep the inspector responsive, the <strong>entire</strong> body is shown as raw text instead. Nothing is truncated or hidden.`,
  largeBodyNote:
    'Copy, Save, and Find still operate on the full body. Embedded JSON/XML fragments remain clickable. Select a smaller response to see the formatted tree.',
  // Empty-state hints.
  noProxiedSessions: 'No proxied sessions yet.',
  noSessions: 'No sessions yet.',
  proxyAddrFallback: 'machine-ip:8888',
  gatewayAddrFallback: 'gateway:8888',
  anotherApp: 'another app',
  mitmActiveLine: (addr: string): string =>
    `MITM proxy is active at <strong>${addr}</strong> — route your Dev channel's requests through it to capture them.`,
  mitmPortConflictLine: (port: number, who: string): string =>
    `MITM proxy can't use port ${port} — ${who} is using it. Click <strong>Proxy Port Unavailable</strong> above to close it or change the port.`,
  mitmFailedLine: (err: string): string => `MITM proxy failed to start: ${err}.`,
  mitmStarting: 'MITM proxy is starting — relaunch Roku Dev Studio if this persists.',
  enableMitmSettings: 'Enable <strong>MITM proxy</strong> in Settings → Network Inspector.',
  hotspotBlockedMitmLine: (addr: string): string =>
    `Hotspot capture is blocked, but the MITM proxy at <strong>${addr}</strong> can still record proxied requests. Use <code>host:port</code> only in BrightScript (e.g. <code>192.168.2.1:8888</code>), not the device IP and not <code>http://</code>.`,
  mitmActiveNoCaptureLine: (addr: string): string =>
    `MITM proxy is active at <code class="ni-hint-code">${addr}</code>. Route your dev channel through it to capture Network Requests.`,
  mitmDecryptingHint: ' MITM proxy is decrypting dev-channel HTTPS routed through Roku Dev Studio.',
  hotspotEncryptedHint: ' HTTPS bodies are encrypted in hotspot capture mode — enable MITM in Settings for Dev channels.',
  capturingOnHotspot: 'Capturing on Hotspot. Browse or play content on the Roku.',
  connectWifiHint:
    'Connect the Roku to the same Wi‑Fi (or your machine hotspot), then enable the <strong>MITM proxy</strong> in Settings → Network Inspector to capture dev-channel HTTPS.',
  sessionListAria: 'Network session list. Use arrow keys to navigate.',
  // Layout toggle.
  layoutToggleTitle: (stacked: boolean): string =>
    `Request and Response Panes - ${stacked ? 'Side by Side' : 'Stack Vertically'}`,
  // "Proxied" filter tooltips.
  proxiedLockedTitle:
    'All traffic is proxied through Roku Dev Studio in this mode, so this is always on. This control will be enabled when the Roku device is connected through the hotspot.',
  proxiedUnlockedTitle:
    'Show only requests proxied through Roku Dev Studio (full headers + body), hiding hotspot-capture SNI/DNS metadata',
  // Media context menu + save dialogs.
  copyImage: 'Copy Image',
  saveImageAs: 'Save Image As…',
  saveFile: 'Save File…',
  saveImageDialog: 'Save Image',
  saveFileDialog: 'Save File',
  // Export toasts + dialogs.
  fileFallback: 'file',
  savedPackets: (n: number, path: string): string =>
    `Saved ${n} packet${n === 1 ? '' : 's'} to ${path}.`,
  failedSavePcap: 'Failed to save packet capture.',
  noRequestsToExport: 'No requests to export.',
  noHttpToExport: 'No HTTP transactions to export as HAR.',
  exportHarDialog: 'Export Sessions as HAR',
  exportSessionDialog: 'Export Network Session',
  // Native save-dialog titles + filter names (main/ipc/network-inspector-handlers.ts).
  exportDialogTitles: {
    savePcap: 'Save Packet Capture',
    pcapFilter: 'Wireshark PCAP',
    caPem: 'Export RDS CA certificate (PEM)',
    pemFilter: 'PEM certificate',
    caCrt: 'Export RDS CA certificate (CRT)',
    certFilter: 'Certificate'
  },
  exportedRequests: (n: number, path: string): string =>
    `Exported ${n} request${n === 1 ? '' : 's'} to ${path}.`,
  failedExportSession: 'Failed to export session.',
  // Session count tooltips.
  countMatchingTitle: (visible: number, captured: number): string =>
    `${visible} matching of ${captured} captured sessions`,
  capturedSessionsTitle: (n: number): string =>
    n === 1 ? '1 captured session' : `${n} captured sessions`,
  // Capture-button "blocked" tooltips.
  issuePortInUse: (port: number, who: string): string =>
    `Network Inspector unavailable — port ${port} is in use${who}.`,
  issueMitm: (err: string): string => `Network Inspector issue — MITM proxy: ${err}`,
  captureErrorFallback: 'Network Inspector error',
  stopCapturing: 'Stop Capturing',
  startCapturing: 'Start Capturing',
  setupNotAvailable: 'Setup is not available in this build.',
  // Header setup badge.
  captureBlocked: 'Capture Blocked',
  captureSetup: 'Capture Setup',
  setupBadgeTitlePrereq: (title: string): string => `${title} — click for setup instructions`,
  setupBadgeTitle: 'Hotspot Capture Setup — click for instructions',
  // Header port badge.
  portBadgeTitle: (title: string): string => `${title} — click for details`,

  // ══ Network Inspector additions ═══════════════════════════════════════════════
  // Copy URL action (network-detail-view.ts copy menu).
  copyUrl: 'Copy URL',

  // Traffic-rule presets — device-wide toggles (traffic-rules-modal.ts).
  noCachingTitle: 'No Caching',
  noCachingDesc: 'Strip caching headers and force Cache-Control: no-store on responses.',
  blockCookiesTitle: 'Block Cookies',
  blockCookiesDesc: 'Strip Cookie from requests and Set-Cookie from responses.',

  // Parsed detail viewer — response Cookies tab (network-detail.ts, network-parsed-tables.ts).
  tabCookies: 'Cookies',
  colName: 'Name',
  colValue: 'Value',
  colAttributes: 'Attributes',
  noResponseCookies: 'No cookies set by this response.',

  // Editable per-request note (network-detail.ts Overview + list marker).
  secNote: 'Note',
  notePlaceholder: 'Add a note…',
  noteAriaLabel: 'Note for this request',
  noteMarkerAria: 'Has a note',

  // Map Local — file-backed mock response (traffic-rules-modal.ts + proxy).
  mockFieldFile: 'Local File',
  mockChooseFile: 'Choose File…',
  mockFilePlaceholder: 'No file chosen',
  mockFileClearAria: 'Clear mapped file',
  mockFileServingBody: 'Response body is served from the mapped file.',
  mapLocalHint:
    'Serve a local file as the response body. Content-Type is inferred from the file extension unless set above.',
  mapLocalDialogTitle: 'Choose a File to Serve',
  mapLocalAllFilesFilter: 'All Files',

  // Focus hosts (network-session-view.ts + right-click context menu).
  focusHost: (host: string): string => `Focus ${host}`,
  unfocusHost: (host: string): string => `Unfocus ${host}`,
  clearFocusedHosts: 'Clear Focused Hosts',

  // Replay / Compose (network-detail-view.ts action + network-compose-modal.ts).
  replay: 'Replay',
  replayTitle: 'Replay this request from the host',
  replayAria: 'Replay request',
  moreReplayOptions: 'More replay options',
  replayNow: 'Replay Now',
  composeItem: 'Edit & Resend…',
  composeTitle: 'Edit & Resend',
  composeNote: 'Re-issue this request from the host. Edit the method, URL, headers, or body before sending.',
  composeMethodLabel: 'Method',
  composeUrlLabel: 'URL',
  // Editable query-params / headers tables (name/value rows) in the Compose modal.
  composeParamsLabel: 'Query Parameters',
  composeAddRow: '+ Add',
  composeRowEnabledAria: 'Include this entry',
  composeSelectAllAria: 'Toggle all entries',
  composeHeadersLabel: 'Headers',
  composeBodyLabel: 'Body',
  composeBodyPlaceholder: 'Request body',
  composeBinaryBodyNote:
    "The captured request body is binary and is sent unchanged; it can't be edited here.",
  composeApplyRules: 'Apply active traffic rules',
  composeApplyRulesTitle: "Run the replay through this device's block, rewrite, and throttle rules",
  composeSend: 'Send',
  composeSending: 'Sending…',
  replayAddedToList: 'Response added to the session list.',
  replayFailed: (err: string): string => `Replay failed: ${err}`,
  replayInvalidUrl: 'Enter a valid http:// or https:// URL.',
  replayUnavailable: 'Replay is not available in this build.',
  replayStarting: 'Replaying…',
  tagsReplayed: 'Replayed',
  replayedBadgeTitle: 'This response was produced by replaying a captured request from the host',

  // Timing waterfall (network-detail.ts Overview timing section).
  ovDuration: 'Duration',
  wfDns: 'DNS',
  wfConnect: 'Connect',
  wfTls: 'TLS',
  wfSend: 'Send',
  wfWait: 'Wait (TTFB)',
  wfReceive: 'Download',
  wfMs: (n: number): string => `${n} ms`,
  wfSeconds: (s: number): string => `${s.toFixed(2)} s`,
  wfSegmentTitle: (label: string, value: string): string => `${label}: ${value}`,
  wfAria: 'Request timing breakdown'
} as const;
