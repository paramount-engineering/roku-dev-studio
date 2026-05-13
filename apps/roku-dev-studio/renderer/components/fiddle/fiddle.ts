/**
 * BrightScript Fiddle window renderer.
 *
 * UI flow:
 *   1. Preload exposes `window.fiddle.*`.
 *   2. On load we call `fiddle.ready()`; main replies with `onInit` (device list + initial selection).
 *   3. Monaco loads from ./dist/vendor/monaco via the AMD loader.
 *   4. Each edit debounces a `fiddle.lint(code)` round-trip (brighterscript in main);
 *      results are painted as Monaco markers and gate the Run button.
 *   5. Run calls `fiddle.run({ deviceId, code })`; output arrives via `onTerminalData`.
 */

export {};

type MonacoNamespace = typeof import('monaco-editor');
type MonacoEditor = import('monaco-editor').editor.IStandaloneCodeEditor;

interface AmdLoader {
  (deps: string[], cb: (...args: unknown[]) => void): void;
  config: (cfg: { paths: Record<string, string>; 'vs/nls'?: Record<string, string> }) => void;
}

declare global {
  interface Window {
    fiddle?: FiddleBridge;
    monaco?: MonacoNamespace;
  }
}

function amd(): AmdLoader | undefined {
  return (window as unknown as { require?: AmdLoader }).require;
}
function getWindowFiddle(): FiddleBridge {
  const bridge = (window as unknown as { fiddle?: FiddleBridge }).fiddle;
  if (!bridge) throw new Error('window.fiddle bridge is not available (preload failed).');
  return bridge;
}
function getWindowMonaco(): MonacoNamespace | undefined {
  return (window as unknown as { monaco?: MonacoNamespace }).monaco;
}

interface FiddleDeviceEntry {
  id: string;
  ip: string;
  name: string;
  modelName?: string;
  isRemote: boolean;
  serverUrl?: string | null;
  password?: string;
}

interface FiddleInitPayload {
  devices: FiddleDeviceEntry[];
  initialDeviceId: string | null;
}

interface FiddleDiagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  line: number; // 1-based
  column: number; // 1-based
  endLine?: number;
  endColumn?: number;
  code?: string | number;
}

interface FiddleDiagnosticsPayload {
  diagnostics: FiddleDiagnostic[];
}

interface FiddleRunResultPayload {
  success: boolean;
  error?: string;
  /** Set by main when the device rejected our developer password. The renderer
   * drops any session-cached password, re-opens the modal, and lets the user
   * retype — a persisted copy (if any) has already been cleared upstream. */
  authFailed?: boolean;
  runId?: string;
  deviceId?: string;
}

interface FiddleTerminalDataPayload {
  ip: string;
  data: string;
  isRemote?: boolean;
}

interface FiddleBridge {
  ready: () => void;
  refreshDevices: () => void;
  lint: (code: string) => Promise<FiddleDiagnosticsPayload | { error?: string }>;
  run: (payload: { deviceId: string; code: string; password?: string }) => Promise<FiddleRunResultPayload>;
  stop: (payload: { deviceId: string; password?: string }) => Promise<{ success: boolean; error?: string; authFailed?: boolean }>;
  onInit: (cb: (data: FiddleInitPayload) => void) => () => void;
  onDevicesUpdate: (cb: (data: { devices: FiddleDeviceEntry[] }) => void) => () => void;
  onTerminalData: (cb: (data: FiddleTerminalDataPayload) => void) => () => void;
  onTerminalCleared: (cb: () => void) => () => void;
  onRunResult: (cb: (data: FiddleRunResultPayload) => void) => () => void;
  onScanStatus: (cb: (data: { scanning: boolean }) => void) => () => void;
  /** Resolves with the current Privacy Mode state. The same handler the main
   * window uses; null when the bridge wasn't built with the privacy surface
   * (defensive for older preload bundles). */
  getPrivacyMode?: () => Promise<{ enabled: boolean }>;
  onPrivacyModeChanged?: (cb: (enabled: boolean) => void) => () => void;
}

/** Placeholder shown for IPs in the device dropdown when Privacy Mode is on.
 * `<select><option>` text isn't reliably stylable with `filter: blur` in
 * Chromium (the native popup ignores most CSS), so we mask the data itself
 * instead of trying to blur it visually. */
const PRIVACY_IP_MASK = '•••.•••.•••.•••';

const DEFAULT_SNIPPET = [
  "' `userFiddle` is the entry point Fiddle runs after the channel is on-screen.",
  "' Put your snippet here — you can also define helper subs/functions below and call them from userFiddle. Do NOT define a sub named `init` — that identifier is reserved by the Fiddle scene.",
  'Sub userFiddle()',
  '    print "Hello from Roku Dev Studio Fiddle"',
  'End Sub',
  ''
].join('\n');

// NB: unanchored. The Roku 8085 stream routinely concatenates a user print
// with the trailing beacon log on one physical line (e.g.
// `…Duration(745 ms)[FIDDLE_BEGIN:xxxxxx]`). Matching anywhere on the line
// ensures the program-only filter finds the sentinel.
const BEGIN_RE = /\[FIDDLE_BEGIN:([A-Za-z0-9_-]+)\]/;
const END_RE = /\[FIDDLE_END:([A-Za-z0-9_-]+)\]/;

