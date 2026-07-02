/**
 * Shared detail-pane surface for the Network Inspector — used by BOTH the live tab
 * (`network-tab.ts`) and the standalone Session Viewer (`network-session-viewer.ts`).
 *
 * It single-sources two things that were previously copy-pasted between the two windows:
 *   - {@link DETAIL_PANE_HTML}: the request/response two-pane markup (identical in both).
 *   - {@link wireDetailInteractions}: the delegated click dispatch (tabs, wrap, copy, cURL/HAR,
 *     URL modal, embedded JSON/XML modal, copy-menu toggle).
 *
 * Each window keeps its OWN `renderDetail` orchestration — the live tab layers on lazy on-disk
 * detail loading, find bars, large-body badges and a repaint-skip signature, none of which the
 * offline viewer needs — so this module deliberately owns only the parts that are truly identical.
 */
import type { RequestPaneTab, ResponsePaneTab } from './network-detail.js';

/** The `.ni-inspector-pane` request/response markup. Inject into a host element, then query the
 *  `[data-ni-*]` hooks from it. Kept byte-for-byte in sync with the CSS contracts in index.html. */
export const DETAIL_PANE_HTML = `
  <div class="ni-inspector-empty">Select a session to inspect request and response.</div>
  <div class="ni-contents-split">
    <div class="ni-contents-pane" data-ni-request-pane>
      <div class="ni-contents-pane-head">
        <div class="ni-pane-head-left">
          <div class="ni-contents-label">Request</div>
          <div class="ni-pane-tabs" data-ni-pane-tabs="request">
            <button type="button" class="ni-pane-tab active" data-ni-req-tab="overview">Overview</button>
            <button type="button" class="ni-pane-tab" data-ni-req-tab="body">Body</button>
          </div>
          <div class="ni-copy-menu" data-ni-copy-menu>
            <button type="button" class="ni-pane-tool-btn ni-copy-main" data-ni-copy="request" title="Copy request body" aria-label="Copy request body">
              <span class="icon icon-xs"><svg><use href="#icon-copy"/></svg></span>
            </button>
            <button type="button" class="ni-pane-tool-btn ni-copy-caret" data-ni-copy-menu-toggle title="More copy options" aria-haspopup="true" aria-expanded="false" aria-label="More copy options" hidden>
              <span class="icon icon-xs"><svg><use href="#icon-chevron-down"/></svg></span>
            </button>
            <div class="ni-copy-dropdown" data-ni-copy-dropdown role="menu" hidden>
              <button type="button" class="ni-copy-dropdown-item" data-ni-copy-item="body" role="menuitem">
                <span class="ni-copy-item-icon icon icon-xs"><svg><use href="#icon-copy"/></svg></span>Copy Body
              </button>
              <button type="button" class="ni-copy-dropdown-item" data-ni-copy-item="curl" role="menuitem">
                <span class="ni-copy-item-icon icon icon-xs"><svg><use href="#icon-terminal"/></svg></span>Copy as cURL
              </button>
              <button type="button" class="ni-copy-dropdown-item" data-ni-copy-item="har" role="menuitem">
                <span class="ni-copy-item-icon icon icon-xs"><svg><use href="#icon-download"/></svg></span>Copy as HAR
              </button>
            </div>
          </div>
        </div>
        <span class="ni-pane-badges">
          <span class="ni-pane-badge ni-pane-badge--truncated" data-ni-req-truncated hidden title="The captured copy of this body exceeded the inspector's display cap, so what's shown here is incomplete. The full body was still delivered upstream. Use Copy for the captured portion.">Body Truncated</span>
        </span>
        <div class="ni-pane-head-right" data-ni-req-format-wrap hidden>
          <button type="button" class="ni-pane-tool-btn is-active" data-ni-wrap-toggle="request" title="Disable word wrap" aria-pressed="true" aria-label="Toggle word wrap">
            <span class="icon icon-xs"><svg><use href="#icon-wrap-text"/></svg></span>
          </button>
          <div class="ni-pane-head-format">
            <label class="ni-body-format-label">Format</label>
            <select class="ni-body-format-select" data-ni-body-format="request">
              <option value="auto" selected>Auto</option>
              <option value="json">JSON</option>
              <option value="xml">XML</option>
              <option value="raw">Raw</option>
            </select>
            <button type="button" class="ni-pane-tool-btn ni-format-info-btn" data-ni-req-format-info hidden title="Why is this shown as raw text?" aria-label="Why is this shown as raw text?">
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
          <div class="ni-contents-label">Response</div>
          <div class="ni-pane-tabs" data-ni-pane-tabs="response">
            <button type="button" class="ni-pane-tab active" data-ni-res-tab="headers">Headers</button>
            <button type="button" class="ni-pane-tab" data-ni-res-tab="body">Body</button>
          </div>
          <button type="button" class="ni-pane-tool-btn" data-ni-copy="response" title="Copy response body" aria-label="Copy response body">
            <span class="icon icon-xs"><svg><use href="#icon-copy"/></svg></span>
          </button>
        </div>
        <span class="ni-pane-badges">
          <span class="ni-pane-badge ni-pane-badge--truncated" data-ni-res-truncated hidden title="The captured copy of this body exceeded the inspector's display cap, so what's shown here is incomplete. The full body was still delivered to the Roku. Use Copy for the captured portion.">Body Truncated</span>
        </span>
        <div class="ni-pane-head-right" data-ni-res-format-wrap hidden>
          <button type="button" class="ni-pane-tool-btn is-active" data-ni-wrap-toggle="response" title="Disable word wrap" aria-pressed="true" aria-label="Toggle word wrap">
            <span class="icon icon-xs"><svg><use href="#icon-wrap-text"/></svg></span>
          </button>
          <div class="ni-pane-head-format">
            <label class="ni-body-format-label">Format</label>
            <select class="ni-body-format-select" data-ni-body-format="response">
              <option value="auto" selected>Auto</option>
              <option value="json">JSON</option>
              <option value="xml">XML</option>
              <option value="raw">Raw</option>
            </select>
            <button type="button" class="ni-pane-tool-btn ni-format-info-btn" data-ni-res-format-info hidden title="Why is this shown as raw text?" aria-label="Why is this shown as raw text?">
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
