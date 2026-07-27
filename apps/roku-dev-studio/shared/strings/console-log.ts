/**
 * UI strings for the Console log surfaces: the shared find/filter bar (live telnet Console +
 * standalone Log Viewer), the formatted JSON/XML and URL viewer modals, the Console Monitor
 * (analytics) modal, and the structured-syntax fold controls.
 *
 * Parametrized strings are functions returning the composed text — the standard way to keep
 * interpolation translatable without a runtime format library. A few values are consumed inside
 * `innerHTML` templates (the modal shells), so they render as plain text just as any other leaf.
 */
export const consoleLog = {
  // ── Shared viewer modal chrome (console-modal-title.ts, structured + URL modals) ──────
  /** Default title prefix for the JSON/XML/URL viewer modals ("Console: JSON"). */
  titlePrefix: 'Console',
  jsonLabel: 'JSON',
  xmlLabel: 'XML',
  jsonPlusLabel: 'JSON+',
  urlLabel: 'URL',
  /** Transient button feedback after copying (plain text, no glyph — distinct from common.copied). */
  copied: 'Copied',

  // ── Fold twisty (console-structured-syntax.ts) ────────────────────────────────────────
  collapse: 'Collapse',
  expand: 'Expand',

  // ── Structured JSON/XML viewer modal (console-structured-view-modal.ts) ───────────────
  copyFormattedTitle: 'Copy Formatted Text',
  hintJsonFullNested: 'Click to view the full JSON for this line. Use JSON+ for nested fragments only.',
  hintJsonFormatted: 'Click to view formatted JSON (opens in a modal)',
  hintXmlFull: 'Click to view the full XML for this line.',
  hintXmlFormatted: 'Click to view formatted XML (opens in a modal)',
  hintPillNestedJson: 'Nested JSON only (from an escaped string). Does not open the full outer JSON.',
  hintPillFullJson: 'Full JSON for this line (click the line text for the same).',

  // ── URL viewer modal (console-url-modal.ts) ───────────────────────────────────────────
  openInBrowser: 'Open in Browser',
  openInBrowserTitle: 'Open in Default Browser',
  copyUrlTitle: 'Copy URL',
  fullUrlAria: 'Full URL',
  queryParamsAria: 'Query Parameters',
  colKey: 'Key',
  colValue: 'Value',
  couldNotParseParams: 'Could not parse parameters.',
  noQueryParams: 'No query parameters.',
  parameterSet: (n: number): string => `Parameter Set ${n}`,

  // ── Inline URL span (console-url-detect.ts) ───────────────────────────────────────────
  urlSpanTitle: 'Click to preview in a Modal · ⌘ or Ctrl+Click to open in Browser',

  // ── Find/filter bar markup (console-find-bar-markup.ts) ───────────────────────────────
  modeSelectAria: 'Find or filter mode',
  modeFind: 'Find',
  modeFilter: 'Filter',
  queryPlaceholder: 'Find...',
  queryAria: 'Find or filter query',
  // Option-button tooltips: `alt` appends the (Alt+…) shortcut hint the main window binds.
  // The aria-label reuses the same text with `alt=false` (no shortcut suffix).
  optMatchCaseTitle: (alt: boolean): string => `Match Case${alt ? ' (Alt+C)' : ''}`,
  optWholeWordTitle: (alt: boolean): string => `Match Whole Word${alt ? ' (Alt+W)' : ''}`,
  optRegexTitle: (alt: boolean): string => `Use Regular Expression${alt ? ' (Alt+R)' : ''}`,
  prevTitle: 'Previous (Shift+Enter)',
  prevAria: 'Previous Match',
  nextTitle: 'Next (Enter)',
  nextAria: 'Next Match',
  clearAria: 'Clear find',

  // ── Find/filter bar runtime (console-find-bar.ts) ─────────────────────────────────────
  regexSuggestTitle: 'This looks like a regular expression — click to search by regex',
  searchingPct: (pct: number): string => `Searching... ${pct}%`,
  noResults: 'No Results',
  matchPosition: (current: number, total: number): string => `${current} of ${total}`,
  firstMatchesNote: ' (First Matches)',
  highlightsCappedNote: ' (Highlights Capped)',
  searchingSuffix: (pct: number): string => ` (searching ${pct}%)`,
  searchingRemote: 'Searching…',
  filteringRemote: 'Filtering…',
  searchFailed: 'Search failed',
  filterFailed: 'Filter failed',
  linesMatched: (n: number, capped: boolean): string =>
    `${n.toLocaleString()} lines${capped ? ' (capped)' : ''}`,

  // ── Console Monitor / analytics modal (console-analytics-modal.ts) ────────────────────
  monitorTitle: 'Console Monitor',
  noRecognizedIssues: 'No recognized BrightScript issues. 🎉',
  sectionCrashes: 'Crashes',
  sectionIssues: 'Issues',
  labelWhat: 'What',
  labelCause: 'Cause',
  labelFix: 'Fix',
  docsLink: 'docs ↗',
  copyMessageTitle: 'Copy Message',
  copyMessageAria: 'Copy Error Message',
  goToLineTitle: 'Go to this line in the log',
  goToCrashTitle: 'Go to this crash in the log',
  copyCrashTitle: 'Copy Crash + Backtrace',
  copyCrashAria: 'Copy Crash and Backtrace',
  backtraceHead: 'Backtrace',
  noBacktrace:
    'The channel exited from a BrightScript crash; no backtrace was captured in this console output.',
  crashKindLabel: 'Crash',
  // Crash severity badge (rendered uppercase via CSS; kept lowercase to mirror the data-driven
  // severity tokens on the non-crash issue badges).
  severityCrash: 'crash',
  // Crash card annotations: "exited" badge and inline "runtime error <code>" (both lowercase; the
  // badge is uppercased by CSS, the code annotation reads inline).
  exitedLabel: 'exited',
  exitedTitle: 'The channel process exited',
  runtimeErrorLabel: 'runtime error',
  crashCount: (n: number): string => `${n.toLocaleString()} crash${n === 1 ? '' : 'es'}`,
  issuesAcrossLines: (issues: number, lines: number): string =>
    `${issues.toLocaleString()} issue${issues === 1 ? '' : 's'} across ${lines.toLocaleString()} line${lines === 1 ? '' : 's'}`,
  spillNote: (total: number): string =>
    `(of ${total.toLocaleString()} captured — older lines spilled to disk aren't scanned)`,
  occurrences: (n: number): string => `Occurrence${n === 1 ? '' : 's'}`,
  moreUniqueLines: (n: number): string =>
    `+${n.toLocaleString()} more unique line${n === 1 ? '' : 's'}`,

  // ── BrightScript error catalog (brightscript-error-catalog.ts) ────────────────────────
  // Localizable copy for each catalog entry, keyed by the entry `id`. English text is copied
  // VERBATIM from the catalog; the analytics modal prefers these and falls back to the entry
  // fields for any id not present here. BrightScript/Roku technical tokens are kept as-is.
  errors: {
    'type-mismatch': {
      title: 'Type mismatch',
      meaning: 'An operator was applied to values of incompatible types.',
      cause: 'Comparing or combining mismatched types (e.g. String vs Integer), or an uninitialized variable treated as the wrong type.',
      fix: 'Convert with Str()/Val()/ToStr() so both operands share a type. Roku OS 10.5+ names the operator and both types in the message.',
    },
    'dot-on-invalid': {
      title: '"Dot" operator on invalid object',
      meaning: 'Used `.` to read a member/field on a value that is invalid or not a component/interface.',
      cause: 'The object was never created or a lookup returned invalid — e.g. `m.top.findNode("x").text` where findNode returned invalid.',
      fix: 'Null-check before dotting (`if node <> invalid`); confirm the object exists and the member name is correct.',
    },
    'for-each-non-enumerable': {
      title: 'FOR EACH on a non-enumerable value',
      meaning: '`for each` was run over a value that is invalid or is not an enumerable object.',
      cause: 'Iterating a function result that returned invalid (a missing AA key, an empty GetChildElements()/GetBody()), or a scalar/node.',
      fix: 'Null/type-check before the loop; only enumerate roArray, roList, roAssociativeArray, or roMessagePort (types with ifEnum).',
    },
    'call-on-non-function': {
      title: 'Call operator ( ) on a non-function',
      meaning: 'Code tried to invoke `()` on a value that is not a function.',
      cause: 'A variable shadowed a function, the name is misspelled/undeclared, or the value is invalid/data rather than a function.',
      fix: 'Verify the identifier is a defined function; check for name collisions and invalid values before calling.',
    },
    'uninitialized-variable': {
      title: 'Use of uninitialized variable',
      meaning: 'A variable was read before it was ever assigned a value.',
      cause: 'A misspelled variable name, a variable declared only in another scope, or a conditional path that skipped the assignment.',
      fix: 'Initialize before use; check spelling and scope; the debugger shows such locals as `<uninitialized>`.',
    },
    'uninitialized-function-ref': {
      title: 'Uninitialized function reference',
      meaning: 'Called through a function variable that holds no function.',
      cause: 'A function pointer was never assigned, or was set to invalid.',
      fix: 'Assign a valid function reference before invoking it.',
    },
    'invalid-left-side': {
      title: 'Invalid left-side of expression',
      meaning: 'The target of an assignment is not something that can be assigned to.',
      cause: 'Assigning to a literal or expression instead of a variable or object field.',
      fix: 'Assign only to a variable or an object field.',
    },
    'divide-by-zero': {
      title: 'Divide by zero',
      meaning: 'A division or MOD used a zero denominator at runtime.',
      cause: 'A divisor variable evaluated to 0 (or to invalid, coerced to 0).',
      fix: 'Guard denominators before dividing (`if d <> 0`).',
    },
    'array-out-of-bounds': {
      title: 'Array subscript out of bounds',
      meaning: 'Read or wrote past the end of (or a negative index into) an array.',
      cause: 'Off-by-one loop bounds; indexing an empty or shorter array.',
      fix: 'Check `arr.count()` before indexing; validate loop bounds.',
    },
    'array-not-dimd': {
      title: "Array operation on a variable not DIM'd",
      meaning: 'Indexed a variable that was never created as an array.',
      cause: 'Using `[]` on a scalar or on invalid.',
      fix: 'Initialize the array (`arr = []`) before indexing it.',
    },
    'non-numeric-array-index': {
      title: 'Non-numeric array index',
      meaning: 'Used a string/object as an index into an roArray.',
      cause: 'Confusing an roArray with an roAssociativeArray.',
      fix: 'Use an AA for string keys, or a numeric index for arrays.',
    },
    'invalid-num-array-indexes': {
      title: 'Invalid number of array indexes',
      meaning: 'Wrong dimensionality was used to index an array.',
      cause: 'Using `a[i,j]` on a 1-D array (or vice-versa).',
      fix: "Match the index count to the array's declared dimensions.",
    },
    'wrong-num-params': {
      title: 'Wrong number of function parameters',
      meaning: 'A function was called with too few or too many arguments.',
      cause: 'A changed signature, or an optional parameter with no default.',
      fix: 'Match the call to the signature; give optional parameters defaults.',
    },
    'bad-throw': {
      title: 'Invalid throw argument',
      meaning: 'A `throw` was given something other than a string or a valid error AA.',
      cause: 'Throwing a number/object that lacks valid `number`/`message` fields.',
      fix: 'Throw a string, or an AA with Integer `number` and String `message` fields.',
    },
    'user-thrown-exception': {
      title: 'Uncaught user exception (THROW)',
      meaning: 'A `throw` propagated to the top without being caught, ending the script.',
      cause: 'A `throw "…"` (or `throw {message: …}`) with no surrounding `try/catch` to handle it.',
      fix: 'Wrap the throwing call in `try/catch` (Roku OS 9.4+) and inspect `e.number`/`e.message`/`e.backtrace`.',
    },
    'invalid-format-specifier': {
      title: 'Invalid format specifier',
      meaning: 'A bad specifier was passed to a format function.',
      cause: 'A malformed Format()/printf-style token.',
      fix: 'Correct the format string.',
    },
    'invalid-param': {
      title: 'Invalid parameter passed to function/array',
      meaning: 'A built-in got an out-of-domain argument (e.g. sqrt of a negative, a negative dimension).',
      cause: 'A bad math domain or a negative array dimension.',
      fix: 'Validate arguments before the call.',
    },
    'member-fn-not-found': {
      title: 'Member function not found',
      meaning: 'Called a method that the component or interface does not expose.',
      cause: 'A misspelled method name, calling on invalid, the wrong component type, or a method missing on that firmware version.',
      fix: 'Confirm the method exists for that object/OS; guard invalid objects before calling.',
    },
    'interface-not-member': {
      title: 'Interface not a member of component',
      meaning: 'Requested an interface the component does not implement.',
      cause: 'A GetInterface() call for an interface the object lacks, or the wrong interface name.',
      fix: 'Use an interface the component actually exposes.',
    },
    'component-class-not-found': {
      title: 'Component / node class not found',
      meaning: 'CreateObject / createChild used a class or node type that does not exist.',
      cause: 'A misspelled or wrong-case type string, or a component not declared/registered in the package.',
      fix: 'Fix the type string (case-sensitive); ensure the component XML is included in the channel.',
    },
    'sg-field-type-mismatch': {
      title: 'SceneGraph field type mismatch',
      meaning: "A value assigned to a node field did not match the field's declared type.",
      cause: 'Assigning e.g. a String to an int/uri field, or an Array to an assocarray field via setField/addReplace.',
      fix: "Assign a value matching the field's declared interface type, or fix the field type in the component XML.",
    },
    'sg-nonexistent-field': {
      title: 'Set nonexistent SceneGraph field',
      meaning: 'Assigned to a node field that the node type does not declare (silently ignored).',
      cause: 'A misspelled field name, or a field not defined in the component XML `<interface>`.',
      fix: 'Use a declared field name (case-sensitive), or add the field to the component XML interface.',
    },
    'component-call-arg-count': {
      title: 'Component call has wrong parameter count',
      meaning: 'A built-in component method was called with the wrong number of arguments.',
      cause: 'An argument count that does not match the ifXXX method signature.',
      fix: 'Match the documented method signature.',
    },
    'rendezvous-aborted': {
      title: 'Rendezvous aborted',
      meaning: 'A cross-thread node access failed because the target node was invalid or gone.',
      cause: 'Accessing a node owned by another thread that was destroyed or stalled (e.g. a global node lost after long playback).',
      fix: 'Avoid cross-thread node churn; null-check before access; profile with `logrendezvous` / `sgperf`.',
    },
    'rendezvous-block': {
      title: 'SceneGraph rendezvous (thread blocking)',
      meaning: 'A render-thread ↔ task-thread sync point; frequent ones stall the render thread.',
      cause: 'A Task thread reading/writing render-thread node fields one at a time.',
      fix: 'Batch field access with getFields/setFields; minimize cross-thread node access.',
    },
    'execution-timeout': {
      title: 'Execution timeout (script ran too long)',
      meaning: 'Code ran too long on a thread (the render thread has a multi-second limit).',
      cause: 'Heavy loops, large JSON parsing, or synchronous I/O on the render or a Task thread.',
      fix: 'Move heavy work to a Task node; chunk or async the work.',
    },
    'too-many-task-threads': {
      title: 'Too many task threads',
      meaning: 'Exceeded the limit of concurrent Task threads.',
      cause: 'Creating Task nodes in a loop without reuse or cleanup.',
      fix: 'Reuse/pool Task nodes; limit concurrency; let tasks finish.',
    },
    'wait-on-non-port': {
      title: 'Wait on an object without a message port',
      meaning: '`wait()` was called on an object that lacks ifMessagePort.',
      cause: 'Waiting on the wrong object instead of an roMessagePort.',
      fix: 'Wait only on an roMessagePort.',
    },
    'formatjson-nested': {
      title: 'FormatJSON nested/cyclic reference',
      meaning: 'FormatJSON failed on a circular reference or nesting deeper than 256 levels.',
      cause: 'A cyclic object graph, or an unsupported value type (e.g. an roList) in the tree.',
      fix: 'Break reference cycles; keep nesting under 256; only serialize supported types (AA, array, string, number, boolean).',
    },
    'parsejson-failed': {
      title: 'ParseJSON failed',
      meaning: 'ParseJSON could not parse the input string (it returns invalid).',
      cause: 'Empty/whitespace input (e.g. an empty HTTP response body), malformed JSON, or a non-string arg.',
      fix: 'Guard for empty/invalid input before ParseJSON; verify the source (check the HTTP body/length first).',
    },
    'file-write-failed': {
      title: 'File write failed',
      meaning: 'A file could not be opened for writing (WriteAsciiFile / roCreateFile).',
      cause: 'Writing outside a writable location — only `tmp:/` and `cachefs:/` are writable (`pkg:/` is read-only) — or a missing directory / full disk.',
      fix: 'Write only to `tmp:/` or `cachefs:/`; make sure the parent path exists.',
    },
    'stack-overflow': {
      title: 'Stack overflow',
      meaning: 'The call stack was exhausted.',
      cause: 'Unbounded or very deep recursion (Roku overflows after ~31 nested calls).',
      fix: 'Add a base case; convert deep recursion to iteration.',
    },
    'out-of-memory': {
      title: 'Out of memory',
      meaning: 'A memory allocation failed; the heap is exhausted.',
      cause: 'Large data structures, leaks, or retained nodes/textures; huge string builds in a loop.',
      fix: 'Release references, reduce data size, reuse nodes; stream/chunk large string work.',
    },
    'string-too-long': {
      title: 'String too long',
      meaning: 'A string exceeded the maximum length.',
      cause: 'Concatenating unbounded input.',
      fix: 'Cap or split the string length.',
    },
    'syntax-error': {
      title: 'Syntax error',
      meaning: 'The source failed to compile.',
      cause: 'Typos, unbalanced blocks, or bad tokens.',
      fix: 'Fix the syntax at the reported line/column; compile locally before sideloading.',
    },
    'compile-error-generic': {
      title: 'Compile error',
      meaning: 'The compiler rejected one or more lines before the app ran.',
      cause: 'A typo, a missing keyword, or a malformed expression.',
      fix: 'Fix each reported `line N:` in the named file.',
    },
    'unterminated-block': {
      title: 'Unterminated block',
      meaning: 'A control block (FOR/NEXT, IF/ENDIF, WHILE/ENDWHILE) is missing its closing keyword.',
      cause: 'A missing or mismatched `end if` / `next` / `end while`.',
      fix: 'Balance each block-open keyword with its matching close.',
    },
    'xml-parse-error': {
      title: 'XML component parse error',
      meaning: 'A SceneGraph XML component file failed to parse or has a defect.',
      cause: 'Malformed markup, a bad tag, or a bad field/interface/script reference in the component.',
      fix: 'Validate the .xml markup and fix the component definition.',
    },
    'no-manifest': {
      title: 'No manifest — invalid package',
      meaning: 'The sideloaded zip lacks a valid manifest.',
      cause: 'The manifest is missing or not at the archive root.',
      fix: 'Put a valid `manifest` file at the root of the zip.',
    },
    'unused-variable': {
      title: 'Unused variable',
      meaning: 'A declared variable — often a function or event-handler parameter — is never used.',
      cause: "A handler parameter (`msg`/`event`/`field`) or local the function body never references.",
      fix: 'Remove it if genuinely unused; it is harmless to ship. Required callback-signature parameters can be left as-is.',
    },
    'brightscript-warning': {
      title: 'BrightScript warning',
      meaning: 'The BrightScript compiler emitted a non-fatal warning.',
      cause: 'A lint-level issue (unused code, a deprecated pattern) that does not stop execution.',
      fix: 'Review the named function/file — warnings are safe to run but often flag dead code or mistakes.',
    },
    'http-unsupported-protocol': {
      title: 'Unsupported protocol (-1)',
      meaning: 'The URL scheme is not supported by the transfer.',
      cause: 'A malformed URL or wrong scheme.',
      fix: 'Use a supported http(s):// URL.',
    },
    'http-resolve-host': {
      title: "Couldn't resolve host (-6)",
      meaning: 'DNS resolution of the request host failed.',
      cause: 'A bad hostname, no network, or a DNS outage.',
      fix: 'Verify the URL/host and network connectivity.',
    },
    'http-connect': {
      title: "Couldn't connect (-7)",
      meaning: 'The TCP connection to the host/proxy failed.',
      cause: 'Server down, wrong port, or a firewall.',
      fix: 'Check the endpoint/port availability.',
    },
    'http-timeout': {
      title: 'HTTP request timed out (-28)',
      meaning: 'The request exceeded its timeout.',
      cause: 'A slow or unreachable server, or too small a timeout.',
      fix: 'Increase the timeout; retry; check the server.',
    },
    'http-ssl-peer': {
      title: 'SSL peer verification failed (-51)',
      meaning: "The server's TLS certificate did not validate.",
      cause: 'An expired, self-signed, or mismatched certificate.',
      fix: 'Fix the cert chain; only disable EnablePeerVerification(false) for testing.',
    },
    'http-ca-cert': {
      title: 'CA cert file bad/missing (-77)',
      meaning: 'The CA bundle could not be loaded.',
      cause: 'A missing or incorrect SetCertificatesFile path.',
      fix: 'Set `common:/certs/ca-bundle.crt` and call InitClientCertificates().',
    },
    'deploy-update-check-required': {
      title: 'Device needs to check for updates',
      meaning: 'The device refuses connections until it checks for a system update.',
      cause: 'Pending Roku firmware update-check.',
      fix: 'On the device: Settings → System → System update → Check now.',
    },
    'deploy-unauthorized': {
      title: 'Unauthorized (bad dev password)',
      meaning: 'The dev server rejected the credentials.',
      cause: 'A wrong developer password, or developer mode is off.',
      fix: 'Set the correct password; enable developer mode on the device.',
    },
    'deploy-connection-reset': {
      title: 'Connection reset during deploy',
      meaning: 'The device dropped the socket mid-deploy.',
      cause: 'The device is busy or needs an update, or a network drop.',
      fix: 'Retry; check for updates; verify the network.',
    },
    'stop-statement': {
      title: 'STOP statement hit',
      meaning: 'Execution paused because a `stop` statement dropped the app into the Micro Debugger.',
      cause: 'A leftover `stop` debug statement in the code.',
      fix: 'Remove `stop` before release; use `continue`/`step` to resume.',
    },
    'cant-continue': {
      title: "Can't continue",
      meaning: 'The debugger cannot resume — the thread died at a fatal error.',
      cause: 'An unrecoverable runtime error, or the thread exited.',
      fix: 'Restart the channel and fix the crashing line (see the backtrace above).',
    },
    'console-in-use': {
      title: 'Console connection already in use',
      meaning: 'The telnet debug port (8085) is already held by another client.',
      cause: 'A second debugger/telnet session is open to the device.',
      fix: 'Close other telnet/VS Code sessions to the device.',
    },
    'app-crash-exit': {
      title: 'Channel exited on a BrightScript crash',
      meaning: 'The channel process terminated because a BrightScript thread crashed (an uncaught runtime error).',
      cause: 'An uncaught runtime error on a thread with no handler.',
      fix: 'See the crash + backtrace in Console Monitor; guard the faulting call with try/catch or fix the faulting line.',
    },
  },

  // Distinct catalog category values (BrsErrorCategory). English value == the category string.
  errorCategories: {
    'Type/Runtime': 'Type/Runtime',
    'SceneGraph/Component': 'SceneGraph/Component',
    'Threading/Rendezvous': 'Threading/Rendezvous',
    'JSON': 'JSON',
    'Memory': 'Memory',
    'Syntax/Compile': 'Syntax/Compile',
    'Network/HTTP': 'Network/HTTP',
    'Deploy': 'Deploy',
    'Debugger': 'Debugger',
    'Other': 'Other',
  },
} as const;
