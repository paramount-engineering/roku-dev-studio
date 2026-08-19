import {
  DEFAULT_MAX_RAW_PACKETS_PER_DEVICE,
  MIN_MAX_RAW_PACKETS_PER_DEVICE,
  MAX_MAX_RAW_PACKETS_PER_DEVICE,
  DEFAULT_MAX_BODY_RETAINED_BYTES,
  MIN_MAX_BODY_RETAINED_BYTES,
  MAX_MAX_BODY_RETAINED_BYTES,
} from '@shared/network-inspector/types.js';
import {
  networkInspectorSetupTitle,
  networkInspectorSetupGuideBodyHtml,
  networkInspectorHasCaptureSetupAction,
  type NiSetupPlatform,
  type NiSetupGuideStrings,
} from '@shared/network-inspector/setup-guide.js';
import { initSideloadRelaySection } from './sideload-relay-section.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { attachInstantTooltips } from '../../modules/utils/instant-tooltip.js';
import { S, applyI18n, availableLocales, getLocale, matchLocale, localeLabel, setLocale, SYSTEM_LOCALE } from '@shared/strings/index.js';
import { applyLocalePreference } from '../../modules/utils/locale-live.js';
import { setLocaleFromPreference } from '../../modules/utils/locale-pref.js';

const api = (window as any).settingsApi;
if (!api) {
  document.body.innerHTML = '<p class="settings-fatal">' + S.settings.apiUnavailable + '</p>';
  throw new Error('Settings API unavailable');
}

const INITIAL_SECTION = new URLSearchParams(window.location.search).get('section') || '';

// The main process passes the already-resolved effective locale in the query so we
// can apply it SYNCHRONOUSLY here — before the first `applyI18n(document)` below —
// which is before first paint. Without this the shell paints in English and the
// async getState() apply (further down) re-renders it in the real locale, a visible
// flash on open. getState() still re-applies later (idempotent, no visible change).
const INITIAL_LOCALE = new URLSearchParams(window.location.search).get('locale') || '';
if (INITIAL_LOCALE) setLocale(INITIAL_LOCALE);

/**
 * Toggle the `privacy-mode` body class so this window's masking CSS (see
 * settings.css) blurs IPs/serials — e.g. the Sideload Relay device table —
 * exactly as the main window does. Applied from the loaded state, live from the
 * Privacy Mode toggle in this window, and from the main-process broadcast when
 * the menu / another window flips it.
 */
function applyPrivacyMode(enabled: boolean): void {
  document.body.classList.toggle('privacy-mode', !!enabled);
}
if (typeof api.onPrivacyModeChanged === 'function') {
  api.onPrivacyModeChanged(function (enabled: boolean) {
    applyPrivacyMode(enabled);
  });
}

// Localize the static settings.html shell (nav, section headers, toggle labels,
// tooltips). Dynamically-built sections use `S.*` directly. Inline English is the
// fallback for any unresolved key.
applyI18n(document);

// Long row-help is space-hungry when always-on. Enable the shared instant tooltip for this
// window, then (via syncSettingsHelpTooltips) clamp only the descriptions that actually
// overflow 3 lines and reveal their full text on hover — short/dynamic help is untouched.
attachInstantTooltips(document.body);
function syncSettingsHelpTooltips(): void {
  document.querySelectorAll<HTMLElement>('.settings-row-desc').forEach((el) => {
    el.classList.add('settings-row-desc--clamped'); // clamp, then keep only if it truly overflows
    if (el.scrollHeight - el.clientHeight > 1) {
      el.setAttribute('data-tip', (el.textContent || '').trim());
    } else {
      el.classList.remove('settings-row-desc--clamped');
      el.removeAttribute('data-tip');
    }
  });
}

// Set after getState() resolves; all usages are inside async callbacks or user-initiated actions
// that can only fire after initialization completes.
let HOST_PLATFORM: string = '';

const DEVICE_PERF_KEYS = ['DEVICE_METRICS_SAMPLE_INTERVAL_MS', 'DEVICE_METRICS_CHART_HISTORY_MS'];
const CHART_HISTORY_MIN_MINUTES = 5;
const CHART_HISTORY_MAX_MINUTES = 60;
const MS_PER_MINUTE = 60000;
const TOAST_STATUS_SEC_MIN = 2;
const TOAST_STATUS_SEC_MAX = 10;
const GENERAL_TIMING_KEYS = ['TOAST_DISPLAY_DURATION', 'STATUS_MESSAGE_DURATION'];
const TIMING_KEYS = [
  'DEFAULT_RALE_PORT',
  'SCREENSHOT_DEBOUNCE_DELAY',
  'SCREENSHOT_AFTER_LAUNCH_DELAY',
  'TELNET_TIMEOUT',
  'CONNECTION_CHECK_INTERVAL'
];
const NI_MAX_RAW_PACKETS_DEFAULT = DEFAULT_MAX_RAW_PACKETS_PER_DEVICE;
const NI_MAX_RAW_PACKETS_MIN = MIN_MAX_RAW_PACKETS_PER_DEVICE;
const NI_MAX_RAW_PACKETS_MAX = MAX_MAX_RAW_PACKETS_PER_DEVICE;
function clampNiMaxRawPackets(v: any) {
  var n = parseInt(v, 10);
  if (!isFinite(n)) return NI_MAX_RAW_PACKETS_DEFAULT;
  return Math.min(NI_MAX_RAW_PACKETS_MAX, Math.max(NI_MAX_RAW_PACKETS_MIN, n));
}
const NI_MAX_BODY_BYTES_DEFAULT = DEFAULT_MAX_BODY_RETAINED_BYTES;
const NI_MAX_BODY_KB_DEFAULT = Math.round(DEFAULT_MAX_BODY_RETAINED_BYTES / 1024);
const NI_MAX_BODY_KB_MIN = Math.round(MIN_MAX_BODY_RETAINED_BYTES / 1024);
const NI_MAX_BODY_KB_MAX = Math.round(MAX_MAX_BODY_RETAINED_BYTES / 1024);
function clampNiMaxBodyKb(v: any) {
  var n = parseInt(v, 10);
  if (!isFinite(n)) return NI_MAX_BODY_KB_DEFAULT;
  return Math.min(NI_MAX_BODY_KB_MAX, Math.max(NI_MAX_BODY_KB_MIN, n));
}
function niBodyBytesToKb(bytes: any) {
  var n = parseInt(bytes, 10);
  if (!isFinite(n) || n <= 0) return NI_MAX_BODY_KB_DEFAULT;
  return clampNiMaxBodyKb(Math.round(n / 1024));
}
function niBodyKbToBytes(kb: any) {
  return clampNiMaxBodyKb(kb) * 1024;
}

let folderPath = '';
let compileDefaults: Record<string, any> = {};
const MCP_CLIENT_IDS = ['chatgpt', 'claude', 'cursor', 'vscode', 'vscode-insiders', 'vscodium', 'windsurf'];
let mcpClientsState: Record<string, boolean> = {};
MCP_CLIENT_IDS.forEach(function (id) { mcpClientsState[id] = false; });
let mcpClientDetections: any[] = [];

function selectSection(targetId: string) {
  var activeLabel = '';
  document.querySelectorAll('.settings-panel').forEach(function (panel) {
    var on = panel.getAttribute('data-section') === targetId;
    panel.classList.toggle('active', on);
    panel.setAttribute('aria-hidden', on ? 'false' : 'true');
  });
  document.querySelectorAll('.settings-nav-item').forEach(function (btn) {
    var on = btn.getAttribute('data-target') === targetId;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    if (on) {
      activeLabel = (btn.textContent || '').trim();
    }
  });
  var headerSection = document.getElementById('settingsHeaderSection');
  if (headerSection && activeLabel) headerSection.textContent = activeLabel;
  if (targetId === 'network-inspector' && typeof refreshNiPortConflict === 'function') {
    refreshNiPortConflict();
  }
}

// Restore the breadcrumb's active-section label after an applyI18n(document) pass, which
// re-localizes the nav labels and resets the [data-i18n] breadcrumb default ('General').
function syncHeaderSectionLabel() {
  var activeNav = document.querySelector('.settings-nav-item.active');
  var headerSection = document.getElementById('settingsHeaderSection');
  if (activeNav && headerSection) headerSection.textContent = (activeNav.textContent || '').trim();
}

document.querySelectorAll('.settings-nav-item').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var id = btn.getAttribute('data-target');
    if (id) selectSection(id);
  });
});

function el(id: string): any {
  return document.getElementById(id);
}

const MOTION_MS = 400;
const MOTION_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const MOTION_FALLBACK_MS = MOTION_MS + 220;

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function motionTransition() {
  return 'transform ' + MOTION_MS + 'ms ' + MOTION_EASE + ', opacity ' + MOTION_MS + 'ms ' + MOTION_EASE;
}

const SETTINGS_MOTION_MIN_SCALE = 0.92;

function getAnimateRoot() {
  return el('settingsAnimateRoot');
}

function animateOpen() {
  if (prefersReducedMotion()) return;
  var root = getAnimateRoot();
  if (!root) return;
  root.style.transition = 'none';
  root.style.transformOrigin = '';
  root.style.transform = 'scale(' + SETTINGS_MOTION_MIN_SCALE + ')';
  root.style.opacity = '0';
  void root.offsetHeight;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      root.style.transition = motionTransition();
      root.style.transform = 'scale(1)';
      root.style.opacity = '1';
      var cleaned = false;
      function cleanup() {
        if (cleaned) return;
        cleaned = true;
        root.removeEventListener('transitionend', onEnd);
        root.style.transition = '';
        root.style.transform = '';
        root.style.opacity = '';
      }
      function onEnd(e: TransitionEvent) {
        if (e.target !== root || e.propertyName !== 'transform') return;
        cleanup();
      }
      root.addEventListener('transitionend', onEnd);
      setTimeout(cleanup, MOTION_FALLBACK_MS);
    });
  });
}