// BrightScript Monarch tokens — minimal subset for visual highlighting.
const BRIGHTSCRIPT_MONARCH = {
  defaultToken: '',
  ignoreCase: true,
  keywords: [
    'sub', 'function', 'end', 'return', 'if', 'then', 'else', 'endif',
    'for', 'to', 'step', 'next', 'while', 'exitwhile', 'endwhile', 'exitfor',
    'true', 'false', 'invalid', 'dim', 'as', 'void', 'string', 'integer',
    'float', 'double', 'boolean', 'object', 'dynamic', 'print', 'stop',
    'goto', 'let', 'and', 'or', 'not', 'mod', 'in', 'library'
  ],
  typeKeywords: ['integer', 'float', 'double', 'string', 'boolean', 'object', 'dynamic', 'void'],
  operators: [
    '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=', '<>',
    '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%', '<<', '>>', '>>>',
    '+=', '-=', '*=', '/=', '&=', '|=', '^=', '%=', '<<=', '>>=', '>>>='
  ],
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  tokenizer: {
    root: [
      [/'.*$/, 'comment'],
      [/\brem\b.*$/, 'comment'],
      [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
      [
        /[A-Za-z_][\w]*/,
        {
          cases: {
            '@keywords': 'keyword',
            '@typeKeywords': 'type',
            '@default': 'identifier'
          }
        }
      ],
      [/\d+\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],
      [/[{}()[\]]/, '@brackets'],
      [
        /@symbols/,
        {
          cases: {
            '@operators': 'operator',
            '@default': ''
          }
        }
      ]
    ],
    string: [
      [/[^"]+/, 'string'],
      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
    ]
  }
};

interface RunSession {
  runId: string;
  active: boolean; // whether we're still within BEGIN/END window
  beginSeen: boolean;
  endSeen: boolean;
}

interface FiddleCtx {
  monaco: MonacoNamespace;
  editor: MonacoEditor;
  model: import('monaco-editor').editor.ITextModel;
  devices: FiddleDeviceEntry[];
  selectedDeviceId: string | null;
  currentRun: RunSession | null;
  hasErrors: boolean;
  isRunning: boolean;
  /** True once a Run has successfully sideloaded a fiddle channel and we haven't
   * stopped it yet. Drives the Stop button's enabled state — no point offering
   * "Stop" when nothing has been run. */
  hasActiveFiddle: boolean;
  /** The device id that currently has an active fiddle channel installed. We
   * only offer Stop for that same device (switching the dropdown to another
   * device shouldn't stop the first one from here). */
  activeFiddleDeviceId: string | null;
  /** When true, incoming telnet chunks are dropped until one arrives that
   * contains the `[FIDDLE_BEGIN:…]` marker. Flipped on at Run-click so trailing
   * output from the previous channel (which is still being flushed by Roku
   * during the telnet reconnect / sideload bounce) never appears in the new
   * run's terminal. Opens automatically on the BEGIN marker or when the run
   * fails/completes from the host's side. */
  suppressUntilBegin: boolean;
  rawBuffer: string[]; // completed lines (each without the trailing newline)
  /** Partial line that hasn't been terminated by `\n` yet. Kept OUT of
   * `rawBuffer` so a completed line never gets accidentally concatenated with
   * the next chunk (which would merge two Roku prints onto one visual line). */
  trailingPartial: string;
  /** Passwords entered for devices during this window's lifetime (keyed by deviceId). */
  sessionPasswords: Map<string, string>;
  /** Mirror of the global Privacy Mode toggle. When true, the device dropdown
   * masks IPs at the data layer and the password modal blurs its IP via CSS
   * (`body.privacy-mode .fiddle-modal-device-ip`). Updated by the
   * `onPrivacyModeChanged` listener so menu/Settings toggles flow through. */
  privacyModeEnabled: boolean;
  els: {
    deviceSelect: HTMLSelectElement;
    runBtn: HTMLButtonElement;
    stopBtn: HTMLButtonElement;
    clearBtn: HTMLButtonElement;
    clearCodeBtn: HTMLButtonElement;
    refreshBtn: HTMLButtonElement;
    terminal: HTMLDivElement;
    status: HTMLElement;
    diagStatus: HTMLElement;
    passwordModal: HTMLElement;
    passwordInput: HTMLInputElement;
    passwordSubmit: HTMLButtonElement;
    passwordCancel: HTMLButtonElement;
    passwordCancelBtn: HTMLButtonElement;
    passwordError: HTMLElement;
    passwordDeviceLabel: HTMLElement;
  };
}

function qs<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
}

function loadMonaco(): Promise<MonacoNamespace> {
  return new Promise((resolve, reject) => {
    const existing = getWindowMonaco();
    if (existing) {
      resolve(existing);
      return;
    }
    const loader = amd();
    if (!loader || typeof loader.config !== 'function') {
      reject(new Error('Monaco AMD loader did not initialize.'));
      return;
    }
    const baseUrl = window.location.href.replace(/fiddle\.html.*/, '') + 'dist/vendor/monaco';
    loader.config({ paths: { vs: `${baseUrl}/vs` } });
    loader(['vs/editor/editor.main'], () => {
      const m = getWindowMonaco();
      if (!m) {
        reject(new Error('Monaco loaded but window.monaco is missing.'));
        return;
      }
      resolve(m);
    });
  });
}

function registerBrightScriptLanguage(monaco: MonacoNamespace): void {
  const existing = monaco.languages.getLanguages().some((l) => l.id === 'brightscript');
  if (existing) return;
  monaco.languages.register({ id: 'brightscript', extensions: ['.brs', '.bs'], aliases: ['BrightScript', 'brs'] });
  monaco.languages.setMonarchTokensProvider('brightscript', BRIGHTSCRIPT_MONARCH as never);
  monaco.languages.setLanguageConfiguration('brightscript', {
    comments: { lineComment: "'" },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')']
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' }
    ]
  });
}

function fmtLineText(text: string): string {
  return text.replace(/\r/g, '');
}

// Matches a Roku telnet system-log timestamp prefix. `app` and `sdkl` are the
// two common emitters; the bracketed tag (e.g. `[beacon.signal]`) is optional
// because some lines wrap without it. The `g` flag is required for scanning
// concatenated lines.
const SYS_TS_RE = /(\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} (?:app|sdkl)(?: \[[^\]]*\])?)/g;

