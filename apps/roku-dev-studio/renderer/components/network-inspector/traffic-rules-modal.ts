/**
 * Per-device traffic-rules modal for the Network Inspector: block / throttle a device's proxied
 * traffic, plus per-host overrides. Rules are enforced at the RDS MITM proxy, so they apply only to
 * requests the dev channel routes through RDS (not the Roku's other/unproxied traffic).
 */
import type {
  DeviceTrafficRules,
  HostTrafficRule,
  MockResponse,
  RewriteOp,
  TrafficThrottle
} from '@shared/network-inspector/types.js';
import { escapeHtml } from '../../modules/utils/dom.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';

type RokuApi = {
  networkInspectorGetTrafficRules?: () => Promise<{ success?: boolean; rules?: Record<string, DeviceTrafficRules> }>;
  networkInspectorSetDeviceTrafficRules?: (
    deviceIp: string,
    rules: DeviceTrafficRules | null
  ) => Promise<{ success?: boolean }>;
};

// Bandwidth presets (download cap in kbps; 0 = unlimited).
const BW_OPTIONS: Array<{ label: string; kbps: number }> = [
  { label: 'Unlimited', kbps: 0 },
  { label: '8 Mbps', kbps: 8000 },
  { label: '4 Mbps', kbps: 4000 },
  { label: '2 Mbps', kbps: 2000 },
  { label: '1 Mbps', kbps: 1000 },
  { label: '512 kbps', kbps: 512 },
  { label: '256 kbps', kbps: 256 },
  { label: '128 kbps', kbps: 128 }
];

/** Human-readable label for a kbps cap (0 = Unlimited). Whole Mbps render as "N Mbps". */
function kbpsToLabel(kbps: number): string {
  if (!kbps || kbps <= 0) return 'Unlimited';
  if (kbps % 1000 === 0) return `${kbps / 1000} Mbps`;
  return `${kbps} kbps`;
}

/**
 * Parse a typed/selected bandwidth into kbps. Accepts presets ("8 Mbps"), explicit units
 * ("1500 kbps", "3mbps"), "Unlimited"/empty (0), and bare numbers (heuristic: < 100 → Mbps, else
 * kbps — covers realistic caps like "3" = 3 Mbps and "512" = 512 kbps).
 */
function parseBandwidth(text: string): number {
  const s = (text || '').trim().toLowerCase();
  if (!s || s === 'unlimited' || s === '0') return 0;
  const m = s.match(/([\d.]+)\s*([a-z]*)/);
  if (!m) return 0;
  const num = parseFloat(m[1]);
  if (!Number.isFinite(num) || num <= 0) return 0;
  const unit = m[2] || '';
  if (unit.startsWith('m')) return Math.round(num * 1000);
  if (unit.startsWith('k') || unit === 'bps') return Math.round(num);
  return Math.round(num < 100 ? num * 1000 : num);
}

/** Editable bandwidth combobox: a text input plus a caret that opens a floating preset menu (wired
 *  up in `openTrafficRulesModal`). The user can pick a preset OR type a custom value in the field. */
function bwComboHtml(selectedKbps: number, attr: string): string {
  const label = escapeHtml(kbpsToLabel(selectedKbps));
  return `<span class="ni-bw-combo">
    <input type="text" class="ni-rules-select ni-rules-bw" value="${label}" placeholder="Unlimited" autocomplete="off" spellcheck="false" title="Pick a preset or type a custom limit (e.g. 3 Mbps or 1500 kbps)" ${attr} />
    <button type="button" class="ni-bw-caret" data-bw-caret tabindex="-1" aria-label="Show bandwidth presets"><span class="icon icon-xs"><svg><use href="#icon-chevron-down"/></svg></span></button>
  </span>`;
}

/**
 * Split a user-entered target into a host and an optional path. A bare hostname (no `/`) targets
 * every request to that host; anything after the first `/` becomes the path the rule is scoped to.
 * Schemes, credentials and ports are stripped so `https://user@api.example.com:8443/v1/play`
 * normalizes to host `api.example.com`, path `/v1/play`.
 */
function parseHostInput(raw: string): { host: string; path: string } | null {
  let s = (raw || '').trim();
  if (!s) return null;
  s = s.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, ''); // strip scheme
  const slash = s.indexOf('/');
  let host = (slash === -1 ? s : s.slice(0, slash)).trim().toLowerCase();
  let path = slash === -1 ? '' : s.slice(slash).trim();
  host = (host.split('@').pop() || host).split(':')[0]; // strip creds + port
  if (path === '/' || path === '') path = '';
  if (!host) return null;
  return { host, path };
}

// ── Rewrite editor ────────────────────────────────────────────────────────────────────────────
// Charles-style per-rule rewrite ops (non-terminal: the request is still forwarded). Each op is a
// {target, type, match?, value?, regex?} row. The available types depend on the target, and which
// of match/value/regex apply depends on the type (see rewriteFieldConfig).
type RwType = RewriteOp['type'];
const REWRITE_TYPES: Record<'request' | 'response', { value: RwType; label: string }[]> = {
  request: [
    { value: 'set-host', label: 'Redirect host' },
    { value: 'set-path', label: 'Set path' },
    { value: 'set-query', label: 'Set query param' },
    { value: 'remove-query', label: 'Remove query param' },
    { value: 'set-header', label: 'Set header' },
    { value: 'remove-header', label: 'Remove header' },
    { value: 'body-replace', label: 'Replace in body' }
  ],
  response: [
    { value: 'set-status', label: 'Set status' },
    { value: 'set-header', label: 'Set header' },
    { value: 'remove-header', label: 'Remove header' },
    { value: 'body-replace', label: 'Replace in body' }
  ]
};

