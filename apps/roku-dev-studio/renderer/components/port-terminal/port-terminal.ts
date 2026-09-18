/**
 * Ports window renderer — one device, one tab per port.
 *
 *  - 8080 / 8087: interactive text consoles. Bytes arrive as chunks on `onTelnetSystemData`; the
 *    pane keeps a mutable "tail" entry for the partial last line (the `>` prompt never ends in a
 *    newline) so the prompt and the echoed command render on one row like a real terminal.
 *  - 8081: read-only decoded trace of the live debugger session (`onDebuggerWire`). Nothing here
 *    opens a second 8081 socket — the port is single-client and binary.
 *
 * The console surface (virtualized rows, find bar, shortcuts) is the shared
 * `mountConsoleLogSurface`, the same one the Console tab and Log Viewer use.
 */
import { mountConsoleLogSurface, type ConsoleLogSurfaceHandle } from '../../modules/console-log/mount-console-log-surface.js';
import { buildConsoleFindBarElement } from '../../modules/console-log/console-find-bar-markup.js';
import type { ConsoleLogFileEntry } from '../../modules/console-log/console-log-file-parse.js';
import { parseConsoleLine } from '../../modules/console-log/console-line-parser.js';
import { detectStructuredConsoleLine } from '../../modules/console-log/structured-log-detect.js';
import { inMemorySessionStore } from '../../modules/ui/in-memory-storage.js';
import { S, applyI18n } from '@shared/strings/index.js';
import { initLocaleForWindow } from '../../modules/utils/locale-live.js';
import { installCrashCapture } from '../../modules/errors/install.js';
import type { AppInfo } from '../../modules/errors/crash-report.js';
import { attachInstantTooltips } from '../../modules/utils/instant-tooltip.js';
import { icon } from '../../modules/utils/dom.js';
import { setupTelnetDebugSidebar, type DebugSidebarHandle } from '../../modules/telnet/telnet-debug-sidebar.js';
import { bindPanelDevice } from '../../modules/utils/device-debugger-flag.js';

type Unsubscribe = () => void;
type Ack = { success: boolean; error?: string; reused?: boolean };

interface PortsDevice {
  ip: string;
  kind?: 'local' | 'remote' | 'rce';
  serverUrl?: string | null;
  accountName?: string;
  name?: string;
  locationName?: string;
  /** Keys the sidebar's persisted breakpoints/watches the same way the Console tab does. */
  serialNumber?: string;
}

interface PortsInfo {
  success: boolean;
  error?: string;
  device?: PortsDevice;
  ports?: number[];
  debuggerState?: string;
  debugProtocolPort?: number;
  /** Custom-port rule (RCE only — see `customPortRule` in main); null = no custom card. */
  custom?: { reserved: number[]; rceFixed: number[]; rceRange: [number, number] } | null;
}

interface PortsRokuApi {
  getInfo: () => Promise<PortsInfo>;
  connect: (port: number) => Promise<Ack>;
  disconnect: (port: number) => Promise<Ack>;
  send: (port: number, command: string) => Promise<Ack>;
  holdDebuggerStream: () => Promise<Ack>;
  releaseDebuggerStream: () => Promise<Ack>;
  onTelnetSystemData: (cb: (p: { ip: string; port?: number; data: string; serverUrl?: string }) => void) => Unsubscribe;
  onTelnetSystemDisconnected: (cb: (p: { ip: string; port?: number; hadError?: boolean; serverUrl?: string }) => void) => Unsubscribe;
  onDebuggerWire: (cb: (p: WireFrame) => void) => Unsubscribe;
  onDebuggerState: (cb: (p: { ip?: string; state?: string; serverUrl?: string }) => void) => Unsubscribe;
  onDebuggerOutput: (cb: (p: { ip?: string; text?: string; serverUrl?: string }) => void) => Unsubscribe;
  copyToClipboard: (text: string) => Promise<unknown>;
  saveTextFile: (opts: { content: string; defaultName?: string; dialogTitle?: string }) => Promise<unknown>;
  openExternal: (url: string) => Promise<unknown>;
  getSetting: (key: string) => Promise<{ success: boolean; value?: unknown }>;
  getAppInfo: () => Promise<AppInfo>;
  getLocale: () => Promise<string>;
  onLocaleChanged: (cb: (pref: string) => void) => Unsubscribe;
}

interface WireFrame {
  ip?: string;
  serverUrl?: string;
  dir?: 'in' | 'out';
  name?: string;
  requestId?: number;
  bytes?: number;
  at?: number;
  errorCode?: number;
  detail?: string;
}

type TabKind = 'console' | 'wire';

