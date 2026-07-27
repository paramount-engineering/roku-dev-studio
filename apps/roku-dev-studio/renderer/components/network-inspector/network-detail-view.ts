/**
 * Shared detail-pane surface for the Network Inspector — used by BOTH the live tab
 * (`network-tab.ts`) and the standalone Session Viewer (`network-session-viewer.ts`).
 *
 * It single-sources two things that were previously copy-pasted between the two windows:
 *   - {@link detailPaneHtml}: the request/response two-pane markup (identical in both).
 *   - {@link wireDetailInteractions}: the delegated click dispatch (tabs, wrap, copy, cURL/HAR,
 *     URL modal, embedded JSON/XML modal, copy-menu toggle).
 *
 * Each window keeps its OWN `renderDetail` orchestration — the live tab layers on lazy on-disk
 * detail loading, find bars, large-body badges and a repaint-skip signature, none of which the
 * offline viewer needs — so this module deliberately owns only the parts that are truly identical.
 */
import type { RequestPaneTab, ResponsePaneTab } from './network-detail.js';
import { S } from '@shared/strings/index.js';

/** The `.ni-inspector-pane` request/response markup. Inject into a host element, then query the
 *  `[data-ni-*]` hooks from it. Kept byte-for-byte in sync with the CSS contracts in index.html.
 *  A FUNCTION (not a const) so the embedded `S.networkInspector.*` labels read from the ACTIVE
 *  locale each time the pane is (re)injected — a const would freeze the startup locale. */