/** Which fields a given op type uses, and their placeholder labels. */
function rewriteFieldConfig(type: string): { match?: string; value?: string; regex?: boolean } {
  switch (type) {
    case 'set-header': return { match: 'Header name', value: 'Value' };
    case 'remove-header': return { match: 'Header name' };
    case 'set-status': return { value: 'Status code (e.g. 503)' };
    case 'set-host': return { value: 'host or host:port' };
    case 'set-path': return { value: '/new/path' };
    case 'set-query': return { match: 'Param name', value: 'Value' };
    case 'remove-query': return { match: 'Param name' };
    case 'body-replace': return { match: 'Find', value: 'Replace with', regex: true };
    default: return {};
  }
}

function rwTypeOptions(target: 'request' | 'response', selected: string): string {
  return REWRITE_TYPES[target]
    .map((t) => `<option value="${t.value}"${t.value === selected ? ' selected' : ''}>${escapeHtml(t.label)}</option>`)
    .join('');
}

/** One rewrite-op row. Fields are shown/relabeled after render + on target/type change by syncRewriteRow. */
function rewriteOpHtml(op?: RewriteOp): string {
  const target: 'request' | 'response' = op?.target === 'response' ? 'response' : 'request';
  const type = op?.type || REWRITE_TYPES[target][0]!.value;
  const match = escapeHtml(op?.match || '');
  const value = escapeHtml(op?.value || '');
  const regexOn = op?.regex ? ' checked' : '';
  return `<div class="ni-rw-op" data-rw-op>
      <select class="ni-rules-select ni-rw-target" data-rw-target aria-label="Rewrite target">
        <option value="request"${target === 'request' ? ' selected' : ''}>Request</option>
        <option value="response"${target === 'response' ? ' selected' : ''}>Response</option>
      </select>
      <select class="ni-rules-select ni-rw-type" data-rw-type aria-label="Rewrite type">${rwTypeOptions(target, type)}</select>
      <input type="text" class="ni-rules-ct ni-rw-match" data-rw-match value="${match}" spellcheck="false" autocomplete="off" />
      <input type="text" class="ni-rules-ct ni-rw-value" data-rw-value value="${value}" spellcheck="false" autocomplete="off" />
      <label class="ni-rw-regex" data-rw-regex-wrap title="Treat Find as a regular expression"><input type="checkbox" data-rw-regex${regexOn} /> regex</label>
      <button type="button" class="ni-host-rule-remove ni-rw-remove" data-rw-remove title="Remove rewrite" aria-label="Remove rewrite"><span class="icon icon-xs"><svg><use href="#icon-x"/></svg></span></button>
    </div>`;
}

/** Show/hide + relabel a row's match/value/regex fields to match its current type. */
function syncRewriteRow(row: Element): void {
  const typeSel = row.querySelector('[data-rw-type]') as HTMLSelectElement | null;
  const matchEl = row.querySelector('[data-rw-match]') as HTMLInputElement | null;
  const valueEl = row.querySelector('[data-rw-value]') as HTMLInputElement | null;
  const regexWrap = row.querySelector('[data-rw-regex-wrap]') as HTMLElement | null;
  if (!typeSel) return;
  const cfg = rewriteFieldConfig(typeSel.value);
  if (matchEl) {
    matchEl.hidden = !cfg.match;
    matchEl.placeholder = cfg.match || '';
  }
  if (valueEl) {
    valueEl.hidden = !cfg.value;
    valueEl.placeholder = cfg.value || '';
  }
  if (regexWrap) regexWrap.hidden = !cfg.regex;
}

/** Read the rewrite ops from a rule row's editor, dropping incomplete rows. */
function readRewriteOps(ruleRow: Element): RewriteOp[] {
  const ops: RewriteOp[] = [];
  ruleRow.querySelectorAll('[data-rw-op]').forEach((row) => {
    const target = (row.querySelector('[data-rw-target]') as HTMLSelectElement | null)?.value === 'response'
      ? 'response'
      : 'request';
    const type = (row.querySelector('[data-rw-type]') as HTMLSelectElement | null)?.value as RwType | undefined;
    if (!type) return;
    const cfg = rewriteFieldConfig(type);
    const match = ((row.querySelector('[data-rw-match]') as HTMLInputElement | null)?.value || '').trim();
    const value = (row.querySelector('[data-rw-value]') as HTMLInputElement | null)?.value ?? '';
    const regex = (row.querySelector('[data-rw-regex]') as HTMLInputElement | null)?.checked === true;
    // Drop rows missing a required field so half-filled ops don't silently no-op upstream.
    if (cfg.match && !match) return;
    if ((type === 'set-host' || type === 'set-path' || type === 'set-status') && !value.trim()) return;
    const op: RewriteOp = { target, type };
    if (cfg.match) op.match = match;
    if (cfg.value) op.value = value;
    if (cfg.regex && regex) op.regex = true;
    ops.push(op);
  });
  return ops;
}

