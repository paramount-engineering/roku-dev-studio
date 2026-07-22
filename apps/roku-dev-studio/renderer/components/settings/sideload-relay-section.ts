/**
 * Sideload Relay settings section (Settings window).
 *
 * Owns the "Sideload Relay" UI: the gate + relay Dev Password + fan-out flags, a
 * "Targeted Devices" summary row that opens a full device-setup modal, and a
 * live per-device results view. The setup modal shows the UNION of previously
 * targeted devices and currently-reachable devices (local + remote), lets you
 * enable/disable each, and marks reachability. Config is persisted through the
 * dedicated `sideloadRelay*` IPC.
 */

import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { S } from '@shared/strings/index.js';

interface Target {
  id: string;
  ip: string;
  name: string;
  enabled: boolean;
  serial?: string;
  location?: string;
  remote?: boolean;
  serverUrl?: string;
  locationId?: string;
}
interface Candidate {
  id: string;
  ip: string;
  name: string;
  serial?: string;
  location: string;
  remote: boolean;
  serverUrl?: string;
  locationId?: string;
  hasPassword: boolean;
}
interface ModalRow {
  key: string;
  ip: string;
  name: string;
  serial?: string;
  location: string;
  remote: boolean;
  serverUrl?: string;
  locationId?: string;
  reachable: boolean;
  wasTargeted: boolean;
  enabled: boolean;
  /** A validated dev password is stored for this device. */
  hasPassword: boolean;
}

/** Key of the row currently showing its inline password entry, if any. */
let pwEditingKey: string | null = null;
/** In-flight scan promise, so concurrent triggers (init + modal open) share one scan. */
let scanInFlight: Promise<void> | null = null;

const api = (window as any).settingsApi;

let targets: Target[] = [];
/** Devices reachable as of the last scan (drives reachability + the count). */
let discovered: Candidate[] = [];
let scanned = false;
let modalRows: ModalRow[] = [];
/** A Relay Dev Password is already saved in the backend. */
let hasSavedPassword = false;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

/** Eye / eye-off icon pair for the password reveal toggle (CSS swaps which shows). */
function EYE_SVG(): Node {
  const span = document.createElement('span');
  span.className = 'sr-pw-eye-icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML =
    '<svg class="eye-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
    '<svg class="eye-off" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  return span;
}

/** Stable identity for merge/dedupe: serial when known, else ip. */
function keyOf(x: { serial?: string; ip: string }): string {
  return x.serial || x.ip;
}
function isReachable(t: Target): boolean {
  return discovered.some((d) => keyOf(d) === keyOf(t) || d.ip === t.ip);
}

/**
 * Show the "or a browser at http://<ip>/" hint only while the relay is actually
 * running (that's the only time the address is real and reachable). When it's
 * off, hide the whole clause.
 */
async function refreshRelayUrlHint(): Promise<void> {
  const wrap = document.getElementById('srRelayUrlWrap');
  const code = document.getElementById('srRelayUrl');
  if (!wrap || !code || !api.sideloadRelayGetStatus) return;
  try {
    const res = await api.sideloadRelayGetStatus();
    const st = res && res.status;
    const ip = st && st.enabled && Array.isArray(st.addresses) ? st.addresses.find((a: string) => a && a !== '127.0.0.1') : null;
    if (st && st.enabled && ip) {
      const port = st.boundPort && st.boundPort !== 80 ? `:${st.boundPort}` : '';
      code.textContent = `http://${ip}${port}/`;
      wrap.removeAttribute('hidden');
    } else {
      wrap.setAttribute('hidden', '');
    }
  } catch {
    wrap.setAttribute('hidden', '');
  }
}

// ============================================================
// Enable gate — prerequisites before the relay may be turned on
// ============================================================

/** A password is available (already saved, or typed but not yet saved). */
function passwordIsSet(): boolean {
  const pwd = document.getElementById('srPassword') as HTMLInputElement | null;
  return hasSavedPassword || !!(pwd && pwd.value.trim());
}