var settingsCloseStarted = false;
function requestCloseSettingsWindow() {
  if (settingsCloseStarted) {
    api.closeWindow();
    return;
  }
  if (prefersReducedMotion()) {
    api.closeWindow();
    return;
  }
  var root = getAnimateRoot();
  if (!root) {
    api.closeWindow();
    return;
  }
  settingsCloseStarted = true;
  root.style.transition = 'none';
  root.style.transformOrigin = '';
  root.style.transform = 'scale(1)';
  root.style.opacity = '1';
  void root.offsetHeight;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      root.style.transition = motionTransition();
      root.style.transform = 'scale(' + SETTINGS_MOTION_MIN_SCALE + ')';
      root.style.opacity = '0';
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        root.removeEventListener('transitionend', onEnd);
        api.closeWindow();
      }
      function onEnd(e: TransitionEvent) {
        if (e.target !== root || e.propertyName !== 'transform') return;
        finish();
      }
      root.addEventListener('transitionend', onEnd);
      setTimeout(finish, MOTION_FALLBACK_MS);
    });
  });
}

function syncSwitchAria(id: string) {
  var inp = el(id);
  if (!inp || inp.getAttribute('role') !== 'switch') return;
  inp.setAttribute('aria-checked', inp.checked ? 'true' : 'false');
}

function boolFromToggle(id: string) {
  var c = el(id);
  return !!(c && c.checked);
}

function setToggle(id: string, enabled: boolean) {
  var c = el(id);
  if (c) {
    c.checked = !!enabled;
    syncSwitchAria(id);
  }
}

function wireToggleAria(id: string) {
  var inp = el(id);
  if (!inp) return;
  inp.addEventListener('change', function () {
    syncSwitchAria(id);
  });
}

function renderMcpClients() {
  var container = el('mcpClientsList');
  if (!container) return;
  container.innerHTML = '';
  if (!Array.isArray(mcpClientDetections) || mcpClientDetections.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'mcp-clients-empty';
    empty.textContent = S.settings.mcpNoClients;
    container.appendChild(empty);
    return;
  }
  mcpClientDetections.forEach(function (det) {
    var id = det && det.id;
    if (!id || MCP_CLIENT_IDS.indexOf(id) === -1) return;
    var installed = !!(det && det.installed);
    var row = document.createElement('div');
    row.className = 'mcp-client-row' + (installed ? '' : ' disabled');
    row.setAttribute('data-mcp-id', id);

    var info = document.createElement('div');
    info.className = 'mcp-client-info';
    var nameLine = document.createElement('strong');
    nameLine.appendChild(document.createTextNode(String(det.label || id)));
    var statusIcon = document.createElement('span');
    statusIcon.className = 'mcp-client-status-icon ' + (installed ? 'installed' : 'not-installed');
    statusIcon.title = installed ? S.settings.mcpInstalled : S.settings.mcpNotDetected;
    statusIcon.setAttribute('role', 'img');
    statusIcon.setAttribute('aria-label', installed ? S.settings.mcpInstalled : S.settings.mcpNotDetected);
    statusIcon.innerHTML = installed
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18"/>' +
          '<path d="M7.5 12.5l3 3 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<circle cx="12" cy="12" r="9.25" stroke="currentColor" stroke-width="1.5"/>' +
          '<path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>' +
        '</svg>';
    nameLine.appendChild(statusIcon);
    info.appendChild(nameLine);
    row.appendChild(info);

    var actionCol = document.createElement('div');
    actionCol.className = 'mcp-client-action';
    if (installed && det.configPath) {
      var openBtn = document.createElement('button') as HTMLButtonElement;
      openBtn.type = 'button';
      openBtn.className = 'mcp-client-config-btn';
      openBtn.title = S.settings.mcpOpenConfigTitle(String(det.configPath));
      openBtn.setAttribute('aria-label', S.settings.mcpOpenConfigAria(String(det.label || id)));
      openBtn.innerHTML =
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<path d="M14 3h7v7M21 3l-9 9M5 5h5M5 12h7M5 19h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>' +
        '<span>' + S.settings.mcpOpenConfigFile + '</span>';
      openBtn.addEventListener('click', function () {
        if (!api.openMcpConfig) return;
        openBtn.disabled = true;
        api.openMcpConfig(id).catch(function () {}).then(function () {
          openBtn.disabled = false;
        });
      });
      actionCol.appendChild(openBtn);
    } else {
      var hint = document.createElement('span');
      hint.className = 'mcp-client-hint';
      hint.textContent = S.settings.mcpInstallToEnable(String(det.label || id));
      actionCol.appendChild(hint);
    }
    row.appendChild(actionCol);

    var label = document.createElement('label');
    label.className = 'settings-toggle-wrap';
    label.setAttribute('for', 'mcpToggle_' + id);
    var input = document.createElement('input') as HTMLInputElement;
    input.type = 'checkbox';
    input.id = 'mcpToggle_' + id;
    input.className = 'settings-toggle-input';
    input.setAttribute('role', 'switch');
    input.setAttribute('aria-label', S.settings.mcpEnableAria(String(det.label || id)));
    input.checked = !!mcpClientsState[id];
    input.disabled = !installed;
    input.setAttribute('aria-checked', input.checked ? 'true' : 'false');
    input.addEventListener('change', function () {
      mcpClientsState[id] = !!input.checked;
      input.setAttribute('aria-checked', input.checked ? 'true' : 'false');
    });
    var ui = document.createElement('span');
    ui.className = 'settings-toggle-ui';
    ui.setAttribute('aria-hidden', 'true');
    label.appendChild(input);
    label.appendChild(ui);
    row.appendChild(label);

    container.appendChild(row);
  });
}

function setFolderDisplay(path: string) {
  folderPath = path || '';
  var d = el('folderDisplay');
  if (!d) return;
  if (folderPath) {
    d.textContent = folderPath;
    d.classList.remove('empty');
    d.title = folderPath;
  } else {
    d.textContent = S.settings.noFolderSet;
    d.classList.add('empty');
    d.title = '';
  }
}

function chartHistoryMsToDisplayMinutes(ms: any) {
  var raw = Number(ms);
  if (!Number.isFinite(raw) || raw <= 0) return CHART_HISTORY_MIN_MINUTES;
  var m = Math.round(raw / MS_PER_MINUTE);
  return Math.min(CHART_HISTORY_MAX_MINUTES, Math.max(CHART_HISTORY_MIN_MINUTES, m));
}

function toastStatusMsToDisplaySec(ms: any) {
  var raw = Number(ms);
  if (!Number.isFinite(raw) || raw <= 0) return 5;
  var s = Math.round(raw / 1000);
  return Math.min(TOAST_STATUS_SEC_MAX, Math.max(TOAST_STATUS_SEC_MIN, s));
}

function escapeHtml(s: any) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escapeAttr(s: any) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

function buildTimingRowsForKeys(containerId: string, keys: string[], state: any) {
  var container = el(containerId);
  if (!container) return;
  container.innerHTML = '';
  var meta = state.timingMeta || {};
  var values = state.timingOverrides || {};
  compileDefaults = state.compileDefaults || {};
  keys.forEach(function (key) {
    var m = meta[key] || { title: key, hint: '', min: 0, max: 0 };
    // Prefer localized labels from the catalog; fall back to the main-process meta.
    var lbl = (S.settings.timingLabels as Record<string, { title: string; hint: string }>)[key] || {};
    var title = lbl.title || m.title || key;
    var hint = lbl.hint || m.hint || '';
    var row = document.createElement('div');
    row.className = 'timing-row';
    var val = values[key] != null ? values[key] : compileDefaults[key];
    if (key === 'DEVICE_METRICS_CHART_HISTORY_MS') {
      var valMin = chartHistoryMsToDisplayMinutes(val);
      row.innerHTML =
        '<div class="row-label">' +
        '<strong>' + escapeHtml(title) + '</strong>' +
        '<span class="hint-line">' + escapeHtml(hint) + '</span>' +
        '</div>' +
        '<div class="timing-field">' +
        '<div class="timing-field-stack">' +
        '<span class="bound-label">' + S.settings.timingBoundMin(CHART_HISTORY_MIN_MINUTES + ' min') + '</span>' +
        '<input type="number" class="input-num" data-timing-key="' + escapeHtml(key) +
        '" data-input-unit="minutes" value="' + escapeAttr(String(valMin)) +
        '" min="' + CHART_HISTORY_MIN_MINUTES + '" max="' + CHART_HISTORY_MAX_MINUTES + '" step="1" />' +
        '<span class="bound-label">' + S.settings.timingBoundMax(CHART_HISTORY_MAX_MINUTES + ' min') + '</span>' +
        '</div></div>';
    } else if (key === 'TOAST_DISPLAY_DURATION' || key === 'STATUS_MESSAGE_DURATION') {
      var valSec = toastStatusMsToDisplaySec(val);
      row.innerHTML =
        '<div class="row-label">' +
        '<strong>' + escapeHtml(title) + '</strong>' +
        '<span class="hint-line">' + escapeHtml(hint) + '</span>' +
        '</div>' +
        '<div class="timing-field">' +
        '<div class="timing-field-stack">' +
        '<span class="bound-label">' + S.settings.timingBoundMin(TOAST_STATUS_SEC_MIN) + '</span>' +
        '<input type="number" class="input-num" data-timing-key="' + escapeHtml(key) +
        '" data-input-unit="seconds" value="' + escapeAttr(String(valSec)) +
        '" min="' + TOAST_STATUS_SEC_MIN + '" max="' + TOAST_STATUS_SEC_MAX + '" step="1" />' +
        '<span class="bound-label">' + S.settings.timingBoundMax(TOAST_STATUS_SEC_MAX) + '</span>' +
        '</div></div>';
    } else {
      row.innerHTML =
        '<div class="row-label">' +
        '<strong>' + escapeHtml(title) + '</strong>' +
        '<span class="hint-line">' + escapeHtml(hint) + '</span>' +
        '</div>' +
        '<div class="timing-field">' +
        '<div class="timing-field-stack">' +
        '<span class="bound-label">' + S.settings.timingBoundMin(escapeHtml(String(m.min))) + '</span>' +
        '<input type="number" class="input-num" data-timing-key="' + escapeHtml(key) +
        '" value="' + escapeAttr(String(val)) + '" min="' + m.min + '" max="' + m.max + '" />' +
        '<span class="bound-label">' + S.settings.timingBoundMax(escapeHtml(String(m.max))) + '</span>' +
        '</div></div>';
    }
    container.appendChild(row);
    var newInp = row.querySelector('input.input-num');
    if (newInp) attachTimingValidation(newInp);
  });
}

