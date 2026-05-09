// Queries component - Main setup function

import { setupQueryButtons } from './query-handlers.js';
import { setupPostButtons } from './post-handlers.js';
import { setupTelnetCommands } from './telnet-command-handler.js';
import { setupRemovePlugin } from './remove-plugin-handler.js';
import { setupCustomQuery } from './custom-query-handler.js';
import { setupQuerySearch } from './query-search.js';
import { setupSecretScreens } from './secret-screens.js';
import { OutputArea } from '../../modules/ui/output-area.js';
import { setupCopyButton } from '../../modules/ui/copy-button.js';
import type { DevicePanelRoot } from '../../types/device-panel-dom.js';

export function setupQueries(panel: DevicePanelRoot, api: QueriesDeviceApi): void {
  panel.rokuDevStudioApi = api;

  const queryOutput = panel.querySelector<HTMLElement>('.query-output');
  const copyBtn = panel.querySelector<HTMLButtonElement>('.copy-query-btn');
  const searchInput = panel.querySelector<HTMLInputElement>('.query-search-input');
  const customQueryInput = panel.querySelector<HTMLInputElement | HTMLTextAreaElement>('.custom-query-input');
  const runCustomQueryBtn = panel.querySelector<HTMLButtonElement>('.run-custom-query-btn');
  const removePluginSection = panel.querySelector<HTMLElement>('.remove-plugin-section');
  const searchPrevBtn = panel.querySelector<HTMLButtonElement>('.search-prev-btn');
  const searchNextBtn = panel.querySelector<HTMLButtonElement>('.search-next-btn');
  const matchCountSpan = panel.querySelector<HTMLElement>('.search-match-count');
  const querySearchRow = panel.querySelector<HTMLElement>('.query-search-row');
  const openFiddleBtn = panel.querySelector<HTMLButtonElement>('.open-fiddle-btn');

  if (openFiddleBtn) {
    // The "Open Fiddle" action only makes sense when we can resolve the
    // panel's device back into the Fiddle dropdown. Click hands off to the
    // app-level helper that builds the snapshot + opens the window with the
    // originating device preselected. Button renders as a no-op (and does
    // nothing) if the helper isn't available yet, so this is safe to bind
    // unconditionally.
    openFiddleBtn.addEventListener('click', () => {
      const opener = (window as unknown as {
        __rdsOpenFiddleForDevice?: (locator: { ip: string; isRemote?: boolean; serverUrl?: string | null }) => void;
      }).__rdsOpenFiddleForDevice;
      if (typeof opener !== 'function') return;
      opener({
        ip: api.ip,
        isRemote: !!api.isRemote,
        serverUrl: api.serverUrl || null
      });
    });
  }

  if (!queryOutput || !copyBtn || !searchInput || !customQueryInput || !runCustomQueryBtn) {
    console.error('Query elements not found:', {
      queryOutput,
      copyBtn,
      searchInput,
      customQueryInput,
      runCustomQueryBtn
    });
    return;
  }

  if (removePluginSection) {
    removePluginSection.style.display = 'none';
  }

  const outputArea = new OutputArea(queryOutput, copyBtn, querySearchRow);

  setupCopyButton(copyBtn, () => outputArea.getOriginalContent() || outputArea.getText(), {
    successText: '✓ Copied!',
    duration: 2000
  });

  setupSecretScreens(panel);

  const { runQuery } = setupQueryButtons(panel, api, outputArea, searchInput, removePluginSection);

  setupPostButtons(panel, api, outputArea, removePluginSection);

  setupTelnetCommands(panel, api, outputArea, removePluginSection);

  setupRemovePlugin(panel, api, outputArea);

  setupCustomQuery(customQueryInput, runCustomQueryBtn, removePluginSection, runQuery);

  setupQuerySearch(
    searchInput,
    queryOutput,
    searchPrevBtn,
    searchNextBtn,
    matchCountSpan,
    () => outputArea.originalContent || '',
    (content) => {
      outputArea.originalContent = content;
    }
  );

  panel.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      const queryTab = panel.querySelector('[data-inner-content="query"]');
      if (
        queryTab &&
        queryTab.classList.contains('active') &&
        copyBtn.style.display === 'block'
      ) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    }
  });
}