/** True when the device prerequisite fails: nothing targeted, or nothing targeted is reachable. */
function deviceGateFails(): boolean {
  const enabledTargets = targets.filter((t) => t.enabled);
  if (enabledTargets.length === 0) return true; // nothing targeted at all
  if (!scanned) return false; // reachability unknown yet — don't nag before the first scan
  return enabledTargets.every((t) => !isReachable(t)); // targeted, but none online
}

/** Reasons the relay cannot be enabled right now (empty ⇒ OK to enable). */
function gateReasons(): string[] {
  const reasons: string[] = [];
  if (!passwordIsSet()) reasons.push(S.sideloadRelay.gateNeedPassword);
  if (deviceGateFails()) reasons.push(S.sideloadRelay.gateNeedDevice);
  return reasons;
}

/** Render the warning banner above the rows (shown only while the relay is off and prerequisites are unmet). */
function renderGateBanner(reasons: string[], attention = false): void {
  const el = document.getElementById('srGateWarning');
  if (!el) return;
  el.textContent = '';
  el.classList.remove('attention');
  if (!reasons.length) {
    el.setAttribute('hidden', '');
    return;
  }
  el.removeAttribute('hidden');
  el.append(
    h('div', { class: 'sr-gate-title' }, [S.sideloadRelay.gateTitle]),
    h('ul', { class: 'sr-gate-list' }, reasons.map((r) => h('li', {}, [r])))
  );
  if (attention) {
    // Restart the flash animation so repeated blocked clicks re-pulse.
    void el.offsetWidth;
    el.classList.add('attention');
  }
}

/** Recompute + show/hide the banner for the current state (called on any input that affects the gate). */
function updateGateBanner(): void {
  const enabled = boolOf('optSideloadRelay');
  renderGateBanner(enabled ? [] : gateReasons());
}

/**
 * Handle a click on the Enable toggle. Turning off is always allowed. Turning
 * on runs a scan (so reachability is known) and blocks — reverting the switch
 * and surfacing the reasons — if the password or device prerequisites aren't met.
 */
async function onEnableToggle(): Promise<void> {
  const input = document.getElementById('optSideloadRelay') as HTMLInputElement | null;
  if (!input) return;
  if (!input.checked) {
    updateGateBanner();
    return;
  }
  if (!scanned) await scanDevices(); // learn reachability before deciding
  const reasons = gateReasons();
  if (reasons.length) {
    setToggle('optSideloadRelay', false); // revert — programmatic set does not re-fire change
    renderGateBanner(reasons, true);
  } else {
    renderGateBanner([]);
  }
}

/** Update the "Targeted Devices" summary count in the settings row. */
function updateTargetSummary(): void {
  const el = document.getElementById('srTargetSummary');
  if (!el) return;
  const enabled = targets.filter((t) => t.enabled);
  if (!enabled.length) {
    el.textContent = S.sideloadRelay.targetSummaryEmpty;
    return;
  }
  if (!scanned) {
    el.textContent = S.sideloadRelay.targetSummaryChecking(enabled.length);
    return;
  }
  const reachable = enabled.filter((t) => isReachable(t)).length;
  const offline = enabled.length - reachable;
  let txt = S.sideloadRelay.targetSummaryReachable(reachable);
  if (offline > 0) txt += S.sideloadRelay.targetSummaryOfflineSuffix(offline);
  el.textContent = txt;
}

// ============================================================
// Setup Devices modal
// ============================================================