interface TermSegment {
  text: string;
  kind: 'user' | 'system' | 'begin' | 'end' | 'error';
}

/**
 * Break a single telnet-delivered line into alternating user / system segments.
 * The Roku debug stream often concatenates a user `print` with a system log
 * chunk on the same physical line (no newline in between); scanning for the
 * timestamp prefix lets us dim the noise while keeping user output bright.
 */
function segmentTerminalLine(line: string): TermSegment[] {
  const cleaned = fmtLineText(line);
  if (!cleaned) return [{ text: '', kind: 'user' }];
  // Only short-circuit to a pure `begin` / `end` styled line when the line is
  // exclusively the sentinel (optionally padded). If the marker is embedded
  // alongside other content, fall through to the regular timestamp splitter
  // so the non-marker portion still gets classified correctly.
  const trimmed = cleaned.trim();
  if (/^\[FIDDLE_BEGIN:[A-Za-z0-9_-]+\]$/.test(trimmed)) return [{ text: cleaned, kind: 'begin' }];
  if (/^\[FIDDLE_END:[A-Za-z0-9_-]+\]$/.test(trimmed)) return [{ text: cleaned, kind: 'end' }];
  // Scaffold bookends that flank the user's output. Style them like the
  // sentinels so the run boundary is obvious in the terminal.
  if (/^Started at\s+\S/.test(trimmed)) return [{ text: cleaned, kind: 'begin' }];
  if (/^Finished in\s+\d+\s+ms$/.test(trimmed)) return [{ text: cleaned, kind: 'end' }];

  const segments: TermSegment[] = [];
  const re = new RegExp(SYS_TS_RE.source, 'g');
  let lastEnd = 0;
  const matches: Array<{ start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    matches.push({ start: m.index, end: re.lastIndex });
    if (m.index === re.lastIndex) re.lastIndex += 1; // safety for zero-width
  }

  if (matches.length === 0) {
    // No timestamp — classify by a few lightweight heuristics.
    const isSeparator = /^-{3,}\s/.test(cleaned) || /-{3,}$/.test(cleaned);
    const looksLikeError = /\bSyntax Error\b|\bCompile error\b|\bCompilation Failed\b/i.test(cleaned);
    if (looksLikeError) return [{ text: cleaned, kind: 'error' }];
    return [{ text: cleaned, kind: isSeparator ? 'system' : 'user' }];
  }

  // User text before the first timestamp.
  if (matches[0].start > 0) {
    segments.push({ text: cleaned.slice(0, matches[0].start), kind: 'user' });
  }
  // Each system chunk runs from its timestamp until the next one (or EOL).
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].start;
    const nextStart = i + 1 < matches.length ? matches[i + 1].start : cleaned.length;
    segments.push({ text: cleaned.slice(start, nextStart), kind: 'system' });
    lastEnd = nextStart;
  }
  void lastEnd;
  return segments;
}

function renderTerminalLine(line: string): HTMLDivElement {
  const segments = segmentTerminalLine(line);
  const div = document.createElement('div');
  div.className = 'term-line';
  if (segments.length === 1) {
    const only = segments[0];
    if (only.kind === 'begin') div.classList.add('begin');
    else if (only.kind === 'end') div.classList.add('end');
    else if (only.kind === 'error') div.classList.add('error');
    else if (only.kind === 'system') div.classList.add('system');
    else div.classList.add('user');
  } else {
    div.classList.add('mixed');
  }
  for (const seg of segments) {
    const span = document.createElement('span');
    span.className = `term-seg term-seg-${seg.kind}`;
    span.textContent = seg.text;
    div.appendChild(span);
  }
  return div;
}