/** Scope badge text + `data-scope` value for a rule, aware of wildcard (`*`) patterns. Shared by
 *  the initial render and the inline URL editor so the two never drift. */
function ruleScope(host: string, path: string): { label: string; scope: string } {
  const wild = host.includes('*') || path.includes('*');
  if (path) return { label: wild ? 'Wildcard path' : 'Single path', scope: 'path' };
  return { label: wild ? 'Wildcard host' : 'All requests', scope: 'all' };
}

/** Inner markup of `.ni-host-rule-id` (name + scope badge). Rebuilt in place after an inline edit. */
function hostRuleIdHtml(host: string, path: string): string {
  const displayName = escapeHtml(host + path);
  const { label, scope } = ruleScope(host, path);
  return `<span class="ni-host-rule-name" title="${displayName}">${displayName}</span>
        <span class="ni-host-rule-scope" data-scope="${scope}">${label}</span>`;
}

function hostRowHtml(rule: HostTrafficRule): string {
  const host = (rule.host || '').trim();
  const path = (rule.pathContains || '').trim();
  const hostAttr = escapeHtml(host);
  const pathAttr = escapeHtml(path);
  const blockChecked = rule.block ? ' checked' : '';
  const kbps = rule.throttle?.downKbps && rule.throttle.downKbps > 0 ? rule.throttle.downKbps : 0;
  const latency = rule.throttle?.latencyMs && rule.throttle.latencyMs > 0 ? rule.throttle.latencyMs : '';
  const resetChecked = rule.resetConnection ? ' checked' : '';
  const mock = rule.respond;
  const mockOn = mock ? ' checked' : '';
  const mockStatus = mock?.statusCode ?? 200;
  const mockCt = escapeHtml(mock?.contentType || 'application/json');
  const mockDelay = mock?.delayMs && mock.delayMs > 0 ? mock.delayMs : '';
  const mockBody = escapeHtml(mock?.body || '');
  // `data-mock-open` reflects whether the canned-response editor starts expanded. The host + path
  // pair is the rule's identity (stored in data-host / data-path) so saving never re-parses the UI.
  return `<div class="ni-host-rule" data-host="${hostAttr}" data-path="${pathAttr}" data-mock-open="${mock ? '1' : '0'}">
    <div class="ni-host-rule-header" data-host-toggle role="button" tabindex="0" aria-expanded="true" title="Collapse / expand rule">
      <span class="ni-host-rule-caret" aria-hidden="true"><span class="icon icon-xs"><svg><use href="#icon-chevron-down"/></svg></span></span>
      <div class="ni-host-rule-id">${hostRuleIdHtml(host, path)}</div>
      <button type="button" class="ni-host-rule-edit" data-host-edit title="Edit URL" aria-label="Edit URL"><span class="icon icon-xs"><svg><use href="#icon-edit-3"/></svg></span></button>
      <button type="button" class="ni-host-rule-remove" data-host-remove title="Delete rule" aria-label="Delete rule"><span class="icon icon-xs"><svg><use href="#icon-trash"/></svg></span></button>
    </div>
    <div class="ni-host-rule-controls">
      <label class="ni-host-rule-block"><input type="checkbox" data-host-block${blockChecked} /> Block</label>
      <label class="ni-host-rule-flag" title="Drop the connection (simulate a network failure)"><input type="checkbox" data-host-reset${resetChecked} /> Reset</label>
      <label class="ni-host-rule-flag" title="Return a canned response instead of forwarding upstream"><input type="checkbox" data-host-mock${mockOn} /> Mock</label>
      ${bwComboHtml(kbps, 'data-host-bw')}
      <div class="ni-rules-input-suffix ni-host-latency-wrap" title="Added latency (ms)">
        <input type="number" class="ni-rules-latency" data-host-latency min="0" max="10000" step="10" placeholder="Latency" value="${latency}" />
        <span class="ni-rules-suffix-unit">ms</span>
      </div>
    </div>
    <div class="ni-host-rule-mock" data-host-mock-editor${mock ? '' : ' hidden'}>
      <div class="ni-mock-row">
        <label class="ni-mock-field ni-mock-field-status">
          <span class="ni-mock-field-label">Status</span>
          <input type="number" class="ni-mock-num" data-mock-status min="100" max="599" placeholder="200" value="${mockStatus}" title="HTTP status code" />
        </label>
        <label class="ni-mock-field ni-mock-field-ct">
          <span class="ni-mock-field-label">Content-Type</span>
          <input type="text" class="ni-rules-ct" data-mock-ct placeholder="application/json" value="${mockCt}" title="Response Content-Type" />
        </label>
        <label class="ni-mock-field ni-mock-field-delay">
          <span class="ni-mock-field-label">Delay</span>
          <div class="ni-rules-input-suffix">
            <input type="number" class="ni-rules-latency" data-mock-delay min="0" max="60000" step="50" placeholder="0" value="${mockDelay}" title="Delay before responding (ms)" />
            <span class="ni-rules-suffix-unit">ms</span>
          </div>
        </label>
      </div>
      <textarea class="ni-rules-mock-body" data-mock-body rows="3" placeholder="Response Body (e.g. {&quot;error&quot;:&quot;forced&quot;})">${mockBody}</textarea>
    </div>
    <div class="ni-host-rule-rewrite" data-host-rewrite>
      <div class="ni-rw-head">
        <span class="ni-rw-title">Rewrite</span>
        <span class="ni-rw-hint">applied when forwarding (not with Block / Reset / Mock)</span>
        <button type="button" class="btn btn-secondary btn-sm ni-rw-add" data-rw-add>+ Add rewrite</button>
      </div>
      <div class="ni-rw-list" data-rw-list>${(rule.rewrite || []).map((op) => rewriteOpHtml(op)).join('')}</div>
    </div>
  </div>`;
}