function buildTimingRows(state: any) {
  buildTimingRowsForKeys('generalTimingRows', GENERAL_TIMING_KEYS, state);
  buildTimingRowsForKeys('timingRows', TIMING_KEYS, state);
  buildTimingRowsForKeys('devicePerfRows', DEVICE_PERF_KEYS, state);
}

function readTimingOverrides() {
  var out: Record<string, number> = {};
  function readKeys(keys: string[]) {
    keys.forEach(function (key) {
      var inp = document.querySelector('input.input-num[data-timing-key="' + key + '"]') as HTMLInputElement | null;
      if (!inp) return;
      var n = parseInt(String(inp.value), 10);
      if (isNaN(n)) return;
      if (key === 'DEVICE_METRICS_CHART_HISTORY_MS' && inp.getAttribute('data-input-unit') === 'minutes') {
        out[key] = n * MS_PER_MINUTE;
      } else if (
        (key === 'TOAST_DISPLAY_DURATION' || key === 'STATUS_MESSAGE_DURATION') &&
        inp.getAttribute('data-input-unit') === 'seconds'
      ) {
        out[key] = n * 1000;
      } else {
        out[key] = n;
      }
    });
  }
  readKeys(TIMING_KEYS);
  readKeys(GENERAL_TIMING_KEYS);
  readKeys(DEVICE_PERF_KEYS);
  return out;
}

function applyDefaultsForKeys(keys: string[]) {
  keys.forEach(function (key) {
    var inp = document.querySelector('input.input-num[data-timing-key="' + key + '"]') as HTMLInputElement | null;
    if (!inp || compileDefaults[key] == null) return;
    if (key === 'DEVICE_METRICS_CHART_HISTORY_MS' && inp.getAttribute('data-input-unit') === 'minutes') {
      inp.value = String(chartHistoryMsToDisplayMinutes(compileDefaults[key]));
    } else if (
      (key === 'TOAST_DISPLAY_DURATION' || key === 'STATUS_MESSAGE_DURATION') &&
      inp.getAttribute('data-input-unit') === 'seconds'
    ) {
      inp.value = String(toastStatusMsToDisplaySec(compileDefaults[key]));
    } else {
      inp.value = String(compileDefaults[key]);
    }
  });
}

function setSectionStatus(targetId: string, msg: string, isErr: boolean) {
  var ids = ['saveStatusGeneral', 'saveStatusActionScripts', 'saveStatusDevicePerf', 'saveStatusTiming', 'saveStatusMcpServer', 'saveStatusNetworkInspector', 'saveStatusSideloadRelay'];
  ids.forEach(function (id) {
    var s = el(id);
    if (!s) return;
    if (id === targetId) {
      s.textContent = msg || '';
      s.className = 'section-save-status' + (msg && isErr ? ' err' : '');
    } else {
      s.textContent = '';
      s.className = 'section-save-status';
    }
  });
}

var TIMING_PANEL_INFO: Record<string, { keys: string[]; btn: string; status: string }> = {
  General: { keys: GENERAL_TIMING_KEYS, btn: 'btnSaveGeneral', status: 'saveStatusGeneral' },
  DevicePerf: { keys: DEVICE_PERF_KEYS, btn: 'btnSaveDevicePerf', status: 'saveStatusDevicePerf' },
  Timing: { keys: TIMING_KEYS, btn: 'btnSaveTiming', status: 'saveStatusTiming' }
};
var TIMING_PANEL_BY_KEY: Record<string, string> = {};
Object.keys(TIMING_PANEL_INFO).forEach(function (panelKey) {
  TIMING_PANEL_INFO[panelKey].keys.forEach(function (k) {
    TIMING_PANEL_BY_KEY[k] = panelKey;
  });
});

function getTimingRowLabel(inp: any) {
  var row = inp.closest ? inp.closest('.timing-row') : null;
  var strong = row ? row.querySelector('.row-label strong') : null;
  if (strong && strong.textContent) return strong.textContent.trim();
  return inp.getAttribute('data-timing-key') || S.settings.timingValueFallback;
}

function timingUnitSuffix(key: string | null) {
  if (key === 'DEVICE_METRICS_CHART_HISTORY_MS') return ' min';
  if (key === 'TOAST_DISPLAY_DURATION' || key === 'STATUS_MESSAGE_DURATION') return ' s';
  return '';
}

function validateTimingInput(inp: any) {
  var raw = String(inp.value).trim();
  if (raw === '') return { ok: false, reason: 'empty' };
  var n = Number(raw);
  if (!Number.isFinite(n) || Math.trunc(n) !== n) return { ok: false, reason: 'nan' };
  var min = parseInt(inp.getAttribute('min'), 10);
  var max = parseInt(inp.getAttribute('max'), 10);
  if (!isNaN(min) && n < min) return { ok: false, reason: 'low', min: min, max: max };
  if (!isNaN(max) && n > max) return { ok: false, reason: 'high', min: min, max: max };
  return { ok: true };
}

function validateTimingPanel(panelKey: string) {
  var info = TIMING_PANEL_INFO[panelKey];
  if (!info) return true;
  var invalid: any[] = [];
  info.keys.forEach(function (key) {
    var inp = document.querySelector('input.input-num[data-timing-key="' + key + '"]');
    if (!inp) return;
    var res = validateTimingInput(inp);
    (inp as HTMLElement).classList.toggle('invalid', !res.ok);
    if (!res.ok) invalid.push({ inp: inp, key: key, res: res });
  });
  var btn = el(info.btn) as HTMLButtonElement | null;
  if (btn) btn.disabled = invalid.length > 0;
  var statusEl = el(info.status);
  if (statusEl) {
    if (invalid.length === 0) {
      if (statusEl.classList.contains('err')) {
        statusEl.textContent = '';
        statusEl.className = 'section-save-status';
      }
    } else {
      var first = invalid[0];
      var label = getTimingRowLabel(first.inp);
      var unit = timingUnitSuffix(first.key);
      var msg;
      if (first.res.reason === 'empty' || first.res.reason === 'nan') {
        msg = S.settings.timingMustBeWholeNumber(label);
      } else if (first.res.reason === 'low') {
        msg = S.settings.timingMustBeAtLeast(label, first.res.min + unit);
      } else {
        msg = S.settings.timingMustBeAtMost(label, first.res.max + unit);
      }
      if (invalid.length > 1) {
        msg += S.settings.timingMoreOutOfRange(invalid.length - 1);
      }
      statusEl.textContent = msg;
      statusEl.className = 'section-save-status err';
    }
  }
  return invalid.length === 0;
}

function clampInputOnBlurIfOutOfRange(inp: any) {
  var res = validateTimingInput(inp);
  if (res.ok) return null;
  if (res.reason !== 'low' && res.reason !== 'high') return null;
  var snap = res.reason === 'low' ? res.min : res.max;
  if (typeof snap !== 'number' || !Number.isFinite(snap)) return null;
  inp.value = String(snap);
  return { snap: snap, reason: res.reason };
}

function showTimingClampedNotice(inp: any, panelKey: string, clamp: any) {
  var info = TIMING_PANEL_INFO[panelKey];
  if (!info) return;
  var statusEl = el(info.status);
  if (!statusEl) return;
  var label = getTimingRowLabel(inp);
  var unit = timingUnitSuffix(inp.getAttribute('data-timing-key'));
  var which = clamp.reason === 'low' ? S.settings.timingClampMinimum : S.settings.timingClampMaximum;
  statusEl.textContent = S.settings.timingClamped(label, clamp.snap + unit, which);
  statusEl.className = 'section-save-status';
}

function attachTimingValidation(inp: any) {
  var key = inp.getAttribute('data-timing-key');
  var panelKey = key ? TIMING_PANEL_BY_KEY[key] : null;
  if (!panelKey) return;
  inp.addEventListener('input', function () {
    validateTimingPanel(panelKey!);
  });
  inp.addEventListener('blur', function () {
    var clamp = clampInputOnBlurIfOutOfRange(inp);
    validateTimingPanel(panelKey!);
    if (clamp) showTimingClampedNotice(inp, panelKey!, clamp);
  });
}

function validateAllTimingPanels() {
  Object.keys(TIMING_PANEL_INFO).forEach(function (k) { validateTimingPanel(k); });
}

var keychainSnap: any = null;

function describeSecretStoreStatus(status: string, backend: string, toggleOn: boolean) {
  if (!toggleOn) {
    return S.settings.keychainOff;
  }
  if (status === 'encrypted') {
    return S.settings.keychainEncrypted(backend || S.settings.keychainDefaultBackend);
  }
  if (status === 'unencrypted') {
    return S.settings.keychainUnencrypted;
  }
  if (status === 'unavailable') {
    return S.settings.keychainUnavailable;
  }
  return S.settings.keychainStatus(status, backend);
}