/** Merge saved targets + freshly discovered devices into the modal's row set. */
function buildModalRows(): void {
  const byKey = new Map<string, ModalRow>();
  for (const t of targets) {
    const key = keyOf(t);
    byKey.set(key, {
      key,
      ip: t.ip,
      name: t.name,
      serial: t.serial,
      location: t.location || (t.remote ? S.sideloadRelay.locRemote : S.sideloadRelay.locLocal),
      remote: !!t.remote,
      serverUrl: t.serverUrl,
      locationId: t.locationId,
      reachable: false,
      wasTargeted: true,
      enabled: t.enabled,
      // Assume a saved target already had a working password; discovery refreshes this.
      hasPassword: true
    });
  }
  for (const d of discovered) {
    const key = keyOf(d);
    let row = byKey.get(key);
    if (!row) row = Array.from(byKey.values()).find((r) => r.ip === d.ip);
    if (row) {
      row.reachable = true;
      row.name = d.name || row.name;
      row.serial = d.serial || row.serial;
      row.location = d.location;
      row.remote = d.remote;
      row.serverUrl = d.serverUrl;
      row.locationId = d.locationId;
      row.hasPassword = d.hasPassword;
      if (!d.hasPassword) row.enabled = false; // can't stay enabled without a validated password
    } else {
      byKey.set(key, {
        key,
        ip: d.ip,
        name: d.name,
        serial: d.serial,
        location: d.location,
        remote: d.remote,
        serverUrl: d.serverUrl,
        locationId: d.locationId,
        reachable: true,
        wasTargeted: false,
        enabled: false,
        hasPassword: d.hasPassword
      });
    }
  }
  modalRows = Array.from(byKey.values()).sort((a, b) => {
    if (a.reachable !== b.reachable) return a.reachable ? -1 : 1; // reachable first
    if (a.location !== b.location) return a.location.localeCompare(b.location);
    return a.name.localeCompare(b.name);
  });
}

function renderModalTable(): void {
  const table = document.getElementById('srDeviceTable');
  if (!table) return;
  table.textContent = '';
  table.append(
    h('div', { class: 'sr-dtable-head' }, [
      h('span', {}, [S.sideloadRelay.colLocation]),
      h('span', {}, [S.sideloadRelay.colDevice]),
      h('span', {}, [S.sideloadRelay.colIpSerial]),
      h('span', { class: 'sr-col-center' }, [S.sideloadRelay.colEnabled]),
      h('span', { class: 'sr-col-center' }, [S.sideloadRelay.colReachable])
    ])
  );
  if (!modalRows.length) {
    table.append(h('div', { class: 'sr-dtable-empty' }, [S.sideloadRelay.emptyDevices]));
    updateModalSummary();
    return;
  }
  for (const row of modalRows) {
    const locPill = h('span', { class: `sr-loc-pill ${row.remote ? 'sr-loc-remote' : 'sr-loc-local'}` }, [row.location]);

    // Enabled cell: a checkbox once we hold a validated password; otherwise a
    // "Set password" affordance (reachable devices only — you can't validate one
    // that's offline). While editing, the password entry lives IN this cell.
    let enabledCell: HTMLElement;
    if (row.reachable && !row.hasPassword) {
      if (pwEditingKey === row.key) {
        enabledCell = renderPasswordEditor(row);
      } else {
        const setBtn = h('button', { type: 'button', class: 'sr-pw-btn', title: S.sideloadRelay.setPasswordTitle }, [S.sideloadRelay.setPasswordBtn]);
        setBtn.addEventListener('click', () => {
          pwEditingKey = row.key;
          renderModalTable();
        });
        enabledCell = h('span', { class: 'sr-dt-cell-center' }, [setBtn]);
      }
    } else {
      const toggle = h('input', { type: 'checkbox', class: 'settings-toggle-input', role: 'switch', 'aria-label': S.sideloadRelay.enableAriaLabel(row.name) }) as HTMLInputElement;
      toggle.checked = row.enabled;
      toggle.disabled = !row.reachable; // offline previously-targeted rows are locked
      toggle.setAttribute('aria-checked', row.enabled ? 'true' : 'false');
      toggle.addEventListener('change', () => {
        row.enabled = toggle.checked;
        toggle.setAttribute('aria-checked', toggle.checked ? 'true' : 'false');
        updateModalSummary();
      });
      enabledCell = h('span', { class: 'sr-dt-cell-center' }, [
        h('label', { class: 'settings-toggle-wrap sr-dt-toggle' }, [toggle, h('span', { class: 'settings-toggle-ui', 'aria-hidden': 'true' }, [])])
      ]);
    }

    const reach = row.reachable
      ? h('span', { class: 'sr-reach sr-reach-ok', title: S.sideloadRelay.reachableNow }, [S.sideloadRelay.reachableOk])
      : h('span', { class: 'sr-reach sr-reach-off', title: S.sideloadRelay.reachableOffTitle }, [S.sideloadRelay.reachableOff]);

    table.append(
      h('div', { class: `sr-dtable-row${row.reachable ? '' : ' sr-row-off'}` }, [
        h('span', { class: 'sr-dt-loc' }, [locPill]),
        h('span', { class: 'sr-dt-name' }, [row.name]),
        h('span', { class: 'sr-dt-info' }, [h('span', { class: 'sr-dt-ip' }, [row.ip]), h('span', { class: 'sr-dt-serial' }, [row.serial || '—'])]),
        enabledCell,
        h('span', { class: 'sr-dt-cell-center' }, [reach])
      ])
    );
  }
  updateModalSummary();
}