function renderTerminal(ctx: FiddleCtx): void {
  const terminal = ctx.els.terminal;
  terminal.textContent = '';
  for (const line of ctx.rawBuffer) {
    terminal.appendChild(renderTerminalLine(line));
  }
  // Also render the in-progress trailing partial (no newline yet) so the user
  // isn't staring at a blank line at the bottom while Roku is buffering.
  if (ctx.trailingPartial && ctx.trailingPartial.length > 0) {
    terminal.appendChild(renderTerminalLine(ctx.trailingPartial));
  }
  terminal.scrollTop = terminal.scrollHeight;
}

function appendTerminalChunk(ctx: FiddleCtx, data: string): void {
  // A completed line never moves back out of rawBuffer once it's in, so we
  // can't accidentally merge it with a later chunk. Only the partial tail
  // (content received after the last `\n`) stays in `trailingPartial`.
  const joined = (ctx.trailingPartial || '') + data;
  const parts = joined.split(/\r?\n/);
  // `split` always yields at least one element; the last element is whatever
  // came after the final newline (possibly the empty string when the chunk
  // ended cleanly with `\n`).
  ctx.trailingPartial = parts.pop() ?? '';
  for (const p of parts) {
    ctx.rawBuffer.push(p);
  }
  renderTerminal(ctx);
}

function clearTerminal(ctx: FiddleCtx): void {
  ctx.rawBuffer.length = 0;
  ctx.trailingPartial = '';
  renderTerminal(ctx);
}

function updateRunButton(ctx: FiddleCtx): void {
  const deviceOk = !!ctx.selectedDeviceId;
  ctx.els.runBtn.disabled = ctx.isRunning || !deviceOk || ctx.hasErrors;

  // Stop is only useful when a fiddle is currently sideloaded *on the selected
  // device*. Keep it disabled otherwise (including during an active Run).
  const canStop =
    !!ctx.hasActiveFiddle &&
    !!ctx.activeFiddleDeviceId &&
    ctx.activeFiddleDeviceId === ctx.selectedDeviceId &&
    !ctx.isRunning;
  ctx.els.stopBtn.disabled = !canStop;
}

type StatusClass = 'error' | 'success' | 'running' | '';

function paintStatus(statusEl: HTMLElement, text: string, cls?: StatusClass): void {
  statusEl.textContent = text;
  statusEl.classList.remove('error', 'success', 'running');
  if (cls) statusEl.classList.add(cls);
}

function setStatus(ctx: FiddleCtx, text: string, cls?: StatusClass): void {
  paintStatus(ctx.els.status, text, cls);
}

function renderDeviceOptions(
  ctx: FiddleCtx,
  devices: FiddleDeviceEntry[],
  preserveSelection = true,
  forcedInitialDeviceId: string | null = null
): void {
  const sel = ctx.els.deviceSelect;
  const prev = preserveSelection ? ctx.selectedDeviceId : null;
  ctx.devices = devices;
  sel.innerHTML = '';

  // Always lead with a disabled "Select a device" placeholder so an explicit
  // choice is required before Run is enabled (matches how the rest of the app
  // treats device selection).
  const placeholder = document.createElement('option');
  placeholder.value = '';
  // The snapshot coming from the main window is already filtered to
  // dev-enabled devices (Fiddle can't sideload anywhere else), so an empty
  // list means the user has no dev-enabled Rokus on the LAN / remote relays.
  placeholder.textContent = devices.length ? 'Select a device' : 'No dev-enabled devices found';
  placeholder.disabled = true;
  sel.appendChild(placeholder);

  for (const d of devices) {
    const opt = document.createElement('option');
    opt.value = d.id;
    const label = d.name || d.modelName || 'Roku';
    // Lead with `[Remote]` on relay-reachable devices so it's the first thing
    // the user scans before the name; local devices just show "name (ip)".
    const remotePrefix = d.isRemote ? '[Remote] ' : '';
    // When Privacy Mode is on, mask the IP at the data layer — `<option>` text
    // can't be reliably blurred via CSS in Chromium's native picker, so the
    // only way to hide it from screen-share / over-the-shoulder viewers is
    // to substitute the visible characters.
    const ipText = ctx.privacyModeEnabled ? PRIVACY_IP_MASK : d.ip;
    opt.textContent = `${remotePrefix}${label} (${ipText})`;
    sel.appendChild(opt);
  }

  // Selection precedence:
  //   1. `forcedInitialDeviceId` — caller explicitly wants this id picked
  //      (used on the very first paint when the Fiddle window was opened
  //      from a device panel with that device pre-selected).
  //   2. The previously-selected id, if still present in the new snapshot
  //      (so live device-list refreshes don't clobber the user's choice).
  //   3. Fall back to the placeholder so the user consciously picks one.
  if (forcedInitialDeviceId && devices.some((d) => d.id === forcedInitialDeviceId)) {
    sel.value = forcedInitialDeviceId;
    ctx.selectedDeviceId = forcedInitialDeviceId;
  } else if (prev && devices.some((d) => d.id === prev)) {
    sel.value = prev;
    ctx.selectedDeviceId = prev;
  } else {
    sel.value = '';
    ctx.selectedDeviceId = null;
  }
  updateRunButton(ctx);
}