export const detailPaneHtml = (): string => `
  <div class="ni-inspector-empty">${S.networkInspector.emptyDetail}</div>
  <div class="ni-contents-split">
    <div class="ni-contents-pane" data-ni-request-pane>
      <div class="ni-contents-pane-head">
        <div class="ni-pane-head-left">
          <div class="ni-contents-label">${S.networkInspector.request}</div>
          <div class="ni-pane-tabs" data-ni-pane-tabs="request">
            <button type="button" class="ni-pane-tab active" data-ni-req-tab="overview">${S.networkInspector.tabOverview}</button>
            <button type="button" class="ni-pane-tab" data-ni-req-tab="body">${S.networkInspector.tabBody}</button>
          </div>
          <div class="ni-copy-menu" data-ni-copy-menu>
            <button type="button" class="ni-pane-tool-btn ni-copy-main" data-ni-copy="request" title="${S.networkInspector.copyRequestBody}" aria-label="${S.networkInspector.copyRequestBody}">
              <span class="icon icon-xs"><svg><use href="#icon-copy"/></svg></span>
            </button>
            <button type="button" class="ni-pane-tool-btn ni-copy-caret" data-ni-copy-menu-toggle title="${S.networkInspector.moreCopyOptions}" aria-haspopup="true" aria-expanded="false" aria-label="${S.networkInspector.moreCopyOptions}" hidden>
              <span class="icon icon-xs"><svg><use href="#icon-chevron-down"/></svg></span>
            </button>
            <div class="ni-copy-dropdown" data-ni-copy-dropdown role="menu" hidden>
              <button type="button" class="ni-copy-dropdown-item" data-ni-copy-item="body" role="menuitem">
                <span class="ni-copy-item-icon icon icon-xs"><svg><use href="#icon-copy"/></svg></span>${S.networkInspector.copyBody}
              </button>
              <button type="button" class="ni-copy-dropdown-item" data-ni-copy-item="curl" role="menuitem">
                <span class="ni-copy-item-icon icon icon-xs"><svg><use href="#icon-terminal"/></svg></span>${S.networkInspector.copyAsCurl}
              </button>
              <button type="button" class="ni-copy-dropdown-item" data-ni-copy-item="har" role="menuitem">
                <span class="ni-copy-item-icon icon icon-xs"><svg><use href="#icon-download"/></svg></span>${S.networkInspector.copyAsHar}
              </button>
            </div>
          </div>
        </div>
        <span class="ni-pane-badges">
          <span class="ni-pane-badge ni-pane-badge--truncated" data-ni-req-truncated hidden title="${S.networkInspector.bodyTruncatedRequestTitle}">${S.networkInspector.bodyTruncated}</span>
        </span>
        <div class="ni-pane-head-right" data-ni-req-format-wrap hidden>
          <button type="button" class="ni-pane-tool-btn is-active" data-ni-wrap-toggle="request" title="${S.networkInspector.disableWordWrap}" aria-pressed="true" aria-label="${S.networkInspector.toggleWordWrap}">
            <span class="icon icon-xs"><svg><use href="#icon-wrap-text"/></svg></span>
          </button>
          <div class="ni-pane-head-format">
            <label class="ni-body-format-label">${S.networkInspector.formatLabel}</label>
            <select class="ni-body-format-select" data-ni-body-format="request">
              <option value="auto" selected>${S.networkInspector.formatAuto}</option>
              <option value="json">${S.networkInspector.formatJson}</option>
              <option value="xml">${S.networkInspector.formatXml}</option>
              <option value="raw">${S.networkInspector.formatRaw}</option>
            </select>
            <button type="button" class="ni-pane-tool-btn ni-format-info-btn" data-ni-req-format-info hidden title="${S.networkInspector.whyRawText}" aria-label="${S.networkInspector.whyRawText}">
              <span class="icon icon-xs"><svg><use href="#icon-info"/></svg></span>
            </button>
          </div>
        </div>
      </div>
      <div class="ni-contents-scroll" data-ni-request-body tabindex="0"></div>
    </div>
    <div class="ni-contents-pane" data-ni-response-pane>
      <div class="ni-contents-pane-head">
        <div class="ni-pane-head-left">
          <div class="ni-contents-label">${S.networkInspector.response}</div>
          <div class="ni-pane-tabs" data-ni-pane-tabs="response">
            <button type="button" class="ni-pane-tab active" data-ni-res-tab="headers">${S.networkInspector.tabHeaders}</button>
            <button type="button" class="ni-pane-tab" data-ni-res-tab="body">${S.networkInspector.tabBody}</button>
          </div>
          <button type="button" class="ni-pane-tool-btn" data-ni-copy="response" title="${S.networkInspector.copyResponseBody}" aria-label="${S.networkInspector.copyResponseBody}">
            <span class="icon icon-xs"><svg><use href="#icon-copy"/></svg></span>
          </button>
        </div>
        <span class="ni-pane-badges">
          <span class="ni-pane-badge ni-pane-badge--truncated" data-ni-res-truncated hidden title="${S.networkInspector.bodyTruncatedResponseTitle}">${S.networkInspector.bodyTruncated}</span>
        </span>
        <div class="ni-pane-head-right" data-ni-res-format-wrap hidden>
          <button type="button" class="ni-pane-tool-btn is-active" data-ni-wrap-toggle="response" title="${S.networkInspector.disableWordWrap}" aria-pressed="true" aria-label="${S.networkInspector.toggleWordWrap}">
            <span class="icon icon-xs"><svg><use href="#icon-wrap-text"/></svg></span>
          </button>
          <div class="ni-pane-head-format">
            <label class="ni-body-format-label">${S.networkInspector.formatLabel}</label>
            <select class="ni-body-format-select" data-ni-body-format="response">
              <option value="auto" selected>${S.networkInspector.formatAuto}</option>
              <option value="json">${S.networkInspector.formatJson}</option>
              <option value="xml">${S.networkInspector.formatXml}</option>
              <option value="raw">${S.networkInspector.formatRaw}</option>
            </select>
            <button type="button" class="ni-pane-tool-btn ni-format-info-btn" data-ni-res-format-info hidden title="${S.networkInspector.whyRawText}" aria-label="${S.networkInspector.whyRawText}">
              <span class="icon icon-xs"><svg><use href="#icon-info"/></svg></span>
            </button>
          </div>
        </div>
      </div>
      <div class="ni-contents-scroll" data-ni-response-body tabindex="0"></div>
    </div>
  </div>
`;

/** Callbacks the shared click dispatch invokes. Each window supplies its own implementations
 *  (the live tab loads detail before exporting; the viewer already holds inlined bodies). */
export type DetailInteractionHandlers = {
  onUrl: (anchor: HTMLElement, url: string) => void;
  onEmbedded: (anchor: HTMLElement, pane: 'request' | 'response', idx: number) => void;
  onCopyMenuToggle: () => void;
  /** A dropdown item: `kind` is 'body' | 'curl' | 'har'. */
  onCopyItem: (item: HTMLElement, kind: string) => void;
  onCopyBody: (btn: HTMLElement, which: 'request' | 'response') => void;
  onToggleWrap: (which: 'request' | 'response') => void;
  onSetRequestTab: (tab: RequestPaneTab) => void;
  onSetResponseTab: (tab: ResponsePaneTab) => void;
};

