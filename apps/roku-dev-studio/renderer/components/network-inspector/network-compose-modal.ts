/**
 * Compose (Edit & Resend) modal for the Network Inspector. Pre-fills method/URL/query-params/
 * headers/body from a captured transaction, lets the user tweak them, and re-issues the request
 * FROM THE RDS HOST via `networkInspectorReplayRequest`. The result is injected as a new "Replayed"
 * row on the existing capture-events channel; this modal stays OPEN after Send (inline status) so the
 * user can iterate and resend. Follows the traffic-rules-modal pattern: `.modal-overlay.active` +
 * attachBackdropClickToClose + Escape + document.body.appendChild + inline S.* interpolation.
 *
 * Query params + headers are edited as name/value TABLES (fixed-height, internally scrolling). The
 * params table stays two-way synced with the URL field (params are folded into the URL query on any
 * edit / before Send); the headers table serializes back into the same `headers` Record the old
 * free-text textarea produced, so the replay payload shape is unchanged.
 */
import type { ParsedNetworkEvent, ReplayHttpInput } from '@shared/network-inspector/types.js';
import { escapeHtml } from '../../modules/utils/dom.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';
import { S } from '@shared/strings/index.js';
import { buildReplayInputFromEvent } from './network-export.js';
import { prettyXml, prettyXmlLenient } from '../../modules/ui/structured-body.js';

type RokuApi = {
  networkInspectorReplayRequest?: (payload: {
    deviceIp: string;
    input: ReplayHttpInput;
    applyTrafficRules?: boolean;
    timeoutMs?: number;
  }) => Promise<{ success?: boolean; event?: { id?: string }; error?: string }>;
  remoteNetworkReplayRequest?: (
    serverUrl: string,
    payload: { deviceIp: string; input: ReplayHttpInput; applyTrafficRules?: boolean; timeoutMs?: number }
  ) => Promise<{ success?: boolean; event?: { id?: string }; error?: string }>;
};

// HTTP method tokens — protocol values, not catalog strings.
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

/**
 * An editable name/value row's data (used for both the query-params and headers tables). `enabled`
 * is the Postman-style include/exclude toggle: a disabled row stays visible in the table but is
 * excluded from the sent URL query / headers.
 */
type KvPair = { name: string; value: string; enabled: boolean };

/** Percent-decode a query token (`+` → space), tolerating malformed input. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

/**
 * Split a URL into `base` (scheme+host+path), the raw `query` (no leading `?`) and `hash` (with its
 * leading `#`). Parsed manually — not via `new URL()` — so a partial/invalid URL mid-typing still
 * round-trips through the params table.
 */
function splitUrl(url: string): { base: string; query: string; hash: string } {
  let rest = url;
  let hash = '';
  const h = rest.indexOf('#');
  if (h >= 0) {
    hash = rest.slice(h);
    rest = rest.slice(0, h);
  }
  let query = '';
  const q = rest.indexOf('?');
  if (q >= 0) {
    query = rest.slice(q + 1);
    rest = rest.slice(0, q);
  }
  return { base: rest, query, hash };
}

/** Parse a raw query string into decoded name/value pairs (order + duplicate keys preserved). */
function queryToPairs(query: string): KvPair[] {
  const out: KvPair[] = [];
  for (const part of query.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const name = eq >= 0 ? part.slice(0, eq) : part;
    const value = eq >= 0 ? part.slice(eq + 1) : '';
    out.push({ name: safeDecode(name), value: safeDecode(value), enabled: true });
  }
  return out;
}

/**
 * Serialize name/value pairs into an encoded query string; disabled rows and rows with an empty
 * name are dropped (so only enabled params reach the sent URL).
 */
function pairsToQuery(pairs: KvPair[]): string {
  return pairs
    .filter((p) => p.enabled && p.name.trim() !== '')
    .map((p) => `${encodeURIComponent(p.name.trim())}=${encodeURIComponent(p.value)}`)
    .join('&');
}

/** Rebuild a full URL, replacing its query with `query` while keeping the base + hash. */
function rebuildUrl(url: string, query: string): string {
  const { base, hash } = splitUrl(url);
  return `${base}${query ? `?${query}` : ''}${hash}`;
}

