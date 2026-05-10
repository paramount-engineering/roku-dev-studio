/**
 * Equalize heights of .rale-param-input fields in the Action Scripts RALE builder row.
 * (Per-field auto-resize otherwise leaves short vs complex types uneven.)
 */

const ROW_MIN = 38;
const ROW_CAP = 200;

export function syncBuilderRaleParamRowHeights(container: HTMLElement | null | undefined) {
  if (!container?.classList.contains('builder-rale-command-params')) return;
  const fields = [...container.querySelectorAll('.rale-param-input')] as HTMLElement[];
  if (fields.length < 2) return;

  let maxH = ROW_MIN;
  for (const el of fields) {
    el.style.height = 'auto';
    if (el instanceof HTMLSelectElement) {
      maxH = Math.max(maxH, el.offsetHeight || ROW_MIN);
      continue;
    }
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const sh = Math.max(ROW_MIN, Math.min(el.scrollHeight, ROW_CAP));
      maxH = Math.max(maxH, sh);
    }
  }

  for (const el of fields) {
    el.style.height = `${maxH}px`;
    el.style.boxSizing = 'border-box';
  }
}