/**
 * Inline dev-password entry, rendered INSIDE the Enabled cell of the device's
 * row (no extra full-width row). Layout: a password box with a ✓ validate
 * button tucked inside it, a Cancel link below. On a bad password the box
 * shakes, flashes red, and clears; on success the row flips to a checked box.
 */
function renderPasswordEditor(row: ModalRow): HTMLElement {
  const input = h('input', {
    type: 'password',
    class: 'sr-pw-input2',
    placeholder: S.sideloadRelay.pwInputPlaceholder,
    'aria-label': S.sideloadRelay.pwInputAriaLabel(row.name),
    autocomplete: 'off'
  }) as HTMLInputElement;
  const validateBtn = h('button', { type: 'button', class: 'sr-pw-validate', title: S.sideloadRelay.pwValidateTitle(row.name), 'aria-label': S.sideloadRelay.pwValidateAriaLabel }, [S.sideloadRelay.pwValidateChar]);
  const field = h('div', { class: 'sr-pw-field' }, [input, validateBtn]);
  const cancelBtn = h('button', { type: 'button', class: 'sr-pw-cancel' }, [S.common.cancel]);
  const err = h('span', { class: 'sr-pw-err2', 'aria-live': 'polite' }, []);

  const fail = (msg: string) => {
    err.textContent = msg;
    input.value = '';
    field.classList.remove('shake');
    void field.offsetWidth; // reflow so the animation restarts on repeat failures
    field.classList.add('shake', 'sr-pw-bad');
    validateBtn.removeAttribute('disabled');
    input.focus();
  };

  const run = async () => {
    const password = input.value;
    if (!password) {
      fail(S.sideloadRelay.pwEnterPassword);
      return;
    }
    validateBtn.setAttribute('disabled', '');
    validateBtn.classList.add('busy');
    field.classList.remove('sr-pw-bad');
    err.textContent = '';
    try {
      const res = await api.sideloadRelayValidatePassword({
        ip: row.ip,
        serial: row.serial,
        remote: row.remote,
        serverUrl: row.serverUrl,
        password
      });
      if (res && res.success) {
        row.hasPassword = true;
        row.enabled = true;
        pwEditingKey = null;
        renderModalTable();
      } else {
        fail((res && res.error) || S.sideloadRelay.pwWrong);
      }
    } catch {
      fail(S.sideloadRelay.pwUnreachable);
    } finally {
      validateBtn.classList.remove('busy');
    }
  };

  input.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') void run();
  });
  input.addEventListener('input', () => field.classList.remove('sr-pw-bad'));
  validateBtn.addEventListener('click', () => void run());
  cancelBtn.addEventListener('click', () => {
    pwEditingKey = null;
    renderModalTable();
  });

  const cell = h('div', { class: 'sr-pw-inline' }, [field, cancelBtn, err]);
  setTimeout(() => input.focus(), 0);
  return cell;
}

function updateModalSummary(): void {
  const el = document.getElementById('srModalSummary');
  if (!el) return;
  const enabledReachable = modalRows.filter((r) => r.enabled && r.reachable).length;
  const enabledOffline = modalRows.filter((r) => r.enabled && !r.reachable).length;
  const reachableTotal = modalRows.filter((r) => r.reachable).length;
  let txt = S.sideloadRelay.modalSummary(enabledReachable, reachableTotal);
  if (enabledOffline > 0) txt += S.sideloadRelay.modalSummaryOfflineSuffix(enabledOffline);
  el.textContent = txt;
}

