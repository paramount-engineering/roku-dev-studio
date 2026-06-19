// Queries component - Main setup function

import { setupQueryButtons } from './query-handlers.js';
import { setupPostButtons } from './post-handlers.js';
import { setupTelnetCommands } from './telnet-command-handler.js';
import { setupRemovePlugin } from './remove-plugin-handler.js';
import { setupCustomQuery } from './custom-query-handler.js';
import { setupSecretScreens } from './secret-screens.js';
import { OutputArea } from '../../modules/ui/output-area.js';
import { setupCopyButton } from '../../modules/ui/copy-button.js';
import { createFindBar, buildFindBarElement, bindFindShortcut } from '../../modules/ui/find-bar.js';
import { attachFoldToggle, structuredBodyText, structuredFileExtension } from '../../modules/ui/structured-body.js';
import { attachSelectAll } from '../../modules/ui/select-all.js';
import type { DevicePanelRoot } from '../../types/device-panel-dom.js';

export function setupQueries(panel: DevicePanelRoot, api: QueriesDeviceApi): void {
  panel.rokuDevStudioApi = api;

  const queryOutput = panel.querySelector<HTMLElement>('.query-output');
  const copyBtn = panel.querySelector<HTMLButtonElement>('.copy-query-btn');
  const saveBtn = panel.querySelector<HTMLButtonElement>('.save-query-btn');
  const clearBtn = panel.querySelector<HTMLButtonElement>('.clear-query-btn');
  const customQueryInput = panel.querySelector<HTMLInputElement | HTMLTextAreaElement>('.custom-query-input');
  const runCustomQueryBtn = panel.querySelector<HTMLButtonElement>('.run-custom-query-btn');
  const removePluginSection = panel.querySelector<HTMLElement>('.remove-plugin-section');
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

  if (!queryOutput || !copyBtn || !customQueryInput || !runCustomQueryBtn) {
    console.error('Query elements not found:', {
      queryOutput,
      copyBtn,
      customQueryInput,
      runCustomQueryBtn
    });
    return;
  }

  if (removePluginSection) {
    removePluginSection.style.display = 'none';
  }

  // Shared simple find bar, hosted inline in the Results card header to save vertical space. Shown
  // only when results are present (driven by OutputArea display/clear).
  const findBarEl = buildFindBarElement('Find in Results');
  findBarEl.classList.add('find-bar-header');
  const resultsHeader = panel.querySelector('.query-results-card-header');
  if (resultsHeader instanceof HTMLElement) resultsHeader.appendChild(findBarEl);
  else queryOutput.insertAdjacentElement('beforebegin', findBarEl);
  const findBar = createFindBar({ bodyEl: queryOutput, barEl: findBarEl, highlightId: 'ecp-find' });
  if (findBar) bindFindShortcut(queryOutput, findBar);

  // Collapsible JSON/XML nodes in the results (delegated twisty handler survives re-renders).
  attachFoldToggle(queryOutput);

  // Cmd/Ctrl+A selects all the results text (when the output is focused) instead of the page.
  attachSelectAll(queryOutput);

  // Manage the Copy/Save/Clear icon buttons here (not via OutputArea's copyButton) so all three
  // toggle together and keep the `.btn` inline-flex centering for their icons.
  const outputArea = new OutputArea(queryOutput, null, (hasContent) => {
    findBar?.setVisible(hasContent);
    if (hasContent) findBar?.refresh();
    const display = hasContent ? 'inline-flex' : 'none';
    copyBtn.style.display = display;
    if (saveBtn) saveBtn.style.display = display;
    if (clearBtn) clearBtn.style.display = display;
  });

  // Copy/Save operate on the visible text (or the structured source for JSON/XML) — never the
  // rendered HTML, so plain-text command output (e.g. `free -m`) isn't mistaken for markup.
  setupCopyButton(copyBtn, () => structuredBodyText(queryOutput), {
    successText: '✓ Copied!',
    duration: 2000
  });

  saveBtn?.addEventListener('click', () => {
    const content = structuredBodyText(queryOutput);
    if (!content) return;
    void window.roku?.saveTextFile?.({
      content,
      defaultName: `ecp-response-${Date.now()}.${structuredFileExtension(content)}`,
      dialogTitle: 'Save Results'
    });
  });

  clearBtn?.addEventListener('click', () => {
    outputArea.clear();
  });

  setupSecretScreens(panel);

  const { runQuery } = setupQueryButtons(panel, api, outputArea, removePluginSection);

  setupPostButtons(panel, api, outputArea, removePluginSection);

  setupTelnetCommands(panel, api, outputArea, removePluginSection);

  setupRemovePlugin(panel, api, outputArea);

  setupCustomQuery(customQueryInput, runCustomQueryBtn, removePluginSection, runQuery);
}