function updateKeychainStatusHint(toggleOn: boolean, snapshot: any) {
  var hint = el('keychainStorageStatus');
  if (!hint) return;
  var snap = snapshot || {};
  var text = describeSecretStoreStatus(snap.status, snap.backend, toggleOn);
  hint.textContent = text;
  hint.className = 'settings-row-desc settings-keychain-status' + (text.indexOf('Warning') >= 0 ? ' warn' : '');
}

function updateNetworkInspectorStatusLine(state: any) {
  var line = el('niStatusLine');
  if (!line) return;
  if (!state || !state.networkInspectorEnabled) {
    line.textContent = S.settings.niStatusDisabled;
    return;
  }
  var platformHint = HOST_PLATFORM === 'darwin'
    ? S.settings.niPlatformMac
    : HOST_PLATFORM === 'win32'
      ? S.settings.niPlatformWin
      : S.settings.niPlatformLinux;
  var mitm = S.settings.niMitmSuffix(state.networkInspectorMitmPort || 8888);
  line.textContent = S.settings.niStatusEnabled(platformHint) + mitm;
}

// Last known capture-access state, so a locale-driven rebuild of the setup modal can re-assert
// the action row's visibility without re-querying the main process.
var lastBpfCaptureAvailable = false;
function updateBpfCaptureUi(available: boolean) {
  if (HOST_PLATFORM !== 'darwin' && HOST_PLATFORM !== 'linux') return;
  var ok = available === true;
  lastBpfCaptureAvailable = ok;
  var headerBadge = el('niSetupHeaderBadge');
  if (headerBadge) {
    headerBadge.hidden = false;
    headerBadge.setAttribute('data-state', ok ? 'ok' : 'blocked');
    headerBadge.textContent = ok ? S.settings.captureAccessEnabled : S.settings.setupNeeded;
  }
  var headingEl = el('niBpfHeading');
  var explainEl = el('niBpfExplain');
  var actionsEl = el('niBpfActions');
  if (headingEl) headingEl.hidden = ok;
  if (explainEl) explainEl.hidden = ok;
  if (actionsEl) actionsEl.hidden = ok;
  var rowEl = el('niSetupRow');
  if (rowEl) rowEl.classList.toggle('needs-attention', !ok);
  var badgeEl = el('niSetupBadge');
  if (badgeEl) badgeEl.hidden = ok;
  var rowDescEl = el('niSetupRowDesc');
  if (rowDescEl) {
    rowDescEl.textContent = ok
      ? S.settings.niSetupRowDescOk
      : S.settings.niSetupRowDescNeeds;
  }
}

var niSavedLocations: any[] = [];
var niConnectedLocations: any[] = [];
var niProbeCache: Record<string, any> = {};
var niSelectedPlace = 'local';
var niLocalSnapshot: any = null;
var niAutoDisableStatusTimer: number | null = null;
var niLastAutoDisableStatusMessage = '';

function currentNiPlace() {
  return niSelectedPlace || 'local';
}

function setNiControlsDisabled(disabled: boolean) {
  ['optNetworkInspector', 'niMitmPort', 'niMaxRawPackets', 'niMaxBodyKb'].forEach(function (id) {
    var elx = el(id);
    if (elx) elx.disabled = !!disabled;
  });
}

function setNiPlaceHint(text: string, show: boolean) {
  var hint = el('niPlaceHint');
  if (!hint) return;
  hint.hidden = !show;
  hint.textContent = text || '';
}

function showTransientNiStatus(message: string, isErr: boolean, durationMs?: number) {
  setSectionStatus('saveStatusNetworkInspector', message || '', !!isErr);
  if (niAutoDisableStatusTimer != null) {
    window.clearTimeout(niAutoDisableStatusTimer);
    niAutoDisableStatusTimer = null;
  }
  var ms = typeof durationMs === 'number' && durationMs > 0 ? durationMs : 4500;
  niAutoDisableStatusTimer = window.setTimeout(function () {
    if (el('saveStatusNetworkInspector') && (el('saveStatusNetworkInspector').textContent || '') === message) {
      setSectionStatus('saveStatusNetworkInspector', '', false);
    }
    niAutoDisableStatusTimer = null;
  }, ms);
}

function applyLocalNiValues() {
  if (!niLocalSnapshot) return;
  setToggle('optNetworkInspector', niLocalSnapshot.enabled === true);
  if (el('niMitmPort')) el('niMitmPort').value = String(niLocalSnapshot.mitmPort || 8888);
  if (el('niMaxRawPackets')) el('niMaxRawPackets').value = String(niLocalSnapshot.maxRawPackets || NI_MAX_RAW_PACKETS_DEFAULT);
  if (el('niMaxBodyKb')) el('niMaxBodyKb').value = String(niLocalSnapshot.maxBodyKb || NI_MAX_BODY_KB_DEFAULT);
}

function setNiSectionUnsupported(unsupported: boolean) {
  var section = el('niSection');
  if (section) section.classList.toggle('is-ni-unsupported', !!unsupported);
  var save = el('btnSaveNetworkInspector') as HTMLButtonElement | null;
  if (save) save.disabled = !!unsupported;
}

function renderPlaceSelect() {
  var bar = el('niPlaceRow');
  var sel = el('niPlace');
  if (!bar || !sel) return;
  var show = niConnectedLocations.length > 0;
  bar.hidden = !show;
  if (!show) {
    niSelectedPlace = 'local';
    applyNiPlace();
    return;
  }
  if (niSelectedPlace !== 'local' && !niConnectedLocations.some(function (l) { return l.serverUrl === niSelectedPlace; })) {
    niSelectedPlace = 'local';
  }
  var places = [{ value: 'local', label: S.settings.placeLocal }].concat(
    niConnectedLocations.map(function (l) {
      var label = l.host ? ((l.name || S.settings.placeRemoteFallback) + ' (' + l.host + ')') : (l.name || l.serverUrl);
      return { value: l.serverUrl, label: label };
    })
  );
  sel.innerHTML = '';
  places.forEach(function (p) {
    var opt = document.createElement('option');
    opt.value = p.value;
    opt.textContent = p.label;
    sel.appendChild(opt);
  });
  sel.value = niSelectedPlace;
  if (!sel.value) { sel.value = 'local'; niSelectedPlace = 'local'; }
  applyNiPlace();
}

function refreshConnectedPlaces() {
  if (!api.remoteNetworkProbe || niSavedLocations.length === 0) {
    niConnectedLocations = [];
    renderPlaceSelect();
    return;
  }
  Promise.all(niSavedLocations.map(function (loc: any) {
    return api.remoteNetworkProbe(loc.serverUrl).then(function (res: any) {
      niProbeCache[loc.serverUrl] = res;
      return (res && res.reachable) ? loc : null;
    }).catch(function () { return null; });
  })).then(function (results: any[]) {
    niConnectedLocations = results.filter(function (l) { return !!l; });
    renderPlaceSelect();
  });
}

function applyRemoteProbeResult(place: string, res: any) {
  if (currentNiPlace() !== place) return;
  var ni = res && res.networkInspector;
  if (!res || !res.success || !ni || ni.supported !== true) {
    var reason = (ni && ni.requiresRoot && ni.isRoot === false)
      ? S.settings.niRemoteRequiresRoot
      : S.settings.niRemoteUnsupported;
    setNiPlaceHint(reason, true);
    setNiControlsDisabled(true);
    setNiSectionUnsupported(true);
    setToggle('optNetworkInspector', false);
    renderNiPortConflict(null);
    if (el('niCaRow')) el('niCaRow').hidden = true;
    return;
  }
  setNiSectionUnsupported(false);
  setNiControlsDisabled(false);
  // This location can capture, so its CA is real too — show the row and point the description
  // at THIS server's certificate authority, not the local one.
  if (el('niCaRow')) el('niCaRow').hidden = false;
  if (el('niCaRowDesc')) el('niCaRowDesc').textContent = S.settings.caRowDescRemote;
  if (el('niCaSectionDesc')) el('niCaSectionDesc').textContent = S.settings.caSectionDescRemote;
  if (el('niMaxRawPackets')) el('niMaxRawPackets').disabled = true;
  if (el('niMaxBodyKb')) el('niMaxBodyKb').disabled = true;
  var cfg = res.config || {};
  var status = res.status || {};
  var statusHasEnabled = typeof status.enabled === 'boolean';
  setToggle('optNetworkInspector', statusHasEnabled ? status.enabled === true : cfg.enabled === true);
  if (el('niMitmPort')) el('niMitmPort').value = String(cfg.mitmPort || status.mitmPort || 8888);
  var autoDisabled = status && status.enabled === false && /^Network Inspector disabled:/i.test(String(status.lastError || ''));
  setNiPlaceHint(
    autoDisabled
      ? String(status.lastError || S.settings.niDisabled)
      : S.settings.niEditingRemote,
    true
  );
  renderNiPortConflict(status && status.mitmPortConflict ? status.mitmPortConflict : null);
}

function applyLocalNiRuntimeStatus(status: any) {
  var autoDisabled = status && status.enabled === false && /^Network Inspector disabled:/i.test(String(status.lastError || ''));
  if (autoDisabled) {
    setToggle('optNetworkInspector', false);
    if (niLocalSnapshot) niLocalSnapshot.enabled = false;
    setNiPlaceHint('', false);
    var msg = String(status.lastError || S.settings.niDisabled);
    if (msg !== niLastAutoDisableStatusMessage) {
      showTransientNiStatus(msg, true, 5000);
      niLastAutoDisableStatusMessage = msg;
    }
    updateNetworkInspectorStatusLine({ networkInspectorEnabled: false });
    return;
  }
  niLastAutoDisableStatusMessage = '';
  // Local place normally hides the place hint; clear any stale auto-disable message once recovered.
  if (currentNiPlace() === 'local') {
    setNiPlaceHint('', false);
  }
}

