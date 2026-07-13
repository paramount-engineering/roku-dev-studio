/**
 * Keyboard shortcuts for the telnet log viewers (live Console + log file viewer).
 *
 * Bindings:
 *   Cmd/Ctrl+F            → focus find input
 *   Cmd/Ctrl+G  /  F3     → Next Match
 *   Shift+Cmd/Ctrl+G  /  Shift+F3
 *                         → Previous Match
 *   Cmd/Ctrl+Alt+F        → toggle Find ⇄ Filter mode
 *   Cmd/Ctrl+A            → copy the entire log model to the clipboard (only
 *                           when `selectAllAction` is provided; otherwise the
 *                           native Cmd+A is left to the browser, which can
 *                           only select the virtualized window's DOM rows)
 *   Cmd/Ctrl+End  /  End  → scroll to bottom
 *   Cmd/Ctrl+Home /  Home → scroll to top
 *   Esc (in find input)   → clear query, then on second press blur back to viewer
 *                           (handled inside the find bar itself, not here)
 *
 * Scoping rules:
 *   - The listener is bound to `document` so it works whether or not the user has
 *     clicked into the viewer first (Electron windows often open with focus on
 *     <body> until the user interacts).
 *   - When `scopeEl` is provided we additionally check `scopeEl.offsetParent` and
 *     bail when the scope element is hidden (collapsed tab / panel switched
 *     away). This is important for the Console panel which lives alongside other
 *     panels in the main window — its shortcuts must not fire when a different
 *     panel is active.
 *   - We never intercept keystrokes targeted at unrelated `<input>`,
 *     `<textarea>`, or `[contenteditable]` elements (Fiddle's Monaco, the
 *     queries panel search box, etc.). The only exception is the find input
 *     itself, which is allowed because Cmd+G inside the find input still has
 *     to navigate matches.
 */

import type { ConsoleFindBarHandle } from './console-find-bar.js';

export type ViewerShortcutOpts = {
  findBar: ConsoleFindBarHandle | null;
  /** Scrolling container (`.telnet-output`). Used for End/Home; also the
   *  visibility check via `offsetParent`. */
  outputEl: HTMLElement;
  /** Optional element used to gate visibility of these shortcuts (defaults to
   *  `outputEl`). For the Console panel, set this to the panel's root element so
   *  switching away from the panel disables the shortcuts. */
  scopeEl?: HTMLElement;
  /** The find input — used to detect "is the user typing in the find input?"
   *  so Cmd+G works whether the input is focused or blurred. */
  findInputEl: HTMLInputElement | null;
  /**
   * Optional Cmd/Ctrl+A handler. Native Select-All on a virtualized log only
   * picks up the DOM rows currently in the visible window, so a subsequent
   * Copy silently truncates to whatever was on screen. Hook this to a
   * model-aware "copy entire log to clipboard" path (Log Viewer / Console
   * both expose one) and we replace the broken native behavior with a
   * deterministic full-buffer copy.
   *
   * Returns a status string for transient feedback (e.g. shown in the header
   * line-count area). Implementations can defer the real work — the
   * shortcut handler doesn't await the result.
   */
  selectAllAction?: () => string | void;
};

function isMacLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  // navigator.platform is technically deprecated but still the most reliable
  // signal in Electron renderers; Chrome's UA-CH alternatives are fine but
  // gated behind secure contexts that not all renderer sandboxes provide.
  return /Mac|iPhone|iPad/i.test(navigator.platform || '');
}

function isPrimaryModifier(e: KeyboardEvent): boolean {
  return isMacLike() ? e.metaKey : e.ctrlKey;
}

function isInForeignTextInput(target: EventTarget | null, allowFindInput: HTMLInputElement | null): boolean {
  if (!(target instanceof Element)) return false;
  if (allowFindInput && target === allowFindInput) return false;
  if (target instanceof HTMLInputElement) return target.type !== 'button' && target.type !== 'checkbox';
  if (target instanceof HTMLTextAreaElement) return true;
  if (target.closest('[contenteditable=""], [contenteditable="true"]')) return true;
  return false;
}