function applyDiagnostics(ctx: FiddleCtx, diagnostics: FiddleDiagnostic[]): void {
  const monaco = ctx.monaco;
  const markers = diagnostics.map<import('monaco-editor').editor.IMarkerData>((d) => ({
    severity: d.severity === 'error'
      ? monaco.MarkerSeverity.Error
      : d.severity === 'warning'
        ? monaco.MarkerSeverity.Warning
        : d.severity === 'info'
          ? monaco.MarkerSeverity.Info
          : monaco.MarkerSeverity.Hint,
    message: d.message,
    startLineNumber: Math.max(1, d.line),
    startColumn: Math.max(1, d.column),
    endLineNumber: Math.max(1, d.endLine ?? d.line),
    endColumn: Math.max(1, d.endColumn ?? d.column + 1),
    code: d.code != null ? String(d.code) : undefined
  }));
  monaco.editor.setModelMarkers(ctx.model, 'brighterscript', markers);

  const errCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warnCount = diagnostics.filter((d) => d.severity === 'warning').length;
  ctx.hasErrors = errCount > 0;
  const diagEl = ctx.els.diagStatus;
  diagEl.classList.remove('clean');
  if (errCount === 0 && warnCount === 0) {
    diagEl.textContent = 'No issues';
    diagEl.classList.add('clean');
  } else if (errCount === 0) {
    diagEl.textContent = `${warnCount} warning${warnCount === 1 ? '' : 's'}`;
  } else {
    diagEl.textContent = `${errCount} error${errCount === 1 ? '' : 's'}${warnCount ? `, ${warnCount} warning${warnCount === 1 ? '' : 's'}` : ''}`;
  }
  diagEl.onclick = () => {
    if (!diagnostics.length) return;
    const first = diagnostics.find((d) => d.severity === 'error') || diagnostics[0];
    ctx.editor.revealLineInCenter(first.line);
    ctx.editor.setPosition({ lineNumber: first.line, column: first.column });
    ctx.editor.focus();
  };
  updateRunButton(ctx);
}

function scheduleLint(ctx: FiddleCtx): () => void {
  let timer: number | null = null;
  const run = () => {
    timer = null;
    const code = ctx.model.getValue();
    void getWindowFiddle()
      .lint(code)
      .then((res) => {
        const diags = (res as FiddleDiagnosticsPayload)?.diagnostics;
        if (Array.isArray(diags)) applyDiagnostics(ctx, diags);
      })
      .catch((err: unknown) => {
        console.error('[Fiddle] lint failed:', err);
      });
  };
  const trigger = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(run, 300);
  };
  ctx.model.onDidChangeContent(() => trigger());
  trigger();
  return () => {
    if (timer !== null) window.clearTimeout(timer);
  };
}

/**
 * Resolve a dev password for the selected device. Resolution order:
 *   1. snapshot.password — a password persisted in the main window's
 *      localStorage (the only place Fiddle reads persisted creds from).
 *   2. session cache — a modal-entered password from earlier in this
 *      Fiddle window's lifetime.
 *   3. modal prompt — always session-scoped; the Fiddle window never writes
 *      to persistent storage. Returns `null` if the user cancels.
 */
async function resolveDevicePassword(
  ctx: FiddleCtx,
  device: FiddleDeviceEntry
): Promise<string | null> {
  if (device.password) return device.password;
  const session = ctx.sessionPasswords.get(device.id);
  if (session) return session;
  return openPasswordModal(ctx, device);
}

function openPasswordModal(
  ctx: FiddleCtx,
  device: FiddleDeviceEntry
): Promise<string | null> {
  return new Promise((resolve) => {
    const modal = ctx.els.passwordModal;
    const input = ctx.els.passwordInput;
    const submit = ctx.els.passwordSubmit;
    const cancel = ctx.els.passwordCancel;
    const cancelBtn = ctx.els.passwordCancelBtn;
    const errorEl = ctx.els.passwordError;
    const label = ctx.els.passwordDeviceLabel;

    // Build the device label as structured spans so CSS can blur just the IP
    // when Privacy Mode is on (see `body.privacy-mode .fiddle-modal-device-ip`
    // in fiddle.css). `textContent` is reset below to clear any previous run.
    label.textContent = '';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'fiddle-modal-device-name';
    nameSpan.textContent = device.name || 'Roku';
    const sepSpan = document.createElement('span');
    sepSpan.className = 'fiddle-modal-device-sep';
    sepSpan.textContent = ' — ';
    const ipSpan = document.createElement('span');
    ipSpan.className = 'fiddle-modal-device-ip';
    ipSpan.textContent = device.ip;
    label.appendChild(nameSpan);
    label.appendChild(sepSpan);
    label.appendChild(ipSpan);
    input.value = '';
    errorEl.hidden = true;
    errorEl.textContent = '';
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => input.focus(), 20);

    const close = (result: string | null) => {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      submit.removeEventListener('click', onSubmit);
      cancel.removeEventListener('click', onCancel);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKeydown);
      document.removeEventListener('keydown', onEscape, true);
      resolve(result);
    };
    const onSubmit = () => {
      const pwd = input.value;
      if (!pwd) {
        errorEl.hidden = false;
        errorEl.textContent = 'Password is required.';
        input.focus();
        return;
      }
      close(pwd);
    };
    const onCancel = () => close(null);
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSubmit();
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    submit.addEventListener('click', onSubmit);
    cancel.addEventListener('click', onCancel);
    cancelBtn.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKeydown);
    document.addEventListener('keydown', onEscape, true);
  });
}