function readMockResponse(row: Element): MockResponse | undefined {
  const mockOn = (row.querySelector('[data-host-mock]') as HTMLInputElement | null)?.checked === true;
  if (!mockOn) return undefined;
  const statusRaw = (row.querySelector('[data-mock-status]') as HTMLInputElement | null)?.value || '';
  const statusCode = parseInt(statusRaw, 10);
  const contentType = ((row.querySelector('[data-mock-ct]') as HTMLInputElement | null)?.value || '').trim();
  const delayRaw = (row.querySelector('[data-mock-delay]') as HTMLInputElement | null)?.value || '';
  const delayMs = parseInt(delayRaw, 10);
  const body = (row.querySelector('[data-mock-body]') as HTMLTextAreaElement | null)?.value ?? '';
  const mock: MockResponse = { statusCode: Number.isFinite(statusCode) ? statusCode : 200 };
  if (contentType) mock.contentType = contentType;
  if (Number.isFinite(delayMs) && delayMs > 0) mock.delayMs = delayMs;
  if (body) mock.body = body;
  return mock;
}

function readThrottle(bwInput: HTMLInputElement | null, latencyInput: HTMLInputElement | null): TrafficThrottle | undefined {
  const kbps = bwInput ? parseBandwidth(bwInput.value) : 0;
  const latency = latencyInput ? parseInt(latencyInput.value, 10) || 0 : 0;
  if (kbps <= 0 && latency <= 0) return undefined;
  const t: TrafficThrottle = {};
  if (kbps > 0) t.downKbps = kbps;
  if (latency > 0) t.latencyMs = latency;
  return t;
}

/**
 * Open the traffic-rules modal for a device. `hostSuggestions` pre-fills the host autocomplete with
 * hostnames seen in the current session.
 */