export function attachViewerShortcuts(opts: ViewerShortcutOpts): { dispose: () => void } {
  const scopeEl = opts.scopeEl ?? opts.outputEl;

  const onKeyDown = (e: KeyboardEvent): void => {
    // Visibility gate: panel hidden / collapsed → don't claim shortcuts.
    // `offsetParent` is null when the element or any ancestor is `display: none`.
    if (scopeEl.offsetParent === null) return;

    // Don't steal keystrokes from other inputs / Monaco / the queries search box.
    if (isInForeignTextInput(e.target, opts.findInputEl)) {
      // …with one carve-out: Cmd/Ctrl+G inside the find input itself is OK
      // because the find input's own keydown handler doesn't bind it.
      const isCmdG =
        isPrimaryModifier(e) && (e.key === 'g' || e.key === 'G');
      const isF3 = e.key === 'F3';
      if (!isCmdG && !isF3) return;
      if (e.target !== opts.findInputEl) return;
    }

    const fb = opts.findBar;
    const cmd = isPrimaryModifier(e);

    // Cmd/Ctrl+F → focus find input
    if (cmd && !e.altKey && !e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      if (!fb) return;
      e.preventDefault();
      fb.focusInput();
      return;
    }

    // Cmd/Ctrl+Alt+F → toggle Find ⇄ Filter
    if (cmd && e.altKey && !e.shiftKey && (e.key === 'f' || e.key === 'F' || e.key === '∫')) {
      // macOS substitutes Alt-letter glyphs (Cmd+Alt+F yields key === '∫').
      // Both branches must be handled to keep the shortcut working on Mac.
      if (!fb) return;
      e.preventDefault();
      fb.toggleMode();
      fb.focusInput();
      return;
    }

    // Cmd/Ctrl+G or F3 → next; with Shift → previous
    if ((cmd && (e.key === 'g' || e.key === 'G')) || e.key === 'F3') {
      if (!fb || fb.getMode() !== 'find') return;
      e.preventDefault();
      if (e.shiftKey) fb.searchPrev();
      else fb.searchNext();
      return;
    }

    // Cmd/Ctrl+A → copy whole log to clipboard, *only* when the caller wired
    // `selectAllAction`. The native browser Cmd+A would select what's in the
    // DOM (the virtualized window), so a follow-up Cmd+C silently truncates
    // to whatever was visible. We replace that with a deterministic full
    // model copy. We do NOT preventDefault when there's no handler — that
    // way the user still gets native Select-All on whatever DOM rows are
    // mounted, which is at least better than no-op.
    if (cmd && !e.altKey && !e.shiftKey && (e.key === 'a' || e.key === 'A')) {
      // The find/filter input is exempted from the foreign-input guard above (so
      // Cmd+G/F3 keep working while typing a query), which means Cmd+A reaches
      // here too. Inside that input, let the browser do its native select-all on
      // the input's own text instead of selecting the whole console.
      if (e.target === opts.findInputEl) return;
      if (!opts.selectAllAction) return;
      e.preventDefault();
      opts.selectAllAction();
      return;
    }

    // Cmd/Ctrl+End or End → bottom; Cmd/Ctrl+Home or Home → top.
    // Plain End/Home only fire when no foreign input has focus (already gated
    // above). Cmd+End / Cmd+Home work even from inside the find input.
    if ((cmd && e.key === 'End') || (e.key === 'End' && !cmd)) {
      e.preventDefault();
      opts.outputEl.scrollTo({ top: opts.outputEl.scrollHeight, behavior: 'auto' });
      return;
    }
    if ((cmd && e.key === 'Home') || (e.key === 'Home' && !cmd)) {
      e.preventDefault();
      opts.outputEl.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
  };

  document.addEventListener('keydown', onKeyDown);

  return {
    dispose() {
      document.removeEventListener('keydown', onKeyDown);
    }
  };
}