/** Header record → name/value pairs for the editable headers table. */
function headersToPairs(headers: Record<string, string> | undefined): KvPair[] {
  if (!headers) return [];
  return Object.entries(headers).map(([name, value]) => ({ name, value, enabled: true }));
}

/**
 * Name/value pairs → header record. Matches the old textarea parse exactly (name trimmed, empty
 * names dropped, later duplicates overwrite earlier ones) so the replay payload's `headers` shape
 * is byte-for-byte unchanged. Disabled rows are excluded (they stay visible but aren't sent).
 */
function pairsToHeaders(pairs: KvPair[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { name, value, enabled } of pairs) {
    if (!enabled) continue;
    const key = name.trim();
    if (key) out[key] = value.trim();
  }
  return out;
}

/** Case-insensitive `content-type` header lookup (lowercased value, or '' when absent). */
function contentTypeOf(headers: Record<string, string> | undefined): string {
  if (!headers) return '';
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === 'content-type') return v.toLowerCase();
  }
  return '';
}

/**
 * Pretty-print the request body for editing, based on its content-type: JSON is reparsed + 2-space
 * indented; XML/HTML runs through the shared XML pretty-printer (strict, then lenient fallback).
 * Anything else — or content that won't parse/format — is returned unchanged. Safe to reformat:
 * JSON/XML whitespace is insignificant, so the resent request stays semantically identical.
 */
