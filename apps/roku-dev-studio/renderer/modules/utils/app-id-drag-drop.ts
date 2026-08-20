/**
 * Drag an installed-app tile (Apps tab) onto an App ID text field instead of typing the id.
 * `makeAppIdDragSource` marks the tile; `makeAppIdDropTarget` marks the field that accepts it.
 */

const DROP_TARGET_DRAGOVER_CLASS = 'app-id-drop-target--dragover';

// A deliberately non-standard MIME type, not 'text/plain'. Chromium natively drops
// 'text/plain' data into *any* editable text field on its own — Content ID, Add Parameter
// rows, anything — with no JS involved, before makeAppIdDropTarget's own `drop` handler
// (attached only to the intended field) ever gets a say. Nothing recognizes this custom
// type by default, so only the explicit listener below (the one field meant to accept it)
// can read it — every other field silently rejects the drop instead of eating it.
const APP_ID_MIME_TYPE = 'application/x-rds-app-id';

/** Mark a tile as a drag source carrying `appId`, readable only by `makeAppIdDropTarget`. */
export function makeAppIdDragSource(el: HTMLElement, appId: string): void {
  el.draggable = true;
  el.addEventListener('dragstart', (e: DragEvent) => {
    e.dataTransfer?.setData(APP_ID_MIME_TYPE, appId);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
  });
}

/** Let a text input accept a dropped app id from `makeAppIdDragSource`, filling and focusing it. */
export function makeAppIdDropTarget(input: HTMLInputElement): void {
  input.addEventListener('dragenter', (e: DragEvent) => {
    e.preventDefault();
    input.classList.add(DROP_TARGET_DRAGOVER_CLASS);
  });
  input.addEventListener('dragover', (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  input.addEventListener('dragleave', () => {
    input.classList.remove(DROP_TARGET_DRAGOVER_CLASS);
  });
  input.addEventListener('drop', (e: DragEvent) => {
    e.preventDefault();
    input.classList.remove(DROP_TARGET_DRAGOVER_CLASS);
    const appId = e.dataTransfer?.getData(APP_ID_MIME_TYPE);
    if (!appId) return;
    input.value = appId;
    // Let listeners (e.g. an input-gated Launch button) react as if the user had typed it.
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
}