export async function openTrafficRulesModal(opts: {
  deviceIp: string;
  deviceName?: string;
  deviceSerial?: string;
  hostSuggestions: string[];
}): Promise<void> {
  const api = (window as unknown as { roku?: RokuApi }).roku;

  let current: DeviceTrafficRules = {};
  try {
    const res = await api?.networkInspectorGetTrafficRules?.();
    if (res?.success && res.rules && res.rules[opts.deviceIp]) {
      current = res.rules[opts.deviceIp];
    }
  } catch {
    /* default to empty rules */
  }

  const devKbps = current.throttle?.downKbps && current.throttle.downKbps > 0 ? current.throttle.downKbps : 0;
  const devLatency = current.throttle?.latencyMs && current.throttle.latencyMs > 0 ? current.throttle.latencyMs : '';
  const hosts = Array.isArray(current.hosts) ? current.hosts : [];
  const suggestions = Array.from(new Set(opts.hostSuggestions.filter((h) => !!h))).sort();
  const datalistOpts = suggestions.map((h) => `<option value="${escapeHtml(h)}"></option>`).join('');

  // Device identity for the header: a friendly name as the primary line and the IP as a
  // mono-styled chip beneath it. Serial is demoted to a hover title so the header stays clean
  // while the value is still discoverable.
  const deviceName = (opts.deviceName || '').trim();
  const primaryName = deviceName || 'Roku Device';
  const serialTitle = opts.deviceSerial ? `Serial ${opts.deviceSerial}` : '';

  const overlay = document.createElement('div');
  // `.modal-overlay` is display:none until `.active` is added.
  overlay.className = 'modal-overlay ni-rules-overlay active';
  overlay.innerHTML = `
    <div class="ni-rules-modal" role="dialog" aria-modal="true" aria-label="Traffic Rules">
      <div class="ni-rules-header">
        <div class="ni-rules-header-info">
          <h3 class="ni-rules-title">Traffic Rules</h3>
          <div class="ni-rules-device-line"${serialTitle ? ` title="${escapeHtml(serialTitle)}"` : ''}>
            <span class="ni-rules-device-dot" aria-hidden="true"></span>
            <span class="ni-rules-device-name">${escapeHtml(primaryName)}</span>
            <span class="ni-rules-device-sep" aria-hidden="true">•</span>
            <span class="ni-rules-device-ip">${escapeHtml(opts.deviceIp)}</span>
          </div>
        </div>
        <button type="button" class="modal-close ni-rules-close" title="Close" aria-label="Close">×</button>
      </div>
      <div class="ni-rules-body">
        <p class="ni-rules-note">Applies only to traffic this device routes through the Roku Dev Studio proxy — its other (unproxied) traffic is unaffected. Changes take effect immediately.</p>

        <section class="ni-rules-card">
          <div class="ni-rules-card-head">
            <span class="ni-rules-card-title">Device Traffic</span>
          </div>
          <label class="ni-rules-toggle-row">
            <span class="ni-rules-toggle-text">
              <span class="ni-rules-toggle-title">Block all proxied traffic</span>
              <span class="ni-rules-toggle-desc">Reject every request routed through the proxy.</span>
            </span>
            <input type="checkbox" class="ni-rules-switch" data-block-all${current.blockAll ? ' checked' : ''} />
          </label>
          <div class="ni-rules-field-grid" data-dev-throttle>
            <div class="ni-rules-field">
              <label class="ni-rules-field-label" for="niDevBw">Bandwidth Limit</label>
              ${bwComboHtml(devKbps, 'data-dev-bw id="niDevBw"')}
            </div>
            <div class="ni-rules-field">
              <label class="ni-rules-field-label" for="niDevLatency">Added Latency</label>
              <div class="ni-rules-input-suffix">
                <input type="number" class="ni-rules-latency" id="niDevLatency" data-dev-latency min="0" max="10000" step="10" placeholder="0" value="${devLatency}" title="Added latency (ms)" />
                <span class="ni-rules-suffix-unit">ms</span>
              </div>
            </div>
          </div>
        </section>

        <p class="ni-rules-blocked-note" data-hosts-blocked hidden>Per-host rules don't apply while all proxied traffic is blocked.</p>
        <p class="ni-rules-throttle-note" data-hosts-throttle-note hidden></p>
        <section class="ni-rules-card" data-hosts-section>
          <div class="ni-rules-card-head">
            <span class="ni-rules-card-title">Per-Host Rules</span>
          </div>
          <div class="ni-rules-add">
            <input type="text" class="ni-rules-add-input" data-add-host list="niHostSuggest" placeholder="api.example.com   ·   *.example.com   ·   api.example.com/v1/*" title="Host, or host/path. Use * as a wildcard (e.g. *.example.com matches prod + staging, /v1/* matches any path under /v1/)." />
            <button type="button" class="btn btn-secondary btn-sm" data-add-host-btn>Add</button>
          </div>
          <div class="ni-host-rule-list" data-host-list>${hosts.map(hostRowHtml).join('')}</div>
          <p class="ni-rules-empty-hint"${hosts.length ? ' hidden' : ''} data-host-empty>No rules yet — add a host or path above to override its behavior.</p>
          <datalist id="niHostSuggest">${datalistOpts}</datalist>
        </section>
      </div>
      <div class="ni-rules-footer">
        <span class="ni-rules-status" data-rules-status aria-live="polite"></span>
        <button type="button" class="btn btn-secondary" data-rules-cancel>Cancel</button>
        <button type="button" class="btn btn-primary" data-rules-save>Save changes</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Floating bandwidth-preset menu — appended to the overlay (never inside the scrolling rule list)
  // so it can't be clipped, and positioned under whichever combo input is active.
  const bwMenu = document.createElement('div');
  bwMenu.className = 'ni-bw-menu';
  bwMenu.hidden = true;
  bwMenu.setAttribute('role', 'listbox');
  bwMenu.innerHTML = BW_OPTIONS.map(
    (o) => `<button type="button" class="ni-bw-opt" data-bw-opt="${escapeHtml(o.label)}">${escapeHtml(o.label)}</button>`
  ).join('');
  overlay.appendChild(bwMenu);
  let bwActiveInput: HTMLInputElement | null = null;
  const positionBwMenu = (input: HTMLInputElement): void => {
    const r = input.getBoundingClientRect();
    bwMenu.style.left = `${r.left}px`;
    bwMenu.style.top = `${r.bottom + 3}px`;
    bwMenu.style.minWidth = `${r.width}px`;
  };
  const closeBwMenu = (): void => {
    bwMenu.hidden = true;
    bwActiveInput = null;
  };
  const openBwMenu = (input: HTMLInputElement): void => {
    if (input.disabled) return;
    bwActiveInput = input;
    positionBwMenu(input);
    bwMenu.hidden = false;
  };
  // Keep the caret/options from stealing focus so the active input stays focused.
  overlay.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('[data-bw-caret], .ni-bw-menu')) e.preventDefault();
  });
  bwMenu.addEventListener('click', (e) => {
    const opt = (e.target as HTMLElement).closest('[data-bw-opt]') as HTMLElement | null;
    if (!opt || !bwActiveInput) return;
    bwActiveInput.value = opt.dataset.bwOpt || '';
    bwActiveInput.dispatchEvent(new Event('change', { bubbles: true }));
    closeBwMenu();
  });
  overlay.addEventListener('focusin', (e) => {
    const t = e.target as HTMLElement;
    if (t.classList?.contains('ni-rules-bw')) openBwMenu(t as HTMLInputElement);
    else if (!bwMenu.contains(t)) closeBwMenu();
  });
  overlay.addEventListener('focusout', (e) => {
    const input = e.target as HTMLElement;
    if (!input.classList?.contains('ni-rules-bw')) return;
    // Normalize on blur: presets/custom → clean label; unparseable text → Unlimited.
    (input as HTMLInputElement).value = kbpsToLabel(parseBandwidth((input as HTMLInputElement).value));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    closeBwMenu();
  });
  overlay.addEventListener('click', (e) => {
    const caret = (e.target as HTMLElement).closest('[data-bw-caret]') as HTMLElement | null;
    if (!caret) return;
    const input = caret.parentElement?.querySelector('.ni-rules-bw') as HTMLInputElement | null;
    if (!input || input.disabled) return;
    if (bwActiveInput === input && !bwMenu.hidden) closeBwMenu();
    else {
      input.focus();
      openBwMenu(input);
    }
  });
  // Keep the menu pinned under its input while the modal/list scrolls (instead of closing it).
  overlay.addEventListener('scroll', () => { if (!bwMenu.hidden && bwActiveInput) positionBwMenu(bwActiveInput); }, true);

  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    if (!bwMenu.hidden) {
      closeBwMenu();
      return;
    }
    close();
  };
  document.addEventListener('keydown', onKey);
  attachBackdropClickToClose(overlay, close);
  overlay.querySelector('.ni-rules-close')?.addEventListener('click', close);
  overlay.querySelector('[data-rules-cancel]')?.addEventListener('click', close);

  const hostList = overlay.querySelector('[data-host-list]') as HTMLElement | null;
  const addInput = overlay.querySelector('[data-add-host]') as HTMLInputElement | null;
  const emptyHint = overlay.querySelector('[data-host-empty]') as HTMLElement | null;

  const syncEmptyHint = (): void => {
    if (emptyHint) emptyHint.hidden = !!hostList?.querySelector('.ni-host-rule');
  };

  // Block / Reset / Mock are terminal actions — when any is selected the proxy never reaches the
  // throttle step, so the bandwidth + latency controls are disabled to reflect that they're a no-op.
  const syncRowThrottle = (row: Element): void => {
    const block = (row.querySelector('[data-host-block]') as HTMLInputElement | null)?.checked === true;
    const reset = (row.querySelector('[data-host-reset]') as HTMLInputElement | null)?.checked === true;
    const mock = (row.querySelector('[data-host-mock]') as HTMLInputElement | null)?.checked === true;
    const disable = block || reset || mock;
    const bw = row.querySelector('[data-host-bw]') as HTMLSelectElement | null;
    const lat = row.querySelector('[data-host-latency]') as HTMLInputElement | null;
    if (bw) bw.disabled = disable;
    if (lat) lat.disabled = disable;
    (row.querySelector('.ni-host-latency-wrap') as HTMLElement | null)?.classList.toggle('is-disabled', disable);
  };

  const addHost = (): void => {
    const parsed = parseHostInput(addInput?.value || '');
    if (!parsed || !hostList) return;
    const { host, path } = parsed;
    const key = host + path;
    const existing = Array.from(hostList.querySelectorAll('.ni-host-rule')).find(
      (r) => ((r as HTMLElement).dataset.host || '') + ((r as HTMLElement).dataset.path || '') === key
    ) as HTMLElement | undefined;
    if (existing) {
      if (addInput) addInput.value = '';
      existing.classList.add('ni-host-rule-flash');
      existing.scrollIntoView({ block: 'nearest' });
      window.setTimeout(() => existing.classList.remove('ni-host-rule-flash'), 600);
      return;
    }
    hostList.insertAdjacentHTML('beforeend', hostRowHtml({ host, pathContains: path || undefined }));
    if (addInput) addInput.value = '';
    syncEmptyHint();
    const newRow = hostList.lastElementChild;
    if (newRow) syncRowThrottle(newRow);
    syncHostThrottleBounds();
  };

  overlay.querySelector('[data-add-host-btn]')?.addEventListener('click', addHost);
  addInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addHost();
    }
  });

  const toggleCollapse = (header: Element): void => {
    const rule = header.closest('.ni-host-rule');
    if (!rule) return;
    const collapsed = rule.classList.toggle('is-collapsed');
    header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  };

  const ruleKey = (row: Element): string =>
    ((row as HTMLElement).dataset.host || '') + ((row as HTMLElement).dataset.path || '');

  // Inline edit of a rule's intercept URL. Swaps the read-only name for a text input pre-filled
  // with `host+path`; on Enter/blur it re-parses (reusing parseHostInput), rejects duplicates, and
  // updates the rule's identity (data-host/data-path) + scope badge in place. Escape cancels.
  const startEditUrl = (row: HTMLElement): void => {
    const idEl = row.querySelector('.ni-host-rule-id') as HTMLElement | null;
    if (!idEl || idEl.querySelector('[data-host-edit-input]')) return;
    row.classList.remove('is-collapsed');
    row.querySelector('[data-host-toggle]')?.setAttribute('aria-expanded', 'true');
    const current = (row.dataset.host || '') + (row.dataset.path || '');
    idEl.innerHTML = `<input type="text" class="ni-host-rule-edit-input" data-host-edit-input value="${escapeHtml(current)}" spellcheck="false" autocomplete="off" aria-label="Edit intercept URL" />`;
    const input = idEl.querySelector('[data-host-edit-input]') as HTMLInputElement;
    input.focus();
    input.select();
    let done = false;
    const restore = (): void => { idEl.innerHTML = hostRuleIdHtml(row.dataset.host || '', row.dataset.path || ''); };
    const commit = (): void => {
      if (done) return;
      done = true;
      const parsed = parseHostInput(input.value);
      if (!parsed) { restore(); return; } // empty / unparseable → keep the original URL
      const key = parsed.host + parsed.path;
      const clash = Array.from(hostList?.querySelectorAll('.ni-host-rule') || []).some(
        (r) => r !== row && ruleKey(r) === key
      );
      if (clash) { restore(); return; } // a rule with this URL already exists — leave unchanged
      row.dataset.host = parsed.host;
      row.dataset.path = parsed.path;
      restore();
    };
    const cancel = (): void => { if (done) return; done = true; restore(); };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // don't let Enter/Space bubble to the header's collapse toggle
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', commit);
  };

  hostList?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-host-edit-input]')) return; // clicks inside the editor don't toggle
    const rm = target.closest('[data-host-remove]');
    if (rm) {
      rm.closest('.ni-host-rule')?.remove();
      syncEmptyHint();
      return;
    }
    const edit = target.closest('[data-host-edit]');
    if (edit) {
      const row = edit.closest('.ni-host-rule');
      if (row) startEditUrl(row as HTMLElement);
      return;
    }
    const rwAdd = target.closest('[data-rw-add]');
    if (rwAdd) {
      const list = rwAdd.closest('.ni-host-rule-rewrite')?.querySelector('[data-rw-list]');
      if (list) {
        list.insertAdjacentHTML('beforeend', rewriteOpHtml());
        const newRow = list.lastElementChild;
        if (newRow) syncRewriteRow(newRow);
      }
      return;
    }
    const rwRemove = target.closest('[data-rw-remove]');
    if (rwRemove) {
      rwRemove.closest('.ni-rw-op')?.remove();
      return;
    }
    const header = target.closest('[data-host-toggle]');
    if (header) toggleCollapse(header);
  });

  // Rewrite op: target change repopulates the type list; both target + type re-sync the fields.
  hostList?.addEventListener('change', (e) => {
    const t = e.target as HTMLElement;
    const row = t.closest('[data-rw-op]');
    if (!row) return;
    if (t.matches('[data-rw-target]')) {
      const targetVal = (t as HTMLSelectElement).value === 'response' ? 'response' : 'request';
      const typeSel = row.querySelector('[data-rw-type]') as HTMLSelectElement | null;
      if (typeSel) typeSel.innerHTML = rwTypeOptions(targetVal, REWRITE_TYPES[targetVal][0]!.value);
      syncRewriteRow(row);
    } else if (t.matches('[data-rw-type]')) {
      syncRewriteRow(row);
    }
  });

  hostList?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const header = (e.target as HTMLElement).closest('[data-host-toggle]');
    if (!header) return;
    e.preventDefault();
    toggleCollapse(header);
  });

  // Reflect the loaded rules' terminal actions on the throttle controls right away.
  hostList?.querySelectorAll('.ni-host-rule').forEach(syncRowThrottle);
  // Relabel/hide each loaded rewrite row's fields to match its type.
  hostList?.querySelectorAll('[data-rw-op]').forEach(syncRewriteRow);

  // "Block all proxied traffic" short-circuits everything — the device throttle and every per-host
  // rule become no-ops — so disable those controls (without clearing them) while it's on.
  const blockAllCb = overlay.querySelector('[data-block-all]') as HTMLInputElement | null;
  const devBw = overlay.querySelector('[data-dev-bw]') as HTMLSelectElement | null;
  const devLat = overlay.querySelector('[data-dev-latency]') as HTMLInputElement | null;
  const devThrottle = overlay.querySelector('[data-dev-throttle]') as HTMLElement | null;
  const hostsSection = overlay.querySelector('[data-hosts-section]') as HTMLElement | null;
  const hostsBlockedNote = overlay.querySelector('[data-hosts-blocked]') as HTMLElement | null;
  const hostsThrottleNote = overlay.querySelector('[data-hosts-throttle-note]') as HTMLElement | null;

  // Per-host throttle is bound by the device throttle: a host can't be FASTER than the device cap
  // (clamp its bandwidth down to the device limit) and can't go BELOW the device latency (floor).
  const syncHostThrottleBounds = (): void => {
    const devKbps = devBw ? parseBandwidth(devBw.value) : 0;
    const devLatency = devLat ? parseInt(devLat.value, 10) || 0 : 0;
    hostList?.querySelectorAll('.ni-host-rule').forEach((row) => {
      const bw = row.querySelector('[data-host-bw]') as HTMLInputElement | null;
      if (bw && document.activeElement !== bw) {
        const hostKbps = parseBandwidth(bw.value);
        if (devKbps > 0 && hostKbps > 0 && hostKbps > devKbps) bw.value = kbpsToLabel(devKbps);
      }
      const lat = row.querySelector('[data-host-latency]') as HTMLInputElement | null;
      if (lat) {
        lat.min = devLatency > 0 ? String(devLatency) : '0';
        lat.placeholder = devLatency > 0 ? String(devLatency) : 'Latency';
      }
    });
    if (hostsThrottleNote) {
      const active = !blockAllCb?.checked && (devKbps > 0 || devLatency > 0);
      hostsThrottleNote.hidden = !active;
      if (active) {
        const parts: string[] = [];
        if (devKbps > 0) parts.push(`speed is capped to the Device Limit (${kbpsToLabel(devKbps)})`);
        if (devLatency > 0) parts.push(`latency is floored to the Device Latency (${devLatency} ms)`);
        hostsThrottleNote.textContent = `Per-Host ${parts.join(', and ')}.`;
      }
    }
  };

  const syncBlockAllState = (): void => {
    const blocked = blockAllCb?.checked === true;
    if (devBw) devBw.disabled = blocked;
    if (devLat) devLat.disabled = blocked;
    devThrottle?.classList.toggle('is-disabled', blocked);
    hostsSection?.classList.toggle('is-hosts-blocked', blocked);
    if (hostsBlockedNote) hostsBlockedNote.hidden = !blocked;
    syncHostThrottleBounds();
  };
  blockAllCb?.addEventListener('change', syncBlockAllState);
  devBw?.addEventListener('change', syncHostThrottleBounds);
  devLat?.addEventListener('input', syncHostThrottleBounds);
  // Clamp a host bandwidth back to the device cap once the user commits it (on blur / enter).
  hostList?.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).matches?.('[data-host-bw]')) syncHostThrottleBounds();
  });
  syncBlockAllState();

  // Toggle the canned-response editor when "Mock response" is (un)checked. Block + Mock + Reset are
  // mutually exclusive terminal actions; checking one unchecks the others to avoid confusing combos.
  hostList?.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    const row = target.closest('.ni-host-rule');
    if (!row) return;
    if (target.matches('[data-host-mock]')) {
      const on = (target as HTMLInputElement).checked;
      const editor = row.querySelector('[data-host-mock-editor]') as HTMLElement | null;
      if (editor) editor.hidden = !on;
      if (on) {
        (row.querySelector('[data-host-block]') as HTMLInputElement | null)?.removeAttribute('checked');
        const blockCb = row.querySelector('[data-host-block]') as HTMLInputElement | null;
        const resetCb = row.querySelector('[data-host-reset]') as HTMLInputElement | null;
        if (blockCb) blockCb.checked = false;
        if (resetCb) resetCb.checked = false;
      }
    } else if (target.matches('[data-host-block]') || target.matches('[data-host-reset]')) {
      if ((target as HTMLInputElement).checked) {
        const mockCb = row.querySelector('[data-host-mock]') as HTMLInputElement | null;
        const editor = row.querySelector('[data-host-mock-editor]') as HTMLElement | null;
        if (mockCb) mockCb.checked = false;
        if (editor) editor.hidden = true;
        // Block and Reset are also mutually exclusive.
        const other = target.matches('[data-host-block]')
          ? (row.querySelector('[data-host-reset]') as HTMLInputElement | null)
          : (row.querySelector('[data-host-block]') as HTMLInputElement | null);
        if (other) other.checked = false;
      }
    }
    syncRowThrottle(row);
  });

  overlay.querySelector('[data-rules-save]')?.addEventListener('click', () => {
    void (async () => {
      const blockAll = (overlay.querySelector('[data-block-all]') as HTMLInputElement | null)?.checked === true;
      const devThrottle = readThrottle(
        overlay.querySelector('[data-dev-bw]') as HTMLInputElement | null,
        overlay.querySelector('[data-dev-latency]') as HTMLInputElement | null
      );
      const hostRules: HostTrafficRule[] = [];
      overlay.querySelectorAll('.ni-host-rule').forEach((row) => {
        const host = (row as HTMLElement).dataset.host || '';
        if (!host) return;
        const block = (row.querySelector('[data-host-block]') as HTMLInputElement | null)?.checked === true;
        const reset = (row.querySelector('[data-host-reset]') as HTMLInputElement | null)?.checked === true;
        const throttle = readThrottle(
          row.querySelector('[data-host-bw]') as HTMLInputElement | null,
          row.querySelector('[data-host-latency]') as HTMLInputElement | null
        );
        const mock = readMockResponse(row);
        const rewrite = readRewriteOps(row);
        const pathContains = ((row as HTMLElement).dataset.path || '').trim();
        // A host row with no effect at all is dropped.
        if (!block && !reset && !throttle && !mock && rewrite.length === 0) return;
        const rule: HostTrafficRule = { host };
        if (pathContains) rule.pathContains = pathContains;
        if (block) rule.block = true;
        else if (reset) rule.resetConnection = true;
        else if (mock) rule.respond = mock;
        if (throttle) rule.throttle = throttle;
        if (rewrite.length) rule.rewrite = rewrite;
        hostRules.push(rule);
      });

      const rules: DeviceTrafficRules = {};
      if (blockAll) rules.blockAll = true;
      if (devThrottle) rules.throttle = devThrottle;
      if (hostRules.length > 0) rules.hosts = hostRules;

      const statusEl = overlay.querySelector('[data-rules-status]');
      if (!api?.networkInspectorSetDeviceTrafficRules) {
        if (statusEl) statusEl.textContent = 'Restart Roku Dev Studio to enable saving traffic rules.';
        return;
      }
      try {
        const hasAny = blockAll || !!devThrottle || hostRules.length > 0;
        const res = await api.networkInspectorSetDeviceTrafficRules(opts.deviceIp, hasAny ? rules : null);
        if (res?.success) {
          close();
        } else if (statusEl) {
          statusEl.textContent = 'Failed to save Traffic Rules.';
        }
      } catch (err) {
        if (statusEl) statusEl.textContent = err instanceof Error ? err.message : String(err);
      }
    })();
  });
}
