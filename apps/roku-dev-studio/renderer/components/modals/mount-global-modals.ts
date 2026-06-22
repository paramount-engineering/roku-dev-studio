/**
 * Injects global modal markup from `fragments/*.html` into `#global-modals-root`.
 * Keeps large modal HTML out of index.html; loads in parallel at startup.
 */

import { rendererError } from '../../modules/utils/logger.js';

let mounted = false;

export async function ensureGlobalModalsMounted() {
  if (mounted) return;
  const root = document.getElementById('global-modals-root');
  if (!root) {
    rendererError('[mount-global-modals] #global-modals-root not found');
    return;
  }
  const names = [
    'action-scripts-import-modal',
    'add-location-modal',
    'help-modal',
    'keyboard-remote-help-modal',
    'dev-mode-modal',
    'ecp-mode-modal',
    'integration-guide-modal',
    'secret-screens-modal',
    'deeplink-media-types-modal',
    'deeplink-save-preset-modal',
    'deeplink-delete-media-type-modal'
  ];
  const base = new URL('./fragments/', import.meta.url);
  const parts = await Promise.all(
    names.map(async (name) => {
      const url = new URL(`${name}.html`, base);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load modal fragment ${name}: ${res.status} ${res.statusText}`);
      }
      return res.text();
    })
  );
  root.innerHTML = parts.join('\n');
  mounted = true;
}
