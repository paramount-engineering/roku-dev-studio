// POST button handlers

import { formatQueryResult, escapeHtml } from '../../modules/utils/index.js';
import type { OutputArea } from '../../modules/ui/output-area.js';

export function setupPostButtons(
  panel: HTMLElement,
  api: QueriesDeviceApi,
  outputArea: OutputArea,
  removePluginSection: HTMLElement | null
): void {
  panel.querySelectorAll('.post-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const endpoint = (btn as HTMLElement).dataset.post;
      if (!endpoint) return;

      if (removePluginSection) {
        removePluginSection.style.display = 'none';
      }

      (btn as HTMLButtonElement).disabled = true;
      const iconElement = btn.querySelector('.icon');
      if (iconElement) {
        iconElement.classList.add('icon-loading');
      }

      const originalText = btn.textContent;
      try {
        const result = await api.post(endpoint);

        if (result.success && result.data) {
          const originalContent = result.data.replace(/></g, '>\n<').replace(/\n\s*\n/g, '\n');
          outputArea.display(formatQueryResult(result.data), true);
          outputArea.originalContent = originalContent;
        } else {
          const err = result.error || 'Unknown error';
          const errorContent = `Error: ${err}`;
          outputArea.display(`<span style="color: var(--accent-red);">Error: ${escapeHtml(err)}</span>`, true);
          outputArea.originalContent = errorContent;
        }

        checkOutputExpansion(outputArea.container);
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        outputArea.display(`<span style="color: var(--accent-red);">Error: ${escapeHtml(err)}</span>`, true);
        outputArea.originalContent = `Error: ${err}`;
      } finally {
        (btn as HTMLButtonElement).disabled = false;
        if (originalText != null) btn.textContent = originalText;
        if (iconElement) {
          iconElement.classList.remove('icon-loading');
        }
      }
    });
  });
}

function checkOutputExpansion(queryOutput: HTMLElement | null) {
  if (!queryOutput) return;
  if (queryOutput.scrollHeight > 200) {
    queryOutput.classList.add('expanded');
  } else {
    queryOutput.classList.remove('expanded');
  }
}
