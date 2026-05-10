// Query button handlers (GET requests)

import { formatQueryResult, escapeHtml } from '../../modules/utils/index.js';
import type { OutputArea } from '../../modules/ui/output-area.js';

export function setupQueryButtons(
  panel: HTMLElement,
  api: QueriesDeviceApi,
  outputArea: OutputArea,
  searchInput: HTMLInputElement,
  removePluginSection: HTMLElement | null
): { runQuery: (endpoint: string, btn?: HTMLButtonElement | null) => Promise<void> } {
  async function runQuery(endpoint: string, btn: HTMLButtonElement | null = null) {
    if (btn) btn.disabled = true;
    searchInput.value = '';
    searchInput.style.borderColor = '';

    if (removePluginSection) {
      removePluginSection.style.display = 'none';
    }

    try {
      const result = await api.query(endpoint);

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
      // wrapApiCall in app.ts re-throws; without this the button would stay disabled.
      const err = e instanceof Error ? e.message : String(e);
      outputArea.display(`<span style="color: var(--accent-red);">Error: ${escapeHtml(err)}</span>`, true);
      outputArea.originalContent = `Error: ${err}`;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  panel.querySelectorAll('.query-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const endpoint = (btn as HTMLElement).dataset.query;
      if (!endpoint) return;
      await runQuery(endpoint, btn as HTMLButtonElement);
    });
  });

  return { runQuery };
}

function checkOutputExpansion(queryOutput: HTMLElement | null) {
  if (!queryOutput) return;
  if (queryOutput.scrollHeight > 200) {
    queryOutput.classList.add('expanded');
  } else {
    queryOutput.classList.remove('expanded');
  }
}
