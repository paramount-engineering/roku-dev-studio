/**
 * BrightScript / Roku runtime-error catalog + matcher for the telnet debug console.
 *
 * Purpose: turn a raw console line like
 *   `BRIGHTSCRIPT: ERROR: Runtime: FOR EACH value is not an enumerable object: pkg:/…/GenericUtil.brs(971)`
 * into a structured, human-friendly explanation (what it means, the usual cause, how to fix it) so a
 * "console errors" dashboard can group, count, and annotate the errors a developer sees. This is the
 * DATA + a pure {@link matchBrsError} recognizer only — no UI; a dashboard/inline-annotation layer can
 * be built on top of it.
 *
 * Data sources (compiled 2026-07-15): Roku Developer Docs (error-handling, debugging, program-statements,
 * global-utility-functions, threads, ifUrlTransfer — the `&hXX` runtime codes surfaced by
 * `GetLastRunRuntimeError()`), RokuCommunity `roku-debug`/`roku-deploy` recognizers, and the firmware
 * `bslBrightScriptErrorCodes()` table cross-checked against community.roku.com reports.
 *
 * Every `docsUrl` points to an OFFICIAL `developer.roku.com` page, deep-linked to the relevant section
 * anchor where one exists (verified 2026-07-16). No third-party repos or forum threads.
 *
 * IMPORTANT — matching is MESSAGE-TEXT ONLY. Roku prints errors to the telnet console as messages, e.g.
 * `BRIGHTSCRIPT: ERROR: Runtime: FOR EACH value is not an object: pkg:/…brs(971)` — a message + a
 * `pkg:/…brs(<line>)` location, with NO `(runtime error &hXX)` hex code (that's only reachable via
 * `exception.number` inside try/catch, which a passive telnet scanner never has). Verified against
 * real-device telnet + RDS Fiddle. So {@link matchBrsError} matches signature substrings only; the
 * `codes` field is retained as reference metadata (the verified ERR_* → &hXX mapping) and is NOT matched.
 */

export type BrsErrorCategory =
  | 'Type/Runtime'
  | 'JSON'
  | 'Threading/Rendezvous'
  | 'SceneGraph/Component'
  | 'Syntax/Compile'
  | 'Memory'
  | 'Network/HTTP'
  | 'Deploy'
  | 'Debugger'
  | 'Other';

export type BrsErrorSeverity = 'error' | 'warning' | 'info';

export interface BrsErrorEntry {
  /** Stable slug — safe to use as a dashboard row key / analytics bucket. */
  id: string;
  /** Short human name. */
  title: string;
  category: BrsErrorCategory;
  /** Verified ERR_* → `&hXX` mapping (lower-cased), e.g. `['&hec']`. REFERENCE METADATA ONLY — Roku
   *  doesn't print hex codes to telnet, so this is not used for matching (see the header + matchBrsError). */
  codes?: string[];
  /** Lower-cased substrings that identify this error in a console line (any one matching = hit). */
  signatures: string[];
  /** One-sentence plain-English meaning. */
  meaning: string;
  /** The typical code mistake that triggers it. */
  cause: string;
  /** How a developer resolves it. */
  fix: string;
  /** Official developer.roku.com doc to read more (deep-linked to a section anchor where possible). */
  docsUrl?: string;
  severity: BrsErrorSeverity;
}

// Canonical official-doc targets (with verified section anchors) reused across entries below.
const DBG = 'https://developer.roku.com/dev/docs/debugging';
const DBG_TYPE_MISMATCH = `${DBG}#debugger-message-type-mismatch`;
const DBG_DOT =
  `${DBG}#debugger-message-dot-operator-attempted-with-invalid-brightscript-component-or-interface-reference`;
const DBG_TROUBLESHOOT = `${DBG}#troubleshooting-common-development-errors`;
const DBG_SCENEGRAPH = `${DBG}#scenegraph-applications`;
const DBG_CONSOLE_8085 = `${DBG}#brightscript-console-port-8085-commands`;
const DBG_PORTS = `${DBG}#debug-ports`;
/** GetLastRunRuntimeError() — the section that documents the `ERR_*` / `&hXX` runtime error codes. */
const ERR_CODES =
  'https://developer.roku.com/docs/references/brightscript/language/runtime-functions.md#getlastrunruntimeerror-as-integer';
const ERR_THROW =
  'https://developer.roku.com/docs/references/brightscript/language/error-handling.md#invalid-throws';
const FOR_EACH =
  'https://developer.roku.com/docs/references/brightscript/language/program-statements.md#for-each-item-in-object';
const FORMAT_JSON =
  'https://developer.roku.com/docs/references/brightscript/language/global-utility-functions.md#formatjsonjson-as-object-flags--0-as-integer-as-string';
const GLOBAL_UTIL =
  'https://developer.roku.com/docs/references/brightscript/language/global-utility-functions.md';
const THREADS = 'https://developer.roku.com/dev/docs/threads';
const THREADS_RENDEZVOUS = `${THREADS}#thread-rendezvous`;
const THREADS_EXCESSIVE = `${THREADS}#excessive-rendezvous-operations`;
const THREADS_LIMITS = `${THREADS}#thread-limits`;
const URL_TRANSFER = 'https://developer.roku.com/dev/docs/ifurltransfer#getfailurereason-as-string';

/**
 * The catalog. Ordered roughly by how often each shows up in a real debug session; the matcher does
 * not rely on order (it scores specificity), but keeping the common ones first aids readability.
 */
