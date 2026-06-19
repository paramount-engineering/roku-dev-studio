/**
 * Make Cmd/Ctrl+A select all text within `el` (scoped to that element) instead of selecting the
 * whole page, when focus is inside it. The element must be focusable (e.g. `tabindex="0"`) so it
 * receives the keydown. Inputs/textareas keep their native select-all. Returns a remover.
 *
 * Used by the output/result panes — ECP Query Results, App Connector Response, Network Inspector
 * Request/Response bodies — mirroring the Console viewer's existing Cmd+A behavior.
 */
export function attachSelectAll(el: HTMLElement): () => void {
  const onKeydown = (e: KeyboardEvent): void => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
    if (e.key !== 'a' && e.key !== 'A') return;
    // Leave native select-all alone when typing in a field (e.g. a find input inside the pane).
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    const sel = window.getSelection();
    if (!sel) return;
    e.preventDefault();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  };
  el.addEventListener('keydown', onKeydown);
  return () => el.removeEventListener('keydown', onKeydown);
}
