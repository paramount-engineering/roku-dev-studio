/**
 * BrightScript Debugger (socket-based debug protocol, port 8081).
 *
 * All user-facing text for the debugger UI (the device panel's Telnet Console
 * sidebar). Exported as `debuggerStrings` because `debugger` is a reserved word and can't be a binding
 * name; the parent index composes it into the catalog under the `debugger` key
 * (`S.debugger.*`). The non-English locale catalogs currently re-export this
 * English module as a placeholder — translate by giving each locale its own copy.
 */
export const debuggerStrings = {
  // Execution controls
  attach: 'Attach',
  detach: 'Detach',

  // Sideload-for-debug (Dev App panel checkbox)
  sideloadWithDebugging: 'Sideload with Debugging',
  sideloadWithDebuggingTitle: 'Reinstall with the BrightScript debug protocol (port 8081) enabled, then open the debugger.',

  // Shown (toggle disabled) when a remote-managed device's server reports `debugger: false`
  // from its /capabilities — an older or reduced-build remote server without the debug
  // protocol wired in.
  unsupportedByServerTitle: "This location's remote server does not support the BrightScript Debugger.",

  // Status labels
  status: {
    idle: 'Not attached',
    connecting: 'Connecting…',
    attached: 'Attached',
    running: 'Running',
    stopped: 'Stopped',
    error: 'Error',
    disconnected: 'Disconnected',
  },

  // Execution-control toolbar
  continue: 'Continue',
  pause: 'Pause',
  stepOver: 'Step Over',
  stepIn: 'Step In',
  stepOut: 'Step Out',
  // Compact labels for the Telnet sidebar toolbar
  stepOverShort: 'Over',
  stepInShort: 'In',
  stepOutShort: 'Out',
  stop: 'Stop & Exit App',
  waitingForStop: 'Running — set a STOP / breakpoint to inspect.',

  // Telnet Console debug sidebar
  panelToggle: 'Toggle Debug Panel',

  // Panes
  dragToResize: 'Drag to resize · double-click to reset',
  callStackTitle: 'Threads & Call Stack',
  variablesTitle: 'Variables',
  breakpointsTitle: 'Breakpoints',
  callStackEmpty: 'No stack — attach and stop at a breakpoint.',
  variablesEmpty: 'No variables to show.',
  breakpointsEmpty: 'No breakpoints — add one, or they appear as STOPs are found / hit.',

  // Breakpoints management
  addBreakpoint: 'Add Breakpoint',
  editBreakpoint: 'Edit Breakpoint',
  removeBreakpoint: 'Remove Breakpoint',
  breakpointPlaceholder: 'pkg:/source/main.brs:42',
  breakpointConditionPlaceholder: 'Condition (e.g. i = 500) — optional',
  bpNeedsLine: 'Include a line number, e.g. pkg:/source/Main.brs:42',
  bpSourceScanned: 'STOP statement in source',
  bpSourceHit: 'Hit at runtime',
  bpSourceManaged: 'Breakpoint you set',
  bpVerified: 'Verified by device',
  bpInvalid: 'Rejected by device',
  bpConditional: 'Conditional breakpoint',
  bpConditionRequiresOs: 'Breakpoint conditions require Roku OS 11.5 or newer — added without a condition.',
  bpQueuedUntilStop: 'Breakpoints only register while the app is stopped — this one will take effect at the next stop.',
  bpRejected: (msg: string): string => `Breakpoint rejected${msg ? `: ${msg}` : ''}`,

  // Threads
  threadPrimary: 'primary',

  // Fallback labels for an unnamed call-stack frame / thread / variable (the wire payload
  // omitted the name); the frame/thread ones are parametrized by index.
  frameN: (i: number): string => `frame ${i}`,
  threadN: (i: number): string => `thread ${i}`,
  anonVar: '(anon)',
  containerType: 'container',

  // Watch expressions
  watchTitle: 'Watch',
  addWatch: 'Add Watch',
  editWatch: 'Edit Watch',
  removeWatch: 'Remove Watch',
  watchPlaceholder: 'Expression (e.g. m.top.count)',
  watchEmpty: 'No watches — add an expression to track across stops.',
  watchUnavailable: 'unavailable',

  // Restart / relaunch
  restart: 'Restart',
  restartTitle: 'Re-sideload with debugging and reattach',
  restarting: 'Restarting…',
  restartNoPassword: 'Enter the developer password in the Dev App tab first, then Restart.',

  // Runtime / compile errors
  runtimeError: (msg: string): string => `Runtime error${msg ? `: ${msg}` : ''}`,
  compileErrorTitle: 'Compile error',

  // REPL / debug console (slides up under the console output while stopped)
  replTitle: 'Debug Console',
  replPlaceholder: 'Evaluate BrightScript in the current frame — e.g. print m.top',

  // Parametrized notices
  discoveredToast: (n: number): string => `Found ${n} breakpoint${n === 1 ? '' : 's'} — Debugger enabled`,
  attachFailed: (reason: string): string => `Could not attach: ${reason}`,

  // Attach failure — a compact status summary (the status dot + a "Why?" button) with the
  // full remediation on demand: the dot's hover tooltip, and clicking either opens the modal.
  attachWhy: 'Why?',
  attachErrorTitle: 'Debugger Attach Failed',

  // Cross-tab stop alerts (a device halts while you're on another tab / section).
  stoppedAlert: (device: string, loc: string): string => `${device} stopped${loc ? ` at ${loc}` : ''}`,
  stoppedAlertError: (device: string, loc: string): string => `${device} — runtime error${loc ? ` at ${loc}` : ''}`,
  stoppedTabTooltip: (loc: string): string => `⏸ Stopped${loc ? ` at ${loc}` : ''}`,
} as const;