interface Tab {
  port: number;
  kind: TabKind;
  tabEl: HTMLButtonElement;
  paneEl: HTMLElement;
  statusEl: HTMLElement;
  statusTextEl: HTMLElement;
  inputEl: HTMLInputElement | null;
  reconnectBtn: HTMLButtonElement;
  entries: ConsoleLogFileEntry[];
  surface: ConsoleLogSurfaceHandle;
  /** Index of the mutable partial-line entry, or -1 when the last line ended cleanly. */
  tailIndex: number;
  connected: boolean;
  /** When this tab last reopened its port by itself after a device-side close (see the
   *  `onTelnetSystemDisconnected` handler); 0 = never. */
  lastAutoReconnectAt: number;
  /** 8081 tab only: the mounted debugger sidebar (same module as the Console tab) + REPL wiring. */
  debug?: { handle: DebugSidebarHandle; dispose: () => void };
  /** 8081 tab only: a REPL Execute is in flight — channel output is shown until its response frame. */
  replPending?: boolean;
  /** Console tabs: a multi-line XML document in progress (see `trackXmlBlock`). */
  xmlBlock?: { start: number; depth: number; lines: string[] };
}

const rokuApi = window.roku as unknown as PortsRokuApi;

installCrashCapture({
  windowName: 'port-terminal',
  getSetting: rokuApi.getSetting,
  getAppInfo: rokuApi.getAppInfo,
  openExternal: rokuApi.openExternal
});

const DEFAULT_CONSOLE_PORT = 8080;
/** A second device-side close within this window after an automatic reopen means the device is
 *  flapping (rebooting, app reset loop) — stop auto-reopening and leave it to the Reconnect button. */
const AUTO_RECONNECT_MIN_GAP_MS = 5000;
const AUTO_RECONNECT_DELAY_MS = 700;
const ATTACHED_STATES = new Set(['attached', 'running', 'stopped', 'connecting']);

let device: PortsDevice = { ip: '' };
let availablePortList: number[] = [];
let debugProtocolPort = 8081;
let debuggerStateNow = 'disconnected';
let customRule: PortsInfo['custom'] = null;
const tabs = new Map<number, Tab>();
let activePort: number | typeof PICKER_KEY | null = null;

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const tabsEl = el<HTMLElement>('ptTabs');
const panesEl = el<HTMLElement>('ptPanes');
/** Lives INSIDE the tab strip as its last child; tabs are inserted before it. */
const newTabBtn = el<HTMLButtonElement>('ptNewTab');

/** The "Open a Port" tab: the default tab while nothing is open, and what "+" opens. One at most —
 *  it isn't connected to anything, it's waiting for a port to be picked. Closable only while real
 *  port tabs exist (with none, it's the only thing to show). */
let pickerTab: { tabEl: HTMLButtonElement; paneEl: HTMLElement; gridEl: HTMLElement; closeEl: HTMLElement } | null = null;
const PICKER_KEY = 'picker' as const;

// ── Strings that depend on the port ───────────────────────────────────────────────────────────

function portName(port: number): string {
  if (port === DEFAULT_CONSOLE_PORT) return S.portTerminal.port8080Name;
  if (port === debugProtocolPort) return S.portTerminal.port8081Name;
  if (port === 8087) return S.portTerminal.port8087Name;
  return S.portTerminal.customPortName;
}

/** Why `port` can't be opened as a custom console here, or null when it can. */
function customPortProblem(port: number): string | null {
  if (!Number.isInteger(port) || port < 1 || port > 65535) return S.portTerminal.customPortInvalid;
  if (!customRule) return S.portTerminal.customPortInvalid;
  if (customRule.reserved.includes(port)) return S.portTerminal.customPortReserved(port);
  const inRange = port >= customRule.rceRange[0] && port <= customRule.rceRange[1];
  if (!customRule.rceFixed.includes(port) && !inRange) return S.portTerminal.customPortNotTunneled(port);
  return null;
}

function portDesc(port: number): string {
  if (port === DEFAULT_CONSOLE_PORT) return S.portTerminal.port8080Desc;
  if (port === debugProtocolPort) return S.portTerminal.port8081Desc;
  if (port === 8087) return S.portTerminal.port8087Desc;
  return '';
}

function deviceLabel(): string {
  return device.name?.trim() || device.ip || S.portTerminal.unknownDevice;
}

function isForThisDevice(p: { ip?: string; serverUrl?: string }): boolean {
  if (p.ip !== device.ip) return false;
  if (device.serverUrl && p.serverUrl && p.serverUrl !== device.serverUrl) return false;
  return true;
}

// ── Header + picker ───────────────────────────────────────────────────────────────────────────

function renderHeader(): void {
  // Mirrors the device tab's header (`devicePanelNameHtml` + `S.app.atLocation` in app.ts): a kind
  // icon before the name — cloud for RCE, server for a relay location, none for local — and
  // "<serial or ip> @ <location>" for anything not on this LAN.
  const kindEl = el<HTMLElement>('ptDeviceKind');
  const isRce = device.kind === 'rce';
  const isRelay = !isRce && !!device.serverUrl;
  const location = isRce ? device.locationName || device.accountName : isRelay ? device.locationName || device.serverUrl : '';
  kindEl.innerHTML = isRce ? icon('cloud', 'icon-md', 'icon-cyan') : isRelay ? icon('server', 'icon-sm', 'icon-cyan') : '';
  kindEl.hidden = !isRce && !isRelay;
  el<HTMLElement>('ptDeviceName').textContent = deviceLabel();
  el<HTMLElement>('ptDeviceIp').textContent = location ? S.app.atLocation(device.ip, location) : device.ip;
  document.title = S.portTerminal.windowTitle(deviceLabel());
}