export const BRS_ERROR_CATALOG: readonly BrsErrorEntry[] = [
  // ---- Type / Runtime -----------------------------------------------------------------------
  {
    id: 'type-mismatch',
    title: 'Type mismatch',
    category: 'Type/Runtime',
    codes: ['&h18'],
    signatures: ['type mismatch'],
    meaning: 'An operator was applied to values of incompatible types.',
    cause: 'Comparing or combining mismatched types (e.g. String vs Integer), or an uninitialized variable treated as the wrong type.',
    fix: 'Convert with Str()/Val()/ToStr() so both operands share a type. Roku OS 10.5+ names the operator and both types in the message.',
    docsUrl: DBG_TYPE_MISMATCH,
    severity: 'error'
  },
  {
    id: 'dot-on-invalid',
    title: '"Dot" operator on invalid object',
    category: 'SceneGraph/Component',
    codes: ['&hec'],
    signatures: ["'dot' operator attempted", 'dot operator attempted'],
    meaning: 'Used `.` to read a member/field on a value that is invalid or not a component/interface.',
    cause: 'The object was never created or a lookup returned invalid — e.g. `m.top.findNode("x").text` where findNode returned invalid.',
    fix: 'Null-check before dotting (`if node <> invalid`); confirm the object exists and the member name is correct.',
    docsUrl: DBG_DOT,
    severity: 'error'
  },
  {
    id: 'for-each-non-enumerable',
    title: 'FOR EACH on a non-enumerable value',
    category: 'Type/Runtime',
    signatures: [
      // Verbatim real-device wording (captured via RDS Fiddle): prints as
      // `BRIGHTSCRIPT: ERROR: Runtime: FOR EACH value is not an object: pkg:/…(line)` — non-fatal,
      // no `(runtime error &hXX)` code. Older/other wordings kept as fallbacks.
      'for each value is not an object',
      'for each value is not an enumerable object',
      'for each value is invalid',
      'not an enumerable object'
    ],
    meaning: '`for each` was run over a value that is invalid or is not an enumerable object.',
    cause: 'Iterating a function result that returned invalid (a missing AA key, an empty GetChildElements()/GetBody()), or a scalar/node.',
    fix: 'Null/type-check before the loop; only enumerate roArray, roList, roAssociativeArray, or roMessagePort (types with ifEnum).',
    docsUrl: FOR_EACH,
    severity: 'error'
  },
  {
    id: 'call-on-non-function',
    title: 'Call operator ( ) on a non-function',
    category: 'Type/Runtime',
    codes: ['&he0'],
    signatures: ['function call operator', 'attempted on non-function'],
    meaning: 'Code tried to invoke `()` on a value that is not a function.',
    cause: 'A variable shadowed a function, the name is misspelled/undeclared, or the value is invalid/data rather than a function.',
    fix: 'Verify the identifier is a defined function; check for name collisions and invalid values before calling.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },
  {
    id: 'uninitialized-variable',
    title: 'Use of uninitialized variable',
    category: 'Type/Runtime',
    codes: ['&he9'],
    signatures: ['use of uninitialized variable', 'uninitialized variable'],
    meaning: 'A variable was read before it was ever assigned a value.',
    cause: 'A misspelled variable name, a variable declared only in another scope, or a conditional path that skipped the assignment.',
    fix: 'Initialize before use; check spelling and scope; the debugger shows such locals as `<uninitialized>`.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },
  {
    id: 'uninitialized-function-ref',
    title: 'Uninitialized function reference',
    category: 'Type/Runtime',
    // `&he6` from Roku bslCore (ERR_USE_OF_UNINIT_BRSUBREF). DEVICE-UNCONFIRMED: on modern OS, calling
    // an uninitialized function-typed var surfaces as `&hE0` call-on-non-function instead. Message-matched.
    codes: ['&he6'],
    signatures: ['reference to a function/sub that is not initialized', 'function/sub that is not initialized'],
    meaning: 'Called through a function variable that holds no function.',
    cause: 'A function pointer was never assigned, or was set to invalid.',
    fix: 'Assign a valid function reference before invoking it.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },
  {
    id: 'invalid-left-side',
    title: 'Invalid left-side of expression',
    category: 'Type/Runtime',
    codes: ['&he4'],
    signatures: ['invalid value for left-side of expression', 'left-side of expression'],
    meaning: 'The target of an assignment is not something that can be assigned to.',
    cause: 'Assigning to a literal or expression instead of a variable or object field.',
    fix: 'Assign only to a variable or an object field.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },
  {
    id: 'divide-by-zero',
    title: 'Divide by zero',
    category: 'Type/Runtime',
    codes: ['&h14'],
    signatures: ['divide by zero'],
    meaning: 'A division or MOD used a zero denominator at runtime.',
    cause: 'A divisor variable evaluated to 0 (or to invalid, coerced to 0).',
    fix: 'Guard denominators before dividing (`if d <> 0`).',
    docsUrl: ERR_CODES,
    severity: 'error'
  },
  {
    id: 'array-out-of-bounds',
    title: 'Array subscript out of bounds',
    category: 'Type/Runtime',
    codes: ['&h10'],
    signatures: ['array subscript out of bounds', 'subscript out of bounds'],
    meaning: 'Read or wrote past the end of (or a negative index into) an array.',
    cause: 'Off-by-one loop bounds; indexing an empty or shorter array.',
    fix: 'Check `arr.count()` before indexing; validate loop bounds.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },
  {
    id: 'array-not-dimd',
    title: "Array operation on a variable not DIM'd",
    category: 'Type/Runtime',
    codes: ['&he7'],
    signatures: ["array operation attempted on variable not dim'd", 'not dim'],
    meaning: 'Indexed a variable that was never created as an array.',
    cause: 'Using `[]` on a scalar or on invalid.',
    fix: 'Initialize the array (`arr = []`) before indexing it.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },
  {
    id: 'non-numeric-array-index',
    title: 'Non-numeric array index',
    category: 'Type/Runtime',
    codes: ['&he8'],
    signatures: ['non-numeric array index', 'attempt to use a non-numeric array index'],
    meaning: 'Used a string/object as an index into an roArray.',
    cause: 'Confusing an roArray with an roAssociativeArray.',
    fix: 'Use an AA for string keys, or a numeric index for arrays.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },
  {
    id: 'invalid-num-array-indexes',
    title: 'Invalid number of array indexes',
    category: 'Type/Runtime',
    // `&hE3` = ERR_INVALID_NUM_ARRAY_IDX per Roku bslCore. An earlier `&he2` was WRONG — that hex is
    // ERR_VALUE_RETURN (a NORMAL script return, not an error).
    codes: ['&he3'],
    signatures: ['invalid number of array indexes'],
    meaning: 'Wrong dimensionality was used to index an array.',
    cause: 'Using `a[i,j]` on a 1-D array (or vice-versa).',
    fix: "Match the index count to the array's declared dimensions.",
    docsUrl: ERR_CODES,
    severity: 'error'
  },
  {
    id: 'wrong-num-params',
    title: 'Wrong number of function parameters',
    category: 'Type/Runtime',
    codes: ['&hf1'],
    signatures: ['wrong number of function parameters'],
    meaning: 'A function was called with too few or too many arguments.',
    cause: 'A changed signature, or an optional parameter with no default.',
    fix: 'Match the call to the signature; give optional parameters defaults.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },
  {
    id: 'bad-throw',
    title: 'Invalid throw argument',
    category: 'Type/Runtime',
    codes: ['&h26'],
    // "Thrown value neither string nor roAssociativeArray." is the verbatim real-device message
    // (captured via RDS Fiddle); older wordings kept as fallbacks.
    signatures: ['thrown value neither string', 'invalid throw', 'invalid argument to throw'],
    meaning: 'A `throw` was given something other than a string or a valid error AA.',
    cause: 'Throwing a number/object that lacks valid `number`/`message` fields.',
    fix: 'Throw a string, or an AA with Integer `number` and String `message` fields.',
    docsUrl: ERR_THROW,
    severity: 'error'
  },
  {
    id: 'user-thrown-exception',
    title: 'Uncaught user exception (THROW)',
    category: 'Type/Runtime',
    // ERR_USER (`&h28`) — the default code for a `THROW "message"`. NOTE: an uncaught user throw's
    // telnet wording is the user's OWN message (arbitrary), so there is no reliable signature — this
    // entry is largely documentation. `roku_user_exception` is a best-effort marker; `&h28` is metadata.
    codes: ['&h28'],
    signatures: ['roku_user_exception', 'user-specified exception'],
    meaning: 'A `throw` propagated to the top without being caught, ending the script.',
    cause: 'A `throw "…"` (or `throw {message: …}`) with no surrounding `try/catch` to handle it.',
    fix: 'Wrap the throwing call in `try/catch` (Roku OS 9.4+) and inspect `e.number`/`e.message`/`e.backtrace`.',
    docsUrl: ERR_THROW,
    severity: 'error'
  },
  {
    id: 'invalid-format-specifier',
    title: 'Invalid format specifier',
    category: 'Type/Runtime',
    // `&h24` = ERR_INVALID_FORMAT — DEVICE-CONFIRMED (RDS Fiddle: `number=36 "Invalid Format Specifier"`,
    // console `BRIGHTSCRIPT: ERROR: ToStr: index 0: invalid format specifier type character q: …`).
    codes: ['&h24'],
    signatures: ['invalid format specifier'],
    meaning: 'A bad specifier was passed to a format function.',
    cause: 'A malformed Format()/printf-style token.',
    fix: 'Correct the format string.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },
  {
    id: 'invalid-param',
    title: 'Invalid parameter passed to function/array',
    category: 'Type/Runtime',
    codes: ['&h08'],
    signatures: ['invalid parameter passed'],
    meaning: 'A built-in got an out-of-domain argument (e.g. sqrt of a negative, a negative dimension).',
    cause: 'A bad math domain or a negative array dimension.',
    fix: 'Validate arguments before the call.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },

  // ---- SceneGraph / Component ---------------------------------------------------------------
  {
    id: 'member-fn-not-found',
    title: 'Member function not found',
    category: 'SceneGraph/Component',
    codes: ['&hf4'],
    signatures: ['member function not found'],
    meaning: 'Called a method that the component or interface does not expose.',
    cause: 'A misspelled method name, calling on invalid, the wrong component type, or a method missing on that firmware version.',
    fix: 'Confirm the method exists for that object/OS; guard invalid objects before calling.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },
  {
    id: 'interface-not-member',
    title: 'Interface not a member of component',
    category: 'SceneGraph/Component',
    // `&hf3` from Roku bslCore (ERR_RO3). DEVICE-UNCONFIRMED: on modern OS, GetInterface with a missing
    // interface surfaces as `&hF4` member-not-found instead. Message-matched.
    codes: ['&hf3'],
    signatures: ['interface not a member'],
    meaning: 'Requested an interface the component does not implement.',
    cause: 'A GetInterface() call for an interface the object lacks, or the wrong interface name.',
    fix: 'Use an interface the component actually exposes.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },
  {
    id: 'component-class-not-found',
    title: 'Component / node class not found',
    category: 'SceneGraph/Component',
    codes: ['&hf6'],
    signatures: [
      'class not found',
      'failed to create rosgnode',
      'bscnewcomponent failed'
    ],
    meaning: 'CreateObject / createChild used a class or node type that does not exist.',
    cause: 'A misspelled or wrong-case type string, or a component not declared/registered in the package.',
    fix: 'Fix the type string (case-sensitive); ensure the component XML is included in the channel.',
    docsUrl: DBG_TROUBLESHOOT,
    severity: 'error'
  },
  {
    id: 'sg-field-type-mismatch',
    title: 'SceneGraph field type mismatch',
    category: 'SceneGraph/Component',
    // The combined `"<field>": type mismatch` shape (longer than the bare "type mismatch" signature)
    // wins over the generic type-mismatch entry via the specificity score in matchBrsError.
    signatures: ['": type mismatch'],
    meaning: "A value assigned to a node field did not match the field's declared type.",
    cause: 'Assigning e.g. a String to an int/uri field, or an Array to an assocarray field via setField/addReplace.',
    fix: "Assign a value matching the field's declared interface type, or fix the field type in the component XML.",
    docsUrl: DBG_TYPE_MISMATCH,
    severity: 'error'
  },
  {
    id: 'sg-nonexistent-field',
    title: 'Set nonexistent SceneGraph field',
    category: 'SceneGraph/Component',
    // Device-confirmed (RDS Fiddle) — a non-fatal WARNING block, no runtime code:
    //   Warning occurred while setting a field of an RoSGNode
    //   -- Tried to set nonexistent field "bogusField" of a "Rectangle" node
    signatures: ['tried to set nonexistent field', 'setting a field of an rosgnode'],
    meaning: 'Assigned to a node field that the node type does not declare (silently ignored).',
    cause: 'A misspelled field name, or a field not defined in the component XML `<interface>`.',
    fix: 'Use a declared field name (case-sensitive), or add the field to the component XML interface.',
    docsUrl: DBG_TROUBLESHOOT,
    severity: 'warning'
  },
  {
    id: 'component-call-arg-count',
    title: 'Component call has wrong parameter count',
    category: 'SceneGraph/Component',
    // `&hf5` from Roku bslCore (ERR_RO1). DEVICE-UNCONFIRMED: on modern OS, calling a component method
    // with the wrong arg count surfaces as `&hF4` member-not-found instead. Message-matched.
    codes: ['&hf5'],
    signatures: ['does not have the correct number of parameters', 'component function call does not have'],
    meaning: 'A built-in component method was called with the wrong number of arguments.',
    cause: 'An argument count that does not match the ifXXX method signature.',
    fix: 'Match the documented method signature.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },

  // ---- Threading / Rendezvous ---------------------------------------------------------------
  {
    id: 'rendezvous-aborted',
    title: 'Rendezvous aborted',
    category: 'Threading/Rendezvous',
    signatures: ['rendezvous aborted'],
    meaning: 'A cross-thread node access failed because the target node was invalid or gone.',
    cause: 'Accessing a node owned by another thread that was destroyed or stalled (e.g. a global node lost after long playback).',
    fix: 'Avoid cross-thread node churn; null-check before access; profile with `logrendezvous` / `sgperf`.',
    docsUrl: THREADS_RENDEZVOUS,
    severity: 'error'
  },
  {
    id: 'rendezvous-block',
    title: 'SceneGraph rendezvous (thread blocking)',
    category: 'Threading/Rendezvous',
    signatures: ['[sg.node.block]', '[sg.node.unblock]', 'rendezvous['],
    meaning: 'A render-thread ↔ task-thread sync point; frequent ones stall the render thread.',
    cause: 'A Task thread reading/writing render-thread node fields one at a time.',
    fix: 'Batch field access with getFields/setFields; minimize cross-thread node access.',
    docsUrl: THREADS_EXCESSIVE,
    severity: 'warning'
  },
  {
    id: 'execution-timeout',
    title: 'Execution timeout (script ran too long)',
    category: 'Threading/Rendezvous',
    codes: ['&h23'],
    signatures: ['execution timeout'],
    meaning: 'Code ran too long on a thread (the render thread has a multi-second limit).',
    cause: 'Heavy loops, large JSON parsing, or synchronous I/O on the render or a Task thread.',
    fix: 'Move heavy work to a Task node; chunk or async the work.',
    docsUrl: THREADS_LIMITS,
    severity: 'error'
  },
  {
    id: 'too-many-task-threads',
    title: 'Too many task threads',
    category: 'Threading/Rendezvous',
    // `&h29` is UNCONFIRMED for real Roku — brs-engine *simulator* enum only, not in Roku's bslCore or
    // official docs. Matched by message (the code is reference metadata, not used for matching).
    codes: ['&h29'],
    signatures: ['too many task threads'],
    meaning: 'Exceeded the limit of concurrent Task threads.',
    cause: 'Creating Task nodes in a loop without reuse or cleanup.',
    fix: 'Reuse/pool Task nodes; limit concurrency; let tasks finish.',
    docsUrl: THREADS_LIMITS,
    severity: 'error'
  },
  {
    id: 'wait-on-non-port',
    title: 'Wait on an object without a message port',
    category: 'Threading/Rendezvous',
    // `&hee` from Roku bslCore (ERR_NOTWAITABLE). DEVICE-UNCONFIRMED: `wait(timeout, nonPort)` on modern
    // OS returns (timeout) without throwing. Kept for the documented message; matched by message.
    codes: ['&hee'],
    signatures: ['does not have messageport interface', 'tried to wait on'],
    meaning: '`wait()` was called on an object that lacks ifMessagePort.',
    cause: 'Waiting on the wrong object instead of an roMessagePort.',
    fix: 'Wait only on an roMessagePort.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },

  // ---- JSON ---------------------------------------------------------------------------------
  {
    id: 'formatjson-nested',
    title: 'FormatJSON nested/cyclic reference',
    category: 'JSON',
    signatures: ['formatjson', 'nested object reference'],
    meaning: 'FormatJSON failed on a circular reference or nesting deeper than 256 levels.',
    cause: 'A cyclic object graph, or an unsupported value type (e.g. an roList) in the tree.',
    fix: 'Break reference cycles; keep nesting under 256; only serialize supported types (AA, array, string, number, boolean).',
    docsUrl: FORMAT_JSON,
    severity: 'error'
  },
  {
    id: 'parsejson-failed',
    title: 'ParseJSON failed',
    category: 'JSON',
    // Device-confirmed telnet: `BRIGHTSCRIPT: ERROR: ParseJSON: Data is empty: pkg:/…brs(N)`. The colon
    // keeps this specific to the `ParseJSON:` diagnostic (won't match app logs mentioning parsejson).
    signatures: ['parsejson:'],
    meaning: 'ParseJSON could not parse the input string (it returns invalid).',
    cause: 'Empty/whitespace input (e.g. an empty HTTP response body), malformed JSON, or a non-string arg.',
    fix: 'Guard for empty/invalid input before ParseJSON; verify the source (check the HTTP body/length first).',
    docsUrl: GLOBAL_UTIL,
    severity: 'error'
  },

  // ---- File I/O -----------------------------------------------------------------------------
  {
    id: 'file-write-failed',
    title: 'File write failed',
    category: 'Other',
    // Device-confirmed telnet: `BRIGHTSCRIPT: ERROR: WriteAsciiFile: file open for write failed: pkg:/…brs(N)`.
    signatures: ['file open for write failed', 'writeasciifile:'],
    meaning: 'A file could not be opened for writing (WriteAsciiFile / roCreateFile).',
    cause: 'Writing outside a writable location — only `tmp:/` and `cachefs:/` are writable (`pkg:/` is read-only) — or a missing directory / full disk.',
    fix: 'Write only to `tmp:/` or `cachefs:/`; make sure the parent path exists.',
    docsUrl: GLOBAL_UTIL,
    severity: 'error'
  },

  // ---- Memory -------------------------------------------------------------------------------
  {
    id: 'stack-overflow',
    title: 'Stack overflow',
    category: 'Memory',
    codes: ['&hdf'],
    signatures: ['stack overflow'],
    meaning: 'The call stack was exhausted.',
    cause: 'Unbounded or very deep recursion (Roku overflows after ~31 nested calls).',
    fix: 'Add a base case; convert deep recursion to iteration.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },
  {
    id: 'out-of-memory',
    title: 'Out of memory',
    category: 'Memory',
    codes: ['&h0c', '&h1a'],
    signatures: ['out of memory'],
    meaning: 'A memory allocation failed; the heap is exhausted.',
    cause: 'Large data structures, leaks, or retained nodes/textures; huge string builds in a loop.',
    fix: 'Release references, reduce data size, reuse nodes; stream/chunk large string work.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },
  {
    id: 'string-too-long',
    title: 'String too long',
    category: 'Memory',
    codes: ['&h1c'],
    signatures: ['string too long'],
    meaning: 'A string exceeded the maximum length.',
    cause: 'Concatenating unbounded input.',
    fix: 'Cap or split the string length.',
    docsUrl: ERR_CODES,
    severity: 'error'
  },

  // ---- Syntax / Compile (console recognizers) ----------------------------------------------
  {
    id: 'syntax-error',
    title: 'Syntax error',
    category: 'Syntax/Compile',
    codes: ['&h02'],
    signatures: ['syntax error'],
    meaning: 'The source failed to compile.',
    cause: 'Typos, unbalanced blocks, or bad tokens.',
    fix: 'Fix the syntax at the reported line/column; compile locally before sideloading.',
    docsUrl: DBG_TROUBLESHOOT,
    severity: 'error'
  },
  {
    id: 'compile-error-generic',
    title: 'Compile error',
    category: 'Syntax/Compile',
    signatures: ['(compile error', 'errors in file', 'error in file'],
    meaning: 'The compiler rejected one or more lines before the app ran.',
    cause: 'A typo, a missing keyword, or a malformed expression.',
    fix: 'Fix each reported `line N:` in the named file.',
    docsUrl: DBG_TROUBLESHOOT,
    severity: 'error'
  },
  {
    id: 'unterminated-block',
    title: 'Unterminated block',
    category: 'Syntax/Compile',
    signatures: [
      'was not terminated correctly',
      'endif missing',
      'missing a matching endwhile',
      'endwhile without while'
    ],
    meaning: 'A control block (FOR/NEXT, IF/ENDIF, WHILE/ENDWHILE) is missing its closing keyword.',
    cause: 'A missing or mismatched `end if` / `next` / `end while`.',
    fix: 'Balance each block-open keyword with its matching close.',
    docsUrl: DBG_TROUBLESHOOT,
    severity: 'error'
  },
  {
    id: 'xml-parse-error',
    title: 'XML component parse error',
    category: 'SceneGraph/Component',
    signatures: ['error parsing xml component', 'error in xml component'],
    meaning: 'A SceneGraph XML component file failed to parse or has a defect.',
    cause: 'Malformed markup, a bad tag, or a bad field/interface/script reference in the component.',
    fix: 'Validate the .xml markup and fix the component definition.',
    docsUrl: DBG_SCENEGRAPH,
    severity: 'error'
  },
  {
    id: 'no-manifest',
    title: 'No manifest — invalid package',
    category: 'Syntax/Compile',
    signatures: ['no manifest. invalid package', 'no manifest'],
    meaning: 'The sideloaded zip lacks a valid manifest.',
    cause: 'The manifest is missing or not at the archive root.',
    fix: 'Put a valid `manifest` file at the root of the zip.',
    docsUrl: DBG_TROUBLESHOOT,
    severity: 'error'
  },

  // ---- Warnings (BRIGHTSCRIPT: WARNING: …) --------------------------------------------------
  {
    id: 'unused-variable',
    title: 'Unused variable',
    category: 'Syntax/Compile',
    // Longer than the generic "brightscript: warning:" signature so this specific entry wins the score.
    signatures: ['warning: unused variable', 'unused variable'],
    meaning: 'A declared variable — often a function or event-handler parameter — is never used.',
    cause: "A handler parameter (`msg`/`event`/`field`) or local the function body never references.",
    fix: 'Remove it if genuinely unused; it is harmless to ship. Required callback-signature parameters can be left as-is.',
    docsUrl: DBG_TROUBLESHOOT,
    severity: 'warning'
  },
  {
    id: 'brightscript-warning',
    title: 'BrightScript warning',
    category: 'Other',
    // Catch-all for any `BRIGHTSCRIPT: WARNING:` line not matched by a more specific warning above.
    signatures: ['brightscript: warning:'],
    meaning: 'The BrightScript compiler emitted a non-fatal warning.',
    cause: 'A lint-level issue (unused code, a deprecated pattern) that does not stop execution.',
    fix: 'Review the named function/file — warnings are safe to run but often flag dead code or mistakes.',
    docsUrl: DBG_TROUBLESHOOT,
    severity: 'warning'
  },

  // ---- Network / HTTP (roUrlEvent / roUrlTransfer status codes) -----------------------------
  {
    id: 'http-unsupported-protocol',
    title: 'Unsupported protocol (-1)',
    category: 'Network/HTTP',
    codes: ['-1'],
    signatures: ['curle_unsupported_protocol', 'unsupported protocol'],
    meaning: 'The URL scheme is not supported by the transfer.',
    cause: 'A malformed URL or wrong scheme.',
    fix: 'Use a supported http(s):// URL.',
    docsUrl: URL_TRANSFER,
    severity: 'error'
  },
  {
    id: 'http-resolve-host',
    title: "Couldn't resolve host (-6)",
    category: 'Network/HTTP',
    codes: ['-6'],
    signatures: ["couldn't resolve host", 'could not resolve host'],
    meaning: 'DNS resolution of the request host failed.',
    cause: 'A bad hostname, no network, or a DNS outage.',
    fix: 'Verify the URL/host and network connectivity.',
    docsUrl: URL_TRANSFER,
    severity: 'error'
  },
  {
    id: 'http-connect',
    title: "Couldn't connect (-7)",
    category: 'Network/HTTP',
    codes: ['-7'],
    signatures: ["couldn't connect", 'could not connect'],
    meaning: 'The TCP connection to the host/proxy failed.',
    cause: 'Server down, wrong port, or a firewall.',
    fix: 'Check the endpoint/port availability.',
    docsUrl: URL_TRANSFER,
    severity: 'error'
  },
  {
    id: 'http-timeout',
    title: 'HTTP request timed out (-28)',
    category: 'Network/HTTP',
    codes: ['-28'],
    signatures: ['operation timed out', 'timed out'],
    meaning: 'The request exceeded its timeout.',
    cause: 'A slow or unreachable server, or too small a timeout.',
    fix: 'Increase the timeout; retry; check the server.',
    docsUrl: URL_TRANSFER,
    severity: 'error'
  },
  {
    id: 'http-ssl-peer',
    title: 'SSL peer verification failed (-51)',
    category: 'Network/HTTP',
    codes: ['-51'],
    signatures: ['peer certificate', 'peer verification'],
    meaning: "The server's TLS certificate did not validate.",
    cause: 'An expired, self-signed, or mismatched certificate.',
    fix: 'Fix the cert chain; only disable EnablePeerVerification(false) for testing.',
    docsUrl: URL_TRANSFER,
    severity: 'error'
  },
  {
    id: 'http-ca-cert',
    title: 'CA cert file bad/missing (-77)',
    category: 'Network/HTTP',
    codes: ['-77'],
    signatures: ['ssl cacert', 'cacert_badfile', 'ca-bundle'],
    meaning: 'The CA bundle could not be loaded.',
    cause: 'A missing or incorrect SetCertificatesFile path.',
    fix: 'Set `common:/certs/ca-bundle.crt` and call InitClientCertificates().',
    docsUrl: URL_TRANSFER,
    severity: 'error'
  },

  // ---- Deploy / Sideload (roku-deploy) ------------------------------------------------------
  {
    id: 'deploy-update-check-required',
    title: 'Device needs to check for updates',
    category: 'Deploy',
    signatures: ['needs to check for updates', 'update check required'],
    meaning: 'The device refuses connections until it checks for a system update.',
    cause: 'Pending Roku firmware update-check.',
    fix: 'On the device: Settings → System → System update → Check now.',
    docsUrl: DBG_TROUBLESHOOT,
    severity: 'error'
  },
  {
    id: 'deploy-unauthorized',
    title: 'Unauthorized (bad dev password)',
    category: 'Deploy',
    signatures: ['unauthorized', 'unauthorizeddeviceresponse'],
    meaning: 'The dev server rejected the credentials.',
    cause: 'A wrong developer password, or developer mode is off.',
    fix: 'Set the correct password; enable developer mode on the device.',
    docsUrl: DBG_TROUBLESHOOT,
    severity: 'error'
  },
  {
    id: 'deploy-connection-reset',
    title: 'Connection reset during deploy',
    category: 'Deploy',
    signatures: ['ended the connection unexpectedly', 'connection reset'],
    meaning: 'The device dropped the socket mid-deploy.',
    cause: 'The device is busy or needs an update, or a network drop.',
    fix: 'Retry; check for updates; verify the network.',
    docsUrl: DBG_TROUBLESHOOT,
    severity: 'error'
  },

  // ---- Debugger / status (not real errors, but confusing in the console) --------------------
  {
    id: 'stop-statement',
    title: 'STOP statement hit',
    category: 'Debugger',
    // `&hf7` = ERR_STOP per Roku bslCore. Earlier `&hf6` was WRONG — that's ERR_RO0 (component class
    // not found). `&hf8` is ERR_BREAK (ctrl-C), a distinct condition.
    codes: ['&hf7'],
    signatures: ['brightscript micro debugger'],
    meaning: 'Execution paused because a `stop` statement dropped the app into the Micro Debugger.',
    cause: 'A leftover `stop` debug statement in the code.',
    fix: 'Remove `stop` before release; use `continue`/`step` to resume.',
    docsUrl: DBG_CONSOLE_8085,
    severity: 'info'
  },
  {
    id: 'cant-continue',
    title: "Can't continue",
    category: 'Debugger',
    signatures: ["can't continue"],
    meaning: 'The debugger cannot resume — the thread died at a fatal error.',
    cause: 'An unrecoverable runtime error, or the thread exited.',
    fix: 'Restart the channel and fix the crashing line (see the backtrace above).',
    docsUrl: DBG_CONSOLE_8085,
    severity: 'warning'
  },
  {
    id: 'console-in-use',
    title: 'Console connection already in use',
    category: 'Debugger',
    signatures: ['console connection is already in use'],
    meaning: 'The telnet debug port (8085) is already held by another client.',
    cause: 'A second debugger/telnet session is open to the device.',
    fix: 'Close other telnet/VS Code sessions to the device.',
    docsUrl: DBG_PORTS,
    severity: 'warning'
  },
  {
    // Roku's definitive fatal-crash exit line. Recognized so the Console Monitor button enables even for
    // an exit-only crash (no Micro Debugger dump); the crash scanner then consumes this line, so it
    // surfaces as a CRASH (with the exit noted), not as a duplicate single-line finding.
    id: 'app-crash-exit',
    title: 'Channel exited on a BrightScript crash',
    category: 'Debugger',
    signatures: ['exit_brightscript_crash'],
    meaning: 'The channel process terminated because a BrightScript thread crashed (an uncaught runtime error).',
    cause: 'An uncaught runtime error on a thread with no handler.',
    fix: 'See the crash + backtrace in Console Monitor; guard the faulting call with try/catch or fix the faulting line.',
    docsUrl: DBG_CONSOLE_8085,
    severity: 'error'
  }
] as const;

/** Fast lookup by id (dashboard rows, analytics buckets). */
export const BRS_ERROR_BY_ID: ReadonlyMap<string, BrsErrorEntry> = new Map(
  BRS_ERROR_CATALOG.map((e) => [e.id, e])
);

/** All categories present in the catalog, in a stable display order. */
export const BRS_ERROR_CATEGORIES: readonly BrsErrorCategory[] = [
  'Type/Runtime',
  'SceneGraph/Component',
  'Threading/Rendezvous',
  'JSON',
  'Memory',
  'Syntax/Compile',
  'Network/HTTP',
  'Deploy',
  'Debugger',
  'Other'
];

/** Pull the `pkg:/…(line)` (or `… in pkg:/…`) source location a console line references, or null. */
export function extractBrsErrorLocation(line: string): { file: string; line?: number } | null {
  // `pkg:/components/foo.brs(971)` / `…foo.brs:971` / `… in pkg:/…`. Scheme is any Roku source scheme —
  // `pkg:`, `tmp:`, `cachefs:`, `common:`, `ext1:`, or a component-library scheme like `roku_ads_lib:`.
  const m = /((?:[a-z_][\w]*):\/[^\s():]+\.(?:brs|bs|xml))(?:[(:](\d+)\)?)?/i.exec(line);
  if (!m) return null;
  return m[2] ? { file: m[1]!, line: Number(m[2]) } : { file: m[1]! };
}

/**
 * Extract the clean, human-readable error message from a raw console line — the text a user would want
 * to read/copy. Roku's format is `BRIGHTSCRIPT: ERROR: [<Runtime|FormatJSON|…>: ]<MESSAGE>: pkg:/…brs(N)`,
 * so we anchor on the `BRIGHTSCRIPT: ERROR:` marker (the clean way to spot an error), drop a leading
 * `Runtime:` sub-prefix, and strip the trailing `: pkg:/…brs(N)` source location. Lines without the
 * marker (e.g. a caught `e.message` like `Divide by Zero.`) just get the location stripped. Returns the
 * trimmed message, or the original trimmed line if nothing could be peeled off.
 */
export function extractBrsErrorMessage(line: string): string {
  let s = line.trim();
  // Drop the `BRIGHTSCRIPT: ERROR:` / `WARNING:` / `INFO:` prefix (the clean anchor for a diagnostic).
  const marker = /BRIGHTSCRIPT:\s*(?:ERROR|WARNING|INFO):\s*/i.exec(s);
  if (marker) s = s.slice(marker.index + marker[0].length).trim();
  s = s.replace(/^Runtime:\s*/i, '');
  // Strip a trailing source location: optional `:`/`in` + `<scheme>:/…brs` + optional `(line)`.
  s = s.replace(
    /\s*(?::|\bin\b)?\s*(?:[a-z_][\w]*):\/[^\s():]+\.(?:brs|bs|xml)(?:\(\d+\))?\s*$/i,
    ''
  );
  s = s.replace(/[\s:]+$/, '').trim();
  return s || line.trim();
}

/** Upper bound on line length we bother matching — real BrightScript error/warning lines are short
 *  (message + `pkg:/…brs(line)`), so skipping multi-KB data-dump lines keeps a full-buffer scan cheap. */
export const RECOGNIZE_MAX_LINE_LENGTH = 2000;

/**
 * The console monitor's definition of "a recognized BrightScript issue" — {@link matchBrsError} with the
 * length bound applied. Shared by the panel (button-enable count) and the analytics modal so both agree
 * on exactly which lines count.
 */
export function recognizeBrsIssue(line: string): BrsErrorEntry | null {
  return line.length <= RECOGNIZE_MAX_LINE_LENGTH ? matchBrsError(line) : null;
}

/**
 * Recognize the BrightScript error (if any) a console line describes — PURELY by message text.
 *
 * Roku prints errors to the telnet console as MESSAGES, e.g.
 *   `BRIGHTSCRIPT: ERROR: Runtime: FOR EACH value is not an object: pkg:/…brs(971)`
 * — a message plus a `pkg:/…brs(<line>)` source location, and NO `(runtime error &hXX)` hex code. The
 * hex code is only reachable programmatically via `exception.number` inside `try/catch`, which the
 * Console Monitor (a passive telnet-text scanner) never has. (Confirmed against real-device telnet and
 * RDS Fiddle — see [[brightscript-error-catalog]].) So matching is message-only; each entry's `codes`
 * field is retained purely as reference metadata (the verified ERR_* → &hXX mapping), NOT used here.
 *
 * Returns the single best entry, or null. The longest matching signature wins (most specific), so
 * `roSGNode.AddReplace: "url": Type mismatch` maps to the SceneGraph field-type entry rather than the
 * generic type-mismatch one.
 */
export function matchBrsError(line: string): BrsErrorEntry | null {
  const hay = line.toLowerCase();
  let best: BrsErrorEntry | null = null;
  let bestScore = 0;
  for (const entry of BRS_ERROR_CATALOG) {
    let score = 0;
    for (const sig of entry.signatures) {
      if (hay.includes(sig)) score = Math.max(score, sig.length);
    }
    if (score === 0) continue;
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best;
}

/** One distinct occurrence-text of a finding, with its count and (if present) source location. */
export interface ConsoleFindingLine {
  /** The raw console line, verbatim. */
  text: string;
  /** The clean human-readable message ({@link extractBrsErrorMessage} of `text`) — for display/copy. */
  message: string;
  count: number;
  file?: string;
  line?: number;
  /**
   * Positions of this occurrence-text in the scanned source, so the UI can jump straight to it:
   * the live Console passes buffer array indices (== the virtualizer's row index); the windowed Log
   * Viewer passes 0-based file line numbers. Most-recent-first is NOT guaranteed — these are in scan
   * order. Capped at {@link OCCURRENCE_POSITION_CAP} (a line repeated thousands of times keeps only the
   * first N positions); `count` remains the true total.
   */
  indices: number[];
}

/** One recognized issue type, aggregated across the buffer — the catalog metadata plus occurrences. */
export interface ConsoleFinding {
  id: string;
  /** Catalog paraphrase (stable label / bucket name). */
  title: string;
  /** The REAL extracted error message from the most-frequent occurrence — what the UI header shows. */
  message: string;
  category: BrsErrorCategory;
  severity: BrsErrorSeverity;
  meaning: string;
  cause: string;
  fix: string;
  docsUrl?: string;
  /** Total occurrences of this issue. */
  count: number;
  /** Unique log lines for this issue, most-frequent first. */
  lines: ConsoleFindingLine[];
}

/** One frame of a crash backtrace, as printed by the Micro Debugger (`#N Function … / file/line: …`). */
export interface BrsCrashFrame {
  /** The `#N` index as printed. `#0` is the outermost (entry) call; the highest number is the crash site. */
  depth: number;
  /** The function signature text, e.g. `fw_asstring(input As Dynamic) As String`. */
  func: string;
  /** Source file the frame is in (`pkg:/…`), if parsed. */
  file?: string;
  /** 1-based source line within `file`. */
  line?: number;
}

/**
 * A recognized app crash: the BrightScript **Micro Debugger** dump an UNCAUGHT runtime error prints to
 * telnet (an error line followed by a `Backtrace:` stack). Distinct from a single-line
 * {@link ConsoleFinding} — a crash suspends the thread and carries a stack. We capture the meaningful
 * data (message, code, crash site, backtrace) but deliberately do NOT interpret *why* it happened —
 * a crash has many possible causes.
 */
export interface BrsCrash {
  /** The clean error message that triggered the crash, e.g. `Type Mismatch. Unable to cast "Integer" to "String".` */
  message: string;
  /** The `&hXX` runtime code — the Micro Debugger DOES print this (unlike ordinary telnet error lines). */
  code?: string;
  /** Crash-site file (`pkg:/…`), from the error line or the innermost frame. */
  file?: string;
  /** 1-based crash-site source line. */
  line?: number;
  /** Backtrace frames in printed order (innermost/crash site first, down to the entry function). */
  backtrace: BrsCrashFrame[];
  /** How many times this identical crash (same message + backtrace) occurred. */
  count: number;
  /** True when the app process was seen to terminate on this crash — a `…EXIT_BRIGHTSCRIPT_CRASH…`
   *  line (Roku's definitive "the channel exited because BrightScript crashed" signal). Set on the
   *  matching dump when one is nearby, else stands alone as an exit-only crash. */
  exited?: boolean;
  /** Channel name from the exit line (`Exiting '<app>'`), when known. */
  app?: string;
  /** The raw dump text (error line + backtrace), for copy. */
  raw: string;
  /** Console/log line positions every occurrence of this crash block occupied — same index space as
   *  {@link ConsoleFindingLine.indices}. Lets {@link computeConsoleFindings} exclude these lines from the
   *  single-line pass (a crash isn't also a stray "STOP"/type-mismatch finding) and lets the UI jump to it. */
  indices: number[];
}

/** The full Console Monitor result: what the modal renders and what the MCP tool returns. */
export interface ConsoleFindings {
  /** Total recognized-issue occurrences (sum of every finding's count). */
  totalIssues: number;
  /** Number of distinct issue types. */
  issueTypeCount: number;
  /** Non-zero category tallies, in {@link BRS_ERROR_CATEGORIES} display order. */
  byCategory: { category: BrsErrorCategory; count: number }[];
  /** Findings, most-frequent first. */
  findings: ConsoleFinding[];
  /** Recognized crashes (Micro Debugger dumps), most-frequent first. Separate from `findings` because a
   *  crash is a multi-line block with a backtrace, not a single diagnostic line. */
  crashes: BrsCrash[];
}

// ── Crash (Micro Debugger dump) detection ────────────────────────────────────────────────────────

/** A crash dump begins with one of these Micro Debugger banners. */
const CRASH_START = /^(?:brightscript micro debugger\.?|suspending threads\.{2,3}?)$/i;
/** The `Backtrace:` header that precedes the stack. */
const BACKTRACE_HEADER = /^backtrace:?$/i;
/** A stack frame header: `#4  Function fw_asstring(input As Dynamic) As String`. */
const FRAME_HEADER = /^#(\d+)\s+(?:function\s+)?(.*\S)?\s*$/i;
/** A stack frame location: `   file/line: pkg:/…xml(2305)`. */
const FRAME_LOCATION = /^\s*file\/line:\s*(.+?)\((\d+)\)\s*$/i;
/** The Micro Debugger's error line, which — unlike ordinary telnet — DOES carry the `&hXX` code:
 *  `Type Mismatch. Unable to cast "Integer" to "String". (runtime error &h18) in pkg:/…xml(2305)`. */
const RUNTIME_ERROR_LINE = /^(.*?)\s*\(runtime error (&h[0-9a-f]+)\)\s+in\s+(.+?)\((\d+)\)\s*$/i;
/** Roku's definitive fatal-crash exit line: `… UI: Exiting 'AVIA Reference App', id 'dev',
 *  EXIT_BRIGHTSCRIPT_CRASH, thrd 1538`. May appear with a Micro Debugger dump or on its own. */
const EXIT_CRASH_LINE = /EXIT_BRIGHTSCRIPT_CRASH/;
/** A fatal exit within this many lines AFTER a dump is treated as the SAME crash (marks it `exited`);
 *  beyond it, the exit stands alone. Generous because thread-teardown noise sits between them. */
const EXIT_CORRELATION_WINDOW = 150;

function crashKey(c: BrsCrash): string {
  return `${c.message}||${c.backtrace.map((f) => `${f.depth}:${f.file ?? ''}:${f.line ?? ''}`).join('>')}`;
}

/** Parse a buffered candidate block into a crash, or null when it isn't one (no backtrace with frames). */
function parseCrashBlock(block: readonly { text: string; index: number }[]): BrsCrash | null {
  const btIdx = block.findIndex((b) => BACKTRACE_HEADER.test(b.text.trim()));
  if (btIdx < 0) return null; // a Micro Debugger banner with no backtrace (e.g. a bare STOP) — not a crash

  const backtrace: BrsCrashFrame[] = [];
  for (let i = btIdx + 1; i < block.length; i++) {
    const t = block[i]!.text.trim();
    const head = FRAME_HEADER.exec(t);
    if (head) {
      backtrace.push({ depth: Number(head[1]), func: (head[2] ?? '').trim() });
      continue;
    }
    const loc = FRAME_LOCATION.exec(block[i]!.text);
    if (loc && backtrace.length > 0) {
      const frame = backtrace[backtrace.length - 1]!;
      frame.file = loc[1]!.trim();
      frame.line = Number(loc[2]);
    }
  }
  if (backtrace.length === 0) return null;

  // Error line = the last non-blank line before `Backtrace:`.
  let errorText = '';
  for (let i = btIdx - 1; i >= 0; i--) {
    if (block[i]!.text.trim()) {
      errorText = block[i]!.text.trim();
      break;
    }
  }
  let message = '';
  let code: string | undefined;
  let file: string | undefined;
  let line: number | undefined;
  const m = RUNTIME_ERROR_LINE.exec(errorText);
  if (m) {
    message = m[1]!.trim();
    code = m[2]!.toLowerCase();
    file = m[3]!.trim();
    line = Number(m[4]);
  } else if (errorText) {
    message = extractBrsErrorMessage(errorText);
    const loc = extractBrsErrorLocation(errorText);
    if (loc) {
      file = loc.file;
      line = loc.line;
    }
  }
  // Fall back to the innermost frame (highest #) for the crash site when the error line lacked one.
  if (!file && backtrace.length > 0) {
    const innermost = backtrace.reduce((a, b) => (b.depth > a.depth ? b : a));
    file = innermost.file;
    line = innermost.line;
  }
  if (!message) message = 'Crash (BrightScript Micro Debugger)';

  // `raw` for copy: the error line through the last backtrace line (skip the source-listing/digest noise).
  const rawStart = errorText ? block.findIndex((b) => b.text.trim() === errorText) : btIdx;
  const raw = block
    .slice(rawStart < 0 ? btIdx : rawStart)
    .map((b) => b.text)
    .join('\n');

  return {
    message,
    ...(code ? { code } : {}),
    ...(file ? { file } : {}),
    ...(line !== undefined ? { line } : {}),
    backtrace,
    count: 1,
    raw,
    indices: block.map((b) => b.index)
  };
}

/**
 * Stateful, streaming crash scanner. Feed every console/log line in order via `push(text, index)`
 * (`index` is the line's position — array index for the live buffer, file line number for the Log
 * Viewer), then call `finish()` for the deduped crashes. Streaming so the windowed Log Viewer's
 * main-process scan can detect crashes without holding the whole file resident; the live Console feeds
 * its whole buffer through the same code via {@link detectBrsCrashes}.
 */
export function createCrashScanner(): {
  push(text: string, index: number): void;
  finish(): BrsCrash[];
} {
  const dedup = new Map<string, BrsCrash>();
  let block: { text: string; index: number }[] = [];
  let phase: 'pre' | 'frames' = 'pre';
  /** Cap a candidate block so a lone banner (never followed by a backtrace) can't buffer unbounded. */
  const MAX_BLOCK_LINES = 600;
  /** The dump crash emitted most recently, so a fatal-exit line right after it marks the SAME crash. */
  let lastCrash: BrsCrash | null = null;
  let lastCrashEnd = -Infinity;

  const emit = (crash: BrsCrash): void => {
    const key = crashKey(crash);
    const existing = dedup.get(key);
    if (existing) {
      existing.count += 1;
      existing.indices.push(...crash.indices);
      lastCrash = existing;
    } else {
      dedup.set(key, crash);
      lastCrash = crash;
    }
    lastCrashEnd = Math.max(...crash.indices);
  };

  const finalize = (): void => {
    if (block.length === 0) return;
    const crash = parseCrashBlock(block);
    block = [];
    phase = 'pre';
    if (crash) emit(crash);
  };

  const start = (text: string, index: number): void => {
    block = [{ text, index }];
    phase = 'pre';
  };

  /** Handle a fatal `EXIT_BRIGHTSCRIPT_CRASH` line: attach it to the just-seen dump crash when close by,
   *  otherwise record it as an exit-only crash (a crash with no captured dump/backtrace). */
  const handleExit = (text: string, index: number): void => {
    const app = /Exiting\s+'([^']+)'/.exec(text)?.[1];
    if (lastCrash && index - lastCrashEnd <= EXIT_CORRELATION_WINDOW) {
      lastCrash.exited = true;
      if (app && !lastCrash.app) lastCrash.app = app;
      lastCrash.indices.push(index);
      return;
    }
    const message = app ? `App exited — BrightScript crash (${app})` : 'App exited — BrightScript crash';
    const key = `exit||${message}`;
    const existing = dedup.get(key);
    if (existing) {
      existing.count += 1;
      existing.indices.push(index);
    } else {
      dedup.set(key, {
        message,
        exited: true,
        ...(app ? { app } : {}),
        backtrace: [],
        count: 1,
        raw: text.trim(),
        indices: [index]
      });
    }
  };

  return {
    push(text, index) {
      const trimmed = text.trim();
      // A fatal-exit line can interleave with (or follow) a dump; close any open block first so it can
      // correlate against the completed crash.
      if (EXIT_CRASH_LINE.test(text)) {
        finalize();
        handleExit(text, index);
        return;
      }
      if (block.length === 0) {
        if (CRASH_START.test(trimmed) || RUNTIME_ERROR_LINE.test(trimmed)) start(text, index);
        return;
      }
      if (phase === 'pre') {
        // Consecutive banners ("BrightScript Micro Debugger." then "Suspending threads…") are one
        // dump's preamble — keep appending; the backtrace is what flips us into frame parsing.
        block.push({ text, index });
        if (BACKTRACE_HEADER.test(trimmed)) phase = 'frames';
        else if (block.length >= MAX_BLOCK_LINES) finalize();
        return;
      }
      // phase === 'frames': frames are contiguous `#N` / `file/line:` pairs; anything else ends the block.
      if (FRAME_HEADER.test(trimmed) || FRAME_LOCATION.test(text)) {
        block.push({ text, index });
        return;
      }
      finalize();
      // The line that ended the block may itself start the next dump.
      if (CRASH_START.test(trimmed) || RUNTIME_ERROR_LINE.test(trimmed)) start(text, index);
    },
    finish() {
      finalize();
      return Array.from(dedup.values()).sort((a, b) => b.count - a.count);
    }
  };
}

/** Batch convenience over {@link createCrashScanner}: detect crashes in an ordered list of console lines
 *  (the live Console feeds its resident buffer here; `index` is each line's array position). */
export function detectBrsCrashes(lines: readonly string[]): BrsCrash[] {
  const scanner = createCrashScanner();
  lines.forEach((text, i) => scanner.push(text, i));
  return scanner.finish();
}

/**
 * Per unique occurrence-text, how many source positions {@link computeConsoleFindings} retains. Bounds
 * the memory (and IPC payload, for the Log Viewer's main→renderer handoff) when one line repeats
 * thousands of times; the finding's `count` stays exact regardless of this cap.
 */
export const OCCURRENCE_POSITION_CAP = 200;

/**
 * Aggregate recognized BrightScript issues out of a set of console lines — the SINGLE source of truth
 * for the Console Monitor (the modal renders this; the `console_monitor_findings` MCP tool returns it).
 * `hasIssue` (precomputed by the panel) lets us skip non-issue lines; the recognizer is still the
 * authority for which catalog entry each issue line maps to.
 *
 * `index` (optional) is the source position stored on each occurrence so the UI can jump to it: the
 * Log Viewer's whole-file scan passes the 0-based file line number; the live Console omits it, so we
 * fall back to the entry's ordinal in `entries` (== its buffer/virtualizer row index).
 */
export function computeConsoleFindings(
  entries: readonly { text: string; hasIssue?: boolean; index?: number }[],
  crashes: readonly BrsCrash[] = []
): ConsoleFindings {
  const agg = new Map<
    string,
    { entry: BrsErrorEntry; count: number; lines: Map<string, { count: number; indices: number[] }> }
  >();
  const catCount = new Map<BrsErrorCategory, number>();
  let totalIssues = 0;

  // Lines already accounted for by a crash dump — excluded from the single-line pass so a crash isn't
  // ALSO counted as a stray "STOP statement" (its Micro Debugger banner) or a duplicate type-mismatch
  // (its error line). Same index space as `pos` / `e.index` below.
  const crashConsumed = new Set<number>();
  for (const c of crashes) for (const i of c.indices) crashConsumed.add(i);

  // Ordinal of the current entry within `entries` — the live Console's fallback position (it maps 1:1
  // to the virtualizer row index). Advances for EVERY entry, including skipped ones, so it stays aligned.
  let pos = -1;
  for (const e of entries) {
    pos++;
    const idx = e.index ?? pos;
    if (crashConsumed.has(idx)) continue;
    if (e.hasIssue === false) continue;
    const match = recognizeBrsIssue(e.text);
    if (!match) continue;
    totalIssues++;
    catCount.set(match.category, (catCount.get(match.category) ?? 0) + 1);
    let a = agg.get(match.id);
    if (!a) {
      a = { entry: match, count: 0, lines: new Map() };
      agg.set(match.id, a);
    }
    a.count++;
    let bucket = a.lines.get(e.text);
    if (!bucket) {
      bucket = { count: 0, indices: [] };
      a.lines.set(e.text, bucket);
    }
    bucket.count++;
    if (bucket.indices.length < OCCURRENCE_POSITION_CAP) bucket.indices.push(idx);
  }

  const findings: ConsoleFinding[] = [...agg.values()]
    .sort((x, y) => y.count - x.count)
    .map((a) => {
      const lines: ConsoleFindingLine[] = [...a.lines.entries()]
        .sort((x, y) => y[1].count - x[1].count)
        .map(([text, bucket]) => {
          const loc = extractBrsErrorLocation(text);
          const message = extractBrsErrorMessage(text);
          const { count, indices } = bucket;
          return loc
            ? { text, message, count, indices, file: loc.file, ...(loc.line !== undefined ? { line: loc.line } : {}) }
            : { text, message, count, indices };
        });
      // Header = the REAL message when every occurrence says the SAME thing (e.g. "FOR EACH value is
      // not an enumerable object"). When they differ per occurrence (e.g. unused-variable, where each
      // names a different variable/function), the specific text is misleading for the group — fall back
      // to the generic catalog title ("Unused variable"). The exact per-occurrence text still shows in
      // the log table below.
      const uniform = lines.length > 0 && lines.every((l) => l.message === lines[0]!.message);
      return {
        id: a.entry.id,
        title: a.entry.title,
        message: uniform ? lines[0]!.message || a.entry.title : a.entry.title,
        category: a.entry.category,
        severity: a.entry.severity,
        meaning: a.entry.meaning,
        cause: a.entry.cause,
        fix: a.entry.fix,
        ...(a.entry.docsUrl ? { docsUrl: a.entry.docsUrl } : {}),
        count: a.count,
        lines
      };
    });

  const byCategory = BRS_ERROR_CATEGORIES.map((category) => ({
    category,
    count: catCount.get(category) ?? 0
  })).filter((c) => c.count > 0);

  return { totalIssues, issueTypeCount: agg.size, byCategory, findings, crashes: [...crashes] };
}