function renderNiPortConflict(conflict: any) {
  var box = el('niPortConflictWarn');
  if (!box) return;
  if (!conflict) { box.hidden = true; return; }
  box.hidden = false;
  if (el('niPortConflictTitle')) el('niPortConflictTitle').textContent = conflict.title || S.settings.niPortConflictTitle;
  if (el('niPortConflictMsg')) el('niPortConflictMsg').textContent = conflict.message || '';
  var steps = el('niPortConflictSteps');
  if (steps) {
    steps.innerHTML = '';
    (conflict.remediation || []).forEach(function (s: string) {
      var li = document.createElement('li');
      li.textContent = s;
      steps.appendChild(li);
    });
  }
}

function refreshNiPortConflict() {
  var place = currentNiPlace();
  if (place === 'local') {
    if (!api.getNetworkInspectorStatus) { renderNiPortConflict(null); return; }
    api.getNetworkInspectorStatus().then(function (res: any) {
      if (currentNiPlace() !== 'local') return;
      var status = res && res.status;
      applyLocalNiRuntimeStatus(status || {});
      renderNiPortConflict(status && status.mitmPortConflict ? status.mitmPortConflict : null);
    }).catch(function () { renderNiPortConflict(null); });
    return;
  }
  var cached = niProbeCache[place];
  var rstatus = cached && cached.status;
  renderNiPortConflict(rstatus && rstatus.mitmPortConflict ? rstatus.mitmPortConflict : null);
}

/**
 * Populate the cyan Min/Max bound labels that bracket the three static NI number inputs,
 * mirroring the Timing rows. Reads each input's min/max attributes and formats them via the
 * shared S.settings.timingBoundMin/Max fns so the "Min:"/"Max:" prefix follows the active
 * locale. Call after applyI18n (init) and on a locale change so the prefix stays translated.
 */
function populateNiBoundLabels() {
  ['niMitmPort', 'niMaxRawPackets', 'niMaxBodyKb'].forEach(function (id) {
    var inp = el(id);
    if (!inp) return;
    var st = inp.parentElement;
    if (!st) return;
    var mn = st.querySelector('[data-ni-bound-min]');
    var mx = st.querySelector('[data-ni-bound-max]');
    if (mn) mn.textContent = S.settings.timingBoundMin(inp.getAttribute('min') || '');
    if (mx) mx.textContent = S.settings.timingBoundMax(inp.getAttribute('max') || '');
  });
}

function applyNiPlace() {
  var place = currentNiPlace();
  var setupRow = el('niSetupRow');
  var maxRawRow = el('niMaxRawPackets');
  var caRow = el('niCaRow');
  if (place === 'local') {
    setNiSectionUnsupported(false);
    setNiControlsDisabled(false);
    setNiPlaceHint('', false);
    if (setupRow) setupRow.hidden = false;
    if (maxRawRow) maxRawRow.disabled = false;
    // This machine's own certificate authority — restore the local wording in case a previously
    // selected remote place swapped it to the remote variant (applyRemoteProbeResult).
    if (caRow) caRow.hidden = false;
    if (el('niCaRowDesc')) el('niCaRowDesc').textContent = S.settings.caRowDesc;
    if (el('niCaSectionDesc')) el('niCaSectionDesc').textContent = S.settings.caSectionDesc;
    applyLocalNiValues();
    refreshNiPortConflict();
    return;
  }
  // Default to hidden while probing (avoids a flash of the previous place's CA info);
  // applyRemoteProbeResult reveals it once we know this place actually supports capture.
  if (caRow) caRow.hidden = true;
  // Close any open CA modal so a place switch can't leave stale info on screen — the reopened
  // "View Certificate" button re-fetches for whichever place is now selected.
  if (isNiCaOpen()) closeNiCa();
  if (setupRow) setupRow.hidden = true;
  if (maxRawRow) maxRawRow.disabled = true;
  setNiControlsDisabled(true);
  renderNiPortConflict(null);
  if (!api.remoteNetworkProbe) {
    setNiPlaceHint(S.settings.niRemoteUnavailable, true);
    setNiSectionUnsupported(true);
    return;
  }
  if (niProbeCache[place]) {
    applyRemoteProbeResult(place, niProbeCache[place]);
    return;
  }
  setNiPlaceHint(S.settings.niCheckingRemote, true);
  api.remoteNetworkProbe(place).then(function (res: any) {
    niProbeCache[place] = res;
    applyRemoteProbeResult(place, res);
  }).catch(function () {
    if (currentNiPlace() !== place) return;
    setNiPlaceHint(S.settings.niCouldNotReachRemote, true);
    setNiControlsDisabled(true);
    setNiSectionUnsupported(true);
  });
}