async function handleRun(ctx: FiddleCtx): Promise<void> {
  const deviceId = ctx.selectedDeviceId;
  if (!deviceId) {
    setStatus(ctx, 'Select a device first.', 'error');
    return;
  }
  const device = ctx.devices.find((d) => d.id === deviceId);
  if (!device) {
    setStatus(ctx, 'Selected device is no longer available.', 'error');
    return;
  }

  // Ensure we have a password (snapshot → session cache → modal). Fiddle
  // never writes to persistent storage; modal-entered passwords live only
  // for this window's lifetime, and auth failures evict them so the next
  // Run reprompts fresh.
  const password = await resolveDevicePassword(ctx, device);
  if (!password) {
    setStatus(ctx, 'Run cancelled — password required.', 'error');
    return;
  }
  ctx.sessionPasswords.set(device.id, password);

  const code = ctx.model.getValue();
  ctx.isRunning = true;
  updateRunButton(ctx);
  setStatus(ctx, 'Running...', 'running');

  // Prepare a fresh run session and wipe all buffers so the previous run's
  // output never bleeds into the new one, even if the main-process clear IPC
  // happens to race with incoming telnet data. The `suppressUntilBegin` gate
  // drops any trailing chunks from the previous channel that arrive during
  // the telnet-reconnect + sideload window — we resume accepting data the
  // moment we see the new run's `[FIDDLE_BEGIN:…]` marker.
  ctx.currentRun = { runId: '', active: false, beginSeen: false, endSeen: false };
  ctx.suppressUntilBegin = true;
  clearTerminal(ctx);

  try {
    const res = await getWindowFiddle().run({
      deviceId,
      code,
      password
    });
    if (res && res.runId) {
      // Update the runId now that main assigned one.
      ctx.currentRun = { runId: res.runId, active: false, beginSeen: false, endSeen: false };
    }
    if (!res || !res.success) {
      setStatus(ctx, res?.error || 'Run failed.', 'error');
      ctx.currentRun = null;
      if (res && res.authFailed) {
        // The Roku rejected this password. Drop the session copy so the next
        // Run click goes back through the modal instead of silently retrying
        // the same bad password. Any persisted copy in the main window has
        // already been wiped by main-process bookkeeping.
        ctx.sessionPasswords.delete(deviceId);
      }
    } else {
      // Sideload succeeded on the device — Roku will now compile + launch the
      // channel and eventually print [FIDDLE_BEGIN:…]. onTerminalData takes
      // over status updates from here, flipping to "Running on device…" when
      // BEGIN arrives and "Run complete." when END arrives.
      setStatus(ctx, 'Sideload complete — waiting for output…', 'running');
      ctx.hasActiveFiddle = true;
      ctx.activeFiddleDeviceId = deviceId;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(ctx, `Run failed: ${msg}`, 'error');
    ctx.currentRun = null;
  } finally {
    ctx.isRunning = false;
    updateRunButton(ctx);
  }
}

/**
 * Reset the editor back to the default `Sub userFiddle()` template. Also clears the
 * terminal so the window feels fully cleared. If the current content is already
 * the default (or the editor is empty) we skip the confirm.
 */
function handleResetCode(ctx: FiddleCtx): void {
  const current = ctx.model.getValue();
  const isAlreadyDefault = current === DEFAULT_SNIPPET || current.trim() === '';
  if (!isAlreadyDefault) {
    const ok = window.confirm('Reset the editor to the default snippet? Unsaved changes will be lost.');
    if (!ok) return;
  }
  ctx.model.setValue(DEFAULT_SNIPPET);
  ctx.editor.setPosition({ lineNumber: 2, column: 5 });
  ctx.editor.focus();
  clearTerminal(ctx);
  setStatus(ctx, 'Editor reset to default snippet.', 'success');
}

async function handleStop(ctx: FiddleCtx): Promise<void> {
  // Stop always targets the device that currently has our Fiddle channel
  // installed, not whichever device is selected in the dropdown — the UI
  // keeps those in sync, but being explicit prevents mis-targeting if that
  // invariant ever changes.
  const deviceId = ctx.activeFiddleDeviceId || ctx.selectedDeviceId;
  if (!deviceId) return;
  const session = ctx.sessionPasswords.get(deviceId);
  ctx.isRunning = true;
  updateRunButton(ctx);
  setStatus(ctx, 'Uninstalling...', 'running');
  try {
    const res = await getWindowFiddle().stop({ deviceId, password: session });
    if (res && res.success) {
      setStatus(ctx, 'Fiddle channel removed.', 'success');
      if (ctx.activeFiddleDeviceId === deviceId) {
        ctx.hasActiveFiddle = false;
        ctx.activeFiddleDeviceId = null;
      }
    } else {
      setStatus(ctx, res?.error || 'Stop failed.', 'error');
      if (res && res.authFailed) {
        ctx.sessionPasswords.delete(deviceId);
      }
    }
  } catch (err: unknown) {
    setStatus(ctx, err instanceof Error ? err.message : String(err), 'error');
  } finally {
    ctx.currentRun = null;
    ctx.isRunning = false;
    updateRunButton(ctx);
  }
}

function bindEvents(ctx: FiddleCtx): void {
  ctx.els.deviceSelect.addEventListener('change', () => {
    ctx.selectedDeviceId = ctx.els.deviceSelect.value || null;
    updateRunButton(ctx);
  });
  ctx.els.runBtn.addEventListener('click', () => {
    void handleRun(ctx);
  });
  ctx.els.stopBtn.addEventListener('click', () => {
    void handleStop(ctx);
  });
  ctx.els.clearBtn.addEventListener('click', () => clearTerminal(ctx));
  ctx.els.clearCodeBtn.addEventListener('click', () => handleResetCode(ctx));
  ctx.els.refreshBtn.addEventListener('click', () => {
    if (ctx.els.refreshBtn.disabled) return;
    setRefreshScanning(ctx, true);
    getWindowFiddle().refreshDevices();
  });

  // Cmd/Ctrl + Enter runs the snippet.
  ctx.editor.addAction({
    id: 'rds-fiddle.run',
    label: 'Run on Device',
    keybindings: [ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyCode.Enter],
    contextMenuGroupId: 'navigation',
    run: () => {
      if (!ctx.els.runBtn.disabled) void handleRun(ctx);
    }
  });

  // Wire main-process events
  const bridge = getWindowFiddle();
  bridge.onDevicesUpdate((payload) => {
    renderDeviceOptions(ctx, Array.isArray(payload?.devices) ? payload.devices : []);
  });
  bridge.onTerminalData((payload) => {
    if (!payload || typeof payload.data !== 'string') return;
    // Main forwards every telnet chunk to every Fiddle window; filter client-
    // side so each window shows only its currently-selected device.
    if (!ctx.selectedDeviceId) return;
    const selectedDevice = ctx.devices.find((d) => d.id === ctx.selectedDeviceId);
    if (!selectedDevice || selectedDevice.ip !== (payload as { ip?: string }).ip) return;

    const expectedRunId = ctx.currentRun ? ctx.currentRun.runId : '';
    const beginMarker = expectedRunId ? '[FIDDLE_BEGIN:' + expectedRunId + ']' : '';
    const endMarker = expectedRunId ? '[FIDDLE_END:' + expectedRunId + ']' : '';

    // Suppress stale output while a new Run is in flight. The gate opens ONLY
    // on a `[FIDDLE_BEGIN:<currentRunId>]` marker — not any BEGIN — because
    // Roku's telnet buffer can include BEGIN markers from the previous run
    // that get flushed when our socket comes back up. Matching the exact run
    // id guarantees we skip the old session entirely.
    if (ctx.suppressUntilBegin) {
      if (!expectedRunId) {
        // Run hasn't been assigned an id yet — main is still in the middle of
        // building the zip / sideloading. Drop everything until the response
        // comes back and we know which marker to look for.
        return;
      }
      if (payload.data.indexOf(beginMarker) === -1) {
        return;
      }
      ctx.suppressUntilBegin = false;
      setStatus(ctx, 'Running on device…', 'running');
    }

    appendTerminalChunk(ctx, payload.data);

    // If the current run's END marker arrives, the user's code has finished
    // executing on the device. Update the status and clear `currentRun` so
    // subsequent chunks (post-run beacons, etc.) don't re-trigger anything.
    if (expectedRunId && !ctx.currentRun?.endSeen && payload.data.indexOf(endMarker) !== -1) {
      if (ctx.currentRun) ctx.currentRun.endSeen = true;
      setStatus(ctx, 'Run complete.', 'success');
    }
  });
  bridge.onTerminalCleared(() => {
    clearTerminal(ctx);
  });
  bridge.onRunResult((payload) => {
    if (!payload) return;
    // Don't advertise "Run complete." here — the sideload response arrives
    // long before user code actually finishes running on the device. Rely on
    // the `[FIDDLE_END:…]` telnet marker instead (handled in onTerminalData).
    if (!payload.success) {
      if (payload.error) setStatus(ctx, payload.error, 'error');
      // Open the gate so compile errors / diagnostics still show up.
      ctx.suppressUntilBegin = false;
      // Auth failures that arrive via this broadcast path (e.g. from a sibling
      // fiddle window) mirror the per-run handler — evict the session copy
      // so the next Run goes through the modal.
      if (payload.authFailed && payload.deviceId) {
        ctx.sessionPasswords.delete(payload.deviceId);
      }
    }
  });
  bridge.onScanStatus((payload) => {
    setRefreshScanning(ctx, !!payload?.scanning);
  });
}

function setRefreshScanning(ctx: FiddleCtx, scanning: boolean): void {
  ctx.els.refreshBtn.classList.toggle('scanning', scanning);
  ctx.els.refreshBtn.disabled = scanning;
}

/**
 * Apply the global Privacy Mode toggle to this Fiddle window:
 *   - Toggle the `privacy-mode` body class so CSS-blur rules light up
 *     (currently the password modal's IP span — see fiddle.css).
 *   - Re-render the device dropdown so the option text picks up the new
 *     masked / unmasked IP value (the `<option>` text can't be blurred via
 *     CSS in Chromium's native picker).
 */
function applyPrivacyMode(ctx: FiddleCtx, enabled: boolean): void {
  const next = !!enabled;
  if (ctx.privacyModeEnabled === next) return;
  ctx.privacyModeEnabled = next;
  document.body.classList.toggle('privacy-mode', next);
  // Re-render the dropdown in place so the IP toggle takes effect immediately.
  // `renderDeviceOptions` already preserves the current selection.
  renderDeviceOptions(ctx, ctx.devices, true, null);
}

/** Pull the current Privacy Mode state from main and start listening for
 * toggles. The bridge methods are optional so older preload bundles don't
 * crash the window — privacy mode just stays off in that case. */
function bindPrivacyMode(ctx: FiddleCtx): void {
  const bridge = getWindowFiddle();
  if (typeof bridge.getPrivacyMode === 'function') {
    void bridge
      .getPrivacyMode()
      .then((res) => applyPrivacyMode(ctx, !!res?.enabled))
      .catch((err: unknown) => {
        // Privacy mode handler not available (older main process) — leave off.
        console.warn('[Fiddle] getPrivacyMode failed:', err);
      });
  }
  if (typeof bridge.onPrivacyModeChanged === 'function') {
    bridge.onPrivacyModeChanged((enabled) => applyPrivacyMode(ctx, enabled));
  }
}

async function main(): Promise<void> {
  const els = {
    deviceSelect: qs<HTMLSelectElement>('fiddleDeviceSelect'),
    runBtn: qs<HTMLButtonElement>('fiddleRunBtn'),
    stopBtn: qs<HTMLButtonElement>('fiddleStopBtn'),
    clearBtn: qs<HTMLButtonElement>('fiddleClearBtn'),
    clearCodeBtn: qs<HTMLButtonElement>('fiddleClearCodeBtn'),
    refreshBtn: qs<HTMLButtonElement>('fiddleRefreshBtn'),
    terminal: qs<HTMLDivElement>('fiddleTerminal'),
    status: qs<HTMLElement>('fiddleStatus'),
    diagStatus: qs<HTMLElement>('fiddleDiagStatus'),
    passwordModal: qs<HTMLElement>('fiddlePasswordModal'),
    passwordInput: qs<HTMLInputElement>('fiddlePasswordInput'),
    passwordSubmit: qs<HTMLButtonElement>('fiddlePasswordSubmitBtn'),
    passwordCancel: qs<HTMLButtonElement>('fiddlePasswordCancel'),
    passwordCancelBtn: qs<HTMLButtonElement>('fiddlePasswordCancelBtn'),
    passwordError: qs<HTMLElement>('fiddlePasswordError'),
    passwordDeviceLabel: qs<HTMLElement>('fiddlePasswordDeviceLabel')
  };

  // Paint a pre-context status so the user sees "Loading editor..." before
  // Monaco has finished mounting — the real FiddleCtx isn't available yet.
  paintStatus(els.status, 'Loading editor...', 'running');

  let monaco: MonacoNamespace;
  try {
    monaco = await loadMonaco();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    els.status.textContent = `Editor failed to load: ${msg}`;
    els.status.classList.add('error');
    console.error('[Fiddle] Monaco load failed:', err);
    return;
  }

  registerBrightScriptLanguage(monaco);

  const editor = monaco.editor.create(qs('fiddleEditor'), {
    value: DEFAULT_SNIPPET,
    language: 'brightscript',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    fontFamily: 'Menlo, SF Mono, Monaco, monospace',
    tabSize: 4,
    insertSpaces: true,
    scrollBeyondLastLine: false,
    renderWhitespace: 'selection',
    roundedSelection: false,
    wordWrap: 'on',
    wrappingIndent: 'indent',
    wrappingStrategy: 'advanced'
  });
  const model = editor.getModel();
  if (!model) throw new Error('Monaco editor produced no model.');

  const ctx: FiddleCtx = {
    monaco,
    editor,
    model,
    devices: [],
    selectedDeviceId: null,
    currentRun: null,
    hasErrors: false,
    isRunning: false,
    hasActiveFiddle: false,
    activeFiddleDeviceId: null,
    suppressUntilBegin: false,
    rawBuffer: [],
    trailingPartial: '',
    sessionPasswords: new Map(),
    privacyModeEnabled: false,
    els
  };

  bindEvents(ctx);
  bindPrivacyMode(ctx);
  scheduleLint(ctx);

  // Wait for initial device snapshot from main.
  const bridge = getWindowFiddle();
  bridge.onInit((payload) => {
    const devices = Array.isArray(payload?.devices) ? payload.devices : [];
    // Honor `initialDeviceId` ONLY on this first paint. When the Fiddle
    // window is opened from a device panel's "Open Fiddle" button, the main
    // renderer resolves that panel's device id and forwards it here so the
    // dropdown lands on it immediately (and Run is enabled). Subsequent
    // `onDevicesUpdate` pushes preserve whatever the user picks after that.
    const forced = typeof payload?.initialDeviceId === 'string' && payload.initialDeviceId
      ? payload.initialDeviceId
      : null;
    renderDeviceOptions(ctx, devices, false, forced);
    setStatus(ctx, 'Ready.', '');
  });

  bridge.ready();
}

void main();