function renderPickerCards(pickerGridEl: HTMLElement): void {
  pickerGridEl.replaceChildren();
  if (availablePortList.length === 0) {
    const p = document.createElement('p');
    p.className = 'pt-picker-hint';
    p.textContent = S.portTerminal.noPortsAvailable;
    pickerGridEl.appendChild(p);
  }
  for (const port of availablePortList) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'pt-picker-card';
    card.dataset.port = String(port);
    const title = document.createElement('span');
    title.className = 'pt-picker-card-title';
    title.textContent = portName(port);
    if (tabs.has(port)) {
      const badge = document.createElement('span');
      badge.className = 'pt-picker-badge';
      badge.textContent = S.portTerminal.alreadyOpen;
      title.appendChild(badge);
    }
    const portLbl = document.createElement('span');
    portLbl.className = 'pt-picker-card-port';
    portLbl.textContent = String(port);
    title.appendChild(portLbl);
    const desc = document.createElement('span');
    desc.className = 'pt-picker-card-desc';
    desc.textContent = portDesc(port);
    card.append(title, desc);
    card.addEventListener('click', () => void openTab(port));
    pickerGridEl.appendChild(card);
  }
  // The (taller) Custom Port card is pinned to the second row's middle column by CSS, under the
  // centre card of the three fixed ports.
  if (customRule) pickerGridEl.appendChild(buildCustomPortCard());
}

function openPickerTab(): void {
  if (pickerTab) {
    activate(PICKER_KEY);
    return;
  }
  const tabEl = document.createElement('button');
  tabEl.type = 'button';
  tabEl.className = 'pt-tab pt-tab--picker';
  tabEl.setAttribute('role', 'tab');
  const dot = document.createElement('span');
  dot.className = 'pt-tab-dot';
  const label = document.createElement('span');
  label.textContent = S.portTerminal.pickerTitle;
  const closeEl = document.createElement('span');
  closeEl.className = 'pt-tab-close';
  closeEl.title = S.portTerminal.closeTab;
  closeEl.setAttribute('role', 'button');
  closeEl.innerHTML = icon('x', 'icon-xs');
  tabEl.append(dot, label, closeEl);
  tabEl.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.pt-tab-close') && tabs.size > 0) {
      closePickerTab();
      return;
    }
    activate(PICKER_KEY);
  });
  tabsEl.insertBefore(tabEl, newTabBtn);

  const paneEl = document.createElement('section');
  paneEl.className = 'pt-pane pt-pane--picker';
  paneEl.setAttribute('role', 'tabpanel');
  const tpl = document.getElementById('ptPickerTemplate') as HTMLTemplateElement | null;
  if (tpl) {
    const frag = tpl.content.cloneNode(true) as DocumentFragment;
    applyI18n(frag);
    paneEl.appendChild(frag);
  }
  const gridEl = paneEl.querySelector<HTMLElement>('.pt-picker-grid') ?? paneEl;
  panesEl.appendChild(paneEl);

  pickerTab = { tabEl, paneEl, gridEl, closeEl };
  renderPickerCards(gridEl);
  refreshPickerClosable();
  activate(PICKER_KEY);
}

function closePickerTab(): void {
  if (!pickerTab) return;
  const wasActive = activePort === PICKER_KEY;
  pickerTab.tabEl.remove();
  pickerTab.paneEl.remove();
  pickerTab = null;
  if (wasActive) {
    const first = [...tabs.keys()][0];
    if (first !== undefined) activate(first);
    else openPickerTab(); // nothing else to show — the default tab comes straight back
  }
}

/** The picker tab can only be closed while there are port tabs to fall back to. */
function refreshPickerClosable(): void {
  if (pickerTab) pickerTab.closeEl.hidden = tabs.size === 0;
}