/** Toggle the header Scan Devices button between idle and scanning (mirrors the main window's Scan button). */
function setScanButtonScanning(scanning: boolean): void {
  const btn = document.getElementById('srRescanBtn') as HTMLButtonElement | null;
  if (!btn) return;
  btn.disabled = scanning;
  btn.classList.toggle('scanning', scanning);
  const text = btn.querySelector('.sr-scan-text');
  if (text) text.textContent = scanning ? S.sideloadRelay.scanning : S.sideloadRelay.scanBtn;
}

async function scanDevices(force = false): Promise<void> {
  // Reuse the existing scan unless forced (Rescan). We scan once — on first need —
  // then keep those results until the user explicitly hits Rescan, so merely
  // opening the modal never triggers a fresh scan.
  if (!force && scanned) {
    buildModalRows();
    renderModalTable();
    updateTargetSummary();
    updateGateBanner();
    return;
  }
  if (scanInFlight) return scanInFlight; // dedupe concurrent triggers (init + modal open)

  scanInFlight = (async () => {
    const statusEl = document.getElementById('srScanStatus');
    setScanButtonScanning(true);
    try {
      const res = await api.sideloadRelaySeedTargets(false);
      discovered = (res && res.devices) || [];
      scanned = true;
      if (statusEl) {
        const local = discovered.filter((d) => !d.remote).length;
        const remote = discovered.length - local;
        statusEl.textContent = S.sideloadRelay.scanFound(local, remote, discovered.length);
      }
    } catch {
      if (statusEl) statusEl.textContent = S.sideloadRelay.scanFailed;
    } finally {
      setScanButtonScanning(false);
    }
    buildModalRows();
    renderModalTable();
    updateTargetSummary();
    updateGateBanner();
  })();
  try {
    await scanInFlight;
  } finally {
    scanInFlight = null;
  }
}

function openSetupModal(): void {
  const overlay = document.getElementById('srSetupOverlay');
  if (!overlay) return;
  pwEditingKey = null;
  buildModalRows();
  renderModalTable();
  overlay.removeAttribute('hidden');
  void scanDevices();
}

function closeSetupModal(): void {
  document.getElementById('srSetupOverlay')?.setAttribute('hidden', '');
}

/** Apply the modal's selections to the targets list, persist, and close. */
function applySetupModal(): void {
  targets = modalRows
    .filter((r) => r.enabled)
    .map((r) => ({
      id: r.key,
      ip: r.ip,
      name: r.name,
      enabled: true,
      serial: r.serial,
      location: r.location,
      remote: r.remote,
      serverUrl: r.serverUrl,
      locationId: r.locationId
    }));
  updateTargetSummary();
  updateGateBanner();
  closeSetupModal();
  void save();
}

// ============================================================
// Section build + config load/save
// ============================================================