function formatBodyForEditing(body: string, contentType: string): string {
  const trimmed = body.trim();
  if (!trimmed) return body;
  if (contentType.includes('json') || /^[[{]/.test(trimmed)) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  if (contentType.includes('xml') || contentType.includes('html') || trimmed.startsWith('<')) {
    return prettyXml(body) ?? prettyXmlLenient(body);
  }
  return body;
}

/**
 * One editable name/value row (shared by the params + headers tables). A leading checkbox toggles
 * whether the row is included in what's sent (Postman-style); unchecked rows stay visible.
 */
function kvRowHtml(pair: KvPair, namePlaceholder: string): string {
  return `<div class="ni-kv-row" data-kv-row>
      <input type="checkbox" class="ni-kv-enabled" data-kv-enabled${pair.enabled ? ' checked' : ''} aria-label="${S.networkInspector.composeRowEnabledAria}" title="${S.networkInspector.composeRowEnabledAria}" />
      <input type="text" class="ni-rules-ct ni-kv-name" data-kv-name value="${escapeHtml(pair.name)}" placeholder="${namePlaceholder}" spellcheck="false" autocomplete="off" />
      <input type="text" class="ni-rules-ct ni-kv-value" data-kv-value value="${escapeHtml(pair.value)}" placeholder="${S.networkInspector.rwValue}" spellcheck="false" autocomplete="off" />
    </div>`;
}

/**
 * Open the Compose (Edit & Resend) modal for a captured request. Prefills from
 * {@link buildReplayInputFromEvent}. On Send it re-issues the request from the host and — on success —
 * calls `onSent(newEventId)` so the caller can select the injected row, while keeping the modal open.
 */
export async function openComposeModal(opts: {
  event: ParsedNetworkEvent;
  deviceIp: string;
  onSent?: (eventId: string) => void;
  /** Set when this device panel is backed by a remote-server device (see createApiAdapter in
   *  renderer/app.ts) — routes the resend through the remote server instead of the local engine. */
  isRemote?: boolean;
  serverUrl?: string | null;
}): Promise<void> {
  const api = (window as unknown as { roku?: RokuApi }).roku;
  const isRemote = !!(opts.isRemote && opts.serverUrl);
  const prefill = buildReplayInputFromEvent(opts.event);
  const isBinary = prefill.bodyEncoding === 'base64';
  const currentMethod = (prefill.method || 'GET').toUpperCase();
  // A non-standard captured method is added so it isn't silently changed on resend.
  const extraMethod = (HTTP_METHODS as readonly string[]).includes(currentMethod)
    ? ''
    : `<option value="${escapeHtml(currentMethod)}" selected>${escapeHtml(currentMethod)}</option>`;
  const methodOptions = HTTP_METHODS.map(
    (m) => `<option value="${m}"${m === currentMethod ? ' selected' : ''}>${m}</option>`
  ).join('');

  const initialParams = queryToPairs(splitUrl(prefill.url || '').query);
  const initialHeaders = headersToPairs(prefill.headers);
  const paramsRowsHtml = initialParams.map((p) => kvRowHtml(p, S.networkInspector.rwParamName)).join('');
  const headersRowsHtml = initialHeaders.map((h) => kvRowHtml(h, S.networkInspector.rwHeaderName)).join('');
  // Auto pretty-print the prefilled body by content-type (JSON/XML); binary bodies stay empty/read-only.
  const bodyText = isBinary ? '' : formatBodyForEditing(prefill.body || '', contentTypeOf(prefill.headers));

  const overlay = document.createElement('div');
  // `.modal-overlay` is display:none until `.active` is added.
  overlay.className = 'modal-overlay ni-compose-overlay active';
  overlay.innerHTML = `
    <div class="ni-rules-modal ni-compose-modal" role="dialog" aria-modal="true" aria-label="${S.networkInspector.composeTitle}">
      <div class="ni-rules-header">
        <div class="ni-rules-header-info">
          <h3 class="ni-rules-title">${S.networkInspector.composeTitle}</h3>
          <div class="ni-rules-device-line">
            <span class="ni-rules-device-dot" aria-hidden="true"></span>
            <span class="ni-rules-device-ip device-ip">${escapeHtml(opts.deviceIp || '')}</span>
          </div>
        </div>
        <button type="button" class="modal-close ni-compose-close" title="${S.common.close}" aria-label="${S.common.close}"><span class="icon icon-sm"><svg><use href="#icon-x"/></svg></span></button>
      </div>
      <div class="ni-compose-top">
        <p class="ni-rules-note">${S.networkInspector.composeNote}</p>
        <div class="ni-kv-table ni-compose-method-url">
          <div class="ni-kv-head">
            <span class="ni-kv-head-method">${S.networkInspector.composeMethodLabel}</span>
            <span class="ni-kv-head-url">${S.networkInspector.composeUrlLabel}</span>
          </div>
          <div class="ni-compose-mu-row">
            <select class="ni-rules-select ni-compose-method" id="niComposeMethod" data-compose-method aria-label="${S.networkInspector.composeMethodLabel}">${extraMethod}${methodOptions}</select>
            <input type="text" class="ni-rules-ct ni-compose-url" id="niComposeUrl" data-compose-url value="${escapeHtml(prefill.url || '')}" spellcheck="false" autocomplete="off" aria-label="${S.networkInspector.composeUrlLabel}" />
          </div>
        </div>
      </div>
      <div class="ni-rules-body">
        <div class="ni-rules-field">
          <div class="ni-kv-table ni-compose-params">
            <div class="ni-kv-head">
              <input type="checkbox" class="ni-kv-head-select" data-compose-params-select aria-label="${S.networkInspector.composeSelectAllAria}" title="${S.networkInspector.composeSelectAllAria}" />
              <span class="ni-kv-head-title">${S.networkInspector.composeParamsLabel}</span>
              <button type="button" class="btn btn-secondary btn-sm ni-kv-add" data-compose-params-add>${S.networkInspector.composeAddRow}</button>
            </div>
            <div class="ni-kv-scroll" data-compose-params-rows>${paramsRowsHtml}</div>
          </div>
        </div>
        <div class="ni-rules-field">
          <div class="ni-kv-table ni-compose-headers">
            <div class="ni-kv-head">
              <input type="checkbox" class="ni-kv-head-select" data-compose-headers-select aria-label="${S.networkInspector.composeSelectAllAria}" title="${S.networkInspector.composeSelectAllAria}" />
              <span class="ni-kv-head-title">${S.networkInspector.composeHeadersLabel}</span>
              <button type="button" class="btn btn-secondary btn-sm ni-kv-add" data-compose-headers-add>${S.networkInspector.composeAddRow}</button>
            </div>
            <div class="ni-kv-scroll" data-compose-headers-rows>${headersRowsHtml}</div>
          </div>
        </div>
        <div class="ni-rules-field">
          <label class="ni-rules-field-label" for="niComposeBody">${S.networkInspector.composeBodyLabel}</label>
          <textarea class="ni-compose-textarea" id="niComposeBody" data-compose-body rows="6" spellcheck="false" autocomplete="off" placeholder="${S.networkInspector.composeBodyPlaceholder}"${isBinary ? ' readonly' : ''}>${escapeHtml(bodyText)}</textarea>
          ${isBinary ? `<p class="ni-compose-binary-note">${S.networkInspector.composeBinaryBodyNote}</p>` : ''}
        </div>
      </div>
      <div class="ni-rules-footer">
        <label class="ni-compose-apply" title="${S.networkInspector.composeApplyRulesTitle}">
          <input type="checkbox" data-compose-apply-rules /> ${S.networkInspector.composeApplyRules}
        </label>
        <span class="ni-rules-status ni-compose-status" data-compose-status aria-live="polite"></span>
        <button type="button" class="btn btn-secondary" data-compose-cancel>${S.common.cancel}</button>
        <button type="button" class="btn btn-primary ni-compose-send" data-compose-send>
          <span class="icon icon-xs"><svg><use href="#icon-send"/></svg></span>${S.networkInspector.composeSend}
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const statusEl = overlay.querySelector('[data-compose-status]') as HTMLElement | null;
  const setStatus = (text: string, isError = false): void => {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle('is-error', isError);
  };

  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  attachBackdropClickToClose(overlay, close);
  overlay.querySelector('.ni-compose-close')?.addEventListener('click', close);
  overlay.querySelector('[data-compose-cancel]')?.addEventListener('click', close);

  const urlEl = overlay.querySelector('[data-compose-url]') as HTMLInputElement | null;
  const paramsRows = overlay.querySelector('[data-compose-params-rows]') as HTMLElement | null;
  const headersRows = overlay.querySelector('[data-compose-headers-rows]') as HTMLElement | null;

  /** Read a table's current rows into name/value pairs (DOM order preserved). */
  const readPairs = (container: HTMLElement | null): KvPair[] => {
    if (!container) return [];
    return Array.from(container.querySelectorAll('[data-kv-row]')).map((row) => ({
      name: (row.querySelector('[data-kv-name]') as HTMLInputElement | null)?.value ?? '',
      value: (row.querySelector('[data-kv-value]') as HTMLInputElement | null)?.value ?? '',
      enabled: (row.querySelector('[data-kv-enabled]') as HTMLInputElement | null)?.checked ?? true
    }));
  };

  // Params table is the source of truth for the query part: fold it into the URL on any param edit.
  const syncUrlFromParams = (): void => {
    if (!urlEl) return;
    urlEl.value = rebuildUrl(urlEl.value, pairsToQuery(readPairs(paramsRows)));
  };
  // ...and rebuild the params table when the URL's own query is edited directly. Assigning
  // `urlEl.value` above fires no `input` event, so these two directions can't loop.
  const syncParamsFromUrl = (): void => {
    if (!urlEl || !paramsRows) return;
    paramsRows.innerHTML = queryToPairs(splitUrl(urlEl.value).query)
      .map((p) => kvRowHtml(p, S.networkInspector.rwParamName))
      .join('');
  };

  /**
   * Wire a name/value table's add/remove/input behaviour plus its header master (select-all) checkbox.
   * `onChange` runs after any mutation. Returns a `refreshMaster` fn so callers that rebuild the rows
   * out-of-band (e.g. the URL→params sync) can re-sync the master's tri-state afterwards.
   */
  const wireKvTable = (
    rows: HTMLElement | null,
    addBtn: Element | null,
    masterEl: HTMLInputElement | null,
    namePlaceholder: string,
    onChange?: () => void
  ): (() => void) => {
    if (!rows) return () => {};
    // Reflect the rows' enabled state onto the master: checked when ALL rows are on, unchecked when
    // NONE, indeterminate when mixed (or when there are no rows).
    const refreshMaster = (): void => {
      if (!masterEl) return;
      const boxes = Array.from(
        rows.querySelectorAll('[data-kv-enabled]')
      ) as HTMLInputElement[];
      const on = boxes.filter((b) => b.checked).length;
      masterEl.checked = boxes.length > 0 && on === boxes.length;
      masterEl.indeterminate = on > 0 && on < boxes.length;
    };
    // Typing in a name/value input OR toggling a row's enable checkbox re-runs `onChange` (checkbox
    // input fires here too) so the URL preview reflects only enabled params. Disabled rows aren't
    // removed from the DOM — they persist in the table until the user re-enables them. A row toggle
    // also re-syncs the master's tri-state.
    rows.addEventListener('input', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-kv-name], [data-kv-value], [data-kv-enabled]')) onChange?.();
      if (target.closest('[data-kv-enabled]')) refreshMaster();
    });
    // Clicking the master sets every row checkbox to its new value, then runs the same downstream
    // update a single row toggle would (URL sync for params), then re-reads its own tri-state.
    masterEl?.addEventListener('change', () => {
      const next = masterEl.checked;
      rows.querySelectorAll('[data-kv-enabled]').forEach((b) => {
        (b as HTMLInputElement).checked = next;
      });
      onChange?.();
      refreshMaster();
    });
    addBtn?.addEventListener('click', () => {
      rows.insertAdjacentHTML('beforeend', kvRowHtml({ name: '', value: '', enabled: true }, namePlaceholder));
      const nameInput = rows.querySelector(
        '[data-kv-row]:last-child [data-kv-name]'
      ) as HTMLInputElement | null;
      nameInput?.focus();
      onChange?.();
      refreshMaster();
    });
    refreshMaster(); // initial tri-state on modal open
    return refreshMaster;
  };

  const refreshParamsMaster = wireKvTable(
    paramsRows,
    overlay.querySelector('[data-compose-params-add]'),
    overlay.querySelector('[data-compose-params-select]'),
    S.networkInspector.rwParamName,
    syncUrlFromParams
  );
  wireKvTable(
    headersRows,
    overlay.querySelector('[data-compose-headers-add]'),
    overlay.querySelector('[data-compose-headers-select]'),
    S.networkInspector.rwHeaderName
  );
  // Editing the URL rebuilds the params rows wholesale (all re-enabled) — re-sync the params master.
  urlEl?.addEventListener('input', () => {
    syncParamsFromUrl();
    refreshParamsMaster();
  });

  const send = async (): Promise<void> => {
    const methodEl = overlay.querySelector('[data-compose-method]') as HTMLSelectElement | null;
    const bodyEl = overlay.querySelector('[data-compose-body]') as HTMLTextAreaElement | null;
    const applyEl = overlay.querySelector('[data-compose-apply-rules]') as HTMLInputElement | null;

    // Params table is authoritative for the query — fold it into the URL before validating/sending.
    syncUrlFromParams();
    const url = (urlEl?.value || '').trim();
    let validUrl = false;
    try {
      const parsed = new URL(url);
      validUrl = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      validUrl = false;
    }
    if (!validUrl) {
      setStatus(S.networkInspector.replayInvalidUrl, true);
      return;
    }
    if (isRemote ? !api?.remoteNetworkReplayRequest : !api?.networkInspectorReplayRequest) {
      setStatus(S.networkInspector.replayUnavailable, true);
      return;
    }

    const input: ReplayHttpInput = {
      method: (methodEl?.value || 'GET').toUpperCase(),
      url,
      headers: pairsToHeaders(readPairs(headersRows))
    };
    if (isBinary) {
      // Binary body is sent unchanged (the textarea is read-only) — keep the original captured bytes.
      if (prefill.body) {
        input.body = prefill.body;
        input.bodyEncoding = 'base64';
      }
    } else {
      const text = bodyEl?.value ?? '';
      if (text) {
        input.body = text;
        input.bodyEncoding = 'text';
      }
    }

    const sendBtn = overlay.querySelector('[data-compose-send]') as HTMLButtonElement | null;
    if (sendBtn) sendBtn.disabled = true;
    setStatus(S.networkInspector.composeSending);
    try {
      const replayPayload = {
        deviceIp: opts.deviceIp,
        input,
        applyTrafficRules: applyEl?.checked === true
      };
      const res = isRemote
        ? await api?.remoteNetworkReplayRequest?.(opts.serverUrl as string, replayPayload)
        : await api?.networkInspectorReplayRequest?.(replayPayload);
      if (res?.success && res.event?.id) {
        setStatus(S.networkInspector.replayAddedToList);
        opts.onSent?.(res.event.id);
      } else {
        setStatus(S.networkInspector.replayFailed(res?.error || ''), true);
      }
    } catch (err) {
      setStatus(S.networkInspector.replayFailed(err instanceof Error ? err.message : String(err)), true);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  };

  overlay.querySelector('[data-compose-send]')?.addEventListener('click', () => void send());
  (overlay.querySelector('[data-compose-url]') as HTMLInputElement | null)?.focus();
}