/** "Custom Port" card: a port field + Open. Validates against this device's rule before dialing. */
function buildCustomPortCard(): HTMLElement {
  const card = document.createElement('form');
  card.className = 'pt-picker-card pt-picker-card--custom';
  // Our own validation message, always — the browser's min/max bubble would otherwise swallow the
  // submit and leave a previous message standing.
  card.noValidate = true;
  const title = document.createElement('span');
  title.className = 'pt-picker-card-title';
  title.textContent = S.portTerminal.customPortName;
  const desc = document.createElement('span');
  desc.className = 'pt-picker-card-desc';
  desc.textContent = S.portTerminal.customPortDesc;
  const row = document.createElement('div');
  row.className = 'pt-custom-row';
  const input = document.createElement('input');
  input.className = 'pt-custom-input';
  input.type = 'number';
  input.min = '1';
  input.max = '65535';
  input.placeholder = S.portTerminal.customPortPlaceholder;
  input.setAttribute('aria-label', S.portTerminal.customPortPlaceholder);
  const open = document.createElement('button');
  open.type = 'submit';
  open.className = 'btn btn-primary btn-sm';
  open.textContent = S.common.open;
  const problem = document.createElement('span');
  problem.className = 'pt-custom-problem';
  problem.hidden = true;
  row.append(input, open);
  card.append(title, desc, row, problem);
  card.addEventListener('submit', (e) => {
    e.preventDefault();
    const port = Number(input.value);
    const why = customPortProblem(port);
    if (why) {
      problem.textContent = why;
      problem.hidden = false;
      input.focus();
      return;
    }
    problem.hidden = true;
    void openTab(port);
  });
  input.addEventListener('input', () => { problem.hidden = true; });
  return card;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────────────────────

function setTabState(tab: Tab, state: 'connecting' | 'connected' | 'disconnected', text?: string): void {
  for (const cls of ['is-connecting', 'is-connected', 'is-disconnected']) {
    tab.tabEl.classList.remove(cls);
    tab.statusEl.classList.remove(cls);
  }
  tab.tabEl.classList.add(`is-${state}`);
  tab.statusEl.classList.add(`is-${state}`);
  tab.statusTextEl.textContent =
    text ??
    (state === 'connecting' ? S.portTerminal.connecting : state === 'connected' ? S.portTerminal.connected : S.portTerminal.disconnected);
  tab.connected = state === 'connected';
  if (tab.kind === 'console') {
    tab.reconnectBtn.hidden = state !== 'disconnected';
    if (tab.inputEl) tab.inputEl.disabled = state !== 'connected';
  }
}

function pushEntry(tab: Tab, text: string, type = 'log'): void {
  tab.entries.push({ text, timestamp: null, type });
  tab.surface.notifyAppended();
}

/** A line from this window itself (connect failures, state changes), not from the device. */
function pushSystemLine(tab: Tab, text: string, type = 'info'): void {
  finalizeTail(tab);
  pushEntry(tab, `— ${text}`, type);
}

function finalizeTail(tab: Tab): void {
  tab.tailIndex = -1;
}

/** Roku's text consoles don't echo input, so show the command on the prompt row the way a
 *  terminal would: `> free`. Without a pending prompt, it gets its own row. */
function echoCommand(tab: Tab, command: string): void {
  const tail = tab.tailIndex >= 0 ? tab.entries[tab.tailIndex] : undefined;
  if (tail && /^\s*>\s*$/.test(tail.text)) {
    tab.entries[tab.tailIndex] = { text: `> ${command}`, timestamp: null, type: 'info' };
    tab.tailIndex = -1;
    tab.surface.remountVisible();
    return;
  }
  finalizeTail(tab);
  pushEntry(tab, `> ${command}`, 'info');
}

/** Console bytes → rows. Complete lines are parsed (error/warning colouring); the trailing partial
 *  line lives in one mutable tail entry that grows until its newline arrives. */
function appendChunk(tab: Tab, chunk: string): void {
  // Roku's consoles never echo input, so anything arriving on a bare `>` prompt row is OUTPUT (a
  // command another consumer sent, e.g. the Query tab's Plugins over the shared socket) — start it
  // on its own row instead of gluing it to the prompt. Our own echo already replaced the prompt.
  if (tab.tailIndex >= 0 && /^\s*>\s*$/.test(tab.entries[tab.tailIndex]!.text) && !/^[\r\n]/.test(chunk)) {
    tab.tailIndex = -1;
  }
  const hadTail = tab.tailIndex >= 0;
  const tailText = hadTail ? tab.entries[tab.tailIndex]!.text : '';
  const combined = (tailText + chunk).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const parts = combined.split('\n');
  const partial = parts.pop() ?? '';

  let countChanged = false;
  let tailChanged = false;
  parts.forEach((line, i) => {
    const parsed = parseConsoleLine(line);
    const entry: ConsoleLogFileEntry = {
      text: parsed.text,
      timestamp: null,
      type: parsed.type,
      ...(parsed.structuredTargets ? { structuredTargets: parsed.structuredTargets } : {})
    };
    if (i === 0 && hadTail) {
      tab.entries[tab.tailIndex] = entry;
      tailChanged = true;
      trackXmlBlock(tab, tab.tailIndex, entry.text);
    } else {
      tab.entries.push(entry);
      countChanged = true;
      trackXmlBlock(tab, tab.entries.length - 1, entry.text);
    }
  });
  const tailConsumed = hadTail && parts.length > 0;
  if (partial) {
    if (hadTail && !tailConsumed) {
      tab.entries[tab.tailIndex] = { text: partial, timestamp: null, type: 'log' };
      tailChanged = true;
    } else {
      tab.entries.push({ text: partial, timestamp: null, type: 'log' });
      tab.tailIndex = tab.entries.length - 1;
      countChanged = true;
    }
  } else if (tailConsumed || !hadTail) {
    tab.tailIndex = -1;
  }
  // notifyAppended only mounts NEW indices; a tail row that just grew (a line completed across two
  // chunks) is already mounted and needs an explicit remount or it keeps showing the partial text.
  if (countChanged) tab.surface.notifyAppended();
  if (tailChanged) tab.surface.remountVisible();
}

/** One line's net element-depth change: `<a>` +1, `</a>` −1, `<a/>`, `<?…?>`, `<!…>` 0. */
const XML_TAG_RE = /<(\/)?([A-Za-z_][\w.:-]*)(?:\s[^<>]*?)?(\/)?>/g;
const XML_BLOCK_MAX_LINES = 20000;

function xmlDepthDelta(line: string): number {
  let d = 0;
  for (const m of line.matchAll(XML_TAG_RE)) {
    if (m[1]) d--;
    else if (!m[3]) d++;
  }
  return d;
}

/**
 * The per-line detector flags every self-closing `<Node …/>` of an `sgnodes` dump as its own XML
 * document. Track a markup-led line that opens more elements than it closes as the start of a
 * multi-line document, and when the depth returns to zero hand the whole block to the same
 * detector: one XML badge on the first line, the inner lines' badges removed, and the viewer's
 * fold twisties then collapse/expand nodes inside. A prompt arriving mid-block means the device
 * moved on (truncated output) — abandon and leave the per-line badges as they were.
 */
function trackXmlBlock(tab: Tab, index: number, text: string): void {
  const t = text.trim();
  const block = tab.xmlBlock;
  if (!block) {
    if (!t.startsWith('<') || t.startsWith('</') || t.startsWith('<?') || t.startsWith('<!')) return;
    const d = xmlDepthDelta(t);
    if (d > 0) tab.xmlBlock = { start: index, depth: d, lines: [text] };
    return;
  }
  if (/^\s*>\s*$/.test(text) || block.lines.length >= XML_BLOCK_MAX_LINES) {
    tab.xmlBlock = undefined;
    return;
  }
  block.lines.push(text);
  block.depth += xmlDepthDelta(t);
  if (block.depth > 0) return;
  tab.xmlBlock = undefined;
  const targets = detectStructuredConsoleLine(block.lines.join('\n')).filter((p) => p.kind === 'xml');
  const first = tab.entries[block.start];
  if (!targets.length || !first) return;
  first.structuredTargets = targets;
  for (let i = block.start + 1; i <= index; i++) {
    const e = tab.entries[i];
    if (e) delete e.structuredTargets;
  }
  tab.surface.remountVisible();
}

function makeToolbarButton(iconName: string, title: string, extraClass = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn btn-secondary btn-icon ${extraClass}`.trim();
  b.title = title;
  b.setAttribute('aria-label', title);
  b.innerHTML = icon(iconName, 'icon-xs');
  return b;
}

function activate(key: number | typeof PICKER_KEY): void {
  activePort = key;
  for (const t of tabs.values()) {
    const on = t.port === key;
    t.tabEl.classList.toggle('is-active', on);
    t.tabEl.setAttribute('aria-selected', on ? 'true' : 'false');
    t.paneEl.classList.toggle('is-active', on);
  }
  if (pickerTab) {
    const on = key === PICKER_KEY;
    pickerTab.tabEl.classList.toggle('is-active', on);
    pickerTab.tabEl.setAttribute('aria-selected', on ? 'true' : 'false');
    pickerTab.paneEl.classList.toggle('is-active', on);
    if (on) renderPickerCards(pickerTab.gridEl); // "Open" badges reflect the current tabs
  }
  if (key === PICKER_KEY) return;
  const tab = tabs.get(key);
  if (tab?.inputEl && !tab.inputEl.disabled) tab.inputEl.focus();
  tab?.surface.remountVisible();
}

async function openTab(port: number): Promise<void> {
  const existing = tabs.get(port);
  if (existing) {
    // Already connected: back to that tab; the picker tab has done its job.
    activate(port);
    closePickerTab();
    return;
  }
  const kind: TabKind = port === debugProtocolPort ? 'wire' : 'console';

  // Tab strip button
  const tabEl = document.createElement('button');
  tabEl.type = 'button';
  tabEl.className = 'pt-tab';
  tabEl.setAttribute('role', 'tab');
  const dot = document.createElement('span');
  dot.className = 'pt-tab-dot';
  const label = document.createElement('span');
  label.textContent = S.portTerminal.portTab(port);
  label.title = portName(port);
  const close = document.createElement('span');
  close.className = 'pt-tab-close';
  close.title = S.portTerminal.closeTab;
  close.setAttribute('role', 'button');
  close.innerHTML = icon('x', 'icon-xs');
  tabEl.append(dot, label, close);
  tabEl.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.pt-tab-close')) {
      void closeTab(port);
      return;
    }
    activate(port);
  });
  tabEl.addEventListener('auxclick', (e) => {
    if (e.button === 1) void closeTab(port);
  });
  tabsEl.insertBefore(tabEl, newTabBtn); // keep "+" trailing the last tab

  // Pane
  const paneEl = document.createElement('section');
  paneEl.className = 'pt-pane';
  paneEl.dataset.port = String(port);
  paneEl.setAttribute('role', 'tabpanel');

  const toolbar = document.createElement('div');
  toolbar.className = 'pt-toolbar';
  const statusEl = document.createElement('span');
  statusEl.className = 'pt-status';
  const statusDot = document.createElement('span');
  statusDot.className = 'pt-status-dot';
  const statusTextEl = document.createElement('span');
  statusEl.append(statusDot, statusTextEl);
  const findHost = document.createElement('div');
  findHost.className = 'pt-find-host';
  const findBar = buildConsoleFindBarElement();
  findHost.appendChild(findBar);
  const actions = document.createElement('div');
  actions.className = 'pt-toolbar-actions';
  if (kind === 'wire') {
    // The sidebar module requires its collapse toggle inside the same panel root.
    const toggle = makeToolbarButton('debug-run', S.debugger.panelToggle, 'telnet-debug-toggle');
    toggle.setAttribute('data-telnet-debug-toggle', '');
    toggle.setAttribute('aria-pressed', 'false');
    actions.appendChild(toggle);
  }
  const copyBtn = makeToolbarButton('copy', S.app.copyAllLogs);
  const saveBtn = makeToolbarButton('download', S.app.saveLogsToFile);
  const clearBtn = makeToolbarButton('clear-results', S.app.clearConsole);
  const reconnectBtn = makeToolbarButton('refresh', S.portTerminal.reconnect);
  reconnectBtn.hidden = true;
  actions.append(reconnectBtn, copyBtn, saveBtn, clearBtn);
  toolbar.append(statusEl, findHost, actions);

  const outputWrap = document.createElement('div');
  outputWrap.className = 'telnet-output-container';
  const outputEl = document.createElement('div');
  outputEl.className = 'telnet-output';
  outputWrap.appendChild(outputEl);
  // 8081: the Console tab's debugger sidebar (cloned from the page template) on the left of the
  // protocol trace, plus its slide-up REPL under the trace — the `.telnet-body-split` row and all
  // of its CSS come from the shared stylesheet unchanged.
  let bodyEl: HTMLElement = outputWrap;
  if (kind === 'wire') {
    const split = document.createElement('div');
    split.className = 'telnet-body-split';
    const asideTpl = document.getElementById('ptDebugSidebarTemplate') as HTMLTemplateElement | null;
    const replTpl = document.getElementById('ptDebugReplTemplate') as HTMLTemplateElement | null;
    if (asideTpl) {
      const frag = asideTpl.content.cloneNode(true) as DocumentFragment;
      applyI18n(frag);
      split.appendChild(frag);
    }
    if (replTpl) {
      const frag = replTpl.content.cloneNode(true) as DocumentFragment;
      applyI18n(frag);
      outputWrap.appendChild(frag);
    }
    split.appendChild(outputWrap);
    bodyEl = split;
  }

  let inputEl: HTMLInputElement | null = null;
  const inputRow = document.createElement('form');
  inputRow.className = 'pt-input-row';
  if (kind === 'console') {
    const prompt = document.createElement('span');
    prompt.className = 'pt-prompt';
    prompt.textContent = '>';
    inputEl = document.createElement('input');
    inputEl.className = 'pt-input';
    inputEl.type = 'text';
    inputEl.autocomplete = 'off';
    inputEl.spellcheck = false;
    inputEl.placeholder = S.portTerminal.inputPlaceholder;
    inputEl.disabled = true;
    const sendBtn = document.createElement('button');
    sendBtn.type = 'submit';
    sendBtn.className = 'btn btn-primary btn-sm';
    sendBtn.textContent = S.portTerminal.send;
    inputRow.append(prompt, inputEl, sendBtn);
  } else {
    inputRow.hidden = true;
  }

  paneEl.append(toolbar, bodyEl, inputRow);
  panesEl.appendChild(paneEl);

  const entries: ConsoleLogFileEntry[] = [];
  const surface = mountConsoleLogSurface({
    outputEl,
    entries,
    findBarHost: toolbar,
    shortcutScopeEl: paneEl,
    historyStorage: inMemorySessionStore,
    historyScope: `port-terminal:${port}`,
    preservePlaceholder: true,
    onSelectAll: () => void copyAll(tab)
  });

  const tab: Tab = {
    port,
    kind,
    tabEl,
    paneEl,
    statusEl,
    statusTextEl,
    inputEl,
    reconnectBtn,
    entries,
    surface,
    tailIndex: -1,
    connected: false,
    lastAutoReconnectAt: 0
  };
  tabs.set(port, tab);
  if (kind === 'wire') tab.debug = mountDebugSidebar(tab);

  copyBtn.addEventListener('click', () => void copyAll(tab));
  saveBtn.addEventListener('click', () => {
    const content = tab.entries.map((e) => e.text).join('\n');
    void rokuApi.saveTextFile({
      content,
      defaultName: S.portTerminal.defaultSaveName(device.ip || 'device', port),
      dialogTitle: S.app.saveLogsToFile
    });
  });
  clearBtn.addEventListener('click', () => {
    tab.entries.length = 0;
    tab.tailIndex = -1;
    tab.xmlBlock = undefined;
    tab.surface.setCount(0);
  });
  reconnectBtn.addEventListener('click', () => void connectConsole(tab));
  inputRow.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!inputEl) return;
    const command = inputEl.value;
    if (!command.trim()) return;
    inputEl.value = '';
    echoCommand(tab, command);
    void rokuApi.send(port, command).then((r) => {
      if (!r.success) pushSystemLine(tab, S.portTerminal.sendFailed(r.error || ''), 'error');
    });
  });

  activate(port);
  closePickerTab(); // the pick is made — the new port tab takes the picker's place
  refreshPickerClosable();

  if (kind === 'console') await connectConsole(tab);
  else await openWire(tab);
}

async function connectConsole(tab: Tab): Promise<void> {
  setTabState(tab, 'connecting');
  const r = await rokuApi.connect(tab.port);
  if (!tabs.has(tab.port)) return; // closed while dialing
  if (!r.success) {
    setTabState(tab, 'disconnected');
    pushSystemLine(tab, S.portTerminal.connectFailed(r.error || ''), 'error');
    return;
  }
  setTabState(tab, 'connected');
}

function applyDebuggerState(tab: Tab, state: string, announce: boolean): void {
  const attached = ATTACHED_STATES.has(state);
  const visual = state === 'connecting' ? 'connecting' : attached ? 'connected' : 'disconnected';
  setTabState(tab, visual, S.portTerminal.debuggerState(state));
  if (announce) pushSystemLine(tab, S.portTerminal.debuggerState(state), attached ? 'info' : 'warning');
}

async function openWire(tab: Tab): Promise<void> {
  if (device.serverUrl) await rokuApi.holdDebuggerStream();
  applyDebuggerState(tab, debuggerStateNow, false);
  if (!ATTACHED_STATES.has(debuggerStateNow)) pushSystemLine(tab, S.portTerminal.debuggerNotAttached, 'warning');
}

/** Mount the Console tab's debugger sidebar on this pane and wire its REPL bar under the trace —
 *  identical behavior to the main window: attach/detach, step, breakpoints, watches, variables,
 *  Restart, all against the one shared session in main. */
function mountDebugSidebar(tab: Tab): { handle: DebugSidebarHandle; dispose: () => void } {
  bindPanelDevice(tab.paneEl, { ip: device.ip, serialNumber: device.serialNumber, debuggerEnabled: false });
  const handle = setupTelnetDebugSidebar(tab.paneEl, device.ip, {
    isRemote: !!device.serverUrl,
    serverUrl: device.serverUrl ?? null,
    debuggerSupported: true,
    alwaysVisible: true,
    // This tab is a second view of the session the main window's Console sidebar owns — closing
    // it must not detach the debugger.
    detachOnCleanup: false
  });
  const disposers: Array<() => void> = [() => handle.cleanup()];
  const replEl = tab.paneEl.querySelector<HTMLElement>('[data-debug-repl]');
  const replInput = tab.paneEl.querySelector<HTMLInputElement>('[data-debug-repl-input]');
  const outputWrap = tab.paneEl.querySelector<HTMLElement>('.telnet-output-container');
  if (replEl && replInput) {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter') return;
      const src = replInput.value.trim();
      if (!src) return;
      replInput.value = '';
      finalizeTail(tab);
      pushEntry(tab, `› ${src}`, 'info');
      // Main forwards the device's print output (io-output) before it resolves the Execute
      // invoke, and IPC to one renderer is ordered — so the gate is open exactly for this
      // evaluation's output and closes when the call settles, success or failure. Closing only on
      // the response frame left it stuck open when an Execute never got answered (session not
      // attached yet), which flooded the trace with the whole channel log.
      tab.replPending = true;
      void handle.repl
        .execute(src)
        .then((r) => { for (const err of r.errors) pushEntry(tab, err, 'error'); })
        .catch((err: unknown) => pushEntry(tab, err instanceof Error ? err.message : String(err), 'error'))
        .finally(() => { tab.replPending = false; });
    };
    replInput.addEventListener('keydown', onKey);
    const off = handle.repl.onAvailabilityChange((stopped) => {
      replEl.classList.toggle('telnet-debug-repl--open', stopped);
      replEl.setAttribute('aria-hidden', String(!stopped));
      outputWrap?.classList.toggle('telnet-output-container--repl', stopped);
    });
    disposers.push(off, () => replInput.removeEventListener('keydown', onKey));
  }
  return {
    handle,
    dispose: () => {
      for (const d of disposers) {
        try { d(); } catch { /* best-effort teardown */ }
      }
    }
  };
}

async function closeTab(port: number): Promise<void> {
  const tab = tabs.get(port);
  if (!tab) return;
  tabs.delete(port);
  tab.debug?.dispose();
  tab.surface.dispose();
  tab.tabEl.remove();
  tab.paneEl.remove();
  if (tab.kind === 'console') void rokuApi.disconnect(port);
  else if (device.serverUrl) void rokuApi.releaseDebuggerStream();

  refreshPickerClosable();
  if (tabs.size === 0) {
    activePort = null;
    openPickerTab(); // the default tab returns (and can't be closed while it's alone)
    return;
  }
  if (activePort === port) activate([...tabs.keys()][0]!);
}

async function copyAll(tab: Tab): Promise<void> {
  const text = tab.entries.map((e) => e.text).join('\n');
  if (!text) return;
  await rokuApi.copyToClipboard(text);
}

// ── Wire (8081) formatting ────────────────────────────────────────────────────────────────────

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

function formatWire(f: WireFrame): { text: string; type: string } {
  const d = new Date(typeof f.at === 'number' ? f.at : Date.now());
  const ts = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  const arrow = f.dir === 'out' ? '→' : '←';
  const id = f.requestId ? ` #${f.requestId}` : '';
  const bytes = typeof f.bytes === 'number' ? `  ${S.portTerminal.wireBytes(f.bytes)}` : '';
  const err = typeof f.errorCode === 'number' && f.errorCode !== 0 ? `  ${S.portTerminal.wireError(f.errorCode)}` : '';
  const detail = f.detail ? `  ${f.detail}` : '';
  const type = err ? 'error' : f.dir === 'out' ? 'info' : 'log';
  return { text: `${ts}  ${arrow} ${f.name || '?'}${id}${bytes}${err}${detail}`, type };
}

// ── Push subscriptions (one set for the window; routed to tabs by port) ───────────────────────

rokuApi.onTelnetSystemData((p) => {
  if (!isForThisDevice(p)) return;
  const tab = tabs.get(p.port ?? DEFAULT_CONSOLE_PORT);
  if (!tab || tab.kind !== 'console' || typeof p.data !== 'string') return;
  appendChunk(tab, p.data);
});

rokuApi.onTelnetSystemDisconnected((p) => {
  if (!isForThisDevice(p)) return;
  const port = p.port ?? DEFAULT_CONSOLE_PORT;
  const tab = tabs.get(port);
  if (!tab || tab.kind !== 'console') return;
  const wasConnected = tab.connected;
  setTabState(tab, 'disconnected');
  // Roku's text console closes the socket itself on `quit` — and on anything it reads as quit, e.g.
  // an unknown command starting with "q" ("Quit command received, exiting."). Reopen once so a typo
  // doesn't strand the tab; a second drop right after a reopen leaves it to the Reconnect button.
  // A tab the user closed is already out of `tabs`, so it never gets here.
  const now = Date.now();
  if (wasConnected && now - tab.lastAutoReconnectAt > AUTO_RECONNECT_MIN_GAP_MS) {
    tab.lastAutoReconnectAt = now;
    pushSystemLine(tab, S.portTerminal.disconnectedReconnecting, 'warning');
    setTimeout(() => {
      if (tabs.get(port) === tab && !tab.connected) void connectConsole(tab);
    }, AUTO_RECONNECT_DELAY_MS);
    return;
  }
  pushSystemLine(tab, S.portTerminal.disconnected, 'warning');
});

rokuApi.onDebuggerWire((f) => {
  if (!isForThisDevice(f)) return;
  const tab = tabs.get(debugProtocolPort);
  if (!tab) return;
  const { text, type } = formatWire(f);
  pushEntry(tab, text, type);
});

// While attached, Roku routes the channel's print output over the debugger's IO port instead of
// 8085 — that stream belongs in the Console tab, not here. The trace only shows the slice a REPL
// evaluation produces: from the Execute request until its response frame lands (the device prints
// before it answers), so `print 6*7` shows its `42` without the rest of the channel log.
rokuApi.onDebuggerOutput((p) => {
  if (!isForThisDevice(p) || typeof p.text !== 'string') return;
  const tab = tabs.get(debugProtocolPort);
  if (!tab || !tab.replPending) return;
  for (const line of p.text.replace(/\r\n?/g, '\n').split('\n')) {
    if (line) pushEntry(tab, line, 'log');
  }
});

rokuApi.onDebuggerState((p) => {
  if (!isForThisDevice(p) || typeof p.state !== 'string') return;
  const changed = p.state !== debuggerStateNow;
  debuggerStateNow = p.state;
  const tab = tabs.get(debugProtocolPort);
  if (tab && changed) applyDebuggerState(tab, p.state, true);
});

// ── Boot ──────────────────────────────────────────────────────────────────────────────────────

newTabBtn.addEventListener('click', () => openPickerTab());

async function main(): Promise<void> {
  applyI18n(document);
  void initLocaleForWindow(rokuApi, () => {
    renderHeader();
    if (pickerTab) {
      const label = pickerTab.tabEl.querySelector('span:nth-child(2)');
      if (label) label.textContent = S.portTerminal.pickerTitle;
      renderPickerCards(pickerTab.gridEl);
    }
  });

  const info = await rokuApi.getInfo();
  if (!info.success || !info.device) {
    openPickerTab();
    if (pickerTab) pickerTab.gridEl.textContent = info.error || S.portTerminal.noPortsAvailable;
    return;
  }
  device = info.device;
  availablePortList = info.ports ?? [];
  customRule = info.custom ?? null;
  if (typeof info.debugProtocolPort === 'number') debugProtocolPort = info.debugProtocolPort;
  if (typeof info.debuggerState === 'string') debuggerStateNow = info.debuggerState;
  renderHeader();
  openPickerTab();
}

attachInstantTooltips(document.body);
void main();