/** Raw OS locale for this window (e.g. "en-US"); empty if unavailable. */
function systemLocaleRaw(): string {
  return (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : '';
}

/**
 * Human-readable name of the OS language for the "System Default (…)" label. Uses our own
 * endonym when we ship that language, else Intl.DisplayNames, else the primary subtag.
 */
function systemLocaleName(raw: string): string {
  var matched = matchLocale(raw);
  if (matched) return localeLabel(matched);
  var primary = (raw || 'en').split(/[-_]/)[0];
  try {
    var DisplayNames = (Intl as unknown as { DisplayNames?: any }).DisplayNames;
    if (DisplayNames) {
      var name = new DisplayNames([getLocale()], { type: 'language' }).of(primary);
      if (name) return String(name);
    }
  } catch (_e) { /* fall through to the raw subtag */ }
  return primary;
}

/**
 * Fill the Language dropdown: "System Default (<OS language>)" first, a disabled separator,
 * then each shipping locale. System Default follows the OS; the explicit codes pin a locale.
 */
function populateLanguageOptions() {
  var sel = el('optLanguage') as HTMLSelectElement | null;
  if (!sel) return;
  sel.innerHTML = '';

  var sysOpt = document.createElement('option');
  sysOpt.value = SYSTEM_LOCALE;
  sysOpt.textContent = S.settings.languageSystemDefault(systemLocaleName(systemLocaleRaw()));
  sel.appendChild(sysOpt);

  var sep = document.createElement('option');
  sep.disabled = true;
  sep.value = '';
  sep.textContent = '──────────';
  sel.appendChild(sep);

  // Explicit locales sorted alphabetically by their display label (endonym); System
  // Default + separator stay pinned on top. Latin labels sort before Cyrillic, so
  // Українська lands last.
  availableLocales
    .slice()
    .sort(function (a, b) { return a.label.localeCompare(b.label); })
    .forEach(function (loc) {
      var opt = document.createElement('option');
      opt.value = loc.code;
      opt.textContent = loc.label;
      sel!.appendChild(opt);
    });
}

/** Current dropdown selection, falling back to System Default. */
function currentLanguage(): string {
  var sel = el('optLanguage') as HTMLSelectElement | null;
  return sel && sel.value ? sel.value : SYSTEM_LOCALE;
}

/** Select `code` (System Default or a known locale); otherwise fall back to System Default. */
function setLanguageSelect(code: string) {
  var sel = el('optLanguage') as HTMLSelectElement | null;
  if (!sel) return;
  var known = code === SYSTEM_LOCALE || availableLocales.some(function (l) { return l.code === code; });
  sel.value = known ? code : SYSTEM_LOCALE;
}

function buildPayload() {
  return {
    language: currentLanguage(),
    developerModeEnabled: boolFromToggle('optDevMode'),
    privacyModeEnabled: boolFromToggle('optPrivacy'),
    debugLoggingEnabled: boolFromToggle('optDebugLog'),
    timingOverrides: readTimingOverrides(),
    actionScriptDefaultSaveFolder: folderPath,
    devicePerformanceRememberQuadPerDevice: boolFromToggle('optDevicePerfRememberQuad'),
    keyboardRemoteShortcutsEnabled: boolFromToggle('optKeyboardRemote'),
    tryDemoAppEnabled: boolFromToggle('optTryDemoApp'),
    autoConnectLastDeviceEnabled: boolFromToggle('optAutoConnectLast'),
    rememberSidebarToggle: boolFromToggle('optRememberSidebarToggle'),
    rememberPasswordsInKeychain: boolFromToggle('optRememberPasswordsInKeychain'),
    networkInspectorEnabled: (currentNiPlace() === 'local')
      ? boolFromToggle('optNetworkInspector')
      : (niLocalSnapshot ? niLocalSnapshot.enabled === true : false),
    networkInspectorMitmEnabled: true,
    networkInspectorMitmPort: (currentNiPlace() === 'local')
      ? (el('niMitmPort') ? parseInt(el('niMitmPort').value, 10) || 8888 : 8888)
      : (niLocalSnapshot ? niLocalSnapshot.mitmPort : 8888),
    networkInspectorMaxRawPacketsPerDevice: clampNiMaxRawPackets(
      (currentNiPlace() === 'local')
        ? (el('niMaxRawPackets') ? el('niMaxRawPackets').value : NI_MAX_RAW_PACKETS_DEFAULT)
        : (niLocalSnapshot ? niLocalSnapshot.maxRawPackets : NI_MAX_RAW_PACKETS_DEFAULT)
    ),
    networkInspectorMaxBodyRetainedBytes: niBodyKbToBytes(
      (currentNiPlace() === 'local')
        ? (el('niMaxBodyKb') ? el('niMaxBodyKb').value : NI_MAX_BODY_KB_DEFAULT)
        : (niLocalSnapshot ? niLocalSnapshot.maxBodyKb : NI_MAX_BODY_KB_DEFAULT)
    ),
    mcpClients: (function () {
      var out: Record<string, boolean> = {};
      MCP_CLIENT_IDS.forEach(function (id) {
        out[id] = !!mcpClientsState[id];
      });
      return out;
    })(),
    hostPlatform: HOST_PLATFORM,
  };
}

function panelKeyForStatusId(statusId: string) {
  if (statusId === 'saveStatusGeneral') return 'General';
  if (statusId === 'saveStatusDevicePerf') return 'DevicePerf';
  if (statusId === 'saveStatusTiming') return 'Timing';
  return null;
}

// `okMessage` is a getter (not a plain string) so the confirmation reads from the
// ACTIVE locale at save time. Passing S.settings.*Saved by value here would freeze
// it to the locale active when wireSaveButton was called at module load.
function wireSaveButton(btnId: string, okMessage: () => string, statusId: string, afterSave?: () => void) {
  var btn = el(btnId) as HTMLButtonElement | null;
  if (!btn) return;
  btn.addEventListener('click', function () {
    var panelKey = panelKeyForStatusId(statusId);
    if (panelKey && !validateTimingPanel(panelKey)) return;
    btn!.disabled = true;
    setSectionStatus(statusId, '', false);
    api.save(buildPayload()).then(function (res: any) {
      btn!.disabled = false;
      if (res && res.success) {
        if (res.warning) {
          setSectionStatus(statusId, String(res.warning), true);
        } else {
          setSectionStatus(statusId, okMessage(), false);
        }
        if (Array.isArray(res.mcpResults) && statusId === 'saveStatusMcpServer') {
          res.mcpResults.forEach(function (r: any) {
            if (r && typeof r.id === 'string' && typeof r.enabled === 'boolean') {
              mcpClientsState[r.id] = r.enabled;
            }
          });
          renderMcpClients();
        }
        if (afterSave) { try { afterSave(); } catch (_e) { /* ignore */ } }
      } else {
        setSectionStatus(statusId, (res && res.error) || S.settings.saveFailed, true);
      }
      if (panelKey) validateTimingPanel(panelKey);
    }).catch(function (e: any) {
      btn!.disabled = false;
      setSectionStatus(statusId, String(e && e.message ? e.message : e), true);
      if (panelKey) validateTimingPanel(panelKey);
    });
  });
}

/**
 * Fill the Hotspot Capture Setup modal's title + guide body from the active locale. The body is
 * injected HTML (paragraphs/steps carry inline markup), so it lives outside applyI18n's reach —
 * call this at init and again on every locale change to keep it translated.
 */
function populateNiSetupModal() {
  var niSetupPlatform = HOST_PLATFORM as NiSetupPlatform;
  // Fall back to the engine's English default if a locale hasn't translated the guide yet
  // (undefined at runtime for an untranslated catalog) so the modal never renders empty.
  var guide: NiSetupGuideStrings | undefined = S.settings.niSetupGuide;
  var titleEl = document.getElementById('niSetupModalTitle');
  if (titleEl) titleEl.textContent = networkInspectorSetupTitle(niSetupPlatform, guide && guide.titlePrefix);
  var bodyEl = document.getElementById('niSetupModalBody');
  if (bodyEl) {
    var bodyHtml = networkInspectorSetupGuideBodyHtml(niSetupPlatform, guide);
    if (networkInspectorHasCaptureSetupAction(niSetupPlatform)) {
      bodyHtml +=
        '<div class="settings-section-actions" id="niBpfActions">' +
        '<button type="button" class="btn btn-secondary btn-sm" id="btnInstallBpfAccess">' + S.settings.niSetupPacketCapture + '</button>' +
        '<span class="settings-row-desc" id="niBpfInstallStatus" aria-live="polite"></span>' +
        '</div>';
    }
    bodyEl.innerHTML = bodyHtml;
    wireBpfInstallButton();
    // The action row's visibility tracks capture availability; re-assert it after a rebuild.
    updateBpfCaptureUi(lastBpfCaptureAvailable);
  }
}

function wireBpfInstallButton() {
  var btnInstallBpf = el('btnInstallBpfAccess') as HTMLButtonElement | null;
  if (btnInstallBpf && api.installBpfAccess) {
    btnInstallBpf.addEventListener('click', function () {
      btnInstallBpf!.disabled = true;
      var statusEl = el('niBpfInstallStatus');
      if (statusEl) statusEl.textContent = S.settings.bpfWaitingApproval;
      api.installBpfAccess().then(function (res: any) {
        btnInstallBpf!.disabled = false;
        if (res && res.success) {
          setSectionStatus('saveStatusNetworkInspector', S.settings.bpfInstalled, false);
          if (statusEl) statusEl.textContent = S.settings.bpfInstalledHint;
          updateBpfCaptureUi(res.bpfCaptureAvailable !== false);
        } else if (res && res.error === 'cancelled') {
          if (statusEl) statusEl.textContent = S.settings.bpfCancelled;
        } else {
          setSectionStatus('saveStatusNetworkInspector', (res && res.error) || S.settings.bpfSetupFailed, true);
          if (statusEl) statusEl.textContent = '';
        }
      }).catch(function (e: any) {
        btnInstallBpf!.disabled = false;
        setSectionStatus('saveStatusNetworkInspector', String(e && e.message ? e.message : e), true);
      });
    });
  }
}

// ── Network Inspector — Certificate Authority modal (read-only) ──
// Populated on modal open (openNiCa → refreshCaInfo) so merely viewing Settings never
// triggers getOrCreateCa()'s synchronous RSA keygen — only opening the CA modal does.
var niCaExportStatusTimer: number | null = null;

/** Format the CA validity as a "from – to" range using the window locale; date-only, no time. */
function formatCaValidity(fromIso: string, toIso: string): string {
  var opts = { year: 'numeric', month: 'short', day: 'numeric' } as any;
  var from = '';
  try { from = new Date(fromIso).toLocaleDateString(getLocale(), opts); } catch (_e) { from = fromIso || ''; }
  if (!toIso) return from;
  var to = '';
  try { to = new Date(toIso).toLocaleDateString(getLocale(), opts); } catch (_e) { to = toIso; }
  return S.settings.caValidityRange(from, to);
}

function refreshCaInfo() {
  var place = currentNiPlace();
  var isRemotePlace = place !== 'local';
  if (isRemotePlace ? !api.remoteNetworkGetCaInfo : !api.networkInspectorGetCaInfo) return;
  var req = isRemotePlace ? api.remoteNetworkGetCaInfo(place) : api.networkInspectorGetCaInfo();
  req.then(function (res: any) {
    var ca = res && res.caInfo;
    if (res && res.success && ca) {
      if (el('niCaSubject')) el('niCaSubject').textContent = ca.commonName || '';
      if (el('niCaFingerprint')) el('niCaFingerprint').textContent = ca.fingerprintSha256 || '';
      if (el('niCaValidity')) el('niCaValidity').textContent = formatCaValidity(ca.createdAt, ca.expiresAt);
      if (el('niCaProxy')) el('niCaProxy').textContent = ca.proxyHostPort || '';
      if (el('niCaInfo')) el('niCaInfo').hidden = false;
      if (el('niCaEmpty')) el('niCaEmpty').hidden = true;
    } else {
      if (el('niCaEmpty')) { el('niCaEmpty').textContent = S.settings.caUnavailable; el('niCaEmpty').hidden = false; }
      if (el('niCaInfo')) el('niCaInfo').hidden = true;
    }
  }).catch(function () {
    if (el('niCaEmpty')) { el('niCaEmpty').textContent = S.settings.caUnavailable; el('niCaEmpty').hidden = false; }
    if (el('niCaInfo')) el('niCaInfo').hidden = true;
  });
}

/** Local auto-clearing status next to the CA export buttons (mirrors showTransientNiStatus). */
function setCaExportStatus(msg: string, isErr: boolean) {
  var statusEl = el('niCaExportStatus');
  if (!statusEl) return;
  statusEl.textContent = msg || '';
  statusEl.className = 'settings-row-desc' + (msg && isErr ? ' err' : '');
  if (niCaExportStatusTimer != null) {
    window.clearTimeout(niCaExportStatusTimer);
    niCaExportStatusTimer = null;
  }
  if (!msg) return;
  niCaExportStatusTimer = window.setTimeout(function () {
    var s = el('niCaExportStatus');
    if (s && (s.textContent || '') === msg) {
      s.textContent = '';
      s.className = 'settings-row-desc';
    }
    niCaExportStatusTimer = null;
  }, 4500);
}

function wireCaExportButtons() {
  var btnPem = el('btnExportCaPem') as HTMLButtonElement | null;
  if (btnPem && (api.networkInspectorExportCaPem || api.remoteNetworkExportCaPem)) {
    btnPem.addEventListener('click', function () {
      var place = currentNiPlace();
      var req = place !== 'local' && api.remoteNetworkExportCaPem
        ? api.remoteNetworkExportCaPem(place)
        : api.networkInspectorExportCaPem && api.networkInspectorExportCaPem();
      if (!req) return;
      btnPem!.disabled = true;
      req.then(function (res: any) {
        btnPem!.disabled = false;
        if (res && res.success) {
          setCaExportStatus(S.settings.caExportedPem, false);
        } else if (res && res.error === 'cancelled') {
          /* silent — user dismissed the save dialog */
        } else {
          setCaExportStatus((res && res.error) || S.settings.caExportFailed, true);
        }
      }).catch(function (e: any) {
        btnPem!.disabled = false;
        setCaExportStatus(String(e && e.message ? e.message : e), true);
      });
    });
  }
  var btnCrt = el('btnExportCaCrt') as HTMLButtonElement | null;
  if (btnCrt && (api.networkInspectorExportCaCert || api.remoteNetworkExportCaCert)) {
    btnCrt.addEventListener('click', function () {
      var place = currentNiPlace();
      var req = place !== 'local' && api.remoteNetworkExportCaCert
        ? api.remoteNetworkExportCaCert(place)
        : api.networkInspectorExportCaCert && api.networkInspectorExportCaCert();
      if (!req) return;
      btnCrt!.disabled = true;
      req.then(function (res: any) {
        btnCrt!.disabled = false;
        if (res && res.success) {
          setCaExportStatus(S.settings.caExportedCrt, false);
        } else if (res && res.error === 'cancelled') {
          /* silent — user dismissed the save dialog */
        } else {
          setCaExportStatus((res && res.error) || S.settings.caExportFailed, true);
        }
      }).catch(function (e: any) {
        btnCrt!.disabled = false;
        setCaExportStatus(String(e && e.message ? e.message : e), true);
      });
    });
  }
}

// ---- Initialization ----

api.getState().then(function (state: any) {
  HOST_PLATFORM = String(state.hostPlatform || '');

  // Apply the saved language to THIS window's catalog BEFORE building any content, then
  // retranslate the static shell. The Settings window doesn't run loadPersistedAppSettings,
  // so without this it renders English even when the dropdown shows the saved language
  // (and looked like the choice "reverted" on reopen).
  var langPref = typeof state.language === 'string' ? state.language : SYSTEM_LOCALE;
  setLocaleFromPreference(langPref);
  applyI18n(document);
  syncHeaderSectionLabel();
  populateLanguageOptions();
  requestAnimationFrame(syncSettingsHelpTooltips); // clamp/reveal long help once content is laid out

  // Populate the NI setup modal from the platform (in the active locale). Re-run on locale
  // change since the body is injected HTML that applyI18n's single-text-node pass can't touch.
  populateNiSetupModal();

  setToggle('optDevMode', !!state.developerModeEnabled);
  setToggle('optPrivacy', !!state.privacyModeEnabled);
  applyPrivacyMode(!!state.privacyModeEnabled);
  setToggle('optDebugLog', !!state.debugLoggingEnabled);
  setToggle('optKeyboardRemote', state.keyboardRemoteShortcutsEnabled === true);
  setToggle('optTryDemoApp', state.tryDemoAppEnabled !== false);
  syncTryDemoAppOpenBtnVisibility();
  setToggle('optAutoConnectLast', state.autoConnectLastDeviceEnabled === true);
  setToggle('optRememberSidebarToggle', state.rememberSidebarToggle === true);
  setToggle('optRememberPasswordsInKeychain', state.rememberPasswordsInKeychain === true);
  setLanguageSelect(langPref);
  keychainSnap = state.secretStoreStatus || null;
  updateKeychainStatusHint(state.rememberPasswordsInKeychain === true, keychainSnap);
  setToggle('optDevicePerfRememberQuad', state.devicePerformanceRememberQuadPerDevice === true);
  setToggle('optNetworkInspector', state.networkInspectorEnabled === true);
  if (el('niMitmPort')) el('niMitmPort').value = String(state.networkInspectorMitmPort || 8888);
  if (el('niMaxRawPackets')) {
    el('niMaxRawPackets').value = String(
      typeof state.networkInspectorMaxRawPacketsPerDevice === 'number'
        ? clampNiMaxRawPackets(state.networkInspectorMaxRawPacketsPerDevice)
        : NI_MAX_RAW_PACKETS_DEFAULT
    );
  }
  if (el('niMaxBodyKb')) {
    el('niMaxBodyKb').value = String(
      typeof state.networkInspectorMaxBodyRetainedBytes === 'number'
        ? niBodyBytesToKb(state.networkInspectorMaxBodyRetainedBytes)
        : NI_MAX_BODY_KB_DEFAULT
    );
  }
  populateNiBoundLabels();
  updateNetworkInspectorStatusLine(state);
  updateBpfCaptureUi(state.captureToolAvailable === true || state.bpfCaptureAvailable === true);
  niSavedLocations = Array.isArray(state.remoteLocations) ? state.remoteLocations : [];
  niLocalSnapshot = {
    enabled: state.networkInspectorEnabled === true,
    mitmPort: state.networkInspectorMitmPort || 8888,
    maxRawPackets: (typeof state.networkInspectorMaxRawPacketsPerDevice === 'number'
      ? clampNiMaxRawPackets(state.networkInspectorMaxRawPacketsPerDevice)
      : NI_MAX_RAW_PACKETS_DEFAULT),
    maxBodyKb: (typeof state.networkInspectorMaxBodyRetainedBytes === 'number'
      ? niBodyBytesToKb(state.networkInspectorMaxBodyRetainedBytes)
      : NI_MAX_BODY_KB_DEFAULT)
  };
  refreshConnectedPlaces();
  if (state.logFilePath && el('logPathHint')) {
    el('logPathHint').textContent = S.settings.logFilePath(state.logFilePath);
  }
  setFolderDisplay(state.actionScriptDefaultSaveFolder || '');
  mcpClientDetections = Array.isArray(state.mcpClientDetections) ? state.mcpClientDetections : [];
  var stateMcp = (state && state.mcpClients) || {};
  mcpClientsState = {};
  MCP_CLIENT_IDS.forEach(function (id) {
    mcpClientsState[id] = !!stateMcp[id];
  });
  renderMcpClients();
  buildTimingRows(state);
  validateAllTimingPanels();
  // All toggles/sections are now populated in the DOM — tell main it can reveal the window
  // (it was created hidden). Showing only now avoids the toggle-flip / section-populate flash
  // of showing the static shell first. Main has a fallback timer if this never arrives.
  if (typeof api.notifyReady === 'function') api.notifyReady();
}).catch(function (e: any) {
  setSectionStatus('saveStatusGeneral', String(e && e.message ? e.message : e), true);
  if (typeof api.notifyReady === 'function') api.notifyReady();
});

el('btnBrowseFolder').addEventListener('click', function () {
  api.pickFolder().then(function (res: any) {
    if (res && res.success && res.folderPath) setFolderDisplay(res.folderPath);
  });
});
var btnResetActionScripts = el('btnResetActionScripts');
if (btnResetActionScripts) {
  btnResetActionScripts.addEventListener('click', function () {
    setFolderDisplay('');
  });
}
var btnResetMcpServer = el('btnResetMcpServer');
if (btnResetMcpServer) {
  btnResetMcpServer.addEventListener('click', function () {
    mcpClientDetections.forEach(function (det) {
      if (!det || !det.installed) return;
      var id = det.id;
      if (MCP_CLIENT_IDS.indexOf(id) === -1) return;
      mcpClientsState[id] = false;
    });
    renderMcpClients();
  });
}
el('btnResetTiming').addEventListener('click', function () {
  applyDefaultsForKeys(TIMING_KEYS);
  validateTimingPanel('Timing');
});
var btnResetDevicePerf = el('btnResetDevicePerf');
if (btnResetDevicePerf) {
  btnResetDevicePerf.addEventListener('click', function () {
    setToggle('optDevicePerfRememberQuad', false);
    applyDefaultsForKeys(DEVICE_PERF_KEYS);
    validateTimingPanel('DevicePerf');
  });
}
var GENERAL_TOGGLE_DEFAULTS: Record<string, boolean> = {
  optDevMode: false,
  optPrivacy: false,
  optDebugLog: false,
  optKeyboardRemote: false,
  optAutoConnectLast: false,
  optRememberSidebarToggle: false,
  optRememberPasswordsInKeychain: false
};
populateLanguageOptions();
setLanguageSelect(SYSTEM_LOCALE);
// Language is applied only when the user clicks Save (see the General save button wiring
// below) — NOT live on dropdown change. The picked value stays in the <select> until Save.
// Retranslate this window in place when the locale changes (on Save, or from elsewhere).
if (api && typeof api.onLocaleChanged === 'function') {
  api.onLocaleChanged(function (pref: string) {
    // Shared live-switch core (setLocale + applyI18n + retranslate registries); `extra` re-renders
    // the Settings window's own imperative surfaces (language picker, NI labels, setup modal).
    applyLocalePreference(pref, function () {
      syncHeaderSectionLabel();
      populateLanguageOptions();
      setLanguageSelect(pref);
      populateNiBoundLabels();
      populateNiSetupModal();
      requestAnimationFrame(syncSettingsHelpTooltips); // re-derive clamp/tooltip for the new locale's text
    });
  });
}
var btnResetGeneral = el('btnResetGeneral');
if (btnResetGeneral) {
  btnResetGeneral.addEventListener('click', function () {
    Object.keys(GENERAL_TOGGLE_DEFAULTS).forEach(function (id) {
      setToggle(id, GENERAL_TOGGLE_DEFAULTS[id]);
    });
    setLanguageSelect(SYSTEM_LOCALE);
    applyDefaultsForKeys(GENERAL_TIMING_KEYS);
    validateTimingPanel('General');
  });
}
wireToggleAria('optDevMode');
wireToggleAria('optPrivacy');
wireToggleAria('optDebugLog');
// Preview masking live as the user flips Privacy Mode here (before Save), matching
// the main window's immediate response to the File → Privacy Mode menu toggle.
var optPrivacy = el('optPrivacy') as HTMLInputElement | null;
if (optPrivacy) {
  optPrivacy.addEventListener('change', function () {
    applyPrivacyMode(!!optPrivacy!.checked);
  });
}
wireToggleAria('optKeyboardRemote');
// "Open Demo App" button next to the toggle: only useful once the titlebar button itself is
// hidden (toggle off), since it's otherwise redundant with that always-visible button.
var optTryDemoApp = el('optTryDemoApp') as HTMLInputElement | null;
var tryDemoAppOpenBtn = el('tryDemoAppOpenBtn') as HTMLButtonElement | null;
function syncTryDemoAppOpenBtnVisibility() {
  if (tryDemoAppOpenBtn) tryDemoAppOpenBtn.hidden = !!(optTryDemoApp && optTryDemoApp.checked);
}
if (optTryDemoApp) {
  optTryDemoApp.addEventListener('change', syncTryDemoAppOpenBtnVisibility);
}
if (tryDemoAppOpenBtn) {
  tryDemoAppOpenBtn.addEventListener('click', function () {
    tryDemoAppOpenBtn!.disabled = true;
    api
      .requestOpenTryDemoApp()
      .then(function () {
        requestCloseSettingsWindow();
      })
      .catch(function () {
        tryDemoAppOpenBtn!.disabled = false;
      });
  });
}
wireToggleAria('optAutoConnectLast');
wireToggleAria('optRememberSidebarToggle');
wireToggleAria('optRememberPasswordsInKeychain');
var optKeychain = el('optRememberPasswordsInKeychain') as HTMLInputElement | null;
if (optKeychain) {
  optKeychain.addEventListener('change', function () {
    if (optKeychain!.checked && keychainSnap && keychainSnap.status === 'unencrypted') {
      var ok = window.confirm(S.settings.keychainUnencryptedConfirm);
      if (!ok) {
        optKeychain!.checked = false;
        setToggle('optRememberPasswordsInKeychain', false);
      }
    }
    updateKeychainStatusHint(!!optKeychain!.checked, keychainSnap);
  });
}
wireToggleAria('optDevicePerfRememberQuad');
wireToggleAria('optNetworkInspector');

if (el('niPlace')) {
  el('niPlace').addEventListener('change', function () {
    niSelectedPlace = el('niPlace').value || 'local';
    applyNiPlace();
  });
}

var optNi = el('optNetworkInspector') as HTMLInputElement | null;
if (optNi) {
  optNi.addEventListener('change', function () {
    if (optNi!.checked) {
      var ok = window.confirm(S.settings.niConfirmEnable);
      if (!ok) {
        optNi!.checked = false;
        setToggle('optNetworkInspector', false);
      }
    }
    updateNetworkInspectorStatusLine({ networkInspectorEnabled: !!optNi!.checked });
  });
}

var btnResetNi = el('btnResetNetworkInspector');
if (btnResetNi) {
  btnResetNi.addEventListener('click', function () {
    setToggle('optNetworkInspector', false);
    if (el('niMitmPort')) el('niMitmPort').value = '8888';
    if (el('niMaxRawPackets')) el('niMaxRawPackets').value = String(NI_MAX_RAW_PACKETS_DEFAULT);
    if (el('niMaxBodyKb')) el('niMaxBodyKb').value = String(NI_MAX_BODY_KB_DEFAULT);
    updateNetworkInspectorStatusLine({ networkInspectorEnabled: false });
  });
}

var niSetupModal = el('niSetupModal');
var niSetupLastFocus: Element | null = null;
function isNiSetupOpen() {
  return !!(niSetupModal && !niSetupModal.hidden);
}
function openNiSetup() {
  if (!niSetupModal) return;
  niSetupLastFocus = document.activeElement;
  niSetupModal.hidden = false;
  var closeBtn = el('niSetupModalClose');
  if (closeBtn) closeBtn.focus();
  if ((HOST_PLATFORM === 'darwin' || HOST_PLATFORM === 'linux') && api.getState) {
    api.getState().then(function (state: any) {
      var ready = state && (state.captureToolAvailable === true || state.bpfCaptureAvailable === true);
      updateBpfCaptureUi(!!ready);
    }).catch(function () {});
  }
}
function closeNiSetup() {
  if (!niSetupModal) return;
  niSetupModal.hidden = true;
  if (niSetupLastFocus && typeof (niSetupLastFocus as HTMLElement).focus === 'function') {
    (niSetupLastFocus as HTMLElement).focus();
  }
  niSetupLastFocus = null;
}
var btnOpenNiSetup = el('btnOpenNiSetup');
if (btnOpenNiSetup) btnOpenNiSetup.addEventListener('click', openNiSetup);
wireCaExportButtons();
var niSetupClose = el('niSetupModalClose');
if (niSetupClose) niSetupClose.addEventListener('click', closeNiSetup);
if (niSetupModal instanceof HTMLElement) {
  attachBackdropClickToClose(niSetupModal, closeNiSetup);
}

var niCaModal = el('niCaModal');
var niCaLastFocus: Element | null = null;
function isNiCaOpen() {
  return !!(niCaModal && !niCaModal.hidden);
}
function openNiCa() {
  if (!niCaModal) return;
  niCaLastFocus = document.activeElement;
  niCaModal.hidden = false;
  var closeBtn = el('niCaModalClose');
  if (closeBtn) closeBtn.focus();
  // Fetch on open — this is the lazy trigger for getOrCreateCa()'s RSA keygen.
  refreshCaInfo();
}
function closeNiCa() {
  if (!niCaModal) return;
  niCaModal.hidden = true;
  if (niCaLastFocus && typeof (niCaLastFocus as HTMLElement).focus === 'function') {
    (niCaLastFocus as HTMLElement).focus();
  }
  niCaLastFocus = null;
}
var btnOpenNiCa = el('btnOpenNiCa');
if (btnOpenNiCa) btnOpenNiCa.addEventListener('click', openNiCa);
var niCaClose = el('niCaModalClose');
if (niCaClose) niCaClose.addEventListener('click', closeNiCa);
if (niCaModal instanceof HTMLElement) {
  attachBackdropClickToClose(niCaModal, closeNiCa);
}

wireSaveButton('btnSaveGeneral', () => S.settings.generalSaved, 'saveStatusGeneral', function () {
  // Apply the picked language on Save (persist + rebuild native menu + broadcast to all
  // windows). Gated here so choosing in the dropdown alone does not change the app language.
  if (api && typeof api.setLanguage === 'function') api.setLanguage(currentLanguage());
});
wireSaveButton('btnSaveActionScripts', () => S.settings.actionScriptsSaved, 'saveStatusActionScripts');
wireSaveButton('btnSaveDevicePerf', () => S.settings.devicePerfSaved, 'saveStatusDevicePerf');
wireSaveButton('btnSaveTiming', () => S.settings.timingSaved, 'saveStatusTiming');
wireSaveButton('btnSaveMcpServer', () => S.settings.mcpSaved, 'saveStatusMcpServer');

(function wireNetworkInspectorSave() {
  var btn = el('btnSaveNetworkInspector') as HTMLButtonElement | null;
  if (!btn) return;
  btn.addEventListener('click', function () {
    var place = currentNiPlace();
    btn!.disabled = true;
    setSectionStatus('saveStatusNetworkInspector', '', false);
    if (place === 'local') {
      api.save(buildPayload()).then(function (res: any) {
        btn!.disabled = false;
        if (res && res.success && !res.warning) {
          niLocalSnapshot = {
            enabled: boolFromToggle('optNetworkInspector'),
            mitmPort: el('niMitmPort') ? parseInt(el('niMitmPort').value, 10) || 8888 : 8888,
            maxRawPackets: clampNiMaxRawPackets(el('niMaxRawPackets') ? el('niMaxRawPackets').value : NI_MAX_RAW_PACKETS_DEFAULT),
            maxBodyKb: clampNiMaxBodyKb(el('niMaxBodyKb') ? el('niMaxBodyKb').value : NI_MAX_BODY_KB_DEFAULT)
          };
          setSectionStatus('saveStatusNetworkInspector', S.settings.niSaved, false);
        } else {
          setSectionStatus('saveStatusNetworkInspector', (res && (res.warning || res.error)) || S.settings.saveFailed, true);
        }
      }).catch(function (e: any) {
        btn!.disabled = false;
        setSectionStatus('saveStatusNetworkInspector', String(e && e.message ? e.message : e), true);
      });
      return;
    }
    if (!api.remoteNetworkSetConfig) {
      btn!.disabled = false;
      setSectionStatus('saveStatusNetworkInspector', S.settings.niRemoteUnavailable, true);
      return;
    }
    var cfg = {
      enabled: boolFromToggle('optNetworkInspector'),
      mitmEnabled: true,
      mitmPort: el('niMitmPort') ? parseInt(el('niMitmPort').value, 10) || 8888 : 8888
    };
    api.remoteNetworkSetConfig(place, cfg).then(function (res: any) {
      btn!.disabled = false;
      if (res && res.success) {
        setSectionStatus('saveStatusNetworkInspector', S.settings.niSavedRemote, false);
      } else {
        setSectionStatus('saveStatusNetworkInspector', (res && res.error) || S.settings.niRemoteSaveFailed, true);
      }
    }).catch(function (e: any) {
      btn!.disabled = false;
      setSectionStatus('saveStatusNetworkInspector', String(e && e.message ? e.message : e), true);
    });
  });
})();

var headerClose = el('btnHeaderClose');
if (headerClose) {
  headerClose.addEventListener('click', function () {
    requestCloseSettingsWindow();
  });
}
document.addEventListener('keydown', function (e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  if (isNiSetupOpen()) {
    closeNiSetup();
    return;
  }
  if (isNiCaOpen()) {
    closeNiCa();
    return;
  }
  requestCloseSettingsWindow();
});

setInterval(function () {
  var panel = document.querySelector('.settings-panel[data-section="network-inspector"]');
  if (panel && panel.classList.contains('active')) refreshNiPortConflict();
}, 5000);

(window as any).requestCloseSettingsWindow = requestCloseSettingsWindow;
(window as any).rdsNavigateSettingsSection = function (id: string) {
  if (id) { try { selectSection(id); } catch (e) {} }
};

try { initSideloadRelaySection(); } catch (e) {}

if (INITIAL_SECTION) {
  try { selectSection(INITIAL_SECTION); } catch (e) {}
}
animateOpen();