/**
 * Attach the delegated click dispatch to a detail-pane container. Behaviourally identical to the
 * live tab's original inline handler — extracted verbatim so both windows share one implementation.
 */
export function wireDetailInteractions(
  detailPane: HTMLElement,
  h: DetailInteractionHandlers,
  opts?: AddEventListenerOptions
): void {
  detailPane.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement | null;
      const urlBtn = target?.closest('[data-ni-url]') as HTMLElement | null;
      if (urlBtn?.dataset.niUrl) {
        e.preventDefault();
        h.onUrl(urlBtn, urlBtn.dataset.niUrl);
        return;
      }
      // JSON/XML embedded inside a raw text body → open the shared formatted viewer. Skip when the
      // user is selecting text (a drag), so highlighting a fragment to copy doesn't pop the modal.
      const embBtn = target?.closest('.ni-embedded-structured') as HTMLElement | null;
      if (embBtn?.dataset.niEmbIdx) {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) return;
        e.preventDefault();
        const pane = embBtn.closest('[data-ni-response-body]') ? 'response' : 'request';
        h.onEmbedded(embBtn, pane, parseInt(embBtn.dataset.niEmbIdx, 10));
        return;
      }
      const copyMenuToggle = target?.closest('[data-ni-copy-menu-toggle]') as HTMLElement | null;
      if (copyMenuToggle) {
        h.onCopyMenuToggle();
        return;
      }
      const copyItem = target?.closest('[data-ni-copy-item]') as HTMLElement | null;
      if (copyItem?.dataset.niCopyItem) {
        h.onCopyItem(copyItem, copyItem.dataset.niCopyItem);
        return;
      }
      const copyBtn = target?.closest('[data-ni-copy]') as HTMLElement | null;
      if (copyBtn?.dataset.niCopy) {
        h.onCopyBody(copyBtn, copyBtn.dataset.niCopy as 'request' | 'response');
        return;
      }
      const wrapBtn = target?.closest('[data-ni-wrap-toggle]') as HTMLElement | null;
      if (wrapBtn) {
        h.onToggleWrap(wrapBtn.dataset.niWrapToggle === 'response' ? 'response' : 'request');
        return;
      }
      const reqTabBtn = target?.closest('[data-ni-req-tab]') as HTMLElement | null;
      if (reqTabBtn?.dataset.niReqTab) {
        const tab = reqTabBtn.dataset.niReqTab as RequestPaneTab;
        if (tab === 'overview' || tab === 'body') h.onSetRequestTab(tab);
        return;
      }
      const resTabBtn = target?.closest('[data-ni-res-tab]') as HTMLElement | null;
      if (resTabBtn?.dataset.niResTab) {
        const tab = resTabBtn.dataset.niResTab as ResponsePaneTab;
        if (tab === 'headers' || tab === 'body') h.onSetResponseTab(tab);
      }
    },
    opts
  );
}

/**
 * Sync the per-pane word-wrap toggle buttons + body scrollers to the given wrap state. Shared by the
 * live Network tab and the offline Session Viewer so the button state — including the `title`, which
 * the viewer previously never updated (stale "Disable word wrap" tooltip) — stays consistent.
 * `root` is where the `[data-ni-wrap-toggle]` buttons are queried (the panel / document).
 */
export function syncBodyWrap(opts: {
  root: ParentNode;
  requestBodyEl: Element | null;
  responseBodyEl: Element | null;
  requestWrap: boolean;
  responseWrap: boolean;
}): void {
  (opts.requestBodyEl as HTMLElement | null)?.classList.toggle('ni-body-nowrap', !opts.requestWrap);
  (opts.responseBodyEl as HTMLElement | null)?.classList.toggle('ni-body-nowrap', !opts.responseWrap);
  opts.root.querySelectorAll('[data-ni-wrap-toggle]').forEach((btn) => {
    const el = btn as HTMLElement;
    const on = el.dataset.niWrapToggle === 'response' ? opts.responseWrap : opts.requestWrap;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
    el.title = on ? S.networkInspector.disableWordWrap : S.networkInspector.enableWordWrap;
  });
}