function buildDom(root: HTMLElement): void {
  // NOTE: all `.sr-*` styles live in settings.css — the settings window's CSP
  // (`style-src 'self'`) blocks injected inline <style> blocks.
  const toggleRow = (id: string, title: string, desc: string) =>
    h('div', { class: 'settings-row-toggle' }, [
      h('div', { class: 'settings-row-text' }, [h('strong', {}, [title]), h('span', { class: 'settings-row-desc' }, [desc])]),
      h('label', { class: 'settings-toggle-wrap', for: id }, [
        h('input', { type: 'checkbox', id, class: 'settings-toggle-input', role: 'switch', 'aria-label': title }),
        h('span', { class: 'settings-toggle-ui', 'aria-hidden': 'true' }, [])
      ])
    ]);

  // Password field with an inline show/hide eye toggle.
  const passwordRow = (id: string, title: string, desc: string, placeholder: string) => {
    const input = h('input', { type: 'password', id, class: 'settings-text-input sr-pw-reveal-input', 'aria-label': title, placeholder, autocomplete: 'off' }) as HTMLInputElement;
    const eye = h('button', { type: 'button', class: 'sr-pw-eye', 'aria-label': S.sideloadRelay.showPassword, 'aria-pressed': 'false', title: S.sideloadRelay.showPassword }, [EYE_SVG()]);
    // The saved password lives in the backend, not the config. When revealing an
    // empty field that has a saved password, fetch and fill it; when hiding, if
    // the value is still exactly that fetched value (untouched), clear it again so
    // "blank keeps the saved one" still holds.
    let fetchedSaved: string | null = null;
    eye.addEventListener('click', async () => {
      const reveal = input.type === 'password';
      if (reveal) {
        if (!input.value && hasSavedPassword && api.sideloadRelayRevealPassword) {
          try {
            const res = await api.sideloadRelayRevealPassword();
            if (res && res.success && res.password) {
              input.value = res.password;
              fetchedSaved = res.password;
            }
          } catch {
            /* leave the field empty on failure */
          }
        }
      } else if (fetchedSaved !== null && input.value === fetchedSaved) {
        input.value = ''; // untouched saved value — restore keep-saved semantics
        fetchedSaved = null;
      }
      input.type = reveal ? 'text' : 'password';
      eye.setAttribute('aria-pressed', reveal ? 'true' : 'false');
      eye.setAttribute('aria-label', reveal ? S.sideloadRelay.hidePassword : S.sideloadRelay.showPassword);
      eye.setAttribute('title', reveal ? S.sideloadRelay.hidePassword : S.sideloadRelay.showPassword);
      eye.classList.toggle('revealed', reveal);
      input.focus();
    });
    return h('div', { class: 'settings-row-input' }, [
      h('div', { class: 'settings-row-text' }, [h('strong', {}, [title]), h('span', { class: 'settings-row-desc' }, [desc])]),
      h('div', { class: 'sr-pw-reveal-wrap' }, [input, eye])
    ]);
  };

  // Prerequisite warning banner (above the rows). Hidden unless the relay is off
  // and something needed to enable it is missing.
  root.append(h('div', { class: 'sr-gate-warning', id: 'srGateWarning', role: 'status', 'aria-live': 'polite', hidden: '' }, []));

  root.append(toggleRow('optSideloadRelay', S.sideloadRelay.enableTitle, S.sideloadRelay.enableDesc));
  root.append(passwordRow('srPassword', S.sideloadRelay.passwordTitle, S.sideloadRelay.passwordDesc, '••••••••'));
  root.append(toggleRow('optSrAutoConsole', S.sideloadRelay.autoConsoleTitle, S.sideloadRelay.autoConsoleDesc));
  root.append(toggleRow('optSrRetry', S.sideloadRelay.retryTitle, S.sideloadRelay.retryDesc));

  // Targeted Devices summary row
  root.append(
    h('div', { class: 'settings-row-toggle sr-summary-row' }, [
      h('div', { class: 'settings-row-text' }, [
        h('strong', {}, [S.sideloadRelay.targetedDevicesTitle]),
        h('span', { class: 'settings-row-desc', id: 'srTargetSummary', 'aria-live': 'polite' }, [S.sideloadRelay.targetSummaryLoading])
      ]),
      h('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'srSetupBtn' }, [S.sideloadRelay.setupDevicesBtn])
    ])
  );

  // Setup modal (mounted on <body> so the overlay covers the whole window)
  const overlay = h('div', { class: 'sr-modal-overlay', id: 'srSetupOverlay', hidden: '' }, [
    h('div', { class: 'sr-modal' }, [
      h('div', { class: 'sr-modal-header' }, [
        h('h2', {}, [S.sideloadRelay.modalTitle]),
        h('div', { class: 'sr-modal-header-actions' }, [
          h('button', { type: 'button', class: 'sr-scan-btn', id: 'srRescanBtn' }, [
            h('span', { class: 'sr-scan-text' }, [S.sideloadRelay.scanBtn])
          ]),
          h('button', { type: 'button', class: 'sr-modal-close', id: 'srModalClose', 'aria-label': S.common.close }, ['×'])
        ])
      ]),
      h('div', { class: 'sr-modal-sub' }, [S.sideloadRelay.modalSubtitle]),
      h('div', { class: 'sr-modal-toolbar' }, [h('span', { class: 'sr-scan-status', id: 'srScanStatus', 'aria-live': 'polite' }, [])]),
      h('div', { class: 'sr-modal-table-wrap' }, [h('div', { id: 'srDeviceTable' }, [])]),
      h('div', { class: 'sr-modal-footer' }, [
        h('span', { class: 'sr-modal-summary', id: 'srModalSummary', 'aria-live': 'polite' }, []),
        h('div', { class: 'sr-modal-actions' }, [
          h('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'srModalCancel' }, [S.common.cancel]),
          h('button', { type: 'button', class: 'btn btn-primary btn-sm', id: 'srModalSave' }, [S.common.save])
        ])
      ])
    ])
  ]);
  document.body.appendChild(overlay);
}

/** Set a toggle's value + aria state. (aria change-wiring is done once in init.) */
function setToggle(id: string, on: boolean): void {
  const input = document.getElementById(id) as HTMLInputElement | null;
  if (!input) return;
  input.checked = on;
  input.setAttribute('aria-checked', on ? 'true' : 'false');
}

/** One-time aria-checked wiring for a toggle, mirroring the main window's wireToggleAria. */
function wireToggleAria(id: string): void {
  const input = document.getElementById(id) as HTMLInputElement | null;
  if (!input) return;
  input.addEventListener('change', () => input.setAttribute('aria-checked', input.checked ? 'true' : 'false'));
}

function boolOf(id: string): boolean {
  const input = document.getElementById(id) as HTMLInputElement | null;
  return !!input && input.checked;
}

async function save(): Promise<void> {
  const status = document.getElementById('saveStatusSideloadRelay');
  const btn = document.getElementById('btnSaveSideloadRelay') as HTMLButtonElement | null;
  const pwdInput = document.getElementById('srPassword') as HTMLInputElement | null;

  // Guard: never persist an enabled relay while its prerequisites are unmet.
  if (boolOf('optSideloadRelay')) {
    const reasons = gateReasons();
    if (reasons.length) {
      setToggle('optSideloadRelay', false);
      renderGateBanner(reasons, true);
      if (status) {
        status.textContent = S.sideloadRelay.fixBeforeEnable;
        status.classList.add('err');
      }
      return;
    }
  }

  const typedPassword = !!(pwdInput && pwdInput.value.trim());
  const payload: Record<string, unknown> = {
    enabled: boolOf('optSideloadRelay'),
    // A real Roku always serves on :80, so the relay does too (internal high-port
    // fallback only if :80 needs root). Not user-configurable.
    requestedPort: 80,
    autoConsole: boolOf('optSrAutoConsole'),
    retryOnFailure: boolOf('optSrRetry'),
    targets: targets.map((t) => ({
      id: t.id,
      ip: t.ip,
      name: t.name,
      enabled: t.enabled,
      serial: t.serial,
      location: t.location,
      remote: t.remote,
      serverUrl: t.serverUrl,
      locationId: t.locationId
    }))
  };
  if (pwdInput && pwdInput.value) payload.password = pwdInput.value;

  if (btn) btn.disabled = true;
  if (status) {
    status.textContent = '';
    status.classList.remove('err');
  }
  try {
    const res = await api.sideloadRelayApply(payload);
    if (res && res.success) {
      if (status) status.textContent = S.sideloadRelay.saved;
      if (typedPassword) hasSavedPassword = true; // it's now persisted
      if (pwdInput) {
        pwdInput.value = '';
        if (hasSavedPassword) pwdInput.placeholder = S.sideloadRelay.savedPasswordPlaceholder;
      }
      updateGateBanner();
      void refreshRelayUrlHint(); // enabling/disabling changes whether the URL applies
    } else if (status) {
      status.textContent = (res && res.error) || S.sideloadRelay.saveFailed;
      status.classList.add('err');
    }
  } catch (e) {
    if (status) {
      status.textContent = S.sideloadRelay.saveFailed;
      status.classList.add('err');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

/** Reset the relay's own settings to defaults (Save still persists). Leaves the targeted-device list alone. */
function resetToDefaults(): void {
  setToggle('optSideloadRelay', false);
  setToggle('optSrAutoConsole', true);
  setToggle('optSrRetry', false);
  const pwdInput = document.getElementById('srPassword') as HTMLInputElement | null;
  if (pwdInput) pwdInput.value = '';
  // Match the other sections: reset the fields silently; the user clicks Save to apply.
  const status = document.getElementById('saveStatusSideloadRelay');
  if (status) {
    status.classList.remove('err');
    status.textContent = '';
  }
  updateGateBanner();
}

/** Entry point — called once from settings.ts after the DOM is ready. */
export function initSideloadRelaySection(): void {
  const root = document.getElementById('sideloadRelayRoot');
  if (!root || !api || !api.sideloadRelayGetConfig) return;
  buildDom(root);

  ['optSideloadRelay', 'optSrAutoConsole', 'optSrRetry'].forEach(wireToggleAria);

  // Gate: block enabling the relay until the password + a reachable target exist.
  document.getElementById('optSideloadRelay')?.addEventListener('change', () => void onEnableToggle());
  document.getElementById('srPassword')?.addEventListener('input', () => updateGateBanner());

  document.getElementById('btnSaveSideloadRelay')?.addEventListener('click', () => void save());
  document.getElementById('btnResetSideloadRelay')?.addEventListener('click', () => resetToDefaults());
  document.getElementById('srSetupBtn')?.addEventListener('click', () => openSetupModal());
  document.getElementById('srModalClose')?.addEventListener('click', () => closeSetupModal());
  document.getElementById('srModalCancel')?.addEventListener('click', () => closeSetupModal());
  document.getElementById('srModalSave')?.addEventListener('click', () => applySetupModal());
  document.getElementById('srRescanBtn')?.addEventListener('click', () => void scanDevices(true));
  const srSetupOverlay = document.getElementById('srSetupOverlay');
  if (srSetupOverlay instanceof HTMLElement) attachBackdropClickToClose(srSetupOverlay, closeSetupModal);

  // Escape should peel back only the top layer: an open inline password editor
  // first, then this modal — never the whole Settings window while the modal is
  // up. Capture phase + stopImmediatePropagation pre-empts the settings-level
  // Escape handler that closes the window.
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      const overlay = document.getElementById('srSetupOverlay');
      if (!overlay || overlay.hasAttribute('hidden')) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (pwEditingKey) {
        pwEditingKey = null;
        renderModalTable();
      } else {
        closeSetupModal();
      }
    },
    true
  );

  api.sideloadRelayGetConfig().then((res: any) => {
    const cfg = res && res.config;
    if (!cfg) return;
    setToggle('optSideloadRelay', cfg.enabled === true);
    setToggle('optSrAutoConsole', cfg.autoConsole !== false);
    setToggle('optSrRetry', cfg.retryOnFailure === true);
    hasSavedPassword = cfg.hasPassword === true;
    const pwdInput = document.getElementById('srPassword') as HTMLInputElement | null;
    if (pwdInput && cfg.hasPassword) pwdInput.placeholder = S.sideloadRelay.savedPasswordPlaceholder;
    targets = Array.isArray(cfg.targets)
      ? cfg.targets.map((t: any) => ({
          id: t.id,
          ip: t.ip,
          name: t.name || t.ip,
          enabled: t.enabled !== false,
          serial: t.serial,
          location: t.location,
          remote: t.remote === true,
          serverUrl: t.serverUrl,
          locationId: t.locationId
        }))
      : [];
    updateTargetSummary();
    updateGateBanner();
    // Background scan so the summary count reflects reachability without opening the modal.
    if (targets.some((t) => t.enabled)) void scanDevices();
  });

  void refreshRelayUrlHint();
}
