/**
 * Keyboard shortcuts for the telnet log viewers (live Console + log file viewer).
 *
 * Bindings:
 *   Cmd/Ctrl+F            → focus find input
 *   Cmd/Ctrl+G  /  F3     → next match
 *   Shift+Cmd/Ctrl+G  /  Shift+F3
 *                          → previous match
 *   Cmd/Ctrl+Alt+F        → toggle Find ⇄ Filter mode
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

import type { TelnetOutputFindBarHandle } from './telnet-output-find-bar.js';

export type ViewerShortcutOpts = {
  findBar: TelnetOutputFindBarHandle | null;
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
