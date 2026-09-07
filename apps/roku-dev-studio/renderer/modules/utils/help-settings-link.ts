/**
 * Delegated click handler for `.help-settings-link` elements embedded in help/info modal
 * HTML content (data-i18n-html strings can't carry their own listeners) — clicking one opens
 * Settings navigated to `data-settings-section`, scrolled to and flashing
 * `data-settings-highlight` when present.
 */
export function wireHelpSettingsLinks(root: ParentNode | null): void {
  if (!root) return;
  root.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement | null)?.closest('.help-settings-link') as HTMLElement | null;
    if (!target) return;
    e.preventDefault();
    const section = target.dataset.settingsSection || undefined;
    const highlight = target.dataset.settingsHighlight || undefined;
    window.roku?.openSettings?.(section, highlight);
  });
}
